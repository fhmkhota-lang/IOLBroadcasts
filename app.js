/* ============================================================
   IOL BROADCASTING CONTENT STUDIO — app.js v2
   - Stories fetched via Claude web_search (live IOL content)
   - Scripts are story-specific, not generic
   ============================================================ */

'use strict';

const API_URL   = 'https://api.anthropic.com/v1/messages';
const API_MODEL = 'claude-sonnet-4-20250514';

/* ---- STATE ---- */
let allStories        = [];
let selectedIds       = new Set();
let currentFilter     = 'all';
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
   FETCH REAL IOL STORIES via Claude web_search
   ============================================================ */
async function loadStories() {
  const grid     = document.getElementById('stories-grid');
  const info     = document.getElementById('last-refresh');
  const statusEl = document.getElementById('feed-status');

  selectedIds.clear();
  updateActionBar();
  grid.innerHTML = `<div class="loading-placeholder"><div class="spinner"></div><p>Fetching latest IOL stories...</p></div>`;
  info.textContent = 'Fetching...';

  const apiKey = getApiKey();
  if (!apiKey) {
    useFallbackStories(statusEl, info, 'Add API key in Settings to load live stories');
    return;
  }

  try {
    const searchPrompt = `Use web_search to find the latest news stories published on iol.co.za today or in the past 24-48 hours.

Please run these searches:
1. "iol.co.za" latest news today
2. "iol.co.za" sport news today
3. "iol.co.za" politics South Africa today
4. "iol.co.za" business economy today
5. "iol.co.za" entertainment today

From the real search results you find, return ONLY a JSON array. No preamble, no explanation, no markdown fences. Start your response with [ and end with ].

Each object must have exactly these fields:
{
  "headline": "the actual headline as published on iol.co.za",
  "excerpt": "1-2 sentence factual summary of what this specific story is actually about based on what you found",
  "category": "one of: news | politics | sport | business | entertainment | technology | motoring | lifestyle",
  "source": "the IOL section e.g. IOL News, IOL Sport, Business Report, Tonight, Daily News",
  "url": "the actual article URL"
}

Return 15-25 real stories you actually found. The headline and excerpt must reflect REAL content from iol.co.za.`;

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
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: searchPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    // Collect all text blocks — comes after tool_use blocks
    const textBlocks = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Extract JSON array
    const jsonMatch = textBlocks.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No story JSON returned');

    const raw = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(raw) || raw.length < 3) throw new Error('Too few stories');

    allStories = raw
      .filter(s => s.headline && s.headline.length > 10)
      .map((s, i) => ({
        id:      `live-${i}`,
        cat:     (s.category || 'news').toLowerCase().trim(),
        headline: s.headline.trim(),
        excerpt:  (s.excerpt || '').trim(),
        source:   s.source || 'IOL',
        time:     'Today',
        url:      s.url || 'https://www.iol.co.za',
      }));

    statusEl.textContent = `● LIVE — ${allStories.length} stories`;
    statusEl.className   = 'feed-status live';
    info.textContent     = 'Updated ' + new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    renderStories();

  } catch (e) {
    console.warn('Live fetch failed:', e.message);
    useFallbackStories(statusEl, info, 'Live fetch failed — showing sample stories');
  }
}

