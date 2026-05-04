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
const WORKER_BASE_URL = 'https://ioltester.fhmkhota.workers.dev';

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
    // No worker configured — use pre-loaded stories immediately
    visibleCount = PAGE_SIZE;
  allStories = [...PRELOADED_STORIES];
    if (statusEl) { statusEl.textContent = '\u25cf ' + allStories.length + ' IOL stories loaded'; statusEl.className = 'feed-status live'; }
    if (info)     { info.textContent = 'Pre-loaded \u00b7 25 Apr 2026'; }
    renderStories();
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
  } catch (e) {
    console.error('Worker fetch failed:', e);
    allStories = [...PRELOADED_STORIES];
    statusEl.textContent = '● Pre-loaded stories (worker unavailable)';
    statusEl.className   = 'feed-status fallback';
    info.textContent     = 'Live fetch failed';
  }

  renderStories();
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
const PAGE_SIZE = 10;
let visibleCount = PAGE_SIZE;

function renderStories() {
  const grid = document.getElementById('stories-grid');
  const filtered = currentFilter === 'all'
    ? allStories
    : allStories.filter(s => s.cat === currentFilter);

  if (!filtered.length) {
    grid.innerHTML = '<div class="loading-placeholder"><p>No stories in this category.</p></div>';
    return;
  }

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const cards = visible.map(s =>
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

  const loadMore = hasMore
    ? `<div style="grid-column:1/-1;text-align:center;padding:1rem 0">
        <button class="btn btn-outline" id="load-more-btn" style="min-width:180px">
          Load More (${filtered.length - visibleCount} remaining)
        </button>
       </div>`
    : '';

  grid.innerHTML = cards + loadMore;

  grid.querySelectorAll('.story-card').forEach(card => {
    card.addEventListener('click', () => toggleStory(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key===' '||e.key==='Enter') toggleStory(card.dataset.id); });
  });

  const lmBtn = document.getElementById('load-more-btn');
  if (lmBtn) lmBtn.addEventListener('click', () => { visibleCount += PAGE_SIZE; renderStories(); });
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
  visibleCount = PAGE_SIZE;
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
    social:         'SOCIAL / TIKTOK-FIRST — Casual, reactive, conversational. Like texting a friend but on camera.',
    conversational: 'CONVERSATIONAL / INSTAGRAM — Warm and direct. Relatable. Feels like a creator talking to their community.',
    energetic:      'HIGH ENERGY / REELS — Fast, punchy, hype. Every sentence lands hard. Maximum retention energy.',
    investigative:  'DEEP DIVE — Still casual but slower and more serious. Lean into the "wait, this is actually crazy" angle.',
  };
  const words = Math.round((parseInt(duration)/60)*150);

  const prompt = `You are writing a social media video script for an IOL content creator — think the style of NewsDaddy (Dylan Page) on TikTok, or the BBC's social news reporters on Instagram Reels. This is NOT a formal news broadcast. It is casual, direct, conversational storytelling for a social-first audience.

The host is on camera, speaking directly to the viewer like a friend telling them something wild they just heard. They are energetic, natural, relatable — NOT a news anchor reading a teleprompter.

Write a ${duration}-second social news script covering ALL ${stories.length} of these specific stories. Use the real names, numbers and facts provided. Make it feel like the host genuinely cares about these stories and wants to share them.

════════════════════════════════════
STORIES TO COVER:
════════════════════════════════════
${storyContext}
════════════════════════════════════

STYLE: ${styleGuides[style]||styleGuides.social}

SCRIPT RULES:
1. Label every line "HOST:" — no "ANCHOR", no formal broadcast language
2. HOOK: First 5 words must stop the scroll. Start mid-thought, with a reaction, a shocking fact, or a question. E.g. "So the Hawks literally just—" or "You will not believe what—" or "R637 million. Gone. No receipts."
3. For each story: state what happened, why it matters, add a natural human reaction ("and honestly that's wild", "which — come on", "I cannot make this up")
4. Speak in SHORT sentences. One idea per breath. No sub-clauses.
5. Use transitions that feel spoken: "Okay moving on—", "Right, next story—", "And then there's this—"
6. Stage directions in [SQUARE BRACKETS] — [point to camera], [shake head], [pause for effect], [lean in], [raise eyebrows]
7. End with an engagement hook: ask viewers a question, tell them to comment, or tease "link in bio for the full story on iol.co.za"
8. ~${words} words total. Punchy. No wasted words.

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

  const styleGuides = {
    social:         'SOCIAL / TIKTOK-FIRST — Casual, reactive, like texting a friend but on camera. Reactions welcome.',
    conversational: 'CONVERSATIONAL / INSTAGRAM — Warm, relatable, like a creator talking to their community.',
    energetic:      'HIGH ENERGY / REELS — Fast, punchy, every sentence hits hard. Maximum scroll-stopping energy.',
    investigative:  'DEEP DIVE — Casual but slower and deliberate. Lean into the "wait, this is actually insane" angle.',
  };
  const words = Math.round((parseInt(duration)/60)*150);
  const hostSetup = anchors==='2'
    ? 'TWO hosts on camera. Label all lines "HOST 1:" or "HOST 2:". They react to each other naturally — one drops the fact, the other reacts, they riff. Feels like a conversation not a handoff.'
    : 'SINGLE HOST on camera. Label all lines "HOST:".';
  const ctas = {
    'TikTok':                    'End with: "Follow IOL on TikTok for more — and drop your thoughts in the comments 👇"',
    'Instagram Reels':           'End with: "Full story link in our bio. Follow IOL for daily updates."',
    'YouTube':                   'End with: "Subscribe to IOL on YouTube — we post every day."',
    'Facebook':                  'End with: "Follow IOL on Facebook and share this if it surprised you."',
    'Twitter / X':               'End with: "Follow @IOL on X — what do you think about this? Reply below."',
    'LinkedIn':                  'End with: "Follow IOL on LinkedIn for the stories that matter."',
    'all social media platforms':'End with: "Follow IOL for more — full story at iol.co.za"',
  };

  const prompt = `You are writing a social media video script for an IOL content creator. Think NewsDaddy, BBC social reporters, or any creator who explains news casually on camera to their followers. NOT a news anchor. NOT a broadcast journalist. A real person telling another person something they need to know.

