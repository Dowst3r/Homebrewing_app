import { abvHmrc, calculateMeadRecipe, calculatePhAdjustment } from './meadMath.js';

// ----- THEME HANDLING -----

const body = document.body;
const settingsButton = document.getElementById('theme-toggle');
const darkModeCheckbox = document.getElementById('dark-mode-toggle');
const pinkModeCheckbox = document.getElementById('pink-mode-toggle');

function setTheme(theme) {
    body.classList.remove('theme-dark', 'theme-pink');

    if (theme === 'dark') body.classList.add('theme-dark');
    else if (theme === 'pink') body.classList.add('theme-pink');

    localStorage.setItem('theme', theme);

    if (darkModeCheckbox) darkModeCheckbox.checked = theme === 'dark';
    if (pinkModeCheckbox) pinkModeCheckbox.checked = theme === 'pink';
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}





darkModeCheckbox.addEventListener('change', () => {
    if (darkModeCheckbox.checked) {
        if (pinkModeCheckbox) pinkModeCheckbox.checked = false;
        setTheme('dark');
    } else {
        setTheme('light');
    }
});

pinkModeCheckbox.addEventListener('change', () => {
    if (pinkModeCheckbox.checked) {
        if (darkModeCheckbox) darkModeCheckbox.checked = false;
        setTheme('pink');
    } else {
        setTheme('light');
    }
});

// Load saved theme (or default to light)
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || savedTheme === 'pink') {
    setTheme(savedTheme);
} else {
    setTheme('light');
}

// When the switch in Settings changes
if (darkModeCheckbox) {
    darkModeCheckbox.addEventListener('change', () => {
        const theme = darkModeCheckbox.checked ? 'dark' : 'light';
        setTheme(theme);
    });
}

// ----- SCREEN NAVIGATION -----

const screens = document.querySelectorAll('.screen');

function showScreen(id) {
    screens.forEach(screen => {
        if (screen.id === id) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });

    if (id === 'screen-mead-recipe') {
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

}

// Home grid buttons
document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        showScreen(target);
    });
});

// Back to home buttons
document.querySelectorAll('.back-home').forEach(btn => {
    btn.addEventListener('click', () => {
        showScreen('screen-home');
    });
});

// Clicking the gear opens the settings screen
if (settingsButton) {
    settingsButton.addEventListener('click', () => {
        showScreen('screen-settings');
    });
}

// Start on home screen
showScreen('screen-home');

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

        // If the saved value isn't a list, or it's an empty list, fall back to defaults
        if (!Array.isArray(parsed) || parsed.length === 0) return defaultHoneyDb.slice();

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

        return cleaned.length ? cleaned : defaultHoneyDb.slice();
    } catch {
        return defaultHoneyDb.slice();
    }
}

let honeyDb = loadHoneyDb();


function saveHoneyDb() {
    localStorage.setItem('honeyDb', JSON.stringify(honeyDb));
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

        // Delete button column
        const tdDelete = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.className = 'delete-btn';
        delBtn.title = 'Delete this honey';
        delBtn.addEventListener('click', () => {
            if (confirm(`Delete "${entry.name}"?`)) {
                honeyDb.splice(index, 1);
                saveHoneyDb();
                renderHoneyTable();
                fillHoneyDropdown();
            }
        });

        tdDelete.appendChild(delBtn);
        tr.appendChild(tdName);
        tr.appendChild(tdSugar);
        tr.appendChild(tdPrice);
        tr.appendChild(tdMass);
        tr.appendChild(tdDelete);

        honeyTableBody.appendChild(tr);
    });
}

// Add button
if (honeyAddBtn) {
    honeyAddBtn.addEventListener('click', () => {
        const name = (honeyNameInput.value || '').trim();
        const sugar = parseFloat(honeySugarInput.value);
        const price = parseFloat(honeyPriceInput.value);
        const mass = parseFloat(honeyMassInput.value);

        if (!name || Number.isNaN(sugar) || Number.isNaN(price) || Number.isNaN(mass)) {
            alert('Please fill in name, sugar, price and mass.');
            return;
        }

        honeyDb.push({ name, sugar, price, mass });
        saveHoneyDb();
        renderHoneyTable();
        fillHoneyDropdown();

        honeyNameInput.value = '';
        honeySugarInput.value = '';
        honeyPriceInput.value = '';
        honeyMassInput.value = '';
    });
}

// ----- MEAD RECIPE (Design) -----

const meadVolInput = document.getElementById('mead_volume_l_recipe');
const meadFgInput = document.getElementById('mead_final_gravity_recipe');
const meadAbvInput = document.getElementById('mead_target_abv_recipe');
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

        if (!Number.isFinite(volumeL) || !Number.isFinite(finalGravity) || !Number.isFinite(targetAbv)) {
            meadOut.textContent = 'Please enter valid numbers for volume, FG and ABV.';
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


        const r = calculateMeadRecipe({
            volumeL,
            finalGravity,
            targetAbv,
            sugarConcPct,
            pricePerContainer,
            massPerContainerG,
            yeastNRequirement,
        });

        const fruitUsed = !!meadUseFruit?.checked;
        const fruitType = (meadFruitType?.value || '').trim();

        let text = '';
        text += `Honey type: ${honey.name}\n`;
        text += `Yeast: ${yeast.name} (N Requirement: ${yeastNRequirement})\n`;
        text += `Fruit used: ${fruitUsed ? `Yes${fruitType ? ' - ' + fruitType : ''}` : 'No'}\n\n`;

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


        text += `\n--- Honey for Back-Sweetening ---\n`;
        text += `Back-Sweetening Target FG: ${fmt(finalGravity, 3)}\n`;
        text += `Total pure sugar needed: ${fmt(r.massPureSugarNeededForSweetening, 2)} g\n`;
        text += `Honey Mass Required: ${fmt(r.massHoneyNeededForSweetening, 2)} g\n`;

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

// Load/save
function loadYeastDb() {
    try {
        const saved = localStorage.getItem("yeastDb");
        if (!saved) return defaultYeastDb.slice();

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed) || parsed.length === 0) return defaultYeastDb.slice();

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

        return cleaned.length ? cleaned : defaultYeastDb.slice();
    } catch {
        return defaultYeastDb.slice();
    }
}

