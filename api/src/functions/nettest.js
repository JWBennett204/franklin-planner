// GET /api/nettest
// TEMP diagnostic endpoint -- delete once the /api/day 500 is resolved.
//
// Two independent probes, both bypassing tedious/mssql entirely:
//   1. Raw TCP connect to the SQL server on port 1433 -- isolates pure
//      network reachability from the managed Functions sandbox.
//   2. DefaultAzureCredential token acquisition for the SQL resource
//      audience -- isolates whether the system-assigned managed identity
//      can actually get a token in this runtime, separate from anything
//      tedious/mssql does with it afterward.
const { app } = require("@azure/functions");
const net = require("net");
const { DefaultAzureCredential } = require("@azure/identity");

function tcpProbe(host, port, timeoutMs) {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({ ...result, elapsedMs: Date.now() - start });
        };

        socket.setTimeout(timeoutMs);
        socket.once("connect", () => finish({ outcome: "connected" }));
        socket.once("timeout", () => finish({ outcome: "timeout" }));
        socket.once("error", (err) => finish({ outcome: "error", code: err.code, message: err.message }));

        socket.connect(port, host);
    });
}

async function tokenProbe() {
    const start = Date.now();
    try {
        const credential = new DefaultAzureCredential();
        // Resource ID for Azure SQL Database / Data Warehouse AAD auth.
        const token = await credential.getToken("https://database.windows.net/.default");
        return {
            outcome: token ? "acquired" : "empty",
            hasToken: !!(token && token.token),
            expiresOnTimestamp: token && token.expiresOnTimestamp,
            elapsedMs: Date.now() - start
        };
    } catch (err) {
        return {
            outcome: "error",
            name: err.name,
            message: err.message,
            errors: Array.isArray(err.errors) ? err.errors.map((e) => e && e.message) : undefined,
            stack: (err.stack || "").split("\n").slice(0, 8),
            elapsedMs: Date.now() - start
        };
    }
}

app.http("nettest", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "nettest",
    handler: async (request, context) => {
        const host = process.env.SQL_SERVER || "fpproto13-sql.database.windows.net";

        const [tcp, token] = await Promise.all([
            tcpProbe(host, 1433, 8000),
            tokenProbe()
        ]);

        return {
            jsonBody: {
                tcp: { host, port: 1433, ...tcp },
                identityEnv: {
                    hasIdentityEndpoint: !!process.env.IDENTITY_ENDPOINT,
                    hasIdentityHeader: !!process.env.IDENTITY_HEADER,
                    hasMsiEndpoint: !!process.env.MSI_ENDPOINT
                },
                token
            }
        };
    }
});
