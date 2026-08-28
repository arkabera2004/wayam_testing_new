import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { TestCaseDoc, TestScenarioDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember } from "@/lib/data/org-access.server";

export interface PublicTestCase {
  id: string;
  generatedCode: string;
  language: string;
  framework: string;
  status: TestCaseDoc["status"];
}

export interface PublicScenarioSummary {
  id: string;
  type: TestScenarioDoc["type"];
  title: string;
  filePath: string | null;
}

// INTEGRATION POINT: stand-in for real code generation (an LLM turning the
// accepted scenario into a runnable script against the actual repo). This
// just renders a generic template per scenario type.
function stubGeneratedCode(scenario: TestScenarioDoc): string {
  if (scenario.type === "API") {
    return `// ${scenario.title}
const res = await fetch(\`\${BASE_URL}/v1/resource\`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ /* TODO: real payload */ }),
});

expect(res.status).toBeLessThan(400);`;
  }

  return `import { test, expect } from '@playwright/test';

test('${scenario.title}', async ({ page }) => {
  await page.goto('/');
  // TODO: replace with real steps once the flow is confirmed against the app.
  await expect(page.getByRole('heading')).toBeVisible();
});`;
}

function toPublicTestCase(doc: TestCaseDoc): PublicTestCase {
  return {
    id: doc._id.toString(),
    generatedCode: doc.generatedCode,
    language: doc.language,
    framework: doc.framework,
    status: doc.status,
  };
}

function toPublicScenarioSummary(doc: TestScenarioDoc): PublicScenarioSummary {
  return { id: doc._id.toString(), type: doc.type, title: doc.title, filePath: doc.filePath };
}

/** "Generate code" for a scenario: returns its test_case, creating one on
 * first visit if it doesn't exist yet. Idempotent, so reloading or
 * re-clicking "Generate code" never creates duplicates. */
export const getOrCreateTestCaseFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ scenarioId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { testScenarios, testCases } = collections(db);

    const scenario = await testScenarios.findOne({ _id: new ObjectId(data.scenarioId) });
    if (!scenario) throw new ForbiddenError("Scenario not found");
    await requireOrgMember(db, scenario.orgId, context.user._id);

    let testCase = await testCases.findOne({ scenarioId: scenario._id });
    if (!testCase) {
      const now = new Date();
      testCase = {
        _id: new ObjectId(),
        orgId: scenario.orgId,
        scenarioId: scenario._id,
        generatedCode: stubGeneratedCode(scenario),
        language: scenario.type === "API" ? "typescript" : "typescript",
        framework: scenario.type === "API" ? "http" : "playwright",
        status: "not_run",
        quarantined: false,
        quarantinedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await testCases.insertOne(testCase);
    }

    return {
      scenario: toPublicScenarioSummary(scenario),
      testCase: toPublicTestCase(testCase),
    };
  });
