import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

import { ProjectSourcePicker } from "@/components/project-source-picker";
import { Button } from "@/components/ui";
import { project } from "@/lib/demo-data";

/**
 * Fullscreen modal-style route. Reuses the onboarding source picker so the
 * two entry points cannot drift apart.
 */
export default function NewProjectPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-primary">New project</h1>
          <p className="text-body-md text-tertiary mt-1.5">
            Point Parikshan at an application and it will explore, plan and generate the suite.
          </p>
        </div>
        <Link
          href="/projects"
          aria-label="Close"
          className="icon-tertiary hover:icon-secondary hover:bg-raised grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-[170ms]"
        >
          <X size={16} aria-hidden="true" />
        </Link>
      </div>

      <ProjectSourcePicker showAdvanced />

      <div className="border-muted flex items-center justify-between border-t pt-5">
        <Link href="/projects">
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Link href={`/projects/${project.id}/discovery`}>
          <Button variant="primary" icon={ArrowRight}>
            Start discovery
          </Button>
        </Link>
      </div>
    </div>
  );
}
