// GET /api/day?managerId=1&date=2026-07-20
// Returns { tasks: [...], notes: [...], schedule: {...} } for one manager,
// one date -- the single call storage-adapter.js makes when the planner
// navigates to a date.
const { app } = require("@azure/functions");
const { sql, getPool, splitPriority } = require("../db");

app.http("day", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "day",
    handler: async (request, context) => {
        const managerId = parseInt(request.query.get("managerId"), 10);
        const date = request.query.get("date");

        if (!managerId || !date) {
            return { status: 400, jsonBody: { error: "managerId and date query params are required" } };
        }

        try {
            const pool = await getPool();

            const tasksResult = await pool.request()
                .input("managerId", sql.Int, managerId)
                .input("date", sql.Date, date)
                .query(`SELECT TaskText AS text, Priority, Status AS status, IsForwarded AS forwarded, SortOrder
                        FROM Tasks
                        WHERE ManagerId = @managerId AND TaskDate = @date
                        ORDER BY SortOrder`);

            const notesResult = await pool.request()
                .input("managerId", sql.Int, managerId)
                .input("date", sql.Date, date)
                .query(`SELECT NoteText AS text, Priority, Status AS status, SortOrder
                        FROM Notes
                        WHERE ManagerId = @managerId AND NoteDate = @date
                        ORDER BY SortOrder`);

            const scheduleResult = await pool.request()
                .input("managerId", sql.Int, managerId)
                .input("date", sql.Date, date)
                .query(`SELECT SlotId, ItemText
                        FROM ScheduleItems
                        WHERE ManagerId = @managerId AND ScheduleDate = @date`);

            const tasks = tasksResult.recordset.map((r) => {
                const { letter, number } = splitPriority(r.Priority);
                return { status: r.status || "", letter, number, text: r.text || "", forwarded: !!r.forwarded };
            });

            const notes = notesResult.recordset.map((r) => {
                const { letter, number } = splitPriority(r.Priority);
                return { status: r.status || "", letter, number, text: r.text || "" };
            });

            const schedule = {};
            for (const r of scheduleResult.recordset) {
                schedule[r.SlotId] = r.ItemText;
            }

            return { jsonBody: { tasks, notes, schedule } };
        } catch (err) {
            context.error("GET /api/day failed", err);
            return { status: 500, jsonBody: { error: "Database error", detail: err.message, code: err.code } };
        }
    }
});
