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
});