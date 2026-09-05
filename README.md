# Parikshan

A Wayam AI product. Parikshan explores a web app, proposes tests you approve,
executes them in a real browser, and repairs the ones that break when the UI
moves underneath them.

The distinguishing thing about this codebase is that the test execution is
real. "Run suite" spawns Playwright, drives Chromium against a live app, writes
results and screenshots to Postgres, and shows you what happened. Nothing on
the runs path is simulated.

---

## Contents

- [Stack](#stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [How a run actually works](#how-a-run-actually-works)
- [Self-healing](#self-healing)
- [GitHub integration](#github-integration)
- [ShopStack, the system under test](#shopstack-the-system-under-test)
- [Screens](#screens)
- [API](#api)
- [Database](#database)
- [Design system](#design-system)
- [Testing this app](#testing-this-app)
- [What is not implemented](#what-is-not-implemented)

---

## Stack

| | |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19.1 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` |
| Database | Neon Postgres (serverless HTTP driver) |
| ORM | Drizzle 0.45 |
| Test execution | `@playwright/test` 1.62 |
| Icons | lucide-react, behind a typed registry |
| Fonts | Michroma (display), Geist (UI), Geist Mono (code) |

Server Components query the database directly and pass plain props to a
`"use client"` child. Client components do not fetch their own page data.

---

## Getting started

Requires Node 20+ (the Neon driver needs 19+) and a Postgres URL.

```bash
npm ci
cp .env.example .env.local     # then fill in DATABASE_URL
npm run db:push                # create the schema
npm run db:seed                # demo projects, suites, cases
npm run db:seed:shopstack-code # attach executable Playwright code to the cases
npx playwright install chromium

npm run dev                    # http://localhost:3000
```

To exercise the real run path you need both the app and its target running.
ShopStack is served by this same app under `/demo/shopstack`, so `npm run dev`
alone is enough.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | `next lint` |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Seed projects, suites and test cases |
| `npm run db:seed:selftest` | Seed a suite that tests Parikshan itself |
| `npm run db:seed:shopstack-code` | Attach runnable Playwright code to the ShopStack cases |

> `drizzle-kit` and `tsx` do not read `.env.local` on their own. Every `db:*`
> script is wrapped in `dotenv -e .env.local` for that reason.

> Do not run `npm run build` while `npm run dev` is running. They share
> `.next/`, and the build will leave the dev server serving a half-written
> manifest - which shows up as unexplained 500s.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string |
| `DATABASE_URL_UNPOOLED` | no | Direct connection, used by some tooling |
| `SEED_USER_ID` | no | Tenant everything runs as while auth is out (default `demo-user`) |
| `TOKEN_ENCRYPTION_KEY` | for GitHub | Encrypts the stored GitHub token. Any passphrase; it is SHA-256'd to a 32-byte key. Generate with `openssl rand -hex 32` |
| `GITHUB_API_URL` / `GITHUB_RAW_URL` | no | Point the GitHub client at a stub. Only for testing; unset means the real thing |
| `BROWSER_USE_API_KEY` | no | Rents a Browser Use cloud browser for healing. Without it, healing uses local Chromium and costs nothing |
| `BROWSER_USE_CDP_URL` | no | Attach to a browser session you already started, skipping create/stop |

`HEAL_BROWSER=local` forces local Chromium even when a cloud key is present.

Rotating `TOKEN_ENCRYPTION_KEY` makes existing stored GitHub tokens
undecryptable - users have to reconnect.

---

## How a run actually works

`src/lib/test-runner.ts` is the whole story.

1. Load the project's suites and their test cases. Cases with no
   `playwright_code` are skipped; if none are runnable the API returns 422 with
   the reason rather than inventing a passing run.
2. Insert a `test_runs` row with status `running`.
3. Write one spec per case to `parikshan-runs/<runId>/<caseId>.spec.ts`.
4. Spawn `npx playwright test --reporter=json`, with a 120s ceiling.
5. Parse the JSON report into `test_run_results`, copy screenshots to
   `run-artifacts/<runId>/<caseId>.png`, delete the run directory.
6. Update the run's status and duration.

Two details that are load-bearing and easy to undo by accident:

- **The run directory is `parikshan-runs`, not `.parikshan-runs`.** Playwright
  skips dot-directories, so a leading dot means zero specs are collected and
  every case reports `error` in 0ms.
- **Specs are written inside the project tree.** Outside it they cannot resolve
  `@playwright/test`.

Both `parikshan-runs/` and `run-artifacts/` are gitignored, and
`parikshan-runs` is excluded from `tsconfig.json` so a killed run does not
leave stale files that break `tsc --noEmit`.

### Subset runs

`runSuite(projectId, { caseIds })` runs only the named cases. This is what the
row menu's "Run this test" and the table's "Run selected" use. Omitting
`caseIds` runs everything.

### Concurrency

One execution per project at a time. An identical repeat request (a
double-clicked button, a second tab) receives the run already underway. A
*different* request while one is in flight gets `409` rather than being handed
results for tests it did not ask for.

---

## Self-healing

When a locator stops matching, `src/lib/healer.ts` opens a browser, looks at
the live DOM, and proposes a replacement.

Candidates are ranked by strategy - test id (3) beats label (2) beats
role+name (1) beats text (0) - and every candidate is gated on `impliedRole`,
so a search *button* is never healed to a nav link or to the input's label.
Anything scoring below 30 confidence is discarded rather than guessed at.

**Healing without a running app.** A URL is no longer required. Given one, a
browser opens the page and reads the live DOM, which is the stronger evidence.
Without one the imported source is searched instead, since the markup a page
will render is written there - most projects here are imported code with
nothing deployed, which previously left them unable to heal at all. Source
candidates are capped below the live healer's confidence, because source shows
what is declared rather than what the browser ends up with, and each one names
the file and line it came from.

`isReachableFromCloud(url)` routes localhost and private IPs to a local
Chromium. A cloud browser cannot reach your laptop, and letting it try burns a
billable session to arrive at `ERR_CONNECTION_REFUSED`.

Cloud sessions are stopped with `PATCH /browsers/{id}` and `{action:"stop"}`.
There is no `POST /stop` - it 404s, and a swallowed 404 leaves the session
billing.

---

## Importing a repository

Paste a public repository URL and Parikshan reads it. **No GitHub connection is
involved** - the tree is listed anonymously and file contents come from
`raw.githubusercontent.com`, which is not the API and so does not spend the
sixty-requests-an-hour anonymous limit. A whole repository costs two API calls
however many files it has.

Two entry points: the repository path on **New project**, which creates the
project and imports in one step, and the **Import / Re-import** panel on Repo
Baseline.

From the file tree it derives, by static analysis:

- **Routes**, from whichever convention the repository uses: Next.js `app/`
  and `pages/` at any depth (route groups `(marketing)` and parallel slots
  `@modal` stripped, since they are not in the URL), React Router `<Route>`
  declarations, ASP.NET MVC controller actions, and plain HTML or Razor
  templates. Where a project has MVC controllers the controller wins, because
  its views are what the actions render rather than routes of their own.
- **API endpoints** - Next.js route handlers, Express and router calls, Flask
  and FastAPI decorators, and MVC POST actions, with the verbs they declare.
- **Forms and fetches** per route, counted from the source.
- **Whether a route looks gated**, from auth-ish path segments and calls like
  `getServerSession` or a redirect to `/login`.
- **The framework**, named from the files present.

These land in `discovered_pages` and `api_endpoints`, so Discovery and the
Application Map are populated from the repository. Bounds: 4000 files listed,
contents kept for the first 400 source files under 96 KB each; anything beyond
that is reported as truncated rather than silently dropped.

Private repositories cannot be imported this way, and the error says so.

### What an import feeds

From Repo Baseline, once something is imported:

- **Generate tests from routes** writes one Playwright spec per discovered
  route. Each opens the route and checks it was served - under 400 after any
  redirect, so a 404 fails rather than passing as "not a server error" - and
  then asserts what that route's own markup declares: its title, its headings,
  its named fields, its buttons. Only literal text is used; a heading built
  from a variable is real on the page but unknowable from the source, so it is
  skipped rather than guessed at. Gated routes get no markup assertions, since
  a signed-out run would land on a sign-in page and fail for the wrong reason. It needs
  the application's base URL, because a spec has to navigate somewhere. These
  are starting points to edit - nothing has read what the app is meant to do,
  so they assert only what is true of any working page.
- **Review the source** runs the fixed rules in `src/lib/repo-review.ts`:
  credentials written into source, secrets or request bodies logged, SQL built
  by concatenation, HTML injected without escaping, silently swallowed errors,
  promises without a rejection handler. Every finding carries a file and line.
  A clean result means those patterns were absent, not that the code is good.

## GitHub integration

Real, not a mock. Configured per user on any project's Integrations screen.

**Connecting.** You paste a personal access token with `repo` scope. It is
verified against `GET /user` *before* anything is stored, so an invalid token
never lands in the database. It is then encrypted with AES-256-GCM
(`src/lib/crypto.ts`) and written to `github_connections`. GCM rather than CBC
so a tampered ciphertext fails to decrypt instead of yielding garbage; a random
IV per encryption so the same token never produces the same ciphertext twice.
The token is never returned by any endpoint and never rendered.

**What it does.** Lists your repositories, reports connection state, and
disconnects (which deletes the row).

**Exporting specs.** "Export all to repo" on the Tests screen commits every
case that has Playwright code to `tests/parikshan/<slug>.spec.ts` in a single
commit on a new timestamped branch, then opens a pull request against the
default branch. It is a PR rather than a direct push so the export is
reviewable. Filenames that would collide get the case id appended.

It is built on the Git Data API (blobs, tree, commit, ref) rather than the
Contents API, which writes one commit per file. If the tree it builds matches
the base branch there is nothing to export, so it stops with a 409 instead of
opening a PR that GitHub would reject; and if the PR call fails the branch is
deleted rather than left behind. Exercise it without touching a real
repository by pointing `GITHUB_API_URL` at `audit/fake-github.mjs`.

It requires both a connection and a
`github_repo_url` on the project; the API says which one is missing.

---

## ShopStack, the system under test

`apps/shopstack` is a small storefront that exists to be tested: catalogue,
product pages, search, cart, checkout, login, signup, account settings. It is a
**separate application on its own port**, not a route inside Parikshan.

That separation is load-bearing rather than tidy. While it lived here, the
harness and the thing it was judging were the same process: a proposed source
change could not be built without restarting the process doing the verifying,
so the suite was re-run against code the change had never reached and a correct
fix was rejected with a confident explanation. Two processes is what lets a
baseline, a change and a re-run be three states of the same application.

```bash
cd apps/shopstack && npx next build && npx next start -p 4000
```

It keeps the `/demo/shopstack` base path, so specs written against the old URLs
work unchanged. Two things follow from that base path and are easy to get
wrong: `next/link` and the router prepend it automatically, so internal hrefs
must not include it, while `fetch` does not, so an API call must.

The cart persists to `localStorage` behind a `hydrated` gate. This is not
incidental - with cart state in React only, it was lost on every navigation and
four specs timed out. The checkout page's empty-cart redirect is gated on the
same flag, because otherwise it fires before hydration and bounces a customer
who does have items.

---

## Screens

Not every screen is database-backed yet. The column says which is which, so
nothing here reads as working when it is still demo data.

| Route | Data | Screen |
|---|---|---|
| `/projects` | Postgres | All projects with live counts |
| `/projects/[id]` | Postgres | Project overview |
| `/projects/[id]/plan` | Postgres | Test plan; approve or reject scenarios |
| `/projects/[id]/tests` | Postgres | Generated specs, run/export actions |
| `/projects/[id]/tests/[testId]` | Postgres | One spec and its code |
| `/projects/[id]/runs` | Postgres | Run history |
| `/projects/[id]/runs/[runId]` | Postgres | One run and its results |
| `/projects/[id]/runs/[runId]/results/[resultId]` | Postgres | One result, with screenshot |
| `/projects/[id]/analytics` | Postgres | Trends over recent runs |
| `/projects/[id]/healing` | Postgres | Proposed and applied locator repairs |
| `/projects/[id]/quarantine` | Postgres | Quarantined tests |
| `/projects/[id]/discovery` | Postgres | Routes and endpoints derived from the imported repo |
| `/projects/[id]/map` | Postgres | Application map |
| `/projects/[id]/root-cause` | Postgres | Failure clustering |
| `/projects/[id]/prioritization` | Postgres | Risk-ranked tests |
| `/projects/[id]/test-selection` | Postgres (selection derived live) | What to run for a change |
| `/projects/[id]/defect-prediction` | Postgres | Predicted defect hotspots |
| `/projects/[id]/release-gate` | Postgres | Go / no-go readiness |
| `/projects/[id]/repo-baseline` | Postgres | Import a public repo; what it already tests |
| `/projects/[id]/code-review` | Postgres | Review findings per commit |
| `/projects/[id]/prd`, `/prd/new`, `/prd/[prdId]` | Postgres | Requirements; coverage derived from the suite |
| `/projects/[id]/doc-tests` | Postgres | Tests derived from docs |
| `/projects/[id]/integrations` | Postgres (GitHub is real) | Slack/Jira inert |
| `/projects/[id]/settings` | Postgres | Project settings; usage is measured, no billing provider |
| `/notifications` | Postgres | Notifications |
| `/settings` | Postgres | Workspace; API keys are real (create/revoke) |

---

## API

| Method | Route | Notes |
|---|---|---|
| `GET` `POST` | `/api/projects` | Create a project |
| `GET` `PATCH` `DELETE` | `/api/projects/[id]` | Accepts a slug or a uuid |
| `GET` | `/api/projects/[id]/tests` | |
| `POST` | `/api/projects/[id]/import-repo` | Imports a public repo, no credentials |
| `POST` | `/api/projects/[id]/generate-tests` | A spec per discovered route |
| `POST` | `/api/projects/[id]/review-repo` | Static review of the imported source |
| `GET` `POST` | `/api/projects/[id]/runs` | `POST` executes the suite. Body accepts `caseIds` and `baseUrl` |
| `POST` | `/api/projects/[id]/heal` | |
| `POST` | `/api/projects/[id]/export-github` | Opens a PR with the specs |
| `GET` | `/api/runs/[runId]` | |
| `GET` | `/api/runs/[runId]/artifacts/[file]` | Screenshots, path-traversal guarded |
| `PATCH` | `/api/test-cases/[caseId]` | Approve or edit a case |
| `PATCH` | `/api/healing/[eventId]` | Accept or reject a proposed heal |
| `GET` `POST` | `/api/notifications` | Read; `POST` marks read |
| `GET` `POST` `DELETE` | `/api/integrations/github` | Connection state, connect, disconnect |
| `GET` | `/api/integrations/github/repos` | |

Status codes are meaningful: `404` unknown or not yours, `409` conflict (a run
is already going, or GitHub is not connected), `422` the request is valid but
cannot be satisfied (nothing runnable), `502` an upstream - GitHub - failed.

Every project-scoped route resolves through `resolveProject`, which is
tenant-scoped. A foreign project id is a 404, not an empty 200.

Route params are shape-checked before they reach the database. Postgres
*raises* on a malformed uuid rather than returning no rows, so an id like `137`
would otherwise surface as a 500 instead of a 404.

---

## Database

15 tables: `projects`, `requirements`, `test_suites`, `test_cases`,
`test_runs`, `test_run_results`, `risk_scores`, `coverage_snapshots`, `jobs`,
`github_connections`, `healing_events`, `quarantined_tests`,
`discovered_pages`, `api_endpoints`, `notifications`.

Schema notes worth knowing before you change something:

- CHECK constraints are mirrored in TypeScript as string unions
  (`RUN_STATUS`, `RESULT_STATUS`, `CASE_PRIORITY`, …). Change one, change both.
- `test_runs.started_at` has **no** database default, unlike `created_at`. It
  is set by `$defaultFn`. Without that, seeded runs get a null start and the UI
  reports "No runs yet" for runs that plainly exist.
- `src/db/index.ts` initialises lazily via a plain function, deliberately
  **not** a `Proxy` - proxies break libraries that introspect the adapter.
- Aggregates are computed in SQL. `workspaceStats` previously selected every
  run, then every result row for those runs, and reduced them in JavaScript;
  the query grew one bind parameter per run until it timed out. Analytics is
  bounded to the 50 most recent runs for the same reason.
- Neon is reached over HTTP, so a stalled connection is a hung `fetch`.
  Requests are bounded per attempt rather than inheriting undici's five-minute
  header timeout. Retries are limited to failures where the connection never
  established - retrying a timed-out write could insert a row twice.

---

## Design system

Two tiers. `src/styles/reference-tokens.css` holds raw values;
`semantic-tokens.css` maps them to intent (`--surface-raised`,
`--action-primary`, `--stroke-muted`); Tailwind exposes them through
`@theme inline`. Components reference semantic tokens only - a hardcoded hex or
a `bg-white/70` in a component is a bug, because theming keys off
`data-theme` and a literal will not follow.

Icons go through `src/lib/icons.ts`, a typed registry of 56 semantic names
mapped to lucide components with named imports, so tree-shaking survives.
`IconName` is derived from the registry. Swapping icon families later is a
change to one file.

Light and dark are both first-class.

---

## Testing this app

`audit/` holds the tooling used to verify the app itself.

```bash
npm start                # audit against the production build, not dev
node audit/audit.mjs     # crawl every page, click every button
bash audit/regress.sh    # every route 200s + the real suite passes
```

`audit.mjs` visits every route for every project, clicks every visible button,
tab and switch, and records console errors, pageerrors, failed navigations and
any 5xx. It reports `clicked`, `skippedDestructive` and `skippedRunControls`
so coverage is never overstated.

Two deliberate limits, both counted rather than hidden:

- Controls matching `/delete|remove|sign out|disconnect|revoke|reset/` are not
  clicked.
- Controls matching `/^(run|re-?run)/` are clicked in full on the first project
  and skipped afterwards. Clicking them everywhere would fire roughly 168 real
  browser suites.

`regress.sh` checks every route returns 200, asserts that malformed run ids
(`137`, `not-a-uuid`, `../etc`) never produce a 500, and runs the real suite.
Run it several times - it is looking for flakiness, not just breakage.

---

## What is not implemented

Stated plainly so nothing here reads as working when it is not.

- **Authentication.** Removed on purpose to focus on the execution pipeline.
  Everything runs as a single tenant (`SEED_USER_ID`). Queries are already
  tenant-scoped, so restoring auth is wiring `currentUserId()`, not a rewrite.
  **The app must not be deployed publicly in this state.**
- **Slack and Jira.** The controls on the Integrations screen are disabled and
  labelled. They store nothing.
- **The pull-request panel** on the Integrations screen is a static
  illustration and is labelled as one.
- **Runs are synchronous.** The HTTP request holds open until the suite
  finishes. That is fine at this suite size; a longer suite needs a job queue,
  which is what the `jobs` table anticipates.
- **Auto-heal on failure** is not wired. Healing is proposed and applied
  through the Self-Healing screen.
- **Requirement extraction is not wired.** Pasting a PRD stores the document
  and it appears in the list, but nothing parses requirements out of it - the
  document is saved with status `analyzing` rather than claiming an analysis
  that did not run. Requirements seeded by `db:seed:screens` do get real
  coverage, derived from the suites linked to them.
- **No billing provider**, so there is no plan, quota or invoice anywhere.
  The Billing tabs show the execution time that is actually measured.
- **Members lists show one identity** - the tenant everything runs as, because
  authentication is off. There are no real colleagues to list.
- **Every screen now reads from Postgres.** What remains from the demo module
  is presentation only: shared TypeScript types, the GitHub Actions workflow
  template, the analysis-stage labels on the PRD upload flow, and the sample
  text behind its "load an example" button.
