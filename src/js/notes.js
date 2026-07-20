// js/notes.js — Complete with Visual Forward Modal + Click to Edit Fixed
// Forward modal is now shared: notes.js owns it, tasks.js reuses it via
// window.showForwardModal(row, textSelector, onConfirm).

if (typeof currentDate === "undefined") {
    window.currentDate = new Date();
}

function renderNotesHeader() {
    const header = document.getElementById("notesHeader");
    if (!header) return;

    const date = currentDate;
    const dayNum = date.getDate();
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const monthYear = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const weekOfYear = Math.ceil(dayOfYear / 7);
    const quarter = Math.floor((date.getMonth() + 3) / 3);

    header.innerHTML = `
        <div style="display:flex; gap:12px; margin-bottom:12px;">
            <div id="hazeldenQuote" style="flex:1; padding:12px; background:#f8f9f8; border:1px solid #b8c3c0; border-radius:6px; min-height:100px; font-size:13px;">
                Loading daily thought...
            </div>
            <div style="flex:1; padding:12px; background:#f8f9f8; border:1px solid #b8c3c0; border-radius:6px; text-align:right; min-height:100px;">
                <div style="font-size:48px; font-weight:bold; line-height:1; color:#244e52;">${dayNum}</div>
                <div style="font-size:17px; font-weight:bold;">${weekday}</div>
                <div style="font-size:13px; color:#555;">${monthYear}</div>
                <div style="margin-top:10px; font-size:11.5px; color:#666;">
                    Day ${dayOfYear} of ${date.getFullYear()}<br>
                    Week ${weekOfYear} of 52 • Quarter ${quarter}
                </div>
            </div>
        </div>
        <div style="height:3px; background:#2e7d32; margin:8px 0 12px 0;"></div>
    `;
}

async function loadHazeldenQuote() {
    const quoteDiv = document.getElementById("hazeldenQuote");
    if (!quoteDiv) return;
    quoteDiv.innerHTML = `<strong>Thought for the Day</strong><br><br><span style="font-style:italic;">Keep it simple. One day at a time.</span>`;
}

// Modal State
let currentForwardRow = null;
let selectedForwardDate = null;
let currentForwardOnConfirm = null;

// row: the row element being forwarded
// textSelector: which cell in the row holds the text to prefill (".notes-text" or ".task-text")
// onConfirm(row, targetKey, taskText): called after the new task is created on the target date,
//   so the caller can mark the source row however it wants (e.g. status "X" for notes, "→" for tasks)
function showForwardModal(row, textSelector = ".notes-text", onConfirm = null) {
    currentForwardRow = row;
    currentForwardOnConfirm = onConfirm;

    const raw = row.querySelector(textSelector).textContent.trim();
    const prefillText = raw === "(click to edit)" ? "" : raw;
    document.getElementById("modalTaskName").value = prefillText;

    selectedForwardDate = null;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    renderModalCalendar(tomorrow);

    document.getElementById("forwardModal").style.display = "flex";
}

function renderModalCalendar(baseDate) {
    const container = document.getElementById("modalCalendarContainer");
    if (!container) return;
    container.innerHTML = renderMiniCalendar(baseDate.getFullYear(), baseDate.getMonth(), { highlightToday: true });

    container.querySelectorAll('.mini-day').forEach(dayEl => {
        dayEl.style.cursor = 'pointer';
        dayEl.onclick = (e) => {
            e.stopPropagation();
            selectedForwardDate = new Date(dayEl.getAttribute('data-date'));
            container.querySelectorAll('.mini-day').forEach(d => {
                d.style.background = '';
                d.style.color = '';
            });
            dayEl.style.background = '#244e52';
            dayEl.style.color = 'white';
        };
    });
}

function confirmForwardModal() {
    if (!currentForwardRow) return;
    const customTask = document.getElementById("modalTaskName").value.trim();
    if (!customTask) {
        alert("Task name is required.");
        return;
    }
    if (!selectedForwardDate) {
        alert("Please select a date.");
        return;
    }

    const targetKey = selectedForwardDate.toISOString().split("T")[0];

    if (typeof window.addTaskToDate === "function") {
        window.addTaskToDate(customTask, targetKey);
    }

    if (typeof currentForwardOnConfirm === "function") {
        currentForwardOnConfirm(currentForwardRow, targetKey, customTask);
    } else {
        // default behavior (forwarding a note): mark it done/moved
        const statusCell = currentForwardRow.querySelector(".status");
        if (statusCell) {
            statusCell.setAttribute("data-status", "X");
            statusCell.textContent = "X";
        }
    }

    closeForwardModal();
    alert(`✅ Forwarded "${customTask}" to ${targetKey}`);
}

function closeForwardModal() {
    document.getElementById("forwardModal").style.display = "none";
    currentForwardRow = null;
    selectedForwardDate = null;
    currentForwardOnConfirm = null;
}

function buildNotesArea() {
    const area = document.getElementById("notesArea");
    if (!area) return;

    let html = `
        <div class="notes-header-row">
            <div>Status</div>
            <div>ABC</div>
            <div>Daily Notes / Tracker</div>
            <div></div>
        </div>
    `;

    for (let i = 0; i < 32; i++) {
        html += `
            <div class="notes-row">
                <div class="notes-cell status" data-status=""></div>
                <div class="notes-cell priority" data-letter="" data-number=""></div>
                <div class="notes-cell notes-text">(click to edit)</div>
                <div class="notes-cell">
                    <button class="forward-btn">→</button>
                </div>
            </div>
        `;
    }

    area.innerHTML = html;
    attachNotesListeners();
}

