import { shelves, rails, cardHTML, detailHTML, topK, keywordSearch, parseHash, cityCounts, cityTime, readingListText, pilePapers, pileTag, thumbURL, risFor, arxivIds, esc } from "./rank.js?v=382f778aae";

const { meta, areas, papers } = window.CATCHUP;

// Anonymous usage counts (Umami, no cookies). A no-op until the analytics script loads.
function track(name, data) {
  try { window.umami?.track(name, data); } catch {}
}
const $ = (s) => document.querySelector(s);
const num = (n) => n.toLocaleString("en");
const byId = new Map(papers.map((p) => [p.id, p]));

const WHY = [
  "Selected for a talk by the program committee",
  "Highlighted by the program committee",
  "Ordered by Hugging Face upvotes, alphaXiv votes and GitHub stars",
];
const TRIES = ["RL for LLM reasoning", "memory for web agents", "diffusion language models", "VLA models for robots", "efficient LLM inference", "AI for protein design"];

/* Facts and live clocks: the conference is happening elsewhere, right now. */
const cities = cityCounts(papers);
$("#lede").textContent = `${num(papers.length)} papers in ${cities.map(([c]) => c).join(", ").replace(/, ([^,]*)$/, " and $1")}. Swipe through what people are talking about, or search your topic.`;
// The hero's reading pile; the most talked-about paper lands on top.
$("#pile").innerHTML = pilePapers(papers).reverse().map((p) =>
  `<button class="pile-card" type="button" data-open="${esc(p.id)}" aria-label="Open details: ${esc(p.t)}">
    <img src="${esc(thumbURL(p))}" alt="" onerror="this.closest('.pile-card').remove()"><span class="pile-tag">${esc(pileTag(p))}</span>
  </button>`).join("");

function tick() {
  const now = new Date();
  $("#clocks").innerHTML = cities.map(([city]) => `<li>${esc(city)}<b>${cityTime(city, now)}</b></li>`).join("");
}
tick();
setInterval(tick, 30000);
const fmtDate = (d) => new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
$("#asof").textContent = `Papers as of ${fmtDate(meta.papers_as_of)}. Buzz as of ${fmtDate(meta.buzz_as_of.replaceAll("-", ""))}.`;

$("#theme").addEventListener("click", () => {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const next = (document.documentElement.dataset.theme || (dark ? "dark" : "light")) === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
});

/* Views: home (rails), search, area, reading list */
const VIEWS = ["home", "search", "area", "saved"];
const setHash = (h) => history.replaceState(null, "", h || location.pathname + location.search);
// The follow banner sits early on the home page (most visitors scroll that far), else at the end.
function showView(view) {
  VIEWS.forEach((v) => ($(`#view-${v}`).hidden = v !== view));
  const slot = $("#follow-slot");
  if (view === "home" && slot) slot.append($("#follow"));
  else $("#main").append($("#follow"));
}
function goHome() {
  showView("home");
  setHash("");
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-home]")) {
    goHome();
    window.scrollTo({ top: 0 });
  }
});
$("#home-link").addEventListener("click", (e) => {
  e.preventDefault();
  q.value = "";
  goHome();
  window.scrollTo({ top: 0 });
});
const toMain = () => $("#main").scrollIntoView({ block: "start" });

/* Reading list, kept in this browser only. */
let saved = [];
try { saved = JSON.parse(localStorage.getItem("saved") || "[]").filter((id) => byId.has(id)); } catch {}
const isSaved = (id) => saved.includes(id);
function persist() {
  try { localStorage.setItem("saved", JSON.stringify(saved)); } catch {}
  $("#saved-count").textContent = saved.length;
  $("#saved-count").classList.toggle("has", saved.length > 0);
}
persist();
const card = (p, opts = {}) => cardHTML(p, { saved: isSaved(p.id), ...opts });

function renderSaved() {
  const list = saved.map((id) => byId.get(id));
  $("#saved-list").innerHTML = list.map((p) => card(p)).join("");
  $("#saved-empty").hidden = list.length > 0;
  $("#saved-actions").hidden = list.length === 0;
  if (list.length) prepareRIS($("#zotero-saved"), saved);
  const onArxiv = list.filter((p) => p.x).length;
  $("#zotero").hidden = list.length === 0;
  $("#way-ids").hidden = onArxiv === 0;
  $("#ids-note").textContent = onArxiv === list.length
    ? "All your saved papers are on arXiv."
    : `Covers the ${onArxiv} of your ${list.length} saved papers that are on arXiv.`;
}
$("#copy-ids").addEventListener("click", () => {
  track("copy-arxiv-ids", { count: saved.length });
  copy($("#copy-ids"), arxivIds(saved.map((id) => byId.get(id))), "Copy arXiv IDs");
});
$("#open-saved").addEventListener("click", () => {
  track("view-reading-list", { count: saved.length });
  renderSaved();
  showView("saved");
  setHash("#saved");
  toMain();
});
$("#copy-saved").addEventListener("click", () => copy($("#copy-saved"), readingListText(saved.map((id) => byId.get(id))), "Copy the list"));
$("#clear-saved").addEventListener("click", () => {
  saved = [];
  persist();
  renderSaved();
  renderSavedRail();
  document.querySelectorAll('.save[aria-pressed="true"]').forEach((b) => markSave(b, false));
});
function markSave(button, on) {
  button.setAttribute("aria-pressed", on);
  button.textContent = on ? "Saved" : "Save";
  button.title = `${on ? "Remove from" : "Save to"} your reading list`;
}
async function copy(button, text, label) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Couldn't copy";
  }
  setTimeout(() => (button.textContent = label), 1800);
}

