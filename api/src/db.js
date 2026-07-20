// api/src/db.js
// Shared SQL connection pool for all Functions in this app.
//
// Auth: the SQL server (fpproto13-sql) is Microsoft Entra-only -- there is no
// SQL username/password. 'azure-active-directory-default' uses
// @azure/identity's DefaultAzureCredential under the hood, which means:
//   - In Azure (once this Function App's system-assigned managed identity is
//     enabled and added as a SQL user -- see azure-data-storage-plan.md),
//     it authenticates via that managed identity automatically.
//   - Locally (`func start`), it falls back to your own `az login` session,
//     so you can test against the real database from your machine too.
const sql = require("mssql");

const SERVER = process.env.SQL_SERVER || "fpproto13-sql.database.windows.net";
const DATABASE = process.env.SQL_DATABASE || "FranklinPlannerDB";

const config = {
    server: SERVER,
    database: DATABASE,
    options: { encrypt: true },
    authentication: {
        type: "azure-active-directory-default"
    }
};

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((err) => {
            poolPromise = null; // allow the next request to retry the connection
            throw err;
        });
    }
    return poolPromise;
}

// Priority is stored as a single column ("A1", "B", "", ...) but the client
// works with separate letter/number fields. These two helpers keep that
// mapping in one place instead of duplicating it in every function.
function splitPriority(priority) {
    if (!priority) return { letter: "", number: "" };
    return { letter: priority[0], number: priority.slice(1) };
}

function joinPriority(letter, number) {
    return `${letter || ""}${number || ""}`;
}

module.exports = { sql, getPool, splitPriority, joinPriority };
