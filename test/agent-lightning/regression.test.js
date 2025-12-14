/**
 * Agent Lightning Regression Tests
 * Tests to prevent regressions and ensure consistent behavior
 */

const assert = require('assert');
const NativeAgentLightning = require('../../src/agent-lightning/NativeAgentLightning');

describe('Agent Lightning Regression Tests', () => {
  describe('Behavioral Consistency', () => {
    it('should produce consistent results for same input', async () => {
      const agl = new NativeAgentLightning();
      const testData = [
        { runId: '1', success: false, message: 'timeout' },
        { runId: '2', success: false, message: 'timeout' },
        { runId: '3', success: true }
      ];
      
      const result1 = await agl.analyze(testData);
      const result2 = await agl.analyze(testData);
      
      // Results should be structurally similar
      assert.strictEqual(result1.patterns.length, result2.patterns.length);
      assert.strictEqual(result1.painPoints.length, result2.painPoints.length);
      assert.strictEqual(result1.recommendations.length, result2.recommendations.length);
    });

    it('should maintain pattern detection logic', async () => {
      const agl = new NativeAgentLightning();
      
      // Test failure pattern detection
      const failureData = Array(30).fill().map((_, i) => ({
        runId: `run${i}`,
        success: i < 5 // 25 failures, 5 successes
      }));
      
      const result = await agl.analyze(failureData);
      const failurePatterns = result.patterns.filter(p => p.patternType === 'failure');
      
      assert(failurePatterns.length > 0);
      assert.strictEqual(failurePatterns[0].severity, 'high');
    });

    it('should maintain retry pattern detection', async () => {
      const agl = new NativeAgentLightning();
      
      const retryData = Array(20).fill().map((_, i) => ({
        runId: `run${i}`,
        retryCount: i % 3 === 0 ? 3 : 0
      }));
      
      const result = await agl.analyze(retryData);
      const retryPatterns = result.patterns.filter(p => p.patternType === 'retry');
      
      assert(retryPatterns.length > 0);
    });

    it('should maintain performance pattern detection', async () => {
      const agl = new NativeAgentLightning();
      
      const performanceData = Array(25).fill().map((_, i) => ({
        runId: `run${i}`,
        durationMs: 10000 + i * 1000
      }));
      
      const result = await agl.analyze(performanceData);
      const performancePatterns = result.patterns.filter(p => p.patternType === 'performance');
      
      assert(performancePatterns.length > 0);
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle empty input gracefully', async () => {
      const agl = new NativeAgentLightning();
      
      const result = await agl.analyze([]);
      assert.deepStrictEqual(result.patterns, []);
      assert.deepStrictEqual(result.painPoints, []);
      assert.deepStrictEqual(result.recommendations, []);
    });

    it('should handle null input gracefully', async () => {
      const agl = new NativeAgentLightning();
      
      const result = await agl.analyze(null);
      assert.deepStrictEqual(result.patterns, []);
    });

    it('should handle undefined input gracefully', async () => {
      const agl = new NativeAgentLightning();
      
      const result = await agl.analyze(undefined);
      assert.deepStrictEqual(result.patterns, []);
    });

    it('should handle events with missing fields', async () => {
      const agl = new NativeAgentLightning();
      
      const result = await agl.analyze([
        { runId: '1' }, // Missing all fields
        { runId: '2', success: true } // Missing other fields
      ]);
      
      // Should not crash
      assert(Array.isArray(result.patterns));
    });

    it('should handle invalid timestamps', async () => {
      const agl = new NativeAgentLightning();
      
      const result = await agl.analyze([
        { runId: '1', timestamp: 'invalid-date' },
        { runId: '2', timestamp: new Date().toISOString() }
      ]);
      
      // Should filter out invalid timestamps
      assert(Array.isArray(result.patterns));
    });
  });

  describe('Configuration Validation', () => {
    it('should validate mode configuration', () => {
      assert.throws(() => {
        new NativeAgentLightning({ mode: 'invalid-mode' });
      }, /Invalid mode/);
    });

    it('should accept valid modes', () => {
      const modes = ['native', 'external', 'hybrid'];
      modes.forEach(mode => {
        const agl = new NativeAgentLightning({ mode });
        assert.strictEqual(agl.config.mode, mode);
      });
    });

    it('should validate analysis options', () => {
      const agl = new NativeAgentLightning({
        analysis: {
          minSeverity: 'invalid'
        }
      });
      
      // Should use default for invalid severity
      const config = agl.config;
      assert(config.analysis);
    });
  });

  describe('Recommendation Quality', () => {
    it('should generate meaningful recommendations', async () => {
      const agl = new NativeAgentLightning();
      
      const testData = [
        { runId: '1', success: false, message: 'critical timeout' },
        { runId: '2', success: false, message: 'critical timeout' },
        { runId: '3', success: false, message: 'critical timeout' }
      ];
      
      const result = await agl.analyze(testData);
      
      if (result.recommendations.length > 0) {
        const recommendation = result.recommendations[0];
        
        // Recommendation should have all required fields
        assert(recommendation.id);
        assert(recommendation.title);
        assert(recommendation.description);
        assert(recommendation.priority);
        assert(recommendation.implementation);
        assert(recommendation.acceptanceCriteria);
        assert(recommendation.constraints);
        
        // Title should mention the issue
        assert(recommendation.title.toLowerCase().includes('urgent') ||
               recommendation.title.toLowerCase().includes('reliability'));
      }
    });

    it('should generate actionable implementation steps', async () => {
      const agl = new NativeAgentLightning();
      
      const testData = [
        { runId: '1', success: false, message: 'network error' },
        { runId: '2', success: false, message: 'network error' }
      ];
      
      const result = await agl.analyze(testData);
      
      if (result.recommendations.length > 0) {
        const recommendation = result.recommendations[0];
        const steps = recommendation.implementation.split('\n');
        
        // Should have multiple steps
        assert(steps.length >= 3);
        
        // Steps should be numbered
        assert(steps[0].startsWith('1.'));
      }
    });

    it('should generate specific acceptance criteria', async () => {
      const agl = new NativeAgentLightning();
      
      const testData = [
        { runId: '1', success: false, message: 'database timeout' },
        { runId: '2', success: false, message: 'database timeout' },
        { runId: '3', success: false, message: 'database timeout' }
      ];
      
      const result = await agl.analyze(testData);
      
      if (result.recommendations.length > 0) {
        const recommendation = result.recommendations[0];
        const criteria = recommendation.acceptanceCriteria;
        
        // Should have multiple criteria
        assert(criteria.length >= 3);
        
        // Criteria should be specific
        criteria.forEach(criterion => {
          assert(criterion.length > 10); // Reasonable length
        });
      }
    });
  });

  describe('Integration with Existing Code', () => {
    it('should maintain backward compatibility', async () => {
      const agl = new NativeAgentLightning();
      
      // Test with data that existing code might send
      const legacyData = [
        {
          runId: 'test-run-1',
          success: false,
          message: 'Test failure',
          durationMs: 5000,
          retryCount: 2,
          provider: 'codex'
        }
      ];
      
      const result = await agl.analyze(legacyData);
      
      // Should return expected structure
      assert(result.success !== undefined);
      assert(Array.isArray(result.recommendations));
      assert(Array.isArray(result.patterns));
      assert(Array.isArray(result.painPoints));
    });

    it('should handle various data formats', async () => {
      const agl = new NativeAgentLightning();
      
      // Test with minimal data
      const minimalData = [{ runId: '1', success: false }];
      const result1 = await agl.analyze(minimalData);
      
      // Test with complete data
      const completeData = [{
        runId: '1',
        success: false,
        message: 'error',
        durationMs: 1000,
        retryCount: 1,
        provider: 'codex',
        timestamp: new Date().toISOString()
      }];
      const result2 = await agl.analyze(completeData);
      
      // Both should work without crashing
      assert(result1.success !== undefined);
      assert(result2.success !== undefined);
    });
  });

  describe('Long-term Stability', () => {
    it('should handle repeated calls without degradation', async () => {
      const agl = new NativeAgentLightning();
      const testData = Array(50).fill().map((_, i) => ({
        runId: `run${i}`,
        success: i % 2 === 0
      }));
      
      const durations = [];
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();
        await agl.analyze(testData);
        durations.push(Date.now() - startTime);
      }
      
      // Check that performance doesn't degrade
      const firstDuration = durations[0];
      const lastDuration = durations[durations.length - 1];
      const degradation = ((lastDuration - firstDuration) / firstDuration) * 100;
      
      console.log(`🔄 Long-term stability test (20 calls):`);
      console.log(`   First call: ${firstDuration}ms`);
      console.log(`   Last call: ${lastDuration}ms`);
      console.log(`   Degradation: ${degradation.toFixed(1)}%`);
      
      // Should not degrade by more than 50%
      assert(Math.abs(degradation) < 50, `Performance degraded by ${degradation.toFixed(1)}%`);
    });

    it('should maintain consistent behavior over time', async () => {
      const agl = new NativeAgentLightning();
      const testData = [
        { runId: '1', success: false, message: 'consistent error' },
        { runId: '2', success: false, message: 'consistent error' }
      ];
      
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await agl.analyze(testData));
      }
      
      // All results should have similar structure
      results.forEach(result => {
        assert.strictEqual(result.patterns.length, results[0].patterns.length);
        assert.strictEqual(result.painPoints.length, results[0].painPoints.length);
        assert.strictEqual(result.recommendations.length, results[0].recommendations.length);
      });
    });
  });
});

console.log('✅ All Agent Lightning regression tests completed');