// GET /api/nettest
// TEMP diagnostic endpoint -- delete once the /api/day 500 is resolved.
// Tests raw TCP connectivity to the SQL server on port 1433, completely
// bypassing tedious/mssql and Azure AD auth. This isolates whether the
// managed Functions sandbox can reach the SQL server at the network level
// at all, separate from any driver/auth-layer problem.
const { app } = require("@azure/functions");
const net = require("net");

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

app.http("nettest", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "nettest",
    handler: async (request, context) => {
        const host = process.env.SQL_SERVER || "fpproto13-sql.database.windows.net";

        const result = await tcpProbe(host, 1433, 8000);

        return {
            jsonBody: {
                host,
                port: 1433,
                ...result
            }
        };
    }
});
