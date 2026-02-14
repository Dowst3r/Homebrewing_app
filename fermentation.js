// fermentation.js (MODULE)
import { abvHmrc, F_SP, Y_XS, MW_CO2, MW_ETH, RHO_ETH } from "./meadMath.js";
import { durationBetween } from "./timeDuration.js";

const RHO_ETH_kg_L = RHO_ETH / 1000;

// ---------- helpers ----------
function num(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const v = parseFloat(String(el.value).trim());
    return Number.isFinite(v) ? v : NaN;
}

// Anaerobic digestion-style bounds (converted Ks mg/L -> g/L)
const MU_MIN = 0.001;   // d^-1
const MU_MAX = 5;   // d^-1  (around typical 5)
const KS_MIN = 0.01;   // g/L   (10 mg/L)
const KS_MAX = 50;   // g/L   (5000 mg/L)
const KD_MIN = 0.00;   // d^-1
const KD_MAX = 5;   // d^-1  (around typical 5)

function getStr(id) {
    const el = document.getElementById(id);
    return (el?.value || "").trim();
}

// Reads <input type="date"> + <input type="time"> into a local Date.
// time input uses "HH:MM" or "HH:MM:SS" (we support both).
function readLocalDateTimeAmpm(dateId, hourId, minId, secId, ampmId) {
    const d = getStr(dateId);
    if (!d) return new Date(NaN);

    const year = Number(d.slice(0, 4));
    const month = Number(d.slice(5, 7)) - 1; // 0-11
    const day = Number(d.slice(8, 10));

    let hour12 = Number(getStr(hourId));
    const minute = Number(getStr(minId));
    const second = Number(getStr(secId));
    const ampm = getStr(ampmId); // "a" or "p"

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return new Date(NaN);
    if (!Number.isFinite(hour12) || !Number.isFinite(minute) || !Number.isFinite(second)) return new Date(NaN);

    if (hour12 < 1) hour12 = 1;
    if (hour12 > 12) hour12 = 12;

    let hour24 = hour12;
    if (ampm === "p" && hour24 !== 12) hour24 += 12;
    if (ampm === "a" && hour24 === 12) hour24 = 0;

    return new Date(year, month, day, hour24, minute, second, 0);
}

function formatTotalsLikeTimeScreen(r) {
    return {
        daysStr: r.totalDays.toFixed(4),
        hoursStr: r.totalHours.toFixed(3),
        minutesStr: Math.round(r.totalMinutes).toLocaleString(),
        secondsStr: Math.round(r.totalSeconds).toLocaleString(),
    };
}

function linspace(a, b, n) {
    const out = [];
    if (n <= 1) return [a];
    const step = (b - a) / (n - 1);
    for (let i = 0; i < n; i++) out.push(a + i * step);
    return out;
}

function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
}

function getCssVar(name, fallback) {
    try {
        const v = getComputedStyle(document.body).getPropertyValue(name).trim();
        return v || fallback;
    } catch {
        return fallback;
    }
}

function hexToRgba(hex, alpha) {
    const h = String(hex).trim();
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h);
    if (!m) return `rgba(0,0,0,${alpha})`;
    let s = m[1];
    if (s.length === 3) s = s.split("").map(ch => ch + ch).join("");
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function applyThemeToChart(chart) {
    if (!chart) return;

    const accent = getCssVar("--accent", "#2563eb");
    const text = getCssVar("--text", "#111827");
    const border = getCssVar("--border", "rgba(0,0,0,0.15)");

    chart.data.datasets.forEach(ds => {
        ds.borderColor = accent;
        ds.pointBackgroundColor = accent;
        ds.pointBorderColor = accent;
        ds.backgroundColor = hexToRgba(accent, 0.15);
    });

    chart.options.plugins = chart.options.plugins || {};
    chart.options.plugins.legend = chart.options.plugins.legend || {};
    chart.options.plugins.legend.labels = chart.options.plugins.legend.labels || {};
    chart.options.plugins.legend.labels.color = text;

    chart.options.scales = chart.options.scales || {};
    for (const axis of ["x", "y"]) {
        chart.options.scales[axis] = chart.options.scales[axis] || {};
        chart.options.scales[axis].ticks = chart.options.scales[axis].ticks || {};
        chart.options.scales[axis].grid = chart.options.scales[axis].grid || {};
        chart.options.scales[axis].ticks.color = text;
        chart.options.scales[axis].grid.color = border;
    }

    chart.update("none");
}

