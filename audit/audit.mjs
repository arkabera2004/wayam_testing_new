import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
// Destructive or navigation-away controls are exercised for reachability, not clicked.
const SKIP = /delete|remove|sign out|log out|disconnect|revoke|reset|clear all|danger/i;
// Every "Run …" control spawns a real Playwright process. Clicking them on all
// 8 projects x 21 pages would fan out into ~168 concurrent browser suites, so
// they are exercised in full on the first project and skipped after that. Every
// such skip is counted and reported - nothing is silently dropped.
const RUN_CONTROL = /^(run|re-?run)\b/i;

const PAGES = " /analytics /code-review /defect-prediction /discovery /doc-tests /healing /integrations /map /plan /prd /prioritization /quarantine /release-gate /repo-baseline /root-cause /runs /settings /test-selection /tests".trim().split(/\s+/);

const problems = [];
const stats = { pages: 0, clicked: 0, skippedDestructive: 0, skippedRunControls: 0, runControlsClicked: 0 };

async function projectIds(page) {
  const r = await page.request.get(`${BASE}/api/projects`);
  const d = await r.json();
  const rows = Array.isArray(d) ? d : d.projects || [];
  return rows.map((x) => x.slug || x.id);
}

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let current = "";
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // React devtools / favicon noise is not an app defect.
    if (/favicon|Download the React DevTools|Extra attributes from the server/i.test(t)) return;
    problems.push({ kind: "console", page: current, detail: t.slice(0, 200) });
  });
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push({ kind: "http", page: current, detail: `${r.status()} ${r.url()}` });
  });
  page.on("pageerror", (e) => problems.push({ kind: "pageerror", page: current, detail: String(e).slice(0, 200) }));
  // A modal dialog would freeze the run; auto-dismiss and record it.
  page.on("dialog", async (d) => { problems.push({ kind: "dialog", page: current, detail: d.message() }); await d.dismiss(); });

  const ids = await projectIds(page);
  const urls = ["/", "/projects", "/projects/new", "/notifications", "/settings"];
  for (const s of ids) { urls.push(`/projects/${s}`); for (const p of PAGES) urls.push(`/projects/${s}${p}`); }

  const firstSlug = ids[0];
  for (const u of urls) {
    current = u;
    // Run controls are clicked for real only under the first project.
    const firstProject = !u.startsWith("/projects/") || u.startsWith(`/projects/${firstSlug}`);
    stats.pages++;
    process.stderr.write(`[${stats.pages}/${urls.length}] ${u}\n`);
    try {
      const resp = await page.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (resp && resp.status() >= 400) problems.push({ kind: "nav", page: u, detail: `status ${resp.status()}` });
      await page.waitForTimeout(200);

      const controls = await page.locator('button:visible, [role="tab"]:visible, [role="switch"]:visible').all();
      for (let i = 0; i < controls.length; i++) {
        const el = controls[i];
        let label = "";
        try { label = ((await el.textContent()) || (await el.getAttribute("aria-label")) || "").trim(); } catch { continue; }
        if (SKIP.test(label)) { stats.skippedDestructive++; continue; }
      if (RUN_CONTROL.test(label) && !firstProject) { stats.skippedRunControls++; continue; }
        try {
          if (!(await el.isVisible()) || !(await el.isEnabled())) continue;
          await el.click({ timeout: 1200, noWaitAfter: true });
          stats.clicked++;
          if (RUN_CONTROL.test(label)) {
            stats.runControlsClicked++;
            // Let the suite finish so the next page is not racing a live run.
            await page.waitForTimeout(8000);
          }
          await page.waitForTimeout(80);
          await page.keyboard.press("Escape").catch(() => {});
          // A click may navigate; return so the remaining controls resolve.
          if (!page.url().includes(u.split("?")[0]) && u !== "/") {
            await page.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(150);
            break;
          }
        } catch { /* control detached or covered - not an app defect */ }
      }
    } catch (e) {
      problems.push({ kind: "crash", page: u, detail: String(e).slice(0, 200) });
    }
  }

  await browser.close();
  console.log(JSON.stringify({ stats, problemCount: problems.length, problems }, null, 2));
};
run();
