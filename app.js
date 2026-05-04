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
   SOCIAL CARD CREATOR v2
   ============================================================ */

const CAT_COLOURS = {
  news:'#E8192C', politics:'#E8192C', sport:'#00A651', business:'#1565C0',
  entertainment:'#E8192C', technology:'#1565C0', motoring:'#F26522',
  lifestyle:'#E91E8C', travel:'#F5A623', default:'#E8192C',
};
function catColour(c) { return CAT_COLOURS[(c||'').toLowerCase()] || CAT_COLOURS.default; }
function catLabel(c)  {
  const m={news:'NEWS',politics:'NEWS',sport:'SPORT',business:'BUSINESS',
    entertainment:'ENTERTAINMENT',technology:'TECH',motoring:'MOTORING',
    lifestyle:'LIFESTYLE',travel:'TRAVEL'};
  return m[(c||'').toLowerCase()]||'NEWS';
}

const IOL_LOGO_DATA = 'data:image/png;base64,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';
let _iolLogo = null;
function getIOLLogo() {
  return new Promise(resolve => {
    if (_iolLogo) { resolve(_iolLogo); return; }
    const img = new Image();
    img.onload  = () => { _iolLogo = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src     = IOL_LOGO_DATA;
  });
}

(function loadPoppins() {
  if (document.querySelector('link[href*="Poppins"]')) return;
  const l = document.createElement('link');
  l.rel  = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&display=swap';
  document.head.appendChild(l);
})();

function waitForPoppins() {
  return document.fonts.load('900 72px Poppins').catch(()=>{});
}

let carouselSlides = [], carouselIndex = 0, currentCardType = 'single';

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => { if (tab.dataset.tab==='cards') populateCardStorySelector(); });
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
  if (this.value === '__custom__') { cf.style.display='block'; return; }
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
  document.getElementById('carousel-nav').style.display      = 'none';

  try {
    await waitForPoppins();
    const cardContent = await generateCardContent(apiKey, headline, caption, category, currentCardType);

    let shortUrl = storyUrl;
    if (storyUrl && WORKER_BASE_URL) {
      try {
        const sr = await fetch(WORKER_BASE_URL.replace(/\/$/,'') + '/shorten?url=' + encodeURIComponent(storyUrl));
        const sd = await sr.json();
        if (sd.ok && sd.short) shortUrl = sd.short;
      } catch(_) {}
    }

    if (currentCardType === 'carousel') {
      carouselSlides = cardContent.slides || [];
      carouselIndex  = 0;
      await drawCarouselSlide(carouselSlides[0], imageUrl, category);
      setupCarouselNav(imageUrl, category);
      document.getElementById('carousel-nav').style.display = 'flex';
    } else {
      await drawSingleCard(cardContent.headline, cardContent.caption, imageUrl, category);
    }

    const shareText = buildShareText(cardContent.headline, cardContent.shareText, shortUrl, category);
    document.getElementById('share-text-output').textContent = shareText;
    document.getElementById('card-loading').style.display     = 'none';
    document.getElementById('card-canvas-area').style.display = 'block';
    document.getElementById('download-card-btn').style.display = 'inline-block';

  } catch(e) {
    document.getElementById('card-loading').style.display     = 'none';
    document.getElementById('card-error').textContent         = 'Error: ' + e.message;
    document.getElementById('card-error').style.display       = 'block';
    document.getElementById('card-placeholder').style.display = 'block';
  }
});

async function generateCardContent(apiKey, headline, caption, category, type) {
  const isC = type === 'carousel';
  const p   = isC
    ? 'You are an IOL social media editor. Break this story into 4-6 Instagram carousel slides.\nStory: ' + headline + '\nDetails: ' + caption + '\nReturn ONLY raw JSON no markdown: {"headline":"2-4 WORD KICKER CAPS","shareText":"2-3 sentence engaging social caption with hook","slides":[{"kicker":"2-3 WORD KICKER","headline":"Full headline max 10 words","body":"One key fact for this slide"},...]}'
    : 'You are an IOL social media editor. Write card text for this story.\nStory: ' + headline + '\nDetails: ' + caption + '\nReturn ONLY raw JSON no markdown: {"headline":"Punchy card headline max 8 words","caption":"One compelling sentence max 20 words","shareText":"2-3 sentence engaging social caption with hook"}';
  const raw = await callClaude(apiKey, p, 600);
  const m   = raw.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Invalid AI response');
  return JSON.parse(m[0]);
}

