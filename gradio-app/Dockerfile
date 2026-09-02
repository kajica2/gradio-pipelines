# Smart Audio Toolkit — Hugging Face Space container
# Used by `gradio deploy` to build the Space image. CPU-only.
FROM python:3.11-slim

# ffmpeg is needed for the audio decoder (decode any format to wav).
# numpy + matplotlib are required by the app.
# gradio serves the UI.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Then copy the app
COPY app.py .

# Gradio's default port inside a Space
EXPOSE 7860

# Run the app
CMD ["python", "app.py"]
