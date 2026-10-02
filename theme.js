// Proposed NEW application module. Add it to the service-worker precache list.
const PALETTE_KEY = 'customPalettes';
const THEME_KEY = 'theme';
const ROLES = {
    background: ['Background', '--bg'],
    surface: ['Panels and inputs', '--bg-card'],
    text: ['Text', '--text'],
    accent: ['Action buttons and charts', '--accent'],
    accentText: ['Text on action buttons', '--accent-text'],
    border: ['Borders', '--border'],
};
const THEMES = ['light', 'dark', 'pink', 'custom-1', 'custom-2'];
const DEFAULT_PALETTES = [
    {
        name: 'Custom 1', background: [255, 255, 255], surface: [243, 244, 246],
        text: [10, 10, 10], accent: [22, 163, 74], accentText: [255, 255, 255],
        border: [200, 205, 212],
    },
    {
        name: 'Custom 2', background: [0, 0, 0], surface: [0, 0, 0],
        text: [249, 250, 251], accent: [34, 197, 94], accentText: [2, 44, 34],
        border: [65, 65, 65],
    },
];

// Also usable by the JSON backup validator before replacing saved data.
export function normalizeCustomPalettes(value) {
    if (!Array.isArray(value) || value.length !== 2) {
        throw new Error('A palette file must contain exactly two palettes.');
    }
    return value.map(palette => {
        if (!palette || typeof palette !== 'object' ||
            typeof palette.name !== 'string' || !palette.name.trim() ||
            palette.name.trim().length > 40) {
            throw new Error('Each palette needs a name of 1–40 characters.');
        }
        const clean = { name: palette.name.trim() };
        for (const role of Object.keys(ROLES)) {
            const rgb = palette[role];
            if (!Array.isArray(rgb) || rgb.length !== 3 ||
                !rgb.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255)) {
                throw new Error('Every RGB value must contain three whole numbers from 0 to 255.');
            }
            clean[role] = [...rgb];
        }
        return clean;
    });
}

function rgbToHex(rgb) {
    return '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join('');
}

function luminance(rgb) {
    const channels = rgb.map(channel => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function initThemeSettings() {
    const themeSelect = document.getElementById('theme-select');
    const slotSelect = document.getElementById('palette-slot');
    const nameInput = document.getElementById('palette-name');
    const fieldsContainer = document.getElementById('palette-fields');
    const form = document.getElementById('palette-form');
    const status = document.getElementById('palette-status');
    const body = document.body;
    let palettes = normalizeCustomPalettes(DEFAULT_PALETTES);
    let theme = 'light';
    let loadMessage = '';

    try {
        const raw = localStorage.getItem(PALETTE_KEY);
        if (raw !== null) palettes = normalizeCustomPalettes(JSON.parse(raw));
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (THEMES.includes(savedTheme)) theme = savedTheme;
    } catch {
        loadMessage = 'Saved settings could not be read. Default colours are active; stored data has not been replaced.';
    }

    const fields = {};
    for (const [role, [label]] of Object.entries(ROLES)) {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'palette-field';
        const legend = document.createElement('legend');
        legend.textContent = label;
        const row = document.createElement('div');
        row.className = 'palette-rgb';
        fields[role] = ['R', 'G', 'B'].map(channel => {
            const channelLabel = document.createElement('label');
            channelLabel.textContent = channel;
            const input = document.createElement('input');
            input.type = 'number';
            input.inputMode = 'numeric';
            input.min = '0';
            input.max = '255';
            input.step = '1';
            input.required = true;
            input.setAttribute('aria-label', `${label}: ${channel}`);
            channelLabel.append(input);
            row.append(channelLabel);
            return input;
        });
        fieldset.append(legend, row);
        fieldsContainer.append(fieldset);
    }

    function updateNames() {
        palettes.forEach((palette, index) => {
            themeSelect.querySelector(`option[value="custom-${index + 1}"]`).textContent = palette.name;
        });
    }

    function loadEditor() {
        const palette = palettes[Number(slotSelect.value)];
        nameInput.value = palette.name;
        for (const role of Object.keys(ROLES)) {
            fields[role].forEach((input, index) => { input.value = palette[role][index]; });
        }
    }

    function applyTheme(nextTheme, persist = true) {
        theme = THEMES.includes(nextTheme) ? nextTheme : 'light';
        let saved = true;
        if (persist) {
            try { localStorage.setItem(THEME_KEY, theme); }
            catch {
                saved = false;
                status.textContent = 'These colours are active for this session, but the browser could not save the selected theme.';
            }
        }

        body.classList.remove('theme-dark', 'theme-pink', 'theme-custom');
        const customProperties = [
            ...Object.values(ROLES).map(([, property]) => property),
            '--home-btn-bg', '--home-btn-bg-soft', '--control-bg', '--chart-accent', '--gear-filter',
        ];
        customProperties.forEach(property => body.style.removeProperty(property));

        let nativeDark = theme === 'dark';
        if (theme.startsWith('custom-')) {
            const palette = palettes[Number(theme.slice(-1)) - 1];
            body.classList.add('theme-custom');
            for (const [role, [, property]] of Object.entries(ROLES)) {
                body.style.setProperty(property, rgbToHex(palette[role]));
            }
            ['--home-btn-bg', '--home-btn-bg-soft', '--control-bg'].forEach(property => {
                body.style.setProperty(property, rgbToHex(palette.surface));
            });
            body.style.setProperty('--chart-accent', rgbToHex(palette.accent));
            body.style.setProperty(
                '--gear-filter',
                luminance(palette.background) < 0.18 ? 'invert(1)' : 'none'
            );
            nativeDark = luminance(palette.background) < 0.18;
        } else if (theme !== 'light') {
            body.classList.add(`theme-${theme}`);
        }

        body.style.colorScheme = nativeDark ? 'dark' : 'light';
        themeSelect.value = theme;
        const background = getComputedStyle(body).getPropertyValue('--bg').trim();
        document.documentElement.style.backgroundColor = background;
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) themeMeta.content = background;
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
        return saved;
    }

    themeSelect.addEventListener('change', () => {
        status.textContent = '';
        applyTheme(themeSelect.value);
    });
    slotSelect.addEventListener('change', loadEditor);
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        try {
            const slot = Number(slotSelect.value);
            const edited = { name: nameInput.value.trim() };
            for (const role of Object.keys(ROLES)) {
                edited[role] = fields[role].map(input => Number(input.value));
            }
            const next = palettes.map((palette, index) => index === slot ? edited : palette);
            const validated = normalizeCustomPalettes(next);
            localStorage.setItem(PALETTE_KEY, JSON.stringify(validated));
            palettes = validated;
            updateNames();
            if (applyTheme(`custom-${slot + 1}`)) {
                status.textContent = `${palettes[slot].name} saved and applied.`;
            }
        } catch (error) {
            status.textContent = `Palette could not be saved: ${error.message}`;
        }
    });

    updateNames();
    loadEditor();
    applyTheme(theme, false);
    if (loadMessage) status.textContent = loadMessage;
}