/* Home: rails you swipe through. */
const railHTML = (r, id = "") => `
  <section class="rail"${id ? ` id="${id}"` : ""}>
    <div class="rail-head"><h2>${esc(r.title)}</h2>${r.sub ? `<span class="sub">${esc(r.sub)}</span>` : ""}${r.more ? `<button class="see-all" type="button" ${r.more}>See all</button>` : ""}</div>
    <div class="rail-row-wrap">
      <button class="arrow prev" type="button" aria-label="Scroll back">‹</button>
      <div class="rail-row">${r.items.map((p) => card(p)).join("")}</div>
      <button class="arrow next" type="button" aria-label="Scroll on">›</button>
    </div>
  </section>`;
function renderRails() {
  $("#rails").innerHTML = `<div id="saved-rail"></div>` + rails(papers, areas).map((r, n) => (n === 2 ? `<div id="follow-slot"></div>` : "") + railHTML({
    ...r,
    sub: r.area !== undefined ? `${areas[r.area].n_oral} main talks, ${areas[r.area].n_spotlight} spotlights` : "",
    more: r.area !== undefined ? `data-area="${r.area}"` : "",
  })).join("");
  renderSavedRail();
}
function renderSavedRail() {
  const list = saved.map((id) => byId.get(id)).reverse();
  $("#saved-rail").innerHTML = list.length ? railHTML({ title: "Your reading list", items: list, more: "data-saved-all" }) : "";
}
document.addEventListener("click", (e) => {
  const arrow = e.target.closest(".arrow");
  if (arrow) {
    const row = arrow.parentNode.querySelector(".rail-row");
    row.scrollBy({ left: (arrow.classList.contains("next") ? 1 : -1) * row.clientWidth * 0.9, behavior: "smooth" });
  }
  const more = e.target.closest("[data-area]:not([data-abstract-for])");
  if (more && more.classList.contains("see-all")) {
    track("open-area", { area: areas[+more.dataset.area].name });
    pickArea(+more.dataset.area);
    setHash(`#area=${encodeURIComponent(areas[+more.dataset.area].name)}`);
    toMain();
  }
  if (e.target.closest("[data-saved-all]")) $("#open-saved").click();
});

/* Area: collapsible sections, open by default. */
function pickArea(k) {
  showView("area");
  const list = shelves(papers, k);
  $("#area-name").textContent = areas[k].name;
  $("#area-sub").textContent = list.map((s) => `${s.items.length} ${s.title.toLowerCase()}`).join(", ").replace(/, ([^,]*)$/, " and $1") + ".";
  $("#shelves").innerHTML = list.map((s) => `
    <details class="shelf tier-${s.tier}" open>
      <summary><h3>${s.title}</h3><span class="n">${s.items.length}</span><span class="why">${WHY[s.tier]}</span><span class="chev" aria-hidden="true">▾</span></summary>
      <div class="grid">${s.items.map((p) => card(p)).join("")}</div>
    </details>`).join("") || `<p class="empty">No main talks, spotlights or discussed posters here yet. Try searching the topic instead.</p>`;
}

/* Detail panel: everything about a paper without leaving the page. */
const dialog = $("#detail");
const details = new Map(); // area -> Promise of {id: {ab: abstract, au: authors}}
function detailsFor(area) {
  if (!details.has(area)) {
    details.set(area, fetch(`data/details/${area}.json?v=382f778aae`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))));
    details.get(area).catch(() => details.delete(area));
  }
  return details.get(area);
}
async function openDetail(id) {
  const p = byId.get(id);
  $("#detail-body").innerHTML = detailHTML(p, { area: areas[p.a].name, saved: isSaved(id) });
  dialog.showModal();
  dialog.scrollTop = 0;
  const box = $("#detail-body .detail-abstract");
  try {
    const d = (await detailsFor(p.a))[id] || {};
    const au = d.au || [];
    $("#detail-body .detail-authors").textContent = au.length > 8 ? `${au.slice(0, 8).join(", ")} and ${au.length - 8} more` : au.join(", ");
    box.textContent = d.ab || "No abstract available.";
  } catch {
    box.textContent = "The abstract couldn't load. The NeurIPS page has it.";
  }
  prepareRIS($("#detail-body [data-zotero]"), [id]);
}

