/**
 * IOL Broadcasting — Cloudflare Worker v3
 * - Fixed multiline media:content image extraction
 * - TinyURL shortener endpoint
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

    // TinyURL shortener
    if (section === 'shorten') {
      const longUrl = url.searchParams.get('url');
      if (!longUrl) return jsonResponse({ ok: false, error: 'Missing ?url= parameter' }, 400);
      try {
        const res   = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        const short = (await res.text()).trim();
        if (!short.startsWith('http')) throw new Error('Invalid response');
        return jsonResponse({ ok: true, short, long: longUrl });
      } catch (e) {
        return jsonResponse({ ok: false, error: e.message, fallback: longUrl }, 200);
      }
    }

    // RSS feeds
    try {
      if (section === 'all') {
        const results = await Promise.allSettled(SECTIONS.map(s => fetchSection(s)));
        const stories = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        const seen = new Set();
        const unique = stories.filter(s => {
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
  const res = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IOL Broadcasting Bot/1.0)', 'Accept': 'application/rss+xml, text/xml, */*' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`IOL feed ${res.status} for "${section}"`);
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

    // FIX: media:content url attribute may be on the same or next line — use multiline match
    // Pattern: <media:content ... url="VALUE" ...> across multiple lines
    let imgUrl = '';
    const mediaMatch = item.match(/<media:content[\s\S]*?url="([^"]+)"/i);
    if (mediaMatch) {
      imgUrl = mediaMatch[1];
    } else {
      // fallback: media:thumbnail
      const thumbMatch = item.match(/<media:thumbnail[\s\S]*?url="([^"]+)"/i);
      if (thumbMatch) imgUrl = thumbMatch[1];
    }
    // Final fallback: first <img src> in content
    if (!imgUrl) {
      const imgSrc = content.match(/<img[^>]+src="([^"]+)"/i);
      if (imgSrc) imgUrl = imgSrc[1];
    }

    if (!title || title.length < 5) continue;

    let cat = section;
    if (link) {
      if (/\/politics\//.test(link))       cat = 'politics';
      else if (/\/sport\//.test(link))     cat = 'sport';
      else if (/\/business\//.test(link))  cat = 'business';
      else if (/\/crime/.test(link))       cat = 'news';
      else if (/\/motoring\//.test(link))  cat = 'motoring';
      else if (/\/lifestyle\//.test(link)) cat = 'lifestyle';
      else if (/\/travel\//.test(link))    cat = 'travel';
      else if (/\/technology\//.test(link))cat = 'technology';
      else if (/\/entertainment\//.test(link)) cat = 'entertainment';
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
function stripHtml(html) {
  return html.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}