function useFallbackStories(statusEl, info, reason) {
  allStories = getFallbackStories();
  if (statusEl) { statusEl.textContent = '● SAMPLE STORIES'; statusEl.className = 'feed-status fallback'; }
  if (info) info.textContent = reason || 'Sample stories';
  renderStories();
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
    grid.innerHTML = `<div class="loading-placeholder"><p>No stories in this category.</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="story-card ${selectedIds.has(s.id) ? 'selected' : ''}"
         data-id="${escAttr(s.id)}" tabindex="0" role="checkbox"
         aria-checked="${selectedIds.has(s.id)}">
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
    card.addEventListener('click',   () => toggleStory(card.dataset.id));
    card.addEventListener('keydown', e  => { if (e.key === ' ' || e.key === 'Enter') toggleStory(card.dataset.id); });
  });
}

function toggleStory(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  const card = document.querySelector('.story-card[data-id="' + id + '"]');
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
  const filtered = currentFilter === 'all' ? allStories : allStories.filter(s => s.cat === currentFilter);
  filtered.forEach(s => selectedIds.add(s.id));
  renderStories(); updateActionBar();
}

function clearAll() {
  selectedIds.clear();
  renderStories(); updateActionBar();
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

  // Build rich story context — this is the key fix
  const storyContext = stories.map((s, i) => {
    const lines = [`STORY ${i + 1} [${s.cat.toUpperCase()}]`, `Headline: ${s.headline}`];
    if (s.excerpt) lines.push(`Details: ${s.excerpt}`);
    if (s.source)  lines.push(`Source: ${s.source}`);
    return lines.join('\n');
  }).join('\n\n---\n\n');

  const styleGuides = {
    formal:         'FORMAL / EVENING NEWS — Authoritative, measured, BBC/SABC style. Full sentences. No slang.',
    conversational: 'CONVERSATIONAL / DAYTIME — Warm, direct, inclusive. Speak TO the viewer. Contractions are fine.',
    energetic:      'ENERGETIC / SOCIAL MEDIA — Hook with the very first word. Short punchy sentences. High energy.',
    investigative:  'INVESTIGATIVE — Analytical, evidence-first. Signal why this matters before stating the facts.',
  };

  const wordsNeeded = Math.round((parseInt(duration) / 60) * 150);

  const prompt = `You are a senior broadcast journalist for IOL Broadcasting — South Africa's leading digital news network.

Write a ${duration}-second piece-to-camera broadcast bulletin script (approximately ${wordsNeeded} words of spoken copy).

You MUST cover ALL ${stories.length} of the following specific stor${stories.length === 1 ? 'y' : 'ies'}. Every sentence of copy must reference real details from these stories. Do NOT write generic filler — name the people, places, numbers and facts from the stories below.

════════════════════════════════════════
STORIES TO COVER (use all of them):
════════════════════════════════════════
${storyContext}
════════════════════════════════════════

STYLE: ${styleGuides[style] || styleGuides.formal}

SCRIPT FORMAT RULES:
1. Label every line of anchor copy with "ANCHOR:" at the start
2. Add stage directions in [SQUARE BRACKETS] inline — e.g. [PAUSE], [LOOK TO CAMERA 2], [GRAPHIC: headline text], [HALF TURN LEFT], [B-ROLL CUE]
3. Open with the most compelling specific fact or name from the most important story — hook in 5 words
4. Use natural broadcast transitions between stories: "Also making headlines...", "In sport tonight...", "Turning to the economy...", "And in politics...", "On the entertainment front..."
5. Each story gets dedicated copy — work in the specific details from the excerpt
6. Close with: "For the full story, head to iol.co.za — I'm [ANCHOR NAME], stay informed." 
7. Total spoken copy: approximately ${wordsNeeded} words

OUTPUT: the formatted script only. No preamble, no commentary, no notes.`;

  try {
    const text = await callClaude(apiKey, prompt, 1500);
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

  if (!headline && !content) { alert('Please enter at least a headline or story content.'); return; }

  showState('custom', 'loading');

  const styleGuides = {
    formal:         'FORMAL / EVENING NEWS — Authoritative, measured, full sentences.',
    conversational: 'CONVERSATIONAL / DAYTIME — Warm, direct, speak TO the viewer.',
    energetic:      'ENERGETIC / SOCIAL MEDIA — Hook first word, short sentences, high energy.',
    investigative:  'INVESTIGATIVE — Analytical, evidence-first, probing tone.',
  };

  const wordsNeeded = Math.round((parseInt(duration) / 60) * 150);

  const anchorSetup = anchors === '2'
    ? 'Format for TWO co-anchors. Label every line as "ANCHOR 1:" or "ANCHOR 2:". Anchor 1 opens and provides context. Anchor 2 develops the key facts and closes. They interact naturally — one sets up, the other delivers.'
    : 'Format for a SINGLE anchor. Label every line of copy as "ANCHOR:".';

  const platformCTAs = {
    'TikTok':                    'End CTA: "Follow IOL on TikTok — tap the follow button now."',
    'Instagram Reels':           'End CTA: "Full story in the link in our bio. Follow IOL for daily updates."',
    'YouTube':                   'End CTA: "Subscribe to IOL on YouTube and hit the notification bell."',
    'Facebook':                  'End CTA: "Like and follow IOL on Facebook to stay informed."',
    'Twitter / X':               'End CTA: "Follow @IOL on X for live updates."',
    'LinkedIn':                  'End CTA: "Follow IOL on LinkedIn for trusted South African news and business coverage."',
    'all social media platforms':'End CTA: "For the full story, visit iol.co.za."',
  };

  const prompt = `You are a senior broadcast journalist and scriptwriter for IOL Broadcasting — South Africa's most-read digital news platform.

Write a ${duration}-second (~${wordsNeeded} words) piece-to-camera script for the specific story below. Every single sentence must be about this actual story. Name real people, places, figures and facts. No generic padding.

════════════════════════════════════
STORY:
Headline:  ${headline || '(derive from content)'}
Category:  ${category}
Content:   ${content || '(write specifically from headline — be factual and precise)'}
${instructions ? `Special instructions: ${instructions}` : ''}
════════════════════════════════════

ANCHORS: ${anchorSetup}
STYLE: ${styleGuides[style] || styleGuides.formal}
PLATFORM: ${platform}
${platformCTAs[platform] || platformCTAs['all social media platforms']}

FORMAT RULES:
1. Every sentence of copy is about THIS story — specific names, numbers, quotes, context from the content above
2. Hook in the FIRST 5 WORDS using the most gripping specific detail
3. Stage directions in [SQUARE BRACKETS] — [PAUSE], [GRAPHIC: text], [LOOK TO CAMERA], [B-ROLL CUE] etc.
4. ~${wordsNeeded} words of spoken copy
5. IOL-branded sign-off with the platform CTA above

OUTPUT: formatted script only, no preamble.`;

  try {
    const text = await callClaude(apiKey, prompt, 1500);
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

  const prompt = `You are a leading podcast strategy consultant for IOL (Independent Online), South Africa's #1 digital news platform. Create a detailed, actionable podcast concept for the SA media landscape in 2025.

CLIENT BRIEF:
- Category: ${category}
- Target audience: ${audience}
- Frequency: ${frequency}
- Episode length: ${length}
- Host format: ${hosts}
- Platforms: ${platforms}
${hook        ? `- Unique angle: ${hook}` : ''}
${inspiration ? `- Inspiration: ${inspiration}` : ''}

Respond ONLY with a raw JSON object. No markdown fences. No preamble. Start with { end with }.

{
  "showName": "catchy 2-5 word name rooted in SA culture",
  "tagline": "one punchy line under 12 words",
  "elevator_pitch": "3 sentences: what is it, who is it for, why now in SA",
  "why_it_works": "3 sentences citing SA-specific platform behaviour and audience habits for ${audience} on ${platforms}",
  "format": "3-4 sentences on show structure, tone, recurring elements",
  "timeline": [
    { "time": "00:00-02:00", "segment": "name", "description": "what happens" },
    { "time": "02:00-08:00", "segment": "name", "description": "what happens" },
    { "time": "08:00-18:00", "segment": "name", "description": "what happens" },
    { "time": "18:00-25:00", "segment": "name", "description": "what happens" },
    { "time": "25:00-30:00", "segment": "name", "description": "what happens" }
  ],
  "sample_episodes": [
    { "ep": "01", "title": "episode title", "description": "2 specific sentences on content" },
    { "ep": "02", "title": "episode title", "description": "2 specific sentences on content" },
    { "ep": "03", "title": "episode title", "description": "2 specific sentences on content" },
    { "ep": "04", "title": "episode title", "description": "2 specific sentences on content" }
  ],
  "guest_strategy": [
    { "type": "guest category", "examples": "4 specific real South African names, orgs or institutions" },
    { "type": "guest category", "examples": "4 specific real South African names, orgs or institutions" },
    { "type": "guest category", "examples": "4 specific real South African names, orgs or institutions" }
  ],
  "platform_strategy": {
    "primary": "${platforms.split(',')[0].trim()}",
    "tactics": "3 specific actionable tactics for ${platforms} in the SA market",
    "repurposing": "how to turn one episode into 4-5 pieces of social content"
  },
  "monetisation": "3 realistic SA-specific monetisation pathways with example brands or partners",
  "launch_plan": "4 concrete steps for month 1 launch",
  "risk_factors": "2 specific risks for this SA concept and how to mitigate each"
}`;

  try {
    let text = await callClaude(apiKey, prompt, 2000);
    text = text.replace(/```json|```/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON returned. Please try again.');
    const pod = JSON.parse(jsonMatch[0]);
    renderPodcast(pod, platforms);
    showState('podcast', 'result');
  } catch (e) {
    showState('podcast', 'error', 'Error: ' + e.message);
  }
});

/* ============================================================
   RENDER PODCAST OUTPUT
   ============================================================ */
function renderPodcast(pod, platforms) {
  const badgeMap = {
    'Spotify':'badge-spotify','Apple Podcasts':'badge-apple','YouTube':'badge-youtube',
    'IOL Website':'badge-iol','TikTok':'badge-tiktok','Instagram':'badge-instagram','Facebook':'badge-facebook',
  };

  const badges = platforms.split(',').map(p => p.trim()).map(p =>
    `<span class="platform-badge ${badgeMap[p] || 'badge-default'}">${escHtml(p)}</span>`
  ).join('');

  const timeline = (pod.timeline || []).map(t =>
    `<tr><td class="timeline-time">${escHtml(t.time)}</td><td class="timeline-seg">${escHtml(t.segment)}</td><td class="timeline-desc">${escHtml(t.description)}</td></tr>`
  ).join('');

  const episodes = (pod.sample_episodes || []).map(e =>
    `<div class="episode-row"><div class="episode-num">EP.${escHtml(e.ep)}</div><div class="episode-title">${escHtml(e.title)}</div><div class="episode-desc">${escHtml(e.description)}</div></div>`
  ).join('');

  const guests = (pod.guest_strategy || []).map(g =>
    `<div class="guest-row"><div class="guest-type">${escHtml(g.type)}</div><div class="guest-examples">${escHtml(g.examples)}</div></div>`
  ).join('');

  document.getElementById('pod-output-title').textContent = pod.showName || 'Your Podcast';
  document.getElementById('pod-output-meta').textContent  = pod.tagline  || '';

  document.getElementById('podcast-body').innerHTML = `
    <div class="pod-section"><div class="pod-section-title">Concept</div><div class="pod-section-content">${escHtml(pod.elevator_pitch||'')}</div></div>
    <div class="pod-section"><div class="pod-section-title">Why It Works</div><div class="pod-section-content">${escHtml(pod.why_it_works||'')}</div><div class="platform-badges" style="margin-top:10px">${badges}</div></div>
    <div class="pod-section"><div class="pod-section-title">Show Format</div><div class="pod-section-content">${escHtml(pod.format||'')}</div></div>
    <div class="pod-section"><div class="pod-section-title">Episode Structure</div><table class="timeline-table"><tbody>${timeline}</tbody></table></div>
    <div class="pod-section"><div class="pod-section-title">Sample Episodes</div>${episodes}</div>
    <div class="pod-section"><div class="pod-section-title">Guest Strategy</div>${guests}</div>
    <div class="pod-section"><div class="pod-section-title">Platform Strategy</div><div class="pod-section-content">${escHtml(pod.platform_strategy?.tactics||'')}</div><div class="strategy-box" style="margin-top:10px"><div class="strategy-label">Content Repurposing</div><div class="strategy-text">${escHtml(pod.platform_strategy?.repurposing||'')}</div></div></div>
    <div class="pod-section"><div class="pod-section-title">Monetisation</div><div class="pod-section-content">${escHtml(pod.monetisation||'')}</div></div>
    <div class="pod-section"><div class="pod-section-title">Launch Plan</div><div class="pod-section-content">${escHtml(pod.launch_plan||'')}</div></div>
    <div class="pod-section"><div class="pod-section-title">Risk Factors &amp; Mitigation</div><div class="pod-section-content">${escHtml(pod.risk_factors||'')}</div></div>
  `;
}

/* ============================================================
   CLAUDE API
   ============================================================ */
async function callClaude(apiKey, prompt, maxTokens) {
  maxTokens = maxTokens || 1500;
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
    const msg = err?.error?.message || 'HTTP ' + res.status;
    if (res.status === 401) throw new Error('Invalid API key — check Settings.');
    if (res.status === 429) throw new Error('Rate limit — wait a moment and try again.');
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

/* ============================================================
   UI STATE
   ============================================================ */
function showState(prefix, state, errMsg) {
  const loading     = document.getElementById(prefix + '-loading');
  const placeholder = document.getElementById(prefix + '-placeholder');
  const errorEl     = document.getElementById(prefix + '-error');
  const resultEl    = document.getElementById(prefix === 'podcast' ? 'podcast-body' : prefix + '-script-text');

  [loading, placeholder, errorEl, resultEl].forEach(function(el) { if (el) el.style.display = 'none'; });

  if (state === 'loading') {
    if (loading) loading.style.display = 'flex';
  } else if (state === 'result') {
    if (resultEl) resultEl.style.display = 'block';
  } else if (state === 'error') {
    if (errorEl)     { errorEl.textContent = errMsg || 'An error occurred.'; errorEl.style.display = 'block'; }
    if (placeholder) { placeholder.style.display = 'block'; }
  }
}

function showSettingsAlert() {
  alert('Please add your Anthropic API key in the Settings tab first.');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('panel-settings').classList.add('active');
  setTimeout(function() { document.getElementById('api-key-input').focus(); }, 100);
}

/* ============================================================
   COPY & DOWNLOAD
   ============================================================ */
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('copy-btn')) {
    var el = document.getElementById(e.target.dataset.target);
    if (!el) return;
    var text = (el.innerText || el.textContent || '').trim();
    if (!text) { flashBtn(e.target, 'Nothing to copy'); return; }
    navigator.clipboard.writeText(text)
      .then(function() { flashBtn(e.target, '✓ Copied!'); })
      .catch(function() { flashBtn(e.target, 'Failed'); });
  }
  if (e.target.classList.contains('download-btn')) {
    var el2 = document.getElementById(e.target.dataset.target);
    if (!el2) return;
    var text2 = (el2.innerText || el2.textContent || '').trim();
    if (!text2) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text2], { type: 'text/plain;charset=utf-8' }));
    a.download = e.target.dataset.filename || 'iol-script.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }
});

function flashBtn(btn, msg) {
  var orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(function() { btn.textContent = orig; }, 1800);
}

/* ============================================================
   SETTINGS
   ============================================================ */
window.addEventListener('DOMContentLoaded', function() {
  var saved = localStorage.getItem('iol_api_key');
  if (saved) {
    document.getElementById('api-key-input').value = saved;
    setKeyStatus('● Key loaded from storage', 'ok');
  }
});

document.getElementById('save-api-key-btn').addEventListener('click', function() {
  var key = document.getElementById('api-key-input').value.trim();
  if (!key) { setKeyStatus('Enter an API key', 'err'); return; }
  if (!key.startsWith('sk-ant-')) { setKeyStatus('⚠ Should start with sk-ant-...', 'err'); return; }
  localStorage.setItem('iol_api_key', key);
  setKeyStatus('● Saved to browser storage', 'ok');
});

function setKeyStatus(msg, cls) {
  var el = document.getElementById('api-key-status');
  el.textContent = msg;
  el.className = 'api-key-status ' + cls;
}

document.getElementById('test-feed-btn').addEventListener('click', async function() {
  var btn = document.getElementById('test-feed-btn');
  var statusEl = document.getElementById('feed-status-settings');
  var apiKey = getApiKey();

  btn.disabled = true;
  btn.textContent = 'Testing...';
  statusEl.textContent = 'Testing...';
  statusEl.className = 'status-unknown';

  if (!apiKey) {
    statusEl.textContent = 'Add API key in Settings first';
    statusEl.className = 'status-err';
    btn.disabled = false; btn.textContent = 'Test Feed Connection';
    return;
  }

  try {
    var res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: API_MODEL, max_tokens: 200,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: 'Search for "iol.co.za" and return the first headline you find.' }],
      }),
    });
    var data = await res.json();
    if (data.error) throw new Error(data.error.message);
    statusEl.textContent = '✓ Web search active — live IOL stories will load on refresh';
    statusEl.className = 'status-ok';
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    statusEl.className = 'status-err';
  }
  btn.disabled = false;
  btn.textContent = 'Test Feed Connection';
});

/* ============================================================
   EVENT BINDINGS
   ============================================================ */
document.getElementById('cat-pills-feed').addEventListener('click', function(e) {
  if (e.target.classList.contains('cat-pill')) filterFeed(e.target.dataset.cat);
});
document.getElementById('select-all-btn').addEventListener('click', selectAll);
document.getElementById('clear-btn').addEventListener('click', clearAll);
document.getElementById('refresh-btn').addEventListener('click', loadStories);

document.getElementById('pod-platforms').addEventListener('click', function(e) {
  if (e.target.classList.contains('platform-pill')) {
    var p = e.target.dataset.platform;
    if (selectedPlatforms.has(p)) { selectedPlatforms.delete(p); e.target.classList.remove('active'); }
    else { selectedPlatforms.add(p); e.target.classList.add('active'); }
  }
});

/* ============================================================
   UTILITY
   ============================================================ */
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function escAttr(str) { return escHtml(str); }

/* ============================================================
   FALLBACK STORIES
   ============================================================ */
function getFallbackStories() {
  return [
    { id:'f1',  cat:'news',          headline:'Cape Town water crisis averted as winter rainfall exceeds seasonal forecasts',                   excerpt:'Dam levels at record highs after above-average winter rainfall across the Western Cape.',                              source:'IOL Cape',        time:'Today', url:'https://www.iol.co.za' },
    { id:'f2',  cat:'politics',      headline:'ANC faces crucial vote as coalition negotiations stall ahead of budget deadline',                excerpt:'Key alliance partners threaten to walk out as fiscal talks reach a critical juncture in Parliament.',                    source:'IOL Politics',    time:'Today', url:'https://www.iol.co.za' },
    { id:'f3',  cat:'business',      headline:'JSE surges as rand strengthens against dollar on positive economic outlook',                     excerpt:'The rand gained over 1% in early trade as investor sentiment improved on fresh growth forecasts.',                      source:'Business Report', time:'Today', url:'https://www.iol.co.za' },
    { id:'f4',  cat:'sport',         headline:'Springboks announce squad for British and Irish Lions series with three uncapped inclusions',    excerpt:'Coach Rassie Erasmus named three uncapped players who impressed in the URC this season.',                              source:'IOL Sport',       time:'Today', url:'https://www.iol.co.za' },
    { id:'f5',  cat:'entertainment', headline:'South African film wins top prize at three major European festivals in one weekend',             excerpt:'A Cape Town-produced drama has become the most-awarded South African film internationally in a decade.',                 source:'Tonight',         time:'Today', url:'https://www.iol.co.za' },
    { id:'f6',  cat:'technology',    headline:'Eskom confirms AI-powered grid management system rollout across five provinces',                 excerpt:'The utility says the system has already prevented an estimated 40 days of load shedding in pilot areas.',              source:'IOL Tech',        time:'Today', url:'https://www.iol.co.za' },
    { id:'f7',  cat:'politics',      headline:'Parliament debates land expropriation amendment in marathon overnight session',                  excerpt:'Proceedings stretched past midnight as opposition parties tabled over 200 amendments to the bill.',                     source:'IOL Politics',    time:'Today', url:'https://www.iol.co.za' },
    { id:'f8',  cat:'news',          headline:'SAPS launches 500-strong task force targeting Cape Flats gang violence',                         excerpt:'The specialised unit will be deployed across 12 identified hotspot areas beginning next week.',                         source:'IOL Crime',       time:'Today', url:'https://www.iol.co.za' },
    { id:'f9',  cat:'business',      headline:'Cape Town fintech startup raises R500 million in largest SA Series B round of the year',         excerpt:'The payments platform will use funding to expand into six African markets by the end of the year.',                     source:'Business Report', time:'Today', url:'https://www.iol.co.za' },
    { id:'f10', cat:'sport',         headline:'Banyana Banyana qualify for Olympic quarter finals with dramatic penalty shootout win',          excerpt:'The national women\'s team secured their place in the last eight with a 4-2 penalty win over Nigeria.',                  source:'IOL Sport',       time:'Today', url:'https://www.iol.co.za' },
    { id:'f11', cat:'news',          headline:'Eskom suspends load-shedding schedule indefinitely as generation hits 3-year milestone',         excerpt:'South Africans can expect uninterrupted power through winter for the first time since 2020.',                           source:'IOL Gauteng',     time:'Today', url:'https://www.iol.co.za' },
    { id:'f12', cat:'technology',    headline:'South Africa\'s first quantum computing centre opens in Pretoria with global partners',          excerpt:'The Wits University-backed facility will accelerate AI and technology research across the continent.',                  source:'IOL Tech',        time:'Today', url:'https://www.iol.co.za' },
    { id:'f13', cat:'motoring',      headline:'Ford Ranger Raptor R crowned SA performance bakkie of the year at annual industry awards',       excerpt:'The high-performance off-roader beat seven rivals to claim top honours at the Johannesburg ceremony.',                   source:'IOL Motoring',    time:'Today', url:'https://www.iol.co.za' },
    { id:'f14', cat:'lifestyle',     headline:'Western Cape restaurant earns Michelin star — only the third in Africa',                        excerpt:'The Franschhoek fine-dining establishment received the award at a ceremony in Paris this week.',                         source:'IOL Lifestyle',   time:'Today', url:'https://www.iol.co.za' },
    { id:'f15', cat:'news',          headline:'KwaZulu-Natal floods displace 3 000 residents as rescue teams race against rising rivers',       excerpt:'Four districts declared disaster zones as swollen rivers breached banks following two days of heavy rain.',              source:'IOL KZN',         time:'Today', url:'https://www.iol.co.za' },
  ];
}

/* ============================================================
   INIT
   ============================================================ */
loadStories();
