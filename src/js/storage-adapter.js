import { getCurrentManagerId } from "./auth.js";

const SCHEDULE_PREFIX = "schedule-";

// --- Config ---
const API_BASE = "/api";
// Which manager's data this session reads/writes comes from auth.js's
// lightweight sign-in picker (see that file). It falls back to ManagerId 1
// (Joe/GM) if nobody has signed in yet, so nothing here special-cases that.

// ---------------------------------------------------------------------------
// apiAdapter: backed by the Azure SQL Database via the /api Functions.
//
// getTasks()/getNotes()/getSchedule() stay SYNCHRONOUS (same call signature
// every other file already uses) by reading from an in-memory cache. Callers
// must `await storage.loadDate(dateKey)` once before reading a date for the
// first time -- see loadTasksFor()/loadNotesFor() in tasks.js/notes.js and
// loadScheduleFor() in schedule-behavior.js.
// saveTasks()/saveNotes()/saveSchedule() update the cache immediately (so the
// UI never waits on the network) and persist to the API in the background.
// ---------------------------------------------------------------------------

const cache = {
    tasks: new Map(),   // dateKey -> array
    notes: new Map(),   // dateKey -> array
    schedule: new Map() // dateKey -> { slotId: text }
};
const inFlight = new Map(); // dateKey -> in-progress load promise, dedupes concurrent calls

// Dates whose load ultimately failed even after retries. The serverless SQL
// tier auto-pauses when idle, so the first request after a quiet spell can
// fail while it wakes back up -- loadDate() retries a few times to ride that
// out. If it still fails, we do NOT want tasks.js/notes.js/schedule-behavior
// silently treating "couldn't load" as "this day is empty": the UI would
// look blank, and the very next click-to-edit save would overwrite whatever
// real data is actually sitting in the database with that emptiness. Save*
// below checks this set and refuses to save (with a warning) instead.
const loadFailedDates = new Set();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadDate(dateKey, { force = false } = {}) {
    if (!force && cache.tasks.has(dateKey) && cache.notes.has(dateKey) && cache.schedule.has(dateKey)) return;
    if (inFlight.has(dateKey)) return inFlight.get(dateKey);

    const promise = (async () => {
        // Cold starts on the serverless Function App + serverless SQL tier
        // can take a while to wake up (occasionally over a minute) after the
        // app has sat idle. 3 attempts at 3s apart (~9s total) wasn't enough
        // headroom to reliably ride that out, so this now spreads 5 attempts
        // out further (~38s total) before giving up.
        const MAX_ATTEMPTS = 5;
        const RETRY_DELAY_MS = 5000;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const res = await fetch(`${API_BASE}/day?managerId=${getCurrentManagerId()}&date=${dateKey}`);
                if (!res.ok) throw new Error(`GET /api/day ${res.status}`);
                const data = await res.json();
                cache.tasks.set(dateKey, Array.isArray(data.tasks) ? data.tasks : []);
                cache.notes.set(dateKey, Array.isArray(data.notes) ? data.notes : []);
                cache.schedule.set(dateKey, (data.schedule && typeof data.schedule === "object") ? data.schedule : {});
                loadFailedDates.delete(dateKey);
                return;
            } catch (err) {
                console.error(`storage-adapter: failed to load ${dateKey} (attempt ${attempt}/${MAX_ATTEMPTS})`, err);
                if (attempt < MAX_ATTEMPTS) {
                    await sleep(RETRY_DELAY_MS);
                }
            }
        }

        // All retries failed. Fail soft so the UI still renders (empty day)
        // instead of hanging -- but flag the date so saves are blocked rather
        // than silently wiping real data. See loadFailedDates above.
        loadFailedDates.add(dateKey);
        if (!cache.tasks.has(dateKey)) cache.tasks.set(dateKey, []);
        if (!cache.notes.has(dateKey)) cache.notes.set(dateKey, []);
        if (!cache.schedule.has(dateKey)) cache.schedule.set(dateKey, {});
    })();

    inFlight.set(dateKey, promise);
    try {
        await promise;
    } finally {
        inFlight.delete(dateKey);
    }
}

