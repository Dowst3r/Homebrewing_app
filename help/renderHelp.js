import { helpSections } from "./helpContent.js";

function imageHtml(section) {
    if (!section.image) return "";

    return `
        <img
            class="help-image"
            src="${section.image}"
            alt="${section.title} screenshot"
            loading="lazy"
        >
    `;
}

export function renderHelp({ contentEl, tocEl } = {}) {
    if (tocEl) {
        tocEl.innerHTML = helpSections.map(section => `
            <button type="button" data-help-target="${section.id}">
                ${section.title}
            </button>
        `).join("");

        tocEl.querySelectorAll("[data-help-target]").forEach((button) => {
            button.addEventListener("click", () => {
                const target = document.getElementById(button.dataset.helpTarget);
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
    }

    if (contentEl) {
        contentEl.innerHTML = helpSections.map(section => `
            <article class="help-card" id="${section.id}">
                <h3>${section.title}</h3>
                ${imageHtml(section)}
                <div class="help-body">
                    ${section.bodyHtml}
                </div>
            </article>
        `).join("");
    }
}