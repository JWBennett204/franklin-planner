// POST /api/tasks  { managerId, date, tasks: [...] }
// Replace-all for the (managerId, date) pair -- the client always sends the
// full 16-slot array, so a delete-then-insert keeps SortOrder (and therefore
// display position) trivially correct without needing per-row IDs.
const { app } = require("@azure/functions");
const { sql, getPool, joinPriority } = require("../db");

app.http("saveTasks", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "tasks",
    handler: async (request, context) => {
        let body;
        try {
            body = await request.json();
        } catch {
            return { status: 400, jsonBody: { error: "Invalid JSON body" } };
        }

        const { managerId, date, tasks } = body || {};
        if (!managerId || !date || !Array.isArray(tasks)) {
            return { status: 400, jsonBody: { error: "managerId, date, and tasks[] are required" } };
        }

        try {
            const pool = await getPool();
            const tx = new sql.Transaction(pool);
            await tx.begin();

            try {
                await new sql.Request(tx)
                    .input("managerId", sql.Int, managerId)
                    .input("date", sql.Date, date)
                    .query("DELETE FROM Tasks WHERE ManagerId = @managerId AND TaskDate = @date");

                for (let i = 0; i < tasks.length; i++) {
                    const t = tasks[i] || {};
                    const priority = joinPriority(t.letter, t.number);
                    // Skip fully-empty slots so we're not storing 16 blank rows every save.
                    if (!priority && !t.text && !t.status) continue;

                    await new sql.Request(tx)
                        .input("managerId", sql.Int, managerId)
                        .input("date", sql.Date, date)
                        .input("priority", sql.NVarChar(5), priority || null)
                        .input("sortOrder", sql.Int, i)
                        .input("text", sql.NVarChar(500), t.text || null)
                        .input("status", sql.NVarChar(10), t.status || "")
                        .input("forwarded", sql.Bit, !!t.forwarded)
                        .query(`INSERT INTO Tasks (ManagerId, TaskDate, Priority, SortOrder, TaskText, Status, IsForwarded)
                                VALUES (@managerId, @date, @priority, @sortOrder, @text, @status, @forwarded)`);
                }

                await tx.commit();
            } catch (err) {
                await tx.rollback();
                throw err;
            }

            return { jsonBody: { ok: true } };
        } catch (err) {
            context.error("POST /api/tasks failed", err);
            return { status: 500, jsonBody: { error: "Database error" } };
        }
    }
});
