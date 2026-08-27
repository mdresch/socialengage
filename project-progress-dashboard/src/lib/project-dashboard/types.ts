export type AdrStatus = 'Accepted' | 'Proposed' | 'Draft' | 'Unknown';

export interface AdrItem {
  id: string;
  num: number;
  title: string;
  status: string;
  cluster: string;
  file: string;
  storyRefs: string[];
}

export interface BrdItem {
  id: string;
  num: number;
  title: string;
  status: string;
  pillar: string;
  file: string;
}

export interface FddItem {
  id: string;
  num: number;
  title: string;
  status: string;
  file: string;
  conformance: '100% (14/14 sections)';
}

export interface StoryItem {
  storyId: string;
  epicId: string;
  epicTitle: string;
  title: string;
  source: string;
  status: string;
  isBuilt: boolean;
  isRetired?: boolean;
  isRelocated?: boolean;
  builtInfo?: string;
}

export interface EpicSummary {
  id: string;
  title: string;
  file: string;
  total: number;
  built: number;
  pending: number;
  progressPct: number;
}

export type EpicSummaryItem = EpicSummary;

export interface TestContractItem {
  id: string;
  fileName: string;
  filePath: string;
  fullRelPath: string;
  repo: string;
  domain: string;
  linesOfCode: number;
  loc: number;
  testCount: number;
  status: string;
  executionTimeMs: number;
  durationMs: number;
  storyRef?: string;
  adrRef?: string;
}

export interface PackageCoverageDetail {
  repo: string;
  name: string;
  totalSuites: number;
  totalTests: number;
  statementsPct: number;
  branchesPct: number;
  functionsPct: number;
  linesPct: number;
  coveredStatements: number;
  totalStatements: number;
  coveredBranches: number;
  totalBranches: number;
  coveredFunctions: number;
  totalFunctions: number;
  coveredLines: number;
  totalLines: number;
  testLoc: number;
  description: string;
}

export interface MonorepoCoverage {
  overallStatementsPct: number;
  overallBranchesPct: number;
  overallFunctionsPct: number;
  overallLinesPct: number;
  totalSuites: number;
  totalTests: number;
  totalTestLoc: number;
  packages: PackageCoverageDetail[];
}

export interface CodebaseMetrics {
  coreSrcFiles: number;
  coreSrcLoc: number;
  coreTestFiles: number;
  coreTestLoc: number;
  coreMigrationFiles: number;
  coreMigrationLoc: number;
  adminSrcFiles: number;
  adminSrcLoc: number;
  adminTestFiles: number;
  adminTestLoc: number;
  totalFiles: number;
  totalLoc: number;
  coreCodeLoc?: number;
  adminCodeLoc?: number;
}
