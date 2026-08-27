# crawl-agent

Standalone Python service that autonomously explores a submitted URL using
[browser-use](https://browser-use.com) and returns a structured page/action
graph — the input to Parikshan's test-planning stage.

This is intentionally its own backend module, separate from the TanStack
Start / MongoDB frontend app in the repo root. The frontend talks to it only
over the HTTP contract below, so either side can be redeployed or replaced
independently (e.g. swapping the self-hosted agent for the browser-use
Cloud Agent API is a config change here, not a frontend change).

## Why an autonomous agent instead of a fixed Playwright script for crawling

Deterministic Playwright is what actually *runs* on every regression pass
(fast, cheap, reliable once the steps are known — see `test_cases` in the
main app). But the very first crawl of an app nobody has described to us
yet is exactly the "unpredictable, unknown structure" case where scripted
automation has nothing to script against. An autonomous agent that reasons
about whatever the page actually renders is the right tool for that one
step; everything downstream goes back to deterministic replay.

## Architecture

```
POST /crawls {url}          -> 202 {crawl_id, status: "queued"}
GET  /crawls/{crawl_id}     -> {status, graph?, error?}
```

- `status` moves `queued -> running -> completed | failed`.
- `graph` (only present once `completed`) is a `CrawlGraph` (see
  `app/graph.py`): a list of `PageNode`s, each with the actions/forms
  found on it and the URLs it links to.
- Jobs are stored in-process (see `app/store.py`) — fine for a scaffold /
  single instance; INTEGRATION POINT for swapping in real persistence
  (e.g. a Postgres/Mongo-backed queue) once this runs as more than one
  process.

## Agent backend config

Set `CRAWL_AGENT_BACKEND` to control which browser-use runtime executes
the crawl:

- `self_hosted` (default) — runs the open-source `browser-use` Python
  library locally via Playwright. Cost stays fully in your control (just
  the LLM API calls + local compute); this is what's implemented today.
- `cloud_api` — **not yet wired**. Reserved for browser-use's hosted Cloud
  Agent API (~$0.24/1M input tokens, $1.44/1M output, browser time from
  $0.02/hr as of Aug 2026). Swap point is `app/agent.py::run_crawl` —
  branch on `settings.agent_backend` and call the Cloud Agent API's REST
  endpoint instead of the local `Agent` when this is implemented.

The LLM behind the agent's reasoning is Gemini (`GOOGLE_API_KEY`), chosen
per the current deployment's config, via browser-use's own
`browser_use.llm.google.chat.ChatGoogle` wrapper (no LangChain dependency
needed — browser-use ships first-party clients for OpenAI/Anthropic/Google/
etc). Swap the `ChatGoogle` construction in `app/agent.py::_build_llm` to
change providers.

## Running locally

```sh
cd services/crawl-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium --with-deps
cp .env.example .env   # fill in GOOGLE_API_KEY (or reuse the repo root .env)
uvicorn app.main:app --reload --port 8090
```

```sh
curl -X POST localhost:8090/crawls -H 'content-type: application/json' \
  -d '{"url": "https://demo.playwright.dev/todomvc"}'
# => {"crawl_id": "...", "status": "queued"}

curl localhost:8090/crawls/<crawl_id>
# => {"status": "completed", "graph": {...}}
```

## Status

- [x] Scaffold: FastAPI app, job store, config, API contract.
- [~] First successful autonomous crawl on a test site — **architecture
      verified, not yet a clean end-to-end pass.** Against
      `https://demo.playwright.dev/todomvc`, the agent launched a real
      browser, navigated, called `evaluate`/`find_elements` to inspect the
      page, and updated its plan — i.e. the browser-use + Playwright +
      Gemini pipeline genuinely works. It didn't reach a completed
      `CrawlGraph` yet because the free-tier Gemini key hit a **hard daily
      quota (20 requests/day for the resolved `gemini-3.7-flash` model)**
      partway through, on top of several already-deprecated model ids
      (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.5-flash-lite` all
      now 404 "no longer available to new users" — Google is retiring
      Gemini 2.x fast). Re-run `python -c "import asyncio; from app.agent
      import run_crawl; asyncio.run(run_crawl('https://demo.playwright.dev/todomvc'))"`
      once the quota resets (or with a paid-tier / different key) to get a
      clean completion — no code changes should be needed.
      **Re-checked later the same day: still 429 RESOURCE_EXHAUSTED
      immediately on every step** — the free-tier daily quota is
      per-project-per-model, not per-key-creation-time, so it hasn't
      rolled over yet. Not retrying further to avoid spamming a dead
      quota; either wait for the daily reset or swap in a paid-tier /
      different `GOOGLE_API_KEY`.
- [ ] Page/action graph output shaped to `CrawlGraph` (blocked on the above).
- [x] Wired into the existing test-planning stage — `/projects/new`'s
      progress UI now calls the real crawl-agent HTTP contract (submit ->
      poll -> receive graph) instead of a simulated timer. This required
      no changes to the crawl-agent service itself: the polling/error
      paths were built and exercised against the service's real
      `queued -> running -> failed` states (the `failed` state is
      reliably reachable right now because of the quota block above,
      which is exactly what proved the poll loop and error UI work
      correctly end-to-end). Once the quota resets, `completed` +
      `graph` should flow through unchanged since the frontend only
      depends on the documented contract shape, not on how the job
      store got there.
- [x] Self-healing fallback for locator failures — `POST /heal` (see
      `app/heal.py`) hands a single failing step's plain-English
      description to a bounded (max 8 steps, no vision) browser-use
      agent run, which proposes a replacement CSS selector without
      re-crawling anything. Synchronous, not queued, since a single
      element lookup is fast and bounded — unlike /crawls. Wired into
      the main app's "re-run failed" action (`attemptSelfHeal` in
      `src/lib/runs/functions.ts`): failed cases on a "url"-sourced
      project get a heal attempt before re-running; the proposed
      selector is surfaced in the run detail UI for human review, never
      auto-applied to the test case's generated code. Verified against
      the real endpoint via curl — it genuinely launches a browser,
      calls Gemini, and returns a clean structured error when the same
      quota block from above cuts it off (502 with the agent's own
      message), which is exactly the failure path attemptSelfHeal is
      built to swallow and continue past.
