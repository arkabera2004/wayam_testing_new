# Parikshan

AI-powered software testing: connect a repo or a live URL, review an
AI-drafted test plan, generate runnable test code, execute it, and track
coverage — all from one dashboard.

## Stack

- [TanStack Start](https://tanstack.com/start) (React, file-based routing, SSR)
- TypeScript
- MongoDB (org-scoped data access — see `src/lib/data/org-access.server.ts`)
- Tailwind CSS
- `services/crawl-agent`: a standalone Python service using
  [browser-use](https://browser-use.com) for autonomous app crawling and
  self-healing test locators (see its own README for details)

## Development

```sh
git clone <this-repository-url>
cd wayam_testing
npm i
cp .env.example .env   # fill in MONGODB_URI, SESSION_SECRET, etc.
npm run db:init         # create indexes/constraints
npm run dev
```

Run the crawl-agent service separately if you need real crawling/self-healing
(see `services/crawl-agent/README.md`):

```sh
cd services/crawl-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090
```

## Tests

```sh
npm run test:org-isolation
```
