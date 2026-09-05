# Proof artifact

**Every figure below was regenerated on 5 September 2026** and read back out of
the database or the running application after the fact. Nothing here is a
description of what the code is supposed to do; each item names the spec, the
error text, and the stored verdict, so it can be checked rather than believed.

Where a figure is a snapshot of state that keeps moving - the ranking in
section 2, the classification history in section 1 - it is dated, because a
number presented without a date invites the reader to assume it is current when
it may not be.

The claim being supported is narrow and specific. AI test generation,
self-healing and browser agents are commoditised. Two things are not: deciding
what a failure means using more than the UI layer, and proving that a fix fixed
the defect rather than the test. These items are evidence for those two, and
for nothing wider.

---

## 1. Cross-layer reasoning got an answer that UI-only reasoning got wrong

**Spec:** `Sign up is rejected for an existing email`

Read back from `test_run_results.classification_evidence` on 5 September 2026.
The three results below are still in the database and can be re-read; the
timestamps are theirs, not this document's.

**What the interface reported**, identically in all three runs:

```
Error: expect(locator).toBeVisible() failed
  Locator: getByTestId('signup-error')
  Expected: visible
```

That error is ambiguous by construction. "The element was not there" reads the
same whether the API that fills it faulted or the element was renamed. Reading
the UI alone, the stored signals were:

```
[flaky]      alternating-outcomes   w=55
  Outcome changed 2 times across its last 8 runs with the spec unchanged,
  so it is not settling either way.
[test-drift] locator-not-found      w=40
  The page was served but the element the test looks for was not there,
  which is what a moved or renamed element looks like.
```

**The upgrade — 2026-09-05 01:28:51 IST, `real-bug @ 90`:**

```
[real-bug] api-server-error          w=20
  The UI failed and underneath it POST /demo/shopstack/api/signup returned
  500 - {"error":"Account service unavailable."}. The interface is reporting
  a fault the server actually had, so this is the application misbehaving
  rather than the test being stale.
[real-bug] cross-layer-adjustment    w=0
  Reading the UI alone gave flaky at 55. With the layers underneath it,
  this is real-bug at 90.
```

**The control — 2026-09-05 01:29:50 and 01:31:14 IST, both `flaky @ 55`:**

```
[flaky] api-clean-not-a-server-fault w=0
  The 1 API call completed without faulting (409), so whatever is making
  this spec inconsistent, it is not the server erroring. The verdict is
  left as it stands, since a single clean run cannot settle a question
  about behaviour over time.
```

Same UI error text, same spec, same starting history, three minutes apart.
Different verdict, decided entirely by the layer beneath. The interface alone
cannot separate those two cases; that is the phase.

**What this cost to get right.** Two pieces of the reasoning were wrong on first
contact with real data and were only found by running it:

- Any 4xx was read as suspicious. A 409 telling the page an account already
  exists is the application working correctly. The test is now whether anything
  *faulted*, not whether everything was 2xx.
- Cancelled prefetches were read as an outage. Next abandons routes it
  speculatively fetches, so every page load leaves `ERR_ABORTED` entries behind,
  and reading those as transport failure classified a perfectly reachable app as
  `environment`. That is worse than not looking at all: a correlation has to
  reject its own noise before it is worth trusting.

---

## 2. The ranking surfaced a genuinely high-risk area, with its reasoning

**Snapshot taken 5 September 2026**, live from the running application at
`/projects/{id}/prioritization`, over the real ShopStack suite. These scores
move as runs accumulate; an earlier snapshot in this document had the top test
at 60 rather than 90, which is the ranking responding to history rather than
the ranking being unstable.

```
 90  Login fails with an incorrect password
 69  Sign up is rejected for an existing email
 66  Account locks after five failed attempts
 55  Checkout is blocked when the cart is empty
 55  User checks out with an expired card
 55  User completes checkout with a valid card
 50  User changes their account email
 42  Search with no matches shows an empty state
 42  User removes the last item from the cart
 42  User updates the quantity of a cart item
```

**Top — 90**

| Points | Factor | Reason |
|---|---|---|
| +40 | has caught real bugs | Classified as a real bug 5 times. This area has a record of actually breaking. |
| 0 | outages discounted | 1 of its failures were environment outages, left out of the count above. |
| +30 | changed this week | `apps/shopstack/src/app/login` changed today. |
| +20 | access path | Covers `/demo/shopstack`, `/login`. Sign-in defects lock people out or let the wrong people in. |

**Bottom — 42**

| Points | Factor | Reason |
|---|---|---|
| 0 | no real bugs recorded | Has failed 3 times but never in a way judged a genuine defect. |
| 0 | outages discounted | 1 of its failures were environment outages. |
| +30 | changed this week | `apps/shopstack/src/app/cart` changed today. |
| +12 | core journey | Covers `/demo/shopstack`, `/cart`, which most sessions pass through. |

