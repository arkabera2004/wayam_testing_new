# Parikshan - user guide

Last verified against the running application on 5 September 2026.

This guide describes what the application does **today**. Where something is
partial or not built, it says so rather than describing the intended version.
`docs/PROOF.md` is the companion document: it records what has been
demonstrated with evidence, and what has not.

---

## What Parikshan is

Parikshan runs a browser test suite against your application, and then tries to
answer the question a failing test does not answer on its own: *is this a real
bug, or has the test gone stale?* It reads the layers underneath a UI failure -
the API calls the page actually made, the console, the transport - to decide.
When it concludes there is a genuine defect, it can propose a fix on a branch,
apply that fix to a real build, re-run the suite, and judge whether the fix
changed the application's behaviour or merely changed what the test demanded.
Nothing merges automatically; a person decides.

---

## Setting up a project

### Create a project

`/projects/new`, or `POST /api/projects` with `{ "name": "..." }`.

### Point it at an application

A project can have either or both of:

- **A GitHub repository URL** - the source Parikshan reads to generate specs,
  review code, and map routes. Set it in project settings, or supply it when
  importing.
- **A base URL** - where the running application can be reached. Required
  before specs can be generated, because a spec needs somewhere to navigate.
  Without it, spec generation answers:
  `"Set the application's base URL first, in project settings."`

### Import a repository

`/projects/{id}/repo-baseline` → paste a public repo URL.
API: `POST /api/projects/{id}/import-repo` with `{ "repoUrl": "..." }`.

A real import of `arkabera2004/Event-Manager` returned:

```
fileCount 145 · storedCount 24 · framework "ASP.NET MVC" · pages 10 · endpoints 6
```

The framework is detected, not asked for. Only source-like files are stored.
Progress is available at `/import-repo/progress` while it runs.

**Note:** imports work for **public** repositories. The importer downloads
files over HTTPS; it does not authenticate, so a private repo will not import
even when a GitHub token is connected.

---

## Running tests

### Generate specs

`POST /api/projects/{id}/generate-tests` writes Playwright specs from the
route markup found in the import. Requires a base URL.

### Run the suite

The **Run suite** button in the top bar, or `POST /api/projects/{id}/runs`.
Optional body: `{ "caseIds": ["..."] }` to run a subset.

Runs are synchronous and execute real Playwright against a real browser.
Retries are set to zero on purpose: a retried failure that passes on the second
attempt would be reported as a pass, hiding exactly the flakiness the product
exists to surface.

A response looks like:

```json
{"runId":"...","status":"passed","total":10,"passed":10,"failed":0,"durationMs":14448}
```

### What a run result shows

`/projects/{id}/runs/{runId}` lists every spec with its status and duration.
Each result opens onto:

- the failure message as Playwright reported it
- the **classification** and its confidence, with the signals behind it
- the network calls the page made, including status codes and error bodies
- a screenshot

Screenshots are captured on **every** spec, passing or failing, so a later
failure has a baseline to compare against. They are served from
`/api/runs/{runId}/artifacts/{file}` and stored under `run-artifacts/`.

---

## Failure classification

Every failure is given one of four verdicts and a confidence score.

| Verdict | Meaning |
|---|---|
| `real-bug` | The application misbehaved. Something underneath the UI corroborates it. |
| `test-drift` | The application is fine; the test is looking for something that moved or was renamed. |
| `flaky` | The outcome is not settling either way across recent runs, with the spec unchanged. |
| `environment` | The target was unreachable. This says nothing about the spec, so it is excluded from history. |

Confidence is a weighted sum of signals, each recorded with the verdict so the
reasoning can be read back rather than trusted. Worked examples:

```
real-bug @ 70   [real-bug] value-mismatch    w=45
                [real-bug] clean-regression  w=25
                [flaky]    outages-excluded  w=0

test-drift @ 80  locator-not-found - the page was served but the element was not there
```

**The cross-layer part is the point.** A `toBeVisible()` failure reads the same
whether the API behind it faulted or the element was renamed. Reading the UI
alone once gave `flaky @ 55`; with the layer underneath -
`POST /api/signup → 500` - the same failure became `real-bug @ 90`. The control
case, an identical UI error with a healthy API returning 409, was **not**
upgraded. See PROOF.md §1.

Two deliberate judgements:

- **Flakiness scores down, not up.** A result that is unreliable either way
  buys less information per run.
- **Outages are excluded, and the exclusion is shown** rather than applied
  silently.

---

## Self-healing

**What triggers it:** a selector that no longer matches. You run it from the
Self-Healing page, or `POST /api/projects/{id}/heal` with
`{ "selector": "...", "url": "..." }`.

**What it does:** opens the page in a browser, reads the live DOM, and scores
candidate replacements by strategy - test id, accessible label, role + name -
preferring the ones that survive markup churn.

