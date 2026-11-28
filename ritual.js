/* Spirit Compatibility Ritual — the order form behind "Name your ghost".
   The wording lives in `questions` below; change the strings there. */
(() => {
  "use strict";
  const dialog = document.getElementById("ga-ritual");
  if (!dialog) return;
  const content = dialog.querySelector("#ga-content");
  const opener = document.getElementById("brief-open");
  const GIFT = "Into the unknown (it’s a gift!)";
  const questions = [
    { id: "habitat", label: "Habitat", q: "Where would your little spirit accompany you?", options: ["On everyday adventures", "Beside me while I create", "In my little sanctuary", GIFT] },
    { id: "resonance", label: "Resonance", q: "What feeling would you like your spirit to embody?", options: ["Comfort and tenderness", "Curiosity and wonder", "Courage and independence", "Playfulness and mischief"] },
    { id: "chroma", label: "Chromatic signal", q: "Which little universe calls to you?", options: ["Dreamy Angelcore", "Ghost Tech", "Angel Rave", "Kawaii Noir", "Surprise me"] },
    { id: "relic", label: "Relic", q: "Which treasure would you rescue from another world?", options: ["A locket containing a forgotten memory", "A fragment of an unfamiliar moon", "A cassette recording an unknown frequency", "A flower that never wilts"] },
    { id: "frequency", label: "Frequency", q: "What does your imaginary world sound like?", options: ["A beautiful dream I almost remember", "A secret transmission from the future", "A night I wish would never end", "A moon illuminating the ocean"] }
  ];
  const palettes = [["#ffd0e6", "#fff1ca", "#d9f5e7", "#dfd0ff"], ["#151b23", "#b6f847", "#6274ad", "#b4c7cf"], ["#ff8dce", "#b3a1ff", "#72ebec", "#fcf594"], ["#1b1424", "#65436d", "#d694bc", "#c8c0ce"], ["#e5bada", "#91b7c7", "#e7dcad", "#b6a0df"]];
  // Where the finished transmission goes: the booking link set in collection.js.
  const bookingUrl = (() => {
    const raw = window.MOTE_ARCHIVE?.offer?.bookingUrl;
    if (!raw) return "";
    try {
      const url = new URL(raw);
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  })();
  // Where a finished transmission is kept, so it is never lost on the way to an order.
  // Set ritualApi in collection.js to the Worker's address; empty means nothing is saved anywhere.
  const ritualApi = (() => {
    const raw = window.MOTE_ARCHIVE?.offer?.ritualApi;
    if (!raw) return "";
    try {
      const url = new URL(raw);
      return url.protocol === "https:" ? url.origin + url.pathname.replace(/\/+$/, "") : "";
    } catch { return ""; }
  })();
  let step = -1, answers = Array(questions.length).fill(null), whisper = "", avoid = "", buyerName = "", giftFrom = "", giftAbout = "", closing = false, returnFocus = null, pageY = 0;
  let sharePublic = false, savedCode = "", saving = false;
  // The page behind the glass is part of the look: lift it to the opening scene when the ritual
  // opens, and put the customer back where they were when it closes.
  const glide = (top) => {
    const root = document.documentElement;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const prev = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, top);
      root.style.scrollBehavior = prev;
    } else window.scrollTo({ top, behavior: "smooth" });
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const btn = (action, label, kind = "secondary", extra = "") => `<button type="button" data-ga-action="${action}" class="ga-${kind}" ${extra}>${label}</button>`;
  const heading = (s) => `<h2 id="ga-heading" tabindex="-1">${s}</h2>`;
  const isGift = () => answers[0] === GIFT;
  // The gift answer adds one optional step, so the flow (and its progress bar) is built each render.
  const flow = () => [...questions.map((q) => q.id), ...(isGift() ? ["recipient"] : []), "whisper", "done"];
  const total = () => flow().length - 1;
  const questionAt = (key) => questions.find((q) => q.id === key);
  const progress = () => `<div class="ga-progress" role="progressbar" aria-label="Ritual progress" aria-valuemin="0" aria-valuemax="${total()}" aria-valuenow="${step + 1}">${Array.from({ length: total() }, (_, i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>`;
  const codeLine = (code) => `Your code: <b>${esc(code)}</b>. If your message doesn’t reach me, this is how I’ll find your ritual.`;
  const shareChoice = () => `<label class="ga-share"><input type="checkbox" id="ga-share"${sharePublic ? " checked" : ""}><span>Share my answers on the wall of spirits</span></label><p class="ga-small ga-share-note">Your five answers, and nothing else. Leave this unticked and nothing is shared at all — staying private is the default.</p><p class="ga-small ga-share-note">We never publish anything from Ko-fi: the wall shows only the five ritual answers, never the buyer’s name, email, message or amount.${isGift() ? " This is a gift, so who it is for and what you told me about them stay private as well — they never appear on the wall." : ""}</p>`;
  // A quiet copy for the artist. Every failure here is silent: the ritual already
  // works without it, so a stray network problem must never interrupt the hand-off.
  async function saveRitual() {
    if (!ritualApi || saving || savedCode) return savedCode;
    saving = true;
    try {
      const chroma = questions.findIndex((q) => q.id === "chroma");
      const picked = questions[chroma].options.indexOf(answers[chroma]);
      const response = await fetch(ritualApi + "/ritual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((q, i) => ({ label: q.label, value: answers[i] ?? "" })),
          palette: picked >= 0 ? palettes[picked] : [],
          gift: isGift(),
          giftFor: isGift() ? giftFrom : "",
          giftAbout: isGift() ? giftAbout : "",
          whisper,
          avoid,
          name: buyerName.trim(),
          isPublic: sharePublic
        })
      });
      if (!response.ok) return "";
      const data = await response.json();
      return typeof data.code === "string" ? data.code : "";
    } catch {
      return "";
    } finally {
      saving = false;
    }
  }
  function render(focus = true) {
    if (step > 0) step = Math.min(step, flow().length - 1);
    const key = flow()[step];
    const q = questionAt(key);
    content.classList.remove("ga-content");
    void content.offsetWidth;
    content.classList.add("ga-content");
    if (step === -1) content.innerHTML = `<div class="ga-center"><div class="ga-sigil" aria-hidden="true">✧</div><div class="ga-eyebrow">Spirit compatibility / transmission 001</div>${heading("Somewhere, a spirit is listening.")}<p>Leave behind a few fragments of your universe. They will guide the creation of a little companion unlike any other.</p>${btn("next", "Begin the ritual", "primary", 'style="width:100%"')}<p class="ga-small" style="margin-top:12px">Five questions · One little mystery</p></div>`;
    else if (q) {
      const picked = answers[questions.indexOf(q)];
      content.innerHTML = `${progress()}<div class="ga-eyebrow">0${step + 1} / 0${total()} — ${q.label}</div>${heading(q.q)}<div class="ga-options" role="group" aria-label="${esc(q.q)}">${q.options.map((o, i) => `<button type="button" class="ga-choice" data-ga-choice="${i}" aria-pressed="${picked === o}"><span>${q.id === "chroma" ? `<span class="ga-swatch" aria-hidden="true">${palettes[i].map((c) => `<i style="background:${c}"></i>`).join("")}</span>` : ""}${esc(o)}</span><span class="ga-mark" aria-hidden="true">${picked === o ? "✧" : "○"}</span></button>`).join("")}</div>${q.id === "habitat" && isGift() ? `<p class="ga-gift-note" role="status">A gift — lovely. There’ll be one optional question about them, near the end.</p>` : ""}<div class="ga-actions">${btn("back", "Back")}${btn("next", "Continue →", "primary", picked === null ? "disabled" : "")}</div>`;
    } else if (key === "recipient") content.innerHTML = `${progress()}<div class="ga-eyebrow">Optional / the recipient</div>${heading("Who is this little spirit for?")}<p>Leave it blank if you would rather keep the surprise. Only you will see this.</p><label for="ga-gift-from">Their name or nickname</label><input id="ga-gift-from" maxlength="120" value="${esc(giftFrom)}" placeholder="Optional"><label for="ga-gift-about">A little about them</label><textarea id="ga-gift-about" maxlength="600" placeholder="What they love, what makes them smile, a private joke…">${esc(giftAbout)}</textarea><div class="ga-actions">${btn("back", "Back")}${btn("next", "Continue →", "primary")}</div>`;
    else if (key === "whisper") content.innerHTML = `${progress()}<div class="ga-eyebrow">Optional / final whisper</div>${heading("Is there anything else the spirit should know?")}<p>A favorite symbol, a little obsession, or something that makes you smile.</p><label for="ga-whisper">A fragment of your universe</label><textarea id="ga-whisper" maxlength="1000" placeholder="Leave a little whisper...">${esc(whisper)}</textarea><label for="ga-avoid">Colors or materials to avoid</label><input id="ga-avoid" maxlength="300" value="${esc(avoid)}" placeholder="Optional"><label for="ga-name">Your name</label><input id="ga-name" maxlength="80" value="${esc(buyerName)}" placeholder="Optional"><p class="ga-small" style="margin-top:8px">Your name stays private — it never appears on the wall, even if you share your answers.</p><p class="ga-small" style="margin-top:12px">Share only what you feel comfortable sharing. Your answers inspire the design; they are not exact customization instructions.</p><div class="ga-actions">${btn("back", "Back")}${btn("next", "Complete transmission", "primary")}</div>`;
    else content.innerHTML = `<div class="ga-center"><div class="ga-sigil" aria-hidden="true">✧</div><div class="ga-eyebrow">Transmission complete${isGift() ? " / a gift, still secret" : ""}</div>${heading(isGift() ? "A little spirit is on its way." : "A little spirit awaits.")}<p>${isGift() ? "Somewhere, someone has no idea that a little spirit is about to enter their life." : "Its name, face and story remain a beautiful mystery."}</p>${isGift() ? '<p class="ga-small">Its name, face and story remain a beautiful mystery.</p>' : ""}</div><dl class="ga-summary">${questions.map((qq, i) => `<div><dt>${qq.label}</dt><dd>${esc(answers[i] || "")}</dd></div>`).join("")}${isGift() ? `<div><dt>Gift for</dt><dd>${esc(giftFrom.trim() || "Just a surprise")}</dd></div>${giftAbout.trim() ? `<div><dt>About them</dt><dd>${esc(giftAbout)}</dd></div>` : ""}` : ""}${whisper ? `<div><dt>Whisper</dt><dd>${esc(whisper)}</dd></div>` : ""}${avoid ? `<div><dt>Avoid</dt><dd>${esc(avoid)}</dd></div>` : ""}${buyerName.trim() ? `<div><dt>Name</dt><dd>${esc(buyerName.trim())}</dd></div>` : ""}</dl>${ritualApi ? shareChoice() : ""}<div class="ga-actions">${bookingUrl ? btn("kofi", "Continue to Ko-fi →", "primary", 'style="flex:1 1 100%"') : ""}</div><p class="ga-status" role="status">${savedCode ? codeLine(savedCode) : ""}</p><p class="ga-small">${bookingUrl ? "Your answers are already saved here, so there is nothing to paste when you order." : "Keep a copy for when ordering opens."}</p>${btn("edit", "Revisit my answers", "secondary", 'style="width:100%"')}`;
    if (focus) content.querySelector("h2").focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }
  function open(trigger) {
    returnFocus = trigger || opener;
    pageY = window.scrollY;
    const menu = document.getElementById("menu-toggle");
    if (document.body.classList.contains("menu-open")) {
      document.body.classList.remove("menu-open");
      if (menu) { menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-label", "Open navigation"); }
    }
    render(false);
    dialog.showModal();
    glide(0);
    content.querySelector("h2").focus({ preventScroll: true });
  }
  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.classList.add("ga-closing");
    const done = () => {
      dialog.close();
      dialog.classList.remove("ga-closing");
      closing = false;
      (returnFocus && returnFocus.isConnected ? returnFocus : opener)?.focus({ preventScroll: true });
      if (pageY) glide(pageY);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done();
    else setTimeout(done, 220);
  }
  opener?.addEventListener("click", (event) => { event.preventDefault(); open(event.currentTarget); });
  // Any other invitation to the ritual, such as the one at the end of the wall of spirits.
  for (const trigger of document.querySelectorAll("[data-open-ritual]")) {
    trigger.addEventListener("click", (event) => { event.preventDefault(); open(trigger); });
  }
  dialog.querySelector(".ga-close").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  dialog.addEventListener("pointermove", (event) => {
    const box = dialog.getBoundingClientRect();
    dialog.style.setProperty("--mx", ((event.clientX - box.left) / box.width * 100) + "%");
    dialog.style.setProperty("--my", ((event.clientY - box.top) / box.height * 100) + "%");
  });
  content.addEventListener("input", (event) => {
    if (event.target.id === "ga-whisper") whisper = event.target.value;
    if (event.target.id === "ga-avoid") avoid = event.target.value;
    if (event.target.id === "ga-name") buyerName = event.target.value;
    if (event.target.id === "ga-gift-from") giftFrom = event.target.value;
    if (event.target.id === "ga-gift-about") giftAbout = event.target.value;
    if (event.target.id === "ga-share") sharePublic = event.target.checked;
  });
  content.addEventListener("click", async (event) => {
    const choice = event.target.closest("[data-ga-choice]");
    const key = flow()[step];
    const q = questionAt(key);
    if (choice && q) {
      const i = questions.indexOf(q);
      answers[i] = q.options[Number(choice.dataset.gaChoice)];
      content.querySelectorAll(".ga-choice").forEach((b) => {
        const yes = b === choice;
        b.setAttribute("aria-pressed", String(yes));
        b.querySelector(".ga-mark").textContent = yes ? "✧" : "○";
      });
      content.querySelector("[data-ga-action=next]").disabled = false;
      // The gift answer reveals its extra step immediately, so the note appears without leaving the question.
      if (i === 0) {
        const note = content.querySelector(".ga-gift-note");
        if (isGift() && !note) {
          const p = document.createElement("p");
          p.className = "ga-gift-note";
          p.setAttribute("role", "status");
          p.textContent = "A gift — lovely. There’ll be one optional question about them, near the end.";
          content.querySelector(".ga-actions").before(p);
        } else if (!isGift() && note) note.remove();
      }
      return;
    }
    const b = event.target.closest("[data-ga-action]");
    if (!b) return;
    const action = b.dataset.gaAction;
    if (action === "next") {
      if (q && answers[questions.indexOf(q)] === null) return;
      step++;
      render();
    } else if (action === "back") {
      step--;
      render();
    } else if (action === "edit") {
      step = 0;
      render();
    } else if (action === "kofi") {
      // The tab is opened inside the click so the browser allows it. Nothing goes to the clipboard
      // any more: the answers are already kept, so the buyer has nothing to paste.
      const win = window.open(bookingUrl, "_blank");
      if (win) win.opener = null;
      const status = content.querySelector(".ga-status");
      status.textContent = win
        ? "Ko-fi opened in a new tab."
        : "Your browser blocked the new tab. Open " + bookingUrl + " to reach the shop.";
      // Saved whatever happened above: a blocked tab must not cost the buyer their code.
      const code = await saveRitual();
      if (code) {
        savedCode = code;
        const line = document.createElement("span");
        line.className = "ga-code";
        line.innerHTML = codeLine(code);
        status.append(line);
      } else {
        status.append(" (Your answers could not be saved just now.)");
      }
    }
  });
  render(false);
  // A link straight to the form, e.g. from a post or an old bookmark.
  if (location.hash === "#order") open(opener);
})();
