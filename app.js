/* ============================================================
   IOL BROADCASTING CONTENT STUDIO — app.js v5
   RSS via Cloudflare Worker (see worker.js for setup)
   API only used for script/podcast generation
   ============================================================ */
'use strict';

const API_URL   = 'https://api.anthropic.com/v1/messages';
const API_MODEL = 'claude-sonnet-4-20250514';

/**
 * SETUP: Deploy worker.js to Cloudflare Workers (free, 2 min).
 * Then replace the URL below with your worker's URL.
 * e.g. 'https://iol-rss.yourname.workers.dev'
 * Leave as empty string to use pre-loaded stories only.
 */
const WORKER_BASE_URL = '';  // <- PASTE YOUR CLOUDFLARE WORKER URL HERE

const SECTIONS = ['news','sport','business','entertainment','technology','motoring','lifestyle'];

const SECTION_META = {
  news:          { cat:'news',          label:'IOL News' },
  sport:         { cat:'sport',         label:'IOL Sport' },
  business:      { cat:'business',      label:'Business Report' },
  entertainment: { cat:'entertainment', label:'Tonight' },
  technology:    { cat:'technology',    label:'IOL Tech' },
  motoring:      { cat:'motoring',      label:'IOL Motoring' },
  lifestyle:     { cat:'lifestyle',     label:'IOL Lifestyle' },
};

/* ============================================================
   PRE-LOADED STORIES — Real IOL stories fetched 25 Apr 2026
   Used when Cloudflare Worker URL is not yet configured.
   Replace WORKER_BASE_URL above for live updates.
   ============================================================ */
