// js/tasks.js — Click to edit, ABC priority cycling, and Forward-to-date support

document.addEventListener("DOMContentLoaded", () => {

    function dateKey(dateObj = new Date()) {
        return dateObj.toISOString().split("T")[0];
    }

    const taskList = document.getElementById("taskList");

    let html = `
        <div class="task-header">
            <div>Status</div>
            <div>ABC</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span>Prioritized Daily Task List</span>
                <button id="clearTasksBtn" style="font-size:11px;padding:2px 8px;">Clear All</button>
            </div>
            <div></div>
        </div>
    `;

    for (let i = 0; i < 16; i++) {
        html += `
            <div class="task-row" draggable="true">
                <div class="task-cell status" data-status=""></div>
                <div class="task-cell priority" data-letter="" data-number=""></div>
                <div class="task-cell task-text">(click to edit)</div>
                <div class="task-cell">
                    <button class="forward-btn" title="Forward to date">→</button>
                </div>
            </div>
        `;
    }
    taskList.innerHTML = html;

    document.getElementById("clearTasksBtn").addEventListener("click", () => {
        if (confirm("Clear ALL tasks for today?")) {
            window.storage.saveTasks(window.currentPlannerDateKey, []);
            loadTasksFor(new Date(window.currentPlannerDateKey));
        }
    });

    function getCurrentTasks() {
        return Array.from(taskList.querySelectorAll(".task-row")).map(row => ({
            status: row.querySelector(".status").getAttribute("data-status") || "",
            letter: row.querySelector(".priority").getAttribute("data-letter") || "",
            number: row.querySelector(".priority").getAttribute("data-number") || "",
            text: row.querySelector(".task-text").textContent === "(click to edit)" ? "" : row.querySelector(".task-text").textContent,
            forwarded: row.classList.contains("forwarded-task")
        }));
    }

    function saveCurrentTasks() {
        window.storage.saveTasks(window.currentPlannerDateKey, getCurrentTasks());
    }

    function loadTaskData(tasks) {
        const rows = document.querySelectorAll(".task-row");
        tasks.forEach((task, i) => {
            if (!rows[i]) return;
            const r = rows[i];
            r.querySelector(".status").setAttribute("data-status", task.status || "");
            r.querySelector(".status").textContent = task.status || "";
            r.querySelector(".priority").setAttribute("data-letter", task.letter || "");
            r.querySelector(".priority").setAttribute("data-number", task.number || "");
            r.querySelector(".priority").textContent = (task.letter || "") + (task.number || "");
            r.querySelector(".task-text").textContent = task.text || "(click to edit)";

            r.classList.toggle("forwarded-task", !!task.forwarded);
        });
    }

    function loadTasksFor(dateObj) {
        const key = dateKey(dateObj);
        let tasks = window.storage.getTasks(key);
        while (tasks.length < 16) tasks.push({ status: "", letter: "", number: "", text: "", forwarded: false });
        loadTaskData(tasks);
        attachAllEventListeners();
    }

    window.loadTasksFor = loadTasksFor;

    function attachAllEventListeners() {
        const statusCycle = ["", "X", "→", "•"];
        const priorityStates = ["", "A", "A1", "A2", "A3", "A4", "B", "B1", "B2", "B3", "B4", "C", "C1", "C2", "C3", "C4"];

        // Status
        document.querySelectorAll(".task-row .status").forEach(cell => {
            cell.onclick = (e) => {
                e.stopImmediatePropagation();
                let current = cell.getAttribute("data-status") || "";
                let index = statusCycle.indexOf(current);
                let next = statusCycle[(index + 1) % statusCycle.length];
                cell.setAttribute("data-status", next);
                cell.textContent = next;
                saveCurrentTasks();
            };
        });

        // ABC priority (click-through A1 → C4)
        document.querySelectorAll(".task-row .priority").forEach(cell => {
            cell.onclick = (e) => {
                e.stopImmediatePropagation();
                const current = (cell.getAttribute("data-letter") || "") + (cell.getAttribute("data-number") || "");
                let idx = priorityStates.indexOf(current);
                if (idx === -1) idx = 0;
                const next = priorityStates[(idx + 1) % priorityStates.length];
                const l = next ? next[0] : "";
                const n = next && next.length > 1 ? next.slice(1) : "";
                cell.setAttribute("data-letter", l);
                cell.setAttribute("data-number", n);
                cell.textContent = next;
                saveCurrentTasks();
            };
        });

        // Text - click to edit
        document.querySelectorAll(".task-row .task-text").forEach(cell => {
            cell.onclick = (e) => {
                e.stopImmediatePropagation();
                const current = cell.textContent === "(click to edit)" ? "" : cell.textContent;
                const input = prompt("Edit task:", current);
                if (input !== null) {
                    cell.textContent = input.trim() || "(click to edit)";
                    saveCurrentTasks();
                }
            };
        });

        // Forward this task to a specific date
        document.querySelectorAll(".task-row .forward-btn").forEach(btn => {
            btn.onclick = (e) => {
                e.stopImmediatePropagation();
                const row = btn.closest(".task-row");
                if (typeof window.showForwardModal === "function") {
                    window.showForwardModal(row, ".task-text", (forwardedRow) => {
                        const statusCell = forwardedRow.querySelector(".status");
                        if (statusCell) {
                            statusCell.setAttribute("data-status", "→");
                            statusCell.textContent = "→";
                        }
                        saveCurrentTasks();
                    });
                }
            };
        });
    }

    // Enhanced add to specific date
    window.addTaskToDate = function(text, targetDateKey = null) {
        if (!text || !text.trim()) return;
        const key = targetDateKey || window.currentPlannerDateKey;
        let tasks = window.storage.getTasks(key);
        while (tasks.length < 16) tasks.push({ status: "", letter: "", number: "", text: "", forwarded: false });
        let slot = tasks.findIndex(t => !t.text || t.text.trim() === "");
        if (slot === -1) slot = 0;
        tasks[slot] = { status: "", letter: "", number: "", text: text.trim(), forwarded: true };
        window.storage.saveTasks(key, tasks);
        if (key === window.currentPlannerDateKey) {
            window.loadTasksFor(new Date(key));
        }
    };

    window.addTaskFromSchedule = function(text) {
        window.addTaskToDate(text);
    };

    loadTasksFor(new Date());
});