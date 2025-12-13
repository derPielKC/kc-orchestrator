/**
 * Task Execution Engine Recovery Tests
 * 
 * Comprehensive tests for error recovery and checkpointing functionality
 */

const { TaskExecutionEngine, TaskExecutionError } = require('../src/engine');
const { ProviderManager } = require('../src/providers/ProviderManager');
const { readGuide } = require('../src/config');
const fs = require('fs');
const path = require('path');

// Mock data
const mockGuide = {
  "project": "test-project",
  "phases": [
    {
      "id": "phase1",
      "name": "Phase 1",
      "order": 1,
      "tasks": ["T1", "T2", "T3"]
    }
  ],
  "tasks": [
    {
      "id": "T1",
      "title": "Task 1",
      "status": "todo",
      "order": 1,
      "description": "First task",
      "acceptanceCriteria": ["Criteria 1"]
    },
    {
      "id": "T2",
      "title": "Task 2",
      "status": "todo",
      "order": 2,
      "description": "Second task",
      "acceptanceCriteria": ["Criteria 2"]
    },
    {
      "id": "T3",
      "title": "Task 3",
      "status": "todo",
      "order": 3,
      "description": "Third task",
      "acceptanceCriteria": ["Criteria 3"]
    }
  ]
};

const testGuidePath = path.join(__dirname, 'test-guide-recovery.json');
const checkpointDir = path.join(__dirname, '.kc-orchestrator', 'checkpoints');

