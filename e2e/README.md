# E2E test (Puppeteer)

Smoke-tests the directory site the way a user would use it:

1. Loads `index.html`, asserts the 24 tool cards render.
2. Asserts the sidebar has the 11 category filters.
3. Searches for "whisper" → 1 card.
4. Clicks a category filter → grid shrinks.
5. Opens a card → detail modal opens with the deploy command
   (`git clone --depth 1 <repo> && cd <dir> && HF_TOKEN=YOUR_HF_TOKEN gradio deploy`),
   the `huggingface.co/settings/tokens` link, and a working copy-to-clipboard.
   The test also asserts the command does **not** use `--token` / `--repo`,
   which the Gradio CLI has never accepted.
6. Loads `tester.html` → 24 tool chips, `#cmd-preview` shows the full
   `git clone … && cd … && HF_TOKEN=$HF_TOKEN gradio deploy` command.
7. Resizes to 390 px → mobile still renders all 24 cards.
8. Watches `console`, `pageerror`, and `requestfailed` → expects 0 errors.

Exit 0 on pass, non-zero on fail. Screenshots go to
`e2e/artifacts/{directory,modal,tester,mobile,pass}.png`.

## Run

```bash
# 1. Install the test dependency (once)
cd gradio-pipelines
npm install

# 2. Boot a static server
python3 -m http.server 8765 &

# 3. Run the e2e
node e2e/smoke.mjs
```

To test a deployed copy instead of the local server:

```bash
E2E_URL=https://kajica2.github.io/gradio-pipeline-directory node e2e/smoke.mjs
```

> The test resolves `puppeteer` from this project first, then falls back to a
> sibling checkout that already has it installed. A hard-coded absolute path
> into an unrelated repo breaks as soon as that repo moves or is deleted.
