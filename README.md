# Gradio Pipelines Directory

> **This repo is the v0.2 snapshot. The live project is
> [kajica2/gradio-pipeline-directory](https://github.com/kajica2/gradio-pipeline-directory)
> → https://kajica2.github.io/gradio-pipeline-directory/**
>
> That build replaced the 24-tool grid here with a 12-tool directory plus a
> 12-section × 5-persona-lens Hub, added Open Graph/SEO, and fixed the
> accessibility regressions that Lighthouse caught. Work on the directory
> continues there — this repo is kept as history, and its own Pages site was
> never enabled, so every `kajica2.github.io/gradio-pipelines/` URL below
> now points at the live one instead.

A live, automatically updated directory of open-source, fully working
Gradio pipelines that handle audio and video tasks. **Zero local setup**
— deploy any tool to Hugging Face Spaces with just an API key and a
single command.

**Live site:** https://kajica2.github.io/gradio-pipeline-directory/

## What's in here

```
gradio-pipelines/
├── index.html              # Main directory page (mcp.so/agents-style)
├── tester.html             # Deploy tester — exercises the gradio deploy command
├── styles.css              # Design system (lifted from music-transcription-monitor)
├── app.js                  # Vanilla JS — no build step
├── featured.json           # 24 hand-curated Gradio audio/video tools
├── categories.json         # Sidebar filters (domain + category + sort)
├── content.json            # 11 content sections (Today, Papers, GitHub, etc.)
├── gradio-app/             # The reference "deploy in one command" Gradio app
│   ├── app.py              # Working Smart Audio Toolkit (391 lines, pure numpy)
│   ├── requirements.txt    # gradio + numpy + matplotlib
│   ├── Dockerfile          # Used by `gradio deploy` to build the Space image
│   ├── README_HF.md        # Hugging Face Space metadata (sdk: docker, port 7860)
│   ├── .gitattributes      # Makes Dockerfile + README_HF.md survive the deploy
│   └── README.md           # Human-facing README for the Space
├── e2e/                    # Puppeteer smoke test (all green)
│   ├── smoke.mjs
│   └── README.md
├── package.json            # e2e tooling (puppeteer) — the site itself has no build step
└── README.md               # This file
```

## End-to-end test

The directory site is verified by a Puppeteer e2e test that walks the
real pages, clicks the real filters, opens the real modal, and asserts
the deploy command contains the right tokens.

```bash
cd gradio-pipelines
python3 -m http.server 8765 &
node e2e/smoke.mjs
# → ✅ ALL CHECKS PASSED
```

22 checks, 0 console errors, 0 page errors, 0 network failures. Screenshots
land in `e2e/artifacts/`.

## How to customize

### 1. Add or remove a tool

Edit `featured.json`. Each tool is one object:

```json
{
  "id": "unique-slug",
  "name": "Display Name",
  "author": "github-owner",
  "type": "tool",
  "badge": "tool",
  "category": "music-generation",
  "subcategory": "audio",
  "description": "One-line summary (max ~140 chars).",
  "longDescription": "Multi-paragraph detail. **Markdown bold** supported.",
  "topics": ["text-to-music", "diffusion"],
  "language": "Python",
  "license": "MIT",
  "stars": 1234,
  "updated": "2026-08-08",
  "repo": "https://github.com/owner/repo",
  "space": "https://huggingface.co/spaces/owner/repo",
  "huggingface": true,
  "iconColor": "#7dd3c0",
  "deployable": true
}
```

The `category` must match an ID in `categories.json` so the sidebar filter
works. The `subcategory` must be either `audio` or `video` for the domain
filter. The `iconColor` is the gradient base for the card icon.

### 2. Change categories

Edit `categories.json`. Two groups: `domain` (single-select radio) and
`category` (multi-select checkboxes). The `count` is shown in the sidebar
— update it manually or run a script to compute it from `featured.json`.

### 3. Update the other 11 sections

Edit `content.json`. The 11 non-directory sections are:

| Key                | Section             |
|--------------------|---------------------|
| `todaysFocus`      | Today's Focus       |
| `latestPapers`     | Latest Papers       |
| `trendingRepos`    | Trending GitHub     |
| `researchGroups`   | Research Groups     |
| `agentFrameworks`  | Agent Frameworks    |
| `datasets`         | Datasets            |
| `benchmarks`       | Benchmarks          |
| `tutorials`        | Tutorials           |
| `videos`           | Videos              |
| `yourProjects`     | Your Own Projects   |
| `ideasInbox`       | Ideas Inbox         |
| `checklist`        | Checklist (persists to localStorage) |

### 4. Auto-fetch new repos (optional)

Add a cron job (or a GitHub Action) that:

1. Queries `https://api.github.com/search/repositories?q=gradio+topic:audio-video&sort=stars`
2. Filters to repos with a `space` deployment
3. Updates `featured.json` and `content.json#trendingRepos`
4. Commits + pushes to GitHub

## Deploy the site

It's a static site — any static host works.

### GitHub Pages

1. Push this repo to GitHub
2. Settings → Pages → Source: `main` branch, `/` (root)
3. Done. URL: `https://<user>.github.io/<repo>/`

### Vercel / Netlify

Just point at the repo. No build step. Publish directory: `/`.

### Local preview

```bash
cd gradio-pipelines
python3 -m http.server 8000
# open http://localhost:8000
```

> ⚠️ Don't open `index.html` directly via `file://` — the fetch calls
> for `featured.json` etc. won't work. Use a real HTTP server.

## Deploy any tool (the actual point)

1. Open https://huggingface.co/settings/tokens and create a token with
   **write** access.
2. Open the [deploy tester](tester.html) — it walks you through the
   command and validates your token live.
3. Or just run:
   ```bash
   pip install gradio
   export HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
   git clone --depth 1 https://github.com/owner/tool
   cd tool
   HF_TOKEN=$HF_TOKEN gradio deploy
   ```
   Note: the `gradio deploy` CLI takes only `--title` / `--app-file` /
   `--provider` and always deploys the **current directory**. There is no
   `--token` or `--repo` flag — the token comes from `HF_TOKEN`, and the repo
   has to be cloned first.
4. The Space URL is printed at the end. Open it. Done.

## Tech stack

- **Frontend**: Vanilla HTML + CSS + JS, no build step. Designed to
  match the music-transcription-monitor design system (dark terminal
  aesthetic, mint accent) with the mcp.so/agents interaction pattern
  (card grid + sidebar + modal).
- **Data**: Three JSON files (featured, categories, content) — no
  database, no API, no server. Pure static.
- **Deploy**: Any static host. The directory itself is fully static.
  The tools it links to run on Hugging Face Spaces.

## How "fully working" is verified

Every tool in `featured.json` has:
- A `repo` URL that points to a public GitHub repo
- A Gradio `app.py` at the root or in a known subpath
- A working `gradio deploy` walkthrough (see tester.html)

We don't test every tool end-to-end on every deploy — the directory is
**hand-curated**, not auto-discovered. The submission flow goes
through a GitHub Issue template (the "Submit" button in the header)
so each addition gets a human review.

## License

MIT. Use it, fork it, deploy it.

## Credits

- Design system: [music-transcription-monitor](https://kajica2.github.io/music-transcription-monitor/)
- Interaction pattern: [mcp.so/agents](https://mcp.so/agents)
- Tool curation: hand-picked, listed under each tool's original license
