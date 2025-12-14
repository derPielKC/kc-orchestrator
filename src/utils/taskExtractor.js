/**
 * Task Extractor Utility
 * 
 * Extracts and normalizes tasks from various IMPLEMENTATION_GUIDE.json structures
 */

/**
 * Extract tasks from guide with various structure support
 * 
 * @param {object} guide - The guide object
 * @returns {Array} Array of normalized tasks
 */
function extractTasks(guide) {
  if (!guide || typeof guide !== 'object') {
    return [];
  }
  
  let tasks = [];
  
  // Standard structure: { tasks: [...] }
  if (Array.isArray(guide.tasks)) {
    tasks = guide.tasks;
  }
  // Epic-based structure: { epics: [{ tasks: [...], chunks: [...] }] }
  else if (Array.isArray(guide.epics)) {
    guide.epics.forEach(epic => {
      if (Array.isArray(epic.tasks)) {
        tasks.push(...epic.tasks.map(t => ({ ...t, epic: epic.id || epic.name })));
      }
      if (Array.isArray(epic.chunks)) {
        // Chunks use chunk_id instead of id
        tasks.push(...epic.chunks.map(c => ({ 
          ...c, 
          id: c.id || c.chunk_id, // Ensure id field exists
          epic: epic.id || epic.name 
        })));
      }
    });
  }
  // Policy-based structure: { meta: { policies: [...] } }
  else if (guide.meta && Array.isArray(guide.meta.policies)) {
    tasks = guide.meta.policies.filter(p => p.chunk_id || p.id);
  }
  
  // Normalize task structure
  return tasks.map(task => normalizeTask(task));
}

/**
 * Normalize a task object to standard structure
 * 
 * @param {object} task - Task object in any format
 * @returns {object} Normalized task object
 */
function normalizeTask(task) {
  if (!task || typeof task !== 'object') {
    return null;
  }
  
  // Extract ID - be more thorough
  let id = task.id || task.chunk_id || task.taskId;
  
  // If still no ID, try to generate one from other fields
  if (!id) {
    // Try to use description/title as fallback (hash it for uniqueness)
    const fallback = task.description || task.title || task.name;
    if (fallback) {
      const crypto = require('crypto');
      id = 'TASK-' + crypto.createHash('md5').update(fallback.substring(0, 50)).digest('hex').substring(0, 8);
    } else {
      id = 'unknown';
    }
  }
  
  // Extract title
  const title = task.title || task.description || task.name || 'Untitled Task';
  
  // Extract status (normalize to standard values)
  let status = task.status || 'todo';
  if (status === 'pending') status = 'todo';
  if (status === 'done') status = 'completed';
  if (status === 'in_progress' || status === 'in-progress') status = 'in_progress';
  
  // Build normalized task
  const normalized = {
    id,
    title,
    status,
    // Preserve original data
    ...task
  };
  
  // Ensure required fields
  normalized.id = id;
  normalized.title = title;
  normalized.status = status;
  
  // Add default acceptanceCriteria if missing
  if (!normalized.acceptanceCriteria || !Array.isArray(normalized.acceptanceCriteria)) {
    normalized.acceptanceCriteria = [];
  }
  
  return normalized;
}

/**
 * Get project name from guide
 * 
 * @param {object} guide - The guide object
 * @returns {string} Project name
 */
function getProjectName(guide) {
  if (!guide) return 'unknown';
  return guide.project || (guide.meta && guide.meta.project) || 'unknown';
}

/**
 * Find task by ID in guide
 * 
 * @param {object} guide - The guide object
 * @param {string} taskId - Task ID to find
 * @returns {object|null} Found task or null
 */
function findTaskById(guide, taskId) {
  const tasks = extractTasks(guide);
  return tasks.find(t => {
    const normalized = normalizeTask(t);
    return normalized && normalized.id === taskId;
  }) || null;
}

/**
 * Get tasks by status
 * 
 * @param {object} guide - The guide object
 * @param {string} status - Status to filter by
 * @returns {Array} Filtered tasks
 */
function getTasksByStatus(guide, status) {
  const tasks = extractTasks(guide);
  return tasks.filter(t => {
    const normalized = normalizeTask(t);
    return normalized && normalized.status === status;
  });
}

/**
 * Get tasks ready for execution (todo or in_progress)
 * 
 * @param {object} guide - The guide object
 * @returns {Array} Tasks ready for execution
 */
function getTasksForExecution(guide) {
  const tasks = extractTasks(guide);
  return tasks.filter(t => {
    const normalized = normalizeTask(t);
    const status = normalized?.status || 'todo';
    return status === 'todo' || status === 'in_progress' || status === 'pending';
  });
}

module.exports = {
  extractTasks,
  normalizeTask,
  getProjectName,
  findTaskById,
  getTasksByStatus,
  getTasksForExecution
};
