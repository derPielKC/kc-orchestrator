const fs = require('fs');
const path = require('path');

/**
 * Validates an IMPLEMENTATION_GUIDE.json structure
 * 
 * @param {object} guide - The guide object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateImplementationGuide(guide) {
  if (!guide || typeof guide !== 'object') {
    return false;
  }
  
  // Check required fields
  if (!guide.project || typeof guide.project !== 'string') {
    return false;
  }
  
  if (!guide.tasks || !Array.isArray(guide.tasks)) {
    return false;
  }
  
  // Validate each task has required fields
  for (const task of guide.tasks) {
    if (!task.id || typeof task.id !== 'string') {
      return false;
    }
    if (!task.title || typeof task.title !== 'string') {
      return false;
    }
    if (!task.status || typeof task.status !== 'string') {
      return false;
    }
    if (!task.acceptanceCriteria || !Array.isArray(task.acceptanceCriteria)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Reads an IMPLEMENTATION_GUIDE.json file
 * 
 * @param {string} filePath - Path to the IMPLEMENTATION_GUIDE.json file
 * @returns {object|null} Parsed guide object or null if invalid
 */
function readGuide(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const guide = JSON.parse(content);
    
    if (validateImplementationGuide(guide)) {
      return guide;
    } else {
      console.warn(`Invalid IMPLEMENTATION_GUIDE.json structure at ${filePath}`);
      return null;
    }
  } catch (error) {
    console.error(`Failed to read or parse ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Writes an IMPLEMENTATION_GUIDE.json file atomically
 * 
 * @param {string} filePath - Path to the IMPLEMENTATION_GUIDE.json file
 * @param {object} guide - The guide object to write
 * @returns {boolean} True if successful, false otherwise
 */
function writeGuide(filePath, guide) {
  if (!validateImplementationGuide(guide)) {
    console.error('Cannot write invalid guide structure');
    return false;
  }
  
  try {
    // Create backup if file exists
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
    }
    
    // Write to temporary file first
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(guide, null, 2), 'utf8');
    
    // Atomic rename
    fs.renameSync(tempPath, filePath);
    
    return true;
  } catch (error) {
    console.error(`Failed to write ${filePath}: ${error.message}`);
    
    // Try to clean up temp file if it exists
    try {
      const tempFiles = fs.readdirSync(path.dirname(filePath))
        .filter(f => f.startsWith(path.basename(filePath) + '.tmp'));
      for (const tempFile of tempFiles) {
        fs.unlinkSync(path.join(path.dirname(filePath), tempFile));
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return false;
  }
}

/**
 * Updates task status in an IMPLEMENTATION_GUIDE.json file
 * 
 * @param {string} filePath - Path to the IMPLEMENTATION_GUIDE.json file
 * @param {string} taskId - ID of the task to update
 * @param {string} newStatus - New status (todo, in_progress, completed, failed)
 * @returns {boolean} True if successful, false otherwise
 */
function updateTaskStatus(filePath, taskId, newStatus) {
  const guide = readGuide(filePath);
  if (!guide) {
    return false;
  }
  
  const validStatuses = ['todo', 'in_progress', 'completed', 'failed'];
  if (!validStatuses.includes(newStatus)) {
    console.error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`);
    return false;
  }
  
  const task = guide.tasks.find(t => t.id === taskId);
  if (!task) {
    console.error(`Task with ID ${taskId} not found`);
    return false;
  }
  
  // Validate status transition
  const validTransitions = {
    'todo': ['in_progress'],
    'in_progress': ['completed', 'failed', 'todo'],
    'completed': ['todo', 'in_progress'],
    'failed': ['todo', 'in_progress']
  };
  
  if (!validTransitions[task.status].includes(newStatus)) {
    console.error(`Invalid status transition from ${task.status} to ${newStatus}`);
    return false;
  }
  
  task.status = newStatus;
  
  return writeGuide(filePath, guide);
}

/**
 * Gets current status of a task
 * 
 * @param {string} filePath - Path to the IMPLEMENTATION_GUIDE.json file
 * @param {string} taskId - ID of the task to check
 * @returns {string|null} Current status or null if not found
 */
function getTaskStatus(filePath, taskId) {
  const guide = readGuide(filePath);
  if (!guide) {
    return null;
  }
  
  const task = guide.tasks.find(t => t.id === taskId);
  return task ? task.status : null;
}

/**
 * Gets all tasks with a specific status
 * 
 * @param {string} filePath - Path to the IMPLEMENTATION_GUIDE.json file
 * @param {string} status - Status to filter by
 * @returns {Array<object>} Array of tasks with the specified status
 */
function getTasksByStatus(filePath, status) {
  const guide = readGuide(filePath);
  if (!guide) {
    return [];
  }
  
  return guide.tasks.filter(t => t.status === status);
}

/**
 * Creates a default IMPLEMENTATION_GUIDE.json structure for interview mode
 * 
 * @param {string} projectName - Name of the project
 * @param {string} description - Project description
 * @returns {object} Default guide structure
 */
function createDefaultGuide(projectName, description) {
  return {
    project: projectName,
    description: description,
    phases: [],
    tasks: [],
    createdAt: new Date().toISOString(),
    version: '1.0'
  };
}

module.exports = {
  validateImplementationGuide,
  readGuide,
  writeGuide,
  updateTaskStatus,
  getTaskStatus,
  getTasksByStatus,
  createDefaultGuide
};