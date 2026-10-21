// Ranking and row rendering. Pure functions, no DOM, so they run under node --test.

export const TIERS = ["Orals", "Spotlights", "Posters people are talking about"];
const BADGES = ["Oral", "Spotlight", "Poster"];

export function buzz(p) {
  return Math.log1p(p.hf || 0) + Math.log1p(p.ax || 0) + Math.log1p(p.st || 0);
}

const byBuzz = (a, b) => buzz(b) - buzz(a) || a.t.localeCompare(b.t);

export function shelves(papers, areaIndex, posterCap = 20) {
  const inArea = papers.filter((p) => p.a === areaIndex);
  return TIERS.map((title, tier) => {
    let items = inArea.filter((p) => p.tier === tier).sort(byBuzz);
    if (tier === 2) items = items.filter((p) => buzz(p) > 0).slice(0, posterCap);
    return { title, tier, items };
  }).filter((s) => s.items.length);
}

export function cityCounts(papers) {
  const counts = {};
  for (const p of papers) {
    const city = (p.s || "").split(" ")[0];
    if (city) counts[city] = (counts[city] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// Match decides; tier and buzz add at most 0.03, so they only break near-ties.
export function searchScore(sim, p) {
  return sim + 0.01 * (2 - p.tier) + 0.001 * Math.min(buzz(p), 10);
}

// Closest papers by meaning; each result carries its match (cosine similarity) as `m`.
export function topK(queryVec, emb, papers, k = 50) {
  const dim = queryVec.length;
  const scored = papers.map((p, n) => {
    let dot = 0, norm = 0;
    for (let d = 0; d < dim; d++) {
      const v = emb[n * dim + d];
      dot += v * queryVec[d];
      norm += v * v;
    }
    const sim = norm ? dot / Math.sqrt(norm) : 0;
    return [searchScore(sim, p), { ...p, m: sim }];
  });
  return scored.sort((a, b) => b[0] - a[0]).slice(0, k).map(([, p]) => p);
}

export function keywordSearch(query, papers, k = 50) {
  const words = query.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  if (!words.length) return [];
  return papers
    .map((p) => {
      const title = p.t.toLowerCase();
      return [words.filter((w) => title.includes(w)).length, p];
    })
    .filter(([hits]) => hits)
    .sort((a, b) => b[0] - a[0] || searchScore(0, b[1]) - searchScore(0, a[1]))
    .slice(0, k)
    .map(([, p]) => p);
}

// "#area=<name>", "#search" or "#search=<query>"; a mangled link falls back to the first area.
export function parseHash(hash, areas) {
  let h = "";
  try {
    h = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {}
  const area = areas.findIndex((a) => h === `area=${a.name}`);
  const search = h === "search" ? "" : h.startsWith("search=") ? h.slice(7) : null;
  return { area: Math.max(area, 0), search };
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function compact(n) {
  return n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);
}

const paperURL = (p) => `https://neurips.cc/virtual/2026/${p.u}`;

export function readingListText(papers) {
  return "My NeurIPS 2026 reading list\n\n" +
    papers.map((p, n) => `${n + 1}. ${p.t} (${BADGES[p.tier]}) ${paperURL(p)}`).join("\n") + "\n";
}

const ZONES = { Sydney: "Australia/Sydney", Atlanta: "America/New_York", Paris: "Europe/Paris" };

export function cityTime(city, at = new Date()) {
  return at.toLocaleTimeString("en-US", { timeZone: ZONES[city], hour: "numeric", minute: "2-digit" }).toLowerCase();
}


const RAIL_SIZE = 20;

// The home page: most talked-about overall, orals by buzz, then one rail per area.
export function rails(papers, areas, size = RAIL_SIZE) {
  const out = [
    { title: "Most talked-about this week", items: papers.filter((p) => buzz(p) > 0).sort(byBuzz).slice(0, size) },
    { title: "Orals everyone's reading", items: papers.filter((p) => p.tier === 0).sort(byBuzz).slice(0, size) },
  ];
  areas.forEach((a, k) => out.push({ title: a.name, area: k, items: shelves(papers, k).flatMap((s) => s.items).slice(0, size) }));
  return out.filter((r) => r.items.length);
}

export function thumbURL(p) {
  return p.x ? `https://cdn-thumbnails.huggingface.co/social-thumbnails/papers/${p.x}.png` : null;
}

function buzzLine(p) {
  return [p.hf !== undefined && `🤗 ${compact(p.hf)}`, p.ax !== undefined && `αX ${compact(p.ax)}`, p.st !== undefined && `★ ${compact(p.st)}`]
    .filter(Boolean).map((s) => `<span>${s}</span>`).join("");
}

function saveButton(p, saved) {
  return `<button class="save" type="button" data-save="${esc(p.id)}" aria-pressed="${saved}" title="${saved ? "Remove from" : "Save to"} your reading list">${saved ? "Saved" : "Save"}</button>`;
}

// A poster-like card for rails and grids; the cover is the paper's first page when we have it.
export function cardHTML(p, { saved = false, match } = {}) {
  const thumb = thumbURL(p);
  const cover = thumb
    ? `<img src="${esc(thumb)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('nothumb');this.remove()">`
    : "";
  return `<article class="tcard tier-${p.tier}">
  <button class="cover${thumb ? "" : " nothumb"}" type="button" data-open="${esc(p.id)}" aria-label="Open details: ${esc(p.t)}">
    ${cover}<span class="cover-title">${esc(p.t)}</span>
    <span class="tier-pill">${BADGES[p.tier]}</span>
  </button>
  <div class="tcard-body">
    <button class="tcard-title" type="button" data-open="${esc(p.id)}">${esc(p.t)}</button>
    ${match !== undefined ? `<span class="match"><i style="--m:${Math.round(match * 100)}%"></i>${Math.round(match * 100)}% match</span>` : ""}
    <div class="tcard-foot"><span class="buzzline">${buzzLine(p)}</span>${saveButton(p, saved)}</div>
  </div>
</article>`;
}

// Umami counts clicks on links carrying these attributes.
const out = (to) => `data-umami-event="outbound" data-umami-event-to="${to}"`;

// Everything about one paper, for the detail panel.
export function detailHTML(p, { area = "", saved = false } = {}) {
  const thumb = thumbURL(p);
  const links = [
    `<a class="btn amber small" href="${esc(paperURL(p))}" ${out("neurips")}>NeurIPS page</a>`,
    p.o && `<a class="btn quiet small" href="https://openreview.net/forum?id=${esc(p.o)}" ${out("openreview")}>OpenReview</a>`,
    p.c && `<a class="btn quiet small" href="${esc(p.c)}" ${out("code")}>Code</a>`,
    p.x && `<a class="btn quiet small" href="https://www.alphaxiv.org/abs/${esc(p.x)}" ${out("alphaxiv")}>alphaXiv</a>`,
    `<a class="btn quiet small" data-umami-event="zotero-download" data-umami-event-what="paper" data-zotero="${esc(p.id)}" download="neurips2026-${esc(p.id)}.ris" aria-disabled="true" title="Downloads a .ris file. In Zotero: File, Import.">Add to Zotero</a>`,
  ].filter(Boolean).join("");
  const facts = [`<span class="badge">${BADGES[p.tier]}</span>`, area && `<span>${esc(area)}</span>`, p.s && `<span>${esc(p.s)}</span>`].filter(Boolean).join("");
  return `<div class="detail tier-${p.tier}">
  ${thumb ? `<img class="detail-thumb" src="${esc(thumb)}" alt="First page of the paper" onerror="this.remove()">` : ""}
  <div class="detail-facts">${facts}</div>
  <h2 class="detail-title" id="detail-title">${esc(p.t)}</h2>
  <p class="detail-authors"></p>
  ${p.i.length ? `<p class="orgs">${p.i.map((name, k) => `<span class="org${(p.co || []).includes(k) ? " company" : ""}">${esc(name)}</span>`).join("")}</p>` : ""}
  <div class="detail-actions">${saveButton(p, saved)}<span class="buzzline">${buzzLine(p)}</span></div>
  <div class="detail-abstract" data-abstract-for="${esc(p.id)}" data-area="${p.a}">Loading the abstract…</div>
  <div class="detail-links">${links}</div>
</div>`;
}

// The hero's "reading pile": this week's most talked-about papers that have a first page to show.
export function pilePapers(papers, n = 4) {
  return papers.filter((p) => p.x && buzz(p) > 0).sort(byBuzz).slice(0, n);
}

export function pileTag(p) {
  const loudest = [["st", "★"], ["hf", "🤗"], ["ax", "αX"]]
    .filter(([k]) => p[k] !== undefined && p[k] > 0)
    .sort((a, b) => p[b[0]] - p[a[0]])[0];
  return loudest ? `${BADGES[p.tier]}, ${loudest[1]} ${compact(p[loudest[0]])}` : BADGES[p.tier];
}

const bareArxiv = (x) => x.replace(/v\d+$/, "");

// The best link to the paper itself: arXiv PDF, then OpenReview PDF, then the NeurIPS page.
function pdfURL(p) {
  return p.x ? `https://arxiv.org/pdf/${p.x}` : p.o ? `https://openreview.net/pdf?id=${p.o}` : paperURL(p);
}

// One RIS record per paper; Zotero (and most reference managers) import these directly.
// Its link opens the PDF, so Zotero's "Find Available PDF" can attach it.
export function risFor(p, { authors = [], abstract = "" } = {}) {
  const one = (s) => String(s).replace(/\s+/g, " ").trim();
  const note = `${BADGES[p.tier]} at NeurIPS 2026${p.s ? `, ${p.s}` : ""}. NeurIPS page: ${paperURL(p)}`;
  const lines = ["TY  - CPAPER", `TI  - ${one(p.t)}`, ...authors.map((a) => `AU  - ${one(a)}`),
    "T2  - Advances in Neural Information Processing Systems (NeurIPS 2026)", "PY  - 2026", `UR  - ${pdfURL(p)}`];
  if (p.x) lines.push(`DO  - 10.48550/arXiv.${bareArxiv(p.x)}`);
  if (abstract) lines.push(`AB  - ${one(abstract)}`);
  lines.push(`N1  - ${note}`, "ER  - ");
  return lines.join("\n") + "\n";
}

// For Zotero's "Add Item by Identifier": it fetches each paper and attaches the PDF.
export function arxivIds(papers) {
  return papers.filter((p) => p.x).map((p) => bareArxiv(p.x)).join("\n");
}