/* Zotero: RIS files import straight into Zotero, Mendeley and EndNote. */
async function risForIds(ids) {
  const out = [];
  for (const id of ids) {
    const p = byId.get(id);
    let d = {};
    try { d = (await detailsFor(p.a))[id] || {}; } catch {}
    out.push(risFor(p, { authors: d.au, abstract: d.ab }));
  }
  return out.join("\n");
}
// Zotero links are real <a download> links; their file is prepared as soon as they appear,
// so a click is an ordinary download that every browser allows.
const fileURLs = new WeakMap();
async function prepareRIS(link, ids) {
  link.setAttribute("aria-disabled", "true");
  const text = await risForIds(ids);
  if (fileURLs.has(link)) URL.revokeObjectURL(fileURLs.get(link));
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-research-info-systems" }));
  fileURLs.set(link, url);
  link.href = url;
  link.removeAttribute("aria-disabled");
}

$("#close-detail").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close(); // a click on the backdrop
});

/* One listener for opening papers and saving them, wherever they appear. */
document.addEventListener("click", (e) => {
  const save = e.target.closest("[data-save]");
  if (save) {
    const id = save.dataset.save;
    const on = !isSaved(id);
    saved = on ? [...saved, id] : saved.filter((x) => x !== id);
    persist();
    track(on ? "save" : "unsave");
    document.querySelectorAll(`[data-save="${CSS.escape(id)}"]`).forEach((b) => markSave(b, on));
    renderSavedRail();
    if (!$("#view-saved").hidden) renderSaved();
    return;
  }
  const open = e.target.closest("[data-open]");
  if (open) {
    const from = open.closest(".pile") ? "pile" : open.closest("#results") ? "search" : open.closest("#saved-list, #saved-rail") ? "reading-list" : open.closest("#shelves") ? "area" : "rail";
    const p = byId.get(open.dataset.open);
    track("open-paper", { from, tier: ["oral", "spotlight", "poster"][p.tier], area: areas[p.a].name });
    openDetail(open.dataset.open);
  }
});

/* Search: title words right away, meaning-based once the model has loaded. */
let model = null, emb = null, loading = null;
const note = $("#search-note");
const q = $("#q");
const searchHash = () => (q.value.trim() ? `#search=${encodeURIComponent(q.value.trim())}` : "");

function startSearch() {
  if (loading) return;
  loading = Promise.all([
    import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2").then((t) => t.pipeline("feature-extraction", meta.model)),
    fetch("data/embeddings.bin").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))),
  ]).then(([m, buf]) => {
    model = m;
    emb = new Int8Array(buf);
    if (q.value.trim()) runSearch();
  }).catch(() => {
    loading = "failed";
  });
}
q.addEventListener("focus", startSearch, { once: true });
// A typed search counts once, after the visitor pauses (never the text itself).
let typedTimer, lastCounted = "";
const countTyped = () => {
  clearTimeout(typedTimer);
  if (q.value.trim() === lastCounted) return; // same search, already counted
  lastCounted = q.value.trim();
  track("search", { via: "typed" });
};
q.addEventListener("input", () => {
  clearTimeout(typedTimer);
  if (q.value.trim()) typedTimer = setTimeout(countTyped, 2000);
  q.style.height = "auto";
  q.style.height = `${q.scrollHeight}px`;
  clearTimeout(timer);
  timer = setTimeout(runSearch, 350);
});
q.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    countTyped();
    runSearch(true);
  }
});
$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  countTyped();
  runSearch(true);
});
$("#tries").innerHTML = TRIES.map((t) => `<button type="button">${esc(t)}</button>`).join("");
$("#tries").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  q.value = b.textContent;
  track("search", { via: "try-chip", chip: b.textContent });
  startSearch();
  runSearch(true);
});
$("#clear-search").addEventListener("click", () => {
  q.value = "";
  goHome();
});
$("#copy-search").addEventListener("click", () => track("copy-search-link"));
$("#copy-search").addEventListener("click", () => copy($("#copy-search"), location.href, "Copy link"));

let timer, latest = 0;
async function runSearch(scroll = false) {
  clearTimeout(timer);
  const text = q.value.trim();
  if (!text) return goHome();
  startSearch();
  const ticket = ++latest;
  let found;
  if (model) {
    try {
      const out = await model(text, { pooling: "cls", normalize: true });
      found = topK(out.data, emb, papers);
      note.textContent = "By meaning, closest first.";
    } catch {
      model = null; // e.g. out of memory on a phone: stay on title words from here on
      found = keywordSearch(text, papers);
      note.textContent = "The search model stopped working, so these match title words only.";
    }
  } else {
    found = keywordSearch(text, papers);
    note.textContent = loading === "failed" ? "The search model couldn't load, so these match title words only." : "Matching title words while the search model loads…";
  }
  if (ticket !== latest) return; // a newer search finished first
  showView("search");
  setHash(searchHash());
  $("#copy-search").hidden = !found.length;
  $("#results").innerHTML = found.length
    ? found.map((p) => card(p, { match: p.m })).join("")
    : `<p class="empty">No titles match those words yet. Try fewer or different words.</p>`;
  if (scroll) toMain();
}

/* Start from the URL so links can be shared. */
renderRails();
showView("home");
const start = parseHash(location.hash, areas);
if (location.hash.startsWith("#area=")) pickArea(start.area);
else if (location.hash === "#saved") {
  renderSaved();
  showView("saved");
} else if (start.search) {
  q.value = start.search;
  runSearch();
}
