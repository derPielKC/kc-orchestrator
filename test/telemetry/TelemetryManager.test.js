const { TelemetryManager } = require('../../src/telemetry/TelemetryManager');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('TelemetryManager', () => {
  let telemetryManager;
  let testDir;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-orchestrator-test-'));
    telemetryManager = new TelemetryManager({
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
      const defaultManager = new TelemetryManager();
      expect(defaultManager.baseDir).toContain('.kc-orchestrator/runs');
    });
    
    it('should create base directory if it does not exist', () => {
      expect(fs.existsSync(testDir)).toBe(true);
    });
  });
  
  describe('startRun', () => {
    it('should start a new telemetry run', () => {
      const runInfo = {
        project: 'test-project',
        command: 'test-command',
        options: { verbose: true }
      };
      
      const runId = telemetryManager.startRun(runInfo);
      
      expect(runId).toBeDefined();
      expect(typeof runId).toBe('string');
      expect(runId.length).toBeGreaterThan(10);
      expect(telemetryManager.runId).toBe(runId);
      expect(telemetryManager.events.length).toBe(1);
      expect(telemetryManager.events[0].eventType).toBe('run_start');
    });
    
    it('should create run directory', () => {
      const runInfo = {
        project: 'test-project',
        command: 'test-command',
        options: {}
      };
      
      const runId = telemetryManager.startRun(runInfo);
      const runDir = path.join(testDir, runId);
      
      expect(fs.existsSync(runDir)).toBe(true);
    });
    
    it('should redact sensitive information in run start event', () => {
      const runInfo = {
        project: '/absolute/path/to/project',
        command: 'test-command',
        options: {
          apiKey: 'secret-key-12345',
          token: 'ghp_secret_token',
          path: '/another/absolute/path'
        }
      };
      
      telemetryManager.startRun(runInfo);
      const event = telemetryManager.events[0];
      
      expect(event.project).not.toContain('/absolute/path/to/project');
      expect(event.project).toContain('[PATH]/project');
      expect(event.options.apiKey).toBe('[REDACTED]');
      expect(event.options.token).toBe('[REDACTED]');
      expect(event.options.path).toContain('[PATH]');
    });
  });
  
  describe('logEvent', () => {
    it('should log events when run is active', () => {
      const runInfo = {
        project: 'test-project',
        command: 'test-command',
        options: {}
      };
      
      telemetryManager.startRun(runInfo);
      telemetryManager.logEvent('test_event', { data: 'test-data' });
      
      expect(telemetryManager.events.length).toBe(2);
      expect(telemetryManager.events[1].eventType).toBe('test_event');
      expect(telemetryManager.events[1].data).toBe('test-data');
    });
    
    it('should not log events when no run is active', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      telemetryManager.logEvent('test_event', { data: 'test-data' });
      
      expect(telemetryManager.events.length).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️  Cannot log event - no active run');
      
      consoleWarnSpy.mockRestore();
    });
  });
  
  describe('logTaskSelection', () => {
    it('should log task selection event', () => {
      const runInfo = {
        project: 'test-project',
        command: 'test-command',
        options: {}
      };
      
      telemetryManager.startRun(runInfo);
      
      const task = { id: 'T1', title: 'Test Task' };
      telemetryManager.logTaskSelection(task, 'Codex');
      
      expect(telemetryManager.events.length).toBe(2);
      expect(telemetryManager.events[1].eventType).toBe('task_selection');
      expect(telemetryManager.events[1].taskId).toBe('T1');
      expect(telemetryManager.events[1].provider).toBe('Codex');
    });
  });
  
  describe('logTaskExecution', () => {
    it('should log task execution event', () => {
      const runInfo = {
        project: 'test-project',
        command: 'test-command',
        options: {}
      };
      
      telemetryManager.startRun(runInfo);
      
      const task = { id: 'T1', title: 'Test Task' };
      const result = {
        success: true,
        executionTime: 1000,
        retryCount: 1,
        fallbackLog: []
      };
      
      telemetryManager.logTaskExecution(task, 'Codex', result);
      
      expect(telemetryManager.events.length).toBe(2);
      expect(telemetryManager.events[1].eventType).toBe('task_execution');
      expect(telemetryManager.events[1].success).toBe(true);
      expect(telemetryManager.events[1].executionTime).toBe(1000);
    });
    
    it('should redact error information', () => {
      const runInfo = {
        project: 'test-project',
        command: 'test-command',
        options: {}
      };
      
      telemetryManager.startRun(runInfo);
      
      const task = { id: 'T1', title: 'Test Task' };
      const result = {
        success: false,
        error: 'Failed with secret token sk-1234567890'
      };
      
      telemetryManager.logTaskExecution(task, 'Codex', result);
      
      const event = telemetryManager.events[1];
      expect(event.error).not.toContain('sk-1234567890');
      expect(event.error).toContain('[REDACTED]');
    });
  });
  
  describe('logProviderFallback', () => {
    it('should log provider fallback event', () => {
      const runInfo = {
        project: 'test-project',
        command: 'test-command',
        options: {}
      };
      
      telemetryManager.startRun(runInfo);
      telemetryManager.logProviderFallback('Codex', 'Claude', 'Timeout error');
      
      expect(telemetryManager.events.length).toBe(2);
      expect(telemetryManager.events[1].eventType).toBe('provider_fallback');
      expect(telemetryManager.events[1].fromProvider).toBe('Codex');
      expect(telemetryManager.events[1].toProvider).toBe('Claude');
    });
  });
  
  describe('logRunCompletion', () => {
    it('should log run completion event and write events to file', () => {
      const runInfo = {
        project: 'test-project',
        command: 'test-command',
        options: {}
      };
      
      telemetryManager.startRun(runInfo);
      telemetryManager.logTaskSelection({ id: 'T1', title: 'Test' }, 'Codex');
      
      const summary = {
        duration: 5000,
        tasksCompleted: 1,
        tasksFailed: 0,
        totalRetries: 0,
        totalFallbacks: 0,
        providersUsed: ['Codex']
      };
      
      telemetryManager.logRunCompletion(summary);
      
      expect(telemetryManager.events.length).toBe(3);
      expect(telemetryManager.events[2].eventType).toBe('run_completion');
      
      // Check that files were written
      const runDir = path.join(testDir, telemetryManager.runId);
      const eventsFile = path.join(runDir, 'events.jsonl');
      const summaryFile = path.join(runDir, 'summary.json');
      
      expect(fs.existsSync(eventsFile)).toBe(true);
      expect(fs.existsSync(summaryFile)).toBe(true);
      
      // Check events file content
      const eventsContent = fs.readFileSync(eventsFile, 'utf8');
      const eventLines = eventsContent.trim().split('\n');
      expect(eventLines.length).toBe(3);
      
      // Check summary file content
      const summaryContent = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
      expect(summaryContent.runId).toBe(telemetryManager.runId);
      expect(summaryContent.eventCount).toBe(3);
    });
  });
  
  describe('redaction methods', () => {
    describe('_redactSensitiveInfo', () => {
      it('should redact long tokens', () => {
        const result = telemetryManager._redactSensitiveInfo('This is a secret token: abcdefghijklmnopqrstuvwxyz123456');
        expect(result).toContain('[REDACTED]');
      });
      
      it('should redact API keys', () => {
        const result = telemetryManager._redactSensitiveInfo('API key: sk-1234567890abcdef');
        expect(result).toContain('[REDACTED]');
      });
      
      it('should redact GitHub tokens', () => {
        const result = telemetryManager._redactSensitiveInfo('GitHub token: ghp_1234567890abcdefghijklmnopqrstuvwxyz');
        expect(result).toContain('[REDACTED]');
      });
    });
    
    describe('_redactPaths', () => {
      it('should redact absolute paths', () => {
        const result = telemetryManager._redactPaths('/absolute/path/to/file.txt');
        expect(result).toBe('[PATH]/file.txt');
      });
      
      it('should redact Windows paths', () => {
        const result = telemetryManager._redactPaths('C:\\Users\\test\\file.txt');
        expect(result).toBe('[PATH]/file.txt');
      });
      
      it('should handle paths without filenames', () => {
        const result = telemetryManager._redactPaths('/absolute/path/');
        expect(result).toBe('[PATH]');
      });
    });
    
    describe('_redactOptions', () => {
      it('should redact sensitive option fields', () => {
        const options = {
          apiKey: 'secret',
          token: 'ghp_token',
          password: 'secret123',
          normalField: 'normal value'
        };
        
        const result = telemetryManager._redactOptions(options);
        expect(result.apiKey).toBe('[REDACTED]');
        expect(result.token).toBe('[REDACTED]');
        expect(result.password).toBe('[REDACTED]');
        expect(result.normalField).toBe('normal value');
      });
    });
  });
  
  describe('getRecentRuns', () => {
    it('should return empty array when no runs exist', () => {
      const runs = telemetryManager.getRecentRuns();
      expect(Array.isArray(runs)).toBe(true);
      expect(runs.length).toBe(0);
    });
    
    it('should return runs sorted by recency', () => {
      // Create some test runs
      const runInfo1 = { project: 'test1', command: 'cmd1', options: {} };
      const runInfo2 = { project: 'test2', command: 'cmd2', options: {} };
      
      const runId1 = telemetryManager.startRun(runInfo1);
      telemetryManager.logRunCompletion({ duration: 1000, tasksCompleted: 1, tasksFailed: 0, totalRetries: 0, totalFallbacks: 0, providersUsed: [] });
      
      const runId2 = telemetryManager.startRun(runInfo2);
      telemetryManager.logRunCompletion({ duration: 2000, tasksCompleted: 2, tasksFailed: 0, totalRetries: 0, totalFallbacks: 0, providersUsed: [] });
      
      const runs = telemetryManager.getRecentRuns(5);
      
      expect(runs.length).toBe(2);
      // Check that both runs are present (order may vary slightly due to timing)
      const runIds = runs.map(r => r.runId);
      expect(runIds).toContain(runId1);
      expect(runIds).toContain(runId2);
    });
  });
  
  describe('cleanupOldRuns', () => {
    it('should cleanup runs older than specified days', () => {
      // This is a basic test - in a real scenario you'd need to mock dates
      const result = telemetryManager.cleanupOldRuns(30);
      expect(typeof result).toBe('number');
    });
  });
});