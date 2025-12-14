/**
 * Native Agent Lightning Types
 * TypeScript interfaces for Agent Lightning data structures
 */

export interface RunEvent {
  runId: string;
  timestamp: string;
  eventType: 'start' | 'end' | 'error' | 'warning' | 'info' | 'metric';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
  data?: any;
  durationMs?: number;
  success?: boolean;
  retryCount?: number;
  provider?: string;
  taskId?: string;
}

export interface TelemetryData {
  runs: RunEvent[];
  statistics: {
    totalRuns: number;
    successRate: number;
    failureRate: number;
    avgDurationMs: number;
    maxDurationMs: number;
    minDurationMs: number;
  };
  providers: {
    [provider: string]: {
      usageCount: number;
      successRate: number;
      avgDurationMs: number;
    };
  };
}

export interface PatternDetectionResult {
  patternType: 'failure' | 'retry' | 'performance' | 'anomaly';
  severity: 'low' | 'medium' | 'high';
  description: string;
  occurrences: number;
  affectedRuns: string[];
  metrics: {
    avgImpact?: number;
    maxImpact?: number;
    frequency?: number;
  };
  evidence: any[];
}

export interface PainPoint {
  id: string;
  type: 'reliability' | 'performance' | 'usability' | 'maintenance';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: 'minor' | 'moderate' | 'major' | 'critical';
  category: string;
  metrics: {
    occurrenceRate?: number;
    affectedUsers?: number;
    businessImpact?: number;
    technicalDebt?: number;
  };
  evidence: PatternDetectionResult[];
  firstSeen: string;
  lastSeen: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: 'reliability' | 'performance' | 'usability' | 'maintenance' | 'security';
  impact: 'minor' | 'moderate' | 'major' | 'critical';
  effort: 'S' | 'M' | 'L' | 'XL';
  implementation: string;
  acceptanceCriteria?: string[];
  constraints?: {
    do?: string[];
    dont?: string[];
  };
  metadata?: {
    source?: string;
    generatedAt?: string;
    relatedTasks?: string[];
    contentHash?: string;
  };
}

export interface AnalysisOptions {
  minSeverity?: 'low' | 'medium' | 'high';
  timeWindowDays?: number;
  maxRecommendations?: number;
  includeExperimental?: boolean;
  detailedAnalysis?: boolean;
  performanceThresholds?: {
    highLatencyMs?: number;
    highFailureRate?: number;
    highRetryRate?: number;
  };
}

export interface NativeAgentLightningConfig {
  mode: 'native' | 'external' | 'hybrid';
  external?: {
    cliPath: string;
    timeoutMs: number;
  };
  native?: {
    maxMemoryMb?: number;
    maxExecutionTimeMs?: number;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

export interface AnalysisResult {
  telemetryData: TelemetryData;
  patterns: PatternDetectionResult[];
  painPoints: PainPoint[];
  recommendations: Recommendation[];
  statistics: {
    analysisDurationMs: number;
    patternsDetected: number;
    painPointsIdentified: number;
    recommendationsGenerated: number;
    memoryUsageMb: number;
  };
  metadata: {
    timestamp: string;
    version: string;
    mode: 'native' | 'external';
  };
}

export interface HealthCheckResult {
  healthy: boolean;
  mode: 'native' | 'external' | 'hybrid';
  version: string;
  timestamp: string;
  issues?: string[];
  warnings?: string[];
  performance?: {
    avgAnalysisTimeMs?: number;
    memoryUsageMb?: number;
  };
}

export type AnalysisMode = 'native' | 'external' | 'hybrid';

export interface MigrationOptions {
  dryRun?: boolean;
  backup?: boolean;
  validate?: boolean;
  verbose?: boolean;
}