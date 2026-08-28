// Gemini call for Synthetic Data, mirroring the pattern in
// src/lib/projects/scenario-generation.server.ts — same model, same
// responseMimeType: "application/json" + Zod-validated shape, but
// generates realistic-looking JSON test records for a scenario instead of
// scenarios themselves.
import { z } from "zod";

import type { JsonValue } from "../../integrations/mongodb/schema.ts";

const GEMINI_MODEL = "gemini-flash-lite-latest";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export function buildSyntheticDataPrompt(scenarioText: string, count: number): string {
  return `You are generating realistic synthetic test data for this test scenario:

"${scenarioText}"

Generate exactly ${count} realistic JSON records this scenario's test could use as input data.
Infer plausible field names from the scenario text. Use varied, realistic-looking values (not
just "test1", "test2") but never real people's data. Do not include comments or explanations.

Respond with ONLY JSON (no markdown fences, no commentary) matching exactly this shape:
{
  "records": [
    { <field>: <value>, ... }
  ]
}`;
}

const geminiResponseSchema = z.object({
  records: z.array(z.record(z.string(), jsonValueSchema)).min(1).max(50),
});

export async function requestSyntheticDataFromGemini(
  prompt: string,
): Promise<Array<Record<string, JsonValue>>> {
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
      `Gemini response did not match the expected records shape: ${result.error.message}`,
    );
  }
  return result.data.records;
}
