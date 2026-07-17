const SCHEDULE_PREFIX = "schedule-";
const TASKS_PREFIX = "tasks-";

export const localStorageAdapter = {
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
    }
};

export let storage = localStorageAdapter;

export function useLocalStorage() { storage = localStorageAdapter; }
export function useSharePoint() { storage = sharePointAdapter; }

window.storage = storage;