Both have failed several times. The 48-point gap is what those failures *were*:
five of the top one's were judged genuine defects, none of the bottom one's
were. Outages are excluded from both, and the exclusion is shown rather than
applied quietly.

**Recency now works and can be seen working.** An earlier version of this
document recorded that recency read zero for every test, because the storefront
had just been moved into its own directory and the paths were new. That is no
longer true: every test now earns `+30 changed this week`, and the factor names
the directory and quotes the commit that touched it. The caveat has been removed
rather than left standing, because it described a temporary state.

Two judgement calls are worth stating, because they change the order:

- **Flakiness scores down, not up.** A spec that fails constantly at random
  would top a naive failure-count ranking, but a result that is unreliable
  either way buys less information per run. `Sign up is rejected for an existing
  email` carries `-15 mostly flaky` for exactly this reason, and still ranks
  second because its real-bug record outweighs it.
- **Outages are excluded and the exclusion is shown.** A spec that failed
  because the target was unreachable learned nothing about itself. Dropping that
  silently would be nearly as misleading as counting it.

---

## 3. The harness caught a bad fix and passed a real one

The application under test is a separate process. It used to be a route inside
Parikshan, which meant the harness and the thing it was judging were the same
server: a source change could not be built without restarting the process doing
the verifying, so the suite was re-run against code the change had never
reached. That produced a confident rejection of a correct fix. The storefront
lives in `apps/shopstack`, builds and serves on its own port, and the harness
builds it from disk before both the baseline and the re-run.

All four cases below were re-run on 5 September 2026. Same defect in the first
two: the account-lockout message no longer says `"locked"`. Both verdicts are
against a genuine build of the changed source.

### Bad fix — the assertion rewritten to expect the broken message

The defect was left in the source and only the spec was changed, from
`toContainText("locked")` to `toContainText("Contact support")`.

```
verdict: rejected      baseline: 9f1871d7
  suite: 1 failing -> 0 failing        targetSpecPasses: true
  diff: changed 1, removed 0, added 0, skipAdded false

  An assertion's expectation was changed from "locked" to "Contact support"
  on toContainText. The test now agrees with the behaviour it was written to
  catch, which is the test moving to meet the bug rather than the bug being
  fixed.
```

The suite went fully green and the target spec passed. It was refused anyway.
That is the case that matters: a suite reporting zero failures is exactly what a
silenced test looks like.

### Good fix — the application source corrected, the spec untouched

The spec was restored and the source corrected, against the same baseline.

```
verdict: accepted      baseline: 9f1871d7
  suite: 1 failing -> 0 failing        targetSpecPasses: true
  diff: changed 0, removed 0, added 0  specChanged: false

  The spec is byte-for-byte unchanged in what it asserts, it now passes, and
  nothing else in the suite started failing. The behaviour changed, not the
  expectation.
```

Identical run results in both cases - `suiteBefore 9 passed / 1 failed`,
`suiteAfter 10 passed / 0 failed`, target spec passing in both. Opposite
verdicts, decided only by whether the test or the application moved.

### The same loop, driven by the fixer rather than by hand

The two cases above are a person editing a file and asking the harness to judge
it. These are the agent doing the editing. In each, a defect was planted, the
application rebuilt so it genuinely served the defect, and the suite run twice
until the failure classified `real-bug @ 70`. The fixer was then pointed at that
result and nothing else.

**Rule 1 - message-literal**

```
proposed: true          merged: false
branch:   parikshan/fix-0d144af0 @ 30efb5c
working branch untouched: design-system-icon-registry

apps/shopstack/src/app/login/page.tsx:29
  -  : "Those credentials did not match.",
  +  : "Incorrect email or password.",

HARNESS: ACCEPTED   targetSpecPasses: true   suiteRegressed: false
  suite: 9 passed / 1 failed  ->  10 passed / 0 failed
```

**Rule 2 - navigation-literal**

```
proposed: true          merged: false
branch:   parikshan/fix-ca58f3b5 @ 5db4b60
working branch untouched: design-system-icon-registry

Expected pattern: /\/cart$/
Received string:  "http://localhost:4000/demo/shopstack/search"

apps/shopstack/src/app/checkout/page.tsx:23
  -  if (hydrated && lines.length === 0 && !orderNumber) router.replace("/search");
  +  if (hydrated && lines.length === 0 && !orderNumber) router.replace("/cart");

HARNESS: ACCEPTED   targetSpecPasses: true   suiteRegressed: false
  suite: 9 passed / 1 failed  ->  10 passed / 0 failed
```

Both branches exist in the repository now and can be inspected:

```
parikshan/fix-0d144af0  30efb5c
parikshan/fix-ca58f3b5  5db4b60
```

Every step was checked afterwards rather than taken on trust:

- **The working tree was put back.** After each run the planted defect was still
  on disk and the fix was not left behind. Verification has to apply a change to
  test it, and it is restored in a `finally` whether the run passed, failed or
  threw.
- **The change exists only on its branch.** `HEAD` was `cd35418` before and
  after both runs, the current branch was never left, and nothing was merged.
  The branch is written with git plumbing straight into the object store, so the
  working tree is never switched and a build cannot pick up the wrong code.
- **The verdict required a real rebuild.** The running build had the defect when
  the fixer was called. The only way that spec could pass is if the harness
  built the fixer's edit and re-ran against it.
- **The suite is green again afterwards.** With both defects removed, a final
  rebuild-and-run gives 10 of 10.

**One honest wrinkle about the branch diff.** `git diff HEAD parikshan/fix-…`
is empty for both branches. That is not because nothing was proposed - each
branch does contain the corrected line - but because the defects were planted in
the *uncommitted* working tree, so the fixer's corrected file coincides with what
`HEAD` already had. The meaningful comparison is working-tree to branch, not
`HEAD` to branch. Anyone re-checking this should compare against the planted
state, not against `HEAD`.

**The loop is proven end to end for both rules**: classify, propose, branch,
apply, rebuild, restart, re-run, verdict, restore - with no step performed by
hand.

---

## What this does not show

Stated so the evidence above is read for what it is.

- **The assertion diff is textual, not a parse.** A fixer determined to hide a
  change could defeat it. It is a check on a cooperating agent, not a security
  boundary, and it catches every ordinary way an assertion gets weakened rather
  than every conceivable one.
- **The harness rejects legitimate test edits too.** Only a byte-for-byte
  unchanged spec is accepted. That false-positive cost is deliberate: a harness
  that waves test changes through cannot be the thing that makes an automated
  fixer safe.
- **The fixer can produce a worse message than the one it replaces.** Rule 1
  writes back what the assertion demands. When the assertion demands a full
  sentence, as in the case above, the result is the right sentence. When it
  demands a *substring* - `toContainText("Incorrect email")` against a source
  that says `"Incorrect email or password."` - the rule writes the substring,
  truncating the message while satisfying the test. It is a proposal for a human
  to read, and this is one of the things they have to read for.
- **Change history needs the code checked out.** An imported repository is a
  file listing with no history attached; for those the recency factor reports
  itself unavailable rather than scoring as zero risk.
- **Server-side logs are not captured.** What the correlator reads is what the
  browser saw: API responses, transport failures, console and page errors. Now
  that the application is a separate process its output could be collected, but
  that is not built.
- **The rebuild is wired to one known application.** `apps/shopstack` with a
  fixed build command, not an arbitrary command taken from a request. A second
  application under test would need adding deliberately.
- **Two calls to the harness at once will collide, and one of them fails.**
  `rebuildAndRestart` writes `apps/shopstack/.next` in place with no lock, so a
  second call that arrives mid-build reads a half-written directory. Reproduced
  deliberately: two concurrent `fix-baseline` requests gave

  ```
  [A] 502  The application under test failed to build: ENOENT, open
           'apps/shopstack/.next/server/pages-manifest.json'
  [B] 200
  ```

  That is the handled path - a described 502, not a crash - and the storefront
  was serving again immediately afterwards. It is recorded because the harness
  is safe to run twice in sequence and *not* safe to run twice at once, which is
  not obvious from the outside.

  `runSuite` throwing is now caught in this route and answered as 409 (a run is
  already in flight) or 422, matching what the `runs` route already did; before
  that it escaped as a bare 500 with no body. Three such bare 500s were seen
  while regenerating this document, each succeeding on immediate retry. Their
  cause was **not** established: the catch that now covers them is defensive,
  and `RunInProgressError` could not be reproduced on demand, because
  `fix-baseline` rebuilds for roughly twenty seconds before running the suite
  and any in-flight run has finished by then. The bare 500 is gone; the claim
  that a concurrent run was what caused it is not proven.
- **One demonstration each.** These are single reproduced cases, not a measured
  accuracy rate over a corpus. They show the mechanisms work on real failures;
  they do not establish how often the classifier is right in general.
- **Two rules, of one shape.** Both handle an assertion that names the value it
  wanted and the value it got, where that value is a literal in non-test source.
  Everything else is refused, and those refusals are the common case. Two rules
  of one shape show the loop generalises across rules; they do not show the
  fixer keeps pace with the bugs a real codebase produces. Rule 2 had zero
  recorded real-bug occurrences before its defect was planted to exercise it.
- **The fixer does not know what the wording should be.** It restores what the
  assertion demands and says so: the replacement satisfies the test, and whether
  it is the right sentence for the product is a judgement it does not make.
- **Nothing merges.** Accepting a proposal records a decision; a person merges
  the branch with git, deliberately, outside this application.
