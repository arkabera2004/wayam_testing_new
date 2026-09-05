import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/status-badge";
import { listProjectsFn } from "@/lib/projects/functions";
import { generateDocTestsFn, type PublicDocTestRun } from "@/lib/doc-tests/functions";
import { extractDocumentTextFn, type ExtractedDocument } from "@/lib/doc-tests/extract-document";

// No hard cap on which file types can be *picked* — the extractor
// (extract.server.ts) always returns something for any format, down to
// a raw binary-strings scrape as a last resort. This only caps size, to
// keep the base64 payload of a single server-fn call reasonable.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

const EXTRACTION_METHOD_LABEL: Record<ExtractedDocument["method"], string> = {
  text: "plain text",
  html: "HTML (tags stripped)",
  rtf: "RTF (markup stripped)",
  pdf: "PDF",
  docx: "Word (.docx)",
  "binary-scrape": "unrecognized format — best-effort text scrape",
};

export const Route = createFileRoute("/_app/doc-tests")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects };
  },
  component: DocTestsPage,
});

function DocTestsPage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const generate = useServerFn(generateDocTestsFn);
  const extractDocument = useServerFn(extractDocumentTextFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicDocTestRun | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionInfo, setExtractionInfo] = useState<ExtractedDocument | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setUploadError(null);
    setExtractionInfo(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(
        `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB — please upload something under 10MB.`,
      );
      return;
    }
    setExtracting(true);
    try {
      const contentBase64 = await fileToBase64(file);
      const extracted = await extractDocument({ data: { fileName: file.name, contentBase64 } });
      setDocText(extracted.text);
      setUploadedFileName(file.name);
      setExtractionInfo(extracted);
      if (!docTitle.trim()) {
        setDocTitle(file.name.replace(/\.[^./\\]+$/, ""));
      }
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : `Could not read "${file.name}" — try pasting the text instead.`,
      );
    } finally {
      setExtracting(false);
    }
  }

  async function handleGenerate() {
    if (!projectId || docText.trim().length < 20) return;
    setPending(true);
    setError(null);
    try {
      setResult(await generate({ data: { projectId, docTitle, docText } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate scenarios");
    } finally {
      setPending(false);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before using doc tests.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BookOpen className="h-6 w-6" /> Doc Tests
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste documentation (a README section, API reference, spec) and Parikshan drafts test
          scenarios for its stated requirements.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">Add a project first.</p>
          <Button asChild>
            <Link to="/projects/new">Add a project</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentation</CardTitle>
              <CardDescription>
                If Gemini is unavailable, a heuristic sentence-extraction pass runs instead — the
                feature still works either way.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Document title (optional)"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleFileSelected(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extracting}
                >
                  <Upload className="h-4 w-4" />
                  {extracting ? "Reading…" : "Upload a document"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  PDF, Word (.doc/.docx), text, markdown, HTML, RTF — any file up to 10MB. Or just
                  paste text below.
                </span>
              </div>
              {uploadedFileName && extractionInfo && (
                <p className="text-xs text-muted-foreground">
                  Extracted from{" "}
                  <span className="font-medium text-foreground">{uploadedFileName}</span> (
                  {EXTRACTION_METHOD_LABEL[extractionInfo.method]})
                  {extractionInfo.truncated ? " — truncated to the first 30,000 characters" : ""}.
                </p>
              )}
              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
              <Textarea
                placeholder="Paste documentation text here, or upload a document above…"
                value={docText}
                onChange={(e) => {
                  setDocText(e.target.value);
                  // Free-typed edits no longer reflect the raw extraction —
                  // stop attributing them to the uploaded file.
                  if (uploadedFileName) {
                    setUploadedFileName(null);
                    setExtractionInfo(null);
                  }
                }}
                rows={8}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={handleGenerate}
                disabled={!projectId || docText.trim().length < 20 || pending}
              >
                {pending ? "Generating…" : "Generate scenarios"}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{result.docTitle}</CardTitle>
                  <Badge variant="outline" className="capitalize">
                    {result.source === "gemini" ? "AI-drafted" : "heuristic fallback"}
                  </Badge>
                </div>
                <CardDescription>{result.scenarios.length} scenario(s) drafted</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.scenarios.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{s.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{s.type}</Badge>
                        <PriorityBadge priority={s.priority} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
