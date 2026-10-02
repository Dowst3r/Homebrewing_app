// timeDuration.js
// Pure, reusable time-between-dates logic (no DOM). Use this anywhere in the app.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_DOT = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthIndexToLabel(monthIndex) {
    return MONTHS[monthIndex] ?? "Jan";
}

export function monthLabelToIndex(label) {
    const idx = MONTHS.indexOf(label);
    return idx >= 0 ? idx : 0;
}

function pad2(n) {
    const x = Math.trunc(Math.abs(Number(n)));
    return String(x).padStart(2, "0");
}

export function makeLocalDate({ year, monthIndex, day, hour12, minute, second, ampm }) {
    const numbers = [year, monthIndex, day, hour12, minute, second];
    if (!numbers.every(Number.isInteger) ||
        year < 1 || year > 9999 || monthIndex < 0 || monthIndex > 11 ||
        day < 1 || day > 31 || hour12 < 1 || hour12 > 12 ||
        minute < 0 || minute > 59 || second < 0 || second > 59 ||
        !['a', 'p'].includes(ampm)) {
        return new Date(NaN);
    }
    const hour24 = hour12 % 12 + (ampm === 'p' ? 12 : 0);
    const date = new Date(0);
    date.setFullYear(year, monthIndex, day);
    date.setHours(hour24, minute, second, 0);
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex ||
        date.getDate() !== day || date.getHours() !== hour24 ||
        date.getMinutes() !== minute || date.getSeconds() !== second) {
        return new Date(NaN);
    }
    return date;
}

export function formatDateTimeLabel(date) {
    // Example: "Jan. 18, 2026, 3:44:00 PM"
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Invalid date";

    const mon = MONTHS_DOT[date.getMonth()] ?? "Jan.";
    const day = date.getDate();
    const year = date.getFullYear();

    let hh = date.getHours();
    const isPm = hh >= 12;
    hh = hh % 12;
    if (hh === 0) hh = 12;

    const mm = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());

    return `${mon} ${day}, ${year}, ${hh}:${mm}:${ss} ${isPm ? "PM" : "AM"}`;
}

export function durationBetween(startDate, endDate) {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
        return { error: "Start/end must be Date objects." };
    }
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return { error: "Invalid date/time input." };
    }

    let swapped = false;
    let start = startDate;
    let end = endDate;
    if (end.getTime() < start.getTime()) {
        swapped = true;
        [start, end] = [end, start];
    }

    const diffMs = end.getTime() - start.getTime();
    const totalSeconds = diffMs / 1000;

    // Component breakdown
    let remaining = Math.floor(totalSeconds);
    const days = Math.floor(remaining / 86400);
    remaining -= days * 86400;
    const hours = Math.floor(remaining / 3600);
    remaining -= hours * 3600;
    const minutes = Math.floor(remaining / 60);
    remaining -= minutes * 60;
    const seconds = remaining;

    return {
        swapped,
        days,
        hours,
        minutes,
        seconds,
        totalDays: totalSeconds / 86400,
        totalHours: totalSeconds / 3600,
        totalMinutes: totalSeconds / 60,
        totalSeconds,
    };
}