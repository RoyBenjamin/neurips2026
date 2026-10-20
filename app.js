import { shelves, rowHTML, topK, keywordSearch, parseHash } from "./rank.js";

const { meta, areas, papers } = window.CATCHUP;
const $ = (s) => document.querySelector(s);

const WHY = [
  "Selected for a talk by the program committee.",
  "Highlighted by the program committee.",
  "Ordered by Hugging Face upvotes, alphaXiv votes and GitHub stars.",
];

// Footer and kicker facts come from the data, so a refresh updates them.
const fmtDate = (d) => new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
$("#kicker").textContent = `The ${papers.length.toLocaleString("en")} NeurIPS 2026 main-track papers, for everyone who isn't there`;
$("#asof").textContent = `Papers as of ${fmtDate(meta.papers_as_of)}. Buzz as of ${fmtDate(meta.buzz_as_of.replaceAll("-", ""))}.`;

/* Tabs */
const tabs = [...document.querySelectorAll('[role="tab"]')];
function showTab(id) {
  for (const t of tabs) {
    const on = t.getAttribute("aria-controls") === id;
    t.setAttribute("aria-selected", on);
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  if (id === "search") startSearch();
}
tabs.forEach((t) => t.addEventListener("click", () => {
  showTab(t.getAttribute("aria-controls"));
  history.replaceState(null, "", t.id === "tab-search" ? "#search" : `#area=${encodeURIComponent(areas[current].name)}`);
}));

/* Browse by area */
let current = 0;
const nav = $(".areas");
nav.innerHTML = areas.map((a, k) => `<button aria-pressed="false" data-k="${k}">${a.name}<span>${a.n_oral + a.n_spotlight}</span></button>`).join("");
nav.querySelectorAll("button").forEach((b) => (b.title = `${areas[b.dataset.k].n_oral} orals and ${areas[b.dataset.k].n_spotlight} spotlights`));
nav.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) pickArea(+b.dataset.k, true);
});

function pickArea(k, push) {
  current = k;
  nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.k === k));
  let rank = 0;
  $("#shelves").innerHTML = shelves(papers, k).map((s) => `
    <section class="shelf tier-${s.tier}">
      <h2>${s.title} <small>${s.items.length}</small></h2>
      <p class="why">${WHY[s.tier]}</p>
      <ol class="list">${s.items.map((p) => rowHTML(p, ++rank)).join("")}</ol>
    </section>`).join("") || `<p class="empty">No orals, spotlights or discussed posters here yet. Try searching the topic instead.</p>`;
  if (push) history.replaceState(null, "", `#area=${encodeURIComponent(areas[k].name)}`);
}

/* Search a topic: keyword matching right away, meaning-based once the model has loaded. */
let model = null, emb = null, loading = null;
const note = $("#search-note");

function startSearch() {
  if (loading) return;
  note.textContent = "Matching title words while the search model loads…";
  loading = Promise.all([
    import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2").then((t) => t.pipeline("feature-extraction", meta.model)),
    fetch("data/embeddings.bin").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))),
  ]).then(([m, buf]) => {
    model = m;
    emb = new Int8Array(buf);
    note.textContent = "";
    runSearch();
  }).catch(() => {
    note.textContent = "The search model couldn't load, so results match title words only.";
  });
}

let timer;
$("#q").addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(runSearch, 300);
});

let latest = 0;
async function runSearch() {
  const q = $("#q").value.trim();
  const ticket = ++latest;
  let found;
  if (!q) found = [];
  else if (model) {
    try {
      const out = await model(q, { pooling: "cls", normalize: true });
      found = topK(out.data, emb, papers);
    } catch {
      model = null; // e.g. out of memory on a phone: stay on title words from here on
      note.textContent = "The search model stopped working, so results match title words only.";
      found = keywordSearch(q, papers);
    }
  } else found = keywordSearch(q, papers);
  if (ticket !== latest) return; // a newer search finished first
  $("#results").innerHTML = found.length
    ? found.map((p, n) => rowHTML(p, n + 1, { badge: true })).join("")
    : q ? `<li class="empty">No titles match those words yet. Try fewer or different words.</li>` : "";
}

/* Start from the URL so links can be shared. */
const start = parseHash(location.hash, areas);
pickArea(start.area, false);
if (start.search) showTab("search");
