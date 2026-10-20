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

export function searchScore(sim, p) {
  return sim + 0.04 * (2 - p.tier) + 0.01 * buzz(p);
}

export function topK(queryVec, emb, papers, k = 50) {
  const dim = queryVec.length;
  const scored = papers.map((p, n) => {
    let dot = 0, norm = 0;
    for (let d = 0; d < dim; d++) {
      const v = emb[n * dim + d];
      dot += v * queryVec[d];
      norm += v * v;
    }
    return [searchScore(norm ? dot / Math.sqrt(norm) : 0, p), p];
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

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function compact(n) {
  return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);
}

function institutions(list) {
  if (!list.length) return "";
  const shown = list.slice(0, 3).map(esc).join(", ");
  return list.length > 3 ? `${shown} and ${list.length - 3} more` : shown;
}

export function rowHTML(p, rank, { badge = false } = {}) {
  const stats = [
    p.hf !== undefined && `<a class="stat" href="https://huggingface.co/papers/${esc(p.x)}" title="Hugging Face upvotes">🤗 ${compact(p.hf)}</a>`,
    p.ax !== undefined && `<a class="stat" href="https://www.alphaxiv.org/abs/${esc(p.x)}" title="alphaXiv votes">αX ${compact(p.ax)}</a>`,
    p.st !== undefined && `<a class="stat" href="${esc(p.c)}" title="GitHub stars">★ ${compact(p.st)}</a>`,
  ].filter(Boolean).join("");
  const links = [
    `<a href="https://neurips.cc/virtual/2026/${esc(p.u)}">NeurIPS page</a>`,
    p.o && `<a href="https://openreview.net/forum?id=${esc(p.o)}">OpenReview</a>`,
    p.c && `<a href="${esc(p.c)}">Code</a>`,
  ].filter(Boolean).join("");
  return `<li class="paper tier-${p.tier}">
  <span class="rank">${rank}</span>
  <div class="body">
    ${badge ? `<span class="badge" title="${BADGES[p.tier]} at NeurIPS 2026">${BADGES[p.tier]}</span>` : ""}
    <a class="title" href="https://neurips.cc/virtual/2026/${esc(p.u)}">${esc(p.t)}</a>
    ${p.i.length ? `<p class="inst">${institutions(p.i)}</p>` : ""}
    <div class="meta">${stats ? `<span class="stats">${stats}</span>` : ""}<span class="links">${links}</span></div>
  </div>
</li>`;
}

// "#area=<name>" or "#search"; a mangled link falls back to the first area.
export function parseHash(hash, areas) {
  let h = "";
  try {
    h = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {}
  const area = areas.findIndex((a) => h === `area=${a.name}`);
  return { area: Math.max(area, 0), search: h === "search" };
}
