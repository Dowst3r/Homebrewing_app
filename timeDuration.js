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
    if (
        !Number.isFinite(year) ||
        !Number.isFinite(monthIndex) ||
        !Number.isFinite(day) ||
        !Number.isFinite(hour12) ||
        !Number.isFinite(minute) ||
        !Number.isFinite(second) ||
        (ampm !== "a" && ampm !== "p")
    ) {
        return new Date(NaN);
    }

    // Convert 12h clock -> 24h clock
    let hour24 = Math.trunc(hour12);
    if (hour24 < 1) hour24 = 1;
    if (hour24 > 12) hour24 = 12;

    if (ampm === "p" && hour24 !== 12) hour24 += 12;
    if (ampm === "a" && hour24 === 12) hour24 = 0;

    return new Date(
        Math.trunc(year),
        Math.trunc(monthIndex),
        Math.trunc(day),
        Math.trunc(hour24),
        Math.trunc(minute),
        Math.trunc(second),
        0
    );
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