/**
 * Agent Lightning Algorithms Tests
 * Comprehensive test suite for native algorithms
 */

const assert = require('assert');
const patternDetection = require('../../src/agent-lightning/algorithms/patternDetection');
const painPointAnalysis = require('../../src/agent-lightning/algorithms/painPointAnalysis');
const recommendationEngine = require('../../src/agent-lightning/algorithms/recommendationEngine');

describe('Agent Lightning Algorithms', () => {
  describe('Pattern Detection', () => {
    it('should detect failure patterns', () => {
      const events = [
        { runId: '1', success: false, message: 'timeout' },
        { runId: '2', success: false, message: 'timeout' },
        { runId: '3', success: true },
        { runId: '4', success: false, message: 'timeout' }
      ];
      
      const patterns = patternDetection.detectPatterns(events, { failureRateThreshold: 10 });
      assert.strictEqual(patterns.length, 1);
      assert.strictEqual(patterns[0].patternType, 'failure');
      assert.strictEqual(patterns[0].severity, 'high');
    });

    it('should detect retry patterns', () => {
      const events = [
        { runId: '1', retryCount: 3 },
        { runId: '2', retryCount: 2 },
        { runId: '3', retryCount: 0 },
        { runId: '4', retryCount: 4 }
      ];
      
      const patterns = patternDetection.detectPatterns(events, { retryRateThreshold: 1 });
      assert.strictEqual(patterns.length, 1);
      assert.strictEqual(patterns[0].patternType, 'retry');
    });

    it('should detect performance patterns', () => {
      const events = [
        { runId: '1', durationMs: 10000 },
        { runId: '2', durationMs: 500 },
        { runId: '3', durationMs: 15000 },
        { runId: '4', durationMs: 8000 }
      ];
      
      const patterns = patternDetection.detectPatterns(events, { latencyThresholdMs: 5000 });
      assert.strictEqual(patterns.length, 1);
      assert.strictEqual(patterns[0].patternType, 'performance');
    });

    it('should detect anomalies', () => {
      const events = [
        { runId: '1', durationMs: 1000 },
        { runId: '2', durationMs: 1100 },
        { runId: '3', durationMs: 1050 },
        { runId: '4', durationMs: 10000 } // More extreme outlier
      ];
      
      const patterns = patternDetection.detectPatterns(events, { 
        anomalyThreshold: 1, // Lower threshold to detect the outlier
        latencyThresholdMs: 20000 // Higher threshold to avoid performance detection
      });
      assert.strictEqual(patterns.length, 1);
      assert.strictEqual(patterns[0].patternType, 'anomaly');
    });

    it('should return empty array for no patterns', () => {
      const events = [
        { runId: '1', success: true, durationMs: 1000 },
        { runId: '2', success: true, durationMs: 1100 }
      ];
      
      const patterns = patternDetection.detectPatterns(events);
      assert.strictEqual(patterns.length, 0);
    });
  });

  describe('Pain Point Analysis', () => {
    it('should identify pain points from patterns', () => {
      const patterns = [
        {
          patternType: 'failure',
          severity: 'high',
          description: 'High failure rate',
          occurrences: 5,
          affectedRuns: ['run1', 'run2'],
          metrics: { frequency: 0.5, avgImpact: 40 },
          details: { firstOccurrence: new Date().toISOString(), lastOccurrence: new Date().toISOString() }
        }
      ];
      
      const painPoints = painPointAnalysis.identifyPainPoints(patterns);
      assert.strictEqual(painPoints.length, 1);
      assert.strictEqual(painPoints[0].type, 'reliability');
      assert.strictEqual(painPoints[0].severity, 'high');
    });

    it('should group similar pain points', () => {
      const patterns = [
        {
          patternType: 'failure',
          severity: 'medium',
          description: 'Timeout errors in API calls',
          occurrences: 3,
          affectedRuns: ['run1'],
          metrics: { frequency: 0.3, avgImpact: 30 },
          details: { firstOccurrence: new Date().toISOString(), lastOccurrence: new Date().toISOString() }
        },
        {
          patternType: 'failure',
          severity: 'medium',
          description: 'Timeout errors in database queries',
          occurrences: 2,
          affectedRuns: ['run2'],
          metrics: { frequency: 0.2, avgImpact: 25 },
          details: { firstOccurrence: new Date().toISOString(), lastOccurrence: new Date().toISOString() }
        }
      ];
      
      const painPoints = painPointAnalysis.identifyPainPoints(patterns, { 
        groupSimilar: true, 
        similarityThreshold: 0.5 
      });
      
      assert.strictEqual(painPoints.length, 1);
      assert(painPoints[0].title.includes('Multiple reliability issues'));
    });

    it('should calculate comprehensive metrics', () => {
      const patterns = [
        {
          patternType: 'performance',
          severity: 'high',
          description: 'Slow API responses',
          occurrences: 10,
          affectedRuns: ['run1', 'run2', 'run3'],
          metrics: { frequency: 0.8, avgImpact: 8000 },
          details: { firstOccurrence: new Date().toISOString(), lastOccurrence: new Date().toISOString() }
        }
      ];
      
      const painPoints = painPointAnalysis.identifyPainPoints(patterns);
      assert(painPoints[0].metrics.businessImpact > 0);
      assert(painPoints[0].metrics.technicalDebt > 0);
      assert(painPoints[0].metrics.priorityScore > 0);
    });
  });

  describe('Recommendation Engine', () => {
    it('should generate recommendations from pain points', () => {
      const painPoints = [
        {
          id: 'pp1',
          type: 'reliability',
          severity: 'high',
          title: 'Critical reliability issue',
          description: 'Frequent timeouts in production',
          impact: 'major',
          metrics: { businessImpact: 85, technicalDebt: 75, occurrenceRate: 0.5, affectedComponents: 10 }
        }
      ];
      
      const recommendations = recommendationEngine.generateRecommendations(painPoints);
      assert.strictEqual(recommendations.length, 1);
      assert(recommendations[0].title.includes('Urgent'));
      assert(recommendations[0].priority === 'high');
    });

    it('should deduplicate similar recommendations', () => {
      const painPoints = [
        {
          id: 'pp1',
          type: 'performance',
          severity: 'medium',
          description: 'Slow API responses',
          metrics: { businessImpact: 60, occurrenceRate: 0.4, affectedComponents: 5 }
        },
        {
          id: 'pp1', // Same ID to force deduplication
          type: 'performance',
          severity: 'medium',
          description: 'Slow API responses', // Same as pp1
          metrics: { businessImpact: 60, occurrenceRate: 0.4, affectedComponents: 5 } // Same metrics
        }
      ];
      
      const recommendations = recommendationEngine.generateRecommendations(painPoints);
      assert.strictEqual(recommendations.length, 1);
    });

    it('should sort recommendations by priority', () => {
      const painPoints = [
        { id: 'pp1', severity: 'low', type: 'reliability', metrics: { priorityScore: 30, businessImpact: 30, technicalDebt: 20, occurrenceRate: 0.1, affectedComponents: 2 } },
        { id: 'pp2', severity: 'high', type: 'performance', metrics: { priorityScore: 90, businessImpact: 90, technicalDebt: 80, occurrenceRate: 0.8, affectedComponents: 15 } },
        { id: 'pp3', severity: 'medium', type: 'usability', metrics: { priorityScore: 60, businessImpact: 60, technicalDebt: 50, occurrenceRate: 0.4, affectedComponents: 8 } }
      ];
      
      const recommendations = recommendationEngine.generateRecommendations(painPoints);
      assert.strictEqual(recommendations[0].priority, 'high');
      assert.strictEqual(recommendations[1].priority, 'medium');
      assert.strictEqual(recommendations[2].priority, 'low');
    });

    it('should generate prioritized report', () => {
      const painPoints = [
        { id: 'pp1', severity: 'high', type: 'reliability', metrics: { businessImpact: 80, technicalDebt: 70, occurrenceRate: 0.6, affectedComponents: 12 } },
        { id: 'pp2', severity: 'medium', type: 'performance', metrics: { businessImpact: 60, technicalDebt: 50, occurrenceRate: 0.4, affectedComponents: 8 } }
      ];
      
      const report = recommendationEngine.generatePrioritizedRecommendationReport(painPoints);
      assert.strictEqual(report.recommendations.length, 2);
      assert(report.summary.totalRecommendations === 2);
      assert(report.summary.highPriority === 1);
    });
  });

  describe('Integration Tests', () => {
    it('should process complete workflow: patterns -> pain points -> recommendations', () => {
      // 1. Generate test data
      const events = [
        { runId: '1', success: false, durationMs: 10000, retryCount: 2 },
        { runId: '2', success: false, durationMs: 12000, retryCount: 3 },
        { runId: '3', success: true, durationMs: 2000 },
        { runId: '4', success: false, durationMs: 15000, retryCount: 1 }
      ];

      // 2. Detect patterns
      const patterns = patternDetection.detectPatterns(events);
      assert(patterns.length > 0);

      // 3. Identify pain points
      const painPoints = painPointAnalysis.identifyPainPoints(patterns);
      assert(painPoints.length > 0);

      // 4. Generate recommendations
      const recommendations = recommendationEngine.generateRecommendations(painPoints);
      assert(recommendations.length > 0);

      // 5. Verify recommendation quality
      const recommendation = recommendations[0];
      assert(recommendation.title);
      assert(recommendation.description);
      assert(recommendation.implementation);
      assert(recommendation.acceptanceCriteria);
      assert(recommendation.constraints);
    });

    it('should handle edge cases gracefully', () => {
      // Empty input
      assert.deepStrictEqual(patternDetection.detectPatterns([]), []);
      assert.deepStrictEqual(painPointAnalysis.identifyPainPoints([]), []);
      assert.deepStrictEqual(recommendationEngine.generateRecommendations([]), []);

      // Null input
      assert.deepStrictEqual(patternDetection.detectPatterns(null), []);
      assert.deepStrictEqual(painPointAnalysis.identifyPainPoints(null), []);
      assert.deepStrictEqual(recommendationEngine.generateRecommendations(null), []);
    });
  });
});

console.log('✅ All Agent Lightning algorithm tests completed');