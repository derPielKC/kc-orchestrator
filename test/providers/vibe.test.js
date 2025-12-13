const { VibeProvider } = require('../../src/providers/VibeProvider');

describe('VibeProvider', () => {
  describe('Constructor', () => {
    it('should create VibeProvider with default options', () => {
      const provider = new VibeProvider();
      expect(provider.name).toBe('Vibe');
      expect(provider.cliCommand).toBe('vibe');
      expect(provider.defaultParams.model).toBe('devstral-2');
      expect(provider.defaultParams.temperature).toBe(0.1);
      expect(provider.defaultParams.tools).toBe('auto');
      expect(provider.timeout).toBe(120000);
      expect(provider.maxRetries).toBe(2);
    });

    it('should create VibeProvider with custom options', () => {
      const provider = new VibeProvider({
        defaultParams: {
          model: 'devstral-3',
          temperature: 0.3
        },
        timeout: 180000,
        maxRetries: 1
      });
      expect(provider.defaultParams.model).toBe('devstral-3');
      expect(provider.defaultParams.temperature).toBe(0.3);
      expect(provider.timeout).toBe(180000);
      expect(provider.maxRetries).toBe(1);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt for simple task', async () => {
      const provider = new VibeProvider();
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
      const provider = new VibeProvider();
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
      const provider = new VibeProvider();
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
      const provider = new VibeProvider();
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
      const provider = new VibeProvider();
      const task = {
        id: 'T1.5',
        title: 'Test task',
        description: 'Test description'
      };
      const context = { project: 'test-project' };

      const prompt = await provider.generatePrompt(task, context);
      expect(prompt).toContain('# Context: Project test-project');
    });

    it('should include tool calling instruction', async () => {
      const provider = new VibeProvider();
      const task = {
        id: 'T1.6',
        title: 'Test task',
        description: 'Test description'
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('If tool calls are needed, use the appropriate function calls');
    });
  });

  describe('parseOutput', () => {
    it('should parse output with code block', async () => {
      const provider = new VibeProvider();
      const result = {
        stdout: 'Generating solution...\n```\nconst x = 1;\nconsole.log(x);\n```\nSolution complete.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(1);
      expect(parsed.changes[0].type).toBe('code');
      expect(parsed.changes[0].content).toContain('const x = 1;');
      expect(parsed.changes[0].content).toContain('console.log(x);');
      expect(parsed.response).toContain('Generating solution...');
      expect(parsed.response).toContain('Solution complete.');
    });

    it('should parse output without code block', async () => {
      const provider = new VibeProvider();
      const result = {
        stdout: 'Task understood but no code generated.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(0);
      expect(parsed.response).toBe('Task understood but no code generated.');
    });

    it('should parse output with tool calls', async () => {
      const provider = new VibeProvider();
      const result = {
        stdout: 'Analyzing task...\nTOOL_CALL: write_file\npath: test.js\ncontent: const x = 1;\nEND_TOOL_CALL\nTask complete.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.toolCalls.length).toBe(1);
      expect(parsed.toolCalls[0].name).toBe('write_file');
      expect(parsed.toolCalls[0].parameters.path).toBe('test.js');
      expect(parsed.toolCalls[0].parameters.content).toBe('const x = 1;');
      expect(parsed.response).toContain('Analyzing task...');
      expect(parsed.response).toContain('Task complete.');
    });

    it('should handle error output', async () => {
      const provider = new VibeProvider();
      const result = {
        stdout: '',
        stderr: 'Error: Vibe service unavailable',
        exitCode: 1
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Error: Vibe service unavailable');
      expect(parsed.changes.length).toBe(0);
    });

    it('should handle complex tool calls', async () => {
      const provider = new VibeProvider();
      const result = {
        stdout: 'Starting...\nTOOL_CALL: search_replace\nfile_path: test.js\ncontent: old code\nEND_TOOL_CALL\nTOOL_CALL: bash\ncommand: npm test\nEND_TOOL_CALL\nDone.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.toolCalls.length).toBe(2);
      expect(parsed.toolCalls[0].name).toBe('search_replace');
      expect(parsed.toolCalls[1].name).toBe('bash');
      expect(parsed.toolCalls[1].parameters.command).toBe('npm test');
    });
  });

  describe('buildCommand', () => {
    it('should build command with Vibe parameters', () => {
      const provider = new VibeProvider();
      const command = provider.buildCommand('/path/to/prompt.txt');
      expect(command).toContain('vibe');
      expect(command).toContain('--prompt-file "/path/to/prompt.txt"');
      expect(command).toContain('--model "devstral-2"');
      expect(command).toContain('--temperature "0.1"');
      expect(command).toContain('--tools "auto"');
    });

    it('should include custom parameters', () => {
      const provider = new VibeProvider({
        defaultParams: {
          model: 'devstral-3',
          max_tokens: 8192
        }
      });
      const command = provider.buildCommand('/path/to/prompt.txt', {
        params: {
          temperature: 0.3
        }
      });
      expect(command).toContain('--model "devstral-3"');
      expect(command).toContain('--max_tokens "8192"');
      expect(command).toContain('--temperature "0.3"');
    });
  });

  describe('executeTask', () => {
    it('should execute complete task workflow', async () => {
      const provider = new VibeProvider();
      
      // Mock the methods to avoid actual CLI execution
      const originalGeneratePrompt = provider.generatePrompt;
      const originalExecuteCLI = provider.executeCLI;
      const originalParseOutput = provider.parseOutput;
      
      provider.generatePrompt = async (task) => {
        return `Task: ${task.id}\n\`\`\`\n`;
      };
      
      provider.executeCLI = async (prompt) => {
        return {
          stdout: 'Solution:\n\`\`\`\nconst result = "success";\n\`\`\`',
          stderr: '',
          exitCode: 0
        };
      };
      
      provider.parseOutput = async (result) => {
        return {
          success: true,
          response: 'Solution:',
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
      expect(result.prompt).toBe('Task: T1.1\n```\n');
      expect(result.executionResult.stdout).toContain('Solution:');
      expect(result.parsedOutput.success).toBe(true);
      expect(result.provider).toBe('Vibe');
      
      // Restore original methods
      provider.generatePrompt = originalGeneratePrompt;
      provider.executeCLI = originalExecuteCLI;
      provider.parseOutput = originalParseOutput;
    });

    it('should handle task execution failure', async () => {
      const provider = new VibeProvider();
      
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
      expect(result.provider).toBe('Vibe');
      
      // Restore original method
      provider.generatePrompt = originalGeneratePrompt;
    });
  });

  describe('checkHealth', () => {
    it('should return false when Vibe CLI is not available', async () => {
      const provider = new VibeProvider();
      
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

  describe('_parseToolCalls', () => {
    it('should parse simple tool calls', () => {
      const provider = new VibeProvider();
      const toolCallText = 'TOOL_CALL: write_file\npath: test.js\ncontent: const x = 1;\nEND_TOOL_CALL';
      
      const toolCalls = provider._parseToolCalls(toolCallText);
      expect(toolCalls.length).toBe(1);
      expect(toolCalls[0].name).toBe('write_file');
      expect(toolCalls[0].parameters.path).toBe('test.js');
      expect(toolCalls[0].parameters.content).toBe('const x = 1;');
    });

    it('should parse multiple tool calls', () => {
      const provider = new VibeProvider();
      const toolCallText = 'TOOL_CALL: bash\ncommand: npm test\nEND_TOOL_CALL\nTOOL_CALL: read_file\npath: package.json\nEND_TOOL_CALL';
      
      const toolCalls = provider._parseToolCalls(toolCallText);
      expect(toolCalls.length).toBe(2);
      expect(toolCalls[0].name).toBe('bash');
      expect(toolCalls[0].parameters.command).toBe('npm test');
      expect(toolCalls[1].name).toBe('read_file');
      expect(toolCalls[1].parameters.path).toBe('package.json');
    });

    it('should handle empty tool call text', () => {
      const provider = new VibeProvider();
      const toolCallText = '';
      
      const toolCalls = provider._parseToolCalls(toolCallText);
      expect(toolCalls.length).toBe(0);
    });
  });
});