/* ============================================================
   IOL BROADCASTING CONTENT STUDIO
   app.js — Application logic
   ============================================================ */

'use strict';

/* ---- CONFIG ---- */
const API_URL   = 'https://api.anthropic.com/v1/messages';
const API_MODEL = 'claude-sonnet-4-20250514';

// IOL RSS feeds via rss2json CORS proxy (free tier, no key needed)
const RSS_FEEDS = [
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.iol.co.za%2Frss%2Fnews&count=30',        cat: 'news' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.iol.co.za%2Frss%2Fpolitics&count=20',   cat: 'politics' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.iol.co.za%2Frss%2Fsport&count=20',      cat: 'sport' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.iol.co.za%2Frss%2Fbusiness&count=20',   cat: 'business' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.iol.co.za%2Frss%2Fentertainment&count=20', cat: 'entertainment' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.iol.co.za%2Frss%2Ftechnology&count=15', cat: 'technology' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.iol.co.za%2Frss%2Fmotoring&count=15',   cat: 'motoring' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.iol.co.za%2Frss%2Flifestyle&count=15',  cat: 'lifestyle' },
];

// Fallback sample stories (used if RSS fails)
const FALLBACK_STORIES = [
  { id:1,  cat:'news',          headline:'Cape Town water crisis averted as winter rainfall exceeds seasonal forecasts',                  excerpt:'Dam levels at record highs after above-average winter rainfall across the Western Cape.',                               source:'IOL Cape',       time:'2h ago', url:'https://www.iol.co.za' },
  { id:2,  cat:'politics',      headline:'ANC faces crucial vote as coalition negotiations stall ahead of budget deadline',               excerpt:'Key alliance partners threaten to walk out as fiscal talks reach critical point in Parliament.',                         source:'IOL Politics',   time:'1h ago', url:'https://www.iol.co.za' },
  { id:3,  cat:'business',      headline:'JSE surges as rand strengthens against dollar on positive economic outlook',                    excerpt:'The rand gained over 1% in early trade as investor sentiment improved on new growth forecasts.',                        source:'Business Report',time:'45m ago',url:'https://www.iol.co.za' },
  { id:4,  cat:'sport',         headline:'Springboks announce squad for British & Irish Lions series with surprise inclusions',           excerpt:'Three uncapped players named in a 36-man squad for the historic incoming tour.',                                         source:'IOL Sport',      time:'3h ago', url:'https://www.iol.co.za' },
  { id:5,  cat:'entertainment', headline:'South African film sweeps international awards circuit with historic clean sweep',              excerpt:'A Cape Town-produced drama takes top honours at three major European festivals.',                                         source:'Tonight',        time:'4h ago', url:'https://www.iol.co.za' },
  { id:6,  cat:'technology',    headline:'Eskom confirms AI-powered grid management system rollout across five provinces',                excerpt:'The utility says the new system has already prevented an estimated 40 days of load shedding.',                           source:'IOL Tech',       time:'2h ago', url:'https://www.iol.co.za' },
  { id:7,  cat:'politics',      headline:'Parliament debates controversial land expropriation amendment in marathon session',             excerpt:'Proceedings stretched past midnight as opposition parties tabled over 200 amendments.',                                    source:'IOL Politics',   time:'5h ago', url:'https://www.iol.co.za' },
  { id:8,  cat:'news',          headline:'SAPS announces major crackdown on Cape Flats gang violence with new task force',               excerpt:'A 500-strong specialised unit will be deployed across 12 hotspot areas from next week.',                                  source:'IOL Crime',      time:'1h ago', url:'https://www.iol.co.za' },
  { id:9,  cat:'business',      headline:'Local startup raises R500 million in Series B — largest SA fintech round this year',           excerpt:'The Cape Town-based payments platform will use funds to expand into six African markets.',                               source:'Business Report',time:'3h ago', url:'https://www.iol.co.za' },
  { id:10, cat:'sport',         headline:'Banyana Banyana qualify for Olympic quarter finals in dramatic penalty shootout',               excerpt:'The national women\'s team secured their place in the last eight with a 4-2 shootout win.',                              source:'IOL Sport',      time:'30m ago',url:'https://www.iol.co.za' },
  { id:11, cat:'news',          headline:'Johannesburg load-shedding schedule suspended indefinitely as Eskom hits milestone',            excerpt:'For the first time in three years, South Africans can expect uninterrupted power through winter.',                        source:'IOL Gauteng',    time:'6h ago', url:'https://www.iol.co.za' },
  { id:12, cat:'technology',    headline:'South Africa\'s first quantum computing centre opens in Pretoria with global partners',         excerpt:'The facility, backed by a consortium of universities and tech firms, will accelerate local AI research.',                  source:'IOL Tech',       time:'7h ago', url:'https://www.iol.co.za' },
  { id:13, cat:'motoring',      headline:'Ford Ranger Raptor R named SA performance bakkie of the year at annual awards',                excerpt:'The high-performance off-roader beat seven rivals to claim the top honour at the Johannesburg ceremony.',                  source:'IOL Motoring',   time:'5h ago', url:'https://www.iol.co.za' },
  { id:14, cat:'lifestyle',     headline:'SA restaurant earns coveted Michelin star — only the third in Africa to do so',                excerpt:'The Cape Winelands fine-dining establishment received the award at a ceremony in Paris.',                                  source:'IOL Lifestyle',  time:'8h ago', url:'https://www.iol.co.za' },
  { id:15, cat:'news',          headline:'Floods devastate KwaZulu-Natal communities as rescue teams race against time',                  excerpt:'Over 3 000 residents have been displaced as swollen rivers breach banks across four districts.',                          source:'IOL KZN',        time:'2h ago', url:'https://www.iol.co.za' },
];

