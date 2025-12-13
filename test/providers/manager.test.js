const { ProviderManager } = require('../../src/providers/ProviderManager');
const { ProviderTimeoutError, ProviderExecutionError } = require('../../src/providers/Provider');

describe('ProviderManager', () => {
  describe('Constructor', () => {
    it('should create ProviderManager with default options', () => {
      const manager = new ProviderManager();
      expect(manager.providerOrder).toEqual(['Codex', 'Claude', 'Vibe', 'CursorAgent']);
      expect(manager.timeout).toBe(120000);
      expect(manager.verbose).toBe(false);
      expect(manager.getAvailableProviders().length).toBe(4);
    });

    it('should create ProviderManager with custom options', () => {
      const manager = new ProviderManager({
        providerOrder: ['Claude', 'Codex'],
        timeout: 180000,
        verbose: true
      });
      expect(manager.providerOrder).toEqual(['Claude', 'Codex']);
      expect(manager.timeout).toBe(180000);
      expect(manager.verbose).toBe(true);
      expect(manager.getAvailableProviders().length).toBe(2);
    });

    it('should handle unknown providers gracefully', () => {
      const consoleWarn = console.warn;
      console.warn = jest.fn();
      
      const manager = new ProviderManager({
        providerOrder: ['Codex', 'UnknownProvider', 'Claude']
      });
      
      expect(console.warn).toHaveBeenCalledWith('Unknown provider in configuration: UnknownProvider');
      expect(manager.getAvailableProviders()).toContain('Codex');
      expect(manager.getAvailableProviders()).toContain('Claude');
      expect(manager.getAvailableProviders()).not.toContain('UnknownProvider');
      
      console.warn = consoleWarn;
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const manager = new ProviderManager();
      const providers = manager.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers).toContain('Codex');
      expect(providers).toContain('Claude');
      expect(providers).toContain('Vibe');
      expect(providers).toContain('CursorAgent');
    });
  });

  describe('getProviderStats', () => {
    it('should return statistics for all providers', () => {
      const manager = new ProviderManager();
      const stats = manager.getProviderStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
      
      const providers = manager.getAvailableProviders();
      providers.forEach(provider => {
        expect(stats[provider]).toBeDefined();
        expect(stats[provider].attempts).toBe(0);
        expect(stats[provider].successes).toBe(0);
        expect(stats[provider].failures).toBe(0);
      });
    });

    it('should return statistics for specific provider', () => {
      const manager = new ProviderManager();
      const stats = manager.getProviderStats('Codex');
      
      expect(stats).toBeDefined();
      expect(stats.attempts).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.failures).toBe(0);
    });

    it('should return null for unknown provider', () => {
      const manager = new ProviderManager();
      const stats = manager.getProviderStats('UnknownProvider');
      
      expect(stats).toBeNull();
    });
  });

  describe('checkAllProviderHealth', () => {
    it('should check health of all providers', async () => {
      const manager = new ProviderManager();
      const healthResults = await manager.checkAllProviderHealth();
      
      expect(healthResults).toBeDefined();
      expect(typeof healthResults).toBe('object');
      
      const providers = manager.getAvailableProviders();
      providers.forEach(provider => {
        expect(healthResults[provider]).toBeDefined();
        expect(healthResults[provider].healthy).toBeDefined();
        expect(healthResults[provider].timestamp).toBeDefined();
      });
    });
  });

  describe('executeWithFallback', () => {
    it('should execute task successfully with first provider', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Mock the first provider to succeed
      const firstProviderName = manager.providerOrder[0];
      const provider = manager.providerInstances[firstProviderName];
      
      const originalExecuteTask = provider.executeTask;
      provider.executeTask = async (task) => {
        return {
          success: true,
          prompt: 'test prompt',
          executionResult: { stdout: 'test output', stderr: '', exitCode: 0 },
          parsedOutput: { success: true, changes: [] },
          provider: firstProviderName
        };
      };
      
      const task = { id: 'T1.1', title: 'Test task' };
      const result = await manager.executeWithFallback(task);
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe(firstProviderName);
      expect(result.fallbackLog.length).toBe(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      
      // Restore original method
      provider.executeTask = originalExecuteTask;
    });

    it('should fall back to second provider when first fails', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Mock the first provider to fail
      const firstProviderName = manager.providerOrder[0];
      const firstProvider = manager.providerInstances[firstProviderName];
      
      // Mock the second provider to succeed
      const secondProviderName = manager.providerOrder[1];
      const secondProvider = manager.providerInstances[secondProviderName];
      
      const originalFirstExecute = firstProvider.executeTask;
      const originalSecondExecute = secondProvider.executeTask;
      
      firstProvider.executeTask = async () => {
        throw new Error('First provider failed');
      };
      
      secondProvider.executeTask = async (task) => {
        return {
          success: true,
          prompt: 'test prompt',
          executionResult: { stdout: 'test output', stderr: '', exitCode: 0 },
          parsedOutput: { success: true, changes: [] },
          provider: secondProviderName
        };
      };
      
      const task = { id: 'T1.1', title: 'Test task' };
      const result = await manager.executeWithFallback(task);
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe(secondProviderName);
      expect(result.fallbackLog.length).toBe(1);
      expect(result.fallbackLog[0].provider).toBe(firstProviderName);
      expect(result.fallbackLog[0].error).toContain('First provider failed');
      
      // Restore original methods
      firstProvider.executeTask = originalFirstExecute;
      secondProvider.executeTask = originalSecondExecute;
    });

    it('should handle timeout errors in fallback', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Mock ALL providers to timeout
      const providers = manager.getAvailableProviders();
      const originalMethods = {};
      
      providers.forEach(providerName => {
        const provider = manager.providerInstances[providerName];
        originalMethods[providerName] = provider.executeTask;
        provider.executeTask = async () => {
          throw new ProviderTimeoutError('Provider timed out');
        };
      });
      
      const task = { id: 'T1.1', title: 'Test task' };
      const result = await manager.executeWithFallback(task);
      
      expect(result.success).toBe(false);
      expect(result.fallbackLog.length).toBe(providers.length);
      expect(result.fallbackLog[0].type).toBe('timeout');
      expect(result.fallbackLog[0].details).toContain('Timeout after');
      
      // Restore original methods
      providers.forEach(providerName => {
        const provider = manager.providerInstances[providerName];
        provider.executeTask = originalMethods[providerName];
      });
    });

    it('should handle execution errors in fallback', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Mock ALL providers to have execution errors
      const providers = manager.getAvailableProviders();
      const originalMethods = {};
      
      providers.forEach(providerName => {
        const provider = manager.providerInstances[providerName];
        originalMethods[providerName] = provider.executeTask;
        provider.executeTask = async () => {
          throw new ProviderExecutionError('Execution failed', {
            stdout: 'partial output',
            stderr: 'error details',
            exitCode: 1
          });
        };
      });
      
      const task = { id: 'T1.1', title: 'Test task' };
      const result = await manager.executeWithFallback(task);
      
      expect(result.success).toBe(false);
      expect(result.fallbackLog.length).toBe(providers.length);
      expect(result.fallbackLog[0].type).toBe('execution');
      expect(result.fallbackLog[0].details.stdout).toBe('partial output');
      
      // Restore original methods
      providers.forEach(providerName => {
        const provider = manager.providerInstances[providerName];
        provider.executeTask = originalMethods[providerName];
      });
    });

    it('should return failure when all providers fail', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Mock all providers to fail
      const providers = manager.getAvailableProviders();
      const originalMethods = {};
      
      providers.forEach(providerName => {
        const provider = manager.providerInstances[providerName];
        originalMethods[providerName] = provider.executeTask;
        provider.executeTask = async () => {
          throw new Error(`${providerName} failed`);
        };
      });
      
      const task = { id: 'T1.1', title: 'Test task' };
      const result = await manager.executeWithFallback(task);
      
      expect(result.success).toBe(false);
      expect(result.fallbackLog.length).toBe(providers.length);
      expect(result.error).toBeDefined();
      
      // Restore original methods
      providers.forEach(providerName => {
        const provider = manager.providerInstances[providerName];
        provider.executeTask = originalMethods[providerName];
      });
    });

    it('should update provider statistics on success', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Mock the first provider to succeed
      const firstProviderName = manager.providerOrder[0];
      const provider = manager.providerInstances[firstProviderName];
      
      const originalExecute = provider.executeTask;
      provider.executeTask = async (task) => {
        return {
          success: true,
          prompt: 'test prompt',
          executionResult: { stdout: 'test output', stderr: '', exitCode: 0 },
          parsedOutput: { success: true, changes: [] },
          provider: firstProviderName
        };
      };
      
      const task = { id: 'T1.1', title: 'Test task' };
      await manager.executeWithFallback(task);
      
      const stats = manager.getProviderStats(firstProviderName);
      expect(stats.attempts).toBe(1);
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(0);
      expect(stats.lastUsed).toBeDefined();
      expect(stats.lastSuccess).toBeDefined();
      
      // Restore original method
      provider.executeTask = originalExecute;
    });

    it('should update provider statistics on failure', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Mock the first provider to fail
      const firstProviderName = manager.providerOrder[0];
      const provider = manager.providerInstances[firstProviderName];
      
      const originalExecute = provider.executeTask;
      provider.executeTask = async () => {
        throw new Error('Provider failed');
      };
      
      const task = { id: 'T1.1', title: 'Test task' };
      await manager.executeWithFallback(task);
      
      const stats = manager.getProviderStats(firstProviderName);
      expect(stats.attempts).toBe(1);
      expect(stats.successes).toBe(0);
      expect(stats.failures).toBe(1);
      expect(stats.lastUsed).toBeDefined();
      expect(stats.lastFailure).toBeDefined();
      
      // Restore original method
      provider.executeTask = originalExecute;
    });
  });

  describe('executeWithCircuitBreaker', () => {
    it('should skip providers in circuit breaker state', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Simulate a provider with consecutive failures
      const firstProviderName = manager.providerOrder[0];
      const stats = manager.providerStats[firstProviderName];
      
      // Set up circuit breaker conditions
      stats.failures = 5; // More than failureThreshold to be safe
      stats.lastFailure = new Date(Date.now() - 10000).toISOString(); // recent failure
      stats.successes = 0; // No successes to ensure consecutive failures
      stats.attempts = 5; // Ensure attempts match failures
      
      // Mock the second provider to succeed
      const secondProviderName = manager.providerOrder[1];
      const secondProvider = manager.providerInstances[secondProviderName];
      
      const originalExecute = secondProvider.executeTask;
      secondProvider.executeTask = async (task) => {
        return {
          success: true,
          prompt: 'test prompt',
          executionResult: { stdout: 'test output', stderr: '', exitCode: 0 },
          parsedOutput: { success: true, changes: [] },
          provider: secondProviderName
        };
      };
      
      const task = { id: 'T1.1', title: 'Test task' };
      const result = await manager.executeWithCircuitBreaker(task, {}, {
        failureThreshold: 3,
        resetTimeout: 300000,
        maxRetries: 1
      });
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe(secondProviderName);
      
      // Restore original method
      secondProvider.executeTask = originalExecute;
    });

    it('should reset circuit breaker after timeout', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Simulate a provider with old failures (circuit breaker should be reset)
      const firstProviderName = manager.providerOrder[0];
      const stats = manager.providerStats[firstProviderName];
      
      // Set up old circuit breaker conditions
      stats.failures = 3; // failureThreshold
      stats.lastFailure = new Date(Date.now() - 400000).toISOString(); // old failure
      
      // Mock the first provider to succeed
      const firstProvider = manager.providerInstances[firstProviderName];
      const originalExecute = firstProvider.executeTask;
      firstProvider.executeTask = async (task) => {
        return {
          success: true,
          prompt: 'test prompt',
          executionResult: { stdout: 'test output', stderr: '', exitCode: 0 },
          parsedOutput: { success: true, changes: [] },
          provider: firstProviderName
        };
      };
      
      const task = { id: 'T1.1', title: 'Test task' };
      const result = await manager.executeWithCircuitBreaker(task, {}, {
        failureThreshold: 3,
        resetTimeout: 300000
      });
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe(firstProviderName);
      
      // Restore original method
      firstProvider.executeTask = originalExecute;
    });

    it('should throw error when all providers in circuit breaker state', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Simulate all providers with consecutive failures
      const providers = manager.getAvailableProviders();
      
      providers.forEach(providerName => {
        const stats = manager.providerStats[providerName];
        stats.failures = 3; // failureThreshold
        stats.lastFailure = new Date(Date.now() - 10000).toISOString(); // recent failure
      });
      
      const task = { id: 'T1.1', title: 'Test task' };
      
      await expect(manager.executeWithCircuitBreaker(task, {}, {
        failureThreshold: 3,
        resetTimeout: 300000
      })).rejects.toThrow('All providers in circuit breaker state');
    });
  });

  describe('getBestAvailableProvider', () => {
    it('should return provider with best statistics', () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Simulate different success rates
      const stats1 = manager.providerStats[manager.providerOrder[0]];
      stats1.attempts = 10;
      stats1.successes = 8;
      stats1.lastSuccess = new Date().toISOString();
      
      const stats2 = manager.providerStats[manager.providerOrder[1]];
      stats2.attempts = 5;
      stats2.successes = 3;
      stats2.lastSuccess = new Date(Date.now() - 100000).toISOString();
      
      const bestProvider = manager.getBestAvailableProvider();
      expect(bestProvider).toBe(manager.providerOrder[0]); // Higher success rate
    });

    it('should return null when no providers available', () => {
      const manager = new ProviderManager({ providerOrder: ['UnknownProvider'] });
      const bestProvider = manager.getBestAvailableProvider();
      expect(bestProvider).toBeNull();
    });
  });

  describe('executeWithBestProvider', () => {
    it('should execute task with best provider', async () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Set up a provider with good statistics
      const bestProviderName = manager.providerOrder[0];
      const stats = manager.providerStats[bestProviderName];
      stats.attempts = 5;
      stats.successes = 5;
      stats.lastSuccess = new Date().toISOString();
      
      const provider = manager.providerInstances[bestProviderName];
      const originalExecute = provider.executeTask;
      provider.executeTask = async (task) => {
        return {
          success: true,
          prompt: 'test prompt',
          executionResult: { stdout: 'test output', stderr: '', exitCode: 0 },
          parsedOutput: { success: true, changes: [] },
          provider: bestProviderName
        };
      };
      
      const task = { id: 'T1.1', title: 'Test task' };
      const result = await manager.executeWithBestProvider(task);
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe(bestProviderName);
      
      // Restore original method
      provider.executeTask = originalExecute;
    });

    it('should throw error when no providers available', async () => {
      const manager = new ProviderManager({ providerOrder: ['UnknownProvider'] });
      const task = { id: 'T1.1', title: 'Test task' };
      
      await expect(manager.executeWithBestProvider(task))
        .rejects.toThrow('No available providers');
    });
  });

  describe('resetProviderStats', () => {
    it('should reset statistics for specific provider', () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Set some statistics
      const providerName = manager.providerOrder[0];
      const stats = manager.providerStats[providerName];
      stats.attempts = 10;
      stats.successes = 8;
      stats.failures = 2;
      stats.lastUsed = new Date().toISOString();
      stats.lastSuccess = new Date().toISOString();
      stats.lastFailure = new Date().toISOString();
      
      // Reset statistics
      manager.resetProviderStats(providerName);
      
      const resetStats = manager.getProviderStats(providerName);
      expect(resetStats.attempts).toBe(0);
      expect(resetStats.successes).toBe(0);
      expect(resetStats.failures).toBe(0);
      expect(resetStats.lastUsed).toBeNull();
      expect(resetStats.lastSuccess).toBeNull();
      expect(resetStats.lastFailure).toBeNull();
    });

    it('should reset statistics for all providers', () => {
      const manager = new ProviderManager({ verbose: false });
      
      // Set some statistics for all providers
      const providers = manager.getAvailableProviders();
      providers.forEach(providerName => {
        const stats = manager.providerStats[providerName];
        stats.attempts = 5;
        stats.successes = 3;
        stats.failures = 2;
      });
      
      // Reset all statistics
      manager.resetProviderStats();
      
      // Check that all providers have been reset
      providers.forEach(providerName => {
        const stats = manager.getProviderStats(providerName);
        expect(stats.attempts).toBe(0);
        expect(stats.successes).toBe(0);
        expect(stats.failures).toBe(0);
      });
    });
  });

  describe('AI Provider Selection', () => {
    let aiManager;
    
    beforeAll(() => {
      aiManager = new ProviderManager({
        verbose: false,
        useAIProviderSelection: true
      });
    });

    it('should have AI provider selection enabled by default', () => {
      const defaultManager = new ProviderManager({ verbose: false });
      expect(defaultManager.useAIProviderSelection).toBe(true);
    });

    it('should allow disabling AI provider selection', () => {
      const noAiManager = new ProviderManager({
        verbose: false,
        useAIProviderSelection: false
      });
      expect(noAiManager.useAIProviderSelection).toBe(false);
    });

    it('should have checkOllamaAvailability method', () => {
      expect(typeof aiManager.checkOllamaAvailability).toBe('function');
    });

    it('should have getAIProviderRecommendation method', () => {
      expect(typeof aiManager.getAIProviderRecommendation).toBe('function');
    });

    it('should have getBestProviderWithAI method', () => {
      expect(typeof aiManager.getBestProviderWithAI).toBe('function');
    });

    it('should have executeWithAIAssistedProvider method', () => {
      expect(typeof aiManager.executeWithAIAssistedProvider).toBe('function');
    });

    it('should handle AI provider selection when Ollama unavailable', async () => {
      // Mock Ollama availability check to return false
      const mockCheckAvailability = jest.spyOn(aiManager.ollamaClient, 'checkAvailability');
      mockCheckAvailability.mockResolvedValue(false);
      
      const task = { id: 'T1', title: 'Test Task', description: 'Test description' };
      const result = await aiManager.getAIProviderRecommendation(task, ['Codex', 'Claude']);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Ollama not available');
      
      mockCheckAvailability.mockRestore();
    });

    it('should handle AI provider selection when disabled', async () => {
      const noAiManager = new ProviderManager({
        verbose: false,
        useAIProviderSelection: false
      });
      
      const task = { id: 'T1', title: 'Test Task', description: 'Test description' };
      const result = await noAiManager.getAIProviderRecommendation(task, ['Codex', 'Claude']);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('AI provider selection is disabled');
    });

    it('should parse AI provider recommendation correctly', async () => {
      // Mock the Ollama client to return a realistic recommendation
      const mockSelectProvider = jest.spyOn(aiManager.ollamaClient, 'selectProvider');
      mockSelectProvider.mockResolvedValue({
        response: `Recommended provider: Claude
Reasoning for the selection:
Claude is best suited for this natural language task due to its strong conversational capabilities and context understanding.
Alternative options if the recommended provider fails:
Codex, Vibe
Specific configuration recommendations:
Use temperature 0.3 for more creative responses
Confidence score: 85%`,
        model: 'llama3',
        totalDuration: 1000
      });
      
      const task = { id: 'T1', title: 'Test Task', description: 'Test description' };
      const result = await aiManager.getAIProviderRecommendation(task, ['Codex', 'Claude', 'Vibe']);
      
      expect(result.success).toBe(true);
      expect(result.recommendedProvider).toBe('Claude');
      expect(result.reasoning).toContain('Claude is best suited');
      expect(result.alternatives).toEqual(['Codex', 'Vibe']);
      expect(result.configuration).toContain('temperature 0.3');
      expect(result.confidence).toBe(85);
      expect(result.model).toBe('llama3');
      
      mockSelectProvider.mockRestore();
    });

    it('should cache AI provider recommendations', async () => {
      // Mock the Ollama client
      const mockSelectProvider = jest.spyOn(aiManager.ollamaClient, 'selectProvider');
      mockSelectProvider.mockResolvedValue({
        response: 'Recommended provider: Codex\nReasoning: Best for code\nConfidence score: 90%',
        model: 'llama3',
        totalDuration: 1000
      });
      
      const task = { id: 'T1', title: 'Test Task', description: 'Test description' };
      const providers = ['Codex', 'Claude'];
      
      // First call - should use Ollama
      const firstResult = await aiManager.getAIProviderRecommendation(task, providers);
      expect(firstResult.success).toBe(true);
      expect(mockSelectProvider).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      const secondResult = await aiManager.getAIProviderRecommendation(task, providers);
      expect(secondResult.success).toBe(true);
      expect(mockSelectProvider).toHaveBeenCalledTimes(1); // Still 1 - cached
      
      mockSelectProvider.mockRestore();
    });

    it('should fall back to traditional selection when AI fails', async () => {
      // Mock the Ollama client to fail
      const mockSelectProvider = jest.spyOn(aiManager.ollamaClient, 'selectProvider');
      mockSelectProvider.mockRejectedValue(new Error('Ollama error'));
      
      const task = { id: 'T1', title: 'Test Task', description: 'Test description' };
      const bestProvider = await aiManager.getBestProviderWithAI(task);
      
      // Should return a valid provider (traditional fallback)
      expect(bestProvider).toBeTruthy();
      expect(aiManager.getAvailableProviders()).toContain(bestProvider);
      
      mockSelectProvider.mockRestore();
    });

    it('should use AI recommendation when available', async () => {
      // Mock the Ollama client to return a valid recommendation
      const mockSelectProvider = jest.spyOn(aiManager.ollamaClient, 'selectProvider');
      mockSelectProvider.mockResolvedValue({
        response: 'Recommended provider: Vibe\nReasoning: Best for this task\nConfidence score: 95%',
        model: 'llama3',
        totalDuration: 1000
      });
      
      const task = { id: 'T1', title: 'Test Task', description: 'Test description' };
      const bestProvider = await aiManager.getBestProviderWithAI(task);
      
      // Should return the AI-recommended provider
      expect(bestProvider).toBe('Vibe');
      
      mockSelectProvider.mockRestore();
    });

    it('should handle unavailable AI-recommended provider', async () => {
      // Mock the Ollama client to recommend an unavailable provider
      const mockSelectProvider = jest.spyOn(aiManager.ollamaClient, 'selectProvider');
      mockSelectProvider.mockResolvedValue({
        response: 'Recommended provider: NonExistent\nReasoning: Best for this task\nConfidence score: 95%',
        model: 'llama3',
        totalDuration: 1000
      });
      
      const task = { id: 'T1', title: 'Test Task', description: 'Test description' };
      const bestProvider = await aiManager.getBestProviderWithAI(task);
      
      // Should fall back to traditional selection
      expect(bestProvider).toBeTruthy();
      expect(bestProvider).not.toBe('NonExistent');
      expect(aiManager.getAvailableProviders()).toContain(bestProvider);
      
      mockSelectProvider.mockRestore();
    });

    it('should extract confidence from recommendation text', () => {
      const confidence1 = aiManager._extractConfidenceFromText('Confidence score: 85%');
      expect(confidence1).toBe(85);
      
      const confidence2 = aiManager._extractConfidenceFromText('Some text Confidence score: 70% more text');
      expect(confidence2).toBe(70);
      
      const confidence3 = aiManager._extractConfidenceFromText('No confidence score here');
      expect(confidence3).toBe(70); // Default value
    });
  });
});