const PRELOADED_STORIES = [
  { id:'p0',  cat:'technology', headline:'The Rise of Tokenised Gold: A new era for real-world asset tokenisation',                        excerpt:'The tokenised gold market grew from $1.9bn in 2025 to $7.13bn in 2026, reaching $178bn in trading volume, reshaping investment strategies and institutional finance.',                                        source:'Sunday Independent', time:'Today', url:'https://iol.co.za/sundayindependent/dispatch/2026-04-24-the-rise-of-tokenised-gold-a-new-era-for-real-world-asset-tokenisation/' },
  { id:'p1',  cat:'politics',   headline:'Gauteng Premier Lesufi denies claims of demanding police dockets | Madlanga Commission',         excerpt:'Lesufi denied ordering police to submit sensitive case dockets including one linked to the fatal shooting of engineer Armand Swart, calling the allegations misleading and unsupported.',                      source:'IOL Politics',       time:'Today', url:'https://iol.co.za/news/politics/2026-04-24-gauteng-premier-lesufi-denies-claims-of-demanding-police-dockets--madlanga-commission/' },
  { id:'p2',  cat:'news',       headline:"'We are broken': Family struggles to arrange funeral for seven killed in KZN kidnapping",        excerpt:'Seven Monswamy family members including Allen, 52, wife Sandy, 57, and children Kraidon, 26, and Shamaria, 20 were kidnapped from their Newark home and killed in Melmoth. Three suspects aged 21-28 are in custody.', source:'IOL News',           time:'Today', url:'https://iol.co.za/news/south-africa/2026-04-24-we-are-broken-family-struggles-to-arrange-funeral-for-seven-killed-in-kzn-kidnapping/' },
  { id:'p3',  cat:'news',       headline:'Home Affairs fires seven more officials, total dismissals reach 63 since GNU formed',            excerpt:'Minister Leon Schreiber confirmed 63 total dismissals since July 2024. A further 16 officials remain suspended and the department has initiated 95 misconduct cases with 75 now finalised.',                source:'IOL News',           time:'Today', url:'https://iol.co.za/news/crime-and-courts/2026-04-24-home-affairs-fires-seven-more-officials-for-misconduct-fraud-and-corruption/' },
  { id:'p4',  cat:'politics',   headline:'Dhlamini denies EFF and ActionSA interference in Tshwane metro police procurement',             excerpt:'Suspended Tshwane Metro Police Deputy Chief Dhlamini testified at the Madlanga Commission that two men name-dropped Julius Malema to influence a security tender list, but denied political interference.',   source:'IOL Politics',       time:'Today', url:'https://iol.co.za/news/2026-04-24-umashi-dhlamini-denies-eff-actionsa-political-interference-in-tshwane-metro-police-procurement-processes/' },
  { id:'p5',  cat:'news',       headline:'Seven suspects in court after Hawks bust counterfeit liquor lab in Stutterheim',                 excerpt:'Police seized 514 bottles of fake Gordon\'s Gin, 500 litres of prepared mixture and 200 litres of ethanol worth R350,000 from a clandestine lab. Seven suspects appeared in the Stutterheim Magistrate\'s Court.',       source:'IOL Crime',          time:'Today', url:'https://iol.co.za/news/crime-and-courts/2026-04-24-seven-suspects-in-court-for-running-counterfeit-liquor-lab-in-stutterheim/' },
  { id:'p6',  cat:'news',       headline:'Acting police minister condemns xenophobic attacks on Ghanaian nationals',                       excerpt:'Acting Minister Firoz Cachalia condemned attacks after Ghana summoned SA\'s envoy. Durban\'s CBD was shuttered as businesses reported a total collapse of law and order amid ongoing intimidation.',             source:'IOL News',           time:'Today', url:'https://iol.co.za/news/crime-and-courts/2026-04-24-acting-police-minister-condemns-xenophobic-attacks-on-ghanaian-nationals-warns-perpetrators-will-be-arrested/' },
  { id:'p7',  cat:'news',       headline:"Ghana summons South Africa's envoy over xenophobic incidents targeting Ghanaian nationals",      excerpt:"Ghana's Foreign Minister Ablakwa warned of escalating tensions after a Ghanaian legal resident was told to return home and 'fix his country'. Ghanaians were advised to remain indoors for safety.",          source:'AFP / IOL',          time:'Today', url:'https://iol.co.za/news/africa/2026-04-24-ghana-raps-south-africa-over-xenophobic-incidents/' },
  { id:'p8',  cat:'politics',   headline:'McKenzie defends R2.1 million car hire bill, blames vehicle delivery delays',                   excerpt:'Sport Minister Gayton McKenzie paid R350,000 per month for car hire, citing SAPS threat assessments requiring a security convoy. He says permanent ministerial vehicles ordered mid-2025 have not yet arrived.', source:'IOL Politics',       time:'Today', url:'https://iol.co.za/news/politics/2026-04-24-mckenzie-defends-r21-million-car-hire-amid-vehicle-delivery-delays/' },
  { id:'p9',  cat:'news',       headline:'Cold front to bring snow and icy temperatures to South Africa this weekend',                    excerpt:'SAWS warns a well-developed cold front will hit the Western Cape and Northern Cape from Sunday, with snow possible over mountain ranges and temperatures as low as 10°C over the Karoo Hoogland.',            source:'IOL Weather',        time:'Today', url:'https://iol.co.za/news/weather/2026-04-24-cold-front-brings-rain-and-icy-temperatures-to-south-africa-this-weekend/' },
  { id:'p10', cat:'news',       headline:'James Cumalo sentenced to life plus 38 years for Dullstroom guesthouse murder of tourist',      excerpt:'Mozambican national Cumalo shot tourist John Wickham dead during a robbery at a Dullstroom guesthouse in November 2023, hitchhiking from Pretoria with intent to rob. He also pleaded guilty to unlawful possession of a firearm.',  source:'IOL Crime',          time:'Today', url:'https://iol.co.za/news/crime-and-courts/2026-04-24-james-cumalo-receives-life-sentence-for-the-murder-of-tourist-john-wickham/' },
  { id:'p11', cat:'news',       headline:'Public servants across salary levels 1-12 to receive 4% salary increase from April 2026',       excerpt:'Minister Buthelezi announced the 4% cost-of-living adjustment under PSCBC Resolution 1 of 2025, effective April 1, exceeding the 3.4% inflation forecast for the period.',                                  source:'IOL News',           time:'Today', url:'https://iol.co.za/news/south-africa/2026-04-24-public-servants-to-receive-4-salary-increase-from-april/' },
  { id:'p12', cat:'politics',   headline:'Mkhwanazi and Lerutla to spend long weekend in jail as bail hearing postponed to Tuesday',      excerpt:'Suspended EMPD acting chief Julius Mkhwanazi and Ekurhuleni City Manager Kagiso Lerutla remain in custody. Mkhwanazi faces fraud and corruption over an alleged 2019 deal to fix Lerutla\'s speeding case for R400,000.',  source:'IOL Politics',       time:'Today', url:'https://iol.co.za/news/politics/2026-04-24-mkhwanazi-and-lerutla-face-long-weekend-in-jail-after-bail-hearing-is-postponed/' },
  { id:'p13', cat:'news',       headline:"Mugabe shooting: Victim received R250,000 in hush money, was promised further R150,000",        excerpt:"Robert Mugabe's youngest son Bellarmine, 28, and cousin Tobias Matonhodze paid shooting victim Sipho Mahlangu R250,000 with R150,000 more promised. Both pleaded guilty and await sentencing.",               source:'IOL News',           time:'Today', url:'https://iol.co.za/news/mugabe-shooting-victim-paid-r250000-and-offered-additional-r150000/' },
  { id:'p14', cat:'news',       headline:'El Niño set to return mid-2026 with potentially strong event, UN weather agency warns',         excerpt:'The WMO says El Niño is likely by the May-July window. The previous El Niño made 2023 the second-hottest year on record and contributed to 2024 becoming the all-time warmest year globally.',               source:'AFP / IOL',          time:'Today', url:'https://iol.co.za/news/weather/2026-04-24-warming-el-nino-set-to-return-in-mid-2026/' },
  { id:'p15', cat:'politics',   headline:'Motsoaledi announces R20 million to plan replacement for Dr George Mukhari Academic Hospital',  excerpt:'Health Minister Motsoaledi confirmed R20m for the 2026/27 planning phase of a new hospital in Ga-Rankuwa to replace the existing facility — announced by Ramaphosa in his 2026 SONA.',                       source:'IOL Politics',       time:'Today', url:'https://iol.co.za/news/politics/2026-04-24-motsoaledi-announces-funding-plans-for-new-dr-george-mukhari-academic-hospital-in-gauteng/' },
  { id:'p16', cat:'news',       headline:'ETDP SETA cannot account for R637 million; paid R690,000 monthly for vacant building',          excerpt:"Parliament's Higher Education Committee raised alarm after the ETDP SETA failed to document R637m in discretionary spending and was paying R690,000 per month rent for a building where staff were working from home.", source:'IOL News',           time:'Today', url:'https://iol.co.za/news/south-africa/2026-04-24-etdp-seta-under-fire-over-r637-million-audit-findings/' },
  { id:'p17', cat:'news',       headline:'eThekwini opens four criminal cases after R912,000 in infrastructure theft including copper',   excerpt:'Cases include the theft of five tons of mixed copper worth R900,000 in Hammarsdale. eThekwini separately reported a R2.9 billion water loss in the 2024/25 financial year.',                                source:'IOL KZN',            time:'Today', url:'https://iol.co.za/news/south-africa/kwazulu-natal/2026-04-24-ethekwini-municipality-reports-over-r900000-theft-amid-service-delivery-challenges/' },
];

