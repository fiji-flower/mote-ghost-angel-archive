/* The wall of spirits: transmissions people chose to share, read from the archive Worker.
   The section stays hidden when nothing is configured or nothing has been shared yet. */
(() => {
  "use strict";
  const section = document.getElementById("ghosts");
  const grid = document.getElementById("ghost-wall-grid");
  const count = document.getElementById("ghost-wall-count");
  if (!section || !grid) return;
  const raw = window.MOTE_ARCHIVE?.offer?.ritualApi;
  let base = "";
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") base = url.origin + url.pathname.replace(/\/+$/, "");
  } catch { return; }
  if (!base) return;

  const limit = Math.max(1, Math.min(12, Number(window.MOTE_ARCHIVE?.offer?.wallLimit) || 9));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hex = (c) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : "");
  const fact = (answers, label) => {
    const found = answers.find((a) => a && a.label === label);
    return found && typeof found.value === "string" ? found.value.trim() : "";
  };
  const when = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  function card(item) {
    const answers = Array.isArray(item.answers) ? item.answers : [];
    const palette = (Array.isArray(item.palette) ? item.palette : []).map(hex).filter(Boolean);
    const rows = [
      ["Habitat", fact(answers, "Habitat")],
      ["Universe", fact(answers, "Chromatic signal")],
      ["Relic", fact(answers, "Relic")],
      ["Frequency", fact(answers, "Frequency")]
    ].filter((row) => row[1]);
    if (!rows.length) return "";
    const resonance = fact(answers, "Resonance");
    return '<article class="ghost-card">' +
      `<div class="ghost-card-swatches" aria-hidden="true">${palette.map((c) => `<i style="background:${c}"></i>`).join("")}</div>` +
      (resonance ? `<p class="ghost-card-resonance">${esc(resonance)}</p>` : "") +
      `<dl class="ghost-card-facts">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` +
      `<span class="ghost-card-date">${esc(when(item.createdAt))}</span>` +
      '</article>';
  }

  fetch(base + "/public")
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const items = Array.isArray(data?.items) ? data.items.slice(0, limit) : [];
      const cards = items.map(card).filter(Boolean);
      if (!cards.length) return;
      grid.innerHTML = cards.join("");
      if (count) count.textContent = cards.length === 1 ? "One spirit so far" : cards.length + " spirits so far";
      section.hidden = false;
    })
    .catch(() => { /* the wall simply stays away */ });
})();
