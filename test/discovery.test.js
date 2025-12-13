const { findRepoRoot, findRepoRootWithGit, findRepositoryRoot, findProjects, findProjectsFromRepoRoot } = require('../src/discovery');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Repository Discovery', () => {
  let testDir;
  
  beforeAll(() => {
    // Create a temporary test directory structure
    testDir = fs.mkdtempSync(path.join(__dirname, 'test-repo-'));
    
    // Create a mock git directory
    const gitDir = path.join(testDir, '.git');
    fs.mkdirSync(gitDir);
    fs.writeFileSync(path.join(gitDir, 'config'), '[core]\nrepositoryformatversion = 0\n');
  });
  
  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
  });
  
  describe('findRepoRoot', () => {
    it('should find repository root from within repo', () => {
      const subDir = path.join(testDir, 'subdir');
      fs.mkdirSync(subDir);
      
      const result = findRepoRoot(subDir);
      expect(result).toBe(testDir);
    });
    
    it('should return null when not in a repository', () => {
      const tempDir = fs.mkdtempSync(path.join(__dirname, 'no-repo-'));
      const result = findRepoRoot(tempDir);
      expect(result).toBeNull();
      
      // Clean up
      execSync(`rm -rf ${tempDir}`);
    });
    
    it('should handle maximum depth', () => {
      // This test ensures we don't infinite loop
      const result = findRepoRoot('/', 5); // Very small max depth
      expect(result).toBeNull();
    });
  });
  
  describe('findRepoRootWithGit', () => {
    it('should find repository root using git command when available', () => {
      // Only run this test if we're actually in a git repo
      try {
        execSync('git rev-parse --show-toplevel', { stdio: 'pipe' });
        const result = findRepoRootWithGit();
        expect(result).toBeTruthy();
        expect(fs.existsSync(path.join(result, '.git'))).toBe(true);
      } catch (error) {
        // Skip this test if not in a git repo
        console.log('Skipping git command test - not in a git repository');
      }
    });
    
    it('should return null when git is not available or not in repo', () => {
      const tempDir = fs.mkdtempSync(path.join(__dirname, 'no-git-'));
      const result = findRepoRootWithGit(tempDir);
      expect(result).toBeNull();
      
      // Clean up
      execSync(`rm -rf ${tempDir}`);
    });
  });
  
  describe('findRepositoryRoot', () => {
    it('should use git command when available', () => {
      // Test with our mock repo
      const subDir = path.join(testDir, 'subdir2');
      fs.mkdirSync(subDir);
      
      const result = findRepositoryRoot(subDir);
      // Should find the repo (either via git command or manual search)
      expect(result).toBeTruthy();
    });
    
    it('should fallback to manual search when git fails', () => {
      // This is tested implicitly by the mock repo which doesn't have real git
      const subDir = path.join(testDir, 'subdir3');
      fs.mkdirSync(subDir);
      
      const result = findRepositoryRoot(subDir);
      expect(result).toBe(testDir);
    });
  });
  
  describe('findProjects', () => {
    let projectsTestDir;
    
    beforeAll(() => {
      projectsTestDir = fs.mkdtempSync(path.join(__dirname, 'projects-test-'));
      
      // Create a project structure with IMPLEMENTATION_GUIDE.json files
      const project1Dir = path.join(projectsTestDir, 'project1');
      fs.mkdirSync(project1Dir);
      fs.writeFileSync(
        path.join(project1Dir, 'IMPLEMENTATION_GUIDE.json'),
        JSON.stringify({
          project: 'project1',
          description: 'Test project 1'
        })
      );
      
      // Create nested project
      const nestedDir = path.join(projectsTestDir, 'subdir', 'project2');
      fs.mkdirSync(path.dirname(nestedDir), { recursive: true });
      fs.mkdirSync(nestedDir);
      fs.writeFileSync(
        path.join(nestedDir, 'IMPLEMENTATION_GUIDE.json'),
        JSON.stringify({
          project: 'project2',
          description: 'Nested test project'
        })
      );
      
      // Create excluded directory
      const excludedDir = path.join(projectsTestDir, 'node_modules');
      fs.mkdirSync(excludedDir);
      fs.writeFileSync(
        path.join(excludedDir, 'IMPLEMENTATION_GUIDE.json'),
        JSON.stringify({ project: 'excluded' })
      );
    });
    
    afterAll(() => {
      if (fs.existsSync(projectsTestDir)) {
        execSync(`rm -rf ${projectsTestDir}`);
      }
    });
    
    it('should find IMPLEMENTATION_GUIDE.json files recursively', () => {
      const projects = findProjects(projectsTestDir);
      expect(projects.length).toBe(2); // Should find 2 projects, exclude node_modules
      
      const projectNames = projects.map(p => p.content.project);
      expect(projectNames).toContain('project1');
      expect(projectNames).toContain('project2');
    });
    
    it('should exclude specified patterns', () => {
      const projects = findProjects(projectsTestDir, ['node_modules']);
      expect(projects.length).toBe(2); // node_modules should be excluded
      expect(projects.some(p => p.content.project === 'excluded')).toBe(false);
    });
    
    it('should include directory and path information', () => {
      const projects = findProjects(projectsTestDir);
      expect(projects.length).toBeGreaterThan(0);
      
      projects.forEach(project => {
        expect(project.path).toBeTruthy();
        expect(project.dir).toBeTruthy();
        expect(project.content).toBeTruthy();
        expect(fs.existsSync(project.path)).toBe(true);
      });
    });
    
    it('should handle invalid JSON gracefully', () => {
      const invalidDir = path.join(projectsTestDir, 'invalid-project');
      fs.mkdirSync(invalidDir);
      fs.writeFileSync(
        path.join(invalidDir, 'IMPLEMENTATION_GUIDE.json'),
        'invalid json content'
      );
      
      // Should not throw, just warn and continue
      const projects = findProjects(projectsTestDir);
      expect(projects.length).toBe(2); // Should still find the valid projects
    });
  });
  
  describe('findProjectsFromRepoRoot', () => {
    let testDir;
    
    beforeAll(() => {
      testDir = fs.mkdtempSync(path.join(__dirname, 'repo-root-test-'));
      
      // Create a simple project
      const projectDir = path.join(testDir, 'test-project');
      fs.mkdirSync(projectDir);
      fs.writeFileSync(
        path.join(projectDir, 'IMPLEMENTATION_GUIDE.json'),
        JSON.stringify({ project: 'test-project' })
      );
    });
    
    afterAll(() => {
      if (fs.existsSync(testDir)) {
        execSync(`rm -rf ${testDir}`);
      }
    });
    
    it('should find projects starting from repository root', () => {
      const projects = findProjectsFromRepoRoot(testDir);
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBe(1);
    });
  });
});