/* ---- STATE ---- */
let allStories     = [];
let selectedIds    = new Set();
let currentFilter  = 'all';
let selectedPlatforms = new Set(['Spotify']);

function getApiKey() {
  return (localStorage.getItem('iol_api_key') || '').trim();
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + target).classList.add('active');
  });
});

/* ============================================================
   RSS FEED LOADING
   ============================================================ */
async function fetchFeed(feed) {
  const res  = await fetch(feed.url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (data.status !== 'ok' || !data.items) return [];
  return data.items.slice(0, 20).map((item, i) => ({
    id:       `${feed.cat}-${i}-${Date.now()}`,
    cat:      feed.cat,
    headline: stripHtml(item.title || ''),
    excerpt:  stripHtml(item.description || item.content || '').slice(0, 160),
    source:   item.author || 'IOL',
    time:     relativeTime(item.pubDate),
    url:      item.link || 'https://www.iol.co.za',
  })).filter(s => s.headline.length > 10);
}

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
}

function relativeTime(dateStr) {
  if (!dateStr) return 'Today';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'Just now';
    if (m < 60)  return `${m}m ago`;
    if (m < 1440)return `${Math.floor(m/60)}h ago`;
    return `${Math.floor(m/1440)}d ago`;
  } catch { return 'Today'; }
}

