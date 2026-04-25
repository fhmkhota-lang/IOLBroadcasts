/**
 * IOL Broadcasting — Cloudflare Worker
 * =====================================
 * Acts as a CORS-enabled proxy for IOL RSS feeds.
 * 
 * DEPLOY IN 2 MINUTES:
 * 1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 * 2. Paste this entire file into the editor
 * 3. Click "Deploy"
 * 4. Copy your worker URL (e.g. https://iol-rss.YOUR-NAME.workers.dev)
 * 5. Paste it into app.js where it says WORKER_BASE_URL
 * 
 * USAGE:
 * GET https://your-worker.workers.dev/news          → IOL News RSS as JSON
 * GET https://your-worker.workers.dev/sport         → IOL Sport RSS as JSON
 * GET https://your-worker.workers.dev/business      → IOL Business RSS as JSON
 * GET https://your-worker.workers.dev/entertainment → IOL Entertainment RSS as JSON
 * GET https://your-worker.workers.dev/technology    → IOL Technology RSS as JSON
 * GET https://your-worker.workers.dev/motoring      → IOL Motoring RSS as JSON
 * GET https://your-worker.workers.dev/lifestyle     → IOL Lifestyle RSS as JSON
 * GET https://your-worker.workers.dev/all           → All sections combined as JSON
 * 
 * FREE TIER: 100,000 requests/day — more than enough for this use case.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const SECTIONS = ['news', 'sport', 'business', 'entertainment', 'technology', 'motoring', 'lifestyle'];

const SECTION_LABELS = {
  news:          'IOL News',
  sport:         'IOL Sport',
  business:      'Business Report',
  entertainment: 'Tonight',
  technology:    'IOL Tech',
  motoring:      'IOL Motoring',
  lifestyle:     'IOL Lifestyle',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url      = new URL(request.url);
    const section  = url.pathname.replace('/', '').toLowerCase().trim();

    try {
      if (section === 'all') {
        // Fetch all sections in parallel
        const results = await Promise.allSettled(
          SECTIONS.map(s => fetchSection(s))
        );
        const stories = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        // Deduplicate
        const seen = new Set();
        const unique = stories.filter(s => {
          const key = s.headline.toLowerCase().slice(0, 60);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return jsonResponse({ ok: true, count: unique.length, stories: unique });
      }

      if (!SECTIONS.includes(section)) {
        return jsonResponse({ ok: false, error: `Unknown section "${section}". Valid: ${SECTIONS.join(', ')} or "all"` }, 400);
      }

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
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; IOL Broadcasting Bot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    cf: { cacheTtl: 300, cacheEverything: true }, // Cache for 5 minutes
  });

  if (!res.ok) throw new Error(`IOL feed returned ${res.status} for section "${section}"`);

  const xml    = await res.text();
  const label  = SECTION_LABELS[section] || 'IOL';
  return parseRSS(xml, section, label);
}

function parseRSS(xml, section, defaultSource) {
  const stories = [];
  // Extract all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const title   = extractCDATA(item, 'title');
    const link    = extractTag(item, 'link') || extractTag(item, 'guid');
    const desc    = extractCDATA(item, 'description');
    const content = extractCDATA(item, 'content:encoded') || '';
    const author  = extractCDATA(item, 'author') || defaultSource;
    const pubDate = extractTag(item, 'pubDate') || '';
    const imgUrl  = extractAttr(item, 'media:content', 'url') || extractAttr(item, 'media:thumbnail', 'url') || '';

    if (!title || title.length < 5) continue;

    // Derive category from URL
    let cat = section;
    if (link) {
      if (/\/politics\//.test(link))      cat = 'politics';
      else if (/\/sport\//.test(link))    cat = 'sport';
      else if (/\/business\//.test(link)) cat = 'business';
      else if (/\/crime/.test(link))      cat = 'news';
    }

    // Build clean excerpt from description or content
    const rawText = desc || content.slice(0, 600);
    const excerpt = stripHtml(rawText).replace(/\s+/g, ' ').trim().slice(0, 220);

    stories.push({
      headline: stripHtml(title).trim(),
      excerpt,
      category: cat,
      source:   stripHtml(author).trim().slice(0, 50) || defaultSource,
      pubDate,
      url:      link ? link.trim() : `https://www.iol.co.za/${section}/`,
      image:    imgUrl,
    });
  }

  return stories;
}

/* ---- XML helpers ---- */

function extractCDATA(xml, tag) {
  // Match <tag><![CDATA[...]]></tag> or <tag>...</tag>
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
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m  = xml.match(re);
  return m ? m[1] : '';
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}
