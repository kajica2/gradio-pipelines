# Smart Audio Toolkit — Gradio app

A working Gradio app that ships with the [Gradio Pipelines Directory](../).
This is the "deploy in one command" example used by the directory's
[deploy tester](https://kajica2.github.io/gradio-pipelines/tester.html).

## What it does

- Upload any audio file (mp3, wav, flac, ogg, m4a)
- Detects BPM via autocorrelation on the onset envelope
- Detects musical key (Krumhansl-Schmuckler pitch-class profile)
- Trims leading/trailing silence
- Normalizes loudness
- Returns a processed audio file, a waveform PNG, and a JSON report

Pure Python + numpy + matplotlib. No PyTorch, no heavy ML deps. The
Docker image is <100 MB and builds in <60s on Hugging Face's
`cpu-basic` tier.

## Deploy in one command

```bash
# Get a token at https://huggingface.co/settings/tokens (write access)
export HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx

# Deploy
git clone --depth 1 https://github.com/kajica2/gradio-pipelines
cd gradio-pipelines/gradio-app
HF_TOKEN=$HF_TOKEN gradio deploy
```

`gradio deploy` always deploys the current directory, so clone first and
`cd` into `gradio-app` before running it. The token is read from
`HF_TOKEN` — the CLI has no `--token` or `--repo` flag.

The directory's [deploy tester](https://kajica2.github.io/gradio-pipelines/tester.html)
walks you through this end-to-end with live validation of your HF token.

## Run locally (optional)

```bash
pip install -r requirements.txt
# ffmpeg must be on PATH (apt install ffmpeg / brew install ffmpeg)
python app.py
# open http://localhost:7860
```

## API

Once deployed, the Space exposes a JSON API at
`https://<user>-<space>.hf.space/gradio_api/call/analyze`.

```bash
curl -X POST https://<user>-<space>.hf.space/gradio_api/queue/join \
  -H "Content-Type: application/json" \
  -d '{"data":[{"path":"audio.mp3","meta":{"_type":"gradio.FileData"}}], "fn_index": 0}'
```

## Files

- `app.py` — the Gradio app
- `requirements.txt` — Python deps (gradio, numpy, matplotlib)
- `README.md` — this file

## Why this app?

It's intentionally simple so the Space build never fails on dependency
conflicts. It demonstrates:

- File upload + audio output (Gradio basics)
- NumPy DSP (autocorrelation, RMS, normalization)
- Matplotlib for in-app viz
- JSON report export

If you want a bigger model-based version, swap `app.py` for one of the
24 tools in the directory. Most of them are drop-in — just change the
function body and keep the Gradio interface.
