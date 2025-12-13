/**
 * Task Execution Engine - MVP Implementation
 * 
 * This module provides the core task execution functionality for kc-orchestrator.
 * It handles sequential task processing, provider fallback, and status management.
 */

const { ProviderManager } = require('./providers/ProviderManager');
const { readGuide, writeGuide, updateTaskStatus } = require('./config');
const { TaskExecutionError, TaskValidationError } = require('./errors');

/**
 * Task Execution Engine
 * 
 * Handles the execution of tasks from IMPLEMENTATION_GUIDE.json files
 * with provider fallback and status tracking.
 */
class TaskExecutionEngine {
  /**
   * Create a new TaskExecutionEngine instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.projectPath - Path to the project directory
   * @param {string} options.guidePath - Path to IMPLEMENTATION_GUIDE.json
   * @param {Array} options.providerOrder - Provider execution order
   * @param {number} options.maxRetries - Maximum retries per task
   * @param {number} options.taskTimeout - Task execution timeout in ms
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.guidePath = options.guidePath || `${this.projectPath}/IMPLEMENTATION_GUIDE.json`;
    this.providerOrder = options.providerOrder || ['codex', 'claude', 'vibe', 'cursor-agent'];
    this.maxRetries = options.maxRetries || 3;
    this.taskTimeout = options.taskTimeout || 300000; // 5 minutes
    this.verbose = options.verbose || false;
    
    this.providerManager = new ProviderManager({
      providerOrder: this.providerOrder,
      taskTimeout: this.taskTimeout
    });
    
    this.executionLog = [];
  }

  /**
   * Log execution information
   * 
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...data };
    this.executionLog.push(logEntry);
    
    if (this.verbose || level === 'error') {
      console[level === 'error' ? 'error' : 'log'](
        `[${timestamp}] [${level.toUpperCase()}] ${message}`,
        data.taskId ? `Task: ${data.taskId}` : '',
        data.provider ? `Provider: ${data.provider}` : ''
      );
    }
  }

  /**
   * Get tasks from configuration in execution order
   * 
   * @returns {Array} Array of tasks sorted by execution order
   */
  async getTasksForExecution() {
    try {
      const guide = await readGuide(this.guidePath);
      const tasks = guide.tasks || [];
      
      // Filter out completed tasks and sort by order
      const executableTasks = tasks
        .filter(task => task.status === 'todo')
        .sort((a, b) => {
          // Sort by phase first, then by task order within phase
          const phaseA = guide.phases.find(p => p.tasks.includes(a.id))?.order || 0;
          const phaseB = guide.phases.find(p => p.tasks.includes(b.id))?.order || 0;
          
          if (phaseA !== phaseB) return phaseA - phaseB;
          return (a.order || 0) - (b.order || 0);
        });
      
      this.log('info', `Found ${executableTasks.length} tasks ready for execution`, {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length
      });
      
      return executableTasks;
    } catch (error) {
      this.log('error', 'Failed to read tasks from configuration', { error: error.message });
      throw new TaskExecutionError('Failed to read tasks from configuration', error);
    }
  }

  /**
   * Execute a single task with retry and fallback logic
   * 
   * @param {Object} task - Task to execute
   * @returns {Object} Execution result
   */
  async executeTask(task) {
    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;
    
    this.log('info', `Starting task execution`, {
      taskId: task.id,
      taskTitle: task.title,
      attempt: attempt + 1
    });
    
    // Update task status to in_progress
    try {
      await updateTaskStatus(this.guidePath, task.id, 'in_progress');
    } catch (error) {
      this.log('error', `Failed to update task status to in_progress`, {
        taskId: task.id,
        error: error.message
      });
      throw new TaskExecutionError(`Failed to update task status: ${error.message}`, error);
    }
    
    // Execute task with retries and provider fallback
    while (attempt < this.maxRetries) {
      attempt++;
      
      try {
        const result = await this.providerManager.executeWithFallback(task, {
          projectPath: this.projectPath,
          taskTimeout: this.taskTimeout
        });
        
        // Task executed successfully
        this.log('info', `Task completed successfully`, {
          taskId: task.id,
          attempt,
          duration: Date.now() - startTime,
          provider: result.provider
        });
        
        // Update task status to completed
        await updateTaskStatus(this.guidePath, task.id, 'completed');
        
        return {
          success: true,
          taskId: task.id,
          provider: result.provider,
          output: result.output,
          attempt,
          duration: Date.now() - startTime
        };
      } catch (error) {
        lastError = error;
        this.log('warn', `Task execution failed on attempt ${attempt}`, {
          taskId: task.id,
          error: error.message,
          provider: error.provider || 'unknown'
        });
        
        if (attempt < this.maxRetries) {
          this.log('info', `Retrying task (attempt ${attempt + 1}/${this.maxRetries})`, {
            taskId: task.id
          });
        }
      }
    }
    
    // All attempts failed
    this.log('error', `Task failed after ${this.maxRetries} attempts`, {
      taskId: task.id,
      error: lastError.message
    });
    
    // Update task status to failed
    try {
      await updateTaskStatus(this.guidePath, task.id, 'failed', {
        error: lastError.message
      });
    } catch (updateError) {
      this.log('error', `Failed to update task status to failed`, {
        taskId: task.id,
        error: updateError.message
      });
    }
    
    throw new TaskExecutionError(
      `Task ${task.id} failed after ${this.maxRetries} attempts: ${lastError.message}`,
      lastError
    );
  }

  /**
   * Execute all tasks sequentially
   * 
   * @returns {Object} Execution summary
   */
  async executeAllTasks() {
    const startTime = Date.now();
    const results = {
      totalTasks: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      executionLog: []
    };
    
    try {
      // Get tasks for execution
      const tasks = await this.getTasksForExecution();
      results.totalTasks = tasks.length;
      
      if (tasks.length === 0) {
        this.log('info', 'No tasks ready for execution');
        results.skipped = 0;
        return results;
      }
      
      // Execute tasks sequentially
      for (const task of tasks) {
        try {
          const taskResult = await this.executeTask(task);
          results.completed++;
          results.executionLog.push({
            taskId: task.id,
            status: 'completed',
            ...taskResult
          });
        } catch (error) {
          results.failed++;
          results.executionLog.push({
            taskId: error.taskId || (error.task && error.task.id) || 'unknown',
            status: 'failed',
            error: error.message
          });
          
          // Continue with next task even if this one failed
          this.log('info', `Continuing with next task after failure of ${task.id}`);
        }
      }
      
      const duration = Date.now() - startTime;
      this.log('info', `Execution completed: ${results.completed} completed, ${results.failed} failed`, {
        duration,
        totalTasks: results.totalTasks
      });
      
      return {
        ...results,
        duration,
        success: results.failed === 0
      };
    } catch (error) {
      this.log('error', 'Fatal error during task execution', { error: error.message });
      throw new TaskExecutionError('Fatal error during task execution', error);
    }
  }

  /**
   * Get execution log
   * 
   * @returns {Array} Execution log entries
   */
  getExecutionLog() {
    return [...this.executionLog];
  }

  /**
   * Clear execution log
   */
  clearExecutionLog() {
    this.executionLog = [];
  }
}

module.exports = {
  TaskExecutionEngine,
  TaskExecutionError,
  TaskValidationError
};