function applyThemeToCharts() {
    if (!charts) return;
    Object.values(charts).forEach(applyThemeToChart);
}

window.addEventListener("themechange", applyThemeToCharts);

// backup: if you ever change theme just by swapping body classes
new MutationObserver(applyThemeToCharts).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
});

function interpAt(tGrid, yArr, t) {
    if (t <= tGrid[0]) return yArr[0];
    if (t >= tGrid[tGrid.length - 1]) return yArr[yArr.length - 1];

    // Find interval (linear scan is fine for small arrays)
    let i = 0;
    while (i < tGrid.length - 2 && tGrid[i + 1] < t) i++;

    const t0 = tGrid[i], t1 = tGrid[i + 1];
    const y0 = yArr[i], y1 = yArr[i + 1];
    const w = (t - t0) / (t1 - t0);
    return y0 + w * (y1 - y0);
}

// ---------- Logistic shape fit (same form as python) ----------
// Python form: SG = SG_min + (SG_max - SG_min)/(1 + exp(-k*(t - t0)))  :contentReference[oaicite:10]{index=10}
//
// With two points, you can solve analytically (no fsolve needed):
// Let y = (SG - SG_min)/(SG_max - SG_min), odds = y/(1-y) = exp(k*(t-t0))
function fitLogisticFromTwoPoints(t1, sg1, t2, sg2, sgMin, sgMax) {
    const denom = (sgMax - sgMin);
    if (denom <= 0) return null;

    const y1 = (sg1 - sgMin) / denom;
    const y2 = (sg2 - sgMin) / denom;

    // avoid 0 or 1 which would blow up log
    const y1c = clamp(y1, 1e-6, 1 - 1e-6);
    const y2c = clamp(y2, 1e-6, 1 - 1e-6);

    const o1 = y1c / (1 - y1c);
    const o2 = y2c / (1 - y2c);

    const ln1 = Math.log(o1);
    const ln2 = Math.log(o2);

    const dt = (t2 - t1);
    if (Math.abs(dt) < 1e-9) return null;

    const k = (ln2 - ln1) / dt;
    if (!Number.isFinite(k) || Math.abs(k) < 1e-9) return null;

    const t0 = t1 - (ln1 / k);
    return { k, t0 };
}

function logisticSG(t, k, t0, sgMin, sgMax) {
    return sgMin + (sgMax - sgMin) / (1 + Math.exp(-k * (t - t0)));
}

