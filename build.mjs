// Builds the Lotam marketing site: content/*.json + src/*.html  ->  dist/
// No dependencies. Run: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
const site = json("content/settings.json"), home = json("content/home.json"), guide = json("content/guide.json");
const pages = [json("content/accessibility.json"), json("content/privacy.json")];
if (!site.url.endsWith("/")) site.url += "/";
const GUIDE_PATH = "nihul-talmidey-nehiga/";

/* ---------- small helpers ---------- */
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// inline text with **bold** and [links](url); {whatsapp} becomes the support link
const inline = (t) => esc(String(t ?? "").replace(/\{whatsapp\}/g, `https://wa.me/${site.whatsapp}`))
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
const plain = (t) => String(t ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[(.+?)\]\((.+?)\)/g, "$1").trim();
// paragraphs and "- " lists
const blocks = (md) => String(md ?? "").trim().split(/\n\s*\n/).filter(Boolean).map((b) => {
  const lines = b.split("\n");
  return lines.every((l) => /^\s*[-*]\s+/.test(l))
    ? "  <ul>\n" + lines.map((l) => `    <li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("\n") + "\n  </ul>\n"
    : `  <p>${inline(lines.join(" "))}</p>\n`;
}).join("");

/* image size from the file itself (WebP, PNG), so width/height stay right when a picture is replaced */
function imageSize(file) {
  const b = readFileSync(file);
  if (b.toString("ascii", 1, 4) === "PNG") return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const k = b.toString("ascii", 12, 16);
    if (k === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === "VP8L") { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
    if (k === "VP8X") return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  }
  throw new Error(`cannot read the size of ${file} (use WebP or PNG)`);
}
const withSize = (item) => { const [w, h] = imageSize(join(root, "static", item.image)); return { ...item, image_w: w, image_h: h }; };


/* icons for the capabilities around the phone ("ומה עוד יש בלוטם"); the editor picks one by name */
const ICONS = {
  calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18M9 15l2 2 4-4"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.5 20a1.7 1.7 0 0 0 3 0"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20.5l1.7-5.2A8.4 8.4 0 1 1 21 11.5z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
  sms: '<rect x="3" y="5" width="18" height="13" rx="3"/><path d="M7 10h10M7 13h6"/><path d="M8 18l-2 3"/>',
  invoice: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h4"/>',
  car: '<path d="M5 16l1.5-5A2 2 0 0 1 8.4 9.5h7.2a2 2 0 0 1 1.9 1.5L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="20" r="1.2"/><circle cx="16.5" cy="20" r="1.2"/>',
  report: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 17v-3M12 17v-6M16 17V9"/>',
  offline: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1"/><path d="M3 3l18 18"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 1 1 .6-9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/><path d="M12 12v6M9.5 14.5L12 12l2.5 2.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 21a2.5 2.5 0 0 1 0-5h2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};
const iconSvg = (name) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`;
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || "")) ? c : "#4fd1c7");

/* ---------- tiny template engine: {{a.b}} escaped, {{{a.b}}} raw, {{#each list}}…{{/each}}, {{this}}, {{@n}}, {{@nn}} ---------- */
function lookup(path, stack) {
  if (path === "this") return stack[0].item;
  if (path === "@n") return stack[0].index + 1;
  if (path === "@nn") return String(stack[0].index + 1).padStart(2, "0");
  for (const s of stack) {
    let v = s.item, ok = true;
    for (const k of path.split(".")) { if (v != null && typeof v === "object" && k in v) v = v[k]; else { ok = false; break; } }
    if (ok) return v;
  }
  throw new Error(`template field not found: ${path}`);
}
function render(tpl, stack) {
  let out = "", i = 0;
  const OPEN = "{{#each ", CLOSE = "{{/each}}";
  while (true) {
    const a = tpl.indexOf(OPEN, i);
    if (a < 0) { out += vars(tpl.slice(i), stack); break; }
    out += vars(tpl.slice(i, a), stack);
    const nameEnd = tpl.indexOf("}}", a), name = tpl.slice(a + OPEN.length, nameEnd).trim();
    let depth = 1, j = nameEnd + 2;
    while (depth) {
      const o = tpl.indexOf(OPEN, j), c = tpl.indexOf(CLOSE, j);
      if (c < 0) throw new Error("unclosed {{#each}}");
      if (o >= 0 && o < c) { depth++; j = o + OPEN.length; } else { depth--; j = c + CLOSE.length; }
    }
    const body = tpl.slice(nameEnd + 2, j - CLOSE.length), list = lookup(name, stack) || [];
    list.forEach((item, index) => { out += render(body, [{ item, index }, ...stack]); });
    i = j;
  }
  return out;
}
const vars = (t, stack) => t.replace(/\{\{\{([^{}]+)\}\}\}/g, (_, p) => String(lookup(p.trim(), stack) ?? "")).replace(/\{\{([^{}#/]+)\}\}/g, (_, p) => esc(lookup(p.trim(), stack)));

/* ---------- shared head pieces ---------- */
const verification = (site.indexing ? "" : '<meta name="robots" content="noindex, nofollow">\n')
  + (site.google_verification ? `<meta name="google-site-verification" content="${esc(site.google_verification)}">\n` : "")
  + (site.bing_verification ? `<meta name="msvalidate.01" content="${esc(site.bing_verification)}">\n` : "");
const noRobotsDup = (html) => site.indexing ? html : html.replace('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">\n', "");
const org = { "@type": "Organization", "@id": site.url + "#org", name: site.name, alternateName: site.alt_names, url: site.url, logo: site.url + "img/logo.webp",
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", url: `https://wa.me/${site.whatsapp}`, availableLanguage: "he", areaServed: "IL" } };
const ld = (graph) => JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/<\//g, "<\\/");

/* ---------- home ---------- */
const homeData = { ...home, site,
  tour: { ...home.tour, steps: home.tour.steps.map(withSize) },
  sms: withSize(home.sms),
  plus: { ...home.plus, orbit: home.plus.orbit.map((o) => ({ ...o, color: safeColor(o.color), icon_svg: iconSvg(o.icon) })) },
  faq: { ...home.faq, items: home.faq.items.map((x) => ({ ...x, a_html: inline(x.a) })) },
  verification,
  jsonld: ld([org,
    { "@type": "WebSite", "@id": site.url + "#site", url: site.url, name: site.name, inLanguage: "he-IL", publisher: { "@id": site.url + "#org" } },
    { "@type": "SoftwareApplication", "@id": site.url + "#app", name: site.name, description: home.seo.description, url: site.url, image: site.url + "img/og.png",
      applicationCategory: "BusinessApplication", operatingSystem: "Web", inLanguage: "he-IL", audience: { "@type": "Audience", audienceType: "מורי נהיגה" },
      featureList: site.features,
      offers: { "@type": "Offer", price: site.offer_price, priceCurrency: "ILS", description: site.offer_description, url: site.url + "#join" },
      publisher: { "@id": site.url + "#org" } },
    { "@type": "FAQPage", "@id": site.url + "#faq", inLanguage: "he-IL", mainEntity: home.faq.items.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: plain(x.a) } })) },
  ]),
};
/* ---------- guide ---------- */
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const iso = (d) => String(d).slice(0, 10);
const heDate = (d) => { const [y, m, day] = iso(d).split("-").map(Number); return `${day} ב${MONTHS[m - 1]} ${y}`; };
const guideUrl = site.url + GUIDE_PATH;
const guideData = { ...guide, site, verification, updated_he: heDate(guide.updated),
  sections: guide.sections.map((s) => ({ ...s, body_html: blocks(s.body), lotam_html: s.lotam && s.lotam.trim() ? `  <p class="lotam"><b>בלוטם:</b> ${inline(s.lotam.trim())}</p>\n` : "" })),
  jsonld: ld([
    { "@type": "Article", "@id": guideUrl + "#article", headline: guide.h1, description: guide.seo.description, inLanguage: "he-IL", datePublished: iso(guide.published), dateModified: iso(guide.updated),
      mainEntityOfPage: guideUrl, image: site.url + "img/og.png", author: { "@type": "Organization", name: site.name, url: site.url },
      publisher: { "@type": "Organization", name: site.name, url: site.url, logo: { "@type": "ImageObject", url: site.url + "img/logo.webp" } } },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: site.name, item: site.url }, { "@type": "ListItem", position: 2, name: guide.breadcrumb, item: guideUrl }] },
  ]),
};

