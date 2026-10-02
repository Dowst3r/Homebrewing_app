const DATA_KEYS = ["honeyDb", "yeastDb", "phAdjusterDb", "recipeDb_v1", "customPalettes", "theme"];
const status = document.getElementById("backup-status");
const report = message => { status.textContent = message; };
const object = x => x !== null && typeof x === "object" && !Array.isArray(x);
const named = x => object(x) && typeof x.name === "string" && x.name.trim().length > 0;
const number = (x, min, max = Infinity) => typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
const rgb = x => Array.isArray(x) && x.length === 3 && x.every(c => Number.isInteger(c) && c >= 0 && c <= 255);
const timestamp = x => x === undefined || number(x, 0);
const validators = {
    honeyDb: x => Array.isArray(x) && x.every(r => named(r) && number(r.sugar, 0, 100) && number(r.price, 0) && number(r.mass, Number.MIN_VALUE)),
    yeastDb: x => Array.isArray(x) && x.every(r => named(r) && ["Low", "Medium", "High"].includes(r.nReq) && number(r.packetWeight, Number.MIN_VALUE) && number(r.costPerPacket, 0)),
    phAdjusterDb: x => Array.isArray(x) && x.every(r => named(r) && ["acid", "base"].includes(r.type) && number(r.hPerMol, Number.MIN_VALUE) && number(r.molarMass, Number.MIN_VALUE) && (r.notes === undefined || typeof r.notes === "string")),
    recipeDb_v1: x => Array.isArray(x) && x.every(r => named(r) && typeof r.text === "string" && r.text.trim().length > 0 && timestamp(r.createdAt) && timestamp(r.updatedAt)),
    customPalettes: x => Array.isArray(x) && x.length === 2 && x.every(p => named(p) && p.name.trim().length <= 40 && ["background", "surface", "text", "accent", "accentText", "border"].every(k => rgb(p[k]))),
    theme: x => ["light", "dark", "pink", "custom-1", "custom-2"].includes(x)
};

function validate(data) {
    if (!object(data)) throw new Error("Missing backup data.");
    for (const key of DATA_KEYS) {
        if (!Object.hasOwn(data, key) || (data[key] !== null && !validators[key](data[key]))) {
            throw new Error(`Invalid or missing ${key}. Nothing was restored.`);
        }
    }
}

function snapshot() {
    return Object.fromEntries(DATA_KEYS.map(key => {
        const raw = localStorage.getItem(key);
        return [key, raw === null ? null : key === "theme" ? raw : JSON.parse(raw)];
    }));
}

document.getElementById("backup-export-btn").addEventListener("click", () => {
    try {
        const data = snapshot();
        validate(data);
        const backup = { format: "mead-helper-backup", schemaVersion: 1, appVersion: "2.0.0", exportedAt: new Date().toISOString(), data };
        const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `mead-helper-backup-${backup.exportedAt.slice(0, 10)}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        report("Backup download requested. Keep the JSON file somewhere safe.");
    } catch (error) { report(`Backup failed: ${error.message}`); }
});

document.getElementById("backup-import-file").addEventListener("change", async event => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
        const backup = JSON.parse(await file.text());
        if (backup?.format !== "mead-helper-backup" || backup.schemaVersion !== 1) {
            throw new Error("This is not a supported Mead Helper backup.");
        }
        validate(backup.data);
        if (!confirm("Restore this backup? It replaces your saved databases, recipes, palettes and theme. Unsaved forms will be lost when the app reloads.")) return;
        const previous = Object.fromEntries(DATA_KEYS.map(key => [key, localStorage.getItem(key)]));
        const attempted = [];
        try {
            for (const key of DATA_KEYS) {
                attempted.push(key);
                const value = backup.data[key];
                if (value === null) localStorage.removeItem(key);
                else localStorage.setItem(key, key === "theme" ? value : JSON.stringify(value));
            }
        } catch (error) {
            try {
                for (const key of attempted) localStorage.removeItem(key);
                for (const key of attempted) {
                    if (previous[key] !== null) localStorage.setItem(key, previous[key]);
                }
            } catch {
                throw new Error("Restore and rollback failed. Keep this backup and avoid making more changes until storage is available.");
            }
            throw new Error("Restore failed; previous saved data was restored. Browser storage may be full or unavailable.");
        }
        window.location.reload();
    } catch (error) { report(`Import failed: ${error.message}`); }
    finally { input.value = ""; }
});