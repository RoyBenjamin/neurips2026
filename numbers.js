// The Numbers view: what the whole program says about the field. Pure functions that return HTML,
// built from data/numbers.json (scripts/figures.py). ctx.byId finds papers, ctx.areaIndex finds areas by name.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const num = (n) => n.toLocaleString("en");
const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const times = (x) => `${x.toFixed(1)}×`;
const SHORT = { Google: "Google + DeepMind", "Chinese Academy of Sciences": "Chinese Academy", "Shanghai Jiao Tong University": "Shanghai Jiao Tong" };
// Long area names, shortened where they sit in narrow columns.
const AREA_SHORT = { "Deep Learning Architectures & Training": "Architectures & Training", "Statistical Learning & Causality": "Statistics & Causality",
  "Optimization & Online Learning": "Optimization", "Security, Privacy & Federated Learning": "Security & Privacy",
  "AI for Physics & Scientific Computing": "AI for Science" };
const shortArea = (a) => AREA_SHORT[a] || a;
const short = (name) => SHORT[name] || name.replace(/ University$/, "");
const TIER = ["Main talk", "Spotlight", "Poster"];

const known = (ids, ctx) => ids.map((id) => ctx.byId.get(id)).filter(Boolean);
const paperList = (list) => `<ol class="n-papers">${list.map((p) =>
  `<li><button type="button" class="tier-${p.tier}" data-open="${esc(p.id)}"><span>${esc(p.t)}</span><em>${TIER[p.tier]}</em></button></li>`).join("")}</ol>`;

// One bar per row; widths are relative to the largest value in the list.
function bars(rows, { area, ctx } = {}) {
  const most = Math.max(...rows.map((r) => r.value));
  return `<div class="n-bars">${rows.map((r) => {
    const idx = area && ctx.areaIndex.get(r.label);
    const tag = idx !== undefined && area ? "button" : "div";
    const attrs = tag === "button" ? ` type="button" data-area="${idx}"` : "";
    return `<${tag} class="n-row"${attrs}><span class="n-label">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span>`
      + `<span class="n-bar"><i style="width:${((r.value / most) * 100).toFixed(1)}%"></i></span><b>${esc(r.text)}</b></${tag}>`;
  }).join("")}</div>`;
}

function cities(n) {
  return `<section class="n-block">
    <h3>Three cities, three personalities</h3>
    <p class="note">How much of each city's program a topic takes up, compared with the conference as a whole.</p>
    <div class="n-cities">${n.cities.map((c, i) => `
      <article class="n-city city-${i}">
        <h4>${esc(c.city)}</h4>
        <p class="note">${num(c.papers)} papers, ${pct(c.share)} of the program, ${c.main} main talks</p>
        <p class="n-sub">Leans toward</p>
        <ul class="n-lifts">${c.up.map(([a, l]) => `<li><span>${esc(shortArea(a))}</span><b>${times(l)}</b></li>`).join("")}</ul>
        <p class="n-sub">Lighter on</p>
        <ul class="n-lifts down">${c.down.map(([a, l]) => `<li><span>${esc(shortArea(a))}</span><b>${times(l)}</b></li>`).join("")}</ul>
      </article>`).join("")}
    </div>
  </section>`;
}

function buzz(n, ctx) {
  const top = known(n.buzz.top, ctx);
  const mains = top.filter((p) => p.tier === 0).length;
  const dots = top.map((p, i) =>
    `<button type="button" class="dot tier-${p.tier}" data-open="${esc(p.id)}" aria-label="${i + 1}. ${esc(p.t)} (${TIER[p.tier]})" title="${i + 1}. ${esc(p.t)}"></button>`).join("");
  return `<section class="n-block">
    <h3>Only ${mains} of the top ${top.length} ${mains === 1 ? "is a main talk" : "are main talks"}</h3>
    <p class="note">The ${top.length} most talked-about papers, by Hugging Face upvotes, alphaXiv votes and GitHub stars. Meanwhile, ${n.buzz.quiet_main} of the ${n.buzz.main} main talks have no online buzz yet.</p>
    <div class="n-split">
      <div>
        <div class="n-dots">${dots}</div>
        <p class="n-legend"><span class="tier-0">Main talk</span><span class="tier-1">Spotlight</span><span class="tier-2">Poster</span></p>
      </div>
      ${paperList(top.slice(0, 5))}
    </div>
  </section>`;
}

