# IOL Broadcasting Content Studio

A production-ready, zero-backend portal for IOL journalists and content creators to generate:

- **Broadcast bulletin scripts** from live IOL stories
- **Custom piece-to-camera scripts** for any story
- **Full podcast concepts** with episode plans, guest strategy & platform tactics

---

## 🚀 Deploy to GitHub Pages (3 steps)

1. **Create a GitHub repository** — e.g. `iol-broadcasting` (can be private or public)

2. **Upload all files** from this folder to the repository root:
   ```
   index.html
   style.css
   app.js
   assets/
     iol-logo-white.png
     iol-logo-dark.png
   README.md
   ```

3. **Enable GitHub Pages:**
   - Go to your repo → **Settings** → **Pages**
   - Under *Source*, select **main** branch, **/ (root)**
   - Click **Save**
   - Your site will be live at: `https://YOUR-USERNAME.github.io/iol-broadcasting`

---

## ⚙️ Configuration

### API Key
- Go to the **Settings** tab in the portal
- Enter your [Anthropic API key](https://console.anthropic.com) (starts with `sk-ant-...`)
- Keys are stored in your browser's `localStorage` — never sent anywhere except directly to Anthropic's API

### Live IOL Feed
The portal fetches live IOL stories via RSS through the [rss2json.com](https://rss2json.com) proxy (free, no API key required). If the feed is unavailable, it automatically falls back to 15 curated sample stories.

Feeds loaded:
| Category | RSS Source |
|---|---|
| News | iol.co.za/rss/news |
| Politics | iol.co.za/rss/politics |
| Sport | iol.co.za/rss/sport |
| Business | iol.co.za/rss/business |
| Entertainment | iol.co.za/rss/entertainment |
| Technology | iol.co.za/rss/technology |
| Motoring | iol.co.za/rss/motoring |
| Lifestyle | iol.co.za/rss/lifestyle |

---

## 📁 File Structure

```
iol-broadcasting/
├── index.html          # Main portal (single-page app)
├── style.css           # Full stylesheet
├── app.js              # All application logic
├── assets/
│   ├── iol-logo-white.png   # White IOL logo (for dark header)
│   └── iol-logo-dark.png    # Dark IOL logo (for favicon)
└── README.md
```

---

## 🔧 Features

### Tab 1 — Newsfeed Bulletin
- Fetches live IOL stories on load (with auto-fallback)
- Filter by category (News, Politics, Sport, Business, Entertainment, Technology, Motoring, Lifestyle)
- Select any number of stories
- Choose anchor style: Formal / Conversational / Energetic / Investigative
- Choose duration: 30s / 60s / 90s / 3min
- Generates a fully formatted piece-to-camera script with stage directions
- Copy or download the script

### Tab 2 — Custom Story Script
- Paste any story headline + content
- Select category, anchor style, duration, platform, 1 or 2 anchors
- Optional additional instructions
- Generates platform-optimised script with IOL branding

### Tab 3 — Podcast Concept Generator
- Select IOL category, target audience, frequency, episode length
- Choose publishing platforms (multi-select)
- Select host format
- Optional unique angle and inspiration
- Generates a complete concept: show name, tagline, episode structure, sample episodes, guest strategy, platform tactics, monetisation, launch plan

### Tab 4 — Settings
- API key management (saved to localStorage)
- Feed connection testing
- Deployment guidance

---

## 🔒 Privacy & Security

- API keys are stored in browser `localStorage` only
- No server, no database, no tracking
- All AI calls go directly from your browser to `api.anthropic.com`
- RSS data fetched via public rss2json.com proxy

---

## 🛠️ Tech Stack

- **Vanilla HTML/CSS/JS** — no frameworks, no build step
- **Anthropic Claude API** — claude-sonnet-4-20250514
- **rss2json.com** — CORS proxy for IOL RSS feeds
- **Google Fonts** — Bebas Neue, IBM Plex Sans, IBM Plex Mono

---

## 📞 Support

Built for the IOL team. For issues or feature requests, contact your development team.

**IOL Broadcasting Content Studio** · Powered by Claude AI · [iol.co.za](https://www.iol.co.za)
