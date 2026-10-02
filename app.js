import { abvHmrc, calculateMeadRecipe, calculatePhAdjustment } from './meadMath.js';
import { renderHelp } from './help/renderHelp.js';
import { initThemeSettings } from './theme.js';
import {
    durationBetween,
    formatDateTimeLabel,
    makeLocalDate,
    monthIndexToLabel,
    monthLabelToIndex,
} from './timeDuration.js';

const settingsButton = document.getElementById('theme-toggle');
initThemeSettings();

// =====================
// APP HELP SCREEN (HTML)
// =====================

function initHelpScreen() {
    const contentEl = document.getElementById("help-content");
    const tocEl = document.getElementById("help-toc");
    const searchEl = document.getElementById("help-search");

    renderHelp({ contentEl, tocEl });

    if (searchEl && !searchEl.dataset.wired) {
        searchEl.dataset.wired = "1";
        searchEl.addEventListener("input", () => {
            filterHelpCards(searchEl.value);
        });
    }

    filterHelpCards(searchEl?.value || "");
}

function filterHelpCards(query) {
    const q = String(query || "").trim().toLowerCase();

    document.querySelectorAll("#help-content .help-card").forEach((card) => {
        const matches = !q || card.innerText.toLowerCase().includes(q);
        card.classList.toggle("hidden", !matches);
    });
}

// ----- SCREEN NAVIGATION -----

const screens = document.querySelectorAll(".screen");

let currentScreenId = "screen-home";
let screenHistory = [];

function runScreenSetup(id) {
    if (id === "screen-mead-recipe") {
        fillHoneyDropdown();
        fillYeastDropdown();
    }

    if (id === "screen-yeast-database") {
        renderYeastTable();
    }

    if (id === "screen-ph") {
        fillPhDropdown();
    }

    if (id === "screen-pH-database") {
        renderPhTable();
    }

    if (id === "screen-recipe-database") {
        renderRecipeTable();
    }

    if (id === "screen-time-duration") {
        initTimeDurationScreen();
    }

    if (id === "screen-app-help") {
        initHelpScreen();
    }
}

// In app.js: add these variables immediately before showScreen,
// and replace only the existing showScreen function with this implementation.
let navigationTicket = 0;
let activePageTransition = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function showScreen(id, direction = 'forward') {
    const targetScreen = document.getElementById(id);
    if (!targetScreen || (targetScreen.classList.contains('active') && id === currentScreenId)) return;

    currentScreenId = id;
    const ticket = ++navigationTicket;
    activePageTransition?.skipTransition();

    const updateScreen = () => {
        if (ticket !== navigationTicket) return;
        document.documentElement.dataset.navDirection = direction;
        screens.forEach(screen => {
            screen.getAnimations().forEach(animation => animation.cancel());
            screen.classList.toggle('active', screen.id === id);
        });
        runScreenSetup(id);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        const heading = targetScreen.querySelector('h2');
        if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
        }
    };

    const fallback = () => {
        updateScreen();
        if (!reducedMotion.matches && targetScreen.animate) {
            const x = direction === 'back' ? -12 : 12;
            targetScreen.animate([
                { opacity: 0, transform: `translateX(${x}px)` },
                { opacity: 1, transform: 'translateX(0)' },
            ], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
    };

    if (reducedMotion.matches || !document.startViewTransition) {
        fallback();
        return;
    }

    try {
        const transition = document.startViewTransition(updateScreen);
        activePageTransition = transition;
        transition.finished.catch(() => { }).finally(() => {
            if (activePageTransition === transition) activePageTransition = null;
        });
    } catch {
        fallback();
    }
}

function navigateToScreen(id) {
    if (!id || id === currentScreenId) return;

    screenHistory.push(currentScreenId);
    showScreen(id);
}

function navigateHome() {
    screenHistory = [];
    showScreen('screen-home', 'back');
}

function goBackScreen() {
    if (currentScreenId === 'screen-home') return;
    const previousScreen = screenHistory.pop() || 'screen-home';
    showScreen(previousScreen, 'back');
}

// Home grid buttons
document.querySelectorAll("[data-target]").forEach(btn => {
    btn.addEventListener("click", () => {
        navigateToScreen(btn.dataset.target);
    });
});

// Back to home buttons
document.querySelectorAll(".back-home").forEach(btn => {
    btn.addEventListener("click", () => {
        navigateHome();
    });
});

// Clicking the gear opens the settings screen
if (settingsButton) {
    settingsButton.addEventListener("click", () => {
        navigateToScreen("screen-settings");
    });
}

// ----- PHONE BACK-SWIPE GESTURE -----
// Swipe right from the left edge to go back one app screen.

const BACK_SWIPE_EDGE_PX = 36;
const BACK_SWIPE_MIN_X = 80;
const BACK_SWIPE_MAX_Y = 60;

let backSwipeTracking = false;
let backSwipeStartX = 0;
let backSwipeStartY = 0;

function shouldIgnoreBackSwipeTarget(target) {
    return !!target.closest(
        "input, textarea, select, button, a, canvas, .table-wrapper, .table-wrap, .charts-wrap, .modal-overlay"
    );
}

document.addEventListener("touchstart", event => {
    if (currentScreenId === "screen-home") return;
    if (event.touches.length !== 1) return;
    if (shouldIgnoreBackSwipeTarget(event.target)) return;

    const touch = event.touches[0];

    // Only start a back gesture from the left edge of the screen
    if (touch.clientX > BACK_SWIPE_EDGE_PX) return;

    backSwipeTracking = true;
    backSwipeStartX = touch.clientX;
    backSwipeStartY = touch.clientY;
}, { passive: true });

document.addEventListener("touchend", event => {
    if (!backSwipeTracking) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - backSwipeStartX;
    const dy = touch.clientY - backSwipeStartY;

    backSwipeTracking = false;

    const isBackSwipe =
        dx >= BACK_SWIPE_MIN_X &&
        Math.abs(dy) <= BACK_SWIPE_MAX_Y;

    if (isBackSwipe) {
        goBackScreen();
    }
}, { passive: true });

// Start on home screen
showScreen("screen-home");

// ----- ABV CALCULATOR -----

const ogInput = document.getElementById('og');
const fgInput = document.getElementById('fg');
const abvBtn = document.getElementById('abv-btn');
const abvOutput = document.getElementById('abv-output');

if (abvBtn) {
    abvBtn.addEventListener('click', () => {
        const og = parseFloat(ogInput.value);
        const fg = parseFloat(fgInput.value);

        if (Number.isNaN(og) || Number.isNaN(fg)) {
            abvOutput.textContent = 'Please enter valid numbers.';
            return;
        }

        const abv = abvHmrc(og, fg);
        abvOutput.textContent = `ABV: ${abv.toFixed(2)} %`;
    });
}

// ----- HONEY DATABASE -----

const honeyTableBody = document.getElementById('honey-table-body');
const honeyNameInput = document.getElementById('honey-name-input');
const honeySugarInput = document.getElementById('honey-sugar-input');
const honeyPriceInput = document.getElementById('honey-price-bottle-input');
const honeyMassInput = document.getElementById('honey-mass-bottle-input')
const honeyAddBtn = document.getElementById('honey-add-btn');
const honeyCancelEditBtn = document.getElementById('honey-cancel-edit-btn');

let honeyEditIndex = null;

// Default entries
const defaultHoneyDb = [
    { name: 'Runny honey Lidl', sugar: 79.7, price: 1.59, mass: 400 },
    { name: 'Clear honey Lidl', sugar: 79.7, price: 1.69, mass: 500 },
    { name: 'Generic honey', sugar: 80, price: 1.49, mass: 300 },
    { name: 'Runny honey Rowse', sugar: 80.8, price: 5, mass: 720 },
    { name: 'Manuka honey Lidl', sugar: 85.9, price: 4.89, mass: 250 }
];

function loadHoneyDb() {
    try {
        const saved = localStorage.getItem('honeyDb');
        if (!saved) return defaultHoneyDb.slice();

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) return defaultHoneyDb.slice();

        // Basic validation/cleanup so the table can't silently break
        const cleaned = parsed
            .map((x) => ({
                name: String(x?.name ?? '').trim(),
                sugar: Number(x?.sugar),
                price: Number(x?.price),
                mass: Number(x?.mass),
            }))
            .filter((x) =>
                x.name &&
                Number.isFinite(x.sugar) &&
                Number.isFinite(x.price) &&
                Number.isFinite(x.mass)
            );

        return cleaned;
    } catch {
        return defaultHoneyDb.slice();
    }
}

