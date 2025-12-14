/**
 * Git Workflow Integration Tests
 * 
 * Comprehensive tests for the GitRepositoryManager class
 */

const { GitRepositoryManager } = require('../src/git');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test setup
const testProjectPath = path.join(__dirname, 'test-git-project');
const testRepoPath = path.join(testProjectPath, 'test-repo');
const nonRepoPath = path.join(testProjectPath, 'non-repo');

describe('GitRepositoryManager', () => {
  let gitManager;
  let repoGitManager;
  let nonRepoGitManager;
  
  beforeAll(() => {
    // Create test directories
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }
    
    if (!fs.existsSync(nonRepoPath)) {
      fs.mkdirSync(nonRepoPath, { recursive: true });
    }
    
    // Initialize a test git repository if it doesn't exist
    if (!fs.existsSync(path.join(testRepoPath, '.git'))) {
      fs.mkdirSync(testRepoPath, { recursive: true });
      execSync('git init', { cwd: testRepoPath });
      execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
      execSync('git config user.name "Test User"', { cwd: testRepoPath });
      
      // Create initial commit
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repository');
      execSync('git add README.md', { cwd: testRepoPath });
      execSync('git commit -m "Initial commit"', { cwd: testRepoPath });
    }
  });
  
  beforeEach(() => {
    gitManager = new GitRepositoryManager();
    repoGitManager = new GitRepositoryManager({ projectPath: testRepoPath });
    nonRepoGitManager = new GitRepositoryManager({ projectPath: nonRepoPath });
  });

  describe('Constructor', () => {
    test('should create manager with default options', () => {
      expect(gitManager.projectPath).toBe(process.cwd());
      expect(gitManager.timeout).toBe(30000);
      expect(gitManager.gitCache).toBeDefined();
    });

    test('should create manager with custom options', () => {
      const customManager = new GitRepositoryManager({
        projectPath: '/custom/path',
        timeout: 60000
      });
      
      expect(customManager.projectPath).toBe('/custom/path');
      expect(customManager.timeout).toBe(60000);
    });
  });

  describe('checkGitInstallation', () => {
    test('should return true when git is installed', () => {
      const result = gitManager.checkGitInstallation();
      expect(result).toBe(true);
      expect(gitManager.gitCache.gitVersion).toBeDefined();
      expect(gitManager.gitCache.gitVersion).toContain('git version');
    });

    test('should cache git version', () => {
      gitManager.checkGitInstallation();
      const cachedVersion = gitManager.gitCache.gitVersion;
      
      gitManager.checkGitInstallation();
      expect(gitManager.gitCache.gitVersion).toBe(cachedVersion);
    });
  });

  describe('isGitRepository', () => {
    test('should return true for git repository', () => {
      const result = repoGitManager.isGitRepository();
      expect(result).toBe(true);
    });

    test('should return false for non-git directory', () => {
      const result = nonRepoGitManager.isGitRepository();
      expect(result).toBe(false);
    });

    test('should cache repository detection result', () => {
      repoGitManager.isGitRepository();
      expect(repoGitManager.gitCache.isGitRepo).toBe(true);
      
      const cachedResult = repoGitManager.isGitRepository();
      expect(cachedResult).toBe(true);
    });
  });

  describe('getRepositoryHealth', () => {
    test('should return health information for valid repository', () => {
      // Ensure we're on master branch
      repoGitManager.checkoutBranch('master');
      
      const health = repoGitManager.getRepositoryHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.isGitRepository).toBe(true);
      expect(health.gitVersion).toBeDefined();
      expect(health.currentBranch).toBe('master');
      expect(health.hasUncommittedChanges).toBe(false);
      expect(health.hasRemote).toBe(false);
    });

    test('should return error for non-git directory', () => {
      const health = nonRepoGitManager.getRepositoryHealth();
      
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Not a git repository');
    });

    test('should detect uncommitted changes', () => {
      // Create a new file in the test repo
      const testFile = path.join(testRepoPath, 'test-file.txt');
      fs.writeFileSync(testFile, 'test content');
      
      const health = repoGitManager.getRepositoryHealth();
      expect(health.hasUncommittedChanges).toBe(true);
      
      // Clean up
      fs.unlinkSync(testFile);
    });
  });

  describe('Branch Management', () => {
    test('should create and checkout new branch', () => {
      const branchName = 'test-branch-' + Date.now();
      
      const result = repoGitManager.createBranch(branchName, true);
      
      expect(result.success).toBe(true);
      expect(result.branchName).toBe(branchName);
      expect(result.checkedOut).toBe(true);
      
      // Verify branch was created
      const currentBranch = repoGitManager.getCurrentBranch();
      expect(currentBranch.branch).toBe(branchName);
      
      // Clean up - checkout back to master
      repoGitManager.checkoutBranch('master');
    });

    test('should fail to create existing branch', () => {
      const result = repoGitManager.createBranch('master', true);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Branch master already exists');
    });

    test('should checkout existing branch', () => {
      // First create a test branch
      const branchName = 'test-checkout-branch-' + Date.now();
      repoGitManager.createBranch(branchName);
      
      // Checkout master to ensure we're not on the test branch
      repoGitManager.checkoutBranch('master');
      
      // Now checkout the test branch
      const result = repoGitManager.checkoutBranch(branchName);
      
      expect(result.success).toBe(true);
      expect(result.branchName).toBe(branchName);
      
      // Verify
      const currentBranch = repoGitManager.getCurrentBranch();
      expect(currentBranch.branch).toBe(branchName);
      
      // Clean up
      repoGitManager.checkoutBranch('master');
    });

    test('should fail to checkout non-existent branch', () => {
      const result = repoGitManager.checkoutBranch('non-existent-branch-' + Date.now());
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Commit Management', () => {
    test('should commit changes successfully', () => {
      // Create a test file
      const testFile = path.join(testRepoPath, 'commit-test.txt');
      fs.writeFileSync(testFile, 'content to commit');
      
      const result = repoGitManager.commitChanges('Test commit message');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Test commit message');
      expect(result.files).toBe('all files');
      
      // Verify no uncommitted changes
      const status = repoGitManager.getGitStatus();
      expect(status.hasChanges).toBe(false);
      
      // Clean up the committed file for next tests
      repoGitManager.commitChanges('Cleanup commit', [testFile]);
      fs.unlinkSync(testFile);
      repoGitManager.commitChanges('Remove test file');
    });

    test('should commit specific files', () => {
      // Ensure we're on master branch and clean state
      repoGitManager.checkoutBranch('master');
      
      // Reset to initial commit to ensure clean state
      try {
        execSync('git reset --hard 6f57bd3', { cwd: testRepoPath });
        execSync('git clean -fd', { cwd: testRepoPath });
      } catch (error) {
        // If reset fails, just ensure clean working directory
        execSync('git reset --hard HEAD', { cwd: testRepoPath });
        execSync('git clean -fd', { cwd: testRepoPath });
      }
      
      // Create multiple test files
      const file1 = path.join(testRepoPath, 'file1.txt');
      const file2 = path.join(testRepoPath, 'file2.txt');
      fs.writeFileSync(file1, 'content 1');
      fs.writeFileSync(file2, 'content 2');
      
      // Commit only file1
      const result = repoGitManager.commitChanges('Commit specific file', [file1]);
      
      // Debug removed - test should work now
      expect(result.success).toBe(true);
      expect(result.files).toBe(file1);
      
      // Verify file2 is still uncommitted
      const status = repoGitManager.getGitStatus();
      expect(status.hasChanges).toBe(true);
      expect(status.status).toContain('file2.txt');
      
      // Clean up - remove test files and reset
      try {
        execSync('git reset --hard HEAD', { cwd: testRepoPath });
        execSync('git clean -fd', { cwd: testRepoPath });
      } catch (error) {
        // Fallback cleanup
        try { fs.unlinkSync(file1); } catch (e) {}
        try { fs.unlinkSync(file2); } catch (e) {}
      }
    });

    test('should fail to commit in non-git directory', () => {
      const result = nonRepoGitManager.commitChanges('Test commit');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a git repository');
    });
  });

  describe('Branch Management', () => {
    test('should list local branches', () => {
      // Ensure we're on master branch
      const checkoutResult = repoGitManager.checkoutBranch('master');
      expect(checkoutResult.success).toBe(true);
      
      // Verify we're on master
      const currentBranch = repoGitManager.getCurrentBranch();
      expect(currentBranch.branch).toBe('master');
      
      // Create a test branch with unique name (don't checkout to stay on master)
      const uniqueBranchName = 'test-branch-' + Date.now();
      repoGitManager.createBranch(uniqueBranchName, false);
      
      // List branches
      const result = repoGitManager.listBranches();
      
      expect(result.success).toBe(true);
      expect(result.branches).toBeInstanceOf(Array);
      expect(result.branches.length).toBeGreaterThanOrEqual(2); // master + test-branch
      expect(result.currentBranch).toBe('master');
      
      // Find the test branch
      const testBranch = result.branches.find(b => b.name === uniqueBranchName);
      expect(testBranch).toBeDefined();
      expect(testBranch.current).toBe(false);
      expect(testBranch.remote).toBe(false);
      
      // Clean up
      repoGitManager.deleteBranch(uniqueBranchName);
    });

    test('should validate branch names', () => {
      // Test valid branch names
      let validation = repoGitManager.validateBranchName('feature-test');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Test with prefix
      validation = repoGitManager.validateBranchName('feature-test', 'dev/');
      expect(validation.valid).toBe(true);
      expect(validation.normalizedName).toBe('dev/feature-test');
      
      // Test invalid branch names
      validation = repoGitManager.validateBranchName('');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Branch name cannot be empty');
      
      validation = repoGitManager.validateBranchName('feature test');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Branch name contains invalid characters');
      
      // Test long branch name
      validation = repoGitManager.validateBranchName('A'.repeat(101));
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Branch name is too long (max 100 characters)');
    });

    test('should delete branches safely', () => {
      // Create a test branch with unique name (don't checkout to stay on master)
      const uniqueBranchName = 'delete-test-' + Date.now();
      repoGitManager.createBranch(uniqueBranchName, false);
      
      // Delete the branch
      const result = repoGitManager.deleteBranch(uniqueBranchName);
      
      expect(result.success).toBe(true);
      expect(result.branchName).toBe(uniqueBranchName);
      expect(result.force).toBe(false);
      
      // Verify it's gone
      const branches = repoGitManager.listBranches();
      const deletedBranch = branches.branches.find(b => b.name === uniqueBranchName);
      expect(deletedBranch).toBeUndefined();
    });

    test('should prevent deleting current branch', () => {
      // Try to delete the current branch (should fail)
      const currentBranch = repoGitManager.getCurrentBranch().branch;
      
      const result = repoGitManager.deleteBranch(currentBranch);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('currently checked out');
    });

    test('should handle branch cleanup', () => {
      // Create and merge a test branch
      repoGitManager.createBranch('cleanup-test');
      repoGitManager.checkoutBranch('cleanup-test');
      
      // Make a commit on the branch
      const testFile = path.join(testRepoPath, 'cleanup-test.txt');
      fs.writeFileSync(testFile, 'test content');
      repoGitManager.commitChanges('Add test file');
      
      // Merge back to master
      repoGitManager.checkoutBranch('master');
      execSync('git merge cleanup-test --no-ff -m "Merge cleanup-test"', { cwd: testRepoPath });
      
      // Test dry run cleanup
      const dryRunResult = repoGitManager.cleanupMergedBranches('master', true);
      expect(dryRunResult.success).toBe(true);
      expect(dryRunResult.mergedBranches).toContain('cleanup-test');
      expect(dryRunResult.deletedBranches).toHaveLength(0);
      
      // Actually cleanup (but skip since we're in a test)
      // In real usage, this would delete the merged branch
    });
  });

  describe('Status and Information', () => {
    test('should get current git status', () => {
      const status = repoGitManager.getGitStatus();
      
      expect(status.error).toBeUndefined();
      expect(status.status).toBeDefined();
      expect(status.hasChanges).toBeDefined();
      expect(status.cached).toBe(false);
      
      // Test caching
      const cachedStatus = repoGitManager.getGitStatus();
      expect(cachedStatus.cached).toBe(true);
    });

    test('should get current branch', () => {
      const branch = repoGitManager.getCurrentBranch();
      
      expect(branch.error).toBeUndefined();
      expect(branch.branch).toBe('master');
      expect(branch.cached).toBe(false);
      
      // Test caching
      const cachedBranch = repoGitManager.getCurrentBranch();
      expect(cachedBranch.cached).toBe(true);
    });

    test('should get git remotes', () => {
      const remotes = repoGitManager.getGitRemotes();
      
      expect(remotes.error).toBeUndefined();
      expect(remotes.remotes).toBeDefined();
      expect(remotes.cached).toBe(false);
      
      // Test caching
      const cachedRemotes = repoGitManager.getGitRemotes();
      expect(cachedRemotes.cached).toBe(true);
    });

    test('should fail status operations in non-git directory', () => {
      const status = nonRepoGitManager.getGitStatus();
      expect(status.error).toBe('Not a git repository');
      
      const branch = nonRepoGitManager.getCurrentBranch();
      expect(branch.error).toBe('Not a git repository');
      
      const remotes = nonRepoGitManager.getGitRemotes();
      expect(remotes.error).toBe('Not a git repository');
    });
  });

  describe('Cache Management', () => {
    test('should clear git cache', () => {
      // Populate cache
      repoGitManager.isGitRepository();
      repoGitManager.getGitStatus();
      repoGitManager.getCurrentBranch();
      
      expect(repoGitManager.gitCache.isGitRepo).not.toBeNull();
      expect(repoGitManager.gitCache.gitStatus).not.toBeNull();
      expect(repoGitManager.gitCache.gitBranch).not.toBeNull();
      
      // Clear cache
      repoGitManager.clearCache();
      
      expect(repoGitManager.gitCache.isGitRepo).toBeNull();
      expect(repoGitManager.gitCache.gitStatus).toBeNull();
      expect(repoGitManager.gitCache.gitBranch).toBeNull();
      expect(repoGitManager.gitCache.gitRemote).toBeNull();
      expect(repoGitManager.gitCache.gitVersion).toBeNull();
    });
  });

  describe('Comprehensive Git Information', () => {
    test('should get comprehensive git information', async () => {
      const info = await repoGitManager.getComprehensiveGitInfo();
      
      expect(info.timestamp).toBeDefined();
      expect(info.isGitRepository).toBe(true);
      expect(info.healthy).toBe(true);
      expect(info.gitVersion).toBeDefined();
      expect(info.currentBranch).toBe('master');
      expect(info.hasUncommittedChanges).toBeDefined();
      expect(info.hasRemote).toBeDefined();
      expect(info.status).toBeDefined();
      expect(info.remotes).toBeDefined();
      expect(info.error).toBeUndefined();
    });

    test('should handle comprehensive info for non-git directory', async () => {
      const info = await nonRepoGitManager.getComprehensiveGitInfo();
      
      expect(info.isGitRepository).toBe(false);
      expect(info.healthy).toBe(false);
      expect(info.error).toBe('Not a git repository');
      // For non-repo directories, some fields may be undefined
      expect(info.gitVersion).toBeUndefined();
      expect(info.currentBranch).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle git operations gracefully in non-git directories', () => {
      const operations = [
        nonRepoGitManager.createBranch('test'),
        nonRepoGitManager.checkoutBranch('test'),
        nonRepoGitManager.commitChanges('test'),
        nonRepoGitManager.pushChanges()
      ];
      
      operations.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBe('Not a git repository');
      });
    });

    test('should handle invalid branch names', () => {
      // Note: Git actually allows some "unusual" branch names like 'branch@name'
      // So we test with truly invalid names
      const invalidBranchNames = ['', 'invalid/branch/name'];
      
      invalidBranchNames.forEach(name => {
        const result = repoGitManager.createBranch(name);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
      
      // Test a valid but unusual branch name
      const validUnusualName = 'branch-at-name-' + Date.now();
      const result = repoGitManager.createBranch(validUnusualName);
      expect(result.success).toBe(true);
      
      // Clean up
      repoGitManager.checkoutBranch('master');
    });
  });
});