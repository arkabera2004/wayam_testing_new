// Gemini call for PRD Analysis, mirroring the pattern in
// src/lib/projects/scenario-generation.server.ts — same model, same
// responseMimeType: "application/json" + Zod-validated shape. Asks Gemini
// to both extract/classify requirements AND draft traced test cases in one
// call, since the two are inherently linked (a test case only exists
// because of the requirement it traces to).
import { z } from "zod";

import type { ExtractedRequirement, DraftTestCase } from "./heuristic";

const GEMINI_MODEL = "gemini-flash-lite-latest";

export function buildPrdPrompt(docTitle: string, docText: string): string {
  return `You are a senior QA engineer analysing a product requirements document.

Document title: ${docTitle || "(untitled)"}

Document text:
${docText}

1. Extract every distinct requirement the document states, in the order they appear, numbered
   REQ-1, REQ-2, etc. Classify each as "functional", "non-functional", or "security".
2. For each requirement, decide if it's testable as written:
   - "covered": clear and measurable.
   - "partial": testable but with a caveat worth a human's attention (loose wording that still has
     a number, or it duplicates an earlier requirement).
   - "gap": not testable as written — vague qualifiers ("fast", "user-friendly", "reasonable")
     with no measurable threshold. Set "issue" to a short, specific explanation for "partial" and
     "gap" (null for "covered").
3. For every requirement that is NOT a "gap", draft exactly one traced test case: tag it
   "happy-path", "edge-case", or "negative" based on what it's actually testing, and set
   requirementId to the REQ-N it traces back to.

Respond with ONLY JSON (no markdown fences, no commentary) matching exactly this shape:
{
  "requirements": [
    { "id": "REQ-1", "text": string, "category": "functional" | "non-functional" | "security",
      "coverage": "covered" | "partial" | "gap", "issue": string | null }
  ],
  "testCases": [
    { "requirementId": "REQ-1", "title": string, "description": string,
      "type": "E2E" | "API" | "Regression" | "Accessibility" | "Visual",
      "priority": "critical" | "high" | "medium" | "low",
      "tag": "happy-path" | "edge-case" | "negative", "filePath": string }
  ]
}`;
}

const requirementSchema = z.object({
  id: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(500),
  category: z.enum(["functional", "non-functional", "security"]),
  coverage: z.enum(["covered", "partial", "gap"]),
  issue: z.string().trim().min(1).max(500).nullable(),
});
const testCaseSchema = z.object({
  requirementId: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000),
  type: z.enum(["E2E", "API", "Regression", "Accessibility", "Visual"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  tag: z.enum(["happy-path", "edge-case", "negative"]),
  filePath: z.string().trim().min(1).max(300),
});
const geminiResponseSchema = z.object({
  requirements: z.array(requirementSchema).min(1).max(60),
  testCases: z.array(testCaseSchema).min(0).max(80),
});

export interface PrdAnalysisResult {
  requirements: ExtractedRequirement[];
  testCases: DraftTestCase[];
}

export async function requestPrdAnalysisFromGemini(prompt: string): Promise<PrdAnalysisResult> {
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
    throw new Error(`Gemini response did not match the expected shape: ${result.error.message}`);
  }
  return result.data;
}
