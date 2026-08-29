# crawl-agent: FastAPI + browser-use (0.13.8), which drives a real
# Chromium over CDP via its own browser-harness/cdp-use stack — NOT the
# `playwright` package (browser-use dropped that dependency; there is no
# `playwright install` step here). Render (and most PaaS) can't run
# persistent browser processes on a generic Node/Python buildpack, so
# this ships as a container with Chromium installed as a real OS package.
FROM python:3.12-slim

WORKDIR /app

# `chromium` pulls in every runtime lib it needs (fonts, libnss3, libgbm,
# libasound2, etc.) as apt dependencies — no separate browser-download
# step required. browser_use.browser.chrome.find_chrome_executable()
# locates it itself via `which chromium` on PATH, and
# BrowserProfile.chromium_sandbox already defaults to False whenever it
# detects /.dockerenv, so no manual --no-sandbox flag is needed either.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PORT=8090
EXPOSE 8090

# Render sets $PORT at runtime; default above matches local dev
# (CRAWL_AGENT_URL=http://localhost:8090 in the main app's .env).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
