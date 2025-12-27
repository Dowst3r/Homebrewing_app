import { abvHmrc, calculateMeadRecipe } from './meadMath.js';

// ----- THEME HANDLING -----

const body = document.body;
const settingsButton = document.getElementById('theme-toggle');
const darkModeCheckbox = document.getElementById('dark-mode-toggle');

function setTheme(theme) {
    if (theme === 'dark') {
        body.classList.add('theme-dark');
    } else {
        body.classList.remove('theme-dark');
    }
    localStorage.setItem('theme', theme);
    if (darkModeCheckbox) {
        darkModeCheckbox.checked = theme === 'dark';
    }
}

// Load saved theme (or default to light)
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || savedTheme === 'light') {
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
const honeyDensityInput = document.getElementById('honey-density-input');
const honeySugarInput = document.getElementById('honey-sugar-input');
const honeyPriceInput = document.getElementById('honey-price-bottle-input');
const honeyMassInput = document.getElementById('honey-mass-bottle-input')
const honeyAddBtn = document.getElementById('honey-add-btn');

// Default entries
const defaultHoneyDb = [
    { name: 'Runny honey Lidl', density: 1376.4, sugar: 79.7, price: 1.59, mass: 400 },
    { name: 'Clear honey Lidl', density: 1353.5, sugar: 79.7, price: 1.69, mass: 500 },
    { name: 'Generic honey', density: 1400, sugar: 80, price: 1.49, mass: 300 },
    { name: 'Runny honey Rowse', density: 1374.8, sugar: 80.8, price: 5, mass: 720 }
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
                density: Number(x?.density),
                sugar: Number(x?.sugar),
                price: Number(x?.price),
                mass: Number(x?.mass),
            }))
            .filter((x) =>
                x.name &&
                Number.isFinite(x.density) &&
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

        const tdDensity = document.createElement('td');
        tdDensity.textContent = entry.density.toString();

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
        tr.appendChild(tdDensity);
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
        const density = parseFloat(honeyDensityInput.value);
        const sugar = parseFloat(honeySugarInput.value);
        const price = parseFloat(honeyPriceInput.value);
        const mass = parseFloat(honeyMassInput.value);

        if (!name || Number.isNaN(density) || Number.isNaN(sugar) || Number.isNaN(price) || Number.isNaN(mass)) {
            alert('Please fill in name, density, sugar, price and mass.');
            return;
        }

        honeyDb.push({ name, density, sugar, price, mass });
        saveHoneyDb();
        renderHoneyTable();
        fillHoneyDropdown();

        honeyNameInput.value = '';
        honeyDensityInput.value = '';
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
        const densityKgPerM3 = Number(honey.density);

        // Convert bottle cost -> £ per 100 g (this is what your Python uses as cost_per_100g)
        const costPer100g = (Number(honey.price) * 100) / Number(honey.mass);

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
            densityKgPerM3,
            costPer100g,
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
        text += `Estimated cost: ${money(r.cost)}\n`;
        text += `Volume of water to add: ${fmt(r.waterVolumeL, 2)} L\n`;

        if (r.fermaidOGramsTotal != null && Number.isFinite(r.fermaidOGramsPerDay)) {
            text += `\n--- Fermaid-O Nutrient Addition ---\n`;
            text += `Fermaid-O Required: ${fmt(r.fermaidOGramsPerDay, 2)} g on day 0\n`;
            text += `Fermaid-O Required: ${fmt(r.fermaidOGramsPerDay, 2)} g on day 1\n`;
            text += `Fermaid-O Required: ${fmt(r.fermaidOGramsPerDay, 2)} g on day 2\n`;
            text += `Fermaid-O Required: ${fmt(r.fermaidOGramsPerDay, 2)} g on day 3\n`;
            text += `This is all the nutrient that is required!\n`;
        } else {
            text += `\n(Fermaid-O calculation disabled when ABV > 14%)\n`;
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

// Initial render (safe even if screen isn't visible yet)
renderYeastTable();

// Render on load
renderHoneyTable();
fillHoneyDropdown();
fillYeastDropdown();