/* === SINGLE CARD 1080x1080 === */
async function drawSingleCard(headline, caption, imageUrl, category) {
  const canvas = document.getElementById('card-canvas');
  const S = 1080;
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  const col = catColour(category), label = catLabel(category);

  ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0,0,S,S);

  if (imageUrl) {
    try {
      const img = await loadImg(imageUrl);
      const sc  = Math.max(S/img.width, S/img.height);
      ctx.drawImage(img, (S-img.width*sc)/2, (S-img.height*sc)/2, img.width*sc, img.height*sc);
    } catch(_) {}
  }

  const g = ctx.createLinearGradient(0,0,0,S);
  g.addColorStop(0,'rgba(0,0,0,0.28)'); g.addColorStop(0.4,'rgba(0,0,0,0.42)');
  g.addColorStop(0.68,'rgba(0,0,0,0.55)'); g.addColorStop(1,'rgba(0,0,0,0.68)');
  ctx.fillStyle=g; ctx.fillRect(0,0,S,S);

  const padX=72, maxW=S-padX*2, cx=S/2;

  ctx.font='900 74px Poppins,Arial Black,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  const hlLines=wrapText(ctx,headline,maxW), hlLH=88;

  ctx.font='400 42px Poppins,Arial,sans-serif';
  const capLines=caption?wrapText(ctx,caption,maxW-20):[], capLH=56, gap=28;

  const logoZone=110, total=hlLines.length*hlLH+(capLines.length?gap+capLines.length*capLH:0);
  const blockTop=(S-logoZone-total)/2+10;

  ctx.font='900 74px Poppins,Arial Black,sans-serif'; ctx.fillStyle='#FFFFFF';
  hlLines.forEach((l,i)=>ctx.fillText(l,cx,blockTop+(i+1)*hlLH));

  if (capLines.length) {
    ctx.font='400 42px Poppins,Arial,sans-serif'; ctx.fillStyle='rgba(255,255,255,0.93)';
    const ct=blockTop+hlLines.length*hlLH+gap;
    capLines.forEach((l,i)=>ctx.fillText(l,cx,ct+(i+1)*capLH));
  }

  await drawBottomBadge(ctx,S,col,label);
}

async function drawBottomBadge(ctx,S,col,label) {
  const logo=await getIOLLogo(), logoW=80, logoH=40, cx=S/2, logoY=S-95;
  if (logo) ctx.drawImage(logo, cx-logoW/2, logoY, logoW, logoH);
  ctx.font='700 15px Poppins,Arial,sans-serif'; ctx.textAlign='center';
  const pillW=ctx.measureText(label).width+26, pillH=26, pillY=logoY+logoH+6;
  ctx.fillStyle=col; ctx.fillRect(cx-pillW/2,pillY,pillW,pillH);
  ctx.fillStyle='#FFFFFF'; ctx.textBaseline='middle';
  ctx.fillText(label,cx,pillY+pillH/2);
}

