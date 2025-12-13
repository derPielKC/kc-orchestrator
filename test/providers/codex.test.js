const { CodexProvider } = require('../../src/providers/CodexProvider');
const { ProviderTimeoutError, ProviderExecutionError } = require('../../src/providers/Provider');

describe('CodexProvider', () => {
  describe('Constructor', () => {
    it('should create CodexProvider with default options', () => {
      const provider = new CodexProvider();
      expect(provider.name).toBe('Codex');
      expect(provider.cliCommand).toBe('codex');
      expect(provider.defaultParams.model).toBe('code-davinci-002');
      expect(provider.defaultParams.temperature).toBe(0.2);
      expect(provider.timeout).toBe(60000);
      expect(provider.maxRetries).toBe(2);
    });

    it('should create CodexProvider with custom options', () => {
      const provider = new CodexProvider({
        defaultParams: {
          model: 'code-davinci-003',
          temperature: 0.5
        },
        timeout: 120000,
        maxRetries: 1
      });
      expect(provider.defaultParams.model).toBe('code-davinci-003');
      expect(provider.defaultParams.temperature).toBe(0.5);
      expect(provider.timeout).toBe(120000);
      expect(provider.maxRetries).toBe(1);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt for simple task', async () => {
      const provider = new CodexProvider();
      const task = {
        id: 'T1.1',
        title: 'Create project structure',
        description: 'Setup Node.js project with proper structure'
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('# Task: T1.1 - Create project structure');
      expect(prompt).toContain('# Description: Setup Node.js project with proper structure');
      expect(prompt).toContain('# Implementation Instructions:');
      expect(prompt).toContain('```');
    });

    it('should generate prompt with acceptance criteria', async () => {
      const provider = new CodexProvider();
      const task = {
        id: 'T1.2',
        title: 'Test task',
        description: 'Test description',
        acceptanceCriteria: [
          'Criteria 1',
          'Criteria 2'
        ]
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('# Acceptance Criteria:');
      expect(prompt).toContain('1. Criteria 1');
      expect(prompt).toContain('2. Criteria 2');
    });

    it('should generate prompt with constraints', async () => {
      const provider = new CodexProvider();
      const task = {
        id: 'T1.3',
        title: 'Test task',
        description: 'Test description',
        constraints: {
          do: ['Do this', 'Do that'],
          dont: ['Don\'t do this', 'Don\'t do that']
        }
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('# DO:');
      expect(prompt).toContain('- Do this');
      expect(prompt).toContain('- Do that');
      expect(prompt).toContain('# DON\'T:');
      expect(prompt).toContain('- Don\'t do this');
      expect(prompt).toContain('- Don\'t do that');
    });

    it('should generate prompt with outputs and check steps', async () => {
      const provider = new CodexProvider();
      const task = {
        id: 'T1.4',
        title: 'Test task',
        description: 'Test description',
        outputs: ['file1.js', 'file2.js'],
        checkSteps: ['npm test', 'node file1.js']
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('# Expected Outputs:');
      expect(prompt).toContain('- file1.js');
      expect(prompt).toContain('- file2.js');
      expect(prompt).toContain('# Verification Commands:');
      expect(prompt).toContain('- npm test');
      expect(prompt).toContain('- node file1.js');
    });

    it('should include context in prompt', async () => {
      const provider = new CodexProvider();
      const task = {
        id: 'T1.5',
        title: 'Test task',
        description: 'Test description'
      };
      const context = { project: 'test-project' };

      const prompt = await provider.generatePrompt(task, context);
      expect(prompt).toContain('# Context: Project test-project');
    });
  });

  describe('parseOutput', () => {
    it('should parse output with code block', async () => {
      const provider = new CodexProvider();
      const result = {
        stdout: 'Some log line\n```\nconst x = 1;\nconsole.log(x);\n```\nAnother log',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(1);
      expect(parsed.changes[0].type).toBe('code');
      expect(parsed.changes[0].content).toContain('const x = 1;');
      expect(parsed.changes[0].content).toContain('console.log(x);');
      expect(parsed.logs).toContain('Some log line');
      expect(parsed.logs).toContain('Another log');
    });

    it('should parse output without code block', async () => {
      const provider = new CodexProvider();
      const result = {
        stdout: 'const x = 1;\nconsole.log(x);',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(1);
      expect(parsed.changes[0].content).toBe('const x = 1;\nconsole.log(x);');
    });

    it('should handle error output', async () => {
      const provider = new CodexProvider();
      const result = {
        stdout: '',
        stderr: 'Error: Something went wrong',
        exitCode: 1
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Error: Something went wrong');
      expect(parsed.changes.length).toBe(0);
    });

    it('should handle empty output', async () => {
      const provider = new CodexProvider();
      const result = {
        stdout: '',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(0);
    });
  });

  describe('buildCommand', () => {
    it('should build command with Codex parameters', () => {
      const provider = new CodexProvider();
      const command = provider.buildCommand('/path/to/prompt.txt');
      expect(command).toContain('codex');
      expect(command).toContain('--prompt-file "/path/to/prompt.txt"');
      expect(command).toContain('--model "code-davinci-002"');
      expect(command).toContain('--temperature "0.2"');
    });

    it('should include custom parameters', () => {
      const provider = new CodexProvider({
        defaultParams: {
          model: 'code-davinci-003',
          max_tokens: 4096
        }
      });
      const command = provider.buildCommand('/path/to/prompt.txt', {
        params: {
          temperature: 0.7
        }
      });
      expect(command).toContain('--model "code-davinci-003"');
      expect(command).toContain('--max_tokens "4096"');
      expect(command).toContain('--temperature "0.7"');
    });
  });

  describe('executeTask', () => {
    it('should execute complete task workflow', async () => {
      const provider = new CodexProvider();
      
      // Mock the methods to avoid actual CLI execution
      const originalGeneratePrompt = provider.generatePrompt;
      const originalExecuteCLI = provider.executeCLI;
      const originalParseOutput = provider.parseOutput;
      
      provider.generatePrompt = async (task) => {
        return `Prompt for ${task.id}`;
      };
      
      provider.executeCLI = async (prompt) => {
        return {
          stdout: '```\nconst result = "success";\n```',
          stderr: '',
          exitCode: 0
        };
      };
      
      provider.parseOutput = async (result) => {
        return {
          success: true,
          changes: [{ type: 'code', content: 'const result = "success";' }]
        };
      };
      
      const task = {
        id: 'T1.1',
        title: 'Test task',
        description: 'Test description'
      };
      
      const result = await provider.executeTask(task);
      
      expect(result.success).toBe(true);
      expect(result.prompt).toBe('Prompt for T1.1');
      expect(result.executionResult.stdout).toContain('```\nconst result = "success";\n```');
      expect(result.parsedOutput.success).toBe(true);
      expect(result.provider).toBe('Codex');
      
      // Restore original methods
      provider.generatePrompt = originalGeneratePrompt;
      provider.executeCLI = originalExecuteCLI;
      provider.parseOutput = originalParseOutput;
    });

    it('should handle task execution failure', async () => {
      const provider = new CodexProvider();
      
      // Mock generatePrompt to throw error
      const originalGeneratePrompt = provider.generatePrompt;
      provider.generatePrompt = async () => {
        throw new Error('Prompt generation failed');
      };
      
      const task = {
        id: 'T1.1',
        title: 'Test task'
      };
      
      const result = await provider.executeTask(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Prompt generation failed');
      expect(result.provider).toBe('Codex');
      
      // Restore original method
      provider.generatePrompt = originalGeneratePrompt;
    });
  });

  describe('checkHealth', () => {
    it('should return false when Codex CLI is not available', async () => {
      const provider = new CodexProvider();
      
      // Mock the super.checkHealth method to return false
      const originalCheckHealth = provider.checkHealth;
      provider.checkHealth = async () => {
        // Simulate the base health check failing
        return false;
      };
      
      const isHealthy = await provider.checkHealth();
      expect(isHealthy).toBe(false);
      
      // Restore original method
      provider.checkHealth = originalCheckHealth;
    });
  });
});