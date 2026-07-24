// js/auth.js
//
// Lightweight sign-in for the pilot: pick which manager you are from a list.
// This is NOT real authentication (no password) -- it just scopes the
// session to a ManagerId so testing with two "identities" (Joe / Test
// Manager) doesn't require hand-editing storage-adapter.js. The plan is to
// replace this with real Microsoft Entra sign-in via Static Web Apps' built
// in auth once every manager has a confirmed company account -- see
// azure-data-storage-plan.md.

const MANAGER_ID_KEY = "fp_managerId";
const MANAGER_NAME_KEY = "fp_managerName";

// Falls back to ManagerId 1 (Joe/GM) if nothing has been picked yet, so the
// rest of the app never has to special-case "no manager selected".
export function getCurrentManagerId() {
    const id = parseInt(sessionStorage.getItem(MANAGER_ID_KEY), 10);
    return Number.isFinite(id) ? id : 1;
}

export function getCurrentManagerName() {
    return sessionStorage.getItem(MANAGER_NAME_KEY) || "";
}

function setCurrentManager(id, name) {
    sessionStorage.setItem(MANAGER_ID_KEY, String(id));
    sessionStorage.setItem(MANAGER_NAME_KEY, name || "");
}

export function signOut() {
    sessionStorage.removeItem(MANAGER_ID_KEY);
    sessionStorage.removeItem(MANAGER_NAME_KEY);
    window.location.reload();
}
window.signOutOfPlanner = signOut;

async function fetchManagers() {
    const res = await fetch("/api/managers");
    if (!res.ok) throw new Error(`GET /api/managers ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.managers) ? data.managers : [];
}

function renderLoginScreen(managers, onPicked) {
    const overlay = document.createElement("div");
    overlay.id = "loginOverlay";
    overlay.style.cssText = "position:fixed;inset:0;background:#f8f9f8;z-index:20000;display:flex;align-items:center;justify-content:center;";

    const box = document.createElement("div");
    box.style.cssText = "background:white;border:1px solid #b8c3c0;border-radius:8px;padding:32px;min-width:320px;box-shadow:0 4px 20px rgba(0,0,0,0.15);text-align:center;";

    const title = document.createElement("div");
    title.textContent = "Franklin Planner";
    title.style.cssText = "margin:0 0 4px 0;color:#244e52;font-size:22px;font-weight:bold;";
    box.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = "Who's planning today?";
    subtitle.style.cssText = "margin:0 0 20px 0;color:#666;font-size:13px;";
    box.appendChild(subtitle);

    managers.forEach((m) => {
        const btn = document.createElement("button");
        btn.textContent = m.name + (m.role ? ` (${m.role})` : "");
        btn.style.cssText = "display:block;width:100%;padding:12px;margin-bottom:10px;border:1px solid #b8c3c0;border-radius:6px;background:#f8f9f8;cursor:pointer;font-size:14px;color:#222;";
        btn.onmouseenter = () => { btn.style.background = "#244e52"; btn.style.color = "white"; };
        btn.onmouseleave = () => { btn.style.background = "#f8f9f8"; btn.style.color = "#222"; };
        btn.onclick = () => {
            setCurrentManager(m.managerId, m.name);
            document.body.removeChild(overlay);
            onPicked();
        };
        box.appendChild(btn);
    });

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// initAuth(onReady): if a manager was already picked earlier this browser
// session, calls onReady() immediately. Otherwise shows the picker and
// calls onReady() once someone is picked. Fails open (calls onReady()
// straight away, falling back to ManagerId 1) if /api/managers has a
// problem, so a hiccup in this new feature can't lock the whole app out.
export async function initAuth(onReady) {
    if (sessionStorage.getItem(MANAGER_ID_KEY)) {
        onReady();
        return;
    }
    try {
        const managers = await fetchManagers();
        if (!managers.length) {
            console.error("auth: no managers returned from /api/managers");
            onReady();
            return;
        }
        renderLoginScreen(managers, onReady);
    } catch (err) {
        console.error("auth: failed to load managers", err);
        onReady();
    }
}