// Best-fit logistic for 2 or 3 points (least-squares).
// Uses analytic solution for 2 points, and a small search for 3+ points.
function fitLogisticBestFit(times, sgs, sgMin, sgMax) {
    if (!Array.isArray(times) || !Array.isArray(sgs) || times.length !== sgs.length) return null;
    if (times.length < 2) return null;

    // Sort by time just in case (keeps things stable)
    const paired = times.map((t, i) => [t, sgs[i]]).sort((a, b) => a[0] - b[0]);
    const t = paired.map(p => p[0]);
    const y = paired.map(p => p[1]);

    // If only 2 points, use the exact analytic fit
    if (t.length === 2) {
        return fitLogisticFromTwoPoints(t[0], y[0], t[1], y[1], sgMin, sgMax);
    }

    const denom = sgMax - sgMin;
    if (!(denom > 0)) return null;

    const tMin = Math.min(...t);
    const tMax = Math.max(...t);
    const span = Math.max(1e-6, tMax - tMin);

    // SSE objective (in SG space)
    function sse(k, t0) {
        if (!(k > 1e-6) || !Number.isFinite(k) || !Number.isFinite(t0)) return Infinity;
        let err = 0;
        for (let i = 0; i < t.length; i++) {
            const pred = logisticSG(t[i], k, t0, sgMin, sgMax);
            const d = pred - y[i];
            const w = (i === times.length - 1) ? 20 : 1;
            err += w * d * d;
        }
        return err;
    }

    // Search ranges:
    // k controls steepness; t0 is midpoint time.
    const kMin = 0.001;
    const kMax = 5.0;
    const t0Min = tMin - 1.0 * span;
    const t0Max = tMax + 1.0 * span;

    // --- coarse grid search (fast + reliable) ---
    let best = { k: 0.2, t0: (tMin + tMax) / 2, err: Infinity };

    const kSteps = 60;
    const t0Steps = 80;

    for (let i = 0; i < kSteps; i++) {
        // sample k on a log-ish scale to cover small/large steepness
        const frac = i / (kSteps - 1);
        const k = kMin * Math.pow(kMax / kMin, frac);

        for (let j = 0; j < t0Steps; j++) {
            const t0 = t0Min + (t0Max - t0Min) * (j / (t0Steps - 1));
            const e = sse(k, t0);
            if (e < best.err) best = { k, t0, err: e };
        }
    }

    // --- random refine around the best ---
    for (let r = 0; r < 400; r++) {
        const k = clamp(best.k * (0.7 + 0.6 * Math.random()), kMin, kMax);
        const t0 = clamp(best.t0 + (Math.random() - 0.5) * 0.6 * span, t0Min, t0Max);
        const e = sse(k, t0);
        if (e < best.err) best = { k, t0, err: e };
    }

    return { k: best.k, t0: best.t0 };
}


// ---------- Monod model (matches python) ----------
// ODEs in python: dX = mu*X, dS = -dX/YXS  :contentReference[oaicite:11]{index=11}
function muMonod(S, muMax, Ks) {
    S = Math.max(0, S);
    return muMax * S / (Ks + S + 1e-12);
}

// RK4 integrator for [X, S]
function simulateMonod(muMax, Ks, tGrid, X0, S0) {
    const X = new Array(tGrid.length).fill(0);
    const S = new Array(tGrid.length).fill(0);

    X[0] = X0;
    S[0] = S0;

    for (let i = 1; i < tGrid.length; i++) {
        const tPrev = tGrid[i - 1];
        const tNow = tGrid[i];
        const h = tNow - tPrev;

        const Xn = X[i - 1];
        const Sn = S[i - 1];

        const f1 = (x, s) => {
            const mu = muMonod(s, muMax, Ks);
            const dX = mu * x;
            const dS = (s > 1e-9) ? (-dX / Y_XS) : 0;
            return [dX, dS];
        };

        const [k1x, k1s] = f1(Xn, Sn);
        const [k2x, k2s] = f1(Xn + 0.5 * h * k1x, Sn + 0.5 * h * k1s);
        const [k3x, k3s] = f1(Xn + 0.5 * h * k2x, Sn + 0.5 * h * k2s);
        const [k4x, k4s] = f1(Xn + h * k3x, Sn + h * k3s);

        const Xnext = Xn + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
        const Snext = Sn + (h / 6) * (k1s + 2 * k2s + 2 * k3s + k4s);

        X[i] = Math.max(Xnext, 0);
        S[i] = Math.max(Snext, 0);
    }

    return { X, S };
}

// RK4 integrator for [X, S] WITH death constant kd
function simulateMonodWithDeath(muMax, Ks, kd, tGrid, X0, S0) {
    const X = new Array(tGrid.length).fill(0);
    const S = new Array(tGrid.length).fill(0);

    X[0] = X0;
    S[0] = S0;

    for (let i = 1; i < tGrid.length; i++) {
        const h = tGrid[i] - tGrid[i - 1];

        const Xn = X[i - 1];
        const Sn = S[i - 1];

        const f1 = (x, s) => {
            const mu = muMonod(s, muMax, Ks);

            // dX/dt = (mu - kd) * X
            const dX = (mu - kd) * x;

            // dS/dt = -(mu * X) / Y_XS   (growth-linked uptake)
            const dS = (s > 1e-9) ? (-(mu * x) / Y_XS) : 0;

            return [dX, dS];
        };

        const [k1x, k1s] = f1(Xn, Sn);
        const [k2x, k2s] = f1(Xn + 0.5 * h * k1x, Sn + 0.5 * h * k1s);
        const [k3x, k3s] = f1(Xn + 0.5 * h * k2x, Sn + 0.5 * h * k2s);
        const [k4x, k4s] = f1(Xn + h * k3x, Sn + h * k3s);

        X[i] = Math.max(Xn + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x), 0);
        S[i] = Math.max(Sn + (h / 6) * (k1s + 2 * k2s + 2 * k3s + k4s), 0);
    }

    return { X, S };
}

