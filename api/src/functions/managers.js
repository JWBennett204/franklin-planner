// GET /api/managers
// Returns the list of managers for the lightweight sign-in picker (see
// src/js/auth.js -- this is NOT real authentication, just a name-based
// session switch for the pilot). No sensitive fields returned.
const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

app.http("managers", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "managers",
    handler: async (request, context) => {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .query(`SELECT ManagerId, Name, Role FROM Managers ORDER BY ManagerId`);

            const managers = result.recordset.map((r) => ({
                managerId: r.ManagerId,
                name: r.Name,
                role: r.Role || ""
            }));

            return { jsonBody: { managers } };
        } catch (err) {
            context.error("GET /api/managers failed", err);
            return { status: 500, jsonBody: { error: "Database error", detail: err.message, code: err.code } };
        }
    }
});