let honeyDb = loadHoneyDb();

function resetHoneyEditor() {
    honeyEditIndex = null;

    honeyNameInput.value = '';
    honeySugarInput.value = '';
    honeyPriceInput.value = '';
    honeyMassInput.value = '';

    honeyAddBtn.textContent = 'Add';
    honeyCancelEditBtn?.classList.add('hidden');
}

function beginHoneyEdit(index) {
    const entry = honeyDb[index];
    if (!entry) return;

    honeyEditIndex = index;

    honeyNameInput.value = entry.name;
    honeySugarInput.value = entry.sugar;
    honeyPriceInput.value = entry.price;
    honeyMassInput.value = entry.mass;

    honeyAddBtn.textContent = 'Save changes';
    honeyCancelEditBtn?.classList.remove('hidden');

    honeyNameInput.focus();
}


function saveHoneyDb() {
    const saved = storeDatabase('honeyDb', honeyDb);
    if (!saved) honeyDb = loadHoneyDb();
    return saved;
}

function renderHoneyTable() {
    if (!honeyTableBody) return;
    honeyTableBody.innerHTML = '';

    honeyDb.forEach((entry, index) => {
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.textContent = entry.name;

        const tdSugar = document.createElement('td');
        tdSugar.textContent = entry.sugar.toString();

        const tdPrice = document.createElement('td');
        tdPrice.textContent = entry.price.toString();

        const tdMass = document.createElement('td');
        tdMass.textContent = entry.mass.toString();

        const tdActions = document.createElement('td');
        tdActions.className = 'table-action-cell';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.title = `Edit ${entry.name}`;
        editBtn.addEventListener('click', () => {
            beginHoneyEdit(index);
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = '✕';
        delBtn.className = 'delete-btn';
        delBtn.title = `Delete ${entry.name}`;
        delBtn.addEventListener('click', () => {
            const confirmed = confirm(
                `Delete "${entry.name}"?\n\nThis cannot be undone.`
            );

            if (!confirmed) return;

            honeyDb.splice(index, 1);
            if (!saveHoneyDb()) return;
            resetHoneyEditor();
            renderHoneyTable();
            fillHoneyDropdown();
        });

        tdActions.append(editBtn, delBtn);

        tr.appendChild(tdName);
        tr.appendChild(tdSugar);
        tr.appendChild(tdPrice);
        tr.appendChild(tdMass);
        tr.appendChild(tdActions);

        honeyTableBody.appendChild(tr);
    });
}

// Add or save edited honey
if (honeyAddBtn) {
    honeyAddBtn.addEventListener('click', () => {
        const name = (honeyNameInput.value || '').trim();
        const sugar = parseFloat(honeySugarInput.value);
        const price = parseFloat(honeyPriceInput.value);
        const mass = parseFloat(honeyMassInput.value);

        if (
            !name ||
            Number.isNaN(sugar) ||
            Number.isNaN(price) ||
            Number.isNaN(mass)
        ) {
            alert('Please fill in name, sugar, price and mass.');
            return;
        }

        if (!Number.isFinite(sugar) || sugar < 0 || sugar > 100 ||
            !Number.isFinite(price) || price < 0 ||
            !Number.isFinite(mass) || mass <= 0) {
            alert('Use sugar from 0 to 100%, a price of zero or greater, and a positive container mass.');
            return;
        }

        const entry = { name, sugar, price, mass };

        if (honeyEditIndex === null) {
            honeyDb.push(entry);
        } else {
            honeyDb[honeyEditIndex] = entry;
        }

        if (!saveHoneyDb()) return;
        renderHoneyTable();
        fillHoneyDropdown();
        resetHoneyEditor();
    });
}

honeyCancelEditBtn?.addEventListener('click', resetHoneyEditor);

// ----- MEAD RECIPE (Design) -----

const meadVolInput = document.getElementById('mead_volume_l_recipe');
const meadFgInput = document.getElementById('mead_final_gravity_recipe');
const meadAbvInput = document.getElementById('mead_target_abv_recipe');
const meadYieldInput = document.getElementById('mead_y_xs_recipe');
const meadHoneySelect = document.getElementById('mead_honey_select_recipe');
const meadYeastSelect = document.getElementById('mead_yeast_select_recipe');
const meadUseFruit = document.getElementById('mead_use_fruit_recipe');
const meadFruitType = document.getElementById('mead_fruit_type_recipe');
const meadBtn = document.getElementById('mead_recipe_button_recipe');
const meadOut = document.getElementById('mead_recipe_output_recipe');

function fillHoneyDropdown() {
    if (!meadHoneySelect) return;

    meadHoneySelect.innerHTML = '';
    honeyDb.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.name;
        opt.textContent = h.name;
        meadHoneySelect.appendChild(opt);
    });
}