/* ---- STATE ---- */
let allStories        = [];
let selectedIds       = new Set();
let currentFilter     = 'all';
let selectedPlatforms = new Set(['Spotify']);

function getApiKey() { return (localStorage.getItem('iol_api_key') || '').trim(); }
function hasWorker()  { return WORKER_BASE_URL && WORKER_BASE_URL.trim().length > 0; }

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

/* ============================================================
   LOAD STORIES
   ============================================================ */
async function loadStories(isRefresh = false) {
  const grid     = document.getElementById('stories-grid');
  const info     = document.getElementById('last-refresh');
  const statusEl = document.getElementById('feed-status');

  if (!hasWorker()) {
    // No worker configured — use pre-loaded stories
    allStories = [...PRELOADED_STORIES];
    statusEl.textContent = `● ${allStories.length} IOL stories (configure Worker for live updates)`;
    statusEl.className   = 'feed-status fallback';
    info.textContent     = 'Pre-loaded: 25 Apr 2026';
    renderStories();
    updateWorkerBanner(false);
    return;
  }

  // Worker configured — fetch live
  if (isRefresh) {
    grid.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div><p>Fetching live IOL stories...</p></div>';
    selectedIds.clear();
    updateActionBar();
  }
  info.textContent = 'Fetching...';

  try {
    const res  = await fetch(`${WORKER_BASE_URL.replace(/\/$/, '')}/all`, { signal: AbortSignal.timeout(12000) });
    const data = await res.json();
    if (!data.ok || !data.stories || data.stories.length < 3) throw new Error(data.error || 'Empty response');

    allStories = data.stories.map((s, i) => ({
      id:      `live-${i}`,
      cat:     s.category || 'news',
      headline: s.headline,
      excerpt:  s.excerpt || '',
      source:   s.source || 'IOL',
      time:     relTime(s.pubDate),
      url:      s.url || 'https://www.iol.co.za',
    }));

    statusEl.textContent = `● LIVE — ${allStories.length} IOL stories`;
    statusEl.className   = 'feed-status live';
    info.textContent     = 'Updated ' + new Date().toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' });
    updateWorkerBanner(true);
  } catch (e) {
    console.error('Worker fetch failed:', e);
    allStories = [...PRELOADED_STORIES];
    statusEl.textContent = '● Pre-loaded stories (worker unavailable)';
    statusEl.className   = 'feed-status fallback';
    info.textContent     = 'Live fetch failed';
    updateWorkerBanner(false);
  }

  renderStories();
}

