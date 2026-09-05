"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { useToast } from "@/components/ui/toast";

/**
 * Uploading a specification, or pasting one.
 *
 * The file is read in the browser and sent as text. That keeps the contract
 * with the server honest - it parses characters, and nothing in this build can
 * read a PDF or a .docx, so the picker does not offer to take one. Saying
 * "text and markdown" up front is better than accepting a PDF and returning
 * mojibake that looks like a parsing failure.
 */

const ACCEPT = ".md,.markdown,.txt,.text,.rst,.adoc,text/plain,text/markdown";
const MAX_BYTES = 2 * 1024 * 1024;

export function UploadDoc({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function readFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast({
        tone: "warning",
        title: "That file is too large",
        body: `${(file.size / 1024 / 1024).toFixed(1)}MB. Paste the relevant section instead.`,
      });
      return;
    }
    const body = await file.text();
    setText(body);
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""));
  }

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/doc-sources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled document", body: text }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({ tone: "error", title: "Could not read that document", body: data?.error ?? "" });
        return;
      }

      // Nothing found is a real answer about the document, not a failure.
      toast(
        data.scenarios > 0
          ? {
              tone: "success",
              title: `${data.scenarios} scenario${data.scenarios === 1 ? "" : "s"} proposed`,
              body: "Review them below and choose which to keep.",
            }
          : {
              tone: "info",
              title: "No scenarios found",
              body: "Nothing in that document states a requirement - look for 'must', 'should' or 'cannot'.",
            },
      );

      setText("");
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Upload a specification"
      subtitle="Markdown or plain text. Every scenario traces back to a line in the document."
    >
      <div className="flex flex-col gap-3">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readFile(file);
          }}
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void readFile(file);
          }}
          className={cn(
            "grid place-items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center",
            "transition-colors duration-[170ms]",
            dragging ? "border-active bg-raised" : "border-muted bg-action",
          )}
        >
          <AppIcon name="fileUpload" size="2xl" className="icon-tertiary" />
          <p className="text-body-md text-secondary">
            Drop a file here, or{" "}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="text-primary underline underline-offset-2"
            >
              choose one
            </button>
          </p>
          <p className="text-caption text-quaternary">.md, .txt, .rst, .adoc - up to 2MB</p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={text ? 10 : 4}
          placeholder="...or paste the specification here"
          className={cn(
            "border-muted bg-raised text-body-md text-primary placeholder:text-quaternary",
            "w-full resize-y rounded-lg border px-3 py-2 font-mono",
            "focus-visible:ring-active focus-visible:ring-2 focus-visible:outline-none",
          )}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Document name"
            className={cn(
              "border-muted bg-raised text-body-md text-primary placeholder:text-quaternary",
              "h-8 min-w-56 flex-1 rounded-lg border px-3",
              "focus-visible:ring-active focus-visible:ring-2 focus-visible:outline-none",
            )}
          />
          <div className="flex items-center gap-2">
            {text.trim() ? (
              <span className="text-caption text-quaternary tabular">
                {text.trim().split(/\s+/).length} words
              </span>
            ) : null}
            <Button
              variant="primary"
              icon={busy ? "loading" : "sparkle"}
              onClick={() => void submit()}
              disabled={!text.trim() || busy}
            >
              {busy ? "Reading..." : "Extract scenarios"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