describe('TaskExecutionEngine Error Recovery', () => {
  let engine;
  let originalConsoleLog;
  let originalConsoleError;
  
  beforeAll(() => {
    // Mock console methods to suppress output during tests
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();
  });
  
  afterAll(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });
  
  beforeEach(() => {
    // Create test guide file
    fs.writeFileSync(testGuidePath, JSON.stringify(mockGuide, null, 2));
    
    engine = new TaskExecutionEngine({
      guidePath: testGuidePath,
      verbose: false,
      maxRetries: 2,
      taskTimeout: 10000
    });
  });
  
  afterEach(() => {
    // Clean up test guide file
    try {
      fs.unlinkSync(testGuidePath);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clean up checkpoint directory in both test and project root
    try {
      const checkpointDirs = [
        checkpointDir,
        path.join(__dirname, '..', '.kc-orchestrator', 'checkpoints')
      ];
      
      for (const dir of checkpointDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if (file.startsWith('checkpoint-') && file.endsWith('.json')) {
              fs.unlinkSync(path.join(dir, file));
            }
          }
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clear mocks
    jest.clearAllMocks();
  });

  describe('Error Classification', () => {
    test('should classify transient errors correctly', () => {
      const transientErrors = [
        new Error('Connection timeout'),
        new Error('Network error occurred'),
        new Error('Rate limit exceeded'),
        new Error('Temporary failure'),
        new Error('Service unavailable'),
        new Error('Connection refused')
      ];
      
      transientErrors.forEach(error => {
        expect(engine.classifyError(error)).toBe('transient');
      });
    });

    test('should classify configuration errors correctly', () => {
      const configErrors = [
        new Error('Configuration file not found'),
        new Error('Invalid configuration setting'),
        new Error('Environment variable missing'),
        new Error('Setup incomplete'),
        new Error('Permission denied'),
        new Error('Access denied')
      ];
      
      configErrors.forEach(error => {
        expect(engine.classifyError(error)).toBe('configuration');
      });
    });

    test('should classify permanent errors correctly', () => {
      const permanentErrors = [
        new Error('File not found'),
        new Error('Invalid input data'),
        new Error('Corrupt database'),
        new Error('Missing dependency'),
        new Error('Fatal error occurred'),
        new Error('Critical error in module')
      ];
      
      permanentErrors.forEach(error => {
        expect(engine.classifyError(error)).toBe('permanent');
      });
    });

    test('should classify unknown errors as unknown', () => {
      const unknownErrors = [
        new Error('Something went wrong'),
        new Error('Unexpected error'),
        new Error('Generic failure')
      ];
      
      unknownErrors.forEach(error => {
        expect(engine.classifyError(error)).toBe('unknown');
      });
    });
  });

  describe('Retry Logic', () => {
    test('should not retry permanent errors', () => {
      const permanentError = new Error('Fatal error occurred');
      
      expect(engine.shouldRetry(permanentError, 0)).toBe(false);
      expect(engine.shouldRetry(permanentError, 1)).toBe(false);
    });

    test('should retry transient errors up to max retries', () => {
      const transientError = new Error('Connection timeout');
      
      expect(engine.shouldRetry(transientError, 0)).toBe(true);
      expect(engine.shouldRetry(transientError, 1)).toBe(true);
      expect(engine.shouldRetry(transientError, 2)).toBe(true);
      expect(engine.shouldRetry(transientError, 3)).toBe(false); // At max retries
    });

    test('should retry configuration errors only a few times', () => {
      const configError = new Error('Configuration file not found');
      
      expect(engine.shouldRetry(configError, 0)).toBe(true);
      expect(engine.shouldRetry(configError, 1)).toBe(true);
      expect(engine.shouldRetry(configError, 2)).toBe(false); // Only 2 retries for config
    });

    test('should retry unknown errors with standard retry logic', () => {
      const unknownError = new Error('Something went wrong');
      
      expect(engine.shouldRetry(unknownError, 0)).toBe(true);
      expect(engine.shouldRetry(unknownError, 1)).toBe(true);
      expect(engine.shouldRetry(unknownError, 2)).toBe(true);
      expect(engine.shouldRetry(unknownError, 3)).toBe(false);
    });
  });

  describe('Exponential Backoff', () => {
    test('should calculate exponential backoff delays', () => {
      expect(engine.getRetryDelay(0)).toBe(1000); // 1s
      expect(engine.getRetryDelay(1)).toBe(2000); // 2s
      expect(engine.getRetryDelay(2)).toBe(4000); // 4s
      expect(engine.getRetryDelay(3)).toBe(8000); // 8s
      expect(engine.getRetryDelay(4)).toBe(16000); // 16s
      expect(engine.getRetryDelay(5)).toBe(30000); // Max 30s
      expect(engine.getRetryDelay(10)).toBe(30000); // Still max 30s
    });
  });

  describe('Checkpointing', () => {
    test('should save and load checkpoints', async () => {
      const checkpointData = {
        currentTaskIndex: 1,
        completedTasks: 1,
        failedTasks: 0,
        tasks: mockGuide.tasks.map(t => ({ id: t.id, status: 'todo' }))
      };
      
      const checkpointPath = await engine.saveCheckpoint(checkpointData);
      expect(checkpointPath).toContain('checkpoint-');
      expect(checkpointPath).toContain('.json');
      
      const loadedCheckpoint = await engine.loadCheckpoint(checkpointPath);
      expect(loadedCheckpoint.currentTaskIndex).toBe(1);
      expect(loadedCheckpoint.completedTasks).toBe(1);
      expect(loadedCheckpoint.failedTasks).toBe(0);
      expect(loadedCheckpoint.tasks).toHaveLength(3);
    });

    test('should find latest checkpoint', async () => {
      // Save multiple checkpoints with different timestamps
      const checkpoint1 = {
        currentTaskIndex: 0,
        completedTasks: 0,
        failedTasks: 0
      };
      
      const checkpoint2 = {
        currentTaskIndex: 1,
        completedTasks: 1,
        failedTasks: 0
      };
      
      await engine.saveCheckpoint(checkpoint1);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const checkpoint2Path = await engine.saveCheckpoint(checkpoint2);
      
      const latestCheckpoint = await engine.findLatestCheckpoint();
      expect(latestCheckpoint).toBe(checkpoint2Path);
    });

    test('should return null when no checkpoints exist', async () => {
      const latestCheckpoint = await engine.findLatestCheckpoint();
      expect(latestCheckpoint).toBeNull();
    });

    test('should handle checkpoint directory creation', async () => {
      const checkpointData = {
        currentTaskIndex: 0,
        completedTasks: 0,
        failedTasks: 0
      };
      
      const checkpointPath = await engine.saveCheckpoint(checkpointData);
      expect(fs.existsSync(path.dirname(checkpointPath))).toBe(true);
    });
  });

  describe('Manual Intervention', () => {
    test('should request manual intervention for configuration errors', async () => {
      const configError = new Error('Configuration file not found');
      const task = mockGuide.tasks[0];
      
      // Clear execution log first
      engine.clearExecutionLog();
      
      // Temporarily disable non-interactive mode for this test
      const originalNonInteractive = process.env.NON_INTERACTIVE;
      const originalCi = process.env.CI;
      delete process.env.NON_INTERACTIVE;
      delete process.env.CI;
      
      const shouldContinue = await engine.requestManualIntervention(configError, task);
      expect(shouldContinue).toBe(true); // Always continues for now
      
      const logEntries = engine.getExecutionLog();
      const hasManualInterventionLog = logEntries.some(e => 
        e.level === 'error' && e.message.includes('Manual intervention required')
      );
      expect(hasManualInterventionLog).toBe(true);
      
      // Restore environment variables
      if (originalNonInteractive) {
        process.env.NON_INTERACTIVE = originalNonInteractive;
      }
      if (originalCi) {
        process.env.CI = originalCi;
      }
    });

    test('should handle non-interactive mode', async () => {
      const originalNonInteractive = process.env.NON_INTERACTIVE;
      process.env.NON_INTERACTIVE = 'true';
      
      const error = new Error('Test error');
      const task = mockGuide.tasks[0];
      
      const shouldContinue = await engine.requestManualIntervention(error, task);
      expect(shouldContinue).toBe(true);
      
      const logEntries = engine.getExecutionLog();
      expect(logEntries.some(e => e.level === 'warn' && e.message.includes('non-interactive mode'))).toBe(true);
      
      // Restore original value
      if (originalNonInteractive) {
        process.env.NON_INTERACTIVE = originalNonInteractive;
      } else {
        delete process.env.NON_INTERACTIVE;
      }
    });
  });

  describe('Execution with Recovery', () => {
    test('should resume execution from checkpoint', async () => {
      // Mock provider manager to succeed for all tasks
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      // First, execute one task to create a checkpoint
      const tasks = await engine.getTasksForExecution();
      await engine.executeTask(tasks[0]);
      
      // Save checkpoint after first task
      const checkpointPath = await engine.saveCheckpoint({
        currentTaskIndex: 1,
        completedTasks: 1,
        failedTasks: 0,
        tasks: tasks.map(t => ({ id: t.id, status: t.status }))
      });
      
      // Reset engine to simulate restart
      engine = new TaskExecutionEngine({
        guidePath: testGuidePath,
        verbose: false,
        maxRetries: 2,
        taskTimeout: 10000
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      // Resume execution from checkpoint
      const result = await engine.executeAllTasksWithRecovery({
        resume: true,
        checkpointPath: checkpointPath
      });
      
      expect(result.recoveredFromCheckpoint).toBe(true);
      expect(result.totalTasks).toBe(3);
      expect(result.completed).toBe(3); // Should complete remaining 2 tasks
      expect(result.failed).toBe(0);
    });

    test('should handle task failures with smart retry logic', async () => {
      const tasks = await engine.getTasksForExecution();
      const task = tasks[0];
      
      // Mock provider manager to fail with transient error, then succeed
      let attempt = 0;
      const mockExecute = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt <= 2) {
          throw new Error('Connection timeout'); // Transient error
        }
        return Promise.resolve({ provider: 'test-provider', output: 'success' });
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      const result = await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      expect(result.completed).toBe(1); // First task should succeed after retry
      expect(result.failed).toBe(2); // Other tasks should fail (no mock for them)
    });

    test('should not retry permanent errors', async () => {
      const tasks = await engine.getTasksForExecution();
      
      // Mock provider manager to fail with permanent error
      const mockExecute = jest.fn().mockRejectedValue(new Error('Fatal error occurred'));
      engine.providerManager.executeWithFallback = mockExecute;
      
      const result = await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      expect(result.completed).toBe(0);
      expect(result.failed).toBe(3);
      
      // Should only attempt once per task for permanent errors
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    test('should apply exponential backoff for transient errors', async () => {
      const tasks = await engine.getTasksForExecution();
      const task = tasks[0];
      
      // Mock provider manager to fail with transient error multiple times
      let attempt = 0;
      const startTime = Date.now();
      const mockExecute = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt <= 3) {
          throw new Error('Network error'); // Transient error
        }
        return Promise.resolve({ provider: 'test-provider', output: 'success' });
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should have delays between retries (1s + 2s + 4s = 7s minimum)
      expect(duration).toBeGreaterThanOrEqual(7000);
      expect(duration).toBeLessThan(10000); // Allow some margin
    });

    test('should handle mixed error types appropriately', async () => {
      const tasks = await engine.getTasksForExecution();
      
      // Mock provider manager with different error types
      let taskIndex = 0;
      const mockExecute = jest.fn().mockImplementation(() => {
        taskIndex++;
        if (taskIndex === 1) {
          throw new Error('Connection timeout'); // Transient - will retry
        } else if (taskIndex === 2) {
          throw new Error('Fatal error occurred'); // Permanent - won't retry
        } else {
          return Promise.resolve({ provider: 'test-provider', output: 'success' }); // Success
        }
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      const result = await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      expect(result.completed).toBe(1); // Only third task succeeds
      expect(result.failed).toBe(2); // First task fails after retries, second fails immediately
    });
  });

  describe('Error Handling in Recovery', () => {
    test('should handle checkpoint loading errors gracefully', async () => {
      // Mock provider manager to succeed
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      // Try to resume from non-existent checkpoint
      const result = await engine.executeAllTasksWithRecovery({
        resume: true,
        checkpointPath: '/non/existent/checkpoint.json'
      });
      
      // Should fall back to normal execution
      expect(result.recoveredFromCheckpoint).toBe(false);
      expect(result.totalTasks).toBe(3);
      expect(result.completed).toBe(3);
    });

    test('should handle checkpoint saving errors gracefully', async () => {
      // Mock provider manager to succeed
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      // Mock fs.writeFile to fail
      const originalWriteFile = fs.writeFile;
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Permission denied'));
      
      const result = await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      // Should still complete execution even if checkpointing fails
      expect(result.completed).toBe(3);
      expect(result.failed).toBe(0);
      
      // Restore original fs.writeFile
      fs.writeFile = originalWriteFile;
    });

    test('should handle invalid checkpoint data gracefully', async () => {
      // Create invalid checkpoint file
      const invalidCheckpointPath = path.join(checkpointDir, 'invalid-checkpoint.json');
      await fs.mkdir(checkpointDir, { recursive: true });
      fs.writeFileSync(invalidCheckpointPath, 'invalid json data');
      
      // Mock provider manager to succeed
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      // Try to resume from invalid checkpoint - should throw error but we catch it
      try {
        await engine.loadCheckpoint(invalidCheckpointPath);
      } catch (error) {
        // Expected to fail
      }
      
      // Should still be able to execute normally
      const result = await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      expect(result.totalTasks).toBe(3);
      expect(result.completed).toBe(3);
    });
  });

  describe('Integration with Existing Functionality', () => {
    test('should maintain backward compatibility with executeAllTasks', async () => {
      // Mock provider manager to succeed
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      // Use old method
      const oldResult = await engine.executeAllTasks();
      
      // Use new method without recovery
      const newResult = await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      // Results should be similar
      expect(oldResult.totalTasks).toBe(newResult.totalTasks);
      expect(oldResult.completed).toBe(newResult.completed);
      expect(oldResult.failed).toBe(newResult.failed);
    });

    test('should log recovery events appropriately', async () => {
      // Mock provider manager to succeed
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      const logEntries = engine.getExecutionLog();
      expect(logEntries.length).toBeGreaterThan(0);
      expect(logEntries.some(e => e.level === 'info' && e.message.includes('Execution completed'))).toBe(true);
    });

    test('should handle task status updates during recovery', async () => {
      // Mock provider manager to succeed for first task, fail for others
      let taskIndex = 0;
      const mockExecute = jest.fn().mockImplementation(() => {
        taskIndex++;
        if (taskIndex === 1) {
          return Promise.resolve({ provider: 'test-provider', output: 'success' });
        } else {
          throw new Error('Fatal error'); // Permanent error
        }
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      await engine.executeAllTasksWithRecovery({
        resume: false
      });
      
      // Check task statuses
      const guide = await readGuide(testGuidePath);
      const task1 = guide.tasks.find(t => t.id === 'T1');
      const task2 = guide.tasks.find(t => t.id === 'T2');
      
      expect(task1.status).toBe('completed');
      expect(task2.status).toBe('failed');
    });
  });
});