async function loadStories() {
  const grid = document.getElementById('stories-grid');
  const info = document.getElementById('last-refresh');
  const status = document.getElementById('feed-status');
  selectedIds.clear();
  updateActionBar();

  grid.innerHTML = `<div class="loading-placeholder"><div class="spinner"></div><p>Fetching latest IOL stories...</p></div>`;
  info.textContent = 'Fetching...';

  let stories = [];
  let liveOk  = false;

  try {
    const results = await Promise.allSettled(RSS_FEEDS.map(f => fetchFeed(f)));
    results.forEach(r => {
      if (r.status === 'fulfilled') stories.push(...r.value);
    });
    // Deduplicate by headline similarity
    const seen = new Set();
    stories = stories.filter(s => {
      const key = s.headline.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (stories.length > 5) {
      liveOk = true;
      status.textContent = '● LIVE FEED';
      status.className = 'feed-status live';
    }
  } catch (_) { /* fall through */ }

  if (!liveOk || stories.length < 3) {
    stories = FALLBACK_STORIES.map(s => ({ ...s }));
    status.textContent = '● SAMPLE STORIES';
    status.className = 'feed-status fallback';
  }

  // Sort newest first (live stories already ordered; samples stay as-is)
  allStories = stories;
  info.textContent = 'Updated ' + new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  renderStories();
}

function renderStories() {
  const grid = document.getElementById('stories-grid');
  const filtered = currentFilter === 'all'
    ? allStories
    : allStories.filter(s => s.cat === currentFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="loading-placeholder"><p>No stories in this category right now.</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="story-card ${selectedIds.has(s.id) ? 'selected' : ''}"
         data-id="${s.id}" tabindex="0" role="checkbox"
         aria-checked="${selectedIds.has(s.id)}"
         title="${escHtml(s.headline)}">
      <div class="story-check" aria-hidden="true">✓</div>
      <div class="story-tag">${escHtml(s.cat)}</div>
      <div class="story-headline">${escHtml(s.headline)}</div>
      ${s.excerpt ? `<div class="story-excerpt">${escHtml(s.excerpt)}</div>` : ''}
      <div class="story-meta">
        <span class="story-source">${escHtml(s.source)}</span>
        <span>·</span>
        <span>${escHtml(s.time)}</span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.story-card').forEach(card => {
    card.addEventListener('click', () => toggleStory(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') toggleStory(card.dataset.id); });
  });
}

function toggleStory(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  const card = document.querySelector(`.story-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle('selected');
    card.setAttribute('aria-checked', selectedIds.has(id).toString());
  }
  updateActionBar();
}

function updateActionBar() {
  const n = selectedIds.size;
  document.getElementById('selected-count').textContent = n + ' selected';
  document.getElementById('action-count').textContent   = n + ' stor' + (n === 1 ? 'y' : 'ies');
  document.getElementById('gen-bulletin-btn').disabled  = n === 0;
}

function filterFeed(cat) {
  currentFilter = cat;
  document.querySelectorAll('#cat-pills-feed .cat-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === cat);
  });
  renderStories();
}

function selectAll() {
  const filtered = currentFilter === 'all'
    ? allStories
    : allStories.filter(s => s.cat === currentFilter);
  filtered.forEach(s => selectedIds.add(s.id));
  renderStories();
  updateActionBar();
}

function clearAll() {
  selectedIds.clear();
  renderStories();
  updateActionBar();
}

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

  const storyList = stories.map((s, i) =>
    `${i+1}. [${s.cat.toUpperCase()}] ${s.headline}${s.excerpt ? '\n   Context: ' + s.excerpt : ''}`
  ).join('\n\n');

  const styleGuide = {
    formal:          'Authoritative, measured, formal — BBC / SABC evening news style. Use complete sentences, no slang.',
    conversational:  'Warm, approachable, inclusive — morning show / daytime news style. Speak directly to viewers.',
    energetic:       'High-energy, punchy, fast-paced — optimised for social media reels and short-form video. Hook hard in the first 3 words.',
    investigative:   'Probing, serious, analytical — investigative journalism tone. Use evidence-led language.',
  };

  const prompt = `You are a senior broadcast journalist and scriptwriter for IOL Broadcasting — the official broadcast arm of IOL (Independent Online), South Africa's most-read digital news platform.

Write a ${duration}-second piece-to-camera broadcast script for a single news anchor presenting these ${stories.length} storie(s):

${storyList}

STYLE GUIDE: ${styleGuide[style] || styleGuide.formal}

SCRIPT REQUIREMENTS:
- Open with a strong, attention-grabbing line that hooks the viewer in the first 5 words
- Each story gets a 1–3 sentence summary (extrapolate context professionally from the headline and excerpt provided)
- Use professional broadcast transitions between stories: "Moving on...", "In sport...", "And in business tonight...", "Turning now to...", etc.
- Include anchor stage directions in [SQUARE BRACKETS]: [PAUSE], [LOOK TO CAMERA], [GRAPHIC: STORY NAME], [HALF-TURN], [HOLD CAMERA]
- End with a strong IOL-branded sign-off and social CTA
- Format clearly with "ANCHOR:" labels before each block of copy
- The finished script should fit comfortably within ${duration} seconds when read at a broadcast pace of approximately 150 words per minute
- Do NOT include any preamble, explanation or meta-commentary — output ONLY the formatted script

Sign-off example style: "That's your IOL update. For the full story and breaking news, follow IOL on all platforms. I'm [ANCHOR NAME]. Stay informed. Stay IOL."`;

  try {
    const text = await callClaude(apiKey, prompt);
    document.getElementById('bulletin-script-text').textContent = text;
    document.getElementById('bulletin-meta').textContent = `${stories.length} stories · ${duration}s · ${style}`;
    showState('bulletin', 'result');
  } catch (e) {
    showState('bulletin', 'error', e.message);
  }
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

  if (!headline && !content) {
    alert('Please enter at least a headline or story content.');
    return;
  }

  showState('custom', 'loading');

  const styleGuide = {
    formal:         'Formal, authoritative evening news',
    conversational: 'Warm, conversational daytime show',
    energetic:      'High-energy, punchy social media style',
    investigative:  'Investigative, probing, serious journalism',
  };

  const anchorInstruction = anchors === '2'
    ? 'Write for TWO co-anchors. Label each block clearly as "ANCHOR 1:" and "ANCHOR 2:". They should build on each other naturally, with one setting up and the other developing or closing each beat.'
    : 'Write for a SINGLE anchor throughout.';

  const prompt = `You are a senior broadcast journalist and scriptwriter for IOL Broadcasting — the official broadcast arm of IOL (Independent Online), South Africa's most-read digital news platform.

Write a ${duration}-second piece-to-camera script optimised for ${platform}.

STORY DETAILS:
- Headline: ${headline || '(not provided — extrapolate from content)'}
- Category: ${category}
- Content / Key Facts: ${content || '(extrapolate professionally from the headline)'}
${instructions ? `- Special Instructions: ${instructions}` : ''}

ANCHOR FORMAT: ${anchorInstruction}

STYLE: ${styleGuide[style] || styleGuide.formal}

PLATFORM OPTIMISATION FOR ${platform.toUpperCase()}:
- Hook the first 3 words for maximum retention on ${platform}
- Use a platform-appropriate CTA at the end (e.g. TikTok: "Follow for more", Instagram: "Link in bio for the full story", YouTube: "Subscribe and hit the bell", LinkedIn: "Share this with your network")
- Keep energy and pacing appropriate for ${platform} viewing behaviour

SCRIPT REQUIREMENTS:
- Include anchor stage directions in [SQUARE BRACKETS]: [PAUSE], [LOOK TO CAMERA], [GRAPHIC], [CUT TO B-ROLL], etc.
- ${duration}-second read at ~150 words per minute
- Branded IOL sign-off
- Output ONLY the formatted script — no preamble or meta-commentary`;

  try {
    const text = await callClaude(apiKey, prompt);
    document.getElementById('custom-script-text').textContent = text;
    showState('custom', 'result');
  } catch (e) {
    showState('custom', 'error', e.message);
  }
});

/* ============================================================
   GENERATE PODCAST CONCEPT
   ============================================================ */
document.getElementById('gen-podcast-btn').addEventListener('click', async () => {
  const apiKey = getApiKey();
  if (!apiKey) { showSettingsAlert(); return; }

  const category    = document.getElementById('pod-category').value;
  const audience    = document.getElementById('pod-audience').value;
  const frequency   = document.getElementById('pod-frequency').value;
  const length      = document.getElementById('pod-length').value;
  const hosts       = document.getElementById('pod-hosts').value;
  const hook        = document.getElementById('pod-hook').value.trim();
  const inspiration = document.getElementById('pod-inspiration').value.trim();
  const platforms   = Array.from(selectedPlatforms).join(', ') || 'Spotify';

  showState('podcast', 'loading');

  const prompt = `You are a leading podcast strategy consultant hired by IOL (Independent Online), South Africa's #1 digital news platform. Your job is to create a detailed, actionable podcast concept that will genuinely succeed in the South African media landscape.

CLIENT BRIEF:
- Category: ${category}
- Target audience: ${audience}
- Publishing frequency: ${frequency}
- Episode length: ${length}
- Host format: ${hosts}
- Publishing platforms: ${platforms}
${hook        ? `- Unique angle / hook: ${hook}` : ''}
${inspiration ? `- Inspiration / competing shows: ${inspiration}` : ''}

Generate a comprehensive podcast concept as a JSON object. Respond ONLY with the raw JSON object — no markdown fences, no preamble, no explanation.

{
  "showName": "string — catchy, memorable, 2-5 words",
  "tagline": "string — one punchy line under 12 words",
  "elevator_pitch": "string — 3 sentences describing what this show is and why it's different",
  "why_it_works": "string — 3 sentences on why this concept will succeed on the specified platforms for the specified audience, citing specific platform behaviour patterns",
  "format": "string — 3-4 sentences describing the show format, tone, and recurring structure",
  "timeline": [
    { "time": "00:00–02:00", "segment": "string", "description": "string" },
    { "time": "02:00–08:00", "segment": "string", "description": "string" },
    { "time": "08:00–18:00", "segment": "string", "description": "string" },
    { "time": "18:00–25:00", "segment": "string", "description": "string" },
    { "time": "25:00–30:00", "segment": "string", "description": "string" }
  ],
  "sample_episodes": [
    { "ep": "01", "title": "string", "description": "string — 2 sentences" },
    { "ep": "02", "title": "string", "description": "string — 2 sentences" },
    { "ep": "03", "title": "string", "description": "string — 2 sentences" },
    { "ep": "04", "title": "string", "description": "string — 2 sentences" }
  ],
  "guest_strategy": [
    { "type": "string", "examples": "string — 4 specific real South African names or institutions" },
    { "type": "string", "examples": "string — 4 specific real South African names or institutions" },
    { "type": "string", "examples": "string — 4 specific real South African names or institutions" }
  ],
  "platform_strategy": {
    "primary": "${platforms.split(',')[0].trim()}",
    "tactics": "string — 3 specific, actionable tactics for the specified platforms",
    "repurposing": "string — how to turn each episode into 3–5 pieces of social content"
  },
  "monetisation": "string — 3 realistic monetisation pathways for this concept in SA",
  "launch_plan": "string — 4-step launch sequence for month 1",
  "risk_factors": "string — 2 potential challenges and how to mitigate them"
}`;

  try {
    let text = await callClaude(apiKey, prompt, 1800);
    text = text.replace(/```json|```/g, '').trim();
    // Extract JSON if wrapped in other text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response format from AI. Please try again.');
    const pod = JSON.parse(jsonMatch[0]);
    renderPodcast(pod, platforms);
    showState('podcast', 'result');
  } catch (e) {
    showState('podcast', 'error', 'Error: ' + e.message + ' — Please check your API key in Settings and try again.');
  }
});

function renderPodcast(pod, platforms) {
  const platformList = platforms.split(',').map(p => p.trim());

  const badgeMap = {
    'Spotify':       'badge-spotify',
    'Apple Podcasts':'badge-apple',
    'YouTube':       'badge-youtube',
    'IOL Website':   'badge-iol',
    'TikTok':        'badge-tiktok',
    'Instagram':     'badge-instagram',
    'Facebook':      'badge-facebook',
  };

  const badges = platformList.map(p =>
    `<span class="platform-badge ${badgeMap[p] || 'badge-default'}">${escHtml(p)}</span>`
  ).join('');

  const timeline = (pod.timeline || []).map(t => `
    <tr>
      <td class="timeline-time">${escHtml(t.time)}</td>
      <td class="timeline-seg">${escHtml(t.segment)}</td>
      <td class="timeline-desc">${escHtml(t.description)}</td>
    </tr>`).join('');

  const episodes = (pod.sample_episodes || []).map(e => `
    <div class="episode-row">
      <div class="episode-num">EP.${escHtml(e.ep)}</div>
      <div class="episode-title">${escHtml(e.title)}</div>
      <div class="episode-desc">${escHtml(e.description)}</div>
    </div>`).join('');

  const guests = (pod.guest_strategy || []).map(g => `
    <div class="guest-row">
      <div class="guest-type">${escHtml(g.type)}</div>
      <div class="guest-examples">${escHtml(g.examples)}</div>
    </div>`).join('');

  document.getElementById('pod-output-title').textContent = pod.showName || 'Your Podcast';
  document.getElementById('pod-output-meta').textContent  = pod.tagline  || '';

  document.getElementById('podcast-body').innerHTML = `
    <div class="pod-section">
      <div class="pod-section-title">Concept</div>
      <div class="pod-section-content">${escHtml(pod.elevator_pitch || '')}</div>
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Why It Works</div>
      <div class="pod-section-content">${escHtml(pod.why_it_works || '')}</div>
      <div class="platform-badges" style="margin-top:10px">${badges}</div>
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Show Format</div>
      <div class="pod-section-content">${escHtml(pod.format || '')}</div>
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Episode Structure / Timeline</div>
      <table class="timeline-table">
        <tbody>${timeline}</tbody>
      </table>
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Sample Episodes</div>
      ${episodes}
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Guest Strategy</div>
      ${guests}
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Platform Strategy</div>
      <div class="pod-section-content">${escHtml(pod.platform_strategy?.tactics || '')}</div>
      <div class="strategy-box" style="margin-top:10px">
        <div class="strategy-label">Content Repurposing</div>
        <div class="strategy-text">${escHtml(pod.platform_strategy?.repurposing || '')}</div>
      </div>
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Monetisation</div>
      <div class="pod-section-content">${escHtml(pod.monetisation || '')}</div>
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Launch Plan</div>
      <div class="pod-section-content">${escHtml(pod.launch_plan || '')}</div>
    </div>

    <div class="pod-section">
      <div class="pod-section-title">Risk Factors & Mitigation</div>
      <div class="pod-section-content">${escHtml(pod.risk_factors || '')}</div>
    </div>
  `;
}

/* ============================================================
   CLAUDE API CALL
   ============================================================ */
async function callClaude(apiKey, prompt, maxTokens = 1200) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: API_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    if (res.status === 401) throw new Error('Invalid API key. Please check Settings.');
    if (res.status === 429) throw new Error('Rate limit reached. Please wait a moment and try again.');
    throw new Error(msg);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content || []).map(b => b.text || '').join('');
}

/* ============================================================
   UI STATE HELPERS
   ============================================================ */
function showState(prefix, state, errMsg) {
  const loading     = document.getElementById(`${prefix}-loading`);
  const placeholder = document.getElementById(`${prefix}-placeholder`);
  const errorEl     = document.getElementById(`${prefix}-error`);
  const resultEl    = document.getElementById(`${prefix === 'podcast' ? 'podcast-body' : prefix + '-script-text'}`);

  [loading, placeholder, errorEl, resultEl].forEach(el => { if (el) el.style.display = 'none'; });

  if (state === 'loading') {
    if (loading)     loading.style.display     = 'flex';
    if (placeholder) placeholder.style.display = 'none';
  } else if (state === 'result') {
    if (resultEl) resultEl.style.display = prefix === 'podcast' ? 'block' : 'block';
  } else if (state === 'error') {
    if (errorEl) {
      errorEl.textContent = errMsg || 'An error occurred. Please try again.';
      errorEl.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'block';
  }
}

function showSettingsAlert() {
  alert('Please add your Anthropic API key in the Settings tab before generating content.');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('panel-settings').classList.add('active');
  document.getElementById('api-key-input').focus();
}

/* ============================================================
   COPY & DOWNLOAD
   ============================================================ */
document.addEventListener('click', e => {
  if (e.target.classList.contains('copy-btn')) {
    const targetId = e.target.dataset.target;
    const el = document.getElementById(targetId);
    if (!el) return;
    const text = el.innerText || el.textContent || '';
    if (!text.trim()) { e.target.textContent = 'Nothing to copy'; setTimeout(() => e.target.textContent = 'Copy Script', 1500); return; }
    navigator.clipboard.writeText(text).then(() => {
      const orig = e.target.textContent;
      e.target.textContent = '✓ Copied!';
      setTimeout(() => e.target.textContent = orig, 1800);
    }).catch(() => {
      e.target.textContent = 'Failed';
      setTimeout(() => e.target.textContent = 'Copy', 1500);
    });
  }

  if (e.target.classList.contains('download-btn')) {
    const targetId = e.target.dataset.target;
    const filename = e.target.dataset.filename || 'iol-script.txt';
    const el = document.getElementById(targetId);
    if (!el) return;
    const text = el.innerText || el.textContent || '';
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
});

/* ============================================================
   SETTINGS
   ============================================================ */
// Load saved key
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('iol_api_key');
  if (saved) {
    document.getElementById('api-key-input').value = saved;
    document.getElementById('api-key-status').textContent = '● Key loaded from storage';
    document.getElementById('api-key-status').className = 'api-key-status ok';
  }
});

document.getElementById('save-api-key-btn').addEventListener('click', () => {
  const key = document.getElementById('api-key-input').value.trim();
  const status = document.getElementById('api-key-status');
  if (!key) {
    status.textContent = 'Please enter an API key.';
    status.className = 'api-key-status err';
    return;
  }
  if (!key.startsWith('sk-ant-')) {
    status.textContent = '⚠ Key does not look like an Anthropic key (should start with sk-ant-...)';
    status.className = 'api-key-status err';
    return;
  }
  localStorage.setItem('iol_api_key', key);
  status.textContent = '● Key saved securely in browser storage';
  status.className = 'api-key-status ok';
});

document.getElementById('test-feed-btn').addEventListener('click', async () => {
  const btn = document.getElementById('test-feed-btn');
  const statusEl = document.getElementById('feed-status-settings');
  btn.disabled = true;
  btn.textContent = 'Testing...';
  statusEl.textContent = 'Testing...';
  statusEl.className = 'status-unknown';
  try {
    const res = await fetch(RSS_FEEDS[0].url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.status === 'ok' && data.items?.length) {
      statusEl.textContent = `✓ Live — ${data.items.length} items from IOL feed`;
      statusEl.className = 'status-ok';
    } else {
      statusEl.textContent = 'Feed returned empty or error';
      statusEl.className = 'status-err';
    }
  } catch (e) {
    statusEl.textContent = 'Cannot reach feed: ' + e.message;
    statusEl.className = 'status-err';
  }
  btn.disabled = false;
  btn.textContent = 'Test Feed Connection';
});

/* ============================================================
   FEED CATEGORY FILTER
   ============================================================ */
document.getElementById('cat-pills-feed').addEventListener('click', e => {
  if (e.target.classList.contains('cat-pill')) {
    filterFeed(e.target.dataset.cat);
  }
});
document.getElementById('select-all-btn').addEventListener('click', selectAll);
document.getElementById('clear-btn').addEventListener('click', clearAll);
document.getElementById('refresh-btn').addEventListener('click', loadStories);

/* ============================================================
   PLATFORM PILLS (PODCAST)
   ============================================================ */
document.getElementById('pod-platforms').addEventListener('click', e => {
  if (e.target.classList.contains('platform-pill')) {
    const p = e.target.dataset.platform;
    if (selectedPlatforms.has(p)) {
      selectedPlatforms.delete(p);
      e.target.classList.remove('active');
    } else {
      selectedPlatforms.add(p);
      e.target.classList.add('active');
    }
  }
});

/* ============================================================
   UTILITY
   ============================================================ */
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/* ============================================================
   INIT
   ============================================================ */
loadStories();
