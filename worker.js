/**
 * IOL Broadcasting — Cloudflare Worker v4
 * =========================================
 * Endpoints:
 *   GET  /all|news|sport|...  → IOL RSS feeds as JSON
 *   GET  /shorten?url=        → TinyURL shortener
 *   POST /canva/card          → Create/edit a Canva card
 *   POST /canva/upload        → Upload image asset to Canva
 *
 * Environment variables to set in Cloudflare Worker dashboard:
 *   CANVA_TOKEN  → Your Canva API token
 *                  Get it at: https://www.canva.com/developers/apps
 *                  (Personal access token, needs asset:write + design:content:write scopes)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SECTIONS = ['news','sport','business','entertainment','technology','motoring','lifestyle'];
const LABELS   = { news:'IOL News', sport:'IOL Sport', business:'Business Report', entertainment:'Tonight', technology:'IOL Tech', motoring:'IOL Motoring', lifestyle:'IOL Lifestyle' };

// Template IDs
const SINGLE_CARD_TEMPLATE = 'DAGsALPE-hs';
const CAROUSEL_TEMPLATE    = 'DAG5Z_3B2HU';

// Single card page element map (from live inspection)
const SINGLE_PAGES = [
  { page_index:1, bg:'PB3G33JqztQyvPnq', kicker:'PB3G33JqztQyvPnq-LB7BLVLxpY1KmLSb', headline:'PB3G33JqztQyvPnq-LBqQ3M5KHVFY70H8', cats:['news','politics','default'] },
  { page_index:2, bg:'PBzm7yl998KDMs8b', kicker:'PBzm7yl998KDMs8b-LB9N2gDpDrMyPPDw', headline:'PBzm7yl998KDMs8b-LB1J5GY6gtyCkp2z', cats:['business','technology'] },
  { page_index:4, bg:'PBJvqQV59MZsGgSn', kicker:'PBJvqQV59MZsGgSn-LBpy3Z5hw7QNb23n', headline:'PBJvqQV59MZsGgSn-LBXJ0fSr6y1vY1vx', cats:['entertainment','lifestyle'] },
  { page_index:5, bg:'PBMST8wgyxTwhjwX', kicker:'PBMST8wgyxTwhjwX-LBBZxkcbcWs040bg', headline:'PBMST8wgyxTwhjwX-LBCykyzYx8RpJlcC', cats:['sport'] },
  { page_index:8, bg:'PBcJ5RQPspg1GLcF', kicker:'PBcJ5RQPspg1GLcF-LBLl5T14zNHbMWPd', headline:'PBcJ5RQPspg1GLcF-LBrV8FSmCCmh16sG', cats:['motoring'] },
  { page_index:6, bg:'PB79tGv4qq1yHv89', kicker:'PB79tGv4qq1yHv89-LBJ4y9vnbY4nP6D4', headline:'PB79tGv4qq1yHv89-LB9wbCWP43qxccXT', cats:['travel'] },
  { page_index:7, bg:'PBGHnCHXbDtTFw4n', kicker:'PBGHnCHXbDtTFw4n-LB4fD00CmGhj4NJX', headline:'PBGHnCHXbDtTFw4n-LBtRzK3x3xXNbtSk', cats:['technology'] },
];

const CAROUSEL_PAGES = [
  { page_index:1, bg:'PBhkt7kRRC6rlzXM', kicker:'PBhkt7kRRC6rlzXM-LBjNpHhsVJYM03GF', body:'PBhkt7kRRC6rlzXM-LBmYX1rRqn2VFnPV' },
  { page_index:2, bg:'PBqQQBsshjKSj1v1', kicker:null,                                   body:'PBqQQBsshjKSj1v1-LBx1CWtc1ZzXvHs9' },
  { page_index:3, bg:'PBjwV9rMq57Pdsjq', kicker:null,                                   body:'PBjwV9rMq57Pdsjq-LBLnN7x5HGNcWgKt' },
  { page_index:4, bg:'PBJl3KvwKBfr87ny', kicker:null,                                   body:'PBJl3KvwKBfr87ny-LBrTq6sVTHsn87YL' },
  { page_index:5, bg:'PBLj7DbQNLsQZY5K', kicker:'PBLj7DbQNLsQZY5K-LBpLMwM39v2jVmJr', body:'PBLj7DbQNLsQZY5K-LByh97DCfyYwLrpb' },
  { page_index:6, bg:'PBY6xBgZmFw6VWjr', kicker:'PBY6xBgZmFw6VWjr-LBCsgpcLfH30fyh8', body:'PBY6xBgZmFw6VWjr-LB5HDSR9KrPL485l' },
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url     = new URL(request.url);
    const section = url.pathname.replace(/^\//, '').toLowerCase().trim();

    // ── TinyURL shortener ──────────────────────────────────────────
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

    // ── Canva: upload image asset ──────────────────────────────────
    if (section === 'canva/upload' && request.method === 'POST') {
      const token = env.CANVA_TOKEN;
      if (!token) return json({ ok:false, error:'CANVA_TOKEN not set in worker environment' }, 500);
      const { imageUrl, name } = await request.json();
      if (!imageUrl) return json({ ok:false, error:'Missing imageUrl' }, 400);
      try {
        // Fetch the image bytes
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error('Could not fetch image: ' + imgRes.status);
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
        const imgBytes = await imgRes.arrayBuffer();

        // Upload to Canva Assets API
        const uploadRes = await fetch('https://api.canva.com/rest/v1/assets/upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': mimeType,
            'Asset-Upload-Metadata': JSON.stringify({ name_base64: btoa(name || 'IOL Story Image') }),
          },
          body: imgBytes,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.message || 'Upload failed: ' + uploadRes.status);
        return json({ ok:true, asset_id: uploadData.asset?.id || uploadData.job?.asset?.id });
      } catch(e) { return json({ ok:false, error:e.message }, 500); }
    }

    // ── Canva: create/edit card ────────────────────────────────────
    if (section === 'canva/card' && request.method === 'POST') {
      const token = env.CANVA_TOKEN;
      if (!token) return json({ ok:false, error:'CANVA_TOKEN not set in worker environment. Add it in your Cloudflare Worker dashboard under Settings → Variables.' }, 500);
      try {
        const body = await request.json();
        const result = await createCanvaCard(body, token);
        return json(result);
      } catch(e) { return json({ ok:false, error:e.message }, 500); }
    }

    // ── RSS feeds ──────────────────────────────────────────────────
    try {
      if (section === 'all') {
        const results = await Promise.allSettled(SECTIONS.map(s => fetchSection(s)));
        const stories = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        const seen = new Set();
        const unique = stories.filter(s => { const k=s.headline.toLowerCase().slice(0,60); if(seen.has(k))return false; seen.add(k); return true; });
        return json({ ok:true, count:unique.length, stories:unique });
      }
      if (!SECTIONS.includes(section)) return json({ ok:false, error:'Unknown section' }, 400);
      return json({ ok:true, ...(await (async()=>{ const s=await fetchSection(section); return {count:s.length,section,stories:s}; }))() });
    } catch(e) { return json({ ok:false, error:e.message }, 500); }
  }
};

/* ── Canva card creation via REST API ── */
async function createCanvaCard(body, token) {
  const { type, category, kicker, headline, bodyText, imageUrl, slides } = body;
  const isCarousel = type === 'carousel';
  const templateId = isCarousel ? CAROUSEL_TEMPLATE : SINGLE_CARD_TEMPLATE;

  // 1. Start editing transaction
  const txRes = await canvaAPI('POST', '/rest/v1/designs/' + templateId + '/editing_sessions', {}, token);
  if (!txRes.ok) throw new Error('Could not start Canva editing session: ' + (txRes.data?.message || txRes.status));
  const txId = txRes.data?.editing_session?.id;
  if (!txId) throw new Error('No transaction ID returned from Canva');

  // 2. Upload image if provided
  let assetId = null;
  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl);
      const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
      const imgBytes = await imgRes.arrayBuffer();
      const upRes = await fetch('https://api.canva.com/rest/v1/assets/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': mimeType,
          'Asset-Upload-Metadata': JSON.stringify({ name_base64: btoa('IOL Story Image') }),
        },
        body: imgBytes,
      });
      const upData = await upRes.json();
      assetId = upData.asset?.id;
    } catch(_) { /* continue without image */ }
  }

  // 3. Build operations
  const operations = [];

  if (isCarousel) {
    CAROUSEL_PAGES.forEach((page, i) => {
      const slide = (slides || [])[i] || { kicker: kicker || '', body: headline };
      if (assetId) {
        operations.push({ type:'update_fill', element_id:page.bg, asset_type:'image', asset_id:assetId, alt_text:'IOL story image' });
      }
      if (page.kicker && slide.kicker) {
        operations.push({ type:'replace_text', element_id:page.kicker, text:slide.kicker.toUpperCase() });
      }
      if (slide.body || slide.headline) {
        operations.push({ type:'replace_text', element_id:page.body, text:slide.body || slide.headline || '' });
      }
    });
  } else {
    const page = SINGLE_PAGES.find(p => p.cats.includes(category)) || SINGLE_PAGES[0];
    if (assetId) {
      operations.push({ type:'update_fill', element_id:page.bg, asset_type:'image', asset_id:assetId, alt_text:'IOL story image' });
    }
    if (kicker) operations.push({ type:'replace_text', element_id:page.kicker, text:kicker.toUpperCase() });
    if (headline) operations.push({ type:'replace_text', element_id:page.headline, text:headline });
  }

  // 4. Apply operations
  if (operations.length > 0) {
    const opRes = await canvaAPI('POST', '/rest/v1/designs/' + templateId + '/editing_sessions/' + txId + '/commands', { commands: operations }, token);
    if (!opRes.ok) {
      await canvaAPI('DELETE', '/rest/v1/designs/' + templateId + '/editing_sessions/' + txId, {}, token);
      throw new Error('Could not apply edits: ' + (opRes.data?.message || opRes.status));
    }
  }

  // 5. Commit
  const commitRes = await canvaAPI('POST', '/rest/v1/designs/' + templateId + '/editing_sessions/' + txId + '/publish', {}, token);

  // 6. Get design URL
  const designRes = await canvaAPI('GET', '/rest/v1/designs/' + templateId, {}, token);
  const editUrl   = designRes.data?.design?.urls?.edit_url || 'https://www.canva.com/design/' + templateId;

  // 7. Get thumbnail
  const thumbRes  = await canvaAPI('GET', '/rest/v1/designs/' + templateId + '/pages?limit=1', {}, token);
  const thumbUrl  = thumbRes.data?.items?.[0]?.thumbnail?.url || null;

  return { ok:true, editUrl, thumbnailUrl:thumbUrl };
}

async function canvaAPI(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Authorization':'Bearer '+token, 'Content-Type':'application/json' },
  };
  if (method !== 'GET' && Object.keys(body).length > 0) opts.body = JSON.stringify(body);
  const res  = await fetch('https://api.canva.com' + path, opts);
  const data = await res.json().catch(()=>({}));
  return { ok: res.ok, status: res.status, data };
}

/* ── RSS ── */
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
