/**
 * Task Execution Engine - MVP Implementation
 * 
 * This module provides the core task execution functionality for kc-orchestrator.
 * It handles sequential task processing, provider fallback, and status management.
 */

const { ProviderManager } = require('./providers/ProviderManager');
const { readGuide, writeGuide, updateTaskStatus } = require('./config');
const { TaskExecutionError, TaskValidationError } = require('./errors');
const { extractTasks, getTasksForExecution: extractTasksForExecution, normalizeTask } = require('./utils/taskExtractor');
const { updateTaskStatusInGuide, canUpdateStatus } = require('./utils/taskStatusUpdater');
const fs = require('fs').promises;
const path = require('path');

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
    this.checkpointDir = path.join(this.projectPath, '.kc-orchestrator', 'checkpoints');
    this.currentCheckpoint = null;
    this.errorClassificationRules = {
      transient: [
        'timeout',
        'network',
        'rate limit',
        'temporary',
        'unavailable',
        'connection',
        'retry'
      ],
      configuration: [
        'configuration',
        'config',
        'setup',
        'environment',
        'permission',
        'access'
      ],
      permanent: [
        'not found',
        'invalid',
        'corrupt',
        'missing',
        'failed',
        'fatal error',
        'critical error'
      ]
    };
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
      // readGuide is synchronous, but we keep async for consistency
      const guide = readGuide(this.guidePath, false); // Non-strict mode
      if (!guide) {
        this.log('error', 'Failed to read guide file');
        return [];
      }
      
      // Extract tasks using flexible extractor
      const allTasks = extractTasks(guide);
      const executableTasks = extractTasksForExecution(guide);
      
      // Sort by order if available
      executableTasks.sort((a, b) => {
        // Sort by phase first, then by task order within phase
        const phaseA = guide.phases?.find(p => p.tasks?.includes(a.id))?.order || 0;
        const phaseB = guide.phases?.find(p => p.tasks?.includes(b.id))?.order || 0;
        
        if (phaseA !== phaseB) return phaseA - phaseB;
        return (a.order || 0) - (b.order || 0);
      });
      
      this.log('info', `Found ${executableTasks.length} tasks ready for execution`, {
        totalTasks: allTasks.length,
        completedTasks: allTasks.filter(t => {
          const normalized = normalizeTask(t);
          return normalized?.status === 'completed';
        }).length
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
    
    // Normalize task to ensure ID exists
    const normalizedTask = require('./utils/taskExtractor').normalizeTask(task);
    const taskId = normalizedTask.id || task.id || 'unknown';
    const taskTitle = normalizedTask.title || task.title || task.description || 'Untitled Task';
    
    this.log('info', `Starting task execution`, {
      taskId,
      taskTitle,
      attempt: attempt + 1
    });
    
    if (this.verbose) {
      console.log(`\n📋 Task Details:`);
      console.log(`   ID: ${taskId}`);
      console.log(`   Title: ${taskTitle}`);
      if (task.description && task.description !== taskTitle) {
        console.log(`   Description: ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`);
      }
      console.log(`   Status: ${normalizedTask.status || task.status || 'todo'}`);
    }
    
      // Update task status to in_progress
      try {
        const guide = readGuide(this.guidePath, false);
        if (guide && canUpdateStatus(guide)) {
          if (updateTaskStatusInGuide(this.guidePath, taskId, 'in_progress')) {
            if (this.verbose) {
              console.log(`   ✅ Status updated to in_progress`);
            }
          } else if (Array.isArray(guide.tasks)) {
            updateTaskStatus(this.guidePath, taskId, 'in_progress');
          }
        }
      } catch (error) {
        this.log('warn', `Failed to update task status to in_progress`, {
          taskId,
          error: error.message
        });
        // Don't throw - continue execution even if status update fails
      }
    
    // Execute task with retries and provider fallback
    while (attempt < this.maxRetries) {
      attempt++;
      
      try {
        const result = await this.providerManager.executeWithFallback(task, {
          projectPath: this.projectPath,
          taskTimeout: this.taskTimeout
        });
        
        // Check if execution was actually successful
        if (!result || result.success === false) {
          const errorMsg = result?.error || 'Task execution returned no result';
          throw new TaskExecutionError(`Task execution failed: ${errorMsg}`);
        }
        
        // Task executed successfully
        const duration = Date.now() - startTime;
        this.log('info', `Task completed successfully`, {
          taskId,
          attempt,
          duration,
          provider: result.provider || 'unknown'
        });
        
        if (this.verbose) {
          console.log(`\n✅ Task completed successfully:`);
          console.log(`   Task ID: ${taskId}`);
          console.log(`   Provider: ${result.provider || 'unknown'}`);
          console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
          console.log(`   Attempts: ${attempt}`);
          if (result.result && result.result.parsedOutput) {
            const output = result.result.parsedOutput;
            if (output.changes && output.changes.length > 0) {
              console.log(`   Changes: ${output.changes.length} file(s)`);
            }
            if (output.logs && output.logs.length > 0) {
              console.log(`   Logs: ${output.logs.length} message(s)`);
            }
          }
        }
        
        // Update task status to completed
        try {
          const guide = readGuide(this.guidePath, false);
          if (guide && canUpdateStatus(guide)) {
            if (updateTaskStatusInGuide(this.guidePath, taskId, 'completed')) {
              if (this.verbose) {
                console.log(`   ✅ Status updated to completed`);
              }
              this.log('info', `Updated task status to completed`, { taskId });
            } else if (Array.isArray(guide.tasks)) {
              updateTaskStatus(this.guidePath, taskId, 'completed');
            }
          }
        } catch (updateError) {
          this.log('warn', 'Failed to update task status to completed', {
            taskId,
            error: updateError.message
          });
        }
        
        return {
          success: true,
          taskId,
          provider: result.provider || 'unknown',
          output: result.result?.output || result.output,
          attempt,
          duration
        };
      } catch (error) {
        lastError = error;
        const errorDuration = Date.now() - startTime;
        this.log('warn', `Task execution failed on attempt ${attempt}`, {
          taskId,
          error: error.message,
          provider: error.provider || result?.provider || 'unknown',
          duration: errorDuration
        });
        
        if (this.verbose) {
          console.log(`\n❌ Task execution failed (attempt ${attempt}/${this.maxRetries}):`);
          console.log(`   Task ID: ${taskId}`);
          console.log(`   Error: ${error.message}`);
          console.log(`   Provider: ${error.provider || result?.provider || 'unknown'}`);
          console.log(`   Duration: ${(errorDuration / 1000).toFixed(2)}s`);
        }
        
        if (attempt < this.maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          this.log('info', `Retrying task (attempt ${attempt + 1}/${this.maxRetries}) after ${retryDelay}ms`, {
            taskId
          });
          
          if (this.verbose) {
            console.log(`   ⏳ Waiting ${retryDelay}ms before retry...`);
          }
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // All attempts failed
    const totalDuration = Date.now() - startTime;
    this.log('error', `Task failed after ${this.maxRetries} attempts`, {
      taskId,
      error: lastError.message,
      duration: totalDuration
    });
    
    if (this.verbose) {
      console.log(`\n❌ Task failed after ${this.maxRetries} attempts:`);
      console.log(`   Task ID: ${taskId}`);
      console.log(`   Error: ${lastError.message}`);
      console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    }
    
    // Update task status to failed
    try {
      const guide = readGuide(this.guidePath, false);
      if (guide && canUpdateStatus(guide)) {
        if (updateTaskStatusInGuide(this.guidePath, taskId, 'failed', {
          error: lastError.message
        })) {
          if (this.verbose) {
            console.log(`   ✅ Status updated to failed`);
          }
          this.log('info', `Updated task status to failed`, { taskId });
        } else if (Array.isArray(guide.tasks)) {
          updateTaskStatus(this.guidePath, taskId, 'failed', {
            error: lastError.message
          });
        }
      }
    } catch (updateError) {
      this.log('warn', `Failed to update task status to failed`, {
        taskId,
        error: updateError.message
      });
    }
    
    const errorType = this.classifyError(lastError);
    const executionError = new TaskExecutionError(
      `Task ${taskId} failed after ${this.maxRetries} attempts: ${lastError.message}`,
      lastError
    );
    executionError.errorType = errorType;
    executionError.taskId = taskId;
    throw executionError;
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
   * Ensure checkpoint directory exists
   * 
   * @returns {Promise<void>}
   */
  async ensureCheckpointDir() {
    try {
      await fs.mkdir(this.checkpointDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        this.log('error', 'Failed to create checkpoint directory', { error: error.message });
        throw new TaskExecutionError('Failed to create checkpoint directory', error);
      }
    }
  }

  /**
   * Save execution checkpoint
   * 
   * @param {Object} checkpointData - Checkpoint data to save
   * @returns {Promise<string>} Path to saved checkpoint
   */
  async saveCheckpoint(checkpointData) {
    try {
      await this.ensureCheckpointDir();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const checkpointPath = path.join(this.checkpointDir, `checkpoint-${timestamp}.json`);
      
      const checkpoint = {
        timestamp: new Date().toISOString(),
        projectPath: this.projectPath,
        guidePath: this.guidePath,
        executionLog: this.executionLog,
        currentTaskIndex: checkpointData.currentTaskIndex,
        completedTasks: checkpointData.completedTasks,
        failedTasks: checkpointData.failedTasks,
        ...checkpointData
      };
      
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf8');
      this.currentCheckpoint = checkpointPath;
      
      this.log('info', 'Checkpoint saved', { checkpointPath });
      return checkpointPath;
    } catch (error) {
      this.log('error', 'Failed to save checkpoint', { error: error.message });
      throw new TaskExecutionError('Failed to save checkpoint', error);
    }
  }

  /**
   * Load execution checkpoint
   * 
   * @param {string} checkpointPath - Path to checkpoint file
   * @returns {Promise<Object|null>} Loaded checkpoint data or null if checkpoint doesn't exist
   */
  async loadCheckpoint(checkpointPath) {
    try {
      const checkpointContent = await fs.readFile(checkpointPath, 'utf8');
      const checkpoint = JSON.parse(checkpointContent);
      
      this.log('info', 'Checkpoint loaded', { checkpointPath });
      return checkpoint;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log('warn', 'Checkpoint file not found', { checkpointPath });
        return null;
      }
      this.log('error', 'Failed to load checkpoint', { error: error.message, checkpointPath });
      throw new TaskExecutionError('Failed to load checkpoint', error);
    }
  }

  /**
   * Find latest checkpoint
   * 
   * @returns {Promise<string|null>} Path to latest checkpoint or null if none exists
   */
  async findLatestCheckpoint() {
    try {
      await this.ensureCheckpointDir();
      
      const files = await fs.readdir(this.checkpointDir);
      const checkpointFiles = files
        .filter(file => file.startsWith('checkpoint-') && file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Sort by timestamp (newest first)
      
      if (checkpointFiles.length === 0) {
        return null;
      }
      
      return path.join(this.checkpointDir, checkpointFiles[0]);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      this.log('error', 'Failed to find latest checkpoint', { error: error.message });
      throw new TaskExecutionError('Failed to find latest checkpoint', error);
    }
  }

  /**
   * Classify error for recovery strategy
   * 
   * @param {Error} error - Error to classify
   * @returns {string} Error classification (transient, configuration, permanent, unknown)
   */
  classifyError(error) {
    const errorMessage = error.message.toLowerCase();
    
    // Check for transient errors
    for (const keyword of this.errorClassificationRules.transient) {
      if (errorMessage.includes(keyword)) {
        return 'transient';
      }
    }
    
    // Check for configuration errors
    for (const keyword of this.errorClassificationRules.configuration) {
      if (errorMessage.includes(keyword)) {
        return 'configuration';
      }
    }
    
    // Check for permanent errors
    for (const keyword of this.errorClassificationRules.permanent) {
      if (errorMessage.includes(keyword)) {
        return 'permanent';
      }
    }
    
    return 'unknown';
  }

  /**
   * Determine if error should be retried
   * 
   * @param {Error} error - Error to evaluate
   * @param {number} retryCount - Current retry count
   * @returns {boolean} True if error should be retried
   */
  shouldRetry(error, retryCount) {
    const errorType = this.classifyError(error);
    
    // Never retry permanent errors
    if (errorType === 'permanent') {
      return false;
    }
    
    // Always retry transient errors (with exponential backoff)
    if (errorType === 'transient') {
      return retryCount <= this.maxRetries; // Allow one more try than maxRetries
    }
    
    // Retry configuration errors only a few times
    if (errorType === 'configuration') {
      return retryCount < 2; // Only 2 retries for configuration errors
    }
    
    // Retry unknown errors with standard retry logic
    return retryCount <= this.maxRetries; // Allow one more try than maxRetries
  }

  /**
   * Calculate exponential backoff delay
   * 
   * @param {number} retryCount - Current retry count
   * @returns {number} Delay in milliseconds
   */
  getRetryDelay(retryCount) {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, etc.
    const baseDelay = 1000;
    return Math.min(baseDelay * Math.pow(2, retryCount), 30000); // Max 30s
  }

  /**
   * Request manual intervention for complex errors
   * 
   * @param {Error} error - Error requiring manual intervention
   * @param {Object} task - Task that failed
   * @returns {Promise<boolean>} True if user wants to continue
   */
  async requestManualIntervention(error, task) {
    // In non-interactive mode, always continue
    if (process.env.NON_INTERACTIVE || process.env.CI) {
      this.log('warn', 'Manual intervention requested but running in non-interactive mode', {
        taskId: task.id,
        error: error.message
      });
      return true;
    }
    
    // For now, just log the need for manual intervention
    // In a real implementation, this would prompt the user
    this.log('error', 'Manual intervention required', {
      taskId: task.id,
      error: error.message,
      suggestion: 'Please review the error and fix the underlying issue'
    });
    
    return true; // Always continue for now
  }

  /**
   * Execute all tasks with checkpointing and error recovery
   * 
   * @param {Object} options - Execution options
   * @param {boolean} options.resume - Resume from latest checkpoint
   * @param {string} options.checkpointPath - Specific checkpoint to resume from
   * @returns {Object} Execution summary
   */
  async executeAllTasksWithRecovery(options = {}) {
    const startTime = Date.now();
    let results = {
      totalTasks: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      executionLog: [],
      checkpoints: [],
      recoveredFromCheckpoint: false
    };
    
    let tasks = [];
    let currentTaskIndex = 0;
    
    try {
      // Check if we should resume from checkpoint
      let checkpoint = null;
      if (options.resume) {
        const checkpointPath = options.checkpointPath || await this.findLatestCheckpoint();
        if (checkpointPath) {
          checkpoint = await this.loadCheckpoint(checkpointPath);
          
          // If checkpoint loading failed or returned null, fall back to normal execution
          if (!checkpoint) {
            this.log('warn', 'No valid checkpoint found, starting fresh execution');
          } else {
            results.recoveredFromCheckpoint = true;
            
            // Restore state from checkpoint
            tasks = checkpoint.tasks || [];
            currentTaskIndex = checkpoint.currentTaskIndex || 0;
            results.completed = checkpoint.completedTasks || 0;
            results.failed = checkpoint.failedTasks || 0;
            results.executionLog = checkpoint.executionLog || [];
            this.executionLog = [...results.executionLog];
            
            this.log('info', 'Resumed execution from checkpoint', {
              checkpointPath,
              currentTaskIndex,
              completed: results.completed,
              failed: results.failed
            });
          }
        }
      }
      
      // If no checkpoint or no tasks in checkpoint, get fresh tasks
      if (tasks.length === 0) {
        tasks = await this.getTasksForExecution();
        results.totalTasks = tasks.length;
        
        if (tasks.length === 0) {
          this.log('info', 'No tasks ready for execution');
          results.skipped = 0;
          return results;
        }
      }
      
      results.totalTasks = tasks.length;
      
      // Execute tasks sequentially with checkpointing
      for (let i = currentTaskIndex; i < tasks.length; i++) {
        const task = tasks[i];
        const normalized = require('./utils/taskExtractor').normalizeTask(task);
        const taskId = normalized.id || task.id || 'unknown';
        const taskTitle = normalized.title || task.title || task.description || 'Untitled Task';
        
        if (this.verbose) {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`Task ${i + 1}/${tasks.length}: ${taskId}`);
          console.log(`Title: ${taskTitle}`);
          console.log(`${'='.repeat(60)}`);
        }
        
        let attempt = 0;
        let lastError = null;
        
        // Save checkpoint before starting task
        try {
          const checkpointPath = await this.saveCheckpoint({
            currentTaskIndex: i,
            completedTasks: results.completed,
            failedTasks: results.failed,
            tasks: tasks.map(t => ({ id: t.id, status: t.status }))
          });
          results.checkpoints.push(checkpointPath);
        } catch (checkpointError) {
          this.log('warn', 'Failed to save checkpoint before task execution', {
            taskId: task.id,
            error: checkpointError.message
          });
        }
        
        // Execute task with enhanced error recovery
        while (attempt <= this.maxRetries) {
          try {
            const taskResult = await this.executeTask(task);
            results.completed++;
            const normalized = require('./utils/taskExtractor').normalizeTask(task);
            const finalTaskId = normalized.id || task.id || 'unknown';
            results.executionLog.push({
              taskId: finalTaskId,
              status: 'completed',
              ...taskResult
            });
            
            if (this.verbose) {
              console.log(`\n✅ Task ${i + 1}/${tasks.length} completed successfully`);
              console.log(`   Progress: ${results.completed} completed, ${results.failed} failed, ${tasks.length - i - 1} remaining`);
            }
            
            break; // Task completed successfully, move to next task
            
          } catch (error) {
            lastError = error;
            attempt++;
            
            const normalized = require('./utils/taskExtractor').normalizeTask(task);
            const finalTaskId = normalized.id || task.id || 'unknown';
            
            // Classify error and decide recovery strategy
            const errorType = this.classifyError(error);
            this.log('warn', `Task failed with ${errorType} error (attempt ${attempt}/${this.maxRetries})`, {
              taskId: finalTaskId,
              errorType,
              error: error.message
            });
            
            if (this.verbose) {
              console.log(`\n⚠️  Task failed (attempt ${attempt}/${this.maxRetries}):`);
              console.log(`   Task ID: ${finalTaskId}`);
              console.log(`   Error Type: ${errorType}`);
              console.log(`   Error: ${error.message}`);
            }
            
            // Check if we should retry
            if (!this.shouldRetry(error, attempt)) {
              this.log('info', `Not retrying ${errorType} error`, {
                taskId: task.id,
                errorType
              });
              break;
            }
            
            // Apply exponential backoff
            const delay = this.getRetryDelay(attempt);
            this.log('info', `Waiting ${delay}ms before retry (exponential backoff)`, {
              taskId: task.id,
              attempt,
              delay
            });
            
            // Simulate delay (in real implementation, use setTimeout with async/await)
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        // If task failed after all attempts, handle failure
        if (lastError) {
          results.failed++;
          results.executionLog.push({
            taskId: lastError.taskId || (lastError.task && lastError.task.id) || 'unknown',
            status: 'failed',
            error: lastError.message,
            errorType: this.classifyError(lastError)
          });
          
          // Request manual intervention for configuration errors
          if (this.classifyError(lastError) === 'configuration') {
            const shouldContinue = await this.requestManualIntervention(lastError, task);
            if (!shouldContinue) {
              this.log('info', 'Execution stopped by user request');
              break;
            }
          }
        }
      }
      
      const duration = Date.now() - startTime;
      this.log('info', `Execution completed: ${results.completed} completed, ${results.failed} failed`, {
        duration,
        totalTasks: results.totalTasks,
        recoveredFromCheckpoint: results.recoveredFromCheckpoint
      });
      
      return {
        ...results,
        duration,
        success: results.failed === 0
      };
    } catch (error) {
      this.log('error', 'Fatal error during task execution with recovery', { error: error.message });
      throw new TaskExecutionError('Fatal error during task execution with recovery', error);
    }
  }

  /**
   * Clear execution log
   */
  clearExecutionLog() {
    this.executionLog = [];
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