let yeastDb = loadYeastDb();

function saveYeastDb() {
    localStorage.setItem("yeastDb", JSON.stringify(yeastDb));
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

        const tdDel = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.className = "delete-btn";
        delBtn.title = "Delete this yeast";

        delBtn.addEventListener("click", () => {
            if (confirm(`Delete "${y.name}"?`)) {
                yeastDb.splice(idx, 1);
                saveYeastDb();
                renderYeastTable();
            }
        });

        tdDel.appendChild(delBtn);


        tr.appendChild(tdName);
        tr.appendChild(tdNReq);
        tr.appendChild(tdWeight);
        tr.appendChild(tdCost);
        tr.appendChild(tdDel);

        yeastTableBody.appendChild(tr);
    });
}

// Add handler
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

        yeastDb.push({ name, nReq, packetWeight, costPerPacket });
        saveYeastDb();
        renderYeastTable();

        // clear inputs
        yeastNameInput.value = "";
        yeastPacketWeightInput.value = "";
        yeastCostInput.value = "";
        yeastNReqInput.value = "Medium";
    });
}

// ----- pH ADJUSTER DATABASE -----

const phTableBody = document.getElementById("ph-adjuster-table-body");
const phNameInput = document.getElementById("ph-name-input");
const phTypeInput = document.getElementById("ph-type-input");
const phHPerMolInput = document.getElementById("ph-hplus-per-mol-input");
const phMolarMassInput = document.getElementById("ph-molar-mass-input");
const phNotesInput = document.getElementById("ph-notes-input");
const phAddBtn = document.getElementById("ph-add-btn");

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

function savePhDb() {
    localStorage.setItem("phAdjusterDb", JSON.stringify(phDb));
}

function loadPhDb() {
    try {
        const raw = localStorage.getItem("phAdjusterDb");
        if (!raw) {
            phDb = defaultPhDb.slice();
            savePhDb();
            return;
        }
        const parsed = JSON.parse(raw);
        phDb = Array.isArray(parsed) ? parsed : defaultPhDb.slice();
    } catch {
        phDb = defaultPhDb.slice();
        savePhDb();
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

        const tdDel = document.createElement("td");
        const btn = document.createElement("button");
        btn.textContent = "✕";
        btn.className = "delete-btn";
        btn.title = "Delete this pH adjuster";
        btn.addEventListener("click", () => {
            phDb.splice(idx, 1);
            savePhDb();
            renderPhTable();
            fillPhDropdown();
        });
        tdDel.appendChild(btn);

        tr.append(tdName, tdType, tdStoich, tdMW, tdNotes, tdDel);
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

        if (!name || !["acid", "base"].includes(type) || !Number.isFinite(hPerMol) || !Number.isFinite(molarMass)) {
            alert("Fill name, type, H+ per mol, and molar mass.");
            return;
        }

        phDb.push({ name, type, hPerMol, molarMass, notes });
        savePhDb();
        renderPhTable();
        fillPhDropdown();

        phNameInput.value = "";
        phHPerMolInput.value = "";
        phMolarMassInput.value = "";
        phNotesInput.value = "";
    });
}

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
    localStorage.setItem(RECIPE_DB_KEY, JSON.stringify(recipeDb));
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

        const tdDel = document.createElement("td");

        // Export THIS recipe
        const exportBtn = document.createElement("button");
        exportBtn.textContent = "⤓";
        exportBtn.className = "export-btn";
        exportBtn.type = "button";
        exportBtn.title = "Export this recipe as PDF";
        exportBtn.addEventListener("click", () => {
            exportSingleRecipeToPdf(r.name || "Recipe", r.text || "");
        });

        // Delete THIS recipe
        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.className = "delete-btn";
        delBtn.title = "Delete this recipe";
        delBtn.type = "button";
        delBtn.addEventListener("click", () => {
            recipeDb.splice(idx, 1);
            saveRecipeDb();
            renderRecipeTable();
        });

        tdDel.appendChild(exportBtn);
        tdDel.appendChild(delBtn);

        tr.appendChild(tdName);
        tr.appendChild(tdText);
        tr.appendChild(tdDel);

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

            saveRecipeDb();
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

            const finalName = name || `Manual recipe (${new Date().toLocaleDateString()})`;

            recipeDb.unshift({
                name: finalName,
                text,
                createdAt: Date.now()
            });

            saveRecipeDb();
            renderRecipeTable();
            closeModal();
        }
    );
});




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