// --- Per-date persistence, same pattern as tasks.js ---

function getCurrentNotes() {
    return Array.from(document.querySelectorAll(".notes-row")).map(row => ({
        status: row.querySelector(".status").getAttribute("data-status") || "",
        letter: row.querySelector(".priority").getAttribute("data-letter") || "",
        number: row.querySelector(".priority").getAttribute("data-number") || "",
        text: row.querySelector(".notes-text").textContent === "(click to edit)" ? "" : row.querySelector(".notes-text").textContent
    }));
}

function saveCurrentNotes() {
    if (window.storage && typeof window.storage.saveNotes === "function") {
        window.storage.saveNotes(window.currentPlannerDateKey, getCurrentNotes());
    }
}

function loadNoteData(notes) {
    const rows = document.querySelectorAll(".notes-row");
    rows.forEach((row, i) => {
        const note = notes[i] || { status: "", letter: "", number: "", text: "" };
        const statusCell = row.querySelector(".status");
        const priorityCell = row.querySelector(".priority");
        const textCell = row.querySelector(".notes-text");

        statusCell.setAttribute("data-status", note.status || "");
        statusCell.textContent = note.status || "";

        priorityCell.setAttribute("data-letter", note.letter || "");
        priorityCell.setAttribute("data-number", note.number || "");
        priorityCell.textContent = (note.letter || "") + (note.number || "");

        textCell.textContent = note.text || "(click to edit)";
    });
}

// NOTE: now async -- awaits storage.loadDate() so the in-memory cache has
// this date's rows before we read them. Existing callers (initNotes(),
// calendar.js) call window.loadNotesFor(...) without awaiting it, which is
// fine: they're fire-and-forget UI refreshes, same as before this change.
async function loadNotesFor(dateObj) {
    const key = dateObj.toISOString().split("T")[0];
    if (window.storage && typeof window.storage.loadDate === "function") {
        await window.storage.loadDate(key);
    }
    let notes = (window.storage && typeof window.storage.getNotes === "function")
        ? window.storage.getNotes(key)
        : [];
    while (notes.length < 32) notes.push({ status: "", letter: "", number: "", text: "" });
    loadNoteData(notes);
}
window.loadNotesFor = loadNotesFor;

function attachNotesListeners() {
    try {
        console.log("✅ Notes listeners attached");

        const statusCycle = ["", "X", "•"];

        // Status
        document.querySelectorAll(".notes-row .status").forEach(cell => {
            cell.onclick = (e) => {
                e.stopImmediatePropagation();
                let current = cell.getAttribute("data-status") || "";
                let index = statusCycle.indexOf(current);
                let next = statusCycle[(index + 1) % statusCycle.length];
                cell.setAttribute("data-status", next);
                cell.textContent = next || "";
                saveCurrentNotes();
            };
        });

        // ABC
        const priorityStates = ["", "A","A1","A2","A3","A4","B","B1","B2","B3","B4","C","C1","C2","C3","C4"];
        document.querySelectorAll(".notes-row .priority").forEach(cell => {
            cell.onclick = (e) => {
                e.stopImmediatePropagation();
                const current = (cell.getAttribute("data-letter") || "") + (cell.getAttribute("data-number") || "");
                let idx = priorityStates.indexOf(current);
                if (idx === -1) idx = 0;
                const next = priorityStates[(idx + 1) % priorityStates.length];
                let l = next ? next[0] : "";
                let n = next && next.length > 1 ? next.slice(1) : "";
                cell.setAttribute("data-letter", l);
                cell.setAttribute("data-number", n);
                cell.textContent = next;
                saveCurrentNotes();
            };
        });

        // Text editing - FIXED
        document.querySelectorAll(".notes-row .notes-text").forEach(cell => {
            cell.onclick = (e) => {
                if (e.target.closest(".forward-btn")) return;
                const current = cell.textContent === "(click to edit)" ? "" : cell.textContent;
                const input = prompt("Edit note:", current);
                if (input !== null) {
                    cell.textContent = input.trim() || "(click to edit)";
                    saveCurrentNotes();
                }
            };
        });

        // Forward Button
        document.querySelectorAll(".notes-row .forward-btn").forEach(btn => {
            btn.onclick = (e) => {
                e.stopImmediatePropagation();
                const row = btn.closest(".notes-row");
                showForwardModal(row, ".notes-text", (forwardedRow) => {
                    const statusCell = forwardedRow.querySelector(".status");
                    if (statusCell) {
                        statusCell.setAttribute("data-status", "X");
                        statusCell.textContent = "X";
                    }
                    saveCurrentNotes();
                });
            };
        });
    } catch (err) {
        console.error("Notes error:", err);
    }
}

function initNotes() {
    renderNotesHeader();
    loadHazeldenQuote();
    buildNotesArea();
    loadNotesFor(currentDate);
}

window.initNotes = initNotes;
window.showForwardModal = showForwardModal;
window.renderNotesHeader = renderNotesHeader;
