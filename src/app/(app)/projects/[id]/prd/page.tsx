import Link from "next/link";
import { FileText, Plus, TriangleAlert } from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  Chip,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { Icon3D } from "@/components/ui/icon-3d";
import { notFound } from "next/navigation";

import { currentUserId } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { listPrdDocuments, resolveProject } from "@/db/queries";

export default async function PrdListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const rows = await listPrdDocuments(userId, project.id);

  // The table was written against a demo shape; map once here rather than
  // rewriting every cell. "analysed" is the spelling the markup checks.
  const prdDocuments = rows.map((d) => ({
    id: d.id,
    title: d.name,
    source: d.body ? "Pasted" : "Uploaded",
    words: d.words,
    requirements: d.requirements,
    cases: d.cases,
    ambiguities: d.ambiguities,
    analysed: d.uploadedAt ? relativeTime(d.uploadedAt) : "",
    status: d.status === "analyzed" ? ("analysed" as const) : (d.status ?? "analyzing"),
  }));

  return (
    <PageBody>
      <PageHeader
        title="Requirements"
        description="Upload an SRS, user stories, or Jira export. Parikshan extracts requirements, runs requirement intelligence, and proposes traced test scenarios - before or after the app exists."
        actions={
          <Link href={`/projects/${id}/prd/new`}>
            <Button variant="primary" icon={Plus}>
              Analyse requirements
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Documents analysed" value="2" />
        <StatCard label="Requirements extracted" value="24" delta="+10" deltaTone="success" />
        <StatCard label="Test cases proposed" value="32" delta="+13" deltaTone="success" />
        <StatCard label="Ambiguities flagged" value="6" delta="needs review" deltaTone="error" />
      </div>

      <Card padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Document</Th>
              <Th>Source</Th>
              <Th className="text-right">Requirements</Th>
              <Th className="text-right">Cases</Th>
              <Th>Ambiguities</Th>
              <Th>Analysed</Th>
            </tr>
          </thead>
          <tbody>
            {prdDocuments.map((doc) => (
              <tr key={doc.id} className="hover:bg-raised transition-colors duration-[170ms]">
                <Td>
                  <Link
                    href={
                      doc.status === "analysed"
                        ? `/projects/${id}/prd/${doc.id}`
                        : `/projects/${id}/prd/new`
                    }
                    className="flex items-center gap-2.5"
                  >
                    <span className="bg-raised icon-tertiary grid h-7 w-7 shrink-0 place-items-center rounded-lg">
                      <FileText size={14} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="text-label-md text-primary block truncate">{doc.title}</span>
                      <span className="text-caption text-quaternary tabular block">
                        {doc.words.toLocaleString()} words
                      </span>
                    </span>
                  </Link>
                </Td>
                <Td>
                  <Chip>{doc.source}</Chip>
                </Td>
                <Td className="tabular text-right">{doc.requirements}</Td>
                <Td className="tabular text-right">
                  {doc.status === "analysed" ? (
                    doc.cases
                  ) : (
                    <span className="text-quaternary">-</span>
                  )}
                </Td>
                <Td>
                  {doc.status !== "analysed" ? (
                    <Chip>Not analysed</Chip>
                  ) : doc.ambiguities > 0 ? (
                    <Chip tone="warning">
                      <TriangleAlert size={11} aria-hidden="true" />
                      {doc.ambiguities}
                    </Chip>
                  ) : (
                    <Chip tone="success">None</Chip>
                  )}
                </Td>
                <Td className="text-quaternary whitespace-nowrap">{doc.analysed}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <Icon3D name="prd-traceability" size={64} />
          <div>
            <p className="text-heading-sm text-primary">
              Requirements vs application - and the reconcile layer
            </p>
            <p className="text-body-md text-tertiary mt-1.5 max-w-3xl">
              Requirements describe what the application <em>should</em> do. Exploration discovers
              what it <em>actually</em> does. Parikshan reconciles both: missing functionality,
              uncovered requirements, incorrect behavior, and the tests still needed to close the gap.
            </p>
          </div>
        </div>
      </Card>
    </PageBody>
  );
}
