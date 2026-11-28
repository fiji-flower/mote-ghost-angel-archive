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
  const qty = offer.slots.length;
  const spiritWord = qty === 1 ? "spirit" : "spirits";
  $("slots-title").textContent = word(qty).replace(/^./, (letter) => letter.toUpperCase()) + " " + spiritWord + " in this release";

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
  $("header-slots").textContent = openSlots ? (contact ? openSlots + " " + (openSlots === 1 ? "spirit open" : "spirits open") : "First drop · " + qty + " " + spiritWord) : "Drop fully claimed";
  offer.slots.forEach((status, i) => {
    const available = status === "available";
    const label = available ? (contact ? "Open" : "Planned") : "Claimed";
    const slot = el("span", "slot" + (available ? " available" : ""), "Spirit " + String(i + 1).padStart(2, "0") + " · " + label);
    $("slots").append(slot);
  });
  if (canInquire) {
    $("booking-note").textContent = "Answer five questions, then finish on Ko-fi. " + artist + " receives your transmission with the order.";
  } else if (!openSlots) {
    $("booking-note").textContent = "Every spirit in this release has found a home. The ritual still works, so you can keep your answers for the next opening.";
  }

  const entryDialog = $("entry-dialog");
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
  for (const dialog of [entryDialog]) {
    dialog.querySelector(".close-modal").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => {
      const returnTo = dialogTrigger && dialogTrigger.getClientRects().length ? dialogTrigger : menu;
      returnTo?.focus({ preventScroll: true });
      dialogTrigger = null;
    });
  }
  const realLayer = $("entry-real");
  const realPhoto = $("entry-real-photo");
  const realFrame = document.querySelector(".entry-real-frame");
  // The frame hugs the photograph: no cropping, and no dead space around it.
  function fitReal() {
    if (!realLayer || !realFrame || !realPhoto.naturalWidth) return;
    const bounds = realLayer.getBoundingClientRect();
    const style = getComputedStyle(realLayer);
    const available = [
      bounds.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      bounds.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    ];
    if (available[0] < 1 || available[1] < 1) return;
    const scale = Math.min(available[0] / realPhoto.naturalWidth, available[1] / realPhoto.naturalHeight);
    realFrame.style.width = Math.round(realPhoto.naturalWidth * scale) + "px";
    realFrame.style.height = Math.round(realPhoto.naturalHeight * scale) + "px";
  }
  realPhoto?.addEventListener("load", fitReal);
  window.addEventListener("resize", fitReal);
  function showReal(entry) {
    if (!entry.realImage) {
      realLayer.classList.remove("is-in");
      realLayer.hidden = true;
      realPhoto.removeAttribute("src");
      return;
    }
    realPhoto.src = entry.realImage;
    realPhoto.alt = entry.realAlt || entry.alt;
    realLayer.hidden = false;
    if (realPhoto.complete) fitReal();
    realLayer.classList.remove("is-in");
    void realLayer.offsetWidth;
    requestAnimationFrame(() => { fitReal(); realLayer.classList.add("is-in"); });
  }
  function showEntry(index) {
    viewed = index;
    const entry = readEntries[viewed];
    $("entry-image").src = entry.image;
    $("entry-image").alt = entry.alt;
    showReal(entry);
    $("entry-id").textContent = entry.id + "  /  " + entry.kind;
    $("entry-name").textContent = entry.name;
    $("entry-story").textContent = entry.story;
    $("entry-palette").textContent = entry.palette;
    $("entry-detail").textContent = entry.detail;
    const credit = $("entry-credit");
    credit.textContent = entry.credit || "";
    credit.hidden = !entry.credit;
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
    image.loading = "lazy";
    if (entry.realImage) {
      // The founding ghost is the only card showing the actual plush: whole, inside
      // a frame that breathes, throws a slow sheen and gives off a few sparks.
      visual.classList.add("card-art-real");
      const frame = el("span", "card-real-frame");
      image.src = entry.realImage;
      image.alt = entry.realAlt || entry.alt;
      image.width = 1200;
      image.height = 948;
      frame.append(image);
      image.addEventListener("load", () => {
        frame.style.setProperty("--real-ratio", image.naturalWidth + " / " + image.naturalHeight);
      });
      visual.append(frame);
      for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) visual.append(el("span", "glint card-glint c" + n));
    } else {
      image.src = entry.image;
      image.alt = entry.alt;
      image.width = 600;
      image.height = 600;
      visual.append(image);
    }
    visual.append(el("span", "card-id", entry.id.replace("-", "–")));
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

})();
