import { readDatabase } from '../storage/database.js';
import type { DashboardStats, RecentCheckItem } from '../types/index.js';

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const db = await readDatabase();
  const checks = [...db.checks].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const latestCheck = checks[0];
  const pendingFixIssues = db.results.reduce((total, result) => total + result.issues.length, 0);

  return {
    totalTemplates: db.templates.length,
    recentCheckCount: checks.length,
    lastCheckTime: latestCheck?.createdAt ?? '',
    pendingFixIssues,
  };
};

export const getRecentChecks = async (): Promise<RecentCheckItem[]> => {
  const db = await readDatabase();
  const uploadedFilesById = new Map(db.uploadedFiles.map((file) => [file.id, file]));

  return [...db.checks]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 10)
    .map((check) => ({
      id: check.id,
      name: uploadedFilesById.get(check.paperId)?.filename ?? 'Unknown file',
      time: check.createdAt,
      status: check.status,
      issues: check.totalIssues,
    }));
};
