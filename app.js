/* ============================================================
   IOL BROADCASTING CONTENT STUDIO — app.js v3
   RSS parsed client-side via allorigins CORS proxy
   No API credits used for story loading
   ============================================================ */
'use strict';

const API_URL   = 'https://api.anthropic.com/v1/messages';
const API_MODEL = 'claude-sonnet-4-20250514';

// IOL RSS feeds — pattern: https://iol.co.za/rss/extended/iol/{section}/
// Proxied through allorigins.win to bypass CORS
const FEEDS = [
  { section: 'news',          cat: 'news',          label: 'IOL News' },
  { section: 'sport',         cat: 'sport',         label: 'IOL Sport' },
  { section: 'business',      cat: 'business',      label: 'Business Report' },
  { section: 'entertainment', cat: 'entertainment', label: 'Tonight' },
  { section: 'technology',    cat: 'technology',    label: 'IOL Tech' },
  { section: 'motoring',      cat: 'motoring',      label: 'IOL Motoring' },
  { section: 'lifestyle',     cat: 'lifestyle',     label: 'IOL Lifestyle' },
];

function feedUrl(section) {
  const rss = encodeURIComponent('https://iol.co.za/rss/extended/iol/' + section + '/');
  return 'https://api.allorigins.win/get?url=' + rss;
}

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
document.querySelectorAll('.nav-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    var target = tab.dataset.tab;
    document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('panel-' + target).classList.add('active');
  });
});

/* ============================================================
   PARSE RSS XML
   ============================================================ */
