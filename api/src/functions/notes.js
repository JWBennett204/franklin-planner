// POST /api/notes  { managerId, date, notes: [...] }
// Same replace-all pattern as /api/tasks -- see that file for the reasoning.
const { app } = require("@azure/functions");
const { sql, getPool, joinPriority } = require("../db");

app.http("saveNotes", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "notes",
    handler: async (request, context) => {
        let body;
        try {
            body = await request.json();
        } catch {
            return { status: 400, jsonBody: { error: "Invalid JSON body" } };
        }

        const { managerId, date, notes } = body || {};
        if (!managerId || !date || !Array.isArray(notes)) {
            return { status: 400, jsonBody: { error: "managerId, date, and notes[] are required" } };
        }

        try {
            const pool = await getPool();
            const tx = new sql.Transaction(pool);
            await tx.begin();

            try {
                await new sql.Request(tx)
                    .input("managerId", sql.Int, managerId)
                    .input("date", sql.Date, date)
                    .query("DELETE FROM Notes WHERE ManagerId = @managerId AND NoteDate = @date");

                for (let i = 0; i < notes.length; i++) {
                    const n = notes[i] || {};
                    const priority = joinPriority(n.letter, n.number);
                    if (!priority && !n.text && !n.status) continue;

                    await new sql.Request(tx)
                        .input("managerId", sql.Int, managerId)
                        .input("date", sql.Date, date)
                        .input("priority", sql.NVarChar(5), priority || null)
                        .input("sortOrder", sql.Int, i)
                        .input("text", sql.NVarChar(1000), n.text || null)
                        .input("status", sql.NVarChar(10), n.status || "")
                        .query(`INSERT INTO Notes (ManagerId, NoteDate, Priority, SortOrder, NoteText, Status)
                                VALUES (@managerId, @date, @priority, @sortOrder, @text, @status)`);
                }

                await tx.commit();
            } catch (err) {
                await tx.rollback();
                throw err;
            }

            return { jsonBody: { ok: true } };
        } catch (err) {
            context.error("POST /api/notes failed", err);
            return { status: 500, jsonBody: { error: "Database error" } };
        }
    }
});
