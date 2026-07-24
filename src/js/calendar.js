// js/calendar.js - FIXED with click handlers
let currentDate = new Date();
window.currentPlannerDateKey = currentDate.toISOString().slice(0, 10);

function renderMiniCalendar(year, month, options = {}) {
    const { highlightToday = false, extraClass = "" } = options;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `<div class="mini-month ${extraClass}">
        <div class="mini-month-title">
            ${new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
        <div class="mini-grid">`;

    html += `<div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>`;

    for (let i = 0; i < firstDay; i++) {
        html += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = highlightToday &&
            day === new Date().getDate() &&
            month === new Date().getMonth() &&
            year === new Date().getFullYear();

        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        html += `<div class="mini-day ${isToday ? "today" : ""}" data-date="${dateStr}">${day}</div>`;
    }

    html += `</div></div>`;
    return html;
}

function renderDateCluster(baseDate = currentDate) {
    currentDate = baseDate;
    window.currentPlannerDateKey = currentDate.toISOString().slice(0, 10);

    const dayNumber = currentDate.getDate();
    const weekday = currentDate.toLocaleDateString("en-US", { weekday: "long" });
    const month = currentDate.toLocaleDateString("en-US", { month: "long" });
    const year = currentDate.getFullYear();

    const prevMonth = new Date(year, currentDate.getMonth() - 1, 1);
    const nextMonth = new Date(year, currentDate.getMonth() + 1, 1);

    const html = `
        <div class="date-nav">
            <span id="prevDay">Yesterday</span>
            <span id="todayBtn">Today</span>
            <span id="nextDay">Tomorrow</span>
        </div>

        <div class="big-date">
            <div class="big-number">${dayNumber}</div>
            <div class="date-details">
                <div class="weekday">${weekday}</div>
                <div class="monthyear">${month} ${year}</div>
            </div>
        </div>

        <div class="mini-calendars">
            ${renderMiniCalendar(year, currentDate.getMonth(), { highlightToday: true })}
            <div class="adjacent-months">
                ${renderMiniCalendar(prevMonth.getFullYear(), prevMonth.getMonth())}
                ${renderMiniCalendar(nextMonth.getFullYear(), nextMonth.getMonth())}
            </div>
        </div>
    `;

    document.getElementById("dateCluster").innerHTML = html;
}

function setPlannerDate(dateObj) {
    const prevDate = currentDate;
    currentDate = dateObj;
    window.currentPlannerDateKey = currentDate.toISOString().slice(0, 10);

    if (typeof window.rolloverIfNeeded === "function") {
        window.rolloverIfNeeded(prevDate, dateObj);
    }
    if (typeof window.loadTasksFor === "function") {
        window.loadTasksFor(dateObj);
    }
    if (typeof window.renderNotesHeader === "function") {
        window.renderNotesHeader();
    }
    if (typeof window.loadNotesFor === "function") {
        window.loadNotesFor(dateObj);
    }
    if (typeof window.loadScheduleFor === "function") {
        window.loadScheduleFor(window.currentPlannerDateKey);
    }

    renderDateCluster(dateObj);
}

document.addEventListener("click", (e) => {
    if (e.target.id === "prevDay") {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 1);
        setPlannerDate(d);
    }
    if (e.target.id === "todayBtn") {
        setPlannerDate(new Date());
    }
    if (e.target.id === "nextDay") {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 1);
        setPlannerDate(d);
    }

    if (e.target.classList.contains("mini-day") && !e.target.closest("#modalCalendarContainer")) {
        const dateStr = e.target.getAttribute("data-date");
        if (dateStr) {
            setPlannerDate(new Date(dateStr + "T12:00:00"));
        }
    }
});

window.renderDateCluster = renderDateCluster;
window.setPlannerDate = setPlannerDate;
