---
title: Smart Audio Toolkit
emoji: 🎵
colorFrom: teal
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Audio analysis (BPM, key, trim, normalize) — zero local setup.
---

# Smart Audio Toolkit

Drop in any audio file. Get back:

- a normalized, trimmed version of the audio
- a waveform image
- a JSON report with detected BPM, key, and pipeline metadata

Pure Python + numpy + matplotlib. CPU-only. Docker image < 100 MB,
builds in < 60 s on Hugging Face's `cpu-basic` tier.

## How to deploy (this Space)

This is the canonical "deploy in one command" example for the
[Gradio Pipelines Directory](https://kajica2.github.io/gradio-pipelines/).

```bash
# 1. Get a write-enabled token at https://huggingface.co/settings/tokens
export HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx

# 2. Deploy
git clone --depth 1 https://github.com/kajica2/gradio-pipelines
cd gradio-pipelines/gradio-app
HF_TOKEN=$HF_TOKEN gradio deploy
```

`gradio deploy` deploys the current directory, so clone first and `cd` into
`gradio-app`. The token is read from `HF_TOKEN`.

Or click the "Deploy to HF" button on the directory page itself:
[open the directory →](https://kajica2.github.io/gradio-pipelines/)

## How to use (this Space)

1. Upload an audio file (mp3, wav, flac, ogg, m4a)
2. Optionally enable/disable: loudness normalization, silence trimming, BPM, key detection
3. Click **Analyze**
4. Get back the processed audio + a waveform PNG + a JSON report

## Files

- `app.py` — the Gradio app
- `requirements.txt` — Python deps
- `Dockerfile` — used by `gradio deploy` to build the Space image
- `README_HF.md` — Hugging Face Space metadata (this file)
