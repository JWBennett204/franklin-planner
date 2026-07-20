const SCHEDULE_PREFIX = "schedule-";

// --- Config ---
const API_BASE = "/api";
// Phase 1: single hardcoded manager per browser session (Joe = GM = ManagerId 1).
// Real per-manager login isn't wired up yet -- see azure-data-storage-plan.md.
// To test as the "Test Manager" account (ManagerId 2), change this to 2 locally.
const CURRENT_MANAGER_ID = 1;

// ---------------------------------------------------------------------------
// apiAdapter: backed by the Azure SQL Database via the /api Functions.
//
// getTasks()/getNotes() stay SYNCHRONOUS (same call signature every other
// file already uses) by reading from an in-memory cache. Callers must
// `await storage.loadDate(dateKey)` once before reading a date for the
// first time -- see loadTasksFor()/loadNotesFor() in tasks.js/notes.js.
// saveTasks()/saveNotes() update the cache immediately (so the UI never
// waits on the network) and persist to the API in the background.
// ---------------------------------------------------------------------------

const cache = {
    tasks: new Map(),  // dateKey -> array
    notes: new Map()   // dateKey -> array
};
const inFlight = new Map(); // dateKey -> in-progress load promise, dedupes concurrent calls

async function loadDate(dateKey) {
    if (cache.tasks.has(dateKey) && cache.notes.has(dateKey)) return;
    if (inFlight.has(dateKey)) return inFlight.get(dateKey);

    const promise = (async () => {
        try {
            const res = await fetch(`${API_BASE}/day?managerId=${CURRENT_MANAGER_ID}&date=${dateKey}`);
            if (!res.ok) throw new Error(`GET /api/day ${res.status}`);
            const data = await res.json();
            cache.tasks.set(dateKey, Array.isArray(data.tasks) ? data.tasks : []);
            cache.notes.set(dateKey, Array.isArray(data.notes) ? data.notes : []);
        } catch (err) {
            console.error("storage-adapter: failed to load", dateKey, err);
            // Fail soft so the UI still renders (empty day) instead of hanging.
            if (!cache.tasks.has(dateKey)) cache.tasks.set(dateKey, []);
            if (!cache.notes.has(dateKey)) cache.notes.set(dateKey, []);
        } finally {
            inFlight.delete(dateKey);
        }
    })();

    inFlight.set(dateKey, promise);
    return promise;
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
        cache.tasks.set(dateKey, tasks || []);
        postJSON("/tasks", { managerId: CURRENT_MANAGER_ID, date: dateKey, tasks: tasks || [] });
    },

    getNotes(dateKey) {
        return cache.notes.get(dateKey) || [];
    },

    saveNotes(dateKey, notes) {
        cache.notes.set(dateKey, notes || []);
        postJSON("/notes", { managerId: CURRENT_MANAGER_ID, date: dateKey, notes: notes || [] });
    },

    // Schedule persistence hasn't moved to the API yet (deferred -- see
    // azure-data-storage-plan.md). Still plain localStorage for now.
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