function fillYeastDropdown() {
    if (!meadYeastSelect) return;

    meadYeastSelect.innerHTML = '';
    yeastDb.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y.name;
        opt.textContent = y.name;
        meadYeastSelect.appendChild(opt);
    });
}


function money(x) {
    if (!Number.isFinite(x)) return '—';
    return `£${x.toFixed(2)}`;
}

function fmt(x, dp = 2) {
    if (!Number.isFinite(x)) return '—';
    return x.toFixed(dp);
}

if (meadBtn) {
    // Populate once on load (and whenever you edit honey DB + come back)
    fillHoneyDropdown();

    meadBtn.addEventListener('click', () => {
        const volumeL = parseFloat(meadVolInput?.value);
        const finalGravity = parseFloat(meadFgInput?.value);
        const targetAbv = parseFloat(meadAbvInput?.value);
        const yXs = Number(meadYieldInput?.value);

        if (!Number.isFinite(volumeL) || !Number.isFinite(finalGravity) || !Number.isFinite(targetAbv)) {
            meadOut.textContent = 'Please enter valid numbers for volume, FG and ABV.';
            return;
        }

        if (!Number.isFinite(yXs) || yXs <= 0 || yXs >= 1) {
            meadOut.textContent = 'Y_xs must be greater than 0 and less than 1 g/g.';
            return;
        }

        const honeyName = (meadHoneySelect?.value || '').trim();
        const honey = honeyDb.find(h => h.name.toLowerCase() === honeyName.toLowerCase());

        if (!honey) {
            meadOut.textContent = 'Please pick a honey type (add one in Honey Database if needed).';
            return;
        }

        // Your honeyDb stores:
        // density: kg/m^3, sugar: %, price: £ per bottle, mass: g per bottle 
        const sugarConcPct = Number(honey.sugar);

        // Convert bottle cost -> £ per 100 g (this is what your Python uses as cost_per_100g)
        const pricePerContainer = Number(honey.price);
        const massPerContainerG = Number(honey.mass);

        const yeastName = (meadYeastSelect?.value || '').trim();
        const yeast = yeastDb.find(y => y.name.toLowerCase() === yeastName.toLowerCase());

        if (!yeast) {
            meadOut.textContent = 'Please pick a yeast type (add one in Yeast Database if needed).';
            return;
        }

        const yeastNRequirement = yeast.nReq;


        let r;
        try {
            r = calculateMeadRecipe({
                volumeL,
                finalGravity,
                targetAbv,
                sugarConcPct,
                pricePerContainer,
                massPerContainerG,
                yeastNRequirement,
                yXs,
            });
        } catch (error) {
            meadOut.textContent = error.message;
            return;
        }

        const fruitUsed = !!meadUseFruit?.checked;
        const fruitType = (meadFruitType?.value || '').trim();

        let text = '';
        text += `Honey type: ${honey.name}\n`;
        text += `Yeast: ${yeast.name} (N Requirement: ${yeastNRequirement})\n`;
        text += `Fruit used: ${fruitUsed ? `Yes${fruitType ? ' - ' + fruitType : ''}` : 'No'}\n\n`;
        text += `Biomass yield Y_xs: ${fmt(yXs, 3)} g/g\n\n`;

        text += `Desired ABV: ${fmt(targetAbv, 1)}%\n`;
        text += `Final gravity target: ${fmt(finalGravity, 3)}\n`;
        text += `Starting gravity estimate: ${fmt(r.startingGravity, 3)}\n`;
        text += `Brix estimate: ${fmt(r.brix, 1)}\n\n`;

        text += `Total pure sugar needed: ${fmt(r.totalSugarNeeded, 1)} g\n`;
        text += `Honey required: ${fmt(r.honeyMassGrams, 2)} g\n`;
        text += `Honey containers required: ${fmt(r.containers, 1)}\n`;
        text += `Estimated cost: ${money(r.cost)}\n`;
        text += `Volume of water to add: ${fmt(r.waterVolumeL, 2)} L\n`;

        // --- Yeast nutrients ---
        const hasO = (r.fermaidOGramsTotal != null) && Number.isFinite(r.fermaidOGramsPerDay);
        const hasK = (r.fermaidKGramsTotal != null) && Number.isFinite(r.fermaidKGramsTotal);

        if (hasO || hasK) {
            text += `\n--- Yeast Nutrient Additions ---\n`;

            // ABV > 14 path: Fermaid-K is used + Fermaid-O is still split
            if (hasK) {
                text += `Fermaid-K Required: ${fmt(r.fermaidKGramsTotal, 2)} g at 1/3 sugar break\n`;
            }

            // Fermaid-O schedule (your existing timing)
            if (hasO) {
                text += `Fermaid-O Required: ${fmt(r.fermaidOGramsPerDay, 2)} g 24 hours (1 day) after start of fermentation\n`;
                text += `Fermaid-O Required: ${fmt(r.fermaidOGramsPerDay, 2)} g 48 hours (2 days) after start of fermentation\n`;
                text += `Fermaid-O Required: ${fmt(r.fermaidOGramsPerDay, 2)} g 72 hours (3 days) after start of fermentation\n`;
                text += `Fermaid-O Required: ${fmt(r.fermaidOGramsPerDay, 2)} g 168 hours (7 days) after start of fermentation or after 1/3 sugar break\n`;
            }

            if (Number.isFinite(r.thirdsugarbreak)) {
                text += `1/3 sugar break: ${fmt(r.thirdsugarbreak, 3)}\n`;
            }
        } else {
            text += `\n(Yeast nutrient calculation unavailable for the current inputs.)\n`;
        }


        text += `\n--- Approximate Honey for Back-Sweetening ---\n`;
        text += `Back-Sweetening Target FG: ${fmt(finalGravity, 3)}\n`;
        text += `Total pure sugar needed: ${fmt(r.massPureSugarNeededForSweetening, 2)} g\n`;
        text += `Honey Mass Required: ${fmt(r.massHoneyNeededForSweetening, 2)} g\n`;
        text += 'This is an initial gravity-based estimate. Add gradually and re-check gravity.\n';
        text += 'Adding honey increases volume and can reduce the finished ABV.\n';

        meadOut.textContent = text;
    });
}

