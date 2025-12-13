const { 
  detectAmbiguity, 
  isInterviewNeeded, 
  getQuestionsForAmbiguity 
} = require('../src/interview');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Interview System', () => {
  let testDir;
  
  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(__dirname, 'interview-test-'));
  });
  
  afterAll(() => {
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
  });
  
  describe('detectAmbiguity', () => {
    it('should detect new project ambiguity', () => {
      const ambiguities = detectAmbiguity({}, testDir);
      expect(ambiguities).toContain('new_project');
    });
    
    it('should detect missing project name', () => {
      const config = { description: 'test' };
      const ambiguities = detectAmbiguity(config, testDir);
      expect(ambiguities).toContain('missing_project_name');
    });
    
    it('should detect missing project description', () => {
      const config = { project: 'test' };
      const ambiguities = detectAmbiguity(config, testDir);
      expect(ambiguities).toContain('missing_project_description');
    });
    
    it('should detect missing implementation guide', () => {
      const config = { project: 'test', description: 'test' };
      const ambiguities = detectAmbiguity(config, testDir);
      expect(ambiguities).toContain('missing_implementation_guide');
    });
    
    it('should detect empty tasks', () => {
      const config = { project: 'test', description: 'test', tasks: [] };
      const ambiguities = detectAmbiguity(config, testDir);
      expect(ambiguities).toContain('empty_tasks');
    });
    
    it('should return empty array for complete configuration', () => {
      // Create a guide file
      const guidePath = path.join(testDir, 'IMPLEMENTATION_GUIDE.json');
      fs.writeFileSync(guidePath, JSON.stringify({
        project: 'test',
        description: 'test',
        tasks: [{ id: 'T1', title: 'Test', status: 'todo', acceptanceCriteria: ['test'] }]
      }));
      
      const config = { project: 'test', description: 'test', tasks: ['task'] };
      const ambiguities = detectAmbiguity(config, testDir);
      expect(ambiguities.length).toBe(0);
    });
  });
  
  describe('isInterviewNeeded', () => {
    it('should return true when ambiguities exist', () => {
      const config = {};
      const needed = isInterviewNeeded(config, testDir);
      expect(needed).toBe(true);
    });
    
    it('should return false when no ambiguities exist', () => {
      // Create a guide file
      const guidePath = path.join(testDir, 'IMPLEMENTATION_GUIDE.json');
      fs.writeFileSync(guidePath, JSON.stringify({
        project: 'test',
        description: 'test',
        tasks: [{ id: 'T1', title: 'Test', status: 'todo', acceptanceCriteria: ['test'] }]
      }));
      
      const config = { project: 'test', description: 'test', tasks: ['task'] };
      const needed = isInterviewNeeded(config, testDir);
      expect(needed).toBe(false);
    });
  });
  
  describe('getQuestionsForAmbiguity', () => {
    it('should return questions for new_project ambiguity', () => {
      const questions = getQuestionsForAmbiguity('new_project');
      expect(questions.length).toBe(2);
      expect(questions[0].id).toBe('project_name');
      expect(questions[1].id).toBe('project_description');
    });
    
    it('should return questions for missing_implementation_guide ambiguity', () => {
      const questions = getQuestionsForAmbiguity('missing_implementation_guide');
      expect(questions.length).toBe(1);
      expect(questions[0].id).toBe('create_guide');
    });
    
    it('should return empty array for unknown ambiguity', () => {
      const questions = getQuestionsForAmbiguity('unknown');
      expect(questions.length).toBe(0);
    });
  });
  
  describe('askQuestion', () => {
    // Note: askQuestion is async and interactive, so we test it indirectly
    // through the integration tests
    it('should be a function', () => {
      const { askQuestion } = require('../src/interview');
      expect(typeof askQuestion).toBe('function');
    });
  });
  
  describe('runInterview integration', () => {
    it('should handle non-interactive mode with auto answers', async () => {
      const { runInterview } = require('../src/interview');
      
      // Test with auto answers
      const result = await runInterview(testDir, {}, true, 'test-project,test-description,yes');
      
      expect(result.project).toBe('test-project');
      expect(result.description).toBe('test-description');
      expect(result.guideCreated).toBe(true);
      
      // Verify guide was created
      const guidePath = path.join(testDir, 'IMPLEMENTATION_GUIDE.json');
      expect(fs.existsSync(guidePath)).toBe(true);
    });
    
    it('should handle non-interactive mode with minimal answers', async () => {
      const { runInterview } = require('../src/interview');
      
      // Test with minimal answers (should use defaults)
      const result = await runInterview(testDir, {}, true, '');
      
      expect(result.project).toBeDefined();
      // Description might be empty string in non-interactive mode with no answers
      expect(result.project).toBeTruthy();
      expect(result.guideCreated).toBe(true);
    });
    
    it('should skip interview when no ambiguities', async () => {
      const { runInterview } = require('../src/interview');
      
      // Create a complete configuration
      const guidePath = path.join(testDir, 'IMPLEMENTATION_GUIDE.json');
      fs.writeFileSync(guidePath, JSON.stringify({
        project: 'test',
        description: 'test',
        tasks: [{ id: 'T1', title: 'Test', status: 'todo', acceptanceCriteria: ['test'] }]
      }));
      
      const config = { project: 'test', description: 'test', tasks: ['task'] };
      const result = await runInterview(testDir, config, true, '');
      
      // Should return the original config unchanged
      expect(result).toEqual(config);
    });
  });
});