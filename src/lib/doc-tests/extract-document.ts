// Server-side text extraction for uploaded documents in Doc Tests.
// "Any kind of document" is the explicit requirement here — this never
// rejects a file outright, even ones it doesn't specifically know how to
// parse. Each format gets a real extractor where one exists (PDF, DOCX);
// anything else falls through a chain of increasingly dumb fallbacks that
// end in a raw binary-strings scrape, so *something* always comes back
// instead of an error. Same "never block the feature" philosophy as
// gemini.ts/heuristic.ts in this module.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware } from "@/lib/auth/auth-middleware";

// Matches the docText cap on generateDocTestsFn (functions.ts) — no
// point extracting more than the downstream generator will ever read.
const MAX_EXTRACTED_CHARS = 30_000;

// Uploaded file is base64-encoded in a plain JSON server-fn call (no
// multipart/FormData plumbing needed). ~14MB of base64 covers a ~10MB
// source file, generous for a text-bearing document of any format.
const MAX_BASE64_CHARS = 14_000_000;

export interface ExtractedDocument {
  text: string;
  truncated: boolean;
  /** How the text was obtained — surfaced in the UI so a garbled
   * best-effort scrape doesn't masquerade as a clean extraction. */
  method: "text" | "html" | "rtf" | "pdf" | "docx" | "binary-scrape";
}

function clip(text: string): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EXTRACTED_CHARS) return { text: trimmed, truncated: false };
  return { text: trimmed.slice(0, MAX_EXTRACTED_CHARS), truncated: true };
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function stripRtf(rtf: string): string {
  return rtf
    // Drop the font/color table preamble groups outright — their braces
    // nest, so this only handles the common single-level case Word/macOS
    // TextEdit actually emit, not arbitrarily nested RTF. Good enough for
    // "extract the readable text", not a full RTF parser.
    .replace(/\{\\fonttbl[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi, "")
    .replace(/\{\\colortbl[^{}]*\}/gi, "")
    .replace(/\{\\\*\\expandedcolortbl[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi, "")
    // Negative lookahead matters here: without it this also eats the
    // start of longer control words like \pardirnatural or
    // \partightenfactor0, mangling them into stray leftover text
    // ("irnatural", "tightenfactor0") instead of letting the generic
    // control-word stripper below remove them cleanly.
    .replace(/\\pard?(?![a-z])/gi, "\n")
    .replace(/\\'[0-9a-f]{2}/gi, "")
    .replace(/\\[a-z]+-?\d*\s?/gi, "")
    // RTF's shorthand line break: a lone backslash immediately before a
    // real newline in the source (as opposed to a backslash starting a
    // control word, already handled above).
    .replace(/\\\n/g, "\n")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

/** Last-resort fallback for a format nothing above recognizes (or one
 * whose real parser threw): scrape runs of printable characters out of
 * the raw bytes, the same way the Unix `strings` utility works. Noisy,
 * but it means an unsupported/corrupt file still produces *something*
 * for the heuristic sentence-extraction pass to work with, rather than a
 * dead end. */
function binaryStringsScrape(buffer: Buffer): string {
  const runs: string[] = [];
  let current = "";
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]!;
    const isPrintable = byte >= 0x20 && byte <= 0x7e;
    if (isPrintable) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 4) runs.push(current);
      current = "";
    }
  }
  if (current.length >= 4) runs.push(current);
  return runs.join("\n");
}

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1]!.toLowerCase() : "";
}

async function extractByExtension(
  ext: string,
  buffer: Buffer,
): Promise<{ text: string; method: ExtractedDocument["method"] } | null> {
  if (ext === "pdf") {
    const { extractText } = await import("unpdf");
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    return { text, method: "pdf" };
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: value, method: "docx" };
  }

  if (ext === "doc") {
    // Legacy binary Word format — mammoth only reads .docx (it's a zip of
    // XML). There's no lightweight pure-JS reader for the old binary
    // format, so this deliberately falls through to the binary-strings
    // scrape below rather than claiming a parse it can't do.
    return null;
  }

  if (ext === "html" || ext === "htm") {
    return { text: stripHtml(buffer.toString("utf-8")), method: "html" };
  }

  if (ext === "rtf") {
    return { text: stripRtf(buffer.toString("utf-8")), method: "rtf" };
  }

  // Plain-text-like formats (txt, md, csv, tsv, json, yaml, log, or no
  // extension at all) — decode as UTF-8 directly.
  const textLike = new Set(["txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "log", ""]);
  if (textLike.has(ext)) {
    return { text: buffer.toString("utf-8"), method: "text" };
  }

  return null;
}

export const extractDocumentTextFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      fileName: z.string().trim().min(1).max(300),
      contentBase64: z.string().min(1).max(MAX_BASE64_CHARS),
    }),
  )
  .handler(async ({ data }): Promise<ExtractedDocument> => {
    const buffer = Buffer.from(data.contentBase64, "base64");
    const ext = extensionOf(data.fileName);

    let outcome: { text: string; method: ExtractedDocument["method"] } | null = null;
    try {
      outcome = await extractByExtension(ext, buffer);
    } catch (err) {
      console.error(`[extractDocumentTextFn] "${ext}" extractor failed, falling back:`, err);
      outcome = null;
    }

    // Nothing recognized the extension, the recognized extractor threw,
    // or it recognized-but-empty (e.g. a scanned/image-only PDF with no
    // text layer) — always fall back rather than surface an error.
    if (!outcome || outcome.text.trim().length === 0) {
      outcome = { text: binaryStringsScrape(buffer), method: "binary-scrape" };
    }

    const { text, truncated } = clip(outcome.text);
    return { text, truncated, method: outcome.method };
  });
