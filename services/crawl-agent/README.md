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

- [x] Scaffold: FastAPI app, job store, config, API contract (this commit).
- [ ] First successful autonomous crawl on a test site.
- [ ] Page/action graph output shaped to `CrawlGraph`.
- [ ] Wired into the existing test-planning stage (replaces the simulated
      progress state in the frontend's `/projects/new`).
- [ ] Self-healing fallback for locator failures on scheduled/PR runs.