```json
{"healed":{"selector":"getByRole('link', { name: 'Cart 0' })",
           "strategy":"role-name","similarity":50},
 "browser":"local","source":"browser"}
```

Every proposal is written to the Healing page as **pending**. You Accept or
Revert it; nothing is applied automatically.
API: `PATCH /api/healing/{eventId}` with `{ "status": "accepted" | "reverted" }`.

**A weak match is refused.** Below a similarity of 30 it returns
`healed: null` rather than proposing something. Proposing a wrong locator turns
a visible failure into a test that passes against the wrong element, which is
worse than the failure.

### Local vs cloud browser, and the cost

| Mode | When | Cost |
|---|---|---|
| **Local** | `HEAL_BROWSER=local`, or no `BROWSER_USE_API_KEY`, or the target is not reachable from the internet | None. Local Chromium. |
| **Cloud** | `BROWSER_USE_API_KEY` set **and** the URL is publicly reachable | Rents a Browser Use session per heal. **Billing runs until the session stops.** |

Set `HEAL_BROWSER=local` to force local even with a key present. For local
development this is the right default and costs nothing.

### Known limitation

The healer only considers **interactive** elements -
`button, a[href], input, select, textarea, [role=button]`. A `data-testid` on a
`<span>` or `<p>` - a status message or a badge - is invisible to it, and it
will return `healed: null` no matter how obvious the replacement looks. This is
a real gap, verified: renaming `cart-badge` on a `<span>` produced no candidate
above the threshold.

Also: a heal that finds nothing is **not** recorded. The route's own comment
says failed heals are written so they can be reviewed; they are not. Every row
in the healing table has a replacement.

---

## The fixer

The fixer proposes a source change for a failure classified `real-bug`. It
handles **two rule shapes** and refuses everything else.

**Rule 1 - message-literal.** The assertion names both the value it wanted and
the value it got, and the received value appears as a literal in non-test
source.

```
apps/shopstack/src/app/login/page.tsx:29
  -  : "Those credentials did not match.",
  +  : "Incorrect email or password.",
```

**Rule 2 - navigation-literal.** A `toHaveURL` mismatch where the wrong
destination is a literal at a navigation call (`router.push/replace`,
`redirect`, `permanentRedirect`).

```
apps/shopstack/src/app/checkout/page.tsx:23
  -  router.replace("/search");
  +  router.replace("/cart");
```

### What it refuses, and why that is the design

Refusal is the common case. Verified refusals include:

- anything not classified `real-bug` - *"A drift, a flake or an outage is not
  something to change the application for."*
- a failure that names no expected/received pair, such as `toBeVisible()` -
  *"there is nothing here to derive a change from."*
- a URL pattern describing a **set** of paths (`/^\/cart\/\d+$/`) - a pattern
  is not a value, and picking a member of the set would be a guess
- a received value that is not a literal anywhere in non-test source
- **any candidate file that looks like a test.** This is structural: the fixer
  cannot edit a spec, so the failure the harness exists to catch cannot be
  produced in the first place.

A fixer that guessed at bugs it did not understand would need a reviewer to
catch every mistake, and reviewers stop reading when most of what they see is
noise. Two rules that are always right are worth more than ten that are
sometimes right.

### What happens when it proposes

Classify → propose → write to a branch → apply to the working tree → rebuild
the application → re-run the suite → judge → restore. All of it automatic, and
then it stops.

```
branch: parikshan/fix-2360ddf1 @ 819eba6   merged: false
harness: accepted   targetSpecPasses: true   suiteRegressed: false
  suite: 9 passed / 1 failed -> 10 passed / 0 failed
```

Afterwards: `HEAD` is unmoved, your branch is unchanged, the change exists only
on its own branch, and the working tree is back as it was. **Nothing merges.**
Accepting a proposal records a decision; a person merges the branch with git,
deliberately, outside this application.

### The harness that judges it

A fix is accepted only if the spec is **byte-for-byte unchanged in what it
asserts**, it now passes, and nothing else in the suite started failing.

The case that matters is the opposite one: a fix that rewrites the assertion to
match the broken behaviour makes the suite fully green and is **rejected
anyway**. A suite reporting zero failures is exactly what a silenced test looks
like. The harness also rejects a skipped test and a raised timeout.

This deliberately rejects legitimate test edits too. That false-positive cost is
the price of the guarantee.

**Caveat worth knowing:** rule 1 writes back exactly what the assertion demands.
When the assertion wants a full sentence, the result is right. When it wants a
*substring* - `toContainText("Incorrect email")` against source that says
`"Incorrect email or password."` - the rule writes the substring and truncates
the message. It satisfies the test; it is not necessarily correct English. Read
the proposal.

---

## Exporting tests to GitHub

### Connect a token

`/projects/{id}/integrations` → paste a GitHub personal access token.

