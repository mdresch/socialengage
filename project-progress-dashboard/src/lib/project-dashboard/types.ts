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
}

