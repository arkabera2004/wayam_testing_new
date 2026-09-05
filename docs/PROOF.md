# Proof artifact — phases 1 to 4

Every figure below was read back out of the database or the running application
after the fact. Nothing here is a description of what the code is supposed to
do; each item names the spec, the error text, and the stored verdict, so it can
be checked rather than believed.

The claim being supported is narrow and specific. AI test generation,
self-healing and browser agents are commoditised. Two things are not: deciding
what a failure means using more than the UI layer, and proving that a fix fixed
the defect rather than the test. These three items are evidence for those two,
and for nothing wider.

---

## 1. Cross-layer reasoning got an answer that UI-only reasoning got wrong

**Spec:** `Sign up is rejected for an existing email`

**What the interface reported:**

```
Error: expect(locator).toBeVisible() failed
```

That error is ambiguous by construction. "The element was not there" reads the
same whether the API that fills it faulted or the element was renamed. The
UI-only pass, working from the error text and this spec's run history, returned:

```
flaky @ 55%
```

**What the layer underneath was doing:**

```
POST /demo/shopstack/api/signup  ->  500
{"error":"Account service unavailable."}
```

**Stored verdict after correlation:**

```
real-bug @ 90%

  Reading the UI alone gave flaky at 55. With the layers underneath it,
  this is real-bug at 90.

  The UI failed and underneath it POST /demo/shopstack/api/signup returned
  500 - {"error":"Account service unavailable."}. The interface is
  reporting a fault the server actually had, so this is the application
  misbehaving rather than the test being stale.
```

**The control.** The same spec was run again with the element renamed and the
API healthy — an identical UI error, `POST /demo/shopstack/api/signup -> 409`.
It was **not** upgraded to `real-bug`. The correlator recorded that nothing had
faulted, so the server was ruled out as the cause, and left the verdict where
the history had put it, on the grounds that one clean run cannot settle a
question about behaviour over time.

Same UI error text, same spec, same starting history. Different verdict, decided
entirely by the layer beneath. The interface alone cannot separate those two
cases; that is the phase.

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

Live from the running application, over the real suite:

```
 60  Login fails with an incorrect password
 39  Sign up is rejected for an existing email
 36  Account locks after five failed attempts
 25  Checkout is blocked when the cart is empty
 25  User checks out with an expired card
 25  User completes checkout with a valid card
 20  User changes their account email
 12  Search with no matches shows an empty state
 12  User removes the last item from the cart
 12  User updates the quantity of a cart item
```

**Top — 60**

| Points | Factor | Reason |
|---|---|---|
| +40 | has caught real bugs | Classified as a real bug 5 times. This area has a record of actually breaking. |
| 0 | outages discounted | 1 of its failures was an environment outage, left out of the count above. |
| 0 | untouched recently | No code behind this test has changed in the last 90 days. |
| +20 | access path | Covers `/login`. Sign-in defects lock people out or let the wrong people in. |

**Bottom — 12**

| Points | Factor | Reason |
|---|---|---|
| 0 | no real bugs recorded | Has failed 3 times but never in a way judged a genuine defect. |
| 0 | outages discounted | 1 of its failures was an environment outage. |
| 0 | untouched recently | No code behind this test has changed in the last 90 days. |
| +12 | core journey | Covers `/cart`, which most sessions pass through. |

Both have failed several times. The 48-point gap is entirely what those failures
*were*: five of the top one's were judged genuine defects, none of the bottom
one's were. Outages are excluded from both, and the exclusion is shown rather
than applied quietly. The bug record comes from the Phase 1 and 2
classifications, not from a static guess at importance.

**Recency reads zero for every test here, and that is worth explaining rather
than hiding.** The storefront was moved into its own directory to make the fix
loop in section 3 real. Change recency is read from `git log` at the path a
route maps to, and those paths are new, so nothing shows as recently changed.
An earlier ranking - before the move - did separate two equally-recent tests by
their bug record while both earned the same recency credit. The factor works;
this particular snapshot cannot exercise it, and a ranking that claimed recency
data it does not have would be the sort of thing this document exists to avoid.

Two judgement calls are worth stating, because they change the order:

- **Flakiness scores down, not up.** A spec that fails constantly at random
  would top a naive failure-count ranking, but a result that is unreliable
  either way buys less information per run.
- **Outages are excluded and the exclusion is shown.** A spec that failed
  because the target was unreachable learned nothing about itself. Dropping that
  silently would be nearly as misleading as counting it.

---

## 3. The harness caught a bad fix and passed a real one

The application under test is now a separate process. It used to be a route
inside Parikshan, which meant the harness and the thing it was judging were the
same server: a source change could not be built without restarting the process
doing the verifying, so the suite was re-run against code the change had never
reached. That produced a confident rejection of a correct fix. The storefront
now lives in `apps/shopstack`, builds and serves on its own port, and the
harness builds it from disk before both the baseline and the re-run.

Same defect in both attempts: the account-lockout message no longer says
`"locked"`. Both verdicts below are against a genuine build of the changed
source - the fix was written to disk and nothing else, and the harness had to
rebuild to see it.

### Bad fix — the assertion rewritten to expect the broken message

The defect was left in the source and only the test was changed.

```
[REJECTED] Account locks after five failed attempts
  suite: 1 failing -> 0 failing
  spec assertions changed: 1, removed: 0, unchanged: false

  An assertion's expectation was changed from "locked" to "Contact support"
  on toContainText. The test now agrees with the behaviour it was written to
  catch, which is the test moving to meet the bug rather than the bug being
  fixed.
```

The suite went fully green and the target spec passed. It was refused anyway.
That is the case that matters: a suite reporting zero failures is exactly what a
silenced test looks like.

### Good fix — the application source corrected, the spec untouched

