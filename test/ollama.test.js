/**
 * Ollama Client Tests
 * 
 * Basic tests for the OllamaClient class
 */

const { OllamaClient, OllamaClientError, OllamaRequestError, OllamaResponseError } = require('../src/ollama');

describe('OllamaClient', () => {
  describe('Constructor', () => {
    test('should create client with default options', () => {
      const client = new OllamaClient();
      expect(client).toBeInstanceOf(OllamaClient);
      expect(client.baseUrl).toBe('http://localhost:11434');
      expect(client.defaultModel).toBe('llama3');
      expect(client.timeout).toBe(30000);
      expect(client.verbose).toBe(false);
    });

    test('should create client with custom options', () => {
      const client = new OllamaClient({
        baseUrl: 'http://custom:8080',
        defaultModel: 'custom-model',
        timeout: 60000,
        verbose: true
      });
      expect(client.baseUrl).toBe('http://custom:8080');
      expect(client.defaultModel).toBe('custom-model');
      expect(client.timeout).toBe(60000);
      expect(client.verbose).toBe(true);
    });

    test('should accept custom HTTP client', () => {
      const mockClient = { get: jest.fn(), post: jest.fn() };
      const client = new OllamaClient({ httpClient: mockClient });
      expect(client.client).toBe(mockClient);
    });
  });

  describe('Method Availability', () => {
    const client = new OllamaClient();

    test('should have checkAvailability method', () => {
      expect(typeof client.checkAvailability).toBe('function');
    });

    test('should have generateCompletion method', () => {
      expect(typeof client.generateCompletion).toBe('function');
    });

    test('should have generateChatCompletion method', () => {
      expect(typeof client.generateChatCompletion).toBe('function');
    });

    test('should have summarizeText method', () => {
      expect(typeof client.summarizeText).toBe('function');
    });

    test('should have analyzeLogs method', () => {
      expect(typeof client.analyzeLogs).toBe('function');
    });

    test('should have draftFixPrompt method', () => {
      expect(typeof client.draftFixPrompt).toBe('function');
    });

    test('should have judgeOutcome method', () => {
      expect(typeof client.judgeOutcome).toBe('function');
    });

    test('should have selectProvider method', () => {
      expect(typeof client.selectProvider).toBe('function');
    });

    test('should have getAvailableModels method', () => {
      expect(typeof client.getAvailableModels).toBe('function');
    });

    test('should have getModelInfo method', () => {
      expect(typeof client.getModelInfo).toBe('function');
    });
  });

  describe('Error Classes', () => {
    test('should export OllamaClientError', () => {
      expect(OllamaClientError).toBeDefined();
      expect(typeof OllamaClientError).toBe('function');
    });

    test('should export OllamaRequestError', () => {
      expect(OllamaRequestError).toBeDefined();
      expect(typeof OllamaRequestError).toBe('function');
    });

    test('should export OllamaResponseError', () => {
      expect(OllamaResponseError).toBeDefined();
      expect(typeof OllamaResponseError).toBe('function');
    });

    test('should create proper error instances', () => {
      const clientError = new OllamaClientError('Test error');
      expect(clientError).toBeInstanceOf(OllamaClientError);
      expect(clientError).toBeInstanceOf(Error);
      
      const requestError = new OllamaRequestError('Test request error');
      expect(requestError).toBeInstanceOf(OllamaRequestError);
      expect(requestError).toBeInstanceOf(OllamaClientError);
      
      const responseError = new OllamaResponseError('Test response error', {});
      expect(responseError).toBeInstanceOf(OllamaResponseError);
      expect(responseError).toBeInstanceOf(OllamaClientError);
    });
  });

  describe('Input Validation', () => {
    const client = new OllamaClient();

    test('generateCompletion should reject empty prompt', async () => {
      await expect(client.generateCompletion({ prompt: '' }))
        .rejects
        .toThrow(OllamaRequestError);
    });

    test('generateChatCompletion should reject empty messages', async () => {
      await expect(client.generateChatCompletion({ messages: [] }))
        .rejects
        .toThrow(OllamaRequestError);
    });

    test('summarizeText should reject empty text', async () => {
      await expect(client.summarizeText({ text: '' }))
        .rejects
        .toThrow(OllamaRequestError);
    });

    test('analyzeLogs should reject empty log data', async () => {
      await expect(client.analyzeLogs({ logData: '' }))
        .rejects
        .toThrow(OllamaRequestError);
    });

    test('draftFixPrompt should reject empty failure description', async () => {
      await expect(client.draftFixPrompt({ failureDescription: '' }))
        .rejects
        .toThrow(OllamaRequestError);
    });

    test('judgeOutcome should reject empty parameters', async () => {
      await expect(client.judgeOutcome({
        taskDescription: '',
        executionResult: 'result',
        acceptanceCriteria: 'criteria'
      }))
        .rejects
        .toThrow(OllamaRequestError);
    });

    test('selectProvider should reject empty parameters', async () => {
      await expect(client.selectProvider({
        taskDescription: '',
        availableProviders: ['provider1']
      }))
        .rejects
        .toThrow(OllamaRequestError);
    });
  });

  describe('Logging', () => {
    test('should have log method', () => {
      const client = new OllamaClient();
      expect(typeof client.log).toBe('function');
    });

    test('should log error messages when verbose is true', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const client = new OllamaClient({ verbose: true });
      
      // Call log method directly
      client.log('error', 'Test error message');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should not log info messages when verbose is false', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const client = new OllamaClient({ verbose: false });
      
      // Call log method directly - should not log info messages
      client.log('info', 'Test info message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should always log error messages regardless of verbose setting', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const client = new OllamaClient({ verbose: false });
      
      // Call log method with error level - should always log
      client.log('error', 'Test error message');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});