function fitMonodParamsWithDeath(times, sgs, VmeadL, X0, S0) {
    const sgMin = 0.996;
    const tMax = Math.max(...times);
    const dt = 0.05;
    const nSteps = Math.max(2, Math.ceil(tMax / dt) + 1);
    const tGrid = linspace(0, tMax, nSteps);

    function sse(muMax, Ks, kd) {
        // bounds (tweak if you want)
        if (!(muMax >= MU_MIN && muMax <= MU_MAX &&
            Ks >= KS_MIN && Ks <= KS_MAX &&
            kd >= KD_MIN && kd <= KD_MAX)) return Infinity;

        const { S } = simulateMonodWithDeath(muMax, Ks, kd, tGrid, X0, S0);

        let err = 0;
        for (let i = 0; i < times.length; i++) {
            const ti = times[i];
            const S_at_t = interpAt(tGrid, S, ti);
            const sgPred = Math.max(sugarToSG(S_at_t, VmeadL), sgMin);
            const d = sgPred - sgs[i];
            const w = (i === times.length - 1) ? 20 : 1;
            err += w * d * d;
        }
        return err;
    }

    let best = {
        muMax: 0.5 * (MU_MIN + MU_MAX),
        Ks: 0.5 * (KS_MIN + KS_MAX),
        kd: 0.5 * (KD_MIN + KD_MAX),
        err: Infinity
    };

    // coarse grid inside bounds
    for (let i = 0; i < 18; i++) {
        const mu = MU_MIN + (MU_MAX - MU_MIN) * (i / 17);
        for (let j = 0; j < 18; j++) {
            const ks = KS_MIN + (KS_MAX - KS_MIN) * (j / 17);
            for (let k = 0; k < 18; k++) {
                const kd = KD_MIN + (KD_MAX - KD_MIN) * (k / 17);
                const e = sse(mu, ks, kd);
                if (e < best.err) best = { muMax: mu, Ks: ks, kd, err: e };
            }
        }
    }

    // random refine inside bounds
    for (let r = 0; r < 600; r++) {
        const mu = clamp(
            best.muMax + (Math.random() - 0.5) * 0.2 * (MU_MAX - MU_MIN),
            MU_MIN, MU_MAX
        );
        const ks = clamp(
            best.Ks + (Math.random() - 0.5) * 0.2 * (KS_MAX - KS_MIN),
            KS_MIN, KS_MAX
        );
        const kd = clamp(
            best.kd + (Math.random() - 0.5) * 0.2 * (KD_MAX - KD_MIN),
            KD_MIN, KD_MAX
        );

        const e = sse(mu, ks, kd);
        if (e < best.err) best = { muMax: mu, Ks: ks, kd, err: e };
    }

    return best;
}

// Python SG conversion:  :contentReference[oaicite:12]{index=12}
// SG = 1 + (1 - YXS) * (S/V - F_SP) / ( ((1.05/0.79)*rho_eth)*(1 + MW_CO2/MW_eth) )
function sugarToSG(S, VmeadL) {
    const denom = ((1.05 / 0.79) * RHO_ETH_kg_L) * (1 + (MW_CO2 / MW_ETH));
    return 1 + (1 - Y_XS) * ((S / VmeadL) - F_SP) / denom;
}

// Python S0 formula: :contentReference[oaicite:13]{index=13}
function initialSugarFromSG(SG0, VmeadL) {
    const denom = (1 - Y_XS);
    const factor = ((1.05 / 0.79) * RHO_ETH_kg_L) * (1 + (MW_CO2 / MW_ETH));
    return VmeadL * (((SG0 - 1) * factor / denom) + F_SP);
}

