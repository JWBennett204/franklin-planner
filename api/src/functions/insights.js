// GET  /api/insights          -> returns a short description of the database schema
// POST /api/insights  { query: "SELECT ..." } -> runs a single read-only query
//
// This exists so Claude (or Joe, with a raw HTTP call) can answer ad hoc data
// questions -- "what was the most popular topic in August?" -- without a
// standing database credential. It reuses this app's existing DB connection
// (see ../db.js, which already authenticates via the Function App's managed
// identity) instead of creating a separate SQL login. fpproto13-sql is
// Microsoft Entra-only, so a SQL username/password login isn't even possible
// here -- this endpoint is the actual way in.
//
// Safety, since this route is authLevel: "anonymous" like the rest of the
// app's routes (no Azure Function key involved):
//   - Requires the x-insights-key header to match the INSIGHTS_API_KEY
//     Function App setting. If that setting isn't configured at all, every
//     request is rejected -- this fails closed, not open.
//   - Only a single SELECT statement is allowed: no semicolons (blocks
//     stacking a second statement), no INSERT/UPDATE/DELETE/DDL/EXEC/etc.
//   - Results are capped at 500 rows so a broad query can't return an
//     unbounded payload.
const { app } = require("@azure/functions");
const { getPool } = require("../db");

const MAX_QUERY_LENGTH = 4000;
const MAX_ROWS = 500;

// Whole-word match so this doesn't false-positive on note/task text that
// happens to contain one of these words (e.g. a note that says "created the
// deck for Monday").
const BLOCKED_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|EXECUTE|MERGE|TRUNCATE|GRANT|REVOKE|CREATE|BACKUP|RESTORE|SHUTDOWN|DBCC|OPENROWSET|OPENQUERY|INTO|WAITFOR)\b/i;

const SCHEMA_DESCRIPTION = {
    Managers: ["ManagerId (int, PK)", "Name (nvarchar)", "Role (nvarchar)"],
    Tasks: ["ManagerId (int, FK -> Managers)", "TaskDate (date)", "Priority (nvarchar, e.g. 'A1')", "SortOrder (int)", "TaskText (nvarchar)", "Status (nvarchar)", "IsForwarded (bit)"],
    Notes: ["ManagerId (int, FK -> Managers)", "NoteDate (date)", "Priority (nvarchar)", "SortOrder (int)", "NoteText (nvarchar)", "Status (nvarchar)"],
    ScheduleItems: ["ManagerId (int, FK -> Managers)", "ScheduleDate (date)", "SlotId (nvarchar)", "ItemText (nvarchar)"]
};

function checkKey(request) {
    const expected = process.env.INSIGHTS_API_KEY;
    if (!expected) return false; // fail closed if the setting was never configured
    const provided = request.headers.get("x-insights-key");
    return provided === expected;
}

function validateQuery(query) {
    if (typeof query !== "string" || !query.trim()) {
        return "query is required";
    }
    const trimmed = query.trim();
    if (trimmed.length > MAX_QUERY_LENGTH) {
        return `query exceeds ${MAX_QUERY_LENGTH} characters`;
    }
    if (!/^SELECT\s/i.test(trimmed)) {
        return "only SELECT statements are allowed";
    }
    if (trimmed.includes(";")) {
        return "semicolons are not allowed (single statement only)";
    }
    if (BLOCKED_KEYWORDS.test(trimmed)) {
        return "query contains a disallowed keyword";
    }
    return null;
}

app.http("insights", {
    methods: ["GET", "POST"],
    authLevel: "anonymous",
    route: "insights",
    handler: async (request, context) => {
        if (!checkKey(request)) {
            return { status: 401, jsonBody: { error: "Unauthorized" } };
        }

        if (request.method === "GET") {
            return {
                jsonBody: {
                    schema: SCHEMA_DESCRIPTION,
                    note: "POST { query: 'SELECT ...' } with the same x-insights-key header to run a read-only query. Single SELECT statements only, no semicolons, no writes/DDL, results capped at 500 rows."
                }
            };
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return { status: 400, jsonBody: { error: "Invalid JSON body" } };
        }

        const query = body && body.query;
        const validationError = validateQuery(query);
        if (validationError) {
            return { status: 400, jsonBody: { error: validationError } };
        }

        try {
            const pool = await getPool();
            const req = pool.request();
            req.timeout = 15000; // extra-safe per-query cap, independent of the pool's default requestTimeout
            const result = await req.query(query);
            const all = result.recordset || [];
            const rows = all.slice(0, MAX_ROWS);
            return { jsonBody: { rowCount: rows.length, truncated: all.length > MAX_ROWS, rows } };
        } catch (err) {
            context.error("POST /api/insights query failed", err);
            return { status: 400, jsonBody: { error: "Query failed", detail: err.message } };
        }
    }
});
