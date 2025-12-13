/**
 * Task Execution Engine Tests
 * 
 * Comprehensive tests for the TaskExecutionEngine class
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
      "tasks": ["T1", "T2"]
    },
    {
      "id": "phase2",
      "name": "Phase 2",
      "order": 2,
      "tasks": ["T3"]
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
      "status": "completed",
      "order": 2,
      "description": "Second task",
      "acceptanceCriteria": ["Criteria 2"]
    },
    {
      "id": "T3",
      "title": "Task 3",
      "status": "todo",
      "order": 1,
      "description": "Third task",
      "acceptanceCriteria": ["Criteria 3"]
    }
  ]
};

const testGuidePath = path.join(__dirname, 'test-guide.json');

describe('TaskExecutionEngine', () => {
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
    
    // Clear mocks
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create engine with default options', () => {
      const defaultEngine = new TaskExecutionEngine();
      
      expect(defaultEngine.projectPath).toBe(process.cwd());
      expect(defaultEngine.guidePath).toBe(`${process.cwd()}/IMPLEMENTATION_GUIDE.json`);
      expect(defaultEngine.providerOrder).toEqual(['codex', 'claude', 'vibe', 'cursor-agent']);
      expect(defaultEngine.maxRetries).toBe(3);
      expect(defaultEngine.taskTimeout).toBe(300000);
      expect(defaultEngine.verbose).toBe(false);
    });

    test('should create engine with custom options', () => {
      const customEngine = new TaskExecutionEngine({
        projectPath: '/custom/path',
        guidePath: '/custom/guide.json',
        providerOrder: ['vibe', 'codex'],
        maxRetries: 5,
        taskTimeout: 60000,
        verbose: true
      });
      
      expect(customEngine.projectPath).toBe('/custom/path');
      expect(customEngine.guidePath).toBe('/custom/guide.json');
      expect(customEngine.providerOrder).toEqual(['vibe', 'codex']);
      expect(customEngine.maxRetries).toBe(5);
      expect(customEngine.taskTimeout).toBe(60000);
      expect(customEngine.verbose).toBe(true);
    });

    test('should initialize provider manager', () => {
      expect(engine.providerManager).toBeInstanceOf(ProviderManager);
      expect(engine.executionLog).toEqual([]);
    });
  });

  describe('getTasksForExecution', () => {
    test('should return tasks sorted by phase and order', async () => {
      const tasks = await engine.getTasksForExecution();
      
      expect(tasks).toHaveLength(2); // T1 and T3 (T2 is completed)
      expect(tasks[0].id).toBe('T1'); // Phase 1, order 1
      expect(tasks[1].id).toBe('T3'); // Phase 2, order 1
    });

    test('should return empty array when no tasks are ready', async () => {
      // Create guide with only completed tasks
      const completedGuide = {
        ...mockGuide,
        tasks: mockGuide.tasks.map(task => ({ ...task, status: 'completed' }))
      };
      
      fs.writeFileSync(testGuidePath, JSON.stringify(completedGuide, null, 2));
      
      const tasks = await engine.getTasksForExecution();
      expect(tasks).toHaveLength(0);
    });

    test('should log task discovery information', async () => {
      await engine.getTasksForExecution();
      
      const logEntries = engine.getExecutionLog();
      expect(logEntries).toHaveLength(1);
      expect(logEntries[0].level).toBe('info');
      expect(logEntries[0].message).toContain('Found 2 tasks ready for execution');
    });

    test('should throw TaskExecutionError when guide cannot be read', async () => {
      // Create invalid guide file
      fs.writeFileSync(testGuidePath, 'invalid json');
      
      await expect(engine.getTasksForExecution()).rejects.toThrow(TaskExecutionError);
      await expect(engine.getTasksForExecution()).rejects.toThrow('Failed to read tasks from configuration');
    });
  });

  describe('executeTask', () => {
    test('should update task status to in_progress', async () => {
      // Mock the provider manager to return successful execution
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      const tasks = await engine.getTasksForExecution();
      const task = tasks[0];
      
      // Execute the task
      const result = await engine.executeTask(task);
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      
      // Check that status was updated to completed
      const guide = await readGuide(testGuidePath);
      const updatedTask = guide.tasks.find(t => t.id === task.id);
      expect(updatedTask.status).toBe('completed');
    });

    test('should retry failed tasks up to maxRetries', async () => {
      const tasks = await engine.getTasksForExecution();
      const task = tasks[0];
      
      // Mock provider manager to fail twice, then succeed
      let attempt = 0;
      const mockExecute = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt < 2) {
          throw new Error(`Attempt ${attempt} failed`);
        }
        return Promise.resolve({ provider: 'test-provider', output: 'success' });
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      const result = await engine.executeTask(task);
      
      expect(result.success).toBe(true);
      expect(result.attempt).toBe(2);
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    test('should throw TaskExecutionError after max retries', async () => {
      const tasks = await engine.getTasksForExecution();
      const task = tasks[0];
      
      // Mock provider manager to always fail
      const mockExecute = jest.fn().mockRejectedValue(new Error('Always fails'));
      engine.providerManager.executeWithFallback = mockExecute;
      
      await expect(engine.executeTask(task)).rejects.toThrow(TaskExecutionError);
      await expect(engine.executeTask(task)).rejects.toThrow(`Task ${task.id} failed after 2 attempts`);
      
      // Check that status was updated to failed
      const guide = await readGuide(testGuidePath);
      const updatedTask = guide.tasks.find(t => t.id === task.id);
      expect(updatedTask.status).toBe('failed');
    });

    test('should log execution progress and errors', async () => {
      const tasks = await engine.getTasksForExecution();
      const task = tasks[0];
      
      // Mock provider manager to fail
      const mockExecute = jest.fn().mockRejectedValue(new Error('Test error'));
      engine.providerManager.executeWithFallback = mockExecute;
      
      try {
        await engine.executeTask(task);
      } catch (error) {
        // Expected to fail
      }
      
      const logEntries = engine.getExecutionLog();
      expect(logEntries.length).toBeGreaterThan(0);
      expect(logEntries.some(e => e.level === 'info' && e.message.includes('Starting task execution'))).toBe(true);
      expect(logEntries.some(e => e.level === 'warn' && e.message.includes('failed on attempt'))).toBe(true);
      expect(logEntries.some(e => e.level === 'error' && e.message.includes('failed after'))).toBe(true);
    });
  });

  describe('executeAllTasks', () => {
    test('should execute multiple tasks sequentially', async () => {
      const tasks = await engine.getTasksForExecution();
      
      // Mock provider manager to succeed for all tasks
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      const result = await engine.executeAllTasks();
      
      expect(result.totalTasks).toBe(2);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.executionLog).toHaveLength(2);
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    test('should continue execution when task fails', async () => {
      const tasks = await engine.getTasksForExecution();
      
      // Mock provider manager to fail for first task, succeed for second
      let callCount = 0;
      const mockExecute = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) { // Fail both attempts for first task
          throw new Error('First task fails');
        }
        return Promise.resolve({ provider: 'test-provider', output: 'success' });
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      const result = await engine.executeAllTasks();
      
      expect(result.totalTasks).toBe(2);
      expect(result.completed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.executionLog).toHaveLength(2);
      expect(result.executionLog[0].status).toBe('failed');
      expect(result.executionLog[1].status).toBe('completed');
    });

    test('should return success true when all tasks complete', async () => {
      // Mock provider manager to succeed for all tasks
      const mockExecute = jest.fn().mockResolvedValue({
        provider: 'test-provider',
        output: 'test output'
      });
      engine.providerManager.executeWithFallback = mockExecute;
      
      const result = await engine.executeAllTasks();
      
      expect(result.success).toBe(true);
    });

    test('should return success false when any task fails', async () => {
      // Mock provider manager to fail for all tasks
      const mockExecute = jest.fn().mockRejectedValue(new Error('All fail'));
      engine.providerManager.executeWithFallback = mockExecute;
      
      const result = await engine.executeAllTasks();
      
      expect(result.success).toBe(false);
    });

    test('should handle empty task list gracefully', async () => {
      // Create guide with no ready tasks
      const emptyGuide = {
        project: "test-project",
        phases: [],
        tasks: []
      };
      
      fs.writeFileSync(testGuidePath, JSON.stringify(emptyGuide, null, 2));
      
      const result = await engine.executeAllTasks();
      
      expect(result.totalTasks).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe('Logging and Utilities', () => {
    test('should log messages with timestamps and levels', () => {
      engine.log('info', 'Test info message', { test: 'data' });
      engine.log('warn', 'Test warning message');
      engine.log('error', 'Test error message', { error: 'details' });
      
      const logEntries = engine.getExecutionLog();
      expect(logEntries).toHaveLength(3);
      
      expect(logEntries[0].level).toBe('info');
      expect(logEntries[0].message).toBe('Test info message');
      expect(logEntries[0].test).toBe('data');
      expect(logEntries[0].timestamp).toBeDefined();
      
      expect(logEntries[1].level).toBe('warn');
      expect(logEntries[2].level).toBe('error');
    });

    test('should return and clear execution log', () => {
      engine.log('info', 'Test message 1');
      engine.log('info', 'Test message 2');
      
      const logEntries = engine.getExecutionLog();
      expect(logEntries).toHaveLength(2);
      
      engine.clearExecutionLog();
      expect(engine.getExecutionLog()).toHaveLength(0);
    });
  });
});