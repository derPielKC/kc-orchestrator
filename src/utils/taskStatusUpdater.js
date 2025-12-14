/**
 * Task Status Updater Utility
 * 
 * Updates task status in various IMPLEMENTATION_GUIDE.json structures
 */

const fs = require('fs');
const path = require('path');

/**
 * Update task status in guide (supports various structures)
 * 
 * @param {string} filePath - Path to IMPLEMENTATION_GUIDE.json
 * @param {string} taskId - Task ID to update
 * @param {string} newStatus - New status (todo, in_progress, completed, failed)
 * @param {object} options - Additional options
 * @returns {boolean} True if successful, false otherwise
 */
function updateTaskStatusInGuide(filePath, taskId, newStatus, options = {}) {
  try {
    // Read guide
    const content = fs.readFileSync(filePath, 'utf8');
    const guide = JSON.parse(content);
    
    // Normalize status
    let normalizedStatus = newStatus;
    if (normalizedStatus === 'pending') normalizedStatus = 'todo';
    if (normalizedStatus === 'done') normalizedStatus = 'completed';
    
    // Try to find and update task in different structures
    let updated = false;
    
    // Standard structure: { tasks: [...] }
    if (Array.isArray(guide.tasks)) {
      const task = guide.tasks.find(t => t.id === taskId);
      if (task) {
        task.status = normalizedStatus;
        if (options.error) {
          task.error = options.error;
        }
        updated = true;
      }
    }
    
    // Epic-based structure: { epics: [{ chunks: [...] }] }
    if (!updated && Array.isArray(guide.epics)) {
      for (const epic of guide.epics) {
        if (Array.isArray(epic.chunks)) {
          const chunk = epic.chunks.find(c => (c.id === taskId || c.chunk_id === taskId));
          if (chunk) {
            chunk.status = normalizedStatus;
            if (options.error) {
              chunk.error = options.error;
            }
            updated = true;
            break;
          }
        }
        if (Array.isArray(epic.tasks)) {
          const task = epic.tasks.find(t => (t.id === taskId || t.chunk_id === taskId));
          if (task) {
            task.status = normalizedStatus;
            if (options.error) {
              task.error = options.error;
            }
            updated = true;
            break;
          }
        }
      }
    }
    
    // Policy-based structure: { meta: { policies: [...] } }
    if (!updated && guide.meta && Array.isArray(guide.meta.policies)) {
      const policy = guide.meta.policies.find(p => (p.id === taskId || p.chunk_id === taskId));
      if (policy) {
        policy.status = normalizedStatus;
        if (options.error) {
          policy.error = options.error;
        }
        updated = true;
      }
    }
    
    if (!updated) {
      console.warn(`Task ${taskId} not found in guide for status update`);
      return false;
    }
    
    // Write updated guide
    // Create backup
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
    }
    
    // Write to temporary file first (atomic write)
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(guide, null, 2), 'utf8');
    
    // Atomic rename
    fs.renameSync(tempPath, filePath);
    
    return true;
  } catch (error) {
    console.error(`Failed to update task status: ${error.message}`);
    return false;
  }
}

/**
 * Check if guide structure supports status updates
 * 
 * @param {object} guide - The guide object
 * @returns {boolean} True if structure supports status updates
 */
function canUpdateStatus(guide) {
  if (!guide || typeof guide !== 'object') return false;
  
  // Standard structure
  if (Array.isArray(guide.tasks)) return true;
  
  // Epic structure
  if (Array.isArray(guide.epics)) {
    return guide.epics.some(epic => 
      Array.isArray(epic.chunks) || Array.isArray(epic.tasks)
    );
  }
  
  // Policy structure
  if (guide.meta && Array.isArray(guide.meta.policies)) return true;
  
  return false;
}

module.exports = {
  updateTaskStatusInGuide,
  canUpdateStatus
};
