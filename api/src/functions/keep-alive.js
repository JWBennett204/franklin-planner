// api/src/functions/keep-alive.js
//
// Timer-triggered "keep warm" ping. The database (fpproto13-sql, serverless
// tier) auto-pauses after being idle and can take a long time to wake back
// up on the next real request -- that's the cold-start delay users hit when
// opening the planner after it's sat unused for a while (see
// azure-data-storage-plan.md / the retry-window work from 2026-07-31).
//
// This just runs a trivial query on a schedule during business hours so the
// database (and this Function App's own instance) never actually go idle
// long enough to need that slow wake-up in the first place. It has no HTTP
// route and returns nothing useful to anyone -- it exists purely for its
// side effect of keeping the connection warm.
//
// Schedule: every 10 minutes, 7am-6pm, Monday-Friday (NCRONTAB is
// {second} {minute} {hour} {day} {month} {day-of-week}). Adjust the hour
// range here if the business's actual hours differ.
const { app } = require("@azure/functions");
const { getPool } = require("../db");

app.timer("keepAlive", {
    schedule: "0 */10 7-18 * * 1-5",
    handler: async (myTimer, context) => {
        try {
            const pool = await getPool();
            await pool.request().query("SELECT 1 AS ping");
            context.log("keepAlive: ping succeeded");
        } catch (err) {
            // Don't let a single failed ping look like an outage -- the
            // normal retry logic on the actual user-facing endpoints still
            // covers them if a real request happens to land while the
            // database is briefly unavailable.
            context.error("keepAlive: ping failed", err);
        }
    }
});
