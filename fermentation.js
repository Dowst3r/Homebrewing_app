// fermentation.js (MODULE)
import { abvHmrc, F_SP, Y_XS, MW_CO2, MW_ETH, RHO_ETH } from "./meadMath.js";

// ---------- helpers ----------
function num(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const v = parseFloat(String(el.value).trim());
    return Number.isFinite(v) ? v : NaN;
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
            err += d * d;
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
    S = Math.max(S, 1e-9);
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

// Python SG conversion:  :contentReference[oaicite:12]{index=12}
// SG = 1 + (1 - YXS) * (S/V - F_SP) / ( ((1.05/0.79)*rho_eth)*(1 + MW_CO2/MW_eth) )
function sugarToSG(S, VmeadL) {
    const denom = ((1.05 / 0.79) * RHO_ETH) * (1 + (MW_CO2 / MW_ETH));
    return 1 + (1 - Y_XS) * ((S / VmeadL) - F_SP) / denom;
}

// Python S0 formula: :contentReference[oaicite:13]{index=13}
function initialSugarFromSG(SG0, VmeadL) {
    const denom = (1 - Y_XS);
    const factor = ((1.05 / 0.79) * RHO_ETH) * (1 + (MW_CO2 / MW_ETH));
    return VmeadL * (((SG0 - 1) * factor / denom) + F_SP);
}

// ---------- Replace SciPy differential evolution with a simple search ----------
function fitMonodParams(times, sgs, VmeadL, X0, S0) {
    const sgMin = 1.0;
    const tMax = Math.max(...times);
    const dt = 0.05; // days (smaller = more accurate, slower)
    const nSteps = Math.max(2, Math.ceil(tMax / dt) + 1);
    const tGrid = linspace(0, tMax, nSteps);

    // objective: SSE in SG space (same as python) :contentReference[oaicite:14]{index=14}
    function sse(muMax, Ks) {
        if (!(muMax > 0.001 && muMax < 5 && Ks > 0.01 && Ks < 50)) return Infinity;

        const { S } = simulateMonod(muMax, Ks, tGrid, X0, S0);

        // sample SG at requested times by nearest index
        let err = 0;
        for (let i = 0; i < times.length; i++) {
            const ti = times[i];
            const idx = Math.min(tGrid.length - 1, Math.max(0, Math.round((ti / tMax) * (tGrid.length - 1))));
            const sgPred = Math.max(sugarToSG(S[idx], VmeadL), sgMin);
            const d = sgPred - sgs[i];
            err += d * d;
        }
        return err;
    }

    let best = { muMax: 0.5, Ks: 5, err: Infinity };

    // coarse grid (fast + stable)
    for (let i = 0; i < 16; i++) {
        const mu = 0.001 + (5 - 0.001) * (i / 15);
        for (let j = 0; j < 16; j++) {
            const ks = 0.01 + (50 - 0.01) * (j / 15);
            const e = sse(mu, ks);
            if (e < best.err) best = { muMax: mu, Ks: ks, err: e };
        }
    }

    // random refine around best
    for (let k = 0; k < 300; k++) {
        const mu = clamp(best.muMax * (0.6 + 0.8 * Math.random()), 0.001, 5);
        const ks = clamp(best.Ks * (0.6 + 0.8 * Math.random()), 0.01, 50);
        const e = sse(mu, ks);
        if (e < best.err) best = { muMax: mu, Ks: ks, err: e };
    }

    return best;
}

// ---------- Charts ----------
let charts = null;

function makeLineChart(canvasId, labelText) {
    const canvas = document.getElementById(canvasId);
    return new Chart(canvas, {
        type: "line",
        data: { labels: [], datasets: [{ label: labelText, data: [], tension: 0.25, pointRadius: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { callback: function (value) { const label = this.getLabelForValue(value); return Number(label).toFixed(4) } } } } }
    });
}

function ensureCharts() {
    if (charts) return;
    charts = {
        sgShape: makeLineChart("sgShapeChart", "SG", "Time (days)", "Specific Gravity"),
        abvShape: makeLineChart("abvShapeChart", "ABV (%)", "Time (days)", "ABV (%)"),
        sgMonod: makeLineChart("sgMonodChart", "SG", "Time (days)", "Specific Gravity"),
        yeastMonod: makeLineChart("yeastMonodChart", "Yeast (g/L)", "Time (days)", "Yeast concentration (g/L)"),
        abvMonod: makeLineChart("abvMonodChart", "ABV (%)", "Time (days)", "ABV (%)"),
    };
}

function updateChart(chart, x, y) {
    chart.data.labels = x;                 // chat says here!!!!!!!!!!!!!!!!!!!!!!!!!!
    chart.data.datasets[0].data = y;
    chart.update();
}

// ---------- main click handler ----------
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("fermentation_tracking_button");
    if (!btn) return;

    btn.addEventListener("click", () => {
        ensureCharts();

        // Inputs (your current HTML ids) :contentReference[oaicite:15]{index=15}
        const SG0 = num("starting_sg_tracking");
        const SG2 = num("second_sg_tracking");
        const SG3 = num("third_sg_tracking"); // may be NaN
        const VmeadL = num("volume_of_brew_tracking");
        const yeastMassG = num("mass_of_yeast_tracking");

        // Added time inputs (recommended to match python)
        const t2 = num("second_day_tracking");
        const t3 = num("third_day_tracking");
        const tEnd = num("predict_day_tracking");

        if (![SG0, SG2, VmeadL, yeastMassG, t2, tEnd].every(Number.isFinite)) return;

        // Build measured arrays
        const times = [0, t2];
        const sgs = [SG0, SG2];
        if (Number.isFinite(SG3) && Number.isFinite(t3)) {
            times.push(t3);
            sgs.push(SG3);
        }

        // sort by time
        const paired = times.map((t, i) => [t, sgs[i]]).sort((a, b) => a[0] - b[0]);
        const tMeas = paired.map(p => p[0]);
        const sgMeas = paired.map(p => p[1]);

        // ===== 1) Logistic "shape fit" (Python Graph 1) =====  :contentReference[oaicite:16]{index=16}
        const SG_MIN = 1.0;
        const SG_MAX = Math.max(...sgMeas);

        const fit = fitLogisticBestFit(tMeas, sgMeas, SG_MIN, SG_MAX);

        const tGrid = linspace(0, tEnd, 400);

        if (fit) {
            const sgShape = tGrid.map(t => clamp(logisticSG(t, fit.k, fit.t0, SG_MIN, SG_MAX), SG_MIN, 1.5));
            const abvShape = sgShape.map(sg => abvHmrc(SG0, sg));
            updateChart(charts.sgShape, tGrid, sgShape);
            updateChart(charts.abvShape, tGrid, abvShape);
        }

        // ===== 2) Monod model fit + simulation (Python Graph 2) =====  :contentReference[oaicite:17]{index=17}
        const X0 = yeastMassG / VmeadL;          // same as python: X0 = mass/V  :contentReference[oaicite:18]{index=18}
        const S0 = initialSugarFromSG(SG0, VmeadL); // same S0 formula :contentReference[oaicite:19]{index=19}

        const best = fitMonodParams(tMeas, sgMeas, VmeadL, X0, S0);

        // simulate monod on the chart grid
        const { X, S } = simulateMonod(best.muMax, best.Ks, tGrid, X0, S0);

        const sgMonod = S.map(s => Math.max(sugarToSG(s, VmeadL), SG_MIN));
        const yeastConc = X;
        const yeastTotalG = X.map(x => x * VmeadL);     // convert conc (g/L) → total grams
        const abvMonod = sgMonod.map(sg => abvHmrc(SG0, sg));

        updateChart(charts.sgMonod, tGrid, sgMonod);
        updateChart(charts.yeastMonod, tGrid, yeastConc);
        updateChart(charts.abvMonod, tGrid, abvMonod);
    });
});
