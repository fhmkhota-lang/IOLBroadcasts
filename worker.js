/**
 * IOL Broadcasting — Cloudflare Worker v5
 * Endpoints:
 *   GET /all|news|sport|...  → IOL RSS feeds as JSON (includes image URLs)
 *   GET /shorten?url=        → TinyURL shortener (no API key needed)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SECTIONS = ['news','sport','business','entertainment','technology','motoring','lifestyle'];
const LABELS   = { news:'IOL News', sport:'IOL Sport', business:'Business Report', entertainment:'Tonight', technology:'IOL Tech', motoring:'IOL Motoring', lifestyle:'IOL Lifestyle' };

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url     = new URL(request.url);
    const section = url.pathname.replace(/^\//, '').toLowerCase().trim();

    // TinyURL shortener
    if (section === 'shorten') {
      const longUrl = url.searchParams.get('url');
      if (!longUrl) return json({ ok:false, error:'Missing ?url=' }, 400);
      try {
        const r = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(longUrl));
        const s = (await r.text()).trim();
        if (!s.startsWith('http')) throw new Error('Invalid response');
        return json({ ok:true, short:s, long:longUrl });
      } catch(e) { return json({ ok:false, error:e.message, fallback:longUrl }); }
    }

    // RSS feeds
    try {
      if (section === 'all') {
        const results = await Promise.allSettled(SECTIONS.map(s => fetchSection(s)));
        const stories = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        const seen = new Set();
        const unique = stories.filter(s => { const k=s.headline.toLowerCase().slice(0,60); if(seen.has(k))return false; seen.add(k); return true; });
        return json({ ok:true, count:unique.length, stories:unique });
      }
      if (!SECTIONS.includes(section)) return json({ ok:false, error:'Unknown section "'+section+'". Valid: '+SECTIONS.join(', ')+' or "all"' }, 400);
      const stories = await fetchSection(section);
      return json({ ok:true, count:stories.length, section, stories });
    } catch(e) { return json({ ok:false, error:e.message }, 500); }
  }
};

async function fetchSection(section) {
  const res = await fetch('https://iol.co.za/rss/extended/iol/'+section+'/', {
    headers:{'User-Agent':'Mozilla/5.0 (compatible; IOL Broadcasting Bot/1.0)','Accept':'application/rss+xml,text/xml,*/*'},
    cf:{cacheTtl:300,cacheEverything:true},
  });
  if (!res.ok) throw new Error('IOL feed '+res.status+' for "'+section+'"');
  return parseRSS(await res.text(), section, LABELS[section]||'IOL');
}

function parseRSS(xml, section, src) {
  const stories=[], re=/<item>([\s\S]*?)<\/item>/g; let m;
  while((m=re.exec(xml))!==null){
    const item=m[1];
    const title=cdata(item,'title'), link=tag(item,'link')||tag(item,'guid');
    const desc=cdata(item,'description'), author=cdata(item,'author')||src, pub=tag(item,'pubDate')||'';
    const imgM=item.match(/<media:content[\s\S]*?url="([^"]+)"/i)||item.match(/<media:thumbnail[\s\S]*?url="([^"]+)"/i);
    const imgUrl=imgM?imgM[1]:'';
    if(!title||title.length<5) continue;
    let cat=section;
    if(link){if(/\/politics\//.test(link))cat='politics';else if(/\/sport\//.test(link))cat='sport';else if(/\/business\//.test(link))cat='business';else if(/\/crime/.test(link))cat='news';}
    stories.push({headline:strip(title).trim(),excerpt:strip(desc||'').replace(/\s+/g,' ').trim().slice(0,220),category:cat,source:strip(author).trim().slice(0,50)||src,pubDate:pub,url:link?link.trim():'https://www.iol.co.za/'+section+'/',image:imgUrl});
  }
  return stories;
}
function cdata(x,t){const r=new RegExp('<'+t+'[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/'+t+'>','i'),m=x.match(r);return m?(m[1]!==undefined?m[1]:m[2]||'').trim():'';}
function tag(x,t){const r=new RegExp('<'+t+'[^>]*>([\\s\\S]*?)<\\/'+t+'>','i'),m=x.match(r);return m?m[1].trim():'';}
function strip(h){return h.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}});}