function parseRSS(xmlStr, cat, defaultSource) {
  var parser = new DOMParser();
  var doc    = parser.parseFromString(xmlStr, 'text/xml');
  var items  = doc.querySelectorAll('item');
  var stories = [];

  items.forEach(function(item, i) {
    var title   = text(item, 'title');
    var link    = text(item, 'link');
    var desc    = text(item, 'description');
    var content = text(item, 'content\\:encoded') || text(item, 'encoded') || '';
    var author  = text(item, 'author') || defaultSource;
    var pubDate = text(item, 'pubDate');

    if (!title || title.length < 10) return;

    // Strip HTML from desc/content for clean excerpt
    var rawExcerpt = desc || content.slice(0, 400);
    var excerpt    = stripHtml(rawExcerpt).replace(/\s+/g, ' ').trim().slice(0, 200);

    // Detect sub-category from URL
    var derivedCat = cat;
    if (link) {
      if (/\/politics\//.test(link))     derivedCat = 'politics';
      else if (/\/sport\//.test(link))   derivedCat = 'sport';
      else if (/\/business\//.test(link))derivedCat = 'business';
      else if (/\/crime/.test(link))     derivedCat = 'news';
      else if (/\/weather\//.test(link)) derivedCat = 'news';
    }

    stories.push({
      id:       cat + '-' + i + '-' + Date.now(),
      cat:      derivedCat,
      headline: title.trim(),
      excerpt:  excerpt,
      source:   author.replace(/\n/g,' ').trim().slice(0,40) || defaultSource,
      time:     relTime(pubDate),
      url:      link || 'https://www.iol.co.za',
    });
  });

  return stories;
}

function text(el, tag) {
  var node = el.querySelector(tag);
  return node ? (node.textContent || node.innerText || '') : '';
}

function stripHtml(html) {
  var d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

function relTime(dateStr) {
  if (!dateStr) return 'Today';
  try {
    var diff = Date.now() - new Date(dateStr).getTime();
    var m    = Math.floor(diff / 60000);
    if (m < 1)    return 'Just now';
    if (m < 60)   return m + 'm ago';
    if (m < 1440) return Math.floor(m / 60) + 'h ago';
    return Math.floor(m / 1440) + 'd ago';
  } catch (e) { return 'Today'; }
}

/* ============================================================
   LOAD STORIES — pure RSS, no API credits
   ============================================================ */
async function loadStories() {
  var grid     = document.getElementById('stories-grid');
  var info     = document.getElementById('last-refresh');
  var statusEl = document.getElementById('feed-status');

  selectedIds.clear();
  updateActionBar();
  grid.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div><p>Fetching live IOL stories...</p></div>';
  info.textContent = 'Fetching...';

  var fetched = [];
  var liveCount = 0;

  // Fetch all feeds in parallel
  var promises = FEEDS.map(function(feed) {
    return fetch(feedUrl(feed.section), { signal: AbortSignal.timeout(10000) })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.contents) return [];
        var stories = parseRSS(data.contents, feed.cat, feed.label);
        if (stories.length > 0) liveCount++;
        return stories;
      })
      .catch(function() { return []; });
  });

  var results = await Promise.allSettled(promises);
  results.forEach(function(r) {
    if (r.status === 'fulfilled') fetched = fetched.concat(r.value);
  });

  // Deduplicate by headline
  var seen = new Set();
  fetched = fetched.filter(function(s) {
    var key = s.headline.toLowerCase().slice(0, 70);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (fetched.length >= 5) {
    allStories = fetched;
    statusEl.textContent = '● LIVE — ' + fetched.length + ' stories from ' + liveCount + ' sections';
    statusEl.className   = 'feed-status live';
    info.textContent     = 'Updated ' + new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  } else {
    allStories = getFallbackStories();
    statusEl.textContent = '● SAMPLE STORIES (feed unavailable)';
    statusEl.className   = 'feed-status fallback';
    info.textContent     = 'Using sample stories';
  }

  renderStories();
}

/* ============================================================
   RENDER STORIES
   ============================================================ */
function renderStories() {
  var grid     = document.getElementById('stories-grid');
  var filtered = currentFilter === 'all'
    ? allStories
    : allStories.filter(function(s) { return s.cat === currentFilter; });

  if (!filtered.length) {
    grid.innerHTML = '<div class="loading-placeholder"><p>No stories in this category right now.</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(function(s) {
    return '<div class="story-card ' + (selectedIds.has(s.id) ? 'selected' : '') + '" '
      + 'data-id="' + escAttr(s.id) + '" tabindex="0" role="checkbox" '
      + 'aria-checked="' + selectedIds.has(s.id) + '">'
      + '<div class="story-check" aria-hidden="true">✓</div>'
      + '<div class="story-tag">' + escHtml(s.cat) + '</div>'
      + '<div class="story-headline">' + escHtml(s.headline) + '</div>'
      + (s.excerpt ? '<div class="story-excerpt">' + escHtml(s.excerpt) + '</div>' : '')
      + '<div class="story-meta">'
      + '<span class="story-source">' + escHtml(s.source) + '</span>'
      + '<span>·</span>'
      + '<span>' + escHtml(s.time) + '</span>'
      + '</div></div>';
  }).join('');

  grid.querySelectorAll('.story-card').forEach(function(card) {
    card.addEventListener('click', function() { toggleStory(card.dataset.id); });
    card.addEventListener('keydown', function(e) {
      if (e.key === ' ' || e.key === 'Enter') toggleStory(card.dataset.id);
    });
  });
}

function toggleStory(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  var card = document.querySelector('.story-card[data-id="' + id + '"]');
  if (card) {
    card.classList.toggle('selected');
    card.setAttribute('aria-checked', selectedIds.has(id).toString());
  }
  updateActionBar();
}

function updateActionBar() {
  var n = selectedIds.size;
  document.getElementById('selected-count').textContent = n + ' selected';
  document.getElementById('action-count').textContent   = n + ' stor' + (n === 1 ? 'y' : 'ies');
  document.getElementById('gen-bulletin-btn').disabled  = n === 0;
}

function filterFeed(cat) {
  currentFilter = cat;
  document.querySelectorAll('#cat-pills-feed .cat-pill').forEach(function(p) {
    p.classList.toggle('active', p.dataset.cat === cat);
  });
  renderStories();
}

function selectAll() {
  var filtered = currentFilter === 'all' ? allStories : allStories.filter(function(s) { return s.cat === currentFilter; });
  filtered.forEach(function(s) { selectedIds.add(s.id); });
  renderStories(); updateActionBar();
}

function clearAll() {
  selectedIds.clear();
  renderStories(); updateActionBar();
}

/* ============================================================
   GENERATE BULLETIN SCRIPT
   ============================================================ */
document.getElementById('gen-bulletin-btn').addEventListener('click', async function() {
  var apiKey = getApiKey();
  if (!apiKey) { showSettingsAlert(); return; }

  var stories  = allStories.filter(function(s) { return selectedIds.has(s.id); });
  var style    = document.getElementById('anchor-style').value;
  var duration = document.getElementById('script-duration').value;

  showState('bulletin', 'loading');

  var storyContext = stories.map(function(s, i) {
    var lines = ['STORY ' + (i + 1) + ' [' + s.cat.toUpperCase() + ']', 'Headline: ' + s.headline];
    if (s.excerpt) lines.push('Details: ' + s.excerpt);
    if (s.source)  lines.push('Source: ' + s.source);
    return lines.join('\n');
  }).join('\n\n---\n\n');

  var styleGuides = {
    formal:         'FORMAL / EVENING NEWS — Authoritative, measured, BBC/SABC style. Full sentences, no slang.',
    conversational: 'CONVERSATIONAL / DAYTIME — Warm, direct, inclusive. Contractions fine. Speak TO the viewer.',
    energetic:      'ENERGETIC / SOCIAL MEDIA — Hook with the first word. Short punchy sentences. High energy throughout.',
    investigative:  'INVESTIGATIVE — Analytical, evidence-first. Signal significance before stating facts.',
  };

  var wordsNeeded = Math.round((parseInt(duration) / 60) * 150);

  var prompt = 'You are a senior broadcast journalist for IOL Broadcasting — South Africa\'s leading digital news network.\n\n'
    + 'Write a ' + duration + '-second piece-to-camera broadcast bulletin script (approximately ' + wordsNeeded + ' words of spoken copy).\n\n'
    + 'You MUST cover ALL ' + stories.length + ' of the following specific stories. Every sentence must reference real details — names, facts, figures — from these stories. No generic filler.\n\n'
    + '════════════════════════════════════════\n'
    + 'STORIES TO COVER:\n'
    + '════════════════════════════════════════\n'
    + storyContext + '\n'
    + '════════════════════════════════════════\n\n'
    + 'STYLE: ' + (styleGuides[style] || styleGuides.formal) + '\n\n'
    + 'FORMAT RULES:\n'
    + '1. Label every line of anchor copy with "ANCHOR:" at the start\n'
    + '2. Stage directions in [SQUARE BRACKETS] — [PAUSE], [LOOK TO CAMERA 2], [GRAPHIC: headline], [HALF TURN], [B-ROLL CUE]\n'
    + '3. Open with the most compelling specific fact from the top story — hook in 5 words\n'
    + '4. Broadcast transitions between stories: "Also tonight...", "In sport...", "Turning to the economy...", "In politics today..."\n'
    + '5. Work specific details — names, numbers, organisations — from each story\'s excerpt into the copy\n'
    + '6. Close: "For the full story, visit iol.co.za — I\'m [ANCHOR NAME], stay informed."\n'
    + '7. ~' + wordsNeeded + ' words of spoken copy\n\n'
    + 'Output ONLY the formatted script. No preamble, no notes.';

  try {
    var text = await callClaude(apiKey, prompt, 1500);
    document.getElementById('bulletin-script-text').textContent = text;
    document.getElementById('bulletin-meta').textContent = stories.length + ' stories · ' + duration + 's · ' + style;
    showState('bulletin', 'result');
  } catch (e) {
    showState('bulletin', 'error', e.message);
  }
});

/* ============================================================
   GENERATE CUSTOM SCRIPT
   ============================================================ */
document.getElementById('gen-custom-btn').addEventListener('click', async function() {
  var apiKey = getApiKey();
  if (!apiKey) { showSettingsAlert(); return; }

  var headline     = document.getElementById('custom-headline').value.trim();
  var content      = document.getElementById('custom-content').value.trim();
  var category     = document.getElementById('custom-category').value;
  var style        = document.getElementById('custom-style').value;
  var duration     = document.getElementById('custom-duration').value;
  var platform     = document.getElementById('custom-platform').value;
  var anchors      = document.getElementById('custom-anchors').value;
  var instructions = document.getElementById('custom-instructions').value.trim();

  if (!headline && !content) { alert('Please enter at least a headline or story content.'); return; }

  showState('custom', 'loading');

  var styleGuides = {
    formal:         'FORMAL / EVENING NEWS — Authoritative, measured, full sentences.',
    conversational: 'CONVERSATIONAL / DAYTIME — Warm, direct, speak TO the viewer.',
    energetic:      'ENERGETIC / SOCIAL MEDIA — Hook first word, short punchy sentences.',
    investigative:  'INVESTIGATIVE — Analytical, evidence-first, probing.',
  };

  var wordsNeeded  = Math.round((parseInt(duration) / 60) * 150);
  var anchorSetup  = anchors === '2'
    ? 'TWO co-anchors. Label all copy "ANCHOR 1:" or "ANCHOR 2:". Anchor 1 sets up context, Anchor 2 delivers key facts and closes.'
    : 'SINGLE anchor. Label all copy "ANCHOR:".';

  var platformCTAs = {
    'TikTok':                    'End: "Follow IOL on TikTok — tap the follow button now."',
    'Instagram Reels':           'End: "Full story in the link in our bio. Follow IOL for daily updates."',
    'YouTube':                   'End: "Subscribe to IOL on YouTube and hit the notification bell."',
    'Facebook':                  'End: "Like and follow IOL on Facebook to stay informed."',
    'Twitter / X':               'End: "Follow @IOL on X for live updates."',
    'LinkedIn':                  'End: "Follow IOL on LinkedIn for trusted South African coverage."',
    'all social media platforms':'End: "For the full story, visit iol.co.za."',
  };

  var prompt = 'You are a senior broadcast journalist for IOL Broadcasting.\n\n'
    + 'Write a ' + duration + '-second (~' + wordsNeeded + ' words) piece-to-camera script for this specific story. '
    + 'Every sentence must be about this actual story — name real people, places, numbers and facts. No generic padding.\n\n'
    + '════════════════════════════════════\n'
    + 'STORY:\n'
    + 'Headline: ' + (headline || '(derive from content)') + '\n'
    + 'Category: ' + category + '\n'
    + 'Content: ' + (content || '(write specifically from headline)') + '\n'
    + (instructions ? 'Special instructions: ' + instructions + '\n' : '')
    + '════════════════════════════════════\n\n'
    + 'ANCHORS: ' + anchorSetup + '\n'
    + 'STYLE: ' + (styleGuides[style] || styleGuides.formal) + '\n'
    + 'PLATFORM: ' + platform + '\n'
    + (platformCTAs[platform] || platformCTAs['all social media platforms']) + '\n\n'
    + 'FORMAT:\n'
    + '1. Every sentence is about THIS story — specific names, numbers, context\n'
    + '2. Hook in the FIRST 5 WORDS using the most gripping detail\n'
    + '3. Stage directions in [SQUARE BRACKETS]\n'
    + '4. ~' + wordsNeeded + ' words of spoken copy\n'
    + '5. IOL-branded sign-off with platform CTA\n\n'
    + 'Output ONLY the formatted script.';

  try {
    var text = await callClaude(apiKey, prompt, 1500);
    document.getElementById('custom-script-text').textContent = text;
    showState('custom', 'result');
  } catch (e) {
    showState('custom', 'error', e.message);
  }
});

/* ============================================================
   GENERATE PODCAST CONCEPT
   ============================================================ */
document.getElementById('gen-podcast-btn').addEventListener('click', async function() {
  var apiKey = getApiKey();
  if (!apiKey) { showSettingsAlert(); return; }

  var category    = document.getElementById('pod-category').value;
  var audience    = document.getElementById('pod-audience').value;
  var frequency   = document.getElementById('pod-frequency').value;
  var length      = document.getElementById('pod-length').value;
  var hosts       = document.getElementById('pod-hosts').value;
  var hook        = document.getElementById('pod-hook').value.trim();
  var inspiration = document.getElementById('pod-inspiration').value.trim();
  var platforms   = Array.from(selectedPlatforms).join(', ') || 'Spotify';

  showState('podcast', 'loading');

  var prompt = 'You are a podcast strategy consultant for IOL, South Africa\'s #1 digital news platform.\n\n'
    + 'Create a detailed podcast concept for the SA market in 2025.\n\n'
    + 'BRIEF:\n'
    + '- Category: ' + category + '\n'
    + '- Audience: ' + audience + '\n'
    + '- Frequency: ' + frequency + '\n'
    + '- Length: ' + length + '\n'
    + '- Hosts: ' + hosts + '\n'
    + '- Platforms: ' + platforms + '\n'
    + (hook        ? '- Angle: ' + hook + '\n' : '')
    + (inspiration ? '- Inspiration: ' + inspiration + '\n' : '')
    + '\nRespond ONLY with a raw JSON object (no markdown fences, no preamble):\n\n'
    + '{"showName":"2-5 word SA-rooted name","tagline":"punchy line under 12 words",'
    + '"elevator_pitch":"3 sentences: what, who, why now",'
    + '"why_it_works":"3 sentences on SA platform behaviour for this audience on ' + platforms + '",'
    + '"format":"3-4 sentences on structure and tone",'
    + '"timeline":['
    + '{"time":"00:00-02:00","segment":"name","description":"what happens"},'
    + '{"time":"02:00-08:00","segment":"name","description":"what happens"},'
    + '{"time":"08:00-18:00","segment":"name","description":"what happens"},'
    + '{"time":"18:00-25:00","segment":"name","description":"what happens"},'
    + '{"time":"25:00-30:00","segment":"name","description":"what happens"}],'
    + '"sample_episodes":['
    + '{"ep":"01","title":"title","description":"2 specific sentences"},'
    + '{"ep":"02","title":"title","description":"2 specific sentences"},'
    + '{"ep":"03","title":"title","description":"2 specific sentences"},'
    + '{"ep":"04","title":"title","description":"2 specific sentences"}],'
    + '"guest_strategy":['
    + '{"type":"guest category","examples":"4 real South African names or institutions"},'
    + '{"type":"guest category","examples":"4 real South African names or institutions"},'
    + '{"type":"guest category","examples":"4 real South African names or institutions"}],'
    + '"platform_strategy":{"primary":"' + platforms.split(',')[0].trim() + '",'
    + '"tactics":"3 specific SA tactics for ' + platforms + '",'
    + '"repurposing":"how to turn 1 episode into 4-5 social content pieces"},'
    + '"monetisation":"3 SA-specific monetisation pathways with example brands",'
    + '"launch_plan":"4 concrete month-1 steps",'
    + '"risk_factors":"2 SA-specific risks and mitigations"}';

  try {
    var rawText = await callClaude(apiKey, prompt, 2000);
    rawText = rawText.replace(/```json|```/g, '').trim();
    var jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON returned. Please try again.');
    var pod = JSON.parse(jsonMatch[0]);
    renderPodcast(pod, platforms);
    showState('podcast', 'result');
  } catch (e) {
    showState('podcast', 'error', 'Error: ' + e.message);
  }
});

/* ============================================================
   RENDER PODCAST
   ============================================================ */
function renderPodcast(pod, platforms) {
  var badgeMap = {
    'Spotify':'badge-spotify','Apple Podcasts':'badge-apple','YouTube':'badge-youtube',
    'IOL Website':'badge-iol','TikTok':'badge-tiktok','Instagram':'badge-instagram','Facebook':'badge-facebook',
  };

  var badges = platforms.split(',').map(function(p) {
    p = p.trim();
    return '<span class="platform-badge ' + (badgeMap[p] || 'badge-default') + '">' + escHtml(p) + '</span>';
  }).join('');

  var timeline = (pod.timeline || []).map(function(t) {
    return '<tr><td class="timeline-time">' + escHtml(t.time) + '</td>'
      + '<td class="timeline-seg">' + escHtml(t.segment) + '</td>'
      + '<td class="timeline-desc">' + escHtml(t.description) + '</td></tr>';
  }).join('');

  var episodes = (pod.sample_episodes || []).map(function(e) {
    return '<div class="episode-row"><div class="episode-num">EP.' + escHtml(e.ep) + '</div>'
      + '<div class="episode-title">' + escHtml(e.title) + '</div>'
      + '<div class="episode-desc">' + escHtml(e.description) + '</div></div>';
  }).join('');

  var guests = (pod.guest_strategy || []).map(function(g) {
    return '<div class="guest-row"><div class="guest-type">' + escHtml(g.type) + '</div>'
      + '<div class="guest-examples">' + escHtml(g.examples) + '</div></div>';
  }).join('');

  document.getElementById('pod-output-title').textContent = pod.showName || 'Your Podcast';
  document.getElementById('pod-output-meta').textContent  = pod.tagline  || '';

  document.getElementById('podcast-body').innerHTML =
    '<div class="pod-section"><div class="pod-section-title">Concept</div><div class="pod-section-content">' + escHtml(pod.elevator_pitch || '') + '</div></div>'
    + '<div class="pod-section"><div class="pod-section-title">Why It Works</div><div class="pod-section-content">' + escHtml(pod.why_it_works || '') + '</div><div class="platform-badges" style="margin-top:10px">' + badges + '</div></div>'
    + '<div class="pod-section"><div class="pod-section-title">Show Format</div><div class="pod-section-content">' + escHtml(pod.format || '') + '</div></div>'
    + '<div class="pod-section"><div class="pod-section-title">Episode Structure</div><table class="timeline-table"><tbody>' + timeline + '</tbody></table></div>'
    + '<div class="pod-section"><div class="pod-section-title">Sample Episodes</div>' + episodes + '</div>'
    + '<div class="pod-section"><div class="pod-section-title">Guest Strategy</div>' + guests + '</div>'
    + '<div class="pod-section"><div class="pod-section-title">Platform Strategy</div><div class="pod-section-content">' + escHtml((pod.platform_strategy && pod.platform_strategy.tactics) || '') + '</div>'
    + '<div class="strategy-box" style="margin-top:10px"><div class="strategy-label">Content Repurposing</div><div class="strategy-text">' + escHtml((pod.platform_strategy && pod.platform_strategy.repurposing) || '') + '</div></div></div>'
    + '<div class="pod-section"><div class="pod-section-title">Monetisation</div><div class="pod-section-content">' + escHtml(pod.monetisation || '') + '</div></div>'
    + '<div class="pod-section"><div class="pod-section-title">Launch Plan</div><div class="pod-section-content">' + escHtml(pod.launch_plan || '') + '</div></div>'
    + '<div class="pod-section"><div class="pod-section-title">Risk Factors &amp; Mitigation</div><div class="pod-section-content">' + escHtml(pod.risk_factors || '') + '</div></div>';
}

/* ============================================================
   CLAUDE API (only used for script/podcast generation)
   ============================================================ */
async function callClaude(apiKey, prompt, maxTokens) {
  maxTokens = maxTokens || 1500;
  var res = await fetch(API_URL, {
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
    var err = await res.json().catch(function() { return {}; });
    var msg = (err.error && err.error.message) || ('HTTP ' + res.status);
    if (res.status === 401) throw new Error('Invalid API key — check Settings.');
    if (res.status === 429) throw new Error('Rate limit — wait a moment and try again.');
    throw new Error(msg);
  }
  var data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
}

/* ============================================================
   UI STATE
   ============================================================ */
function showState(prefix, state, errMsg) {
  var loading     = document.getElementById(prefix + '-loading');
  var placeholder = document.getElementById(prefix + '-placeholder');
  var errorEl     = document.getElementById(prefix + '-error');
  var resultEl    = document.getElementById(prefix === 'podcast' ? 'podcast-body' : prefix + '-script-text');

  [loading, placeholder, errorEl, resultEl].forEach(function(el) { if (el) el.style.display = 'none'; });

  if (state === 'loading') {
    if (loading) loading.style.display = 'flex';
  } else if (state === 'result') {
    if (resultEl) resultEl.style.display = 'block';
  } else if (state === 'error') {
    if (errorEl)     { errorEl.textContent = errMsg || 'An error occurred.'; errorEl.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'block';
  }
}

function showSettingsAlert() {
  alert('Please add your Anthropic API key in the ⚙️ Settings tab first.');
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
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
    var t = (el.innerText || el.textContent || '').trim();
    if (!t) { flashBtn(e.target, 'Nothing to copy'); return; }
    navigator.clipboard.writeText(t)
      .then(function() { flashBtn(e.target, '✓ Copied!'); })
      .catch(function() { flashBtn(e.target, 'Failed'); });
  }
  if (e.target.classList.contains('download-btn')) {
    var el2 = document.getElementById(e.target.dataset.target);
    if (!el2) return;
    var t2 = (el2.innerText || el2.textContent || '').trim();
    if (!t2) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([t2], { type: 'text/plain;charset=utf-8' }));
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
  var btn      = document.getElementById('test-feed-btn');
  var statusEl = document.getElementById('feed-status-settings');
  btn.disabled = true; btn.textContent = 'Testing...';
  statusEl.textContent = 'Testing...'; statusEl.className = 'status-unknown';
  try {
    var rss = encodeURIComponent('https://iol.co.za/rss/extended/iol/news/');
    var res = await fetch('https://api.allorigins.win/get?url=' + rss, { signal: AbortSignal.timeout(8000) });
    var data = await res.json();
    if (data.contents && data.contents.includes('<item>')) {
      var count = (data.contents.match(/<item>/g) || []).length;
      statusEl.textContent = '✓ Live IOL feed working — ' + count + ' items found';
      statusEl.className = 'status-ok';
    } else {
      statusEl.textContent = 'Feed returned no items';
      statusEl.className = 'status-err';
    }
  } catch (e) {
    statusEl.textContent = 'Cannot reach feed: ' + e.message;
    statusEl.className = 'status-err';
  }
  btn.disabled = false; btn.textContent = 'Test Feed Connection';
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
    { id:'f1',  cat:'news',          headline:'Cape Town water crisis averted as winter rainfall exceeds seasonal forecasts',                  excerpt:'Dam levels at record highs after above-average winter rainfall across the Western Cape.',                          source:'IOL Cape',        time:'Today', url:'https://www.iol.co.za' },
    { id:'f2',  cat:'politics',      headline:'ANC faces crucial vote as coalition negotiations stall ahead of budget deadline',               excerpt:'Key alliance partners threaten to walk out as fiscal talks reach a critical juncture.',                             source:'IOL Politics',    time:'Today', url:'https://www.iol.co.za' },
    { id:'f3',  cat:'business',      headline:'JSE surges as rand strengthens against dollar on positive economic outlook',                    excerpt:'The rand gained over 1% in early trade as investor sentiment improved on fresh growth data.',                        source:'Business Report', time:'Today', url:'https://www.iol.co.za' },
    { id:'f4',  cat:'sport',         headline:'Springboks name squad for British and Irish Lions series with three uncapped players',          excerpt:'Coach Rassie Erasmus handed debut call-ups to three players who impressed in the URC this season.',                  source:'IOL Sport',       time:'Today', url:'https://www.iol.co.za' },
    { id:'f5',  cat:'entertainment', headline:'South African film wins top prize at three major European festivals in one weekend',            excerpt:'A Cape Town-produced drama has become the most internationally awarded South African film in a decade.',               source:'Tonight',         time:'Today', url:'https://www.iol.co.za' },
    { id:'f6',  cat:'technology',    headline:'Eskom confirms AI-powered grid management rollout across five provinces',                       excerpt:'The utility says the system has already prevented an estimated 40 days of load shedding in pilot areas.',             source:'IOL Tech',        time:'Today', url:'https://www.iol.co.za' },
    { id:'f7',  cat:'news',          headline:'SAPS launches 500-strong task force targeting Cape Flats gang violence',                        excerpt:'The specialised unit deploys across 12 hotspot areas beginning next week.',                                           source:'IOL Crime',       time:'Today', url:'https://www.iol.co.za' },
    { id:'f8',  cat:'business',      headline:'Cape Town fintech raises R500 million in largest SA Series B round of the year',               excerpt:'The payments platform will expand into six African markets using the new funding.',                                   source:'Business Report', time:'Today', url:'https://www.iol.co.za' },
    { id:'f9',  cat:'sport',         headline:'Banyana Banyana qualify for Olympic quarter finals with dramatic penalty shootout win',         excerpt:'The national women\'s team won 4-2 on penalties to secure their place in the last eight.',                          source:'IOL Sport',       time:'Today', url:'https://www.iol.co.za' },
    { id:'f10', cat:'motoring',      headline:'Ford Ranger Raptor R crowned SA performance bakkie of the year at annual industry awards',     excerpt:'The off-roader beat seven rivals at the Johannesburg ceremony to claim the top honour.',                             source:'IOL Motoring',    time:'Today', url:'https://www.iol.co.za' },
  ];
}

/* ============================================================
   INIT
   ============================================================ */
loadStories();
