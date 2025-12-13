/**
 * Task Status Tracker Tests
 * 
 * Comprehensive tests for the TaskStatusTracker class
 */

const { TaskStatusTracker } = require('../src/status');
const { readGuide, writeGuide } = require('../src/config');
const fs = require('fs');
const path = require('path');

// Mock data
const mockGuide = {
  "project": "test-project",
  "tasks": [
    {
      "id": "T1",
      "title": "Task 1",
      "status": "todo",
      "acceptanceCriteria": ["Criteria 1"]
    },
    {
      "id": "T2",
      "title": "Task 2",
      "status": "in_progress",
      "acceptanceCriteria": ["Criteria 2"]
    },
    {
      "id": "T3",
      "title": "Task 3",
      "status": "completed",
      "acceptanceCriteria": ["Criteria 3"]
    }
  ]
};

const testGuidePath = path.join(__dirname, 'test-status-guide.json');

describe('TaskStatusTracker', () => {
  let tracker;
  
  beforeEach(() => {
    // Create test guide file
    fs.writeFileSync(testGuidePath, JSON.stringify(mockGuide, null, 2));
    tracker = new TaskStatusTracker(testGuidePath);
  });
  
  afterEach(() => {
    // Clean up test guide file
    try {
      fs.unlinkSync(testGuidePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create tracker with guide path', () => {
      expect(tracker.guidePath).toBe(testGuidePath);
      expect(tracker.statusHistory).toBeInstanceOf(Map);
      expect(tracker.lockedTasks).toBeInstanceOf(Set);
    });
  });

  describe('getTaskStatus', () => {
    test('should return status for existing task', async () => {
      const status = await tracker.getTaskStatus('T1');
      expect(status).toBe('todo');
    });

    test('should return status for in_progress task', async () => {
      const status = await tracker.getTaskStatus('T2');
      expect(status).toBe('in_progress');
    });

    test('should throw error for non-existent task', async () => {
      await expect(tracker.getTaskStatus('T99')).rejects.toThrow('Failed to get status for task T99');
    });

    test('should throw error when guide is invalid', async () => {
      // Create invalid guide
      fs.writeFileSync(testGuidePath, 'invalid json');
      
      await expect(tracker.getTaskStatus('T1')).rejects.toThrow('Failed to get status for task T1');
    });
  });

  describe('updateTaskStatus', () => {
    test('should update task status with valid transition', async () => {
      const result = await tracker.updateTaskStatus('T1', 'in_progress');
      
      expect(result.success).toBe(true);
      expect(result.taskId).toBe('T1');
      expect(result.oldStatus).toBe('todo');
      expect(result.newStatus).toBe('in_progress');
      
      // Verify status was updated in file
      const guide = await readGuide(testGuidePath);
      const task = guide.tasks.find(t => t.id === 'T1');
      expect(task.status).toBe('in_progress');
    });

    test('should track status change in history', async () => {
      await tracker.updateTaskStatus('T1', 'in_progress');
      
      const history = tracker.getStatusHistory('T1');
      expect(history).toHaveLength(1);
      expect(history[0].taskId).toBe('T1');
      expect(history[0].from).toBe('todo');
      expect(history[0].to).toBe('in_progress');
      expect(history[0].timestamp).toBeDefined();
    });

    test('should allow transition from in_progress to completed', async () => {
      const result = await tracker.updateTaskStatus('T2', 'completed');
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('completed');
    });

    test('should allow transition from in_progress to failed', async () => {
      const result = await tracker.updateTaskStatus('T2', 'failed', { error: 'Test error' });
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('failed');
    });

    test('should allow transition from failed to in_progress', async () => {
      // First, make a task failed
      await tracker.updateTaskStatus('T2', 'failed');
      
      // Then retry it
      const result = await tracker.updateTaskStatus('T2', 'in_progress');
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('in_progress');
    });

    test('should throw error for invalid status transition', async () => {
      await expect(tracker.updateTaskStatus('T1', 'completed')).rejects.toThrow(
        'Invalid status transition: todo -> completed for task T1'
      );
    });

    test('should throw error for transition from completed', async () => {
      await expect(tracker.updateTaskStatus('T3', 'in_progress')).rejects.toThrow(
        'Invalid status transition: completed -> in_progress for task T3'
      );
    });

    test('should allow forced update without validation', async () => {
      const result = await tracker.updateTaskStatus('T1', 'completed', { force: true });
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('completed');
    });

    test('should prevent concurrent updates to same task', async () => {
      // Manually lock the task to simulate concurrent access
      tracker.lockedTasks.add('T1');
      
      // Try update while task is locked
      await expect(tracker.updateTaskStatus('T1', 'in_progress')).rejects.toThrow(
        'Task T1 is currently being updated'
      );
      
      // Clean up
      tracker.lockedTasks.delete('T1');
    });

    test('should handle errors during status update', async () => {
      // Create invalid guide to cause error
      fs.writeFileSync(testGuidePath, 'invalid json');
      
      await expect(tracker.updateTaskStatus('T1', 'in_progress')).rejects.toThrow(
        'Failed to get status for task T1'
      );
    });
  });

  describe('Status History', () => {
    test('should track multiple status changes', async () => {
      await tracker.updateTaskStatus('T1', 'in_progress');
      await tracker.updateTaskStatus('T1', 'completed');
      
      const history = tracker.getStatusHistory('T1');
      expect(history).toHaveLength(2);
      expect(history[0].to).toBe('in_progress');
      expect(history[1].to).toBe('completed');
    });

    test('should return empty array for task with no history', () => {
      const history = tracker.getStatusHistory('T99');
      expect(history).toHaveLength(0);
    });

    test('should return all status history', async () => {
      await tracker.updateTaskStatus('T1', 'in_progress');
      await tracker.updateTaskStatus('T2', 'completed');
      
      const allHistory = tracker.getAllStatusHistory();
      expect(allHistory.T1).toHaveLength(1);
      expect(allHistory.T2).toHaveLength(1);
      expect(allHistory.T3).toBeUndefined();
    });
  });

  describe('getTasksByStatus', () => {
    test('should return tasks by single status', async () => {
      const todoTasks = await tracker.getTasksByStatus('todo');
      expect(todoTasks).toHaveLength(1);
      expect(todoTasks[0].id).toBe('T1');
    });

    test('should return tasks by multiple statuses', async () => {
      const tasks = await tracker.getTasksByStatus(['todo', 'in_progress']);
      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.id)).toContain('T1');
      expect(tasks.map(t => t.id)).toContain('T2');
    });

    test('should return empty array for non-existent status', async () => {
      const tasks = await tracker.getTasksByStatus('nonexistent');
      expect(tasks).toHaveLength(0);
    });

    test('should handle invalid guide gracefully', async () => {
      fs.writeFileSync(testGuidePath, 'invalid json');
      
      // The method returns empty array for invalid guides
      const tasks = await tracker.getTasksByStatus('todo');
      expect(tasks).toHaveLength(0);
    });
  });

  describe('getExecutionStatistics', () => {
    test('should return correct statistics', async () => {
      const stats = await tracker.getExecutionStatistics();
      
      expect(stats.total).toBe(3);
      expect(stats.todo).toBe(1);
      expect(stats.in_progress).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.completionRate).toBeCloseTo(33.33, 1);
    });

    test('should handle empty guide', async () => {
      const emptyGuide = {
        project: "test-project",
        tasks: []
      };
      fs.writeFileSync(testGuidePath, JSON.stringify(emptyGuide, null, 2));
      
      const stats = await tracker.getExecutionStatistics();
      expect(stats.total).toBe(0);
      expect(stats.completionRate).toBe(0);
    });

    test('should handle invalid guide', async () => {
      fs.writeFileSync(testGuidePath, 'invalid json');
      
      // The method returns default stats for invalid guides
      const stats = await tracker.getExecutionStatistics();
      expect(stats.total).toBe(0);
      expect(stats.completionRate).toBe(0);
    });
  });

  describe('getCurrentExecutionSummary', () => {
    test('should return comprehensive execution summary', async () => {
      const summary = await tracker.getCurrentExecutionSummary();
      
      expect(summary.timestamp).toBeDefined();
      expect(summary.status.totalTasks).toBe(3);
      expect(summary.status.readyToExecute).toBe(1);
      expect(summary.status.currentlyExecuting).toBe(1);
      expect(summary.status.completedSuccessfully).toBe(1);
      expect(summary.status.failed).toBe(0);
      expect(summary.progress.completionRate).toBeCloseTo(33.33, 1);
      expect(summary.progress.remainingTasks).toBe(2);
      expect(summary.progress.tasksWithIssues).toBe(0);
    });

    test('should handle empty guide', async () => {
      const emptyGuide = {
        project: "test-project",
        tasks: []
      };
      fs.writeFileSync(testGuidePath, JSON.stringify(emptyGuide, null, 2));
      
      const summary = await tracker.getCurrentExecutionSummary();
      expect(summary.status.totalTasks).toBe(0);
      expect(summary.progress.completionRate).toBe(0);
    });
  });

  describe('reset', () => {
    test('should clear status history and locks', async () => {
      await tracker.updateTaskStatus('T1', 'in_progress');
      tracker.lockedTasks.add('T1');
      
      expect(tracker.getStatusHistory('T1')).toHaveLength(1);
      expect(tracker.lockedTasks.size).toBe(1);
      
      tracker.reset();
      
      expect(tracker.getStatusHistory('T1')).toHaveLength(0);
      expect(tracker.lockedTasks.size).toBe(0);
    });
  });
});