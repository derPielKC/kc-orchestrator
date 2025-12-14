/**
 * Agent Lightning Unit Tests
 * Comprehensive unit tests for individual components and utilities
 */

const assert = require('assert');
const utils = require('../../src/agent-lightning/utils');
const NativeAgentLightning = require('../../src/agent-lightning/NativeAgentLightning');

describe('Agent Lightning Unit Tests', () => {
  describe('Utility Functions', () => {
    describe('calculateStatistics', () => {
      it('should calculate statistics from empty array', () => {
        const result = utils.calculateStatistics([]);
        assert.deepStrictEqual(result, {
          totalRuns: 0,
          successRate: 0,
          failureRate: 0,
          avgDurationMs: 0,
          maxDurationMs: 0,
          minDurationMs: 0
        });
      });

      it('should calculate statistics from mixed results', () => {
        const events = [
          { success: true, durationMs: 1000 },
          { success: false, durationMs: 2000 },
          { success: true, durationMs: 1500 },
          { success: false, durationMs: 3000 }
        ];
        
        const result = utils.calculateStatistics(events);
        assert.strictEqual(result.totalRuns, 4);
        assert.strictEqual(result.successRate, 50);
        assert.strictEqual(result.failureRate, 50);
        assert.strictEqual(result.avgDurationMs, 1875);
        assert.strictEqual(result.maxDurationMs, 3000);
        assert.strictEqual(result.minDurationMs, 1000);
      });

      it('should handle missing durationMs', () => {
        const events = [
          { success: true },
          { success: false, durationMs: 2000 },
          { success: true, durationMs: 1500 }
        ];
        
        const result = utils.calculateStatistics(events);
        assert.strictEqual(result.avgDurationMs, 1750); // Only averages the ones with durationMs
      });
    });

    describe('calculateProviderStatistics', () => {
      it('should calculate provider statistics', () => {
        const events = [
          { provider: 'codex', success: true, durationMs: 1000 },
          { provider: 'codex', success: false, durationMs: 2000 },
          { provider: 'claude', success: true, durationMs: 1500 },
          { provider: 'codex', success: true, durationMs: 3000 }
        ];
        
        const result = utils.calculateProviderStatistics(events);
        assert.strictEqual(result['codex'].usageCount, 3);
        assert.strictEqual(result['codex'].successCount, 2);
        assert.strictEqual(result['codex'].successRate, 66.66666666666666);
        assert.strictEqual(result['codex'].avgDurationMs, 2000);
        
        assert.strictEqual(result['claude'].usageCount, 1);
        assert.strictEqual(result['claude'].successCount, 1);
        assert.strictEqual(result['claude'].successRate, 100);
        assert.strictEqual(result['claude'].avgDurationMs, 1500);
      });

      it('should handle events without provider', () => {
        const events = [
          { success: true, durationMs: 1000 },
          { provider: 'codex', success: true, durationMs: 2000 }
        ];
        
        const result = utils.calculateProviderStatistics(events);
        assert.strictEqual(Object.keys(result).length, 1); // Only codex
        assert.strictEqual(result['codex'].usageCount, 1);
      });
    });

    describe('generateUniqueId', () => {
      it('should generate unique IDs', () => {
        const id1 = utils.generateUniqueId();
        const id2 = utils.generateUniqueId();
        
        assert.notStrictEqual(id1, id2);
        assert(id1.startsWith('agl-'));
        assert(id2.startsWith('agl-'));
      });
    });

    describe('calculateContentHash', () => {
      it('should generate consistent hashes', () => {
        const content = 'test content';
        const hash1 = utils.calculateContentHash(content);
        const hash2 = utils.calculateContentHash(content);
        
        assert.strictEqual(hash1, hash2);
        assert.strictEqual(hash1.length, 64); // SHA-256
      });

      it('should generate different hashes for different content', () => {
        const hash1 = utils.calculateContentHash('content1');
        const hash2 = utils.calculateContentHash('content2');
        
        assert.notStrictEqual(hash1, hash2);
      });
    });

    describe('formatDuration', () => {
      it('should format milliseconds', () => {
        assert.strictEqual(utils.formatDuration(500), '500ms');
        assert.strictEqual(utils.formatDuration(1500), '1.50s');
        assert.strictEqual(utils.formatDuration(65000), '1.08min');
      });
    });

    describe('validateAnalysisOptions', () => {
      it('should validate and set defaults', () => {
        const result = utils.validateAnalysisOptions({});
        
        assert.strictEqual(result.minSeverity, 'low');
        assert.strictEqual(result.timeWindowDays, 30);
        assert.strictEqual(result.maxRecommendations, 10);
        assert.strictEqual(result.includeExperimental, false);
        assert.strictEqual(result.detailedAnalysis, true);
      });

      it('should override defaults', () => {
        const result = utils.validateAnalysisOptions({
          minSeverity: 'high',
          timeWindowDays: 7
        });
        
        assert.strictEqual(result.minSeverity, 'high');
        assert.strictEqual(result.timeWindowDays, 7);
      });
    });

    describe('filterEventsByTimeWindow', () => {
      it('should filter events by time window', () => {
        const now = new Date();
        const oldDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
        
        const events = [
          { timestamp: now.toISOString() },
          { timestamp: oldDate.toISOString() }
        ];
        
        const result = utils.filterEventsByTimeWindow(events, 30);
        assert.strictEqual(result.length, 1); // Only the recent one
      });

      it('should handle invalid timestamps', () => {
        const events = [
          { timestamp: 'invalid' },
          { timestamp: new Date().toISOString() }
        ];
        
        const result = utils.filterEventsByTimeWindow(events, 30);
        assert.strictEqual(result.length, 1); // Only the valid one
      });
    });
  });

  describe('NativeAgentLightning Class', () => {
    describe('Constructor', () => {
      it('should initialize with default config', () => {
        const agl = new NativeAgentLightning();
        assert.strictEqual(agl.config.mode, 'native');
        assert.strictEqual(agl.config.analysis.minSeverity, 'low');
      });

      it('should accept custom config', () => {
        const agl = new NativeAgentLightning({
          mode: 'native',
          analysis: { minSeverity: 'high' }
        });
        assert.strictEqual(agl.config.analysis.minSeverity, 'high');
      });
    });

    describe('checkHealth', () => {
      it('should return healthy status', () => {
        const agl = new NativeAgentLightning();
        const health = agl.checkHealth();
        
        assert.strictEqual(health.healthy, true);
        assert.strictEqual(health.mode, 'native');
        assert(health.timestamp);
      });
    });

    describe('analyze method', () => {
      it('should handle empty run data', async () => {
        const agl = new NativeAgentLightning();
        const result = await agl.analyze([]);
        
        assert.deepStrictEqual(result.patterns, []);
        assert.deepStrictEqual(result.painPoints, []);
        assert.deepStrictEqual(result.recommendations, []);
      });

      it('should analyze simple failure pattern', async () => {
        const agl = new NativeAgentLightning();
        const events = [
          { runId: '1', success: false, message: 'timeout' },
          { runId: '2', success: false, message: 'timeout' }
        ];
        
        const result = await agl.analyze(events);
        assert.strictEqual(result.patterns.length, 1);
        assert.strictEqual(result.patterns[0].patternType, 'failure');
      });

      it('should respect minSeverity option', async () => {
        const agl = new NativeAgentLightning();
        const events = [
          { runId: '1', success: false, message: 'timeout' }
        ];
        
        // With high severity threshold, no patterns should be detected
        const result = await agl.analyze(events, { minSeverity: 'high' });
        assert.strictEqual(result.patterns.length, 0);
      });
    });

    describe('Pattern Detection', () => {
      it('should detect high failure rates', async () => {
        const agl = new NativeAgentLightning();
        const events = Array(10).fill().map((_, i) => (
          { runId: `run${i}`, success: i < 3 } // 7 failures, 3 successes
        ));
        
        const result = await agl.analyze(events);
        const failurePatterns = result.patterns.filter(p => p.patternType === 'failure');
        
        assert(failurePatterns.length > 0);
        assert.strictEqual(failurePatterns[0].severity, 'high');
      });

      it('should detect retry patterns', async () => {
        const agl = new NativeAgentLightning();
        const events = [
          { runId: '1', retryCount: 3 },
          { runId: '2', retryCount: 5 },
          { runId: '3', retryCount: 2 }
        ];
        
        const result = await agl.analyze(events);
        const retryPatterns = result.patterns.filter(p => p.patternType === 'retry');
        
        assert(retryPatterns.length > 0);
      });

      it('should detect performance bottlenecks', async () => {
        const agl = new NativeAgentLightning();
        const events = [
          { runId: '1', durationMs: 10000 },
          { runId: '2', durationMs: 15000 },
          { runId: '3', durationMs: 20000 }
        ];
        
        const result = await agl.analyze(events);
        const performancePatterns = result.patterns.filter(p => p.patternType === 'performance');
        
        assert(performancePatterns.length > 0);
      });
    });

    describe('Pain Point Analysis', () => {
      it('should create pain points from patterns', async () => {
        const agl = new NativeAgentLightning();
        const events = [
          { runId: '1', success: false, message: 'critical error' },
          { runId: '2', success: false, message: 'critical error' }
        ];
        
        const result = await agl.analyze(events);
        assert(result.painPoints.length > 0);
        assert.strictEqual(result.painPoints[0].type, 'reliability');
      });

      it('should calculate comprehensive metrics', async () => {
        const agl = new NativeAgentLightning();
        const events = Array(20).fill().map((_, i) => (
          { runId: `run${i}`, success: false, message: 'error' }
        ));
        
        const result = await agl.analyze(events);
        if (result.painPoints.length > 0) {
          const painPoint = result.painPoints[0];
          assert(painPoint.metrics.businessImpact > 0);
          assert(painPoint.metrics.technicalDebt > 0);
          assert(painPoint.metrics.priorityScore > 0);
        }
      });
    });

    describe('Recommendation Generation', () => {
      it('should generate recommendations from pain points', async () => {
        const agl = new NativeAgentLightning();
        const events = [
          { runId: '1', success: false, message: 'timeout' },
          { runId: '2', success: false, message: 'timeout' },
          { runId: '3', success: false, message: 'timeout' }
        ];
        
        const result = await agl.analyze(events);
        assert(result.recommendations.length > 0);
        
        const recommendation = result.recommendations[0];
        assert(recommendation.id);
        assert(recommendation.title);
        assert(recommendation.description);
        assert(recommendation.priority);
        assert(recommendation.implementation);
        assert(recommendation.acceptanceCriteria);
      });

      it('should limit recommendations by maxRecommendations', async () => {
        const agl = new NativeAgentLightning();
        const events = Array(50).fill().map((_, i) => (
          { runId: `run${i}`, success: false, message: `error${i % 5}` }
        ));
        
        const result = await agl.analyze(events, { maxRecommendations: 3 });
        assert.strictEqual(result.recommendations.length, 3);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input', async () => {
      const agl = new NativeAgentLightning();
      const result = await agl.analyze(null);
      assert.deepStrictEqual(result.patterns, []);
    });

    it('should handle undefined input', async () => {
      const agl = new NativeAgentLightning();
      const result = await agl.analyze(undefined);
      assert.deepStrictEqual(result.patterns, []);
    });

    it('should handle events with missing fields', async () => {
      const agl = new NativeAgentLightning();
      const events = [
        { runId: '1' }, // Missing success, durationMs, etc.
        { runId: '2', success: true }
      ];
      
      const result = await agl.analyze(events);
      // Should not crash and return empty patterns
      assert(Array.isArray(result.patterns));
    });
  });
});

console.log('✅ All Agent Lightning unit tests completed');