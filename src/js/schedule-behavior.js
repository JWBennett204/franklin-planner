// js/schedule-behavior.js
import { storage } from "./storage-adapter.js";

let getDateKeyFn = null;

function buildRowMapping(rowCount) {
    const mapping = [];
    let idx = 0;
    mapping[idx++] = { slotId: "pre-08-1", editable: true };
    mapping[idx++] = { slotId: "pre-08-2", editable: true };

    const pushFour = (h) => {
        const base = h.toString().padStart(2, "0");
        mapping[idx++] = { slotId: `${base}:00`, editable: true };
        mapping[idx++] = { slotId: `${base}:15`, editable: true };
        mapping[idx++] = { slotId: `${base}:30`, editable: true };
        mapping[idx++] = { slotId: `${base}:45`, editable: true };
    };
    const pushTwo = (h) => {
        const base = h.toString().padStart(2, "0");
        mapping[idx++] = { slotId: `${base}:00`, editable: true };
        mapping[idx++] = { slotId: `${base}:30`, editable: true };
    };

    pushFour(8); pushFour(9); pushFour(10); pushFour(11);
    pushTwo(12);
    pushFour(13); pushFour(14); pushFour(15); pushFour(16);
    pushTwo(17); pushTwo(18); pushTwo(19); pushTwo(20);

    mapping[idx++] = { slotId: "post-20-1", editable: true };
    mapping[idx++] = { slotId: "post-20-2", editable: true };
    mapping[idx++] = { slotId: "final-boundary", editable: false };

    while (idx < rowCount) mapping[idx++] = { slotId: `extra-${idx}`, editable: false };
    return mapping;
}

function handleEditRow(meta, textCell) {
    const current = textCell.textContent.trim();
    const input = prompt(`Edit ${meta.slotId}:`, current);
    if (input !== null) {
        const trimmed = input.trim();
        textCell.textContent = trimmed;
        const dateKey = getDateKeyFn ? getDateKeyFn() : window.currentPlannerDateKey;
        if (dateKey) {
            let schedule = storage.getSchedule(dateKey);
            if (trimmed) schedule[meta.slotId] = trimmed;
            else delete schedule[meta.slotId];
            storage.saveSchedule(dateKey, schedule);
        }
    }
}

export function initScheduleBehavior(getDateKey) {
    getDateKeyFn = getDateKey;

    const rows = Array.from(document.querySelectorAll(".schedule-row"));
    if (!rows.length) return;

    const mapping = buildRowMapping(rows.length);

    rows.forEach((rowEl, index) => {
        const meta = mapping[index];
        if (!meta?.editable) return;

        const textCell = rowEl.querySelector(".schedule-text");
        const addBtn = rowEl.querySelector(".add-to-task-btn");

        if (!textCell) return;

        // Click to edit
        textCell.addEventListener("click", (e) => {
            e.stopPropagation();
            handleEditRow(meta, textCell);
        });

        // Click → button to add to tasks
        if (addBtn) {
            addBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const text = textCell.textContent.trim();
                if (text && typeof window.addTaskFromSchedule === "function") {
                    window.addTaskFromSchedule(text);
                }
            });
        }
    });

    // Load saved appointments
    const dateKey = getDateKeyFn ? getDateKeyFn() : window.currentPlannerDateKey;
    if (dateKey) {
        const schedule = storage.getSchedule(dateKey);
        rows.forEach((row, i) => {
            const textCell = row.querySelector(".schedule-text");
            const meta = mapping[i];
            if (textCell && meta) {
                textCell.textContent = schedule[meta.slotId] || "";
            }
        });
    }
}