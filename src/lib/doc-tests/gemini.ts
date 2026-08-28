// Gemini call for Doc Tests, mirroring the pattern in
// src/lib/projects/scenario-generation.server.ts (same model, same
// responseMimeType: "application/json" + Zod-validated shape) but prompted
// from pasted documentation text instead of a GitHub repo's file tree.
import { z } from "zod";

import type { DocScenarioTemplate } from "./heuristic";

const GEMINI_MODEL = "gemini-flash-lite-latest";

export function buildDocPrompt(docTitle: string, docText: string): string {
  return `You are a QA engineer drafting test scenarios from a piece of product/API documentation.

Document title: ${docTitle || "(untitled)"}

Document text:
${docText}

Extract the concrete, testable requirements this document states (behaviors, constraints, error
cases, return values) and turn each into a specific test scenario. Do not invent requirements the
document doesn't state. Propose between 3 and 8 scenarios.

Respond with ONLY JSON (no markdown fences, no commentary) matching exactly this shape:
{
  "scenarios": [
    {
      "type": "E2E" | "API" | "Regression" | "Accessibility" | "Visual",
      "title": string,
      "description": string,
      "priority": "critical" | "high" | "medium" | "low",
      "filePath": string
    }
  ]
}`;
}

const scenarioSchema = z.object({
  type: z.enum(["E2E", "API", "Regression", "Accessibility", "Visual"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000),
  priority: z.enum(["critical", "high", "medium", "low"]),
  filePath: z.string().trim().min(1).max(300),
});
const geminiResponseSchema = z.object({ scenarios: z.array(scenarioSchema).min(1).max(12) });

export async function requestDocScenariosFromGemini(
  prompt: string,
): Promise<DocScenarioTemplate[]> {
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error("Gemini did not return valid JSON");
  }

  const result = geminiResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(
      `Gemini response did not match the expected scenario shape: ${result.error.message}`,
    );
  }
  return result.data.scenarios;
}
