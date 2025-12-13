/**
 * Task Status Tracking System
 * 
 * This module provides comprehensive task status tracking and management
 * for the kc-orchestrator execution engine.
 */

const { readGuide, writeGuide, updateTaskStatus } = require('./config');
const { TaskExecutionError } = require('./errors');

/**
 * Task Status Tracker
 * 
 * Tracks and manages task execution status with persistence and history.
 */
class TaskStatusTracker {
  /**
   * Create a new TaskStatusTracker instance
   * 
   * @param {string} guidePath - Path to IMPLEMENTATION_GUIDE.json
   */
  constructor(guidePath) {
    this.guidePath = guidePath;
    this.statusHistory = new Map(); // taskId -> [statusChange1, statusChange2, ...]
    this.lockedTasks = new Set(); // Tasks currently being updated
  }

  /**
   * Get current status of a task
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<string>} Current status
   */
  async getTaskStatus(taskId) {
    try {
      const guide = await readGuide(this.guidePath);
      if (!guide || !guide.tasks) {
        throw new TaskExecutionError(`No tasks found in guide at ${this.guidePath}`);
      }
      
      const task = guide.tasks.find(t => t.id === taskId);
      if (!task) {
        const error = new Error(`Task ${taskId} not found in guide`);
        error.taskId = taskId;
        throw error;
      }
      
      return task.status;
    } catch (error) {
      throw new TaskExecutionError(`Failed to get status for task ${taskId}`, error);
    }
  }

  /**
   * Update task status with validation and history tracking
   * 
   * @param {string} taskId - Task ID
   * @param {string} newStatus - New status (todo, in_progress, completed, failed)
   * @param {Object} options - Additional options
   * @param {string} options.error - Error message for failed status
   * @param {boolean} options.force - Force update without validation
   * @returns {Promise<Object>} Status update result
   */
  async updateTaskStatus(taskId, newStatus, options = {}) {
    const { error, force = false } = options;
    
    // Validate status transition if not forced
    if (!force) {
      const validTransitions = {
        'todo': ['in_progress'],
        'in_progress': ['completed', 'failed'],
        'completed': [], // Terminal state
        'failed': ['in_progress'] // Allow retry
      };
      
      const currentStatus = await this.getTaskStatus(taskId);
      const allowedTransitions = validTransitions[currentStatus] || [];
      
      if (!allowedTransitions.includes(newStatus)) {
        throw new TaskExecutionError(
          `Invalid status transition: ${currentStatus} -> ${newStatus} for task ${taskId}`
        );
      }
    }
    
    // Prevent concurrent updates to the same task
    if (this.lockedTasks.has(taskId)) {
      throw new TaskExecutionError(`Task ${taskId} is currently being updated`);
    }
    
    try {
      this.lockedTasks.add(taskId);
      
      // Record status change in history
      const statusChange = {
        taskId,
        from: await this.getTaskStatus(taskId).catch(() => 'unknown'),
        to: newStatus,
        timestamp: new Date().toISOString(),
        error: error || null
      };
      
      if (!this.statusHistory.has(taskId)) {
        this.statusHistory.set(taskId, []);
      }
      this.statusHistory.get(taskId).push(statusChange);
      
      // Update the guide file
      await updateTaskStatus(this.guidePath, taskId, newStatus, { error });
      
      return {
        success: true,
        taskId,
        oldStatus: statusChange.from,
        newStatus,
        timestamp: statusChange.timestamp
      };
    } catch (error) {
      throw new TaskExecutionError(`Failed to update status for task ${taskId}`, error);
    } finally {
      this.lockedTasks.delete(taskId);
    }
  }

  /**
   * Get status history for a task
   * 
   * @param {string} taskId - Task ID
   * @returns {Array} Status change history
   */
  getStatusHistory(taskId) {
    return this.statusHistory.get(taskId) || [];
  }

  /**
   * Get all status history
   * 
   * @returns {Object} All status history by task ID
   */
  getAllStatusHistory() {
    const result = {};
    this.statusHistory.forEach((history, taskId) => {
      result[taskId] = history;
    });
    return result;
  }

  /**
   * Get tasks by status
   * 
   * @param {string|Array} status - Status or array of statuses to filter by
   * @returns {Promise<Array>} Array of tasks matching the status
   */
  async getTasksByStatus(status) {
    try {
      const guide = await readGuide(this.guidePath);
      if (!guide || !guide.tasks) {
        return [];
      }
      
      const statuses = Array.isArray(status) ? status : [status];
      return guide.tasks.filter(task => statuses.includes(task.status));
    } catch (error) {
      throw new TaskExecutionError('Failed to get tasks by status', error);
    }
  }

  /**
   * Get execution statistics
   * 
   * @returns {Promise<Object>} Execution statistics
   */
  async getExecutionStatistics() {
    try {
      const guide = await readGuide(this.guidePath);
      if (!guide || !guide.tasks) {
        return {
          total: 0,
          todo: 0,
          in_progress: 0,
          completed: 0,
          failed: 0,
          completionRate: 0
        };
      }
      
      const stats = {
        total: guide.tasks.length,
        todo: guide.tasks.filter(t => t.status === 'todo').length,
        in_progress: guide.tasks.filter(t => t.status === 'in_progress').length,
        completed: guide.tasks.filter(t => t.status === 'completed').length,
        failed: guide.tasks.filter(t => t.status === 'failed').length
      };
      
      stats.completionRate = stats.total > 0 
        ? (stats.completed / stats.total) * 100
        : 0;
      
      return stats;
    } catch (error) {
      throw new TaskExecutionError('Failed to get execution statistics', error);
    }
  }

  /**
   * Reset status tracker (for testing purposes)
   */
  reset() {
    this.statusHistory.clear();
    this.lockedTasks.clear();
  }

  /**
   * Get current execution summary
   * 
   * @returns {Promise<Object>} Current execution summary
   */
  async getCurrentExecutionSummary() {
    try {
      const stats = await this.getExecutionStatistics();
      
      return {
        timestamp: new Date().toISOString(),
        status: {
          totalTasks: stats.total,
          readyToExecute: stats.todo,
          currentlyExecuting: stats.in_progress,
          completedSuccessfully: stats.completed,
          failed: stats.failed
        },
        progress: {
          completionRate: stats.completionRate,
          remainingTasks: stats.todo + stats.in_progress,
          tasksWithIssues: stats.failed
        }
      };
    } catch (error) {
      throw new TaskExecutionError('Failed to get execution summary', error);
    }
  }
}

module.exports = {
  TaskStatusTracker
};