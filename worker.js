/**
 * IOL Broadcasting — Cloudflare Worker v2
 * =========================================
 * - CORS proxy for IOL RSS feeds (returns story image URLs)
 * - TinyURL shortener endpoint (no API key needed)
 *
 * ENDPOINTS:
 * GET /all           → All sections as JSON (includes image URLs)
 * GET /news          → IOL News
 * GET /sport         → IOL Sport
 * GET /business      → IOL Business
 * GET /entertainment → IOL Entertainment
 * GET /technology    → IOL Technology
 * GET /motoring      → IOL Motoring
 * GET /lifestyle     → IOL Lifestyle
 * GET /shorten?url=  → Shorten a URL via TinyURL
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const SECTIONS = ['news','sport','business','entertainment','technology','motoring','lifestyle'];
const SECTION_LABELS = {
  news:'IOL News', sport:'IOL Sport', business:'Business Report',
  entertainment:'Tonight', technology:'IOL Tech', motoring:'IOL Motoring', lifestyle:'IOL Lifestyle',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const url     = new URL(request.url);
    const section = url.pathname.replace(/^\//, '').toLowerCase().trim();

    // ── TinyURL shortener ───────────────────────────────────────────────────
    if (section === 'shorten') {
      const longUrl = url.searchParams.get('url');
      if (!longUrl) return jsonResponse({ ok: false, error: 'Missing ?url= parameter' }, 400);
      try {
        const res  = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        const short = await res.text();
        if (!short.startsWith('http')) throw new Error('TinyURL returned invalid response');
        return jsonResponse({ ok: true, short, long: longUrl });
      } catch (e) {
        return jsonResponse({ ok: false, error: e.message, fallback: longUrl }, 200);
      }
    }

    // ── RSS feeds ───────────────────────────────────────────────────────────
    try {
      if (section === 'all') {
        const results = await Promise.allSettled(SECTIONS.map(s => fetchSection(s)));
        const stories = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        const seen    = new Set();
        const unique  = stories.filter(s => {
          const key = s.headline.toLowerCase().slice(0, 60);
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        return jsonResponse({ ok: true, count: unique.length, stories: unique });
      }

      if (!SECTIONS.includes(section))
        return jsonResponse({ ok: false, error: `Unknown section "${section}"` }, 400);

      const stories = await fetchSection(section);
      return jsonResponse({ ok: true, count: stories.length, section, stories });

    } catch (err) {
      return jsonResponse({ ok: false, error: err.message }, 500);
    }
  }
};

async function fetchSection(section) {
  const rssUrl = `https://iol.co.za/rss/extended/iol/${section}/`;
  const res    = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IOL Broadcasting Bot/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`IOL feed returned ${res.status} for "${section}"`);
  return parseRSS(await res.text(), section, SECTION_LABELS[section] || 'IOL');
}

function parseRSS(xml, section, defaultSource) {
  const stories = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item    = match[1];
    const title   = extractCDATA(item, 'title');
    const link    = extractTag(item, 'link') || extractTag(item, 'guid');
    const desc    = extractCDATA(item, 'description');
    const content = extractCDATA(item, 'content:encoded') || '';
    const author  = extractCDATA(item, 'author') || defaultSource;
    const pubDate = extractTag(item, 'pubDate') || '';

    // Try multiple image sources from the RSS
    const imgUrl  =
      extractAttr(item, 'media:content', 'url') ||
      extractAttr(item, 'media:thumbnail', 'url') ||
      extractAttr(item, 'enclosure', 'url') ||
      extractImgSrc(desc) ||
      extractImgSrc(content) ||
      '';

    if (!title || title.length < 5) continue;

    let cat = section;
    if (link) {
      if (/\/politics\//.test(link))      cat = 'politics';
      else if (/\/sport\//.test(link))    cat = 'sport';
      else if (/\/business\//.test(link)) cat = 'business';
      else if (/\/crime/.test(link))      cat = 'news';
    }

    const rawText = desc || content.slice(0, 600);
    const excerpt = stripHtml(rawText).replace(/\s+/g, ' ').trim().slice(0, 220);

    stories.push({
      headline: stripHtml(title).trim(),
      excerpt,
      category: cat,
      source:   stripHtml(author).trim().slice(0, 50) || defaultSource,
      pubDate,
      url:   link ? link.trim() : `https://www.iol.co.za/${section}/`,
      image: imgUrl,
    });
  }
  return stories;
}

function extractCDATA(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, 'i');
  const m  = xml.match(re);
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : m[2] || '').trim();
}
function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m  = xml.match(re);
  return m ? m[1].trim() : '';
}
function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>\\s]*(?:[^>]*\\s)${attr}="([^"]*)"`, 'i');
  const m  = xml.match(re) || xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}
function extractImgSrc(html) {
  if (!html) return '';
  const m = html.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : '';
}
function stripHtml(html) {
  return html.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}
