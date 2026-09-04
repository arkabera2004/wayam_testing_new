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
 69  Sign up is rejected for an existing email
 66  Account locks after five failed attempts
 55  Checkout is blocked when the cart is empty
 55  User checks out with an expired card
 55  User completes checkout with a valid card
 50  Login fails with an incorrect password
 50  User changes their account email
 42  Search with no matches shows an empty state
 42  User removes the last item from the cart
 42  User updates the quantity of a cart item
```

**Top — 69**

| Points | Factor | Reason |
|---|---|---|
| +34 | has caught real bugs | Classified as a real bug 2 times. This area has a record of actually breaking. |
| 0 | outages discounted | 1 of its failures was an environment outage, left out of the count above. |
| +30 | changed this week | `src/app/demo/shopstack/signup` changed today. |
| +20 | access path | Covers `/signup`. Sign-in defects lock people out or let the wrong people in. |

**Bottom — 42**

| Points | Factor | Reason |
|---|---|---|
| 0 | no real bugs recorded | Has failed 1 time but never in a way judged a genuine defect. |
| 0 | outages discounted | Its one failure was an environment outage. |
| +30 | changed this week | `src/app/demo/shopstack/cart` changed 3 days ago. |
| +12 | core journey | Covers `/cart`, which most sessions pass through. |

Both were recently changed and both earned the same +30 for it. The 27-point gap
is the bug record and what a failure there costs. The bug record comes from the
Phase 1 and 2 classifications; the recency comes from the repository's own
`git log`. Neither is a static guess at importance.

Two judgement calls are worth stating, because they change the order:

- **Flakiness scores down, not up.** A spec that fails constantly at random
  would top a naive failure-count ranking, but a result that is unreliable
  either way buys less information per run.
- **Outages are excluded and the exclusion is shown.** A spec that failed
  because the target was unreachable learned nothing about itself. Dropping that
  silently would be nearly as misleading as counting it.

---

## 3. The harness caught a bad fix and passed a real one

Same defect in both attempts: the account-lockout message no longer says
`"locked"`. Both stored verdicts, read back from the database:

### Bad fix — the assertion rewritten to expect the broken message

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

### Good fix — the application corrected, the spec untouched

```
[ACCEPTED] Account locks after five failed attempts
  suite: 1 failing -> 0 failing
  spec assertions changed: 0, removed: 0, unchanged: true

  The spec is byte-for-byte unchanged in what it asserts, it now passes, and
  nothing else in the suite started failing. The behaviour changed, not the
  expectation.
```

Identical run results — `1 failing -> 0 failing`, target spec passing in both.
Opposite verdicts, decided only by whether the test or the application moved.

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
  browser saw: API responses, transport failures, console and page errors. Logs
  from the application's own process would need it to be run by us.
- **One demonstration each.** These are single reproduced cases, not a measured
  accuracy rate over a corpus. They show the mechanisms work on real failures;
  they do not establish how often the classifier is right in general.
- **No fixer agent exists.** Phase 5 has not been started.
