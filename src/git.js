/**
 * Git Workflow Integration
 * 
 * This module provides comprehensive git repository detection, validation,
 * and workflow management for the kc-orchestrator.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Git Repository Manager
 * 
 * Handles git repository detection, validation, and workflow operations.
 */
class GitRepositoryManager {
  /**
   * Create a new GitRepositoryManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.projectPath - Project directory path
   * @param {number} options.timeout - Command timeout in ms
   */
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.timeout = options.timeout || 30000; // 30 seconds
    this.gitCache = {
      isGitRepo: null,
      gitVersion: null,
      gitStatus: null,
      gitBranch: null,
      gitRemote: null
    };
  }

  /**
   * Check if git is installed and available
   * 
   * @returns {boolean} True if git is available
   */
  checkGitInstallation() {
    try {
      const result = execSync('git --version', {
        encoding: 'utf8',
        timeout: this.timeout
      });
      
      if (result && result.includes('git version')) {
        this.gitCache.gitVersion = result.trim();
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect if current directory is a git repository
   * 
   * @returns {boolean} True if in a git repository
   */
  isGitRepository() {
    // Return cached result if available
    if (this.gitCache.isGitRepo !== null) {
      return this.gitCache.isGitRepo;
    }

    try {
      // Check for .git directory
      const gitDir = path.join(this.projectPath, '.git');
      if (fs.existsSync(gitDir)) {
        this.gitCache.isGitRepo = true;
        return true;
      }

      // Try git command as fallback
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });
      
      this.gitCache.isGitRepo = true;
      return true;
    } catch (error) {
      this.gitCache.isGitRepo = false;
      return false;
    }
  }

  /**
   * Get git repository health status
   * 
   * @returns {Object} Repository health information
   */
  getRepositoryHealth() {
    if (!this.isGitRepository()) {
      return {
        healthy: false,
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Check git status
      const statusResult = execSync('git status --porcelain', {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });
      
      // Check current branch
      const branchResult = execSync('git branch --show-current', {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });
      
      // Check remote
      const remoteResult = execSync('git remote -v', {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      this.gitCache.gitStatus = statusResult.trim();
      this.gitCache.gitBranch = branchResult.trim();
      this.gitCache.gitRemote = remoteResult.trim();

      return {
        healthy: true,
        isGitRepository: true,
        gitVersion: this.gitCache.gitVersion,
        currentBranch: this.gitCache.gitBranch,
        hasUncommittedChanges: this.gitCache.gitStatus.length > 0,
        hasRemote: this.gitCache.gitRemote.includes('origin'),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        isGitRepository: true,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create a new git branch
   * 
   * @param {string} branchName - Name of the branch to create
   * @param {boolean} checkout - Whether to checkout the branch
   * @returns {Object} Operation result
   */
  createBranch(branchName, checkout = true) {
    if (!this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Check if branch already exists
      const existingBranches = execSync('git branch --list', {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });
      
      if (existingBranches.includes(branchName)) {
        return {
          success: false,
          error: `Branch ${branchName} already exists`,
          timestamp: new Date().toISOString()
        };
      }

      // Create the branch
      const command = checkout ? `git checkout -b ${branchName}` : `git branch ${branchName}`;
      execSync(command, {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      // Clear cache since branch changed
      this.clearCache();

      return {
        success: true,
        branchName,
        checkedOut: checkout,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        branchName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Checkout an existing git branch
   * 
   * @param {string} branchName - Name of the branch to checkout
   * @returns {Object} Operation result
   */
  checkoutBranch(branchName) {
    if (!this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      execSync(`git checkout ${branchName}`, {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      // Clear cache since branch changed
      this.clearCache();

      return {
        success: true,
        branchName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        branchName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * List all available git branches
   * 
   * @param {boolean} includeRemote - Include remote branches
   * @returns {Object} Operation result with branch list
   */
  listBranches(includeRemote = false) {
    if (!this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a git repository',
        branches: [],
        timestamp: new Date().toISOString()
      };
    }

    try {
      const command = includeRemote ? 'git branch -a' : 'git branch';
      const result = execSync(command, {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      const branches = result.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => ({
          name: line.replace(/^\*\s*/, '').replace(/^remotes\/\w+\//, ''),
          current: line.startsWith('*'),
          remote: line.startsWith('remotes/')
        }));

      return {
        success: true,
        branches,
        currentBranch: branches.find(b => b.current)?.name || null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        branches: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Delete a git branch
   * 
   * @param {string} branchName - Name of the branch to delete
   * @param {boolean} force - Force deletion (use with caution)
   * @returns {Object} Operation result
   */
  deleteBranch(branchName, force = false) {
    if (!this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Check if branch exists and is not current branch
      const branches = this.listBranches().branches;
      const branchToDelete = branches.find(b => b.name === branchName && !b.current);
      
      if (!branchToDelete) {
        return {
          success: false,
          error: `Branch ${branchName} does not exist or is currently checked out`,
          timestamp: new Date().toISOString()
        };
      }

      const forceFlag = force ? '-D' : '-d';
      execSync(`git branch ${forceFlag} ${branchName}`, {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      // Clear cache
      this.clearCache();

      return {
        success: true,
        branchName,
        force,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        branchName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate branch name according to git conventions
   * 
   * @param {string} branchName - Branch name to validate
   * @param {string} prefix - Optional branch prefix
   * @returns {Object} Validation result
   */
  validateBranchName(branchName, prefix = '') {
    const validationResult = {
      valid: true,
      errors: [],
      warnings: [],
      normalizedName: branchName
    };

    // Check if empty
    if (!branchName || typeof branchName !== 'string') {
      validationResult.valid = false;
      validationResult.errors.push('Branch name cannot be empty');
      return validationResult;
    }

    // Apply prefix if provided
    if (prefix) {
      validationResult.normalizedName = `${prefix}${branchName}`;
    }

    // Check length (git has limits, but be reasonable)
    if (validationResult.normalizedName.length > 100) {
      validationResult.valid = false;
      validationResult.errors.push('Branch name is too long (max 100 characters)');
    }

    // Check for invalid characters
    const invalidChars = /[^\w\-\./]/;
    if (invalidChars.test(validationResult.normalizedName)) {
      validationResult.valid = false;
      validationResult.errors.push('Branch name contains invalid characters');
    }

    // Check for git reserved names
    const reservedNames = ['HEAD', 'master', 'main', 'develop', 'development'];
    if (reservedNames.includes(validationResult.normalizedName.toLowerCase())) {
      validationResult.warnings.push('Branch name matches a commonly used branch name');
    }

    // Check for leading/trailing whitespace or special chars
    if (/^[^\w]/.test(validationResult.normalizedName) || /[^\w]$/.test(validationResult.normalizedName)) {
      validationResult.warnings.push('Branch name should not start or end with special characters');
    }

    return validationResult;
  }

  /**
   * Clean up merged branches
   * 
   * @param {string} baseBranch - Base branch to compare against
   * @param {boolean} dryRun - Dry run (list branches without deleting)
   * @returns {Object} Operation result
   */
  cleanupMergedBranches(baseBranch = 'main', dryRun = true) {
    if (!this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a git repository',
        deletedBranches: [],
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Get all branches
      const allBranches = this.listBranches().branches;
      const localBranches = allBranches.filter(b => !b.remote && !b.current && b.name !== baseBranch);

      if (localBranches.length === 0) {
        return {
          success: true,
          message: 'No local branches to clean up',
          deletedBranches: [],
          timestamp: new Date().toISOString()
        };
      }

      // Check which branches are merged
      const mergedBranches = [];
      for (const branch of localBranches) {
        try {
          execSync(`git branch --merged ${baseBranch} | grep ${branch.name}`, {
            cwd: this.projectPath,
            encoding: 'utf8',
            timeout: this.timeout
          });
          mergedBranches.push(branch.name);
        } catch (error) {
          // Branch not merged, skip
        }
      }

      if (mergedBranches.length === 0) {
        return {
          success: true,
          message: 'No merged branches found for cleanup',
          mergedBranches,
          deletedBranches: [],
          timestamp: new Date().toISOString()
        };
      }

      // Dry run - just return what would be deleted
      if (dryRun) {
        return {
          success: true,
          message: 'Dry run - branches that would be deleted',
          baseBranch,
          mergedBranches,
          deletedBranches: [],
          timestamp: new Date().toISOString()
        };
      }

      // Actually delete the branches
      const deletedBranches = [];
      for (const branchName of mergedBranches) {
        try {
          const result = this.deleteBranch(branchName, false);
          if (result.success) {
            deletedBranches.push(branchName);
          }
        } catch (error) {
          // Continue with next branch
        }
      }

      return {
        success: true,
        baseBranch,
        mergedBranches,
        deletedBranches,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        deletedBranches: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Commit changes to git repository
   * 
   * @param {string} message - Commit message
   * @param {Array} files - Specific files to commit (optional)
   * @returns {Object} Operation result
   */
  commitChanges(message, files = []) {
    if (!this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Add files if specified, otherwise add all
      if (files.length > 0) {
        execSync(`git add ${files.join(' ')}`, {
          cwd: this.projectPath,
          encoding: 'utf8',
          timeout: this.timeout
        });
      } else {
        execSync('git add .', {
          cwd: this.projectPath,
          encoding: 'utf8',
          timeout: this.timeout
        });
      }

      // Commit changes
      execSync(`git commit -m "${message}"`, {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      // Clear cache since status changed
      this.clearCache();

      return {
        success: true,
        message,
        files: files.length > 0 ? files.join(' ') : 'all files',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Push changes to remote repository
   * 
   * @param {string} remote - Remote name (default: 'origin')
   * @param {string} branch - Branch name (default: current branch)
   * @returns {Object} Operation result
   */
  pushChanges(remote = 'origin', branch = null) {
    if (!this.isGitRepository()) {
      return {
        success: false,
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Get current branch if not specified
      if (!branch) {
        const branchResult = execSync('git branch --show-current', {
          cwd: this.projectPath,
          encoding: 'utf8',
          timeout: this.timeout
        });
        branch = branchResult.trim();
      }

      execSync(`git push ${remote} ${branch}`, {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      return {
        success: true,
        remote,
        branch,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        remote,
        branch,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get current git status
   * 
   * @returns {Object} Git status information
   */
  getGitStatus() {
    if (!this.isGitRepository()) {
      return {
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Use cached result if available
      if (this.gitCache.gitStatus !== null) {
        return {
          status: this.gitCache.gitStatus,
          cached: true,
          timestamp: new Date().toISOString()
        };
      }

      const result = execSync('git status --porcelain', {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      this.gitCache.gitStatus = result.trim();

      return {
        status: this.gitCache.gitStatus,
        cached: false,
        hasChanges: this.gitCache.gitStatus.length > 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get current git branch
   * 
   * @returns {Object} Git branch information
   */
  getCurrentBranch() {
    if (!this.isGitRepository()) {
      return {
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Use cached result if available
      if (this.gitCache.gitBranch !== null) {
        return {
          branch: this.gitCache.gitBranch,
          cached: true,
          timestamp: new Date().toISOString()
        };
      }

      const result = execSync('git branch --show-current', {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      this.gitCache.gitBranch = result.trim();

      return {
        branch: this.gitCache.gitBranch,
        cached: false,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get git remotes
   * 
   * @returns {Object} Git remote information
   */
  getGitRemotes() {
    if (!this.isGitRepository()) {
      return {
        error: 'Not a git repository',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Use cached result if available
      if (this.gitCache.gitRemote !== null) {
        return {
          remotes: this.gitCache.gitRemote,
          cached: true,
          timestamp: new Date().toISOString()
        };
      }

      const result = execSync('git remote -v', {
        cwd: this.projectPath,
        encoding: 'utf8',
        timeout: this.timeout
      });

      this.gitCache.gitRemote = result.trim();

      return {
        remotes: this.gitCache.gitRemote,
        cached: false,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clear git cache
   */
  clearCache() {
    this.gitCache = {
      isGitRepo: null,
      gitVersion: null,
      gitStatus: null,
      gitBranch: null,
      gitRemote: null
    };
  }

  /**
   * Get comprehensive git information
   * 
   * @returns {Object} Comprehensive git information
   */
  async getComprehensiveGitInfo() {
    const health = this.getRepositoryHealth();
    const status = this.getGitStatus();
    const branch = this.getCurrentBranch();
    const remotes = this.getGitRemotes();

    return {
      timestamp: new Date().toISOString(),
      isGitRepository: health.isGitRepository !== undefined ? health.isGitRepository : this.isGitRepository(),
      healthy: health.healthy,
      gitVersion: health.gitVersion,
      currentBranch: branch.branch || health.currentBranch,
      hasUncommittedChanges: status.hasChanges !== undefined ? status.hasChanges : false,
      hasRemote: remotes.remotes ? remotes.remotes.includes('origin') : false,
      status: status.status || '',
      remotes: remotes.remotes || '',
      error: health.error || status.error || branch.error || remotes.error
    };
  }
}

module.exports = {
  GitRepositoryManager
};