function updateWorkerBanner(isLive) {
  let banner = document.getElementById('worker-banner');
  if (!hasWorker()) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'worker-banner';
      banner.style.cssText = 'background:rgba(255,180,0,0.08);border:1px solid rgba(255,180,0,0.3);border-radius:3px;padding:10px 14px;margin-bottom:1rem;font-size:12px;color:#ffb400;font-family:var(--font-mono);line-height:1.7';
      banner.innerHTML = '⚡ <strong style="color:#ffd060">Live updates not configured.</strong> Deploy <code>worker.js</code> to Cloudflare Workers (free), then paste your URL into <code>app.js</code> where it says <code>WORKER_BASE_URL</code>. See <strong>Settings</strong> tab for full instructions.';
      const panel = document.querySelector('#panel-newsfeed .panel-inner');
      panel.insertBefore(banner, panel.firstChild);
    }
  } else if (banner) {
    banner.remove();
  }
}

function relTime(dateStr) {
  if (!dateStr) return 'Today';
  try {
    const m = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (m < 1)    return 'Just now';
    if (m < 60)   return m + 'm ago';
    if (m < 1440) return Math.floor(m/60) + 'h ago';
    return Math.floor(m/1440) + 'd ago';
  } catch { return 'Today'; }
}

/* ============================================================
   RENDER STORIES
   ============================================================ */
function renderStories() {
  const grid = document.getElementById('stories-grid');
  const filtered = currentFilter === 'all'
    ? allStories
    : allStories.filter(s => s.cat === currentFilter);

  if (!filtered.length) {
    grid.innerHTML = '<div class="loading-placeholder"><p>No stories in this category.</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(s =>
    `<div class="story-card ${selectedIds.has(s.id) ? 'selected' : ''}" data-id="${escAttr(s.id)}" tabindex="0" role="checkbox" aria-checked="${selectedIds.has(s.id)}">
      <div class="story-check" aria-hidden="true">✓</div>
      <div class="story-tag">${escHtml(s.cat)}</div>
      <div class="story-headline">${escHtml(s.headline)}</div>
      ${s.excerpt ? `<div class="story-excerpt">${escHtml(s.excerpt)}</div>` : ''}
      <div class="story-meta">
        <span class="story-source">${escHtml(s.source)}</span>
        <span>·</span>
        <span>${escHtml(s.time)}</span>
      </div>
    </div>`
  ).join('');

  grid.querySelectorAll('.story-card').forEach(card => {
    card.addEventListener('click', () => toggleStory(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key===' '||e.key==='Enter') toggleStory(card.dataset.id); });
  });
}

function toggleStory(id) {
  selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
  const card = document.querySelector(`.story-card[data-id="${id}"]`);
  if (card) { card.classList.toggle('selected'); card.setAttribute('aria-checked', selectedIds.has(id)); }
  updateActionBar();
}

function updateActionBar() {
  const n = selectedIds.size;
  document.getElementById('selected-count').textContent = n + ' selected';
  document.getElementById('action-count').textContent   = n + ' stor' + (n===1?'y':'ies');
  document.getElementById('gen-bulletin-btn').disabled  = n === 0;
}

function filterFeed(cat) {
  currentFilter = cat;
  document.querySelectorAll('#cat-pills-feed .cat-pill').forEach(p => p.classList.toggle('active', p.dataset.cat===cat));
  renderStories();
}

function selectAll() {
  (currentFilter==='all' ? allStories : allStories.filter(s=>s.cat===currentFilter)).forEach(s=>selectedIds.add(s.id));
  renderStories(); updateActionBar();
}
function clearAll() { selectedIds.clear(); renderStories(); updateActionBar(); }

/* ============================================================
   GENERATE BULLETIN SCRIPT
   ============================================================ */
