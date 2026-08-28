import type { Db } from "mongodb";

import type {
  ApiKeyDoc,
  DocTestRunDoc,
  IntegrationDoc,
  OrganizationDoc,
  OrganizationInviteDoc,
  OrganizationMemberDoc,
  PrdAnalysisDoc,
  ProjectDoc,
  RunResultDoc,
  SessionDoc,
  SyntheticDataRunDoc,
  TestCaseDoc,
  TestPlanDoc,
  TestRunDoc,
  TestScenarioDoc,
  TestSelectionRunDoc,
  UserDoc,
} from "./schema.ts";

/** Typed collection handles for a given Db. Kept as a plain function (not a
 * cached singleton) so tests can pass in an ephemeral in-memory Db and get
 * the exact same typing/behavior as production. */
export function collections(db: Db) {
  return {
    organizations: db.collection<OrganizationDoc>("organizations"),
    organizationMembers: db.collection<OrganizationMemberDoc>("organization_members"),
    users: db.collection<UserDoc>("users"),
    sessions: db.collection<SessionDoc>("sessions"),
    organizationInvites: db.collection<OrganizationInviteDoc>("organization_invites"),
    projects: db.collection<ProjectDoc>("projects"),
    testPlans: db.collection<TestPlanDoc>("test_plans"),
    testScenarios: db.collection<TestScenarioDoc>("test_scenarios"),
    testCases: db.collection<TestCaseDoc>("test_cases"),
    testRuns: db.collection<TestRunDoc>("test_runs"),
    runResults: db.collection<RunResultDoc>("run_results"),
    integrations: db.collection<IntegrationDoc>("integrations"),
    apiKeys: db.collection<ApiKeyDoc>("api_keys"),
    testSelectionRuns: db.collection<TestSelectionRunDoc>("test_selection_runs"),
    docTestRuns: db.collection<DocTestRunDoc>("doc_test_runs"),
    syntheticDataRuns: db.collection<SyntheticDataRunDoc>("synthetic_data_runs"),
    prdAnalyses: db.collection<PrdAnalysisDoc>("prd_analyses"),
  };
}
