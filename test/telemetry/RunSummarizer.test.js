const { RunSummarizer } = require('../../src/telemetry/RunSummarizer');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('RunSummarizer', () => {
  let runSummarizer;
  let testDir;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-orchestrator-test-'));
    runSummarizer = new RunSummarizer({
      baseDir: testDir,
      verbose: false
    });
  });
  
  afterEach(() => {
    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('constructor', () => {
    it('should initialize with default base directory', () => {
      const defaultSummarizer = new RunSummarizer();
      expect(defaultSummarizer.baseDir).toContain('.kc-orchestrator/runs');
    });
  });
  
  describe('generateSummaryReport', () => {
    it('should return empty result when no runs exist', () => {
      const result = runSummarizer.generateSummaryReport(5);
      
      expect(result.runsAnalyzed).toBe(0);
      expect(result.summary).toBe('No runs found to analyze');
      expect(result.painPoints).toEqual([]);
    });
    
    it('should generate report with proper structure', () => {
      // Create test run structure
      const runId = 'test-run-1';
      const runDir = path.join(testDir, runId);
      fs.mkdirSync(runDir, { recursive: true });
      
      // Create summary.json
      const summary = {
        runId: runId,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        eventCount: 3,
        eventTypes: ['run_start', 'task_execution', 'run_completion']
      };
      fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
      
      // Create events.jsonl
      const events = [
        {
          eventType: 'run_start',
          timestamp: new Date().toISOString(),
          runId: runId,
          project: 'test-project',
          command: 'test-command'
        },
        {
          eventType: 'task_execution',
          timestamp: new Date().toISOString(),
          runId: runId,
          taskId: 'T1',
          taskTitle: 'Test Task',
          provider: 'Codex',
          success: true,
          executionTime: 1000,
          retryCount: 0,
          fallbackCount: 0
        },
        {
          eventType: 'run_completion',
          timestamp: new Date().toISOString(),
          runId: runId,
          duration: 5000,
          tasksCompleted: 1,
          tasksFailed: 0,
          totalRetries: 0,
          totalFallbacks: 0,
          providersUsed: ['Codex']
        }
      ];
      
      const eventLines = events.map(event => JSON.stringify(event));
      fs.writeFileSync(path.join(runDir, 'events.jsonl'), eventLines.join('\n') + '\n', 'utf8');
      
      const result = runSummarizer.generateSummaryReport(5);
      
      expect(result.runsAnalyzed).toBe(1);
      expect(result.summary).toBeDefined();
      expect(result.markdownReport).toContain('# Orchestrator Run Analysis Report');
      expect(result.painPoints).toEqual([]); // No pain points in this test data
    });
  });
  
  describe('_getRecentRunsWithEvents', () => {
    it('should return empty array when no runs exist', () => {
      const runs = runSummarizer._getRecentRunsWithEvents(5);
      expect(Array.isArray(runs)).toBe(true);
      expect(runs.length).toBe(0);
    });
    
    it('should return runs with events', () => {
      // Create test run structure
      const runId = 'test-run-1';
      const runDir = path.join(testDir, runId);
      fs.mkdirSync(runDir, { recursive: true });
      
      // Create summary.json
      const summary = {
        runId: runId,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        eventCount: 2,
        eventTypes: ['run_start', 'run_completion']
      };
      fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
      
      // Create events.jsonl
      const events = [
        {
          eventType: 'run_start',
          timestamp: new Date().toISOString(),
          runId: runId,
          project: 'test-project'
        },
        {
          eventType: 'run_completion',
          timestamp: new Date().toISOString(),
          runId: runId,
          duration: 1000
        }
      ];
      
      const eventLines = events.map(event => JSON.stringify(event));
      fs.writeFileSync(path.join(runDir, 'events.jsonl'), eventLines.join('\n') + '\n', 'utf8');
      
      const runs = runSummarizer._getRecentRunsWithEvents(5);
      
      expect(runs.length).toBe(1);
      expect(runs[0].runId).toBe(runId);
      expect(runs[0].events.length).toBe(2);
    });
  });
  
  describe('_analyzeRuns', () => {
    it('should analyze runs and identify patterns', () => {
      const runs = [
        {
          runId: 'test-run-1',
          summary: {},
          events: [
            {
              eventType: 'task_execution',
              taskId: 'T1',
              taskTitle: 'Test Task 1',
              provider: 'Codex',
              success: true,
              executionTime: 1000,
              retryCount: 0,
              fallbackCount: 0
            },
            {
              eventType: 'task_execution',
              taskId: 'T2',
              taskTitle: 'Test Task 2',
              provider: 'Claude',
              success: false,
              executionTime: 2000,
              retryCount: 2,
              fallbackCount: 1,
              error: 'Timeout error'
            }
          ]
        }
      ];
      
      const summary = runSummarizer._analyzeRuns(runs);
      
      expect(summary.totalRuns).toBe(1);
      expect(summary.totalTasks).toBe(2);
      expect(summary.successfulTasks).toBe(1);
      expect(summary.failedTasks).toBe(1);
      expect(summary.totalExecutionTime).toBe(3000);
      expect(summary.totalRetries).toBe(2);
      expect(summary.totalFallbacks).toBe(1);
      expect(summary.providersUsed.size).toBe(2);
      expect(summary.providerStats.Codex.attempts).toBe(1);
      expect(summary.providerStats.Claude.attempts).toBe(1);
    });
    
    it('should identify high retry tasks', () => {
      const runs = [
        {
          runId: 'test-run-1',
          summary: {},
          events: [
            {
              eventType: 'task_execution',
              taskId: 'T1',
              taskTitle: 'High Retry Task',
              provider: 'Codex',
              success: true,
              executionTime: 5000,
              retryCount: 3,
              fallbackCount: 0
            }
          ]
        }
      ];
      
      const summary = runSummarizer._analyzeRuns(runs);
      
      expect(summary.highRetryTasks.length).toBe(1);
      expect(summary.highRetryTasks[0].taskId).toBe('T1');
      expect(summary.highRetryTasks[0].retries).toBe(3);
    });
    
    it('should identify long running tasks', () => {
      const runs = [
        {
          runId: 'test-run-1',
          summary: {},
          events: [
            {
              eventType: 'task_execution',
              taskId: 'T1',
              taskTitle: 'Long Running Task',
              provider: 'Codex',
              success: true,
              executionTime: 45000, // 45 seconds
              retryCount: 0,
              fallbackCount: 0
            }
          ]
        }
      ];
      
      const summary = runSummarizer._analyzeRuns(runs);
      
      expect(summary.longRunningTasks.length).toBe(1);
      expect(summary.longRunningTasks[0].taskId).toBe('T1');
      expect(summary.longRunningTasks[0].executionTime).toBe(45000);
    });
  });
  
  describe('_identifyPainPoints', () => {
    it('should identify high failure rate', () => {
      const summary = {
        totalTasks: 10,
        failedTasks: 3, // 30% failure rate
        totalRetries: 0,
        totalFallbacks: 0,
        providersUsed: new Set(['Codex']),
        providerStats: {
          Codex: { attempts: 10, successes: 7, failures: 3 }
        },
        failureReasons: {},
        highRetryTasks: [],
        longRunningTasks: [],
        frequentFallbacks: [],
        painPoints: []
      };
      
      runSummarizer._identifyPainPoints(summary);
      
      expect(summary.painPoints.length).toBe(1);
      expect(summary.painPoints[0].type).toBe('high_failure_rate');
      expect(summary.painPoints[0].severity).toBe('high');
    });
    
    it('should identify high retry count', () => {
      const summary = {
        totalTasks: 10,
        failedTasks: 0,
        totalRetries: 16, // 1.6 avg retries per task (> 1.5 threshold)
        totalFallbacks: 0,
        providersUsed: new Set(['Codex']),
        providerStats: {
          Codex: { attempts: 10, successes: 10, failures: 0 }
        },
        failureReasons: {},
        highRetryTasks: [],
        longRunningTasks: [],
        frequentFallbacks: [],
        painPoints: []
      };
      
      runSummarizer._identifyPainPoints(summary);
      
      expect(summary.painPoints.length).toBe(1);
      expect(summary.painPoints[0].type).toBe('high_retry_count');
      expect(summary.painPoints[0].severity).toBe('medium');
    });
    
    it('should identify frequent fallbacks', () => {
      const summary = {
        totalTasks: 10,
        failedTasks: 0,
        totalRetries: 0,
        totalFallbacks: 6, // 0.6 avg fallbacks per task
        providersUsed: new Set(['Codex', 'Claude']),
        providerStats: {
          Codex: { attempts: 10, successes: 4, failures: 6 },
          Claude: { attempts: 6, successes: 6, failures: 0 }
        },
        failureReasons: {},
        highRetryTasks: [],
        longRunningTasks: [],
        frequentFallbacks: [],
        painPoints: []
      };
      
      runSummarizer._identifyPainPoints(summary);
      
      expect(summary.painPoints.length).toBe(2); // frequent_fallbacks + provider_performance
      // Check that both pain points are present (order may vary due to sorting)
      const painPointTypes = summary.painPoints.map(p => p.type);
      expect(painPointTypes).toContain('frequent_fallbacks');
      expect(painPointTypes).toContain('provider_performance');
    });
  });
  
  describe('_generateMarkdownReport', () => {
    it('should generate markdown report with proper structure', () => {
      const summary = {
        totalRuns: 1,
        totalTasks: 2,
        successfulTasks: 1,
        failedTasks: 1,
        totalExecutionTime: 3000,
        totalRetries: 2,
        totalFallbacks: 1,
        providersUsed: new Set(['Codex', 'Claude']),
        providerStats: {
          Codex: { attempts: 1, successes: 1, failures: 0, totalExecutionTime: 1000, avgExecutionTime: 1000 },
          Claude: { attempts: 1, successes: 0, failures: 1, totalExecutionTime: 2000, avgExecutionTime: 2000 }
        },
        failureReasons: {
          timeout: 1
        },
        highRetryTasks: [],
        longRunningTasks: [],
        frequentFallbacks: [],
        painPoints: [
          {
            type: 'high_failure_rate',
            severity: 'high',
            description: 'High task failure rate (50.0%)',
            details: {
              failedTasks: 1,
              totalTasks: 2,
              failureRate: 0.5
            }
          }
        ]
      };
      
      const runs = [];
      const report = runSummarizer._generateMarkdownReport(summary, runs);
      
      expect(report).toContain('# Orchestrator Run Analysis Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Provider Performance');
      expect(report).toContain('## 🔴 Pain Points Identified');
      expect(report).toContain('High task failure rate (50.0%)');
    });
  });
  
  describe('writeSummaryReport', () => {
    it('should write summary report to file', () => {
      const report = '# Test Report\n\nThis is a test report.';
      const outputPath = path.join(testDir, 'test-report.md');
      
      const result = runSummarizer.writeSummaryReport(report, outputPath);
      
      expect(result).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
      
      const content = fs.readFileSync(outputPath, 'utf8');
      expect(content).toBe(report);
    });
  });
});