Write a ${duration}-second (~${words} words) script for this specific story. Every sentence must be grounded in the real facts below. Make the host sound human, not robotic.

════════════════════════════════
STORY:
Headline: ${headline||'(see content)'}
Category: ${category}
Content: ${content||'(write specifically from the headline — be specific and factual)'}
${instructions?`Extra notes: ${instructions}`:''}
════════════════════════════════

HOST FORMAT: ${hostSetup}
STYLE: ${styleGuides[style]||styleGuides.social}
PLATFORM: ${platform}
${ctas[platform]||ctas['all social media platforms']}

SCRIPT RULES:
1. HOOK: First 5 words stop the scroll. Start mid-story, with shock, a question, or a reaction. Never start with "So today..." or "Welcome back..."
2. Tell the story conversationally — what happened, why it matters, what the host thinks
3. SHORT sentences. One idea at a time. Real spoken rhythm.
4. Natural reactions in the copy: "which is wild", "I cannot make this up", "and that's just the start"
5. Stage directions in [SQUARE BRACKETS] — [lean in], [point to camera], [pause], [raise eyebrows], [shake head]
6. ${ctas[platform]||ctas['all social media platforms']}
7. ~${words} words total

Output ONLY the formatted script. No preamble.`;

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
  const key = prompt('Enter your Anthropic API key (starts with sk-ant-):', '');
  if (key && key.trim().startsWith('sk-ant-')) {
    localStorage.setItem('iol_api_key', key.trim());
    alert('API key saved. Generating now...');
    return true;
  } else if (key) {
    alert('That does not look like a valid Anthropic key. Please try again.');
  }
  return false;
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

/* ============================================================
   SOCIAL CARD CREATOR v4
   Uses Canva MCP via Anthropic API.

   SINGLE CARD template: DAGsALPE-hs (17 pages, 940x788)
   - Pages 1-8: Standard news cards
     Each page has: background image fill, kicker text, headline text
   - The app picks the best matching page for the story category
     then uploads the story image + replaces text

   CAROUSEL template: DAG5Z_3B2HU (6 pages, 940x788)
   - Each page: background image fill, headline text, body text
   ============================================================ */

const CANVA_MCP_URL        = 'https://mcp.canva.com/mcp';
const CANVA_SINGLE_CARD_ID = 'DAGsALPE-hs';
const CANVA_CAROUSEL_ID    = 'DAG5Z_3B2HU';

// Single card template — pages 1-8 are the news card layouts
// Structure: { page_index, bg_element_id, kicker_element_id, headline_element_id }
const SINGLE_CARD_PAGES = [
  { page_index:1, bg:'PB3G33JqztQyvPnq', kicker:'PB3G33JqztQyvPnq-LB7BLVLxpY1KmLSb', headline:'PB3G33JqztQyvPnq-LBqQ3M5KHVFY70H8', cats:['news','politics'] },
  { page_index:2, bg:'PBzm7yl998KDMs8b', kicker:'PBzm7yl998KDMs8b-LB9N2gDpDrMyPPDw', headline:'PBzm7yl998KDMs8b-LB1J5GY6gtyCkp2z', cats:['business','technology'] },
  { page_index:3, bg:'PBCksVDDkCgS1WPV', kicker:'PBCksVDDkCgS1WPV-LB5jLF9fcydby1jK', headline:'PBCksVDDkCgS1WPV-LB7j5CJjGXh5kthr', cats:['news'] },
  { page_index:4, bg:'PBJvqQV59MZsGgSn', kicker:'PBJvqQV59MZsGgSn-LBpy3Z5hw7QNb23n', headline:'PBJvqQV59MZsGgSn-LBXJ0fSr6y1vY1vx', cats:['entertainment','lifestyle'] },
  { page_index:5, bg:'PBMST8wgyxTwhjwX', kicker:'PBMST8wgyxTwhjwX-LBBZxkcbcWs040bg', headline:'PBMST8wgyxTwhjwX-LBCykyzYx8RpJlcC', cats:['sport'] },
  { page_index:6, bg:'PB79tGv4qq1yHv89', kicker:'PB79tGv4qq1yHv89-LBJ4y9vnbY4nP6D4', headline:'PB79tGv4qq1yHv89-LB9wbCWP43qxccXT', cats:['travel','lifestyle'] },
  { page_index:7, bg:'PBGHnCHXbDtTFw4n', kicker:'PBGHnCHXbDtTFw4n-LB4fD00CmGhj4NJX', headline:'PBGHnCHXbDtTFw4n-LBtRzK3x3xXNbtSk', cats:['technology'] },
  { page_index:8, bg:'PBcJ5RQPspg1GLcF', kicker:'PBcJ5RQPspg1GLcF-LBLl5T14zNHbMWPd', headline:'PBcJ5RQPspg1GLcF-LBrV8FSmCCmh16sG', cats:['motoring'] },
];

// Carousel template pages
const CAROUSEL_PAGES = [
  { page_index:1, bg:'PBhkt7kRRC6rlzXM', kicker:'PBhkt7kRRC6rlzXM-LBjNpHhsVJYM03GF', headline:'PBhkt7kRRC6rlzXM-LBmYX1rRqn2VFnPV' },
  { page_index:2, bg:'PBqQQBsshjKSj1v1', kicker:null,                                   headline:'PBqQQBsshjKSj1v1-LBx1CWtc1ZzXvHs9' },
  { page_index:3, bg:'PBjwV9rMq57Pdsjq', kicker:null,                                   headline:'PBjwV9rMq57Pdsjq-LBLnN7x5HGNcWgKt' },
  { page_index:4, bg:'PBJl3KvwKBfr87ny', kicker:null,                                   headline:'PBJl3KvwKBfr87ny-LBrTq6sVTHsn87YL' },
  { page_index:5, bg:'PBLj7DbQNLsQZY5K', kicker:'PBLj7DbQNLsQZY5K-LBpLMwM39v2jVmJr', headline:'PBLj7DbQNLsQZY5K-LByh97DCfyYwLrpb' },
  { page_index:6, bg:'PBY6xBgZmFw6VWjr', kicker:'PBY6xBgZmFw6VWjr-LBCsgpcLfH30fyh8', headline:'PBY6xBgZmFw6VWjr-LB5HDSR9KrPL485l' },
];

function getPageForCategory(cat) {
  const match = SINGLE_CARD_PAGES.find(p => p.cats.includes(cat));
  return match || SINGLE_CARD_PAGES[0];
}

let currentCardType = 'single';

/* ── Populate story selector ── */
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'cards') populateCardStorySelector();
  });
});

function populateCardStorySelector() {
  const sel = document.getElementById('card-story-select');
  while (sel.options.length > 1) sel.remove(1);
  const co = document.createElement('option');
  co.value = '__custom__'; co.textContent = '\u270f Enter custom story details';
  sel.appendChild(co);
  allStories.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = '[' + s.cat.toUpperCase() + '] ' + s.headline.slice(0,80);
    sel.appendChild(o);
  });
}

document.getElementById('card-story-select').addEventListener('change', function() {
  const cf = document.getElementById('card-custom-fields');
  if (this.value === '__custom__') { cf.style.display = 'block'; return; }
  cf.style.display = 'none';
  if (this.value) {
    const s = allStories.find(x => x.id === this.value);
    if (s) {
      document.getElementById('card-headline').value   = s.headline;
      document.getElementById('card-caption').value    = s.excerpt;
      document.getElementById('card-image-url').value  = s.image || '';
      document.getElementById('card-story-url').value  = s.url   || '';
      document.getElementById('card-category').value   = s.cat;
    }
  }
});

document.getElementById('card-type-pills').addEventListener('click', e => {
  if (e.target.classList.contains('cat-pill')) {
    document.querySelectorAll('#card-type-pills .cat-pill').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    currentCardType = e.target.dataset.type;
  }
});

/* ── MAIN GENERATE ── */
document.getElementById('gen-card-btn').addEventListener('click', async () => {
  const apiKey = getApiKey();
  if (!apiKey) { showSettingsAlert(); return; }

  const selVal   = document.getElementById('card-story-select').value;
  let headline   = document.getElementById('card-headline').value.trim();
  let caption    = document.getElementById('card-caption').value.trim();
  let imageUrl   = document.getElementById('card-image-url').value.trim();
  let storyUrl   = document.getElementById('card-story-url').value.trim();
  let category   = document.getElementById('card-category').value;

  if (selVal && selVal !== '__custom__') {
    const s = allStories.find(x => x.id === selVal);
    if (s) { headline=s.headline; caption=s.excerpt; imageUrl=s.image||''; storyUrl=s.url||''; category=s.cat; }
  }
  if (!headline) { alert('Please select a story or enter a headline.'); return; }

  document.getElementById('card-placeholder').style.display  = 'none';
  document.getElementById('card-canvas-area').style.display  = 'none';
  document.getElementById('card-error').style.display        = 'none';
  document.getElementById('card-loading').style.display      = 'flex';
  const genText = document.getElementById('card-loading').querySelector('.generating-text');
  if (genText) genText.textContent = 'Building your Canva card...';

  try {
    // 1. Generate card copy text with Claude
    const cardCopy = await generateCardCopy(apiKey, headline, caption, category, currentCardType);

    // 2. Shorten URL
    let shortUrl = storyUrl;
    if (storyUrl && WORKER_BASE_URL) {
      try {
        const sr = await fetch(WORKER_BASE_URL.replace(/\/$/,'') + '/shorten?url=' + encodeURIComponent(storyUrl));
        const sd = await sr.json();
        if (sd.ok && sd.short) shortUrl = sd.short;
      } catch(_) {}
    }

    // 3. Build card in Canva via MCP
    const result = await buildCanvaCard(apiKey, {
      headline, caption, imageUrl, category,
      type: currentCardType,
      cardCopy,
    });

    // 4. Display result
    document.getElementById('card-loading').style.display = 'none';
    document.getElementById('card-canvas-area').style.display = 'block';

    let linkEl = document.getElementById('canva-edit-link');
    if (!linkEl) {
      linkEl = document.createElement('div');
      linkEl.id = 'canva-edit-link';
      linkEl.style.cssText = 'text-align:center;padding:2rem 1rem';
      document.getElementById('card-canvas-area').appendChild(linkEl);
    }

    if (result.editUrl || result.thumbnailUrl) {
      const thumbHtml = result.thumbnailUrl
        ? '<img src="' + result.thumbnailUrl + '" style="max-width:100%;max-height:420px;border-radius:6px;margin-bottom:1.5rem;box-shadow:0 4px 24px rgba(0,0,0,0.5);display:block;margin-left:auto;margin-right:auto" />'
        : '';
      const btnHtml = result.editUrl
        ? '<a href="' + result.editUrl + '" target="_blank" class="btn btn-primary" style="font-size:12px;padding:11px 24px;text-decoration:none;display:inline-block;border-radius:2px">Open &amp; Download in Canva →</a>'
        : '';
      linkEl.innerHTML = thumbHtml + btnHtml + '<p style="margin-top:10px;font-size:11px;color:var(--muted);font-family:var(--font-mono)">Card created in your Canva account</p>';
    } else {
      linkEl.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:1rem">' + (result.message || 'Card created — check your Canva account.') + '</p>';
    }

    // 5. Share text
    const shareText = buildShareText(headline, cardCopy.shareText || headline, shortUrl || storyUrl, category);
    document.getElementById('share-text-output').textContent = shareText;

  } catch(e) {
    document.getElementById('card-loading').style.display     = 'none';
    document.getElementById('card-error').textContent         = 'Error: ' + e.message;
    document.getElementById('card-error').style.display       = 'block';
    document.getElementById('card-placeholder').style.display = 'block';
  }
});

/* ── Generate card copy text with Claude ── */
async function generateCardCopy(apiKey, headline, caption, category, type) {
  const isCarousel = type === 'carousel';
  const prompt = isCarousel
    ? 'You are an IOL social media editor. Break this story into 4-6 carousel slides.\nStory: ' + headline + '\nDetails: ' + caption + '\nReturn ONLY raw JSON: {"kicker":"2-4 WORD ALL-CAPS KICKER","shareText":"2-3 sentence social caption with hook","slides":[{"kicker":"2-3 WORD KICKER","headline":"Headline max 10 words","body":"One key fact per slide"},...]}'
    : 'You are an IOL social media editor.\nStory: ' + headline + '\nDetails: ' + caption + '\nCategory: ' + category + '\nReturn ONLY raw JSON: {"kicker":"2-4 WORD ALL-CAPS KICKER (e.g. FACILITY FAILURES, URBAN SPARK, TOUR TENSIONS)","headline":"Full punchy headline max 12 words","shareText":"2-3 sentence engaging social caption ending with hook or question"}';

  const raw = await callClaude(apiKey, prompt, 600);
  const m   = raw.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/);
  if (!m) return { kicker: headline.split(' ').slice(0,3).join(' ').toUpperCase(), headline, shareText: headline };
  try { return JSON.parse(m[0]); } catch(_) { return { kicker:'BREAKING', headline, shareText: headline }; }
}

/* ── Build card in Canva via Anthropic API + Canva MCP ── */
async function buildCanvaCard(apiKey, story) {
  const isCarousel  = story.type === 'carousel';
  const templateId  = isCarousel ? CANVA_CAROUSEL_ID : CANVA_SINGLE_CARD_ID;
  const cardCopy    = story.cardCopy || {};

  // Determine which page to use for single card
  const targetPage  = isCarousel ? null : getPageForCategory(story.category);
  const pageIndex   = isCarousel ? 1 : targetPage.page_index;

  const systemPrompt = `You are a Canva design automation assistant for IOL (Independent Online), South Africa.

