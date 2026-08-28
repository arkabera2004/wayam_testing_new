// Pure heuristic fallback for Synthetic Data generation, used when Gemini
// is unavailable — see tests/synthetic-data.test.ts. Guesses field names
// from the scenario's own title/description text (e.g. mentioning "email"
// produces an email field) rather than fabricating arbitrary schemas.
const FIELD_GUESSES: Array<{
  pattern: RegExp;
  field: string;
  sample: (i: number) => string | number;
}> = [
  { pattern: /\bemail\b/i, field: "email", sample: (i) => `test.user${i}@example.com` },
  { pattern: /\bpassword\b/i, field: "password", sample: () => "Str0ng-Passw0rd!" },
  { pattern: /\bname\b/i, field: "name", sample: (i) => `Jordan Rivera ${i}` },
  {
    pattern: /\bphone\b/i,
    field: "phone",
    sample: (i) => `+1-555-01${String(i).padStart(2, "0")}`,
  },
  { pattern: /\baddress\b/i, field: "address", sample: (i) => `${700 + i} Evergreen Terrace` },
  { pattern: /\bprice|amount|total\b/i, field: "amount", sample: (i) => 9.99 * i },
  { pattern: /\bquantity|count\b/i, field: "quantity", sample: (i) => i },
  { pattern: /\bdate\b/i, field: "date", sample: () => new Date().toISOString().slice(0, 10) },
  { pattern: /\bid\b/i, field: "id", sample: () => crypto.randomUUID() },
  { pattern: /\bstatus\b/i, field: "status", sample: () => "active" },
];

export interface SyntheticRecord {
  [field: string]: string | number;
}

/** Builds `count` synthetic records by matching field-hinting words in the
 * scenario text against a lookup table; always includes a fallback `note`
 * field so the output is never an empty object even when nothing matches. */
export function generateFallbackDataset(scenarioText: string, count: number): SyntheticRecord[] {
  const matched = FIELD_GUESSES.filter((g) => g.pattern.test(scenarioText));
  const fields =
    matched.length > 0
      ? matched
      : [{ pattern: /.*/, field: "value", sample: (i: number) => `sample-value-${i}` }];

  return Array.from({ length: count }, (_, i) => {
    const record: SyntheticRecord = {};
    for (const { field, sample } of fields) {
      record[field] = sample(i + 1);
    }
    return record;
  });
}
