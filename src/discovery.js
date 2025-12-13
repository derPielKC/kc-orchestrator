const fs = require('fs');
const path = require('path');

/**
 * Finds the repository root by walking up the directory tree
 * looking for a .git directory or git root marker.
 * 
 * @param {string} [startDir=process.cwd()] - Directory to start searching from
 * @param {number} [maxDepth=100] - Maximum depth to search
 * @returns {string|null} Absolute path to repository root, or null if not found
 */
function findRepoRoot(startDir = process.cwd(), maxDepth = 100) {
  let currentDir = path.resolve(startDir);
  let depth = 0;
  
  while (depth < maxDepth) {
    // Check for .git directory (standard git repository)
    const gitDir = path.join(currentDir, '.git');
    if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
      return currentDir;
    }
    
    // Check for git root marker (alternative indicator)
    const gitRootMarker = path.join(currentDir, '.gitroot');
    if (fs.existsSync(gitRootMarker)) {
      return currentDir;
    }
    
    // Move up one directory
    const parentDir = path.dirname(currentDir);
    
    // If we've reached the root, stop searching
    if (parentDir === currentDir) {
      break;
    }
    
    currentDir = parentDir;
    depth++;
  }
  
  return null;
}

/**
 * Finds the repository root using git command (more reliable but requires git)
 * 
 * @param {string} [startDir=process.cwd()] - Directory to start searching from
 * @returns {string|null} Absolute path to repository root, or null if not found
 */
function findRepoRootWithGit(startDir = process.cwd()) {
  try {
    const { execSync } = require('child_process');
    const result = execSync('git rev-parse --show-toplevel', {
      cwd: startDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Ignore stderr
    });
    return result.trim();
  } catch (error) {
    // Git command failed - either not a git repo or git not available
    return null;
  }
}

/**
 * Main function to find repository root, tries git command first, then manual search
 * 
 * @param {string} [startDir=process.cwd()] - Directory to start searching from
 * @returns {string|null} Absolute path to repository root, or null if not found
 */
function findRepositoryRoot(startDir = process.cwd()) {
  // Try git command first (more reliable)
  const gitResult = findRepoRootWithGit(startDir);
  if (gitResult) {
    return gitResult;
  }
  
  // Fallback to manual search
  return findRepoRoot(startDir);
}

/**
 * Recursively finds all IMPLEMENTATION_GUIDE.json files in a directory
 * 
 * @param {string} [searchDir=process.cwd()] - Directory to start searching from
 * @param {string[]} [excludePatterns=['node_modules', '.git']] - Patterns to exclude
 * @param {number} [maxDepth=20] - Maximum depth to search
 * @returns {Array<{path: string, dir: string, content: object}>} Array of project information
 */
function findProjects(searchDir = process.cwd(), excludePatterns = ['node_modules', '.git'], maxDepth = 20) {
  const projects = [];
  const searchRoot = path.resolve(searchDir);
  
  function searchDirectory(currentDir, currentDepth) {
    if (currentDepth > maxDepth) {
      return;
    }
    
    // Check if this directory should be excluded
    const dirName = path.basename(currentDir);
    if (excludePatterns.includes(dirName)) {
      return;
    }
    
    try {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively search subdirectories
          searchDirectory(fullPath, currentDepth + 1);
        } else if (file === 'IMPLEMENTATION_GUIDE.json') {
          // Found an implementation guide file
          try {
            const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            projects.push({
              path: fullPath,
              dir: currentDir,
              content: content
            });
          } catch (parseError) {
            console.warn(`Failed to parse IMPLEMENTATION_GUIDE.json at ${fullPath}: ${parseError.message}`);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Failed to read directory ${currentDir}: ${error.message}`);
    }
  }
  
  searchDirectory(searchRoot, 0);
  return projects;
}

/**
 * Finds projects starting from the repository root
 * 
 * @param {string} [startDir=process.cwd()] - Directory to start searching from
 * @param {string[]} [excludePatterns=['node_modules', '.git']] - Patterns to exclude
 * @returns {Array<{path: string, dir: string, content: object}>} Array of project information
 */
function findProjectsFromRepoRoot(startDir = process.cwd(), excludePatterns = ['node_modules', '.git']) {
  // First find the repository root
  const repoRoot = findRepositoryRoot(startDir);
  
  if (!repoRoot) {
    console.warn('Not in a git repository, searching from current directory');
    return findProjects(startDir, excludePatterns);
  }
  
  return findProjects(repoRoot, excludePatterns);
}

module.exports = {
  findRepoRoot,
  findRepoRootWithGit,
  findRepositoryRoot,
  findProjects,
  findProjectsFromRepoRoot
};