The source was edited and deliberately not rebuilt by hand. The running build
still served the defect at the moment verification was asked for.

```
[ACCEPTED] Account locks after five failed attempts
  suite: 1 failing -> 0 failing
  spec passes: true
  spec assertions changed: 0, unchanged: true

  The spec is byte-for-byte unchanged in what it asserts, it now passes, and
  nothing else in the suite started failing. The behaviour changed, not the
  expectation.
```

The only way that spec could pass is if the harness built the edited source and
re-ran against it, which is the step that did not exist before.

Identical run results — `1 failing -> 0 failing`, target spec passing in both,
both against a real build of what was on disk. Opposite verdicts, decided only
by whether the test or the application moved.

**The loop is now proven end to end for a source-level fix**: baseline captured
against a build, change written to disk, application rebuilt and restarted,
suite re-run, verdict issued. That was partial when this document was first
written and is no longer.

### The same loop, driven by the fixer rather than by hand

The two cases above are a person editing a file and asking the harness to
judge it. This one is the agent doing the editing.

A real defect was planted in the storefront's source - the sign-in failure
message changed from "Incorrect email or password." to "Those credentials did
not match." - the application was rebuilt so it genuinely served the defect, and
the suite was run twice until the failure was classified `real-bug` at 70. Then
the fixer was pointed at that result and nothing else.

```
proposed: true          merged: false
branch:   parikshan/fix-0d232bd9 @ e1927445f5
working branch untouched: design-system-icon-registry

apps/shopstack/src/app/login/page.tsx:29
  -  : "Those credentials did not match.",
  +  : "Incorrect email or password.",

HARNESS: ACCEPTED
  spec passes: true    regressed: false
  suite: 1 failing -> 0 failing
  The spec is byte-for-byte unchanged in what it asserts, it now passes, and
  nothing else in the suite started failing. The behaviour changed, not the
  expectation.
```

Every step was checked afterwards rather than taken on trust:

- **The working tree was put back.** The defect is still on disk; the fix was
  not left behind. Verification has to apply a change to test it, and it is
  restored in a `finally` whether the run passed, failed or threw.
- **The change exists only on its branch.** `HEAD` is where it was, the current
  branch was never left, and nothing was merged. The branch is written with git
  plumbing straight into the object store, so the working tree is never
  switched and a build cannot pick up the wrong code.
- **The application was rebuilt back to the restored source.** Re-running the
  suite afterwards gives 9 of 10 again, which is only true if the fix stopped
  being served the moment verification ended.
- **The verdict required a real rebuild.** The running build had the defect when
  the fixer was called. The only way that spec could pass is if the harness
  built the fixer's edit and re-ran against it.

**The loop is proven end to end including the fixer's own proposal**: classify,
propose, branch, apply, rebuild, restart, re-run, verdict, restore - with no
step performed by hand.

### A second rule, proven the same way

The first rule handles a wrong message. This one handles a wrong destination:
the checkout page was made to send an empty cart to `/search` instead of
`/cart`, rebuilt so it genuinely did, and run until the failure classified
`real-bug` at 70.

```
Expected pattern: /\/cart$/
Received string:  "http://localhost:4000/demo/shopstack/search"

apps/shopstack/src/app/checkout/page.tsx:23
  -  if (hydrated && lines.length === 0 && !orderNumber) router.replace("/search");
  +  if (hydrated && lines.length === 0 && !orderNumber) router.replace("/cart");

HARNESS: ACCEPTED   spec passes: true   regressed: false
  suite: 1 failing -> 0 failing
```

Same four checks afterwards: the defect is back on disk, the fix exists only on
its branch, `HEAD` is unmoved, and re-running the suite gives 9 of 10 again.

Two things this rule has to refuse, and does. A URL assertion usually states a
pattern, and a pattern is not a value - `/^\/cart\/\d+$/` describes many paths
and names none of them, so only a pattern that is a literal wearing regex
syntax is converted back. And the destination has to be a literal at a
navigation call: matching any occurrence of `/cart` in the file would find text
that has nothing to do with where the browser goes.

The rule was chosen because it is the same shape as the first - an expected
value stated in the error and a wrong literal in the source - not because it
was the most valuable. It had zero recorded real-bug occurrences before this
run; the defect above was planted to exercise it. What two rules of one shape
show is that the loop generalises across rules, not that rule-writing is
keeping up with the bugs a real codebase produces.

---

## What this does not show

Stated so the trio above is read for what it is.

- **The assertion diff is textual, not a parse.** A fixer determined to hide a
  change could defeat it. It is a check on a cooperating agent, not a security
  boundary, and it catches every ordinary way an assertion gets weakened rather
  than every conceivable one.
- **The harness rejects legitimate test edits too.** Only a byte-for-byte
  unchanged spec is accepted. That false-positive cost is deliberate: a harness
  that waves test changes through cannot be the thing that makes an automated
  fixer safe.
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
- **One demonstration each.** These are single reproduced cases, not a measured
  accuracy rate over a corpus. They show the mechanisms work on real failures;
  they do not establish how often the classifier is right in general.
- **One proposal, of one shape.** The loop has been carried end to end once, for
  the single case the fixer handles: an assertion that names both the value it
  wanted and the value it got, where that value is a literal in non-test source.
  It refuses everything else, and those refusals are the common case. This shows
  the loop is sound; it does not show the fixer is useful across a range of
  bugs, and it is not evidence of a success rate.
- **The fixer does not know what the wording should be.** It restores what the
  assertion demands and says so: the replacement satisfies the test, and whether
  it is the right sentence for the product is a judgement it does not make.
- **Nothing merges.** Accepting a proposal records a decision; a person merges
  the branch with git, deliberately, outside this application.