function odds(n, ctx) {
  const rates = n.odds.areas.map(([, k, total]) => k / total);
  const spread = Math.max(...rates) / Math.min(...rates);
  return `<section class="n-block">
    <h3>Your topic can ${spread >= 3 ? "triple" : "double"} your odds of a spotlight*</h3>
    <p class="note">*Spotlight or higher. Conference average: ${pct(n.odds.overall, 1)}. Tap an area to see its papers.</p>
    ${bars(n.odds.areas.map(([a, k, total]) => ({ label: a, sub: `${k} of ${total}`, value: k / total, text: pct(k / total, 1) })), { area: true, ctx })}
  </section>`;
}

function agents(n, ctx) {
  const a = n.agents;
  const idx = ctx.areaIndex.get("LLM Agents");
  return `<section class="n-block">
    <h3>Agents: where the attention goes</h3>
    <p class="note">Average alphaXiv votes by theme, compared with all ${a.papers} agent papers (1× is average).</p>
    ${bars(a.themes.map(([t, share, lift]) => ({ label: t[0].toUpperCase() + t.slice(1), sub: `${pct(share)} of agent papers`, value: lift, text: times(lift) })))}
    <h4 class="n-h4">The most talked-about agent papers</h4>
    ${paperList(known(a.top, ctx))}
    ${idx !== undefined ? `<button class="btn quiet small" type="button" data-area="${idx}">See all agent papers</button>` : ""}
  </section>`;
}

function publishing(n) {
  const p = n.publishing;
  const list = (title, rows) => `<div><h4 class="n-h4">${title}</h4><ol class="n-rank">${rows.map(([k, v]) =>
    `<li><span>${esc(short(k))}</span><b>${num(v)}</b></li>`).join("")}</ol></div>`;
  return `<section class="n-block">
    <h3>Who's publishing</h3>
    <p class="note">Approximate, from author affiliations. A paper counts once for every institution and country among its authors. Google includes DeepMind. Hong Kong is listed separately.</p>
    <div class="n-ranks">
      ${list("Most papers", p.institutions)}
      ${list("Most picked for a spotlight*", p.picks)}
      ${list("Companies", p.companies)}
    </div>
    <h4 class="n-h4">Share of papers with an author based in…</h4>
    ${bars(p.countries.map(([c, share]) => ({ label: c, value: share, text: pct(share) })))}
  </section>`;
}

function titles(n, ctx) {
  const t = n.titles;
  const one = ctx.byId.get(t.one_word);
  const [name, count] = t.names[0] || [];
  const tile = (big, label) => `<div class="n-tile"><b>${big}</b><span>${label}</span></div>`;
  return `<section class="n-block">
    <h3>The titles</h3>
    <div class="n-tiles">
      ${tile(num(t.questions), "titles are questions")}
      ${tile(num(t.all_you_need), "still say “…Is All You Need”")}
      ${tile(pct(t.acronym_share), "start with an acronym and a colon")}
      ${name ? tile(num(count), `different papers are called ${esc(name)}`) : ""}
      ${tile(num(t.beyond), "titles go “Beyond” something")}
      ${one ? `<button type="button" class="n-tile" data-open="${esc(one.id)}"><b class="n-word">${esc(one.t)}</b><span>the only one-word title</span></button>` : ""}
    </div>
  </section>`;
}

export function numbersHTML(n, ctx) {
  return cities(n) + buzz(n, ctx) + odds(n, ctx) + agents(n, ctx) + publishing(n) + titles(n, ctx);
}

export function teaserHTML(n, ctx) {
  const top = known(n.buzz.top, ctx);
  const mains = top.filter((p) => p.tier === 0).length;
  const us = n.publishing.countries.find(([c]) => c === "United States");
  return `<section class="n-teaser">
    <div>
      <h2>NeurIPS 2026 in numbers</h2>
      <ul>
        <li>${mains} of the top ${top.length} ${mains === 1 ? "is a main talk" : "are main talks"}</li>
        <li>Sydney, Atlanta and Paris each lean toward different topics</li>
        ${us ? `<li>${pct(us[1])} of papers have a US-based author</li>` : ""}
      </ul>
    </div>
    <a class="btn amber" href="#numbers" data-umami-event="numbers-teaser">See the numbers</a>
  </section>`;
}
