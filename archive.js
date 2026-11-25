(() => {
  "use strict";
  const { artist, series, entries, offer } = window.MOTE_ARCHIVE;
  const $ = (id) => document.getElementById(id);
  const price = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(offer.priceUSD) ? 0 : 2
  }).format(offer.priceUSD);
  const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = (n) => numberWords[n] || String(n);
  const openSlots = offer.slots.filter((status) => status === "available").length;
  const pixelSize = (dimensions) => dimensions.map((n) => n.toLocaleString("en-US")).join(" × ");
  const displayHours = word(offer.maxIllustrationHours) + (offer.maxIllustrationHours === 1 ? " hour" : " hours");
  const icon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(svg.namespaceURI, "use");
    use.setAttribute("href", "#i-" + name);
    svg.append(use);
    return svg;
  };
  const el = (tag, className, text = "") => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  for (const node of document.querySelectorAll("[data-artist]")) node.textContent = artist;
  for (const node of document.querySelectorAll("[data-series]")) node.textContent = series;
  for (const node of document.querySelectorAll(".price-text")) node.textContent = price;
  $("time-limit").textContent = displayHours + " per order";
  $("portrait-size").textContent = pixelSize(offer.portraitPixels);
  $("card-size").textContent = pixelSize(offer.cardPixels);
  const qty = offer.slots.length;
  const slotWord = qty === 1 ? "slot" : "slots";
  $("slots-title").textContent = word(qty).replace(/^./, (letter) => letter.toUpperCase()) + " commission " + slotWord;

  function configuredContact() {
    if (offer.bookingUrl) {
      try {
        const url = new URL(offer.bookingUrl);
        if (url.protocol === "https:") return { type: "link", url: url.href };
      } catch { /* A missing or incomplete URL leaves bookings in preview. */ }
    }
    if (/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(offer.artistEmail)) {
      return { type: "email", address: offer.artistEmail };
    }
    return null;
  }
  const contact = configuredContact();
  const canInquire = openSlots > 0 && contact;
  $("header-slots").textContent = openSlots ? (contact ? openSlots + " " + (openSlots === 1 ? "slot open" : "slots open") : "First drop · " + qty + " " + slotWord) : "Drop fully claimed";
  offer.slots.forEach((status, i) => {
    const available = status === "available";
    const label = available ? (contact ? "Open" : "Planned") : "Claimed";
    const slot = el("span", "slot" + (available ? " available" : ""), "Slot " + String(i + 1).padStart(2, "0") + " · " + label);
    $("slots").append(slot);
  });
  if (canInquire) {
    $("brief-open").querySelector("span").textContent = "Request a commission";
    $("booking-note").textContent = artist + " confirms availability and timing before you pay.";
    $("brief-intro").textContent = "Choose a palette and one personal motif. Save your brief, then send it to " + artist + " to ask about a slot.";
  } else if (!openSlots) {
    $("booking-note").textContent = "Every slot in this release has been claimed. You can save a brief for a future opening.";
    $("brief-intro").textContent = "This release is full. Save a palette and a personal motif for the next opening.";
  }

  const entryDialog = $("entry-dialog");
  const briefDialog = $("brief-dialog");
  const menu = $("menu-toggle");
  function closeMenu() {
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Open navigation");
    document.body.classList.remove("menu-open");
  }
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    document.body.classList.toggle("menu-open", open);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("menu-open")) {
      closeMenu();
      menu.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (document.body.classList.contains("menu-open") && !event.target.closest(".rail")) closeMenu();
  });
  document.querySelectorAll(".rail-nav a, .rail-top a").forEach((link) => link.addEventListener("click", closeMenu));
  let scrollQueued = false;
  function markSection() {
    scrollQueued = false;
    const offerBounds = $("commissions").getBoundingClientRect();
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const onOffer = offerBounds.top < window.innerHeight * 0.45 || atBottom;
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === (onOffer ? "commissions" : "collection")) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  window.addEventListener("scroll", () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(markSection); }
  }, { passive: true });

  let activeEntries = entries.slice();
  let readEntries = entries;
  let viewed = 0;
  let shown = 0;
  let observer = null;
  let dialogTrigger = null;
  const batchSize = 6;
  const loadMore = $("load-more");
  const gallery = $("gallery");
  const filters = $("filters");

  function openDialog(dialog, trigger) {
    closeMenu();
    dialogTrigger = trigger;
    dialog.showModal();
    dialog.querySelector(".close-modal").focus({ preventScroll: true });
  }
  for (const dialog of [entryDialog, briefDialog]) {
    dialog.querySelector(".close-modal").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => {
      const returnTo = dialogTrigger && dialogTrigger.getClientRects().length ? dialogTrigger : menu;
      returnTo?.focus({ preventScroll: true });
      dialogTrigger = null;
    });
  }
  function showEntry(index) {
    viewed = index;
    const entry = readEntries[viewed];
    $("entry-image").src = entry.image;
    $("entry-image").alt = entry.alt;
    $("entry-id").textContent = entry.id + "  /  " + entry.kind;
    $("entry-name").textContent = entry.name;
    $("entry-story").textContent = entry.story;
    $("entry-palette").textContent = entry.palette;
    $("entry-detail").textContent = entry.detail;
    $("entry-credit").textContent = entry.credit;
    $("entry-position").textContent = (viewed + 1) + " / " + readEntries.length;
    $("prev-entry").disabled = viewed === 0;
    $("next-entry").disabled = viewed === readEntries.length - 1;
  }
  function inspect(entry, sequence, trigger) {
    readEntries = sequence;
    showEntry(sequence.indexOf(entry));
    openDialog(entryDialog, trigger);
  }
  $("prev-entry").addEventListener("click", () => { if (viewed > 0) showEntry(viewed - 1); });
  $("next-entry").addEventListener("click", () => { if (viewed < readEntries.length - 1) showEntry(viewed + 1); });
  entryDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") $("prev-entry").click();
    if (event.key === "ArrowRight") $("next-entry").click();
  });
  const meetMote = $("meet-mote");
  const founder = entries.find((entry) => entry.id === "GA-000") || entries[0];
  meetMote.hidden = !founder;
  meetMote.addEventListener("click", () => { if (founder) inspect(founder, entries, meetMote); });

  function makeCard(entry) {
    const card = el("button", "card");
    card.type = "button";
    card.setAttribute("aria-label", "View " + entry.name + ", " + entry.kind);
    card.dataset.tone = entry.tone || "lilac";
    const visual = el("span", "card-art");
    const image = document.createElement("img");
    image.src = entry.image;
    image.alt = entry.alt;
    image.width = 600;
    image.height = 600;
    image.loading = "lazy";
    visual.append(image, el("span", "card-id", entry.id.replace("-", "–")));
    const details = el("span", "card-info");
    const titles = el("span", "card-titles");
    titles.append(el("span", "card-name", entry.name), el("span", "card-kind", entry.kind));
    const expand = el("span", "card-expand");
    expand.append(icon("expand"));
    details.append(titles, expand);
    card.append(visual, details);
    card.addEventListener("click", () => inspect(entry, activeEntries, card));
    return card;
  }
  function appendBatch() {
    const next = activeEntries.slice(shown, shown + batchSize);
    gallery.append(...next.map(makeCard));
    shown += next.length;
    loadMore.hidden = shown >= activeEntries.length;
    if (loadMore.hidden) observer?.disconnect();
    $("gallery-count").textContent = shown + " / " + activeEntries.length + (activeEntries.length === 1 ? " entry" : " entries");
  }
  function filterGallery(group) {
    observer?.disconnect();
    activeEntries = group === "All" ? entries.slice() : entries.filter((entry) => entry.group === group);
    shown = 0;
    gallery.replaceChildren();
    for (const button of filters.children) button.setAttribute("aria-pressed", String(button.dataset.group === group));
    appendBatch();
    $("filter-status").textContent = activeEntries.length + (activeEntries.length === 1 ? " entry" : " entries") + " in " + group + ".";
    if (!loadMore.hidden) observer?.observe(loadMore);
  }
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((records) => {
      if (!loadMore.hidden && records.some((record) => record.isIntersecting)) appendBatch();
    }, { rootMargin: "180px 0px" });
  }
  for (const group of ["All", ...new Set(entries.map((entry) => entry.group))]) {
    const button = el("button", "filter", group);
    button.type = "button";
    button.dataset.group = group;
    if (group === "All") button.append(el("span", "filter-count", String(entries.length).padStart(2, "0")));
    button.addEventListener("click", () => filterGallery(group));
    filters.append(button);
  }
  loadMore.addEventListener("click", () => {
    const first = shown;
    appendBatch();
    gallery.children[first]?.focus({ preventScroll: false });
  });
  filterGallery("All");
  markSection();

  const form = $("brief-form");
  const result = $("brief-result");
  const contactLink = $("contact-link");
  const briefText = () => [
    "NACREVOID · Ghost Angel illustration request",
    "Artist: " + artist, "Series: " + series, "Offer: " + price + " USD",
    "Ghost name: " + ($("ghost-name").value.trim() || "Artist’s choice"),
    "Color palette: " + $("ghost-palette").value.trim(),
    "Personal motif: " + $("ghost-motif").value.trim(),
    "", "One single-character portrait PNG and a numbered collector-card PNG using the same illustration.",
    "Personal use. One small sketch-stage change. Illustration limit: " + displayHours + ".",
    "Please confirm availability and timing."
  ].join("\n");
  function validateBrief() {
    for (const field of [$("ghost-palette"), $("ghost-motif")]) {
      field.setCustomValidity(field.value.trim() ? "" : "Please enter a few words.");
    }
    return form.reportValidity();
  }
  form.addEventListener("input", (event) => {
    event.target.setCustomValidity?.("");
    result.textContent = "";
  });
  $("brief-open").addEventListener("click", (event) => {
    result.textContent = "";
    openDialog(briefDialog, event.currentTarget);
  });
  if (canInquire) {
    contactLink.hidden = false;
    contactLink.textContent = contact.type === "link" ? "Open booking page" : "Open email draft";
    contactLink.target = contact.type === "link" ? "_blank" : "_self";
    contactLink.rel = "noopener noreferrer";
    contactLink.href = contact.type === "link" ? contact.url : "mailto:" + contact.address;
    contactLink.addEventListener("click", (event) => {
      if (!validateBrief()) { event.preventDefault(); return; }
      if (contact.type === "email") contactLink.href = "mailto:" + contact.address + "?subject=" + encodeURIComponent("Ghost Angel commission request") + "&body=" + encodeURIComponent(briefText());
    });
  }
  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(value); return true; } catch { /* Try the local-file fallback. */ }
    }
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.className = "clipboard-helper";
    helper.setAttribute("aria-label", "Commission brief to copy");
    form.append(helper);
    helper.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { /* Download remains available. */ }
    helper.remove();
    $("copy-brief").focus();
    return copied;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateBrief()) return;
    result.textContent = await copyText(briefText()) ? "Brief copied to your clipboard." : "Copy is unavailable here. Use Download .txt to keep your brief.";
  });
  $("save-brief").addEventListener("click", () => {
    if (!validateBrief()) return;
    const url = URL.createObjectURL(new Blob([briefText() + "\n"], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ghost-angel-commission-brief.txt";
    form.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    result.textContent = "Your brief is ready in your downloads.";
  });
})();