function warnLoadFailed(dateKey) {
    alert(
        `This day's data didn't load correctly (the database may still be waking up). ` +
        `Saving now could overwrite what's already there.\n\n` +
        `Please wait about 30 seconds and try again -- no need to refresh the page.`
    );
    console.error(`storage-adapter: refused to save ${dateKey} -- its load never succeeded`);

    // Kick off a fresh background retry right away instead of making the
    // user refresh the whole page. If the backend has woken up by the time
    // they try their edit again, loadDate() below will succeed and clear
    // loadFailedDates, so the next save just works.
    loadDate(dateKey, { force: true });
}

function postJSON(path, body) {
    return fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }).catch(err => console.error("storage-adapter: save failed", path, err));
}

export const apiAdapter = {
    loadDate,

    getTasks(dateKey) {
        return cache.tasks.get(dateKey) || [];
    },

    saveTasks(dateKey, tasks) {
        if (loadFailedDates.has(dateKey)) { warnLoadFailed(dateKey); return; }
        cache.tasks.set(dateKey, tasks || []);
        postJSON("/tasks", { managerId: getCurrentManagerId(), date: dateKey, tasks: tasks || [] });
    },

    getNotes(dateKey) {
        return cache.notes.get(dateKey) || [];
    },

    saveNotes(dateKey, notes) {
        if (loadFailedDates.has(dateKey)) { warnLoadFailed(dateKey); return; }
        cache.notes.set(dateKey, notes || []);
        postJSON("/notes", { managerId: getCurrentManagerId(), date: dateKey, notes: notes || [] });
    },

    getSchedule(dateKey) {
        return cache.schedule.get(dateKey) || {};
    },

    saveSchedule(dateKey, obj) {
        if (loadFailedDates.has(dateKey)) { warnLoadFailed(dateKey); return; }
        const schedule = (obj && typeof obj === "object") ? obj : {};
        cache.schedule.set(dateKey, schedule);
        postJSON("/schedule", { managerId: getCurrentManagerId(), date: dateKey, schedule });
    }
};

// ---------------------------------------------------------------------------
// localStorageAdapter: the original client-only adapter. Kept as a fallback/
// escape hatch (e.g. testing offline) via useLocalStorage() below.
// ---------------------------------------------------------------------------

const TASKS_PREFIX = "tasks-";
const NOTES_PREFIX = "notes-";

export const localStorageAdapter = {
    async loadDate() { /* no-op: localStorage reads are already synchronous */ },

    getSchedule(dateKey) {
        const key = SCHEDULE_PREFIX + dateKey;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return {};
            const obj = JSON.parse(raw);
            return (obj && typeof obj === "object") ? obj : {};
        } catch {
            return {};
        }
    },

    saveSchedule(dateKey, obj) {
        const key = SCHEDULE_PREFIX + dateKey;
        try {
            if (!obj || Object.keys(obj).length === 0) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(obj));
            }
        } catch {}
    },

    getTasks(dateKey) {
        const key = TASKS_PREFIX + dateKey;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    },

    saveTasks(dateKey, tasks) {
        const key = TASKS_PREFIX + dateKey;
        try {
            if (!tasks || tasks.length === 0) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(tasks));
            }
        } catch {}
    },

    getNotes(dateKey) {
        const key = NOTES_PREFIX + dateKey;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    },

    saveNotes(dateKey, notes) {
        const key = NOTES_PREFIX + dateKey;
        try {
            if (!notes || notes.length === 0) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(notes));
            }
        } catch {}
    }
};

export let storage = apiAdapter;

export function useLocalStorage() { storage = localStorageAdapter; window.storage = storage; }
export function useApi() { storage = apiAdapter; window.storage = storage; }

window.storage = storage;