// ---------- Replace SciPy differential evolution with a simple search ----------
function fitMonodParams(times, sgs, VmeadL, X0, S0) {
    const sgMin = 0.996;
    const tMax = Math.max(...times);
    const dt = 0.005; // days (smaller = more accurate, slower)
    const nSteps = Math.max(2, Math.ceil(tMax / dt) + 1);
    const tGrid = linspace(0, tMax, nSteps);

    // objective: SSE in SG space (same as python) :contentReference[oaicite:14]{index=14}
    function sse(muMax, Ks) {
        if (!(muMax >= MU_MIN && muMax <= MU_MAX && Ks >= KS_MIN && Ks <= KS_MAX)) return Infinity;

        const { S } = simulateMonod(muMax, Ks, tGrid, X0, S0);

        // sample SG at requested times by nearest index
        let err = 0;
        for (let i = 0; i < times.length; i++) {
            const ti = times[i];
            const S_at_t = interpAt(tGrid, S, ti);
            const sgPred = Math.max(sugarToSG(S_at_t, VmeadL), sgMin);
            const d = sgPred - sgs[i];
            const w = (i === times.length - 1) ? 20 : 1;
            err += w * d * d;
        }
        return err;
    }

    let best = {
        muMax: 0.5 * (MU_MIN + MU_MAX),
        Ks: 0.5 * (KS_MIN + KS_MAX),
        err: Infinity
    };

    // coarse grid inside bounds
    for (let i = 0; i < 30; i++) {
        const mu = MU_MIN + (MU_MAX - MU_MIN) * (i / 29);
        for (let j = 0; j < 30; j++) {
            const ks = KS_MIN + (KS_MAX - KS_MIN) * (j / 29);
            const e = sse(mu, ks);
            if (e < best.err) best = { muMax: mu, Ks: ks, err: e };
        }
    }

    // random refine inside bounds
    for (let k = 0; k < 400; k++) {
        const mu = clamp(
            best.muMax + (Math.random() - 0.5) * 0.2 * (MU_MAX - MU_MIN),
            MU_MIN, MU_MAX
        );
        const ks = clamp(
            best.Ks + (Math.random() - 0.5) * 0.2 * (KS_MAX - KS_MIN),
            KS_MIN, KS_MAX
        );
        const e = sse(mu, ks);
        if (e < best.err) best = { muMax: mu, Ks: ks, err: e };
    }

    return best;
}

// ---------- Charts ----------
let charts = null;

