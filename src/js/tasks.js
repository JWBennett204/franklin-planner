// js/tasks.js — Clean with Forwarded Task Support

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
        </div>
    `;

    for (let i = 0; i < 16; i++) {
        html += `
            <div class="task-row" draggable="true">
                <div class="task-cell status" data-status=""></div>
                <div class="task-cell priority" data-letter="" data-number=""></div>
                <div class="task-cell task-text">(click to edit)</div>
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

            if (task.forwarded) {
                r.classList.add("forwarded-task");
            }
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
        // Status, ABC, Text editing listeners (same as before)
        const statusCycle = ["", "X", "→", "•"];
        document.querySelectorAll(".status").forEach(cell => {
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

        // ... (ABC and text listeners same as previous versions)

        // (Omitted for brevity - keep your existing ones)
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