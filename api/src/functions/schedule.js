// POST /api/schedule  { managerId, date, schedule: { slotId: text, ... } }
// Same delete-then-insert pattern as /api/tasks and /api/notes, but schedule
// entries are a sparse slotId->text map (fixed grid of hourly slots) rather
// than an ordered array -- see fp-schedule.js / schedule-behavior.js.
const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

app.http("saveSchedule", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "schedule",
    handler: async (request, context) => {
        let body;
        try {
            body = await request.json();
        } catch {
            return { status: 400, jsonBody: { error: "Invalid JSON body" } };
        }

        const { managerId, date, schedule } = body || {};
        if (!managerId || !date || typeof schedule !== "object" || schedule === null || Array.isArray(schedule)) {
            return { status: 400, jsonBody: { error: "managerId, date, and schedule{} are required" } };
        }

        try {
            const pool = await getPool();
            const tx = new sql.Transaction(pool);
            await tx.begin();

            try {
                await new sql.Request(tx)
                    .input("managerId", sql.Int, managerId)
                    .input("date", sql.Date, date)
                    .query("DELETE FROM ScheduleItems WHERE ManagerId = @managerId AND ScheduleDate = @date");

                for (const [slotId, text] of Object.entries(schedule)) {
                    const trimmed = (text == null ? "" : String(text)).trim();
                    if (!trimmed) continue;

                    await new sql.Request(tx)
                        .input("managerId", sql.Int, managerId)
                        .input("date", sql.Date, date)
                        .input("slotId", sql.NVarChar(20), slotId)
                        .input("text", sql.NVarChar(1000), trimmed)
                        .query(`INSERT INTO ScheduleItems (ManagerId, ScheduleDate, SlotId, ItemText)
                                VALUES (@managerId, @date, @slotId, @text)`);
                }

                await tx.commit();
            } catch (err) {
                await tx.rollback();
                throw err;
            }

            return { jsonBody: { ok: true } };
        } catch (err) {
            context.error("POST /api/schedule failed", err);
            return { status: 500, jsonBody: { error: "Database error", detail: err.message, code: err.code } };
        }
    }
});