/* === CAROUSEL SLIDE 1200x900 === */
async function drawCarouselSlide(slide, imageUrl, category) {
  const canvas = document.getElementById('card-canvas');
  const W=1200, H=900;
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d'), col=catColour(category), label=catLabel(category);

  ctx.fillStyle='#0A0A0A'; ctx.fillRect(0,0,W,H);

  if (imageUrl) {
    try {
      const img=await loadImg(imageUrl);
      const sc=Math.max(W/img.width,H/img.height);
      ctx.drawImage(img,(W-img.width*sc)/2,(H-img.height*sc)/2,img.width*sc,img.height*sc);
    } catch(_) {}
  }

  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba(0,0,0,0.20)'); g.addColorStop(0.45,'rgba(0,0,0,0.38)');
  g.addColorStop(1,'rgba(0,0,0,0.74)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // IOL logo top-left
  const logo=await getIOLLogo(), logoW=88, logoH=44, logoX=42, logoY=28;
  if (logo) ctx.drawImage(logo,logoX,logoY,logoW,logoH);

  // Category pill top-left
  ctx.font='700 16px Poppins,Arial,sans-serif'; ctx.textAlign='left';
  const pw=ctx.measureText(label).width+22, ph=28, px=logoX, py=logoY+logoH+5;
  ctx.fillStyle=col; ctx.fillRect(px,py,pw,ph);
  ctx.fillStyle='#FFFFFF'; ctx.textBaseline='middle';
  ctx.fillText(label,px+11,py+ph/2);

  // Kicker box lower-left
  const kicker=(slide.kicker||'').toUpperCase();
  const kx=42, ky=H*0.565, kw=Math.min(480,W*0.44), kh=64;
  ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(kx,ky,kw,kh);
  ctx.strokeStyle='rgba(255,255,255,0.88)'; ctx.lineWidth=2.5;
  ctx.strokeRect(kx+1,ky+1,kw-2,kh-2);
  ctx.font='800 28px Poppins,Arial Black,sans-serif';
  ctx.fillStyle='#FFFFFF'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(kicker, kx+16, ky+kh/2, kw-32);

  // Headline bottom-right bold ALL CAPS
  const hlText=(slide.headline||'').toUpperCase();
  ctx.font='800 40px Poppins,Arial Black,sans-serif'; ctx.textAlign='right'; ctx.textBaseline='alphabetic';
  ctx.fillStyle='#FFFFFF';
  const hlLines=wrapText(ctx,hlText,W*0.72), hlLH=50, hlBaseY=H-64;
  hlLines.slice().reverse().forEach((l,i)=>ctx.fillText(l,W-48,hlBaseY-i*hlLH));

  // Body text left below kicker
  if (slide.body) {
    ctx.font='400 26px Poppins,Arial,sans-serif'; ctx.fillStyle='rgba(255,255,255,0.88)';
    ctx.textAlign='left'; ctx.textBaseline='top';
    wrapText(ctx,slide.body,540).slice(0,2).forEach((l,i)=>ctx.fillText(l,kx,ky+kh+14+i*34));
  }

  // Coloured rule bottom-right
  ctx.strokeStyle=col; ctx.lineWidth=3.5;
  ctx.beginPath(); ctx.moveTo(W*0.27,H-38); ctx.lineTo(W-48,H-38); ctx.stroke();
}

function setupCarouselNav(imageUrl, category) {
  updateCarouselIndicator();
  document.getElementById('carousel-prev').onclick = async () => {
    if (carouselIndex>0){carouselIndex--; await drawCarouselSlide(carouselSlides[carouselIndex],imageUrl,category); updateCarouselIndicator();}
  };
  document.getElementById('carousel-next').onclick = async () => {
    if (carouselIndex<carouselSlides.length-1){carouselIndex++; await drawCarouselSlide(carouselSlides[carouselIndex],imageUrl,category); updateCarouselIndicator();}
  };
  document.getElementById('download-all-btn').onclick = async () => {
    for (let i=0;i<carouselSlides.length;i++){
      await drawCarouselSlide(carouselSlides[i],imageUrl,category);
      downloadCanvas('iol-carousel-'+String(i+1).padStart(2,'0')+'.png');
      await new Promise(r=>setTimeout(r,300));
    }
    carouselIndex=0; await drawCarouselSlide(carouselSlides[0],imageUrl,category); updateCarouselIndicator();
  };
}
function updateCarouselIndicator(){document.getElementById('carousel-indicator').textContent='Slide '+(carouselIndex+1)+' of '+carouselSlides.length;}

document.getElementById('download-card-btn').addEventListener('click', ()=>downloadCanvas('iol-card.png'));
function downloadCanvas(fn){const a=document.createElement('a');a.href=document.getElementById('card-canvas').toDataURL('image/png');a.download=fn;a.click();}

function buildShareText(headline, aiText, shortUrl, category) {
  const tags={news:'#SouthAfrica #NewsZA #IOL',politics:'#SAPoltics #SouthAfrica #IOL',sport:'#SportZA #SouthAfrica #IOL',business:'#BusinessZA #SouthAfrica #IOL',entertainment:'#Entertainment #SouthAfrica #IOL',technology:'#TechZA #SouthAfrica #IOL',motoring:'#Motoring #SouthAfrica #IOL',lifestyle:'#Lifestyle #SouthAfrica #IOL',travel:'#Travel #SouthAfrica #IOL'};
  const ht=tags[category]||'#SouthAfrica #IOL';
  return (aiText||headline)+(shortUrl?'\n\n\u{1F517} '+shortUrl:'')+('\n\n'+ht)+'\n\n\u{1F4F0} Follow @IOL for the latest South African news';
}

function wrapText(ctx,text,maxW){
  if(!text)return[];
  const words=text.split(' '),lines=[];let cur='';
  words.forEach(w=>{const t=cur?cur+' '+w:w;if(ctx.measureText(t).width<=maxW){cur=t;}else{if(cur)lines.push(cur);cur=w;}});
  if(cur)lines.push(cur); return lines;
}

function loadImg(src) {
  return new Promise((resolve,reject)=>{
    const img=new Image(); img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('Failed: '+src));
    img.src=src;
    setTimeout(()=>reject(new Error('Timeout: '+src)),10000);
  });
}
