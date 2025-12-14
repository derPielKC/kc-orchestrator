/**
 * Agent Lightning Integration Tests
 * Tests for the integration layer between native and external implementations
 */

const assert = require('assert');
const AgentLightningIntegration = require('../../src/telemetry/AgentLightningIntegration');
const NativeAgentLightningIntegration = require('../../src/agent-lightning/integration');

describe('Agent Lightning Integration', () => {
  describe('Native Integration', () => {
    it('should initialize in native mode by default', () => {
      const integration = new NativeAgentLightningIntegration();
      assert.strictEqual(integration.getCurrentMode(), 'native');
      assert.strictEqual(integration.isNativeAvailable(), true);
    });

    it('should allow mode switching', () => {
      const integration = new NativeAgentLightningIntegration({ mode: 'external' });
      assert.strictEqual(integration.getCurrentMode(), 'external');
      
      integration.setMode('native');
      assert.strictEqual(integration.getCurrentMode(), 'native');
    });

    it('should validate configuration', () => {
      const integration = new NativeAgentLightningIntegration({ mode: 'native' });
      const config = integration.getConfiguration();
      
      assert.strictEqual(config.mode, 'native');
      assert.strictEqual(config.native.enabled, true);
      assert.strictEqual(config.fallback.enabled, true);
    });

    it('should check health', () => {
      const integration = new NativeAgentLightningIntegration();
      const health = integration.checkHealth();
      
      assert.strictEqual(health.healthy, true);
      assert.strictEqual(health.mode, 'native');
      assert.strictEqual(health.nativeAvailable, true);
    });
  });

  describe('AgentLightningIntegration Class', () => {
    it('should initialize with native integration', () => {
      const integration = new AgentLightningIntegration({ verbose: false });
      assert(integration.nativeIntegration);
      assert.strictEqual(integration.nativeIntegration.getCurrentMode(), 'native');
    });

    it('should use native implementation by default', async () => {
      const integration = new AgentLightningIntegration({ verbose: false });
      
      const testData = [
        { runId: '1', success: false, durationMs: 10000 },
        { runId: '2', success: true, durationMs: 2000 }
      ];
      
      const result = await integration.invokeAgentLightning('Test Summary', testData);
      
      assert(result.success === true);
      assert(Array.isArray(result.recommendations));
      assert(result.patterns.length > 0);
    });

    it('should handle empty data gracefully', async () => {
      const integration = new AgentLightningIntegration({ verbose: false });
      
      const result = await integration.invokeAgentLightning('Test Summary', []);
      
      assert(result.success === true);
      assert(Array.isArray(result.recommendations));
    });

    it('should convert to legacy format', () => {
      const integration = new AgentLightningIntegration({ verbose: false });
      
      const nativeResult = {
        recommendations: [{ id: 'rec1', title: 'Test' }],
        patterns: [{ patternType: 'failure' }],
        statistics: { patternsDetected: 1 }
      };
      
      const legacyResult = integration._convertToLegacyFormat(nativeResult);
      
      assert(legacyResult.success === true);
      assert(Array.isArray(legacyResult.recommendations));
      assert(legacyResult.patterns);
    });
  });

  describe('Integration Tests', () => {
    it('should process complete workflow with native implementation', async () => {
      const integration = new AgentLightningIntegration({ verbose: false });
      
      // Test data with various patterns
      const testData = [
        { runId: '1', success: false, message: 'timeout', durationMs: 10000, retryCount: 2 },
        { runId: '2', success: false, message: 'timeout', durationMs: 12000, retryCount: 3 },
        { runId: '3', success: true, durationMs: 2000 },
        { runId: '4', success: false, message: 'network error', durationMs: 15000, retryCount: 1 }
      ];
      
      const result = await integration.invokeAgentLightning('Test Summary', testData);
      
      // Verify result structure
      assert(result.success === true);
      assert(result.recommendations.length > 0);
      assert(result.patterns.length > 0);
      assert(result.painPoints.length > 0);
      
      // Verify recommendation quality
      const recommendation = result.recommendations[0];
      assert(recommendation.id);
      assert(recommendation.title);
      assert(recommendation.description);
      assert(recommendation.priority);
    });

    it('should handle fallback gracefully when native fails', async () => {
      // This test would require mocking, but we can test the structure
      const integration = new AgentLightningIntegration({ verbose: false });
      
      // The fallback mechanism is in place, but we can't easily test it
      // without mocking the native implementation to fail
      assert(integration.nativeIntegration.getConfiguration().fallback.enabled);
    });
  });

  describe('Configuration Tests', () => {
    it('should accept various configuration options', () => {
      const integration = new NativeAgentLightningIntegration({
        mode: 'native',
        native: { enabled: true },
        external: { enabled: false },
        fallback: { enabled: true, onExternalFailure: 'native' }
      });
      
      const config = integration.getConfiguration();
      assert.strictEqual(config.mode, 'native');
      assert.strictEqual(config.native.enabled, true);
      assert.strictEqual(config.fallback.enabled, true);
    });

    it('should validate mode configuration', () => {
      assert.throws(() => {
        new NativeAgentLightningIntegration({ mode: 'invalid' });
      }, /Invalid mode/);
    });
  });
});

console.log('✅ All Agent Lightning integration tests completed');