You have access to Canva MCP tools. Your job is to edit an existing Canva template design to create a social media card.

TEMPLATE: ${templateId}
TYPE: ${isCarousel ? 'Carousel (6 pages)' : 'Single card (use page ' + pageIndex + ')'}

WHAT TO DO:
1. Call start-editing-transaction on design ID: ${templateId}
2. ${story.imageUrl ? 'Upload this image URL to Canva: ' + story.imageUrl + ' — then use update_fill to replace the background image on ' + (isCarousel ? 'ALL pages' : 'page ' + pageIndex) : 'Skip image upload (no image URL provided)'}
3. Replace text on ${isCarousel ? 'all 6 pages' : 'page ' + pageIndex + ' only'} with the content below
4. Call commit-editing-transaction
5. Return a JSON object: {"editUrl": "...", "thumbnailUrl": "...", "message": "..."}

${isCarousel ? `CAROUSEL CONTENT (6 slides):
${(cardCopy.slides || []).map((s,i) => 'Slide ' + (i+1) + ': Kicker="' + s.kicker + '" | Headline/Body="' + s.headline + (s.body ? ' — ' + s.body : '') + '"').join('\n')}

Use these element IDs for text replacement:
${CAROUSEL_PAGES.map(p => 'Page ' + p.page_index + (p.kicker ? ': kicker element=' + p.kicker + ', ' : ': ') + 'headline/body element=' + p.headline).join('\n')}
Background image element IDs: ${CAROUSEL_PAGES.map(p => 'Page ' + p.page_index + '=' + p.bg).join(', ')}` :
`SINGLE CARD CONTENT:
Kicker: "${cardCopy.kicker || story.headline.split(' ').slice(0,3).join(' ').toUpperCase()}"
Headline: "${cardCopy.headline || story.headline}"

Use these element IDs for page ${pageIndex}:
- Kicker text element: ${targetPage ? targetPage.kicker : 'N/A'}
- Headline text element: ${targetPage ? targetPage.headline : 'N/A'}
- Background image element: ${targetPage ? targetPage.bg : 'N/A'}`}

