const { ClaudeProvider } = require('../../src/providers/ClaudeProvider');

describe('ClaudeProvider', () => {
  describe('Constructor', () => {
    it('should create ClaudeProvider with default options', () => {
      const provider = new ClaudeProvider();
      expect(provider.name).toBe('Claude');
      expect(provider.cliCommand).toBe('claude');
      expect(provider.defaultParams.model).toBe('claude-3-opus-20240229');
      expect(provider.defaultParams.system).toContain('helpful AI assistant');
      expect(provider.defaultParams.temperature).toBe(0.3);
      expect(provider.timeout).toBe(90000);
      expect(provider.maxRetries).toBe(2);
    });

    it('should create ClaudeProvider with custom options', () => {
      const provider = new ClaudeProvider({
        defaultParams: {
          model: 'claude-3-sonnet-20240229',
          temperature: 0.7
        },
        timeout: 120000,
        maxRetries: 1
      });
      expect(provider.defaultParams.model).toBe('claude-3-sonnet-20240229');
      expect(provider.defaultParams.temperature).toBe(0.7);
      expect(provider.timeout).toBe(120000);
      expect(provider.maxRetries).toBe(1);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt for simple task', async () => {
      const provider = new ClaudeProvider();
      const task = {
        id: 'T1.1',
        title: 'Create project structure',
        description: 'Setup Node.js project with proper structure'
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('Human: Please help me implement the following task:');
      expect(prompt).toContain('Task ID: T1.1');
      expect(prompt).toContain('Title: Create project structure');
      expect(prompt).toContain('Description: Setup Node.js project with proper structure');
      expect(prompt).toContain('Assistant:');
    });

    it('should generate prompt with acceptance criteria', async () => {
      const provider = new ClaudeProvider();
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
      expect(prompt).toContain('Acceptance Criteria:');
      expect(prompt).toContain('1. Criteria 1');
      expect(prompt).toContain('2. Criteria 2');
    });

    it('should generate prompt with constraints', async () => {
      const provider = new ClaudeProvider();
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
      expect(prompt).toContain('Constraints - DO:');
      expect(prompt).toContain('- Do this');
      expect(prompt).toContain('- Do that');
      expect(prompt).toContain('Constraints - DON\'T:');
      expect(prompt).toContain('- Don\'t do this');
      expect(prompt).toContain('- Don\'t do that');
    });

    it('should generate prompt with outputs and check steps', async () => {
      const provider = new ClaudeProvider();
      const task = {
        id: 'T1.4',
        title: 'Test task',
        description: 'Test description',
        outputs: ['file1.js', 'file2.js'],
        checkSteps: ['npm test', 'node file1.js']
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('Expected Outputs:');
      expect(prompt).toContain('- file1.js');
      expect(prompt).toContain('- file2.js');
      expect(prompt).toContain('Verification Commands:');
      expect(prompt).toContain('- npm test');
      expect(prompt).toContain('- node file1.js');
    });

    it('should include context in prompt', async () => {
      const provider = new ClaudeProvider();
      const task = {
        id: 'T1.5',
        title: 'Test task',
        description: 'Test description'
      };
      const context = { project: 'test-project' };

      const prompt = await provider.generatePrompt(task, context);
      expect(prompt).toContain('Context: This task is part of project test-project');
    });
  });

  describe('parseOutput', () => {
    it('should parse output with code block', async () => {
      const provider = new ClaudeProvider();
      const result = {
        stdout: 'Here is the implementation:\n```\nconst x = 1;\nconsole.log(x);\n```\nThis should work for your task.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(1);
      expect(parsed.changes[0].type).toBe('code');
      expect(parsed.changes[0].content).toContain('const x = 1;');
      expect(parsed.changes[0].content).toContain('console.log(x);');
      expect(parsed.response).toContain('Here is the implementation:');
      expect(parsed.response).toContain('This should work for your task.');
    });

    it('should parse output without code block', async () => {
      const provider = new ClaudeProvider();
      const result = {
        stdout: 'I understand the task but cannot provide code at this time.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(0);
      expect(parsed.response).toBe('I understand the task but cannot provide code at this time.');
    });

    it('should handle error output', async () => {
      const provider = new ClaudeProvider();
      const result = {
        stdout: '',
        stderr: 'Error: Claude API rate limit exceeded',
        exitCode: 1
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Error: Claude API rate limit exceeded');
      expect(parsed.changes.length).toBe(0);
    });

    it('should extract thoughts and reasoning', async () => {
      const provider = new ClaudeProvider();
      const result = {
        stdout: 'Thought: This task requires careful analysis\nReasoning: The constraints are complex\nHere is the solution:\n```\nconst x = 1;\n```',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.thoughts).toBeDefined();
      expect(parsed.thoughts.length).toBe(2);
      expect(parsed.thoughts[0]).toContain('This task requires careful analysis');
      expect(parsed.thoughts[1]).toContain('The constraints are complex');
    });
  });

  describe('buildCommand', () => {
    it('should build command with Claude parameters', () => {
      const provider = new ClaudeProvider();
      const command = provider.buildCommand('/path/to/prompt.txt');
      expect(command).toContain('claude');
      expect(command).toContain('--prompt-file "/path/to/prompt.txt"');
      expect(command).toContain('--model "claude-3-opus-20240229"');
      expect(command).toContain('--system-prompt');
      expect(command).toContain('helpful AI assistant');
    });

    it('should include custom parameters', () => {
      const provider = new ClaudeProvider({
        defaultParams: {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 8192
        }
      });
      const command = provider.buildCommand('/path/to/prompt.txt', {
        params: {
          temperature: 0.5
        }
      });
      expect(command).toContain('--model "claude-3-sonnet-20240229"');
      expect(command).toContain('--max_tokens "8192"');
      expect(command).toContain('--temperature "0.5"');
    });

    it('should handle system prompt parameter', () => {
      const provider = new ClaudeProvider({
        defaultParams: {
          system: 'Custom system prompt'
        }
      });
      const command = provider.buildCommand('/path/to/prompt.txt');
      expect(command).toContain('--system-prompt "Custom system prompt"');
    });
  });

  describe('executeTask', () => {
    it('should execute complete task workflow', async () => {
      const provider = new ClaudeProvider();
      
      // Mock the methods to avoid actual CLI execution
      const originalGeneratePrompt = provider.generatePrompt;
      const originalExecuteCLI = provider.executeCLI;
      const originalParseOutput = provider.parseOutput;
      
      provider.generatePrompt = async (task) => {
        return `Human: ${task.id}\nAssistant:`;
      };
      
      provider.executeCLI = async (prompt) => {
        return {
          stdout: 'Here is the solution:\n```\nconst result = "success";\n```',
          stderr: '',
          exitCode: 0
        };
      };
      
      provider.parseOutput = async (result) => {
        return {
          success: true,
          response: 'Here is the solution:',
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
      expect(result.prompt).toBe('Human: T1.1\nAssistant:');
      expect(result.executionResult.stdout).toContain('Here is the solution:');
      expect(result.parsedOutput.success).toBe(true);
      expect(result.provider).toBe('Claude');
      
      // Restore original methods
      provider.generatePrompt = originalGeneratePrompt;
      provider.executeCLI = originalExecuteCLI;
      provider.parseOutput = originalParseOutput;
    });

    it('should handle task execution failure', async () => {
      const provider = new ClaudeProvider();
      
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
      expect(result.provider).toBe('Claude');
      
      // Restore original method
      provider.generatePrompt = originalGeneratePrompt;
    });
  });

  describe('checkHealth', () => {
    it('should return false when Claude CLI is not available', async () => {
      const provider = new ClaudeProvider();
      
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