document.getElementById('gen-bulletin-btn').addEventListener('click', async () => {
  const apiKey = getApiKey();
  if (!apiKey) { showSettingsAlert(); return; }

  const stories  = allStories.filter(s => selectedIds.has(s.id));
  const style    = document.getElementById('anchor-style').value;
  const duration = document.getElementById('script-duration').value;
  showState('bulletin', 'loading');

  const storyContext = stories.map((s, i) => [
    `STORY ${i+1} [${s.cat.toUpperCase()}]`,
    `Headline: ${s.headline}`,
    s.excerpt ? `Details: ${s.excerpt}` : '',
    `Source: ${s.source}`,
  ].filter(Boolean).join('\n')).join('\n\n---\n\n');

  const styleGuides = {
    formal:         'FORMAL / EVENING NEWS — Authoritative, measured, BBC/SABC style. Full sentences, no slang.',
    conversational: 'CONVERSATIONAL / DAYTIME — Warm, direct. Contractions fine. Speak TO the viewer.',
    energetic:      'ENERGETIC / SOCIAL MEDIA — Hook with the first word. Short punchy sentences. High energy.',
    investigative:  'INVESTIGATIVE — Analytical, evidence-first. Signal significance before facts.',
  };
  const words = Math.round((parseInt(duration)/60)*150);

  const prompt = `You are a senior broadcast journalist for IOL Broadcasting — South Africa's leading digital news network.

Write a ${duration}-second piece-to-camera bulletin script (~${words} words of spoken copy) covering ALL ${stories.length} of these specific stories. Use the real names, numbers and facts from each story. Do not invent content or add generic filler.

════════════════════════════════════
STORIES TO COVER:
════════════════════════════════════
${storyContext}
════════════════════════════════════

STYLE: ${styleGuides[style]||styleGuides.formal}

FORMAT:
- Label every line of copy "ANCHOR:"
- Stage directions in [SQUARE BRACKETS] — e.g. [PAUSE], [GRAPHIC: text], [LOOK TO CAMERA 2], [B-ROLL CUE]
- Open with the most gripping specific detail from the lead story — hook in 5 words
- Use transitions: "Also tonight...", "In sport...", "Turning to politics...", "On the business front..."
- Each story gets dedicated copy using specific details from its excerpt
- Close: "For the full story visit iol.co.za — I'm [ANCHOR NAME], stay informed."
- ~${words} words of spoken copy total

Output ONLY the formatted script. No preamble.`;

  try {
    const text = await callClaude(apiKey, prompt, 1500);
    document.getElementById('bulletin-script-text').textContent = text;
    document.getElementById('bulletin-meta').textContent = `${stories.length} stories · ${duration}s · ${style}`;
    showState('bulletin', 'result');
  } catch(e) { showState('bulletin', 'error', e.message); }
});

/* ============================================================
   GENERATE CUSTOM SCRIPT
   ============================================================ */
document.getElementById('gen-custom-btn').addEventListener('click', async () => {
  const apiKey = getApiKey();
  if (!apiKey) { showSettingsAlert(); return; }

  const headline     = document.getElementById('custom-headline').value.trim();
  const content      = document.getElementById('custom-content').value.trim();
  const category     = document.getElementById('custom-category').value;
  const style        = document.getElementById('custom-style').value;
  const duration     = document.getElementById('custom-duration').value;
  const platform     = document.getElementById('custom-platform').value;
  const anchors      = document.getElementById('custom-anchors').value;
  const instructions = document.getElementById('custom-instructions').value.trim();

  if (!headline && !content) { alert('Please enter at least a headline or story content.'); return; }
  showState('custom', 'loading');

  const styleGuides = { formal:'FORMAL / EVENING NEWS', conversational:'CONVERSATIONAL / DAYTIME', energetic:'ENERGETIC / SOCIAL MEDIA', investigative:'INVESTIGATIVE' };
  const words = Math.round((parseInt(duration)/60)*150);
  const anchorSetup = anchors==='2'
    ? 'TWO co-anchors: label all copy "ANCHOR 1:" or "ANCHOR 2:". Anchor 1 sets context, Anchor 2 delivers key facts and closes.'
    : 'SINGLE anchor. Label all copy "ANCHOR:".';
  const ctas = { 'TikTok':'Follow IOL on TikTok now.','Instagram Reels':'Full story in the link in our bio. Follow IOL.','YouTube':'Subscribe to IOL on YouTube.','Facebook':'Like and follow IOL on Facebook.','Twitter / X':'Follow @IOL on X for live updates.','LinkedIn':'Follow IOL on LinkedIn.','all social media platforms':'For the full story, visit iol.co.za.' };

  const prompt = `You are a senior broadcast journalist for IOL Broadcasting, South Africa.

Write a ${duration}-second (~${words} words) piece-to-camera script for this specific story. Every sentence must reference real details — names, places, figures — from the content below.

════════════════════════════════
STORY:
Headline: ${headline||'(see content)'}
Category: ${category}
Content: ${content||'(write specifically from the headline)'}
${instructions?`Instructions: ${instructions}`:''}
════════════════════════════════

ANCHORS: ${anchorSetup}
STYLE: ${styleGuides[style]||'FORMAL / EVENING NEWS'}
PLATFORM: ${platform}
END CTA: ${ctas[platform]||ctas['all social media platforms']}

FORMAT:
- Hook in the FIRST 5 WORDS with the most gripping specific detail
- Stage directions in [SQUARE BRACKETS]
- ~${words} words of spoken copy
- IOL-branded sign-off with the CTA above

Output ONLY the formatted script.`;

  try {
    const text = await callClaude(apiKey, prompt, 1500);
    document.getElementById('custom-script-text').textContent = text;
    showState('custom', 'result');
  } catch(e) { showState('custom', 'error', e.message); }
});

/* ============================================================
   GENERATE PODCAST CONCEPT
   ============================================================ */
document.getElementById('gen-podcast-btn').addEventListener('click', async () => {
  const apiKey = getApiKey();
  if (!apiKey) { showSettingsAlert(); return; }

  const category  = document.getElementById('pod-category').value;
  const audience  = document.getElementById('pod-audience').value;
  const frequency = document.getElementById('pod-frequency').value;
  const length    = document.getElementById('pod-length').value;
  const hosts     = document.getElementById('pod-hosts').value;
  const hook      = document.getElementById('pod-hook').value.trim();
  const inspo     = document.getElementById('pod-inspiration').value.trim();
  const platforms = Array.from(selectedPlatforms).join(', ') || 'Spotify';
  showState('podcast', 'loading');

  const prompt = `You are a podcast strategy consultant for IOL, South Africa's #1 digital news platform. Create a detailed, actionable podcast concept for the SA market in 2026.

BRIEF: Category: ${category} | Audience: ${audience} | Frequency: ${frequency} | Length: ${length} | Hosts: ${hosts} | Platforms: ${platforms}${hook?` | Angle: ${hook}`:''}${inspo?` | Inspiration: ${inspo}`:''}

Respond ONLY with raw JSON (no markdown fences, no preamble):
{"showName":"2-5 word SA-rooted name","tagline":"punchy line under 12 words","elevator_pitch":"3 sentences: what it is, who it's for, why now","why_it_works":"3 SA-specific sentences on why this works for ${audience} on ${platforms}","format":"3-4 sentences on structure and tone","timeline":[{"time":"00:00-02:00","segment":"name","description":"what happens"},{"time":"02:00-08:00","segment":"name","description":"what happens"},{"time":"08:00-18:00","segment":"name","description":"what happens"},{"time":"18:00-25:00","segment":"name","description":"what happens"},{"time":"25:00-30:00","segment":"name","description":"what happens"}],"sample_episodes":[{"ep":"01","title":"title","description":"2 specific sentences"},{"ep":"02","title":"title","description":"2 specific sentences"},{"ep":"03","title":"title","description":"2 specific sentences"},{"ep":"04","title":"title","description":"2 specific sentences"}],"guest_strategy":[{"type":"category","examples":"4 real SA names or institutions"},{"type":"category","examples":"4 real SA names or institutions"},{"type":"category","examples":"4 real SA names or institutions"}],"platform_strategy":{"primary":"${platforms.split(',')[0].trim()}","tactics":"3 specific SA tactics for ${platforms}","repurposing":"how to turn 1 episode into 4-5 social pieces"},"monetisation":"3 SA-specific pathways with example brands","launch_plan":"4 concrete month-1 steps","risk_factors":"2 SA-specific risks and mitigations"}`;

  try {
    let raw = await callClaude(apiKey, prompt, 2000);
    raw = raw.replace(/```json|```/g,'').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No valid JSON returned. Please try again.');
    renderPodcast(JSON.parse(m[0]), platforms);
    showState('podcast', 'result');
  } catch(e) { showState('podcast', 'error', 'Error: '+e.message); }
});

/* ============================================================
   RENDER PODCAST
   ============================================================ */
function renderPodcast(pod, platforms) {
  const bm = {'Spotify':'badge-spotify','Apple Podcasts':'badge-apple','YouTube':'badge-youtube','IOL Website':'badge-iol','TikTok':'badge-tiktok','Instagram':'badge-instagram','Facebook':'badge-facebook'};
  const badges   = platforms.split(',').map(p=>`<span class="platform-badge ${bm[p.trim()]||'badge-default'}">${escHtml(p.trim())}</span>`).join('');
  const timeline = (pod.timeline||[]).map(t=>`<tr><td class="timeline-time">${escHtml(t.time)}</td><td class="timeline-seg">${escHtml(t.segment)}</td><td class="timeline-desc">${escHtml(t.description)}</td></tr>`).join('');
  const episodes = (pod.sample_episodes||[]).map(e=>`<div class="episode-row"><div class="episode-num">EP.${escHtml(e.ep)}</div><div class="episode-title">${escHtml(e.title)}</div><div class="episode-desc">${escHtml(e.description)}</div></div>`).join('');
  const guests   = (pod.guest_strategy||[]).map(g=>`<div class="guest-row"><div class="guest-type">${escHtml(g.type)}</div><div class="guest-examples">${escHtml(g.examples)}</div></div>`).join('');
  const sec      = (t,c)=>`<div class="pod-section"><div class="pod-section-title">${t}</div><div class="pod-section-content">${c}</div></div>`;

  document.getElementById('pod-output-title').textContent = pod.showName||'Your Podcast';
  document.getElementById('pod-output-meta').textContent  = pod.tagline||'';
  document.getElementById('podcast-body').innerHTML =
    sec('Concept', escHtml(pod.elevator_pitch||''))
    + `<div class="pod-section"><div class="pod-section-title">Why It Works</div><div class="pod-section-content">${escHtml(pod.why_it_works||'')}</div><div class="platform-badges" style="margin-top:10px">${badges}</div></div>`
    + sec('Show Format', escHtml(pod.format||''))
    + `<div class="pod-section"><div class="pod-section-title">Episode Structure</div><table class="timeline-table"><tbody>${timeline}</tbody></table></div>`
    + `<div class="pod-section"><div class="pod-section-title">Sample Episodes</div>${episodes}</div>`
    + `<div class="pod-section"><div class="pod-section-title">Guest Strategy</div>${guests}</div>`
    + `<div class="pod-section"><div class="pod-section-title">Platform Strategy</div><div class="pod-section-content">${escHtml(pod.platform_strategy?.tactics||'')}</div><div class="strategy-box" style="margin-top:10px"><div class="strategy-label">Content Repurposing</div><div class="strategy-text">${escHtml(pod.platform_strategy?.repurposing||'')}</div></div></div>`
    + sec('Monetisation', escHtml(pod.monetisation||''))
    + sec('Launch Plan', escHtml(pod.launch_plan||''))
    + `<div class="pod-section"><div class="pod-section-title">Risk Factors &amp; Mitigation</div><div class="pod-section-content">${escHtml(pod.risk_factors||'')}</div></div>`;
}

/* ============================================================
   CLAUDE API
   ============================================================ */
async function callClaude(apiKey, prompt, maxTokens=1500) {
  const res = await fetch(API_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:API_MODEL, max_tokens:maxTokens, messages:[{role:'user',content:prompt}]}),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    const msg = err?.error?.message||'HTTP '+res.status;
    if (res.status===401) throw new Error('Invalid API key — check Settings.');
    if (res.status===429) throw new Error('Rate limit — wait a moment and try again.');
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
}

/* ============================================================
   UI STATE
   ============================================================ */
function showState(prefix, state, errMsg) {
  const els = {
    loading:     document.getElementById(prefix+'-loading'),
    placeholder: document.getElementById(prefix+'-placeholder'),
    error:       document.getElementById(prefix+'-error'),
    result:      document.getElementById(prefix==='podcast'?'podcast-body':prefix+'-script-text'),
  };
  Object.values(els).forEach(el=>{ if(el) el.style.display='none'; });
  if (state==='loading')     { if(els.loading)     els.loading.style.display='flex'; }
  else if (state==='result') { if(els.result)      els.result.style.display='block'; }
  else if (state==='error')  {
    if(els.error)       { els.error.textContent=errMsg||'An error occurred.'; els.error.style.display='block'; }
    if(els.placeholder) els.placeholder.style.display='block';
  }
}

function showSettingsAlert() {
  alert('Please add your Anthropic API key in the ⚙️ Settings tab first.');
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('panel-settings').classList.add('active');
  setTimeout(()=>document.getElementById('api-key-input').focus(),100);
}

/* ============================================================
   COPY & DOWNLOAD
   ============================================================ */
document.addEventListener('click', e => {
  if (e.target.classList.contains('copy-btn')) {
    const el = document.getElementById(e.target.dataset.target);
    if (!el) return;
    const t = (el.innerText||el.textContent||'').trim();
    if (!t) { flashBtn(e.target,'Nothing to copy'); return; }
    navigator.clipboard.writeText(t).then(()=>flashBtn(e.target,'✓ Copied!')).catch(()=>flashBtn(e.target,'Failed'));
  }
  if (e.target.classList.contains('download-btn')) {
    const el = document.getElementById(e.target.dataset.target);
    if (!el) return;
    const t = (el.innerText||el.textContent||'').trim();
    if (!t) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));
    a.download = e.target.dataset.filename||'iol-script.txt';
    a.click(); URL.revokeObjectURL(a.href);
  }
});
function flashBtn(btn,msg){ const o=btn.textContent; btn.textContent=msg; setTimeout(()=>btn.textContent=o,1800); }

/* ============================================================
   SETTINGS
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('iol_api_key');
  if (saved) { document.getElementById('api-key-input').value=saved; setKeyStatus('● Key loaded','ok'); }

  // Show worker URL if configured
  const workerInput = document.getElementById('worker-url-input');
  if (workerInput) {
    workerInput.value = WORKER_BASE_URL;
    if (WORKER_BASE_URL) workerInput.style.borderColor = 'rgba(0,200,100,0.5)';
  }
});

document.getElementById('save-api-key-btn').addEventListener('click', () => {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) { setKeyStatus('Enter an API key','err'); return; }
  if (!key.startsWith('sk-ant-')) { setKeyStatus('⚠ Should start with sk-ant-...','err'); return; }
  localStorage.setItem('iol_api_key', key);
  setKeyStatus('● Saved','ok');
});
function setKeyStatus(msg,cls){ const el=document.getElementById('api-key-status'); el.textContent=msg; el.className='api-key-status '+cls; }

document.getElementById('test-feed-btn').addEventListener('click', async () => {
  const btn=document.getElementById('test-feed-btn'), statusEl=document.getElementById('feed-status-settings');
  btn.disabled=true; btn.textContent='Testing...';
  statusEl.textContent='Testing...'; statusEl.className='status-unknown';

  if (!hasWorker()) {
    statusEl.textContent='No Cloudflare Worker URL configured — see instructions below';
    statusEl.className='status-err';
    btn.disabled=false; btn.textContent='Test Feed Connection';
    return;
  }

  try {
    const res  = await fetch(`${WORKER_BASE_URL.replace(/\/$/,'')}/news`, { signal:AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.ok && data.stories?.length > 0) {
      statusEl.textContent = `✓ Worker live — ${data.stories.length} IOL news stories fetched`;
      statusEl.className = 'status-ok';
    } else {
      statusEl.textContent = 'Worker responded but returned no stories: ' + (data.error||'unknown');
      statusEl.className = 'status-err';
    }
  } catch(e) {
    statusEl.textContent = 'Worker unreachable: ' + e.message;
    statusEl.className = 'status-err';
  }
  btn.disabled=false; btn.textContent='Test Feed Connection';
});

/* ============================================================
   EVENT BINDINGS
   ============================================================ */
document.getElementById('cat-pills-feed').addEventListener('click', e => { if(e.target.classList.contains('cat-pill')) filterFeed(e.target.dataset.cat); });
document.getElementById('select-all-btn').addEventListener('click', selectAll);
document.getElementById('clear-btn').addEventListener('click', clearAll);
document.getElementById('refresh-btn').addEventListener('click', () => loadStories(true));
document.getElementById('pod-platforms').addEventListener('click', e => {
  if (e.target.classList.contains('platform-pill')) {
    const p=e.target.dataset.platform;
    selectedPlatforms.has(p)?(selectedPlatforms.delete(p),e.target.classList.remove('active')):(selectedPlatforms.add(p),e.target.classList.add('active'));
  }
});

/* ============================================================
   UTILITY
   ============================================================ */
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function escAttr(s){ return escHtml(s); }

/* ============================================================
   INIT
   ============================================================ */
loadStories(false);
