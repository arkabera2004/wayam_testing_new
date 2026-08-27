import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Github, Link2, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/projects/new")({
  component: NewProjectPage,
});

type SourceType = "github" | "url";

const ANALYSIS_STEPS = [
  "Cloning source",
  "Mapping routes & components",
  "Drafting test scenarios",
];

// INTEGRATION POINT: this simulates the crawl/analysis step with a fixed
// timeline. Replace with a Supabase edge function that kicks off the real
// repo crawl / LLM test-plan generation pipeline and polls for completion.
function NewProjectPage() {
  const navigate = useNavigate();
  const [sourceType, setSourceType] = useState<SourceType>("github");
  const [sourceValue, setSourceValue] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  function startAnalysis() {
    if (!sourceValue.trim()) return;
    setAnalyzing(true);
    setStepIndex(0);

    ANALYSIS_STEPS.forEach((_, i) => {
      setTimeout(() => setStepIndex(i), (i + 1) * 700);
    });
    setTimeout(() => {
      navigate({ to: "/projects/$projectId", params: { projectId: "atlas" } });
    }, ANALYSIS_STEPS.length * 700 + 500);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
        <p className="text-sm text-muted-foreground">
          Connect a source and Parikshan will draft your first test plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source</CardTitle>
          <CardDescription>Choose a GitHub repository or a live app URL.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleGroup
            type="single"
            value={sourceType}
            onValueChange={(v) => v && setSourceType(v as SourceType)}
            variant="outline"
            className="justify-start"
            disabled={analyzing}
          >
            <ToggleGroupItem value="github" className="gap-2">
              <Github className="h-4 w-4" /> GitHub repo
            </ToggleGroupItem>
            <ToggleGroupItem value="url" className="gap-2">
              <Link2 className="h-4 w-4" /> Live URL
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="space-y-2">
            <Label htmlFor="source">
              {sourceType === "github" ? "Repository URL" : "Application URL"}
            </Label>
            <Input
              id="source"
              placeholder={
                sourceType === "github"
                  ? "github.com/your-org/your-repo"
                  : "https://app.yourcompany.com"
              }
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              disabled={analyzing}
            />
          </div>

          {!analyzing ? (
            <Button className="w-full" disabled={!sourceValue.trim()} onClick={startAnalysis}>
              Analyze &amp; generate test plan
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
              {ANALYSIS_STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  {i < stepIndex ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : i === stepIndex ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border" />
                  )}
                  <span
                    className={cn(
                      "text-muted-foreground",
                      i <= stepIndex && "text-foreground",
                    )}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
