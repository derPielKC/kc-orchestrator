/**
 * Fix Prompt Drafting Tests
 * 
 * Comprehensive tests for the FixPromptDrafter class
 */

const { FixPromptDrafter, FixPromptError } = require('../src/prompt');
const { OllamaClient } = require('../src/ollama');
const { LogSummarizer } = require('../src/summary');

describe('FixPromptDrafter', () => {
  let promptDrafter;
  let mockOllamaClient;
  let mockLogSummarizer;

  beforeAll(() => {
    // Create mock Ollama client that always fails to test fallback
    mockOllamaClient = {
      checkAvailability: async () => false,
      draftFixPrompt: async () => { throw new Error('Ollama unavailable'); }
    };
    
    // Create mock log summarizer
    mockLogSummarizer = {
      summarizeLog: async () => ({
        success: true,
        analysis: 'Mock log analysis',
        rootCauses: [{ id: 1, description: 'Test root cause', severity: 'high' }],
        suggestions: [{ id: 1, description: 'Test suggestion', priority: 'medium' }]
      })
    };
    
    // Create prompt drafter with mocks
    promptDrafter = new FixPromptDrafter({
      ollamaClient: mockOllamaClient,
      logSummarizer: mockLogSummarizer,
      verbose: false
    });
  });

  describe('Constructor', () => {
    test('should create drafter with default options', () => {
      const defaultDrafter = new FixPromptDrafter();
      expect(defaultDrafter).toBeInstanceOf(FixPromptDrafter);
      expect(defaultDrafter.maxPromptLength).toBe(4000);
      expect(defaultDrafter.verbose).toBe(false);
    });

    test('should create drafter with custom options', () => {
      const customDrafter = new FixPromptDrafter({
        maxPromptLength: 8000,
        verbose: true
      });
      expect(customDrafter.maxPromptLength).toBe(8000);
      expect(customDrafter.verbose).toBe(true);
    });

    test('should accept custom Ollama client and log summarizer', () => {
      const customDrafter = new FixPromptDrafter({
        ollamaClient: mockOllamaClient,
        logSummarizer: mockLogSummarizer
      });
      expect(customDrafter.ollamaClient).toBe(mockOllamaClient);
      expect(customDrafter.logSummarizer).toBe(mockLogSummarizer);
    });
  });

  describe('Method Availability', () => {
    test('should have all required methods', () => {
      expect(typeof promptDrafter.checkOllamaAvailability).toBe('function');
      expect(typeof promptDrafter.getDefaultTemplates).toBe('function');
      expect(typeof promptDrafter.selectPromptTemplate).toBe('function');
      expect(typeof promptDrafter.validatePromptInput).toBe('function');
      expect(typeof promptDrafter.generateFixPrompt).toBe('function');
      expect(typeof promptDrafter.generateFixPromptWithLogAnalysis).toBe('function');
      expect(typeof promptDrafter.validateFixPrompt).toBe('function');
      expect(typeof promptDrafter.getAvailableTemplates).toBe('function');
      expect(typeof promptDrafter.getPromptTemplate).toBe('function');
      expect(typeof promptDrafter.addPromptTemplate).toBe('function');
      expect(typeof promptDrafter.reset).toBe('function');
    });
  });

  describe('Error Classes', () => {
    test('should export FixPromptError', () => {
      expect(FixPromptError).toBeDefined();
      expect(typeof FixPromptError).toBe('function');
    });

    test('should create proper error instances', () => {
      const error = new FixPromptError('Test error');
      expect(error).toBeInstanceOf(FixPromptError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FixPromptError');
    });
  });

  describe('Prompt Templates', () => {
    test('should have default templates', () => {
      const templates = promptDrafter.getDefaultTemplates();
      expect(templates).toBeDefined();
      expect(Object.keys(templates)).toHaveLength(5);
      expect(templates.general).toBeDefined();
      expect(templates.code_error).toBeDefined();
      expect(templates.validation_failure).toBeDefined();
      expect(templates.configuration_error).toBeDefined();
      expect(templates.permission_error).toBeDefined();
    });

    test('should get available templates', () => {
      const availableTemplates = promptDrafter.getAvailableTemplates();
      expect(availableTemplates).toHaveLength(5);
      expect(availableTemplates[0].name).toBe('General Fix Prompt');
    });

    test('should get specific template by name', () => {
      const template = promptDrafter.getPromptTemplate('general');
      expect(template).toBeDefined();
      expect(template.name).toBe('General Fix Prompt');
    });

    test('should return null for unknown template', () => {
      const template = promptDrafter.getPromptTemplate('unknown');
      expect(template).toBeNull();
    });

    test('should add custom prompt template', () => {
      const customTemplate = {
        name: 'Custom Template',
        description: 'Test custom template',
        template: 'Custom template content: {taskId}'
      };
      
      promptDrafter.addPromptTemplate('custom', customTemplate);
      const addedTemplate = promptDrafter.getPromptTemplate('custom');
      expect(addedTemplate).toBeDefined();
      expect(addedTemplate.name).toBe('Custom Template');
    });
  });

  describe('Template Selection', () => {
    test('should select general template for unknown error types', () => {
      const template = promptDrafter.selectPromptTemplate('unknown', {
        errorMessage: 'Some error'
      });
      expect(template.name).toBe('General Fix Prompt');
    });

    test('should select validation template for validation errors', () => {
      const template = promptDrafter.selectPromptTemplate('validation', {
        errorMessage: 'Validation failed'
      });
      expect(template.name).toBe('Validation Failure Fix');
    });

    test('should select code error template for code errors', () => {
      const template = promptDrafter.selectPromptTemplate('execution', {
        errorMessage: 'Syntax error'
      });
      expect(template.name).toBe('Code Error Fix');
    });

    test('should select configuration template for config errors', () => {
      const template = promptDrafter.selectPromptTemplate('config', {
        errorMessage: 'Invalid configuration'
      });
      expect(template.name).toBe('Configuration Error Fix');
    });

    test('should select permission template for permission errors', () => {
      const template = promptDrafter.selectPromptTemplate('access', {
        errorMessage: 'Permission denied'
      });
      expect(template.name).toBe('Permission Error Fix');
    });

    test('should select template based on error message content', () => {
      const template = promptDrafter.selectPromptTemplate('unknown', {
        errorMessage: 'validation error occurred'
      });
      expect(template.name).toBe('Validation Failure Fix');
    });
  });

  describe('Input Validation', () => {
    test('should validate valid input', () => {
      const validation = promptDrafter.validatePromptInput({
        taskId: 'T1',
        errorMessage: 'Test error'
      });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject missing taskId', () => {
      const validation = promptDrafter.validatePromptInput({
        errorMessage: 'Test error'
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('taskId is required');
    });

    test('should reject missing errorMessage', () => {
      const validation = promptDrafter.validatePromptInput({
        taskId: 'T1'
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('errorMessage is required');
    });

    test('should warn about long taskDescription', () => {
      const validation = promptDrafter.validatePromptInput({
        taskId: 'T1',
        errorMessage: 'Test error',
        taskDescription: 'A'.repeat(1001)
      });
      expect(validation.valid).toBe(true);
      expect(validation.warnings[0]).toContain('taskDescription is very long');
    });

    test('should warn about long errorContext', () => {
      const validation = promptDrafter.validatePromptInput({
        taskId: 'T1',
        errorMessage: 'Test error',
        errorContext: 'A'.repeat(2001)
      });
      expect(validation.valid).toBe(true);
      expect(validation.warnings[0]).toContain('errorContext is very long');
    });
  });

  describe('Fix Prompt Generation', () => {
    test('should generate fix prompt with fallback (Ollama unavailable)', async () => {
      const result = await promptDrafter.generateFixPrompt({
        taskId: 'T1',
        taskTitle: 'Test Task',
        taskDescription: 'Test task description',
        errorType: 'validation',
        errorMessage: 'Validation failed: invalid input',
        errorContext: 'Input validation module'
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('fallback');
      expect(result.taskId).toBe('T1');
      expect(result.template).toBe('Validation Failure Fix');
      expect(result.prompt).toBeDefined();
      expect(result.prompt).toContain('Test Task');
      expect(result.prompt).toContain('Validation failed: invalid input');
      expect(result.statistics).toBeDefined();
    });

    test('should generate fix prompt with general template', async () => {
      const result = await promptDrafter.generateFixPrompt({
        taskId: 'T2',
        taskTitle: 'Another Task',
        errorType: 'unknown',
        errorMessage: 'Generic error occurred'
      });

      expect(result.success).toBe(true);
      expect(result.template).toBe('General Fix Prompt');
      expect(result.prompt).toContain('Another Task');
      expect(result.prompt).toContain('Generic error occurred');
    });

    test('should handle long prompts with truncation', async () => {
      const result = await promptDrafter.generateFixPrompt({
        taskId: 'T3',
        taskTitle: 'Long Task',
        taskDescription: 'A'.repeat(5000), // Very long description
        errorMessage: 'Test error'
      });

      expect(result.success).toBe(true);
      expect(result.prompt.length).toBeLessThanOrEqual(4000); // Should be truncated
    });

    test('should throw error for invalid input', async () => {
      await expect(promptDrafter.generateFixPrompt({
        taskTitle: 'Test Task',
        errorMessage: 'Test error'
        // Missing taskId
      }))
        .rejects
        .toThrow(FixPromptError);
    });
  });

  describe('Fix Prompt with Log Analysis', () => {
    test('should generate fix prompt with log analysis', async () => {
      const result = await promptDrafter.generateFixPromptWithLogAnalysis({
        taskId: 'T4',
        logPath: 'test-execution.log'
      }, {
        taskId: 'T4',
        taskTitle: 'Task with Log Analysis',
        errorType: 'code',
        errorMessage: 'Code execution failed',
        errorContext: 'Main execution module'
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('fallback');
      expect(result.prompt).toContain('Task with Log Analysis');
      expect(result.prompt).toContain('Code execution failed');
      expect(result.prompt).toContain('Mock log analysis'); // From mock summarizer
    });

    test('should handle log analysis errors gracefully', async () => {
      // Create a drafter with a failing log summarizer
      const failingSummarizer = {
        summarizeLog: async () => { throw new Error('Log analysis failed'); }
      };
      
      const failingDrafter = new FixPromptDrafter({
        ollamaClient: mockOllamaClient,
        logSummarizer: failingSummarizer
      });

      await expect(failingDrafter.generateFixPromptWithLogAnalysis({
        taskId: 'T5',
        logPath: 'test.log'
      }, {
        taskId: 'T5',
        errorMessage: 'Test error'
      }))
        .rejects
        .toThrow(FixPromptError);
    });
  });

  describe('Fix Prompt Validation', () => {
    test('should validate high-quality fix prompt', () => {
      const mockResult = {
        prompt: 'This is a comprehensive fix prompt that addresses the problem, provides a clear solution approach, includes testing requirements, and defines acceptance criteria for verifying the fix.'
      };

      const validation = promptDrafter.validateFixPrompt(mockResult);
      expect(validation.valid).toBe(true);
      expect(validation.qualityScore).toBeGreaterThanOrEqual(80);
      expect(validation.issues).toHaveLength(0);
    });

    test('should identify missing problem statement', () => {
      const mockResult = {
        prompt: 'This is a comprehensive fix prompt that provides a clear solution approach, includes testing requirements, and defines acceptance criteria for verifying the fix.'
      };

      const validation = promptDrafter.validateFixPrompt(mockResult);
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Missing clear problem statement');
      expect(validation.qualityScore).toBeLessThan(80);
    });

    test('should identify missing solution approach', () => {
      const mockResult = {
        prompt: 'Problem: Something is broken. This is a clear problem statement. Testing: Verify it works. Acceptance criteria: Should work correctly.'
      };

      const validation = promptDrafter.validateFixPrompt(mockResult);
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Missing solution approach');
    });

    test('should suggest adding testing requirements', () => {
      const mockResult = {
        prompt: 'Problem: Something is broken. Solution: Fix it properly. Acceptance criteria: Should work correctly.'
      };

      const validation = promptDrafter.validateFixPrompt(mockResult);
      expect(validation.valid).toBe(true); // Still valid, just missing testing
      expect(validation.suggestions).toContain('Consider adding testing requirements');
    });

    test('should suggest adding acceptance criteria', () => {
      const mockResult = {
        prompt: 'Problem: Something is broken. Solution: Implement proper error handling. Testing: Verify it works thoroughly.'
      };

      const validation = promptDrafter.validateFixPrompt(mockResult);
      expect(validation.valid).toBe(true);
      expect(validation.suggestions).toContain('Consider adding acceptance criteria');
    });

    test('should handle empty prompt', () => {
      const validation = promptDrafter.validateFixPrompt({});
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('No fix prompt generated');
    });

    test('should handle very short prompt', () => {
      const mockResult = {
        prompt: 'Fix it'
      };

      const validation = promptDrafter.validateFixPrompt(mockResult);
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Prompt is too short');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex failure scenarios', async () => {
      const complexResult = await promptDrafter.generateFixPrompt({
        taskId: 'COMPLEX',
        taskTitle: 'Complex Task with Multiple Issues',
        taskDescription: 'This task involves multiple components and has complex dependencies',
        errorType: 'validation',
        errorMessage: 'Multiple validation errors occurred during execution',
        errorContext: `Component A: Invalid input format
Component B: Missing required field
Component C: Value out of range`,
        expectedOutput: 'All validations should pass',
        actualOutput: 'Three validation errors occurred'
      });

      expect(complexResult.success).toBe(true);
      expect(complexResult.prompt).toContain('Complex Task with Multiple Issues');
      expect(complexResult.prompt).toContain('Multiple validation errors occurred');
      expect(complexResult.prompt).toContain('Expected Output: All validations should pass');
      expect(complexResult.prompt).toContain('Actual Output: Three validation errors occurred');
    });

    test('should generate prompts for different error types', async () => {
      const errorTypes = ['code', 'validation', 'configuration', 'permission', 'unknown'];
      
      for (const errorType of errorTypes) {
        const result = await promptDrafter.generateFixPrompt({
          taskId: `TYPE-${errorType}`,
          taskTitle: `Task with ${errorType} error`,
          errorType: errorType,
          errorMessage: `${errorType} error occurred`
        });

        expect(result.success).toBe(true);
        expect(result.prompt).toContain(errorType);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle minimal input', async () => {
      const result = await promptDrafter.generateFixPrompt({
        taskId: 'MINIMAL',
        errorMessage: 'Error'
      });

      expect(result.success).toBe(true);
      expect(result.prompt).toContain('MINIMAL');
      expect(result.prompt).toContain('Error');
      expect(result.prompt).toContain('Untitled Task'); // Default
      expect(result.prompt).toContain('No description provided'); // Default
    });

    test('should handle special characters in input', async () => {
      const result = await promptDrafter.generateFixPrompt({
        taskId: 'SPECIAL',
        taskTitle: 'Task with ©®™ characters',
        errorMessage: 'Error with 🚀 emoji and 🎉 special chars'
      });

      expect(result.success).toBe(true);
      expect(result.prompt).toContain('©®™');
      expect(result.prompt).toContain('🚀');
      expect(result.prompt).toContain('🎉');
    });

    test('should handle multiline error context', async () => {
      const multilineContext = `Line 1: First error
Line 2: Second error
Line 3: Third error`;

      const result = await promptDrafter.generateFixPrompt({
        taskId: 'MULTILINE',
        errorMessage: 'Multiple errors',
        errorContext: multilineContext
      });

      expect(result.success).toBe(true);
      expect(result.prompt).toContain('Line 1');
      expect(result.prompt).toContain('Line 2');
      expect(result.prompt).toContain('Line 3');
    });
  });

  describe('Error Handling', () => {
    test('should handle template filling errors gracefully', async () => {
      // This shouldn't happen in normal usage, but test the error handling
      const result = await promptDrafter.generateFixPrompt({
        taskId: 'ERROR-HANDLING',
        errorMessage: 'Test error'
      });

      expect(result.success).toBe(true);
      // Should still work with default values
      expect(result.prompt).toContain('ERROR-HANDLING');
    });

    test('should handle very long template data', async () => {
      const longData = 'A'.repeat(10000); // Very long string
      
      const result = await promptDrafter.generateFixPrompt({
        taskId: 'LONG-DATA',
        taskDescription: longData,
        errorContext: longData,
        errorMessage: 'Test error'
      });

      expect(result.success).toBe(true);
      // Should be truncated to max length
      expect(result.prompt.length).toBeLessThanOrEqual(4000);
    });
  });
});