/* ---------- write dist ---------- */
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, GUIDE_PATH), { recursive: true });
cpSync(join(root, "static"), dist, { recursive: true });
writeFileSync(join(dist, "index.html"), noRobotsDup(render(read("src/home.html"), [{ item: homeData, index: 0 }])));
writeFileSync(join(dist, GUIDE_PATH, "index.html"), noRobotsDup(render(read("src/guide.html"), [{ item: guideData, index: 0 }])));

/* ---------- plain content pages: accessibility statement, privacy policy ---------- */
for (const pg of pages) {
  const url = site.url + pg.slug + "/";
  const data = { ...pg, site, verification, updated_he: heDate(pg.updated),
    sections: pg.sections.map((x) => ({ ...x, body_html: blocks(x.body) })),
    jsonld: ld([
      { "@type": "WebPage", "@id": url, url, name: pg.h1, description: pg.seo.description, inLanguage: "he-IL", dateModified: iso(pg.updated), isPartOf: { "@id": site.url + "#site" }, publisher: { "@id": site.url + "#org" } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: site.name, item: site.url }, { "@type": "ListItem", position: 2, name: pg.breadcrumb, item: url }] },
    ]) };
  mkdirSync(join(dist, pg.slug), { recursive: true });
  writeFileSync(join(dist, pg.slug, "index.html"), noRobotsDup(render(read("src/page.html"), [{ item: data, index: 0 }])));
}

const SEARCH_BOTS = ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"];
const group = (bot, rules) => `User-agent: ${bot}\n${rules}`;
writeFileSync(join(dist, "robots.txt"), site.indexing
  ? "# Public marketing site. Search engines and AI search (discovery, not model training) are welcome.\n"
    + ["*", ...SEARCH_BOTS].map((b) => group(b, "Allow: /\nDisallow: /admin/\n")).join("\n") + `\nSitemap: ${site.url}sitemap.xml\n`
  // before launch: every page carries "noindex" (tag and header). Google and Bing may read the pages so they see it; everyone else stays out.
  : "# Not launched yet: pages are marked noindex (settings: indexing).\n"
    + ["Googlebot", "Bingbot"].map((b) => group(b, "Allow: /\nDisallow: /admin/\n")).join("\n") + "\n" + group("*", "Disallow: /\n"));
const headers = read("static/_headers");
writeFileSync(join(dist, "_headers"), site.indexing ? headers : headers.replace("\n/*\n", "\n/*\n  X-Robots-Tag: noindex, nofollow\n"));
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${site.url}</loc><lastmod>${today}</lastmod></url>\n<url><loc>${guideUrl}</loc><lastmod>${iso(guide.updated)}</lastmod></url>\n${pages.map((pg) => `<url><loc>${site.url}${pg.slug}/</loc><lastmod>${iso(pg.updated)}</lastmod></url>\n`).join("")}</urlset>\n`);
console.log(`built dist/ (${site.indexing ? "open to search engines" : "hidden from search engines"})`);
