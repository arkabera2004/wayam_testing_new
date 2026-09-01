import { notFound } from "next/navigation";

import { getTestCase } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { TestDetail } from "./test-detail";

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string; testId: string }>;
}) {
  const { id, testId } = await params;
  const userId = await currentUserId();

  const test = await getTestCase(userId, testId);
  if (!test) notFound();

  return <TestDetail id={id} test={test} />;
}