// Optional: if you want the honey dropdown to always reflect latest DB when you open the screen,
// call fillHoneyDropdown() inside showScreen() when id === 'screen-mead-recipe'.

// =====================
// YEAST DATABASE
// =====================

const defaultYeastDb = [
    { name: "Lalvin D-47", nReq: "Medium", packetWeight: 5, costPerPacket: 1.50 },
    { name: "Lalvin EC-1118", nReq: "Low", packetWeight: 5, costPerPacket: 1.50 },
];

// DOM elements
const yeastTableBody = document.getElementById("yeast-table-body_yeastdb");
const yeastNameInput = document.getElementById("yeast_name_input_yeastdb");
const yeastNReqInput = document.getElementById("yeast_nreq_input_yeastdb");
const yeastPacketWeightInput = document.getElementById("yeast_packet_weight_input_yeastdb");
const yeastCostInput = document.getElementById("yeast_cost_input_yeastdb");
const yeastAddBtn = document.getElementById("yeast_add_btn_yeastdb");
const yeastCancelEditBtn = document.getElementById("yeast-cancel-edit-btn");

let yeastEditIndex = null;

// Load/save
function loadYeastDb() {
    try {
        const saved = localStorage.getItem("yeastDb");
        if (!saved) return defaultYeastDb.slice();

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return defaultYeastDb.slice();

        const cleaned = parsed
            .map((x) => ({
                name: String(x?.name ?? "").trim(),
                nReq: String(x?.nReq ?? "Medium").trim(),
                packetWeight: Number(x?.packetWeight),
                costPerPacket: Number(x?.costPerPacket),
            }))
            .filter((x) =>
                x.name &&
                ["Low", "Medium", "High"].includes(x.nReq) &&
                Number.isFinite(x.packetWeight) &&
                Number.isFinite(x.costPerPacket)
            );

        return cleaned;
    } catch {
        return defaultYeastDb.slice();
    }
}

let yeastDb = loadYeastDb();

function resetYeastEditor() {
    yeastEditIndex = null;

    yeastNameInput.value = "";
    yeastPacketWeightInput.value = "";
    yeastCostInput.value = "";
    yeastNReqInput.value = "Medium";

    yeastAddBtn.textContent = "Add";
    yeastCancelEditBtn?.classList.add("hidden");
}

function beginYeastEdit(index) {
    const entry = yeastDb[index];
    if (!entry) return;

    yeastEditIndex = index;

    yeastNameInput.value = entry.name;
    yeastNReqInput.value = entry.nReq;
    yeastPacketWeightInput.value = entry.packetWeight;
    yeastCostInput.value = entry.costPerPacket;

    yeastAddBtn.textContent = "Save changes";
    yeastCancelEditBtn?.classList.remove("hidden");

    yeastNameInput.focus();
}

function saveYeastDb() {
    const saved = storeDatabase('yeastDb', yeastDb);
    if (!saved) yeastDb = loadYeastDb();
    return saved;
}