The token is verified against GitHub **before** it is stored, then encrypted
(AES-256-GCM) using `TOKEN_ENCRYPTION_KEY` and written to
`github_connections.access_token_encrypted`.

**Do not put a PAT in `.env.local`.** No code reads one from the environment;
the only GitHub environment variables are `GITHUB_API_URL` and `GITHUB_RAW_URL`,
which exist to point the flow at a test stub. A token in the environment is
simply ignored.

**Scopes needed:** contents read/write and pull requests read/write on the
target repository (classic: `repo`).

Rotating `TOKEN_ENCRYPTION_KEY` makes existing stored tokens undecryptable, and
users have to reconnect.

### Export

`POST /api/projects/{id}/export-github`. The project must have a
`githubRepoUrl` and at least one test case with Playwright code.

What gets created, in order: a blob per spec → a tree → a commit → a branch
`parikshan/specs-<timestamp>` → a pull request. Specs land under
`tests/parikshan/<slugged-name>.spec.ts`.

A real export produced:

```
prUrl   https://github.com/arkabera2004/Event-Manager/pull/1
branch  parikshan/specs-1788597939597
commit  c2f5733233074d176f148288f2155f5c50b85c27
files   10
```

Two behaviours worth knowing: if every spec already matches the branch the
export stops with "nothing to export" rather than opening an empty PR, and if
the PR call fails the branch it just created is deleted rather than left
stranded.

---

## Known limitations

Stated plainly. None of these are bugs to be reported; they are the current
shape of the build.

- **Authentication is off.** `currentUserId()` returns a single shared tenant.
  Everything is readable by anyone who can reach the server. This is fine for
  local use and **is not deployable as-is**. A previous Clerk integration exists
  in git history (`c407547`) if it needs restoring.
- **The fixer handles two rule shapes**, both of the same form: an assertion
  naming both values, where the received value is a literal in source.
  Everything else is refused. This is not a coverage figure to be improved
  casually - see PROOF.md's "What this does not show".
- **Coverage is not measured.** The Analytics page says `Coverage: Not measured`
  rather than printing a number nothing computed. The coverage heatmap shades
  whatever snapshot rows exist; nothing currently produces them.
- **PRD requirement extraction is not wired.** A document uploads and stores,
  but no requirements are extracted and no scenarios are generated. The status
  stays `analyzing` indefinitely, which reads as a hang - it is not; it is
  unimplemented. The code says so at the insert.
- **Slack and Jira integration cards are inert.** They are labelled
  "Not implemented - these controls are inert" in the UI.
- **Inline spec editing does not exist.** The button says so.
- **Self-healing ignores non-interactive elements**, and does not record heals
  that found nothing (see above).
- **Server-side logs are not captured.** Classification reads what the browser
  saw - API responses, transport failures, console and page errors - not the
  application's own logs.
- **The rebuild is wired to one application**, `apps/shopstack`, with a fixed
  build command. A second application under test needs adding deliberately.
- **A missing project answers HTTP 200.** The page correctly renders "This page
  could not be found", but the status line says 200 in both dev and production.
  Cosmetic in a browser; wrong for monitoring and API clients. Root cause not
  established - see below.

### Things that are real, contrary to appearances

- **Test minutes** on the settings pages are real: `sum(duration_ms)` over
  recorded results, aggregated in SQL.
- **The release gate verdict** is computed from live data - the latest run's
  pass rate, tests still quarantined, heals awaiting review - and "no run at
  all" is NO-GO rather than a pass. It does **not** include open bugs or
  security findings, which the screen it was ported from did.

---

## Operational notes

- **Do not call the harness twice at once.** `rebuildAndRestart` writes
  `apps/shopstack/.next` in place with no lock; two concurrent calls collide and
  one fails with a build error. Sequential calls are fine - four in a row, twice
  over, with no failures.
- **The application under test is a separate process** on port 4000. Parikshan
  runs on 3000. A fix verdict means something only because the harness can
  rebuild and restart the other process independently.
- **`next lint` is not configured** in this repository and there is no prettier
  config. The real gates are `npx tsc --noEmit` and `npx next build`.

## When something goes wrong

| Symptom | Where to look |
|---|---|
| "Is this feature actually proven?" | `docs/PROOF.md` - dated, with the evidence, and an explicit list of what it does *not* show |
| A spec failed and you want to see it | `/projects/{id}/runs/{runId}` → the result → screenshot and network panel |
| Raw screenshots | `run-artifacts/<runId>/` on disk |
| A heal looks wrong | `/projects/{id}/healing` - every proposal is pending until you act |
| A fix proposal looks wrong | The branch `parikshan/fix-*`. Nothing merged; delete the branch |
| Harness returned a build error | Check nothing else is calling it concurrently, then retry |
| Export returned 409 | Either no repo URL on the project, no specs with Playwright code, or every spec already matches the branch |
| Export returned 502 | GitHub rejected it - usually token scope or expiry |
