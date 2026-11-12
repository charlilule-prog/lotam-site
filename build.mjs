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
  tour: { ...home.tour, steps: home.tour.steps.map(withSize), more: home.tour.more.map(withSize) },
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