// Render
function renderYeastTable() {
    if (!yeastTableBody) return;

    yeastTableBody.innerHTML = "";

    yeastDb.forEach((y, idx) => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.textContent = y.name;

        const tdNReq = document.createElement("td");
        tdNReq.textContent = y.nReq;

        const tdWeight = document.createElement("td");
        tdWeight.textContent = `${y.packetWeight}`;

        const tdCost = document.createElement("td");
        tdCost.textContent = `${y.costPerPacket.toFixed(2)}`;

        const tdActions = document.createElement("td");
        tdActions.className = "table-action-cell";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = "Edit";
        editBtn.className = "edit-btn";
        editBtn.title = `Edit ${y.name}`;
        editBtn.addEventListener("click", () => {
            beginYeastEdit(idx);
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "✕";
        delBtn.className = "delete-btn";
        delBtn.title = `Delete ${y.name}`;

        delBtn.addEventListener("click", () => {
            const confirmed = confirm(
                `Delete "${y.name}"?\n\nThis cannot be undone.`
            );

            if (!confirmed) return;

            yeastDb.splice(idx, 1);
            if (!saveYeastDb()) return;
            resetYeastEditor();
            renderYeastTable();
            fillYeastDropdown();
        });

        tdActions.append(editBtn, delBtn);

        tr.appendChild(tdName);
        tr.appendChild(tdNReq);
        tr.appendChild(tdWeight);
        tr.appendChild(tdCost);
        tr.appendChild(tdActions);

        yeastTableBody.appendChild(tr);
    });
}

// Add or save edited yeast
if (yeastAddBtn) {
    yeastAddBtn.addEventListener("click", () => {
        const name = (yeastNameInput?.value || "").trim();
        const nReq = (yeastNReqInput?.value || "Medium").trim();
        const packetWeight = Number(yeastPacketWeightInput?.value);
        const costPerPacket = Number(yeastCostInput?.value);

        if (!name) {
            alert("Please enter a yeast name.");
            return;
        }

        if (!["Low", "Medium", "High"].includes(nReq)) {
            alert("N Requirement must be Low, Medium, or High.");
            return;
        }

        if (!Number.isFinite(packetWeight) || packetWeight <= 0) {
            alert("Packet weight must be a positive number.");
            return;
        }

        if (!Number.isFinite(costPerPacket) || costPerPacket < 0) {
            alert("Cost per packet must be a valid number.");
            return;
        }

        const entry = {
            name,
            nReq,
            packetWeight,
            costPerPacket
        };

        if (yeastEditIndex === null) {
            yeastDb.push(entry);
        } else {
            yeastDb[yeastEditIndex] = entry;
        }

        if (!saveYeastDb()) return;
        renderYeastTable();
        fillYeastDropdown();
        resetYeastEditor();
    });
}

yeastCancelEditBtn?.addEventListener("click", resetYeastEditor);

// ----- pH ADJUSTER DATABASE -----

const phTableBody = document.getElementById("ph-adjuster-table-body");
const phNameInput = document.getElementById("ph-name-input");
const phTypeInput = document.getElementById("ph-type-input");
const phHPerMolInput = document.getElementById("ph-hplus-per-mol-input");
const phMolarMassInput = document.getElementById("ph-molar-mass-input");
const phNotesInput = document.getElementById("ph-notes-input");
const phAddBtn = document.getElementById("ph-add-btn");
const phCancelEditBtn = document.getElementById("ph-cancel-edit-btn");

let phEditIndex = null;

const phSelect = document.getElementById("ph_adjuster_select");
const phCalcBtn = document.getElementById("ph-calc-btn");
const phOutput = document.getElementById("ph-output");

const defaultPhDb = [
    { name: "Calcium carbonate (CaCO₃)", type: "base", hPerMol: 2, molarMass: 100.09, notes: "Raises pH" },
    { name: "Citric acid", type: "acid", hPerMol: 3, molarMass: 192.12, notes: "Citrus/lemony" },
    { name: "Malic acid", type: "acid", hPerMol: 2, molarMass: 134.09, notes: "Green apple acidity" },
    { name: "Tartaric acid", type: "acid", hPerMol: 2, molarMass: 150.09, notes: "Grape-like acidity" },
];

let phDb = [];

function resetPhEditor() {
    phEditIndex = null;

    phNameInput.value = "";
    phTypeInput.value = "acid";
    phHPerMolInput.value = "";
    phMolarMassInput.value = "";
    phNotesInput.value = "";

    phAddBtn.textContent = "Add";
    phCancelEditBtn?.classList.add("hidden");
}

function beginPhEdit(index) {
    const entry = phDb[index];
    if (!entry) return;

    phEditIndex = index;

    phNameInput.value = entry.name;
    phTypeInput.value = entry.type;
    phHPerMolInput.value = entry.hPerMol;
    phMolarMassInput.value = entry.molarMass;
    phNotesInput.value = entry.notes || "";

    phAddBtn.textContent = "Save changes";
    phCancelEditBtn?.classList.remove("hidden");

    phNameInput.focus();
}

function savePhDb() {
    const saved = storeDatabase('phAdjusterDb', phDb);
    if (!saved) loadPhDb();
    return saved;
}

function loadPhDb() {
    try {
        const raw = localStorage.getItem('phAdjusterDb');
        if (raw === null) {
            phDb = defaultPhDb.slice();
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Expected a database list.');
        phDb = parsed;
    } catch {
        phDb = defaultPhDb.slice();
        alert('The saved pH database could not be read. Defaults are shown; the stored data has not been overwritten. Recover it before saving more pH changes.');
    }
}

function renderPhTable() {
    if (!phTableBody) return;
    phTableBody.innerHTML = "";

    phDb.forEach((a, idx) => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.textContent = a.name;

        const tdType = document.createElement("td");
        tdType.textContent = a.type;

        const tdStoich = document.createElement("td");
        tdStoich.textContent = String(a.hPerMol);

        const tdMW = document.createElement("td");
        tdMW.textContent = String(a.molarMass);

        const tdNotes = document.createElement("td");
        tdNotes.textContent = a.notes || "";

        const tdActions = document.createElement("td");
        tdActions.className = "table-action-cell";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = "Edit";
        editBtn.className = "edit-btn";
        editBtn.title = `Edit ${a.name}`;
        editBtn.addEventListener("click", () => {
            beginPhEdit(idx);
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "✕";
        delBtn.className = "delete-btn";
        delBtn.title = `Delete ${a.name}`;
        delBtn.addEventListener("click", () => {
            const confirmed = confirm(
                `Delete "${a.name}"?\n\nThis cannot be undone.`
            );

            if (!confirmed) return;

            phDb.splice(idx, 1);
            if (!savePhDb()) return;
            resetPhEditor();
            renderPhTable();
            fillPhDropdown();
        });

        tdActions.append(editBtn, delBtn);

        tr.append(tdName, tdType, tdStoich, tdMW, tdNotes, tdActions);
        phTableBody.appendChild(tr);
    });
}

function fillPhDropdown() {
    if (!phSelect) return;
    phSelect.innerHTML = "";
    phDb.forEach((a, idx) => {
        const opt = document.createElement("option");
        opt.value = String(idx);
        opt.textContent = a.name;
        phSelect.appendChild(opt);
    });
}

if (phAddBtn) {
    phAddBtn.addEventListener("click", () => {
        const name = (phNameInput?.value || "").trim();
        const type = (phTypeInput?.value || "acid").trim();
        const hPerMol = Number(phHPerMolInput?.value);
        const molarMass = Number(phMolarMassInput?.value);
        const notes = (phNotesInput?.value || "").trim();

        if (
            !name ||
            !["acid", "base"].includes(type) ||
            !Number.isFinite(hPerMol) ||
            !Number.isFinite(molarMass)
        ) {
            alert("Fill name, type, H+ per mol, and molar mass.");
            return;
        }

        if (hPerMol <= 0 || molarMass <= 0) {
            alert("H+ per mol and molar mass must be positive numbers.");
            return;
        }

        const entry = {
            name,
            type,
            hPerMol,
            molarMass,
            notes
        };

        if (phEditIndex === null) {
            phDb.push(entry);
        } else {
            phDb[phEditIndex] = entry;
        }

        if (!savePhDb()) return;
        renderPhTable();
        fillPhDropdown();
        resetPhEditor();
    });
}

phCancelEditBtn?.addEventListener("click", resetPhEditor);

if (phCalcBtn) {
    phCalcBtn.addEventListener("click", () => {
        const currentPh = Number(document.getElementById("starting_pH")?.value);
        const targetPh = Number(document.getElementById("desired_pH")?.value);
        const volumeL = Number(document.getElementById("ph_volume_l")?.value);

        const idx = Number(phSelect?.value);
        const adj = phDb[idx];

        if (!adj || !Number.isFinite(currentPh) || !Number.isFinite(targetPh) || !Number.isFinite(volumeL)) {
            alert("Check pH inputs, volume, and selected adjuster.");
            return;
        }

        const r = calculatePhAdjustment({
            currentPh,
            targetPh,
            volumeL,
            adjusterType: adj.type,
            hPlusPerMol: adj.hPerMol,
            molarMass: adj.molarMass,
        });

        if (r.error) {
            phOutput.textContent = `Error: ${r.error}`;
            return;
        }

        const mismatchMsg = r.mismatch
            ? `\n⚠ You selected a ${adj.type}, but the pH change required needs a ${r.need}.`
            : "";

        phOutput.textContent =
            `Adjuster: ${adj.name}\n` +
            `Start pH: ${currentPh}\nTarget pH: ${targetPh}\nVolume: ${volumeL} L\n\n` +
            `Need: ${r.need}\n` +
            `Moles H+ change: ${r.molHNeeded.toExponential(3)} mol\n` +
            `Moles adjuster: ${r.molCompound.toExponential(3)} mol\n` +
            `Mass required: ${r.massG.toFixed(3)} g` +
            mismatchMsg +
            `\n\nNote: This is a theoretical estimate; real must buffering means add in small steps and re-measure.`;
    });
}

function storeDatabase(key, rows) {
    try {
        localStorage.setItem(key, JSON.stringify(rows));
        return true;
    } catch {
        alert('The change could not be saved. Browser storage may be full or unavailable. Your previous saved data is retained.');
        return false;
    }
}

// ----- RECIPE DATABASE -----
const recipeTableBody = document.getElementById('recipe-table-body');
const saveRecipeBtn = document.getElementById('save-recipe-btn');
const recipeManualAddBtn = document.getElementById('recipe-manual-add-btn');
const exportRecipePdfBtn = document.getElementById('export-recipe-pdf-btn');   // on mead recipe screen
const recipeExportPdfBtn = document.getElementById('recipe-export-pdf-btn');   // on saved recipes screen

const RECIPE_DB_KEY = "recipeDb_v1";

let recipeDb = loadRecipeDb();

function loadRecipeDb() {
    try {
        const raw = localStorage.getItem(RECIPE_DB_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function openPrintWindow({ title, htmlBody }) {
    const w = window.open("", "_blank");
    if (!w) {
        alert("Popup blocked. Please allow popups to export as PDF.");
        return;
    }

    const safeTitle = escapeHtml(title);

    w.document.open();
    w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 24px; }
    h1 { margin: 0 0 16px 0; font-size: 22px; }
    h2 { margin: 22px 0 10px 0; font-size: 18px; }
    pre { white-space: pre-wrap; word-wrap: break-word; background: #f3f4f6; padding: 12px; border-radius: 10px; border: 1px solid #e5e7eb; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 14px; }
    @media print { body { padding: 0; } pre { background: #fff; } }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`);
    w.document.close();

    setTimeout(() => {
        w.focus();
        w.print();
    }, 250);

    w.onafterprint = () => {
        try { w.close(); } catch { }
    };
}

function exportSingleRecipeToPdf(name, text) {
    const safeName = (name || "Recipe").trim() || "Recipe";
    const safeText = (text || "").trim();

    if (!safeText) {
        alert("Nothing to export yet.");
        return;
    }

    const now = new Date();
    const body = `
<h1>${escapeHtml(safeName)}</h1>
<div class="meta">${escapeHtml(now.toLocaleString())}</div>
<pre>${escapeHtml(safeText)}</pre>
`;
    openPrintWindow({ title: safeName, htmlBody: body });
}

function exportAllRecipesToPdf(recipes) {
    if (!Array.isArray(recipes) || recipes.length === 0) {
        alert("No saved recipes to export.");
        return;
    }

    const now = new Date();
    let body = `<h1>Saved Recipes</h1><div class="meta">${escapeHtml(now.toLocaleString())}</div>`;

    recipes.forEach((r, i) => {
        const name = (r?.name || `Recipe ${i + 1}`).trim() || `Recipe ${i + 1}`;
        const text = (r?.text || "").trim();
        if (!text) return;

        body += `
<h2>${escapeHtml(name)}</h2>
<pre>${escapeHtml(text)}</pre>
<hr/>
`;
    });

    openPrintWindow({ title: "Saved Recipes", htmlBody: body });
}

function saveRecipeDb() {
    const saved = storeDatabase(RECIPE_DB_KEY, recipeDb);
    if (!saved) recipeDb = loadRecipeDb();
    return saved;
}

function renderRecipeTable() {
    if (!recipeTableBody) return;
    recipeTableBody.innerHTML = "";

    if (recipeDb.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 3;
        td.textContent = "No saved recipes yet.";
        tr.appendChild(td);
        recipeTableBody.appendChild(tr);
        return;
    }

    recipeDb.forEach((r, idx) => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.textContent = r.name || "(Unnamed)";

        const tdText = document.createElement("td");
        // Keep the table readable: show first ~140 chars, full text on click (optional)
        const preview = (r.text || "").replace(/\s+/g, " ").trim();
        tdText.textContent = preview.length > 140 ? preview.slice(0, 140) + "…" : preview;
        tdText.title = r.text || "";

        const tdActions = document.createElement("td");
        tdActions.className = "table-action-cell";

        // Export this recipe
        const exportBtn = document.createElement("button");
        exportBtn.textContent = "⤓";
        exportBtn.className = "export-btn";
        exportBtn.type = "button";
        exportBtn.title = "Export this recipe as PDF";
        exportBtn.addEventListener("click", () => {
            exportSingleRecipeToPdf(
                r.name || "Recipe",
                r.text || ""
            );
        });

        // Edit this recipe
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "edit-btn";
        editBtn.type = "button";
        editBtn.title = "Edit this recipe";
        editBtn.addEventListener("click", () => {
            openModal(
                {
                    title: "Edit saved recipe",
                    okText: "Save changes",
                    showName: true,
                    showText: true,
                    nameValue: r.name || "",
                    textValue: r.text || ""
                },
                ({ name, text }) => {
                    if (!name) {
                        alert("Please enter a recipe name.");
                        return;
                    }

                    if (!text) {
                        alert("Recipe text cannot be empty.");
                        return;
                    }

                    recipeDb[idx] = {
                        ...r,
                        name,
                        text,
                        updatedAt: Date.now()
                    };

                    if (!saveRecipeDb()) return;
                    renderRecipeTable();
                    closeModal();
                }
            );
        });

        // Delete this recipe
        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.className = "delete-btn";
        delBtn.title = "Delete this recipe";
        delBtn.type = "button";
        delBtn.addEventListener("click", () => {
            const recipeName = r.name || "this recipe";

            const confirmed = confirm(
                `Delete "${recipeName}" ?\n\nThis cannot be undone.`
            );

            if (!confirmed) return;

            recipeDb.splice(idx, 1);
            if (!saveRecipeDb()) return;
            renderRecipeTable();
        });

        tdActions.append(exportBtn, editBtn, delBtn);

        tr.appendChild(tdName);
        tr.appendChild(tdText);
        tr.appendChild(tdActions);

        recipeTableBody.appendChild(tr);
    });
}

// ----- SIMPLE MODAL -----
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalNameLabel = document.getElementById("modal-name-label");
const modalNameInput = document.getElementById("modal-name-input");
const modalTextLabel = document.getElementById("modal-text-label");
const modalTextInput = document.getElementById("modal-text-input");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalOkBtn = document.getElementById("modal-ok-btn");

let modalOnOk = null;

function openModal({ title, okText = "Save", showName = true, showText = false, nameValue = "", textValue = "" }, onOk) {
    modalTitle.textContent = title;
    modalOkBtn.textContent = okText;

    modalNameLabel.classList.toggle("hidden", !showName);
    modalNameInput.classList.toggle("hidden", !showName);
    modalTextLabel.classList.toggle("hidden", !showText);
    modalTextInput.classList.toggle("hidden", !showText);

    modalNameInput.value = nameValue;
    modalTextInput.value = textValue;

    modalOnOk = onOk;
    modalOverlay.classList.remove("hidden");

    // focus the first visible field
    if (showName) modalNameInput.focus();
    else if (showText) modalTextInput.focus();
}

function closeModal() {
    modalOverlay.classList.add("hidden");
    modalOnOk = null;
}

modalCancelBtn?.addEventListener("click", closeModal);
modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal(); // click outside closes
});

modalOkBtn?.addEventListener("click", () => {
    if (!modalOnOk) return;
    const name = (modalNameInput?.value || "").trim();
    const text = (modalTextInput?.value || "").trim();
    modalOnOk({ name, text });
});

const MEAD_OUTPUT_ID = "mead_recipe_output_recipe"; // <-- CHANGE THIS to your actual output element id

function getMeadOutputText() {
    const el = document.getElementById(MEAD_OUTPUT_ID);
    if (!el) return "";
    // innerText gives a clean “what the user sees” version (better than innerHTML)
    return (el.innerText || "").trim();
}

exportRecipePdfBtn?.addEventListener("click", () => {
    const outputText = getMeadOutputText();

    // optional: ask for a title using your existing modal
    openModal(
        { title: "Export recipe as PDF", okText: "Export", showName: true, showText: false, nameValue: "Mead Recipe" },
        ({ name }) => {
            exportSingleRecipeToPdf(name || "Mead Recipe", outputText);
            closeModal();
        }
    );
});

recipeExportPdfBtn?.addEventListener("click", () => {
    // Exports ALL saved recipes into one PDF document
    exportAllRecipesToPdf(recipeDb);
});

saveRecipeBtn?.addEventListener("click", () => {
    const outputText = getMeadOutputText();

    openModal(
        { title: "Save recipe", okText: "Save", showName: true, showText: false, nameValue: "" },
        ({ name }) => {
            if (!name) { alert("Please enter a recipe name."); return; }
            if (!outputText) { alert("Nothing to save yet — calculate a recipe first."); return; }

            recipeDb.unshift({
                name,
                text: outputText,
                createdAt: Date.now()
            });

            if (!saveRecipeDb()) return;
            renderRecipeTable();
            closeModal();
        }
    );
});

recipeManualAddBtn?.addEventListener("click", () => {
    openModal(
        { title: "Add manual recipe", okText: "Add", showName: true, showText: true, nameValue: "", textValue: "" },
        ({ name, text }) => {
            if (!text) return;

            const finalName = name || `Manual recipe(${new Date().toLocaleDateString()})`;

            recipeDb.unshift({
                name: finalName,
                text,
                createdAt: Date.now()
            });

            if (!saveRecipeDb()) return;
            renderRecipeTable();
            closeModal();
        }
    );
});

// =====================
// TIME BETWEEN DATES
// =====================

let timeDurationInitDone = false;

function getEl(id) {
    return document.getElementById(id);
}

function setSelectOptions(selectEl, labels) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    labels.forEach((label) => {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        selectEl.appendChild(opt);
    });
}

function setFormFromDate(prefix, d) {
    // Set the date input
    const dateEl = getEl(`${prefix}_date`);
    if (dateEl) dateEl.value = toDateInputValueLocal(d);

    // Set the time inputs (12h)
    let hh = d.getHours();
    const isPm = hh >= 12;
    hh = hh % 12;
    if (hh === 0) hh = 12;

    getEl(`${prefix}_hour`).value = String(hh);
    getEl(`${prefix}_min`).value = String(d.getMinutes());
    getEl(`${prefix}_sec`).value = String(d.getSeconds());
    getEl(`${prefix}_ampm`).value = isPm ? "p" : "a";
}

function readFormToDate(prefix) {
    const dateStr = getEl(`${prefix}_date`)?.value;
    const baseDate = fromDateInputValueLocal(dateStr);

    const year = baseDate.getFullYear();
    const monthIndex = baseDate.getMonth();
    const day = baseDate.getDate();

    const hour12 = Number(getEl(`${prefix}_hour`)?.value);
    const minute = Number(getEl(`${prefix}_min`)?.value);
    const second = Number(getEl(`${prefix}_sec`)?.value);
    const ampm = getEl(`${prefix}_ampm`)?.value;

    return makeLocalDate({ year, monthIndex, day, hour12, minute, second, ampm });
}

function toDateInputValueLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function fromDateInputValueLocal(value) {
    // value is "YYYY-MM-DD"
    if (!value || typeof value !== "string") return new Date(NaN);
    const [y, m, d] = value.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(NaN);
    return new Date(y, m - 1, d); // local midnight
}

function formatTotals(x) {
    const daysStr = x.totalDays.toFixed(4);
    const hoursStr = x.totalHours.toFixed(3);
    const minutesStr = Math.round(x.totalMinutes).toLocaleString();
    const secondsStr = Math.round(x.totalSeconds).toLocaleString();
    return { daysStr, hoursStr, minutesStr, secondsStr };
}

function initTimeDurationScreen() {
    if (timeDurationInitDone) return;
    timeDurationInitDone = true;

    const out = getEl("td_output");
    const startDate = getEl("td_start_date");
    const endDate = getEl("td_end_date");
    if (!out || !startDate || !endDate) return;

    // seed with your example so you can verify it matches the screenshot
    setFormFromDate("td_start", new Date(2026, 0, 18, 15, 44, 0));
    setFormFromDate("td_end", new Date(2026, 1, 14, 9, 28, 0));

    function calcAndRender() {
        const start = readFormToDate("td_start");
        const end = readFormToDate("td_end");

        const r = durationBetween(start, end);
        if (r.error) {
            out.textContent = `Error: ${r.error} `;
            return;
        }

        const startLabel = formatDateTimeLabel(start);
        const endLabel = formatDateTimeLabel(end);
        const totals = formatTotals(r);

        const swapNote = r.swapped
            ? "\n(Note: end time was earlier than start time — showing the absolute difference.)\n"
            : "";

        const sWord = (r.seconds === 1) ? "second" : "seconds";

        out.textContent =
            `The time between ${startLabel} and ${endLabel} is:${swapNote} \n` +
            `${r.days} days, ${r.hours} hours, ${r.minutes} minutes, and ${r.seconds} ${sWord} \n\n` +
            `${totals.daysStr} days\n\n` +
            `${totals.hoursStr} hours\n\n` +
            `${totals.minutesStr} minutes\n\n` +
            `${totals.secondsStr} seconds`;
    }

    getEl("td_calc")?.addEventListener("click", calcAndRender);
    getEl("td_clear")?.addEventListener("click", () => { out.textContent = ""; });
    getEl("td_start_now")?.addEventListener("click", () => { setFormFromDate("td_start", new Date()); });
    getEl("td_end_now")?.addEventListener("click", () => { setFormFromDate("td_end", new Date()); });

    calcAndRender();
}




// Initial render (safe even if screen isn't visible yet)
renderYeastTable();
renderRecipeTable();

// Render on load
renderHoneyTable();
fillHoneyDropdown();
loadPhDb();
renderPhTable();
fillPhDropdown();
fillYeastDropdown();