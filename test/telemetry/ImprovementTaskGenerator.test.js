const { ImprovementTaskGenerator } = require('../../src/telemetry/ImprovementTaskGenerator');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('ImprovementTaskGenerator', () => {
  let taskGenerator;
  let testDir;
  let testGuidePath;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-orchestrator-test-'));
    testGuidePath = path.join(testDir, 'IMPLEMENTATION_GUIDE.json');
    
    // Create a minimal test guide
    const testGuide = {
      project: 'test-project',
      description: 'Test project',
      phases: [],
      tasks: []
    };
    
    fs.writeFileSync(testGuidePath, JSON.stringify(testGuide, null, 2), 'utf8');
    
    taskGenerator = new ImprovementTaskGenerator({
      guidePath: testGuidePath,
      verbose: false
    });
  });
  
  afterEach(() => {
    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('constructor', () => {
    it('should initialize with default guide path', () => {
      const defaultGenerator = new ImprovementTaskGenerator();
      expect(defaultGenerator.guidePath).toContain('IMPLEMENTATION_GUIDE.json');
    });
  });
  
  describe('generateImprovementTasks', () => {
    it('should return empty result when no recommendations provided', () => {
      const result = taskGenerator.generateImprovementTasks([]);
      
      expect(result.success).toBe(true);
      expect(result.generatedTasks.length).toBe(0);
      expect(result.skippedTasks).toBe(0);
      expect(result.message).toBe('No recommendations to process');
    });
    
    it('should generate tasks from recommendations', () => {
      const recommendations = [
        {
          id: 'AGL-001',
          title: 'Improve error handling',
          description: 'Add better error handling for network failures',
          priority: 'high',
          category: 'error_handling',
          impact: 'high',
          implementation: 'Implement retry logic with exponential backoff'
        },
        {
          id: 'AGL-002',
          title: 'Add more tests',
          description: 'Add unit tests for edge cases',
          priority: 'medium',
          category: 'testing'
        }
      ];
      
      const result = taskGenerator.generateImprovementTasks(recommendations);
      
      expect(result.success).toBe(true);
      expect(result.generatedTasks.length).toBe(2);
      expect(result.skippedTasks).toBe(0);
      
      // Check first task
      const task1 = result.generatedTasks[0];
      expect(task1.id).toMatch(/^AGL-\d{8}-\d{3}$/);
      expect(task1.title).toBe('Improve error handling');
      expect(task1.description).toContain('Add better error handling for network failures');
      expect(task1.status).toBe('todo');
      expect(task1.effort).toBe('L'); // high priority -> L
      expect(task1.source).toBe('agent-lightning');
      expect(task1.metadata.recommendationId).toBe('AGL-001');
      expect(task1.metadata.category).toBe('error_handling');
      expect(task1.metadata.priority).toBe('high');
      
      // Check second task
      const task2 = result.generatedTasks[1];
      expect(task2.id).toMatch(/^AGL-\d{8}-\d{3}$/);
      expect(task2.title).toBe('Add more tests');
      expect(task2.effort).toBe('M'); // medium priority -> M
      expect(task2.metadata.recommendationId).toBe('AGL-002');
      expect(task2.metadata.category).toBe('testing');
    });
    
    it('should skip duplicate recommendations', () => {
      const recommendations = [
        {
          id: 'AGL-001',
          title: 'Improve error handling',
          description: 'Add better error handling',
          priority: 'high',
          category: 'error_handling'
        },
        {
          id: 'AGL-002',
          title: 'Improve error handling', // Same title
          description: 'Add better error handling', // Same description
          priority: 'high',
          category: 'error_handling' // Same category
        }
      ];
      
      // Create a task with the same content hash to simulate existing task
      const existingTask = {
        title: 'Improve error handling',
        description: 'Add better error handling',
        contentHash: taskGenerator._generateContentHash(recommendations[0])
      };
      
      const result = taskGenerator.generateImprovementTasks(recommendations, {
        existingTasks: [existingTask]
      });
      
      expect(result.success).toBe(true);
      // Both recommendations match the existing task, so both are skipped
      expect(result.generatedTasks.length).toBe(0);
      expect(result.skippedTasks).toBe(2);
    });
    
    it('should skip recommendations that match existing tasks', () => {
      // Add an existing task to the guide
      const existingTask = {
        id: 'T1',
        title: 'Improve error handling',
        description: 'Add better error handling for network failures',
        contentHash: taskGenerator._generateContentHash({
          title: 'Improve error handling',
          description: 'Add better error handling for network failures',
          category: 'error_handling'
        })
      };
      
      const guide = JSON.parse(fs.readFileSync(testGuidePath, 'utf8'));
      guide.tasks.push(existingTask);
      fs.writeFileSync(testGuidePath, JSON.stringify(guide, null, 2), 'utf8');
      
      const recommendations = [
        {
          id: 'AGL-001',
          title: 'Improve error handling',
          description: 'Add better error handling for network failures',
          priority: 'high',
          category: 'error_handling'
        }
      ];
      
      const result = taskGenerator.generateImprovementTasks(recommendations, {
        existingTasks: [existingTask]
      });
      
      expect(result.success).toBe(true);
      expect(result.generatedTasks.length).toBe(0);
      expect(result.skippedTasks).toBe(1);
    });
  });
  
  describe('_generateTaskFromRecommendation', () => {
    it('should generate task with proper structure', () => {
      const recommendation = {
        id: 'AGL-001',
        title: 'Improve error handling',
        description: 'Add better error handling for network failures',
        priority: 'high',
        category: 'error_handling',
        impact: 'high',
        implementation: 'Implement retry logic with exponential backoff'
      };
      
      const task = taskGenerator._generateTaskFromRecommendation(recommendation, 0, 'test-project');
      
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('acceptanceCriteria');
      expect(task).toHaveProperty('constraints');
      expect(task).toHaveProperty('outputs');
      expect(task).toHaveProperty('checkSteps');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('effort');
      expect(task).toHaveProperty('dependencies');
      expect(task).toHaveProperty('contentHash');
      expect(task).toHaveProperty('source');
      expect(task).toHaveProperty('metadata');
      
      expect(task.title).toBe('Improve error handling');
      expect(task.status).toBe('todo');
      expect(task.effort).toBe('L'); // high priority -> L
      expect(task.source).toBe('agent-lightning');
      expect(task.metadata.recommendationId).toBe('AGL-001');
      
      // Check that description includes recommendation details
      expect(task.description).toContain('Add better error handling for network failures');
      expect(task.description).toContain('**Category**: error_handling');
      expect(task.description).toContain('**Priority**: high');
      expect(task.description).toContain('**Suggested Implementation**');
    });
    
    it('should add action verb if missing', () => {
      const recommendation = {
        id: 'AGL-001',
        title: 'better error handling', // Missing action verb
        description: 'Add better error handling',
        priority: 'high',
        category: 'error_handling'
      };
      
      const task = taskGenerator._generateTaskFromRecommendation(recommendation, 0, 'test-project');
      
      expect(task.title).toBe('Implement better error handling');
    });
    
    it('should capitalize first letter', () => {
      const recommendation = {
        id: 'AGL-001',
        title: 'improve error handling', // lowercase first letter, no action verb
        description: 'Add better error handling',
        priority: 'high',
        category: 'error_handling'
      };
      
      const task = taskGenerator._generateTaskFromRecommendation(recommendation, 0, 'test-project');
      
      // Since it doesn't start with an action verb, it should add "Implement"
      expect(task.title).toBe('Implement improve error handling');
    });
  });
  
  describe('_generateTaskId', () => {
    it('should generate unique task IDs', () => {
      const id1 = taskGenerator._generateTaskId(0);
      const id2 = taskGenerator._generateTaskId(1);
      
      expect(id1).toMatch(/^AGL-\d{8}-\d{3}$/);
      expect(id2).toMatch(/^AGL-\d{8}-\d{3}$/);
      expect(id1).not.toBe(id2);
    });
  });
  
  describe('_generateContentHash', () => {
    it('should generate consistent content hashes', () => {
      const recommendation1 = {
        title: 'Test Recommendation',
        description: 'Test description',
        category: 'test'
      };
      
      const recommendation2 = {
        title: 'Test Recommendation',
        description: 'Test description',
        category: 'test'
      };
      
      const hash1 = taskGenerator._generateContentHash(recommendation1);
      const hash2 = taskGenerator._generateContentHash(recommendation2);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(32); // MD5 hash length
    });
    
    it('should generate different hashes for different content', () => {
      const recommendation1 = {
        title: 'Test Recommendation 1',
        description: 'Test description',
        category: 'test'
      };
      
      const recommendation2 = {
        title: 'Test Recommendation 2',
        description: 'Test description',
        category: 'test'
      };
      
      const hash1 = taskGenerator._generateContentHash(recommendation1);
      const hash2 = taskGenerator._generateContentHash(recommendation2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('_isDuplicateTask', () => {
    it('should detect duplicates by title similarity', () => {
      const recommendation = {
        title: 'Improve error handling',
        description: 'Add better error handling',
        category: 'error_handling'
      };
      
      const existingTasks = [
        {
          title: 'Improve error handling', // Same title
          description: 'Add better error handling for network failures',
          contentHash: 'some-hash'
        }
      ];
      
      const isDuplicate = taskGenerator._isDuplicateTask(recommendation, existingTasks);
      expect(isDuplicate).toBe(true);
    });
    
    it('should detect duplicates by content hash', () => {
      const recommendation = {
        title: 'Improve error handling',
        description: 'Add better error handling',
        category: 'error_handling'
      };
      
      const contentHash = taskGenerator._generateContentHash(recommendation);
      
      const existingTasks = [
        {
          title: 'Different title',
          contentHash: contentHash // Same hash
        }
      ];
      
      const isDuplicate = taskGenerator._isDuplicateTask(recommendation, existingTasks);
      expect(isDuplicate).toBe(true);
    });
    
    it('should not detect duplicates for different recommendations', () => {
      const recommendation = {
        title: 'Improve error handling',
        description: 'Add better error handling',
        category: 'error_handling'
      };
      
      const existingTasks = [
        {
          title: 'Add more tests', // Different title
          description: 'Add unit tests',
          contentHash: 'different-hash'
        }
      ];
      
      const isDuplicate = taskGenerator._isDuplicateTask(recommendation, existingTasks);
      expect(isDuplicate).toBe(false);
    });
  });
  
  describe('addTasksToGuide', () => {
    it('should add tasks to IMPLEMENTATION_GUIDE.json', () => {
      const tasks = [
        {
          id: 'T8.1',
          title: 'Test Task 1',
          description: 'Test description 1',
          status: 'todo',
          effort: 'M',
          dependencies: [],
          contentHash: 'hash-1',
          source: 'agent-lightning',
          metadata: { recommendationId: 'AGL-001' }
        },
        {
          id: 'T8.2',
          title: 'Test Task 2',
          description: 'Test description 2',
          status: 'todo',
          effort: 'M',
          dependencies: [],
          contentHash: 'hash-2',
          source: 'agent-lightning',
          metadata: { recommendationId: 'AGL-002' }
        }
      ];
      
      const result = taskGenerator.addTasksToGuide(tasks);
      expect(result).toBe(true);
      
      // Check that tasks were added
      const updatedGuide = JSON.parse(fs.readFileSync(testGuidePath, 'utf8'));
      expect(updatedGuide.tasks.length).toBe(2);
      expect(updatedGuide.tasks[0].id).toBe('T8.1');
      expect(updatedGuide.tasks[1].id).toBe('T8.2');
      
      // Check that phase was added
      expect(updatedGuide.phases.length).toBe(1);
      expect(updatedGuide.phases[0].name).toBe('Continuous Improvement (Agent Lightning)');
    });
    
    it('should not add duplicate tasks', () => {
      // Add a task to the guide first
      const existingTask = {
        id: 'T1',
        title: 'Test Task',
        description: 'Test description',
        status: 'todo',
        effort: 'M',
        dependencies: [],
        contentHash: 'hash-1',
        source: 'agent-lightning',
        metadata: { recommendationId: 'AGL-001' }
      };
      
      const guide = JSON.parse(fs.readFileSync(testGuidePath, 'utf8'));
      guide.tasks.push(existingTask);
      fs.writeFileSync(testGuidePath, JSON.stringify(guide, null, 2), 'utf8');
      
      // Try to add the same task again
      const tasks = [
        {
          id: 'T2',
          title: 'Test Task',
          description: 'Test description',
          status: 'todo',
          effort: 'M',
          dependencies: [],
          contentHash: 'hash-1', // Same hash
          source: 'agent-lightning',
          metadata: { recommendationId: 'AGL-001' }
        }
      ];
      
      const result = taskGenerator.addTasksToGuide(tasks);
      expect(result).toBe(true);
      
      // Check that task was not added
      const updatedGuide = JSON.parse(fs.readFileSync(testGuidePath, 'utf8'));
      expect(updatedGuide.tasks.length).toBe(1); // Only the original task
    });
  });
  
  describe('generateImprovementReport', () => {
    it('should generate improvement report with proper structure', () => {
      const recommendations = [
        {
          id: 'AGL-001',
          title: 'Improve error handling',
          description: 'Add better error handling',
          priority: 'high',
          category: 'error_handling'
        },
        {
          id: 'AGL-002',
          title: 'Add more tests',
          description: 'Add unit tests',
          priority: 'medium',
          category: 'testing'
        }
      ];
      
      const generatedTasks = [
        {
          id: 'T8.1',
          title: 'Improve error handling',
          description: 'Add better error handling',
          status: 'todo',
          effort: 'L',
          metadata: { category: 'error_handling', priority: 'high' }
        }
      ];
      
      const report = taskGenerator.generateImprovementReport(recommendations, generatedTasks, 1);
      
      expect(report).toContain('# Continuous Improvement Report');
      expect(report).toContain('## Agent Lightning Analysis Results');
      expect(report).toContain('- **Total Recommendations**: 2');
      expect(report).toContain('- **Tasks Generated**: 1');
      expect(report).toContain('- **Duplicate Tasks Skipped**: 1');
      expect(report).toContain('## Generated Improvement Tasks');
      expect(report).toContain('Improve error handling');
      expect(report).toContain('## Skipped Recommendations');
      // The report shows the first recommendations as skipped (by index)
      expect(report).toContain('Improve error handling');
      expect(report).toContain('## Next Steps');
    });
  });
  
  describe('writeImprovementReport', () => {
    it('should write improvement report to file', () => {
      const report = '# Test Improvement Report\n\nThis is a test report.';
      const outputPath = path.join(testDir, 'improvement-report.md');
      
      const result = taskGenerator.writeImprovementReport(report, outputPath);
      
      expect(result).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
      
      const content = fs.readFileSync(outputPath, 'utf8');
      expect(content).toBe(report);
    });
  });
});