function makeLineChart(canvasId, labelText) {
    if (typeof Chart === "undefined") {
        alert("Chart.js did not load. The CDN may be blocked/offline.");
        return null;
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        alert(`Missing canvas: ${canvasId}`);
        return null;
    }

    const chartAccent =
        getComputedStyle(document.body).getPropertyValue("--chart-accent").trim() ||
        getComputedStyle(document.body).getPropertyValue("--accent").trim() ||
        "#ec4899";


    // IMPORTANT: use {x,y} points + linear x scale (prevents string parsing issues)
    const chart = new Chart(canvas, {
        type: "line",
        data: {
            datasets: [{
                label: labelText,
                data: [],               // will be [{x:..., y:...}, ...]
                tension: 0.25,
                pointRadius: 2,
                pointHitRadius: 12,
                pointHoverRadius: 6,

                borderColor: chartAccent,
                pointBackgroundColor: chartAccent,
                pointBorderColor: chartAccent,
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "nearest",
                intersect: false
            },

            plugins: {
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (items) => Number(items[0].parsed.x).toFixed(4),
                        label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(4)}`
                    }
                }
            },
            parsing: false,           // we supply x/y directly
            scales: {
                x: {
                    type: "linear",
                    ticks: {
                        callback: (v) => Number(v).toFixed(3)
                    }
                }
            }
        }
    });

    return chart;
}

function ensureCharts() {
    if (charts) return;
    charts = {
        sgShape: makeLineChart("sgShapeChart", "SG"),
        abvShape: makeLineChart("abvShapeChart", "ABV (%)"),
        sgMonod: makeLineChart("sgMonodChart", "SG"),
        yeastMonod: makeLineChart("yeastMonodChart", "Yeast (g/L)"),
        abvMonod: makeLineChart("abvMonodChart", "ABV (%)"),
    };
}

function updateChart(chart, x, y) {
    if (!chart) return;

    const points = [];
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) {
        points.push({ x: x[i], y: y[i] });
    }

    chart.data.datasets[0].data = points;
    chart.update();
}


// ---------- debug helper (shows messages in the fermentation screen) ----------
function setFermentationDebug(msg) {
    let el = document.getElementById("fermentation_debug");
    if (!el) {
        el = document.createElement("pre");
        el.id = "fermentation_debug";
        el.className = "result_box";
        el.style.marginTop = "12px";
        const btn = document.getElementById("fermentation_tracking_button");
        if (btn && btn.parentElement) btn.parentElement.appendChild(el);
    }
    if (el) el.textContent = String(msg);
}

// ---------- main click handler ----------
const fermentationBtn = document.getElementById("fermentation_tracking_button");

if (!fermentationBtn) {
    // If this shows, the script is loading but the HTML id changed
    console.error("Missing #fermentation_tracking_button");
} else {
    fermentationBtn.addEventListener("click", () => {
        try {
            setFermentationDebug(""); // clear

            ensureCharts();

            // If charts failed to create, explain why
            if (!charts || Object.values(charts).some(c => !c)) {
                setFermentationDebug(
                    "Charts could not be created.\n" +
                    (typeof Chart === "undefined"
                        ? "Reason: Chart.js did not load (CDN blocked/offline).\n"
                        : "Reason: One or more canvas elements were not found.\n")
                );
                return;
            }

            // Inputs
            const SG0 = num("starting_sg_tracking");
            const SG2 = num("second_sg_tracking");
            const SG3 = num("third_sg_tracking"); // may be NaN
            const VmeadL = num("volume_of_brew_tracking");
            const yeastMassG = num("mass_of_yeast_tracking");

            const t2 = num("second_day_tracking");
            const t3 = num("third_day_tracking");
            const tEnd = num("predict_day_tracking");

            if (![SG0, SG2, VmeadL, yeastMassG, t2, tEnd].every(Number.isFinite)) {
                setFermentationDebug(
                    `Bad inputs:\nSG0=${SG0}\nSG2=${SG2}\nV=${VmeadL}\nyeast=${yeastMassG}\nt2=${t2}\ntEnd=${tEnd}`
                );
                return;
            }

            // Build measured arrays
            const times = [0, t2];
            const sgs = [SG0, SG2];
            if (Number.isFinite(SG3) && Number.isFinite(t3)) {
                times.push(t3);
                sgs.push(SG3);
            }

            const paired = times.map((t, i) => [t, sgs[i]]).sort((a, b) => a[0] - b[0]);
            const tMeas = paired.map(p => p[0]);
            const sgMeas = paired.map(p => p[1]);

            const SG_MIN = 0.996;
            const SG_MAX = Math.max(...sgMeas);

            const fit = fitLogisticBestFit(tMeas, sgMeas, SG_MIN, SG_MAX);
            let tGrid = linspace(0, tEnd, 400);
            tGrid = Array.from(new Set([...tGrid, ...tMeas])).sort((a, b) => a - b);

            if (fit) {
                const sgShape = tGrid.map(t => clamp(logisticSG(t, fit.k, fit.t0, SG_MIN, SG_MAX), SG_MIN, 1.5));
                const abvShape = sgShape.map(sg => abvHmrc(SG0, sg));
                updateChart(charts.sgShape, tGrid, sgShape);
                updateChart(charts.abvShape, tGrid, abvShape);
            } else {
                setFermentationDebug("Shape-fit could not be computed from the points provided.");
            }

            const X0 = yeastMassG / VmeadL;
            const S0 = initialSugarFromSG(SG0, VmeadL);

            let best;
            let sim;

            if (tMeas.length === 3) {
                // 3 points -> fit muMax, Ks, AND kd, then simulate with death
                best = fitMonodParamsWithDeath(tMeas, sgMeas, VmeadL, X0, S0);
                sim = simulateMonodWithDeath(best.muMax, best.Ks, best.kd, tGrid, X0, S0);
            } else {
                // 2 points (or anything else) -> original model
                best = fitMonodParams(tMeas, sgMeas, VmeadL, X0, S0);
                sim = simulateMonod(best.muMax, best.Ks, tGrid, X0, S0);
            }

            const { X, S } = sim;

            const sgMonod = S.map(s => Math.max(sugarToSG(s, VmeadL), SG_MIN));
            const yeastConc = X;
            const abvMonod = sgMonod.map(sg => abvHmrc(SG0, sg));

            updateChart(charts.sgMonod, tGrid, sgMonod);
            updateChart(charts.yeastMonod, tGrid, yeastConc);
            updateChart(charts.abvMonod, tGrid, abvMonod);

            // ---- Date/time query output ----
            const outEl = document.getElementById("ft_query_output");
            if (outEl) {
                const day0 = readLocalDateTimeAmpm("ft_day0_date", "ft_day0_hour", "ft_day0_min", "ft_day0_sec", "ft_day0_ampm");
                const query = readLocalDateTimeAmpm("ft_query_date", "ft_query_hour", "ft_query_min", "ft_query_sec", "ft_query_ampm");

                const dur = durationBetween(day0, query);

                if (dur?.error) {
                    outEl.textContent = `Date/time query error: ${dur.error}`;
                } else if (!Number.isFinite(dur.totalDays)) {
                    outEl.textContent = "Enter Day 0 date+time and Query date+time to compute SG/ABV at a date.";
                } else {
                    const tQueryDays = dur.totalDays; // THIS is the time axis used by your models

                    // Shape-fit prediction at tQueryDays (if fit exists)
                    let sgShapeAt = NaN;
                    let abvShapeAt = NaN;
                    if (fit) {
                        sgShapeAt = clamp(logisticSG(tQueryDays, fit.k, fit.t0, SG_MIN, SG_MAX), SG_MIN, 1.5);
                        abvShapeAt = abvHmrc(SG0, sgShapeAt);
                    }

                    // Monod prediction at tQueryDays (interpolate from simulated arrays)
                    const sgMonodAt = interpAt(tGrid, sgMonod, tQueryDays);
                    const abvMonodAt = abvHmrc(SG0, sgMonodAt);
                    const yeastAt = interpAt(tGrid, yeastConc, tQueryDays);

                    const totals = formatTotalsLikeTimeScreen(dur);
                    const sWord = (dur.seconds === 1) ? "second" : "seconds";

                    outEl.textContent =
                        `Time between Day 0 and Query is:\n` +
                        `${dur.days} days, ${dur.hours} hours, ${dur.minutes} minutes, and ${dur.seconds} ${sWord}\n\n` +
                        `${totals.daysStr} days\n` +
                        `${totals.hoursStr} hours\n` +
                        `${totals.minutesStr} minutes\n` +
                        `${totals.secondsStr} seconds\n\n` +
                        `--- Predictions at t = ${totals.daysStr} days ---\n` +
                        (Number.isFinite(sgShapeAt)
                            ? `Shape fit: SG = ${sgShapeAt.toFixed(4)}, ABV = ${abvShapeAt.toFixed(2)}%\n`
                            : `Shape fit: (not available — need at least 2 points)\n`) +
                        `Monod:     SG = ${sgMonodAt.toFixed(4)}, ABV = ${abvMonodAt.toFixed(2)}%\n` +
                        `Monod yeast concentration: ${yeastAt.toFixed(4)} g/L`;
                }
            }

            // If we got here, it worked
            if (!document.getElementById("fermentation_debug")?.textContent) {
                setFermentationDebug("✅ Graphs updated.");
            }
        } catch (e) {
            setFermentationDebug(`❌ Error:\n${e?.message || e}`);
            console.error(e);
        }
    });
}