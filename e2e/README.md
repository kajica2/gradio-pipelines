# E2E test (Puppeteer)

Smoke-tests the directory site the way a user would use it:

1. Loads `index.html`, asserts the 24 tool cards render.
2. Asserts the sidebar has the 11 category filters.
3. Searches for "whisper" → 1 card.
4. Clicks a category filter → grid shrinks.
5. Opens a card → detail modal opens with the `gradio deploy` command
   (containing `--token YOUR_HF_TOKEN --repo <url>`), the
   `huggingface.co/settings/tokens` link, and a working copy-to-clipboard.
6. Loads `tester.html` → 24 tool chips, `#cmd-preview` shows the full
   `gradio deploy --token $HF_TOKEN --repo ... --space-name ... --hardware ...` command.
7. Resizes to 390 px → mobile still renders all 24 cards.
8. Watches `console`, `pageerror`, and `requestfailed` → expects 0 errors.

Exit 0 on pass, non-zero on fail. Screenshots go to
`e2e/artifacts/{directory,modal,tester,mobile,pass}.png`.

## Run

```bash
# 1. Boot a static server
cd gradio-pipelines
python3 -m http.server 8765 &

# 2. Run the e2e
node e2e/smoke.mjs
```

> The test currently imports puppeteer from
> `../gradio-hub/node_modules/puppeteer` to reuse an existing install.
> For a clean checkout, run `npm install puppeteer` in this folder and
> change the import to `from 'puppeteer'`.
