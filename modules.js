/* One entry per module. Card status = the Roadmap stop with the same data-module (index.html); no status here. */
const MODULES = [
  { key: "core", name: "Core", by: "Dimi-GE", icon: "◎", tag: "Required",
    text: "Shared base: reads the game, gives module windows the game's look, small public API.",
    nexus: "https://www.nexusmods.com/infectionfreezone/mods/110" },
  { key: "settlement-panel", name: "Settlement Panel", by: "Dimi-GE", icon: "▦",
    text: "In-game panel (F8): production by building, balance per resource.",
    nexus: "https://www.nexusmods.com/infectionfreezone/mods/111" },
  { key: "supply-lines", name: "Supply Lines", by: "Dimi-GE", icon: "⇢",
    text: "Old settlements keep producing; their surplus arrives at every sunrise.",
    nexus: "https://www.nexusmods.com/infectionfreezone/mods/112" },
  { name: "New module", by: "anyone", icon: "+", open: true,
    text: "Open slot for a module built on the Core API. A module stays its author's: listed here with details, or a link to the author's own site." }
];
// Shown only for a module without a `nexus` link yet.
const DOWNLOAD_NOTE = "Downloads: on Nexus Mods once published.";

const esc = v => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// The module's public text (generated into module-texts.js): lede + sections + download note.
function moduleTextHtml(key) {
  const t = typeof MODULE_TEXT === "object" && MODULE_TEXT[key];
  if (!t) return '<p class="note">Text not available.</p>';
  const url = (MODULES.find(m => m.key === key) || {}).nexus;
  const dl = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Download on Nexus Mods →</a>` : DOWNLOAD_NOTE;
  return `<p class="lede">${esc(t.short)}</p>${t.html}<p class="pop-site">${dl}</p>`;
}

// Module pages: fill the text; ?shot = diagram only (CSS .shot-only).
document.querySelectorAll("[data-module-text]").forEach(el => { el.innerHTML = moduleTextHtml(el.dataset.moduleText); });
if (/[?&]shot\b/.test(location.search)) document.body.classList.add("shot-only");
