const { Provider, ProviderTimeoutError, ProviderExecutionError } = require('../../src/providers/Provider');
const fs = require('fs');
const path = require('path');

describe('Provider Interface', () => {
  describe('Provider class', () => {
    it('should create provider with default options', () => {
      const provider = new Provider();
      expect(provider.name).toBe('BaseProvider');
      expect(provider.cliCommand).toBe('baseprovider');
      expect(provider.timeout).toBe(30000);
      expect(provider.maxRetries).toBe(3);
    });
    
    it('should create provider with custom options', () => {
      const provider = new Provider({
        name: 'TestProvider',
        cliCommand: 'test-cli',
        timeout: 60000,
        maxRetries: 5
      });
      expect(provider.name).toBe('TestProvider');
      expect(provider.cliCommand).toBe('test-cli');
      expect(provider.timeout).toBe(60000);
      expect(provider.maxRetries).toBe(5);
    });
  });
  
  describe('buildCommand', () => {
    it('should build command with prompt file', () => {
      const provider = new Provider({ cliCommand: 'test-cli' });
      const command = provider.buildCommand('/path/to/prompt.txt');
      expect(command).toContain('test-cli');
      expect(command).toContain('--prompt-file');
      expect(command).toContain('/path/to/prompt.txt');
    });
    
    it('should include default parameters', () => {
      const provider = new Provider({
        cliCommand: 'test-cli',
        defaultParams: { model: 'gpt-4', temperature: 0.7 }
      });
      const command = provider.buildCommand('/path/to/prompt.txt');
      expect(command).toContain('--model "gpt-4"');
      expect(command).toContain('--temperature "0.7"');
    });
    
    it('should include custom parameters', () => {
      const provider = new Provider({ cliCommand: 'test-cli' });
      const command = provider.buildCommand('/path/to/prompt.txt', {
        params: { model: 'gpt-4', max_tokens: 100 }
      });
      expect(command).toContain('--model "gpt-4"');
      expect(command).toContain('--max_tokens "100"');
    });
  });
  
  describe('Error classes', () => {
    it('should create ProviderTimeoutError', () => {
      const error = new ProviderTimeoutError('Test timeout');
      expect(error.name).toBe('ProviderTimeoutError');
      expect(error.message).toBe('Test timeout');
    });
    
    it('should create ProviderExecutionError', () => {
      const result = { stdout: 'test', stderr: 'error', exitCode: 1 };
      const error = new ProviderExecutionError('Test execution failed', result);
      expect(error.name).toBe('ProviderExecutionError');
      expect(error.message).toBe('Test execution failed');
      expect(error.result).toBe(result);
    });
  });
  
  describe('Abstract methods', () => {
    it('should throw error for unimplemented generatePrompt', async () => {
      const provider = new Provider();
      await expect(provider.generatePrompt({})).rejects.toThrow('generatePrompt must be implemented by subclass');
    });
    
    it('should throw error for unimplemented parseOutput', async () => {
      const provider = new Provider();
      await expect(provider.parseOutput({})).rejects.toThrow('parseOutput must be implemented by subclass');
    });
  });
  
  describe('executeTask', () => {
    it('should throw error when generatePrompt fails', async () => {
      const provider = new Provider();
      const result = await provider.executeTask({ id: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('generatePrompt must be implemented by subclass');
    });
  });
  
  describe('Mock provider implementation', () => {
    class MockProvider extends Provider {
      async generatePrompt(task) {
        return `Prompt for task: ${task.id}`;
      }
      
      async parseOutput(result) {
        return {
          response: result.stdout,
          error: result.stderr
        };
      }
    }
    
    it('should execute complete workflow with mock provider', async () => {
      const provider = new MockProvider({ cliCommand: 'echo' });
      
      // Mock the executeCLI method to avoid actual CLI execution
      const originalExecuteCLI = provider.executeCLI;
      provider.executeCLI = async (prompt) => {
        return {
          stdout: `Response to: ${prompt}`,
          stderr: '',
          exitCode: 0
        };
      };
      
      const task = { id: 'T1', title: 'Test task' };
      const result = await provider.executeTask(task);
      
      expect(result.success).toBe(true);
      expect(result.prompt).toBe('Prompt for task: T1');
      expect(result.executionResult.stdout).toContain('Response to: Prompt for task: T1');
      expect(result.parsedOutput.response).toBe('Response to: Prompt for task: T1');
      
      // Restore original method
      provider.executeCLI = originalExecuteCLI;
    });
  });
});