IMPORTANT: Only edit the specified page(s). Do not touch the IOL logo or category pill elements. Return the edit URL and thumbnail URL as JSON after committing.`;

  const userMsg = `Create the IOL social card now.
${story.imageUrl ? 'Story image to upload: ' + story.imageUrl : ''}
Story: "${story.headline}"
Please proceed: start transaction → ${story.imageUrl ? 'upload image → replace image fills → ' : ''}replace text → commit → return JSON with editUrl and thumbnailUrl.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      mcp_servers: [{ type: 'url', url: CANVA_MCP_URL, name: 'canva' }],
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    if (res.status === 401) throw new Error('Invalid API key.');
    throw new Error(err?.error?.message || 'API error ' + res.status);
  }

  const data = await res.json();
  const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

  // Extract JSON from final response
  const jsonMatch = textBlocks.match(/\{[\s\S]*?"editUrl"[\s\S]*?\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch(_) {}
  }

  // Fallback: find any Canva URL mentioned
  const urlMatch = textBlocks.match(/https:\/\/www\.canva\.com\/d\/[^\s"')]+/);
  if (urlMatch) return { editUrl: urlMatch[0], thumbnailUrl: null };

  // Last resort
  return { editUrl: null, message: 'Card may have been created — check your Canva account at canva.com' };
}

/* ── Share text ── */
function buildShareText(headline, aiText, shortUrl, category) {
  const tags = { news:'#SouthAfrica #NewsZA #IOL', politics:'#SAPoltics #SouthAfrica #IOL', sport:'#SportZA #SouthAfrica #IOL', business:'#BusinessZA #SouthAfrica #IOL', entertainment:'#Entertainment #SouthAfrica #IOL', technology:'#TechZA #SouthAfrica #IOL', motoring:'#Motoring #SouthAfrica #IOL', lifestyle:'#Lifestyle #SouthAfrica #IOL', travel:'#Travel #SouthAfrica #IOL' };
  const ht  = tags[category] || '#SouthAfrica #IOL';
  const url = shortUrl ? '\n\n\uD83D\uDD17 ' + shortUrl : '';
  return (aiText || headline) + url + '\n\n' + ht + '\n\n\uD83D\uDCF0 Follow @IOL for the latest South African news';
}
