/**
 * Task Validation System Tests
 * 
 * Comprehensive tests for the TaskValidator class
 */

const { TaskValidator } = require('../src/validation');
const { readGuide, writeGuide } = require('../src/config');
const fs = require('fs');
const path = require('path');

// Mock data
const mockGuide = {
  "project": "test-project",
  "tasks": [
    {
      "id": "T1",
      "title": "Task with output files",
      "status": "completed",
      "outputFiles": ["output.txt", "results.json"],
      "acceptanceCriteria": ["Output file created", "Contains expected data"]
    },
    {
      "id": "T2",
      "title": "Task with check steps",
      "status": "completed",
      "checkSteps": [
        {
          "command": "echo 'test'",
          "description": "Simple echo test"
        }
      ],
      "acceptanceCriteria": ["Check steps should pass"]
    },
    {
      "id": "T3",
      "title": "Task with no validation",
      "status": "completed",
      "acceptanceCriteria": ["No specific validation needed"]
    }
  ]
};

const testGuidePath = path.join(__dirname, 'test-validation-guide.json');
const testProjectPath = path.join(__dirname, 'test-project');

describe('TaskValidator', () => {
  let validator;
  
  beforeAll(() => {
    // Create test project directory
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }
  });
  
  beforeEach(() => {
    // Create test guide file
    fs.writeFileSync(testGuidePath, JSON.stringify(mockGuide, null, 2));
    validator = new TaskValidator({
      projectPath: testProjectPath,
      guidePath: testGuidePath
    });
  });
  
  afterEach(() => {
    // Clean up test files
    try {
      fs.unlinkSync(testGuidePath);
      fs.unlinkSync(path.join(testProjectPath, 'output.txt'));
      fs.unlinkSync(path.join(testProjectPath, 'results.json'));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create validator with default options', () => {
      const defaultValidator = new TaskValidator();
      
      expect(defaultValidator.projectPath).toBe(process.cwd());
      expect(defaultValidator.guidePath).toBe(`${process.cwd()}/IMPLEMENTATION_GUIDE.json`);
      expect(defaultValidator.validationTimeout).toBe(30000);
      expect(defaultValidator.validationResults).toBeInstanceOf(Map);
    });

    test('should create validator with custom options', () => {
      const customValidator = new TaskValidator({
        projectPath: '/custom/path',
        guidePath: '/custom/guide.json',
        validationTimeout: 60000
      });
      
      expect(customValidator.projectPath).toBe('/custom/path');
      expect(customValidator.guidePath).toBe('/custom/guide.json');
      expect(customValidator.validationTimeout).toBe(60000);
    });
  });

  describe('validateOutputFiles', () => {
    test('should pass when all required files exist', async () => {
      // Create required files
      fs.writeFileSync(path.join(testProjectPath, 'output.txt'), 'test data');
      fs.writeFileSync(path.join(testProjectPath, 'results.json'), '{"key": "value"}');
      
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      const result = await validator.validateOutputFiles(task, {});
      
      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].status).toBe('passed');
      expect(result.checks[1].status).toBe('passed');
      expect(result.message).toContain('All output files validated successfully');
    });

    test('should fail when required files are missing', async () => {
      // Only create one of the required files
      fs.writeFileSync(path.join(testProjectPath, 'output.txt'), 'test data');
      
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      const result = await validator.validateOutputFiles(task, {});
      
      expect(result.passed).toBe(false);
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].status).toBe('passed');
      expect(result.checks[1].status).toBe('failed');
      expect(result.message).toContain('file checks failed');
    });

    test('should handle tasks with no output files specified', async () => {
      const task = {
        id: 'T_NO_FILES',
        title: 'Task without output files',
        acceptanceCriteria: []
      };
      
      const result = await validator.validateOutputFiles(task, {});
      expect(result.passed).toBe(true);
      expect(result.message).toContain('No output files specified');
    });

    test('should handle file system errors gracefully', async () => {
      const task = {
        id: 'T_ERROR',
        title: 'Task with invalid file path',
        outputFiles: ['/invalid/path/file.txt']
      };
      
      const result = await validator.validateOutputFiles(task, {});
      expect(result.passed).toBe(false);
      expect(result.checks[0].status).toBe('failed'); // existsSync returns false, not an error
      expect(result.checks[0].message).toContain('does not exist');
    });
  });

  describe('validateAcceptanceCriteria', () => {
    test('should pass when criteria found in execution output', async () => {
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      const executionResult = {
        output: 'Output file created and Contains expected data'
      };
      
      const result = await validator.validateAcceptanceCriteria(task, executionResult);
      
      expect(result.passed).toBe(true);
      expect(result.criteriaChecks).toHaveLength(2);
      expect(result.criteriaChecks[0].status).toBe('passed');
      expect(result.criteriaChecks[1].status).toBe('passed');
    });

    test('should fail when criteria not found in execution output', async () => {
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      const executionResult = {
        output: 'Some unrelated output'
      };
      
      const result = await validator.validateAcceptanceCriteria(task, executionResult);
      
      expect(result.passed).toBe(false);
      expect(result.criteriaChecks).toHaveLength(2);
      expect(result.criteriaChecks[0].status).toBe('failed');
      expect(result.criteriaChecks[1].status).toBe('failed');
    });

    test('should handle tasks with no acceptance criteria', async () => {
      const task = {
        id: 'T_NO_CRITERIA',
        title: 'Task without criteria',
        acceptanceCriteria: []
      };
      
      const result = await validator.validateAcceptanceCriteria(task, {});
      expect(result.passed).toBe(true);
      expect(result.message).toContain('No acceptance criteria specified');
    });

    test('should handle missing execution output', async () => {
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      
      const result = await validator.validateAcceptanceCriteria(task, {});
      
      expect(result.passed).toBe(false);
      expect(result.criteriaChecks[0].status).toBe('unknown');
      expect(result.criteriaChecks[0].message).toContain('No execution output available');
    });
  });

  describe('executeCheckSteps', () => {
    test('should execute check steps successfully', async () => {
      const task = mockGuide.tasks.find(t => t.id === 'T2');
      const result = await validator.executeCheckSteps(task);
      
      expect(result.passed).toBe(true);
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].status).toBe('passed');
      expect(result.stepResults[0].output).toContain('test');
    });

    test('should handle tasks with no check steps', async () => {
      const task = {
        id: 'T_NO_STEPS',
        title: 'Task without check steps',
        checkSteps: []
      };
      
      const result = await validator.executeCheckSteps(task);
      expect(result.passed).toBe(true);
      expect(result.message).toContain('No check steps specified');
    });

    test('should fail when check step command fails', async () => {
      const task = {
        id: 'T_FAIL_STEP',
        title: 'Task with failing check step',
        checkSteps: [
          {
            command: 'exit 1',
            description: 'Failing command'
          }
        ]
      };
      
      const result = await validator.executeCheckSteps(task);
      expect(result.passed).toBe(false);
      expect(result.stepResults[0].status).toBe('failed');
    });

    test('should handle check steps with expected output', async () => {
      const task = {
        id: 'T_EXPECTED_OUTPUT',
        title: 'Task with expected output',
        checkSteps: [
          {
            command: 'echo "hello world"',
            description: 'Echo test',
            expectedOutput: 'hello'
          }
        ]
      };
      
      const result = await validator.executeCheckSteps(task);
      expect(result.passed).toBe(true);
      expect(result.stepResults[0].outputCheck).toBe('passed');
    });

    test('should fail when expected output not found', async () => {
      const task = {
        id: 'T_MISSING_OUTPUT',
        title: 'Task with missing expected output',
        checkSteps: [
          {
            command: 'echo "hello"',
            description: 'Echo test',
            expectedOutput: 'goodbye'
          }
        ]
      };
      
      const result = await validator.executeCheckSteps(task);
      expect(result.passed).toBe(false);
      expect(result.stepResults[0].outputCheck).toBe('failed');
    });
  });

  describe('executeCustomValidationScript', () => {
    test('should handle tasks with no validation script', async () => {
      const task = {
        id: 'T_NO_SCRIPT',
        title: 'Task without validation script'
      };
      
      const result = await validator.executeCustomValidationScript(task, {});
      expect(result.passed).toBe(false);
      expect(result.message).toContain('No custom validation script specified');
    });

    test('should fail when validation script not found', async () => {
      const task = {
        id: 'T_SCRIPT_NOT_FOUND',
        title: 'Task with missing validation script',
        validationScript: 'nonexistent.js'
      };
      
      const result = await validator.executeCustomValidationScript(task, {});
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Validation script not found');
    });
  });

  describe('validateTask', () => {
    test('should run comprehensive validation for a task', async () => {
      // Create required files
      fs.writeFileSync(path.join(testProjectPath, 'output.txt'), 'Output file created and Contains expected data');
      fs.writeFileSync(path.join(testProjectPath, 'results.json'), '{"result": "success"}');
      
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      const executionResult = {
        output: 'Output file created and Contains expected data'
      };
      
      const result = await validator.validateTask(task, executionResult);
      

      expect(result.taskId).toBe('T1');
      expect(result.validations).toHaveLength(4); // 4 validation types
      expect(result.overallPassed).toBe(false); // Custom script validation fails (no script specified)
      expect(result.summary).toContain('1 of 4 validation checks failed');
    });

    test('should handle validation failures gracefully', async () => {
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      const executionResult = {
        output: 'Some unrelated output'
      };
      
      const result = await validator.validateTask(task, executionResult);
      
      expect(result.taskId).toBe('T1');
      expect(result.validations).toHaveLength(4);
      expect(result.overallPassed).toBe(false);
      expect(result.summary).toContain('validation checks failed');
    });

    test('should handle validation errors gracefully', async () => {
      const task = {
        id: 'T_ERROR',
        title: 'Task that causes validation errors',
        outputFiles: ['/invalid/path/file.txt'],
        acceptanceCriteria: ['test']
      };
      
      const result = await validator.validateTask(task, {});
      
      expect(result.taskId).toBe('T_ERROR');
      expect(result.overallPassed).toBe(false);
    });
  });

  describe('Validation Results Management', () => {
    test('should store and retrieve validation results', async () => {
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      const executionResult = {
        output: 'Output file created and contains expected data'
      };
      
      // Run validation
      await validator.validateTask(task, executionResult);
      
      // Retrieve result
      const result = validator.getValidationResult('T1');
      expect(result).not.toBeNull();
      expect(result.taskId).toBe('T1');
      expect(result.overallPassed).toBe(false); // Custom script validation fails
    });

    test('should return null for non-validated task', () => {
      const result = validator.getValidationResult('T99');
      expect(result).toBeNull();
    });

    test('should return all validation results', async () => {
      const task1 = mockGuide.tasks.find(t => t.id === 'T1');
      const task2 = mockGuide.tasks.find(t => t.id === 'T2');
      
      await validator.validateTask(task1, { output: 'test' });
      await validator.validateTask(task2, {});
      
      const allResults = validator.getAllValidationResults();
      expect(allResults.T1).toBeDefined();
      expect(allResults.T2).toBeDefined();
      expect(Object.keys(allResults)).toHaveLength(2);
    });

    test('should reset validation results', async () => {
      const task = mockGuide.tasks.find(t => t.id === 'T1');
      await validator.validateTask(task, { output: 'test' });
      
      expect(validator.getValidationResult('T1')).not.toBeNull();
      
      validator.reset();
      expect(validator.getValidationResult('T1')).toBeNull();
    });
  });

  describe('generateValidationReport', () => {
    test('should generate comprehensive validation report', async () => {
      // Create required files and run validations
      fs.writeFileSync(path.join(testProjectPath, 'output.txt'), 'Output file created and Contains expected data');
      fs.writeFileSync(path.join(testProjectPath, 'results.json'), '{"result": "success"}');
      
      const task1 = mockGuide.tasks.find(t => t.id === 'T1');
      const task2 = mockGuide.tasks.find(t => t.id === 'T2');
      
      await validator.validateTask(task1, { output: 'Output file created and Contains expected data' });
      await validator.validateTask(task2, {});
      
      const report = await validator.generateValidationReport();
      
      expect(report.totalTasks).toBe(3);
      expect(report.validatedTasks).toBe(2);
      expect(report.validationPassed).toBe(0); // Both validations fail (T1: custom script, T2: no output files)
      expect(report.validationFailed).toBe(2);
      expect(report.taskDetails).toHaveLength(3);
      expect(report.overallStatus).toBe('all_failed');
      expect(report.validationSummary).toBeDefined();
    });

    test('should handle report generation with no validations', async () => {
      const report = await validator.generateValidationReport();
      
      expect(report.totalTasks).toBe(3);
      expect(report.validatedTasks).toBe(0);
      expect(report.overallStatus).toBe('no_validations_performed');
      expect(report.validationSummary).toContain('No tasks have been validated yet');
    });

    test('should handle invalid guide gracefully', async () => {
      fs.writeFileSync(testGuidePath, 'invalid json');
      
      const report = await validator.generateValidationReport();
      expect(report.totalTasks).toBe(0);
      expect(report.validationSummary).toContain('No tasks found in guide');
    });
  });
});