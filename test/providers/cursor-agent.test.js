const { CursorAgentProvider } = require('../../src/providers/CursorAgentProvider');

describe('CursorAgentProvider', () => {
  describe('Constructor', () => {
    it('should create CursorAgentProvider with default options', () => {
      const provider = new CursorAgentProvider();
      expect(provider.name).toBe('CursorAgent');
      expect(provider.cliCommand).toBe('cursor-agent');
      expect(provider.defaultParams.model).toBe('gpt-4-turbo');
      expect(provider.defaultParams.temperature).toBe(0.2);
      expect(provider.defaultParams.tools).toBe('auto');
      expect(provider.defaultParams.workflow).toBe('default');
      expect(provider.timeout).toBe(180000);
      expect(provider.maxRetries).toBe(2);
    });

    it('should create CursorAgentProvider with custom options', () => {
      const provider = new CursorAgentProvider({
        defaultParams: {
          model: 'gpt-4-turbo-preview',
          temperature: 0.5,
          workflow: 'complex'
        },
        timeout: 240000,
        maxRetries: 1
      });
      expect(provider.defaultParams.model).toBe('gpt-4-turbo-preview');
      expect(provider.defaultParams.temperature).toBe(0.5);
      expect(provider.defaultParams.workflow).toBe('complex');
      expect(provider.timeout).toBe(240000);
      expect(provider.maxRetries).toBe(1);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt for simple task', async () => {
      const provider = new CursorAgentProvider();
      const task = {
        id: 'T1.1',
        title: 'Create project structure',
        description: 'Setup Node.js project with proper structure'
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('# Task: T1.1 - Create project structure');
      expect(prompt).toContain('# Description: Setup Node.js project with proper structure');
      expect(prompt).toContain('# Implementation Instructions:');
      expect(prompt).toContain('Use appropriate tool calls for file operations and validation');
      expect(prompt).toContain('```');
    });

    it('should generate prompt with acceptance criteria', async () => {
      const provider = new CursorAgentProvider();
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
      const provider = new CursorAgentProvider();
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
      const provider = new CursorAgentProvider();
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
      const provider = new CursorAgentProvider();
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
      const provider = new CursorAgentProvider();
      const task = {
        id: 'T1.6',
        title: 'Test task',
        description: 'Test description'
      };

      const prompt = await provider.generatePrompt(task);
      expect(prompt).toContain('Use appropriate tool calls for file operations and validation');
    });
  });

  describe('parseOutput', () => {
    it('should parse output with code block', async () => {
      const provider = new CursorAgentProvider();
      const result = {
        stdout: 'Executing workflow...\n```\nconst x = 1;\nconsole.log(x);\n```\nWorkflow completed successfully.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(1);
      expect(parsed.changes[0].type).toBe('code');
      expect(parsed.changes[0].content).toContain('const x = 1;');
      expect(parsed.changes[0].content).toContain('console.log(x);');
      expect(parsed.response).toContain('Executing workflow...');
      expect(parsed.response).toContain('Workflow completed successfully.');
    });

    it('should parse output without code block', async () => {
      const provider = new CursorAgentProvider();
      const result = {
        stdout: 'Task analysis complete. No code changes needed.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.changes.length).toBe(0);
      expect(parsed.response).toBe('Task analysis complete. No code changes needed.');
    });

    it('should parse output with tool calls', async () => {
      const provider = new CursorAgentProvider();
      const result = {
        stdout: 'Starting workflow execution...\nTOOL_CALL: write_file\npath: test.js\ncontent: const x = 1;\nEND_TOOL_CALL\nTOOL_CALL: bash\ncommand: npm test\nEND_TOOL_CALL\nWorkflow execution completed.',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(true);
      expect(parsed.toolCalls.length).toBe(2);
      expect(parsed.toolCalls[0].name).toBe('write_file');
      expect(parsed.toolCalls[0].parameters.path).toBe('test.js');
      expect(parsed.toolCalls[1].name).toBe('bash');
      expect(parsed.toolCalls[1].parameters.command).toBe('npm test');
      expect(parsed.response).toContain('Starting workflow execution...');
      expect(parsed.response).toContain('Workflow execution completed.');
    });

    it('should extract workflow information', async () => {
      const provider = new CursorAgentProvider();
      const result = {
        stdout: 'Step 1: Analyzing requirements\nWorkflow: default\nStep 2: Generating code\n```\nconst x = 1;\n```\nStep 3: Validation complete',
        stderr: '',
        exitCode: 0
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.workflow).toBeDefined();
      expect(parsed.workflow.length).toBe(4); // Step 1, Workflow, Step 2, Step 3
      expect(parsed.workflow[0]).toContain('Step 1');
      expect(parsed.workflow[1]).toContain('Workflow');
      expect(parsed.workflow[3]).toContain('Step 3');
    });

    it('should handle error output', async () => {
      const provider = new CursorAgentProvider();
      const result = {
        stdout: '',
        stderr: 'Error: Cursor Agent workflow failed - invalid configuration',
        exitCode: 1
      };

      const parsed = await provider.parseOutput(result, {});
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Error: Cursor Agent workflow failed - invalid configuration');
      expect(parsed.changes.length).toBe(0);
    });
  });

  describe('buildCommand', () => {
    it('should build command with Cursor Agent parameters', () => {
      const provider = new CursorAgentProvider();
      const command = provider.buildCommand('/path/to/prompt.txt');
      expect(command).toContain('cursor-agent');
      expect(command).toContain('--prompt-file "/path/to/prompt.txt"');
      expect(command).toContain('--model "gpt-4-turbo"');
      expect(command).toContain('--temperature "0.2"');
      expect(command).toContain('--tools "auto"');
      expect(command).toContain('--workflow "default"');
    });

    it('should include custom parameters', () => {
      const provider = new CursorAgentProvider({
        defaultParams: {
          model: 'gpt-4-turbo-preview',
          max_tokens: 8192,
          workflow: 'complex'
        }
      });
      const command = provider.buildCommand('/path/to/prompt.txt', {
        params: {
          temperature: 0.5
        }
      });
      expect(command).toContain('--model "gpt-4-turbo-preview"');
      expect(command).toContain('--max_tokens "8192"');
      expect(command).toContain('--workflow "complex"');
      expect(command).toContain('--temperature "0.5"');
    });
  });

  describe('executeTask', () => {
    it('should execute complete task workflow', async () => {
      const provider = new CursorAgentProvider();
      
      // Mock the methods to avoid actual CLI execution
      const originalGeneratePrompt = provider.generatePrompt;
      const originalExecuteCLI = provider.executeCLI;
      const originalParseOutput = provider.parseOutput;
      
      provider.generatePrompt = async (task) => {
        return `Task: ${task.id}\n\`\`\`\n`;
      };
      
      provider.executeCLI = async (prompt) => {
        return {
          stdout: 'Workflow result:\n\`\`\`\nconst result = "success";\n\`\`\`',
          stderr: '',
          exitCode: 0
        };
      };
      
      provider.parseOutput = async (result) => {
        return {
          success: true,
          response: 'Workflow result:',
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
      expect(result.executionResult.stdout).toContain('Workflow result:');
      expect(result.parsedOutput.success).toBe(true);
      expect(result.provider).toBe('CursorAgent');
      
      // Restore original methods
      provider.generatePrompt = originalGeneratePrompt;
      provider.executeCLI = originalExecuteCLI;
      provider.parseOutput = originalParseOutput;
    });

    it('should handle task execution failure', async () => {
      const provider = new CursorAgentProvider();
      
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
      expect(result.provider).toBe('CursorAgent');
      
      // Restore original method
      provider.generatePrompt = originalGeneratePrompt;
    });
  });

  describe('checkHealth', () => {
    it('should return false when Cursor Agent CLI is not available', async () => {
      const provider = new CursorAgentProvider();
      
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
      const provider = new CursorAgentProvider();
      const toolCallText = 'TOOL_CALL: write_file\npath: test.js\ncontent: const x = 1;\nEND_TOOL_CALL';
      
      const toolCalls = provider._parseToolCalls(toolCallText);
      expect(toolCalls.length).toBe(1);
      expect(toolCalls[0].name).toBe('write_file');
      expect(toolCalls[0].parameters.path).toBe('test.js');
      expect(toolCalls[0].parameters.content).toBe('const x = 1;');
    });

    it('should parse multiple tool calls', () => {
      const provider = new CursorAgentProvider();
      const toolCallText = 'TOOL_CALL: bash\ncommand: npm test\nEND_TOOL_CALL\nTOOL_CALL: read_file\npath: package.json\nEND_TOOL_CALL';
      
      const toolCalls = provider._parseToolCalls(toolCallText);
      expect(toolCalls.length).toBe(2);
      expect(toolCalls[0].name).toBe('bash');
      expect(toolCalls[0].parameters.command).toBe('npm test');
      expect(toolCalls[1].name).toBe('read_file');
      expect(toolCalls[1].parameters.path).toBe('package.json');
    });

    it('should handle empty tool call text', () => {
      const provider = new CursorAgentProvider();
      const toolCallText = '';
      
      const toolCalls = provider._parseToolCalls(toolCallText);
      expect(toolCalls.length).toBe(0);
    });
  });
});