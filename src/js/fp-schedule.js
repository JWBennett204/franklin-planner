export function renderScheduleGrid() {
    const schedule = document.getElementById("schedule");

    let html = `<div class="schedule-header">Appointment Schedule</div>`;

    function addRow(hourLabel = "", heavy = false) {
        const borderStyle = heavy ? "2px solid #244e52" : "1px solid #e0e5e3";
        html += `
            <div class="schedule-row" style="border-bottom:${borderStyle}">
                <div class="schedule-hour">${hourLabel}</div>
                <div class="schedule-text"></div>
                <button class="add-to-task-btn">→</button>
            </div>
        `;
    }

    function addHourBlock(hour, rows) {
        const centerIndex = rows === 4 ? 1 : 0;
        for (let i = 0; i < rows; i++) {
            const label = (i === centerIndex) ? hour : "";
            const isLast = i === rows - 1;
            addRow(label, isLast);
        }
    }

    function addBlankRows(count) {
        for (let i = 0; i < count; i++) addRow("", false);
    }

    addBlankRows(2);
    addHourBlock("8", 4);
    addHourBlock("9", 4);
    addHourBlock("10", 4);
    addHourBlock("11", 4);
    addHourBlock("12", 2);
    addHourBlock("1", 4);
    addHourBlock("2", 4);
    addHourBlock("3", 4);
    addHourBlock("4", 4);
    addHourBlock("5", 2);
    addHourBlock("6", 2);
    addHourBlock("7", 2);
    addHourBlock("8", 2);
    addBlankRows(2);
    addRow("", true);

    schedule.innerHTML = html;
}
