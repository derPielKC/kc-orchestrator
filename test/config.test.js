const { 
  validateImplementationGuide, 
  readGuide, 
  writeGuide, 
  updateTaskStatus, 
  getTaskStatus, 
  getTasksByStatus, 
  createDefaultGuide 
} = require('../src/config');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Configuration Manager', () => {
  let testDir;
  let testFile;
  
  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(__dirname, 'config-test-'));
    testFile = path.join(testDir, 'IMPLEMENTATION_GUIDE.json');
  });
  
  afterAll(() => {
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
  });
  
  describe('validateImplementationGuide', () => {
    it('should validate a valid guide structure', () => {
      const validGuide = {
        project: 'test-project',
        tasks: [
          {
            id: 'T1',
            title: 'Test task',
            status: 'todo',
            acceptanceCriteria: [' criterion 1']
          }
        ]
      };
      
      expect(validateImplementationGuide(validGuide)).toBe(true);
    });
    
    it('should reject invalid guide structure', () => {
      expect(validateImplementationGuide(null)).toBe(false);
      expect(validateImplementationGuide({})).toBe(false);
      expect(validateImplementationGuide({ project: 'test' })).toBe(false);
      expect(validateImplementationGuide({ project: 'test', tasks: [] })).toBe(true);
    });
    
    it('should reject guide with invalid tasks', () => {
      const invalidTasks = {
        project: 'test',
        tasks: [
          { id: 'T1', title: 'Test' } // Missing status and acceptanceCriteria
        ]
      };
      expect(validateImplementationGuide(invalidTasks)).toBe(false);
    });
  });
  
  describe('readGuide', () => {
    it('should read and validate a valid guide file', () => {
      const validGuide = {
        project: 'test-project',
        tasks: [
          {
            id: 'T1',
            title: 'Test task',
            status: 'todo',
            acceptanceCriteria: ['criterion 1']
          }
        ]
      };
      
      fs.writeFileSync(testFile, JSON.stringify(validGuide, null, 2));
      const result = readGuide(testFile);
      
      expect(result).not.toBeNull();
      expect(result.project).toBe('test-project');
      expect(result.tasks.length).toBe(1);
    });
    
    it('should return null for invalid JSON', () => {
      fs.writeFileSync(testFile, 'invalid json');
      const result = readGuide(testFile);
      
      expect(result).toBeNull();
    });
    
    it('should return null for invalid guide structure', () => {
      fs.writeFileSync(testFile, JSON.stringify({ project: 'test' }));
      const result = readGuide(testFile);
      
      expect(result).toBeNull();
    });
    
    it('should return null for non-existent file', () => {
      const nonExistentFile = path.join(testDir, 'non-existent.json');
      const result = readGuide(nonExistentFile);
      
      expect(result).toBeNull();
    });
  });
  
  describe('writeGuide', () => {
    it('should write a valid guide file atomically', () => {
      const validGuide = {
        project: 'test-project',
        tasks: [
          {
            id: 'T1',
            title: 'Test task',
            status: 'todo',
            acceptanceCriteria: ['criterion 1']
          }
        ]
      };
      
      const result = writeGuide(testFile, validGuide);
      expect(result).toBe(true);
      
      // Verify file was written
      const content = fs.readFileSync(testFile, 'utf8');
      const writtenGuide = JSON.parse(content);
      expect(writtenGuide.project).toBe('test-project');
    });
    
    it('should reject invalid guide structure', () => {
      const invalidGuide = { project: 'test' }; // Missing tasks
      const result = writeGuide(testFile, invalidGuide);
      
      expect(result).toBe(false);
    });
    
    it('should create backup of existing file', () => {
      // Create initial file
      const initialGuide = {
        project: 'initial',
        tasks: []
      };
      fs.writeFileSync(testFile, JSON.stringify(initialGuide));
      
      // Write new guide
      const newGuide = {
        project: 'updated',
        tasks: []
      };
      writeGuide(testFile, newGuide);
      
      // Check for backup file
      const backupFiles = fs.readdirSync(testDir)
        .filter(f => f.startsWith('IMPLEMENTATION_GUIDE.json.backup'));
      expect(backupFiles.length).toBeGreaterThan(0);
    });
  });
  
  describe('updateTaskStatus', () => {
    beforeEach(() => {
      const guide = {
        project: 'test-project',
        tasks: [
          {
            id: 'T1',
            title: 'Task 1',
            status: 'todo',
            acceptanceCriteria: ['criterion 1']
          },
          {
            id: 'T2',
            title: 'Task 2',
            status: 'in_progress',
            acceptanceCriteria: ['criterion 2']
          }
        ]
      };
      fs.writeFileSync(testFile, JSON.stringify(guide, null, 2));
    });
    
    it('should update task status successfully', () => {
      const result = updateTaskStatus(testFile, 'T1', 'in_progress');
      expect(result).toBe(true);
      
      const updatedGuide = readGuide(testFile);
      const task = updatedGuide.tasks.find(t => t.id === 'T1');
      expect(task.status).toBe('in_progress');
    });
    
    it('should reject invalid status', () => {
      const result = updateTaskStatus(testFile, 'T1', 'invalid_status');
      expect(result).toBe(false);
    });
    
    it('should reject invalid task ID', () => {
      const result = updateTaskStatus(testFile, 'T99', 'in_progress');
      expect(result).toBe(false);
    });
    
    it('should reject invalid status transitions', () => {
      // Can't go from todo to completed directly
      const result = updateTaskStatus(testFile, 'T1', 'completed');
      expect(result).toBe(false);
    });
    
    it('should allow valid status transitions', () => {
      // todo -> in_progress is valid
      let result = updateTaskStatus(testFile, 'T1', 'in_progress');
      expect(result).toBe(true);
      
      // in_progress -> completed is valid
      result = updateTaskStatus(testFile, 'T1', 'completed');
      expect(result).toBe(true);
    });
  });
  
  describe('getTaskStatus', () => {
    beforeEach(() => {
      const guide = {
        project: 'test-project',
        tasks: [
          {
            id: 'T1',
            title: 'Task 1',
            status: 'todo',
            acceptanceCriteria: ['criterion 1']
          }
        ]
      };
      fs.writeFileSync(testFile, JSON.stringify(guide, null, 2));
    });
    
    it('should return task status for existing task', () => {
      const status = getTaskStatus(testFile, 'T1');
      expect(status).toBe('todo');
    });
    
    it('should return null for non-existent task', () => {
      const status = getTaskStatus(testFile, 'T99');
      expect(status).toBeNull();
    });
    
    it('should return null for invalid file', () => {
      const status = getTaskStatus(path.join(testDir, 'invalid.json'), 'T1');
      expect(status).toBeNull();
    });
  });
  
  describe('getTasksByStatus', () => {
    beforeEach(() => {
      const guide = {
        project: 'test-project',
        tasks: [
          {
            id: 'T1',
            title: 'Task 1',
            status: 'todo',
            acceptanceCriteria: ['criterion 1']
          },
          {
            id: 'T2',
            title: 'Task 2',
            status: 'in_progress',
            acceptanceCriteria: ['criterion 2']
          },
          {
            id: 'T3',
            title: 'Task 3',
            status: 'todo',
            acceptanceCriteria: ['criterion 3']
          }
        ]
      };
      fs.writeFileSync(testFile, JSON.stringify(guide, null, 2));
    });
    
    it('should return tasks with specified status', () => {
      const todoTasks = getTasksByStatus(testFile, 'todo');
      expect(todoTasks.length).toBe(2);
      expect(todoTasks[0].id).toBe('T1');
      expect(todoTasks[1].id).toBe('T3');
    });
    
    it('should return empty array for non-existent status', () => {
      const completedTasks = getTasksByStatus(testFile, 'completed');
      expect(completedTasks.length).toBe(0);
    });
    
    it('should return empty array for invalid file', () => {
      const tasks = getTasksByStatus(path.join(testDir, 'invalid.json'), 'todo');
      expect(tasks.length).toBe(0);
    });
  });
  
  describe('createDefaultGuide', () => {
    it('should create a valid default guide structure', () => {
      const guide = createDefaultGuide('test-project', 'Test description');
      
      expect(guide.project).toBe('test-project');
      expect(guide.description).toBe('Test description');
      expect(Array.isArray(guide.tasks)).toBe(true);
      expect(Array.isArray(guide.phases)).toBe(true);
      expect(guide.version).toBe('1.0');
      expect(guide.createdAt).toBeDefined();
    });
    
    it('should create guide that passes validation', () => {
      const guide = createDefaultGuide('test-project', 'Test description');
      expect(validateImplementationGuide(guide)).toBe(true);
    });
  });
});