/**
 * Pattern Detection Algorithms
 * Advanced pattern detection for telemetry analysis
 */

const utils = require('../utils');

/**
 * Detect patterns in telemetry data using multiple algorithms
 * @param {Array} events - Array of run events
 * @param {Object} options - Detection options
 * @returns {Array} Detected patterns
 */
function detectPatterns(events, options = {}) {
  if (!events || events.length === 0) {
    return [];
  }

  // Validate and merge options
  const detectionOptions = {
    failureRateThreshold: 10,
    retryRateThreshold: 2,
    latencyThresholdMs: 5000,
    anomalyThreshold: 3,
    timeWindowDays: 30,
    ...options
  };

  const patterns = [];

  // 1. Failure Rate Detection
  const failurePatterns = detectFailurePatterns(events, detectionOptions);
  patterns.push(...failurePatterns);

  // 2. Retry Pattern Detection
  const retryPatterns = detectRetryPatterns(events, detectionOptions);
  patterns.push(...retryPatterns);

  // 3. Performance Bottleneck Detection
  const performancePatterns = detectPerformancePatterns(events, detectionOptions);
  patterns.push(...performancePatterns);

  // 4. Anomaly Detection
  const anomalyPatterns = detectAnomalies(events, detectionOptions);
  patterns.push(...anomalyPatterns);

  // 5. Temporal Pattern Detection
  const temporalPatterns = detectTemporalPatterns(events, detectionOptions);
  patterns.push(...temporalPatterns);

  // Filter by minimum severity if specified
  if (options.minSeverity) {
    return patterns.filter(p => p.severity >= options.minSeverity);
  }

  return patterns;
}

/**
 * Detect failure patterns using statistical analysis
 * @param {Array} events - Array of run events
 * @param {Object} options - Detection options
 * @returns {Array} Failure patterns
 */
function detectFailurePatterns(events, options) {
  const patterns = [];
  
  // Calculate overall failure rate
  const stats = utils.calculateStatistics(events);
  
  if (stats.failureRate > options.failureRateThreshold) {
    const failedEvents = events.filter(e => !e.success);
    
    // Group by error type/message
    const errorGroups = {};
    failedEvents.forEach(event => {
      const errorKey = event.message || 'unknown';
      if (!errorGroups[errorKey]) {
        errorGroups[errorKey] = {
          count: 0,
          events: []
        };
      }
      errorGroups[errorKey].count++;
      errorGroups[errorKey].events.push(event);
    });
    
    // Create pattern for each significant error group
    Object.keys(errorGroups).forEach(errorKey => {
      const group = errorGroups[errorKey];
      if (group.count >= 2) { // At least 2 occurrences
        patterns.push({
          patternType: 'failure',
          severity: calculateFailureSeverity(stats.failureRate, group.count, events.length),
          description: `Repeated failures: ${errorKey} (${group.count} occurrences, ${((group.count / events.length) * 100).toFixed(1)}%)`,
          occurrences: group.count,
          affectedRuns: [...new Set(group.events.map(e => e.runId))],
          metrics: {
            avgImpact: stats.failureRate,
            frequency: group.count / events.length,
            errorRate: (group.count / events.length) * 100
          },
          evidence: group.events,
          details: {
            errorType: errorKey,
            firstOccurrence: group.events[0].timestamp,
            lastOccurrence: group.events[group.events.length - 1].timestamp
          }
        });
      }
    });
    
    // Overall failure pattern if no specific error groups
    if (patterns.length === 0 && stats.failureRate > options.failureRateThreshold) {
      patterns.push({
        patternType: 'failure',
        severity: calculateFailureSeverity(stats.failureRate, failedEvents.length, events.length),
        description: `High failure rate detected (${stats.failureRate.toFixed(1)}%)`,
        occurrences: failedEvents.length,
        affectedRuns: [...new Set(failedEvents.map(e => e.runId))],
        metrics: {
          avgImpact: stats.failureRate,
          frequency: failedEvents.length / events.length
        },
        evidence: failedEvents
      });
    }
  }
  
  return patterns;
}

/**
 * Detect retry patterns
 * @param {Array} events - Array of run events
 * @param {Object} options - Detection options
 * @returns {Array} Retry patterns
 */
function detectRetryPatterns(events, options) {
  const patterns = [];
  const eventsWithRetries = events.filter(e => e.retryCount > 0);
  
  if (eventsWithRetries.length > 0) {
    const totalRetries = eventsWithRetries.reduce((sum, e) => sum + e.retryCount, 0);
    const avgRetries = totalRetries / eventsWithRetries.length;
    
    if (avgRetries > options.retryRateThreshold) {
      patterns.push({
        patternType: 'retry',
        severity: avgRetries > 5 ? 'high' : 'medium',
        description: `Excessive retry pattern detected (avg ${avgRetries.toFixed(1)} retries, ${eventsWithRetries.length} operations)`,
        occurrences: eventsWithRetries.length,
        affectedRuns: [...new Set(eventsWithRetries.map(e => e.runId))],
        metrics: {
          avgImpact: avgRetries,
          frequency: eventsWithRetries.length / events.length,
          totalRetries
        },
        evidence: eventsWithRetries,
        details: {
          maxRetries: Math.max(...eventsWithRetries.map(e => e.retryCount)),
          retryDistribution: calculateRetryDistribution(eventsWithRetries)
        }
      });
    }
  }
  
  return patterns;
}

/**
 * Detect performance bottlenecks
 * @param {Array} events - Array of run events
 * @param {Object} options - Detection options
 * @returns {Array} Performance patterns
 */
function detectPerformancePatterns(events, options) {
  const patterns = [];
  const slowEvents = events.filter(e => 
    e.durationMs > options.latencyThresholdMs
  );
  
  if (slowEvents.length > 0) {
    const avgSlowDuration = slowEvents.reduce((sum, e) => sum + e.durationMs, 0) / slowEvents.length;
    
    // Group by provider
    const providerGroups = {};
    slowEvents.forEach(event => {
      const provider = event.provider || 'unknown';
      if (!providerGroups[provider]) {
        providerGroups[provider] = {
          count: 0,
          totalDuration: 0
        };
      }
      providerGroups[provider].count++;
      providerGroups[provider].totalDuration += event.durationMs;
    });
    
    // Create pattern for each provider group
    Object.keys(providerGroups).forEach(provider => {
      const group = providerGroups[provider];
      const avgDuration = group.totalDuration / group.count;
      
      patterns.push({
        patternType: 'performance',
        severity: avgDuration > 15000 ? 'high' : 'medium',
        description: `Performance bottleneck in ${provider}: avg ${(avgDuration / 1000).toFixed(1)}s (${group.count} occurrences)`,
        occurrences: group.count,
        affectedRuns: [...new Set(slowEvents.filter(e => e.provider === provider).map(e => e.runId))],
        metrics: {
          avgImpact: avgDuration,
          frequency: group.count / events.length,
          throughputImpact: (group.count / events.length) * 100
        },
        evidence: slowEvents.filter(e => e.provider === provider),
        details: {
          provider,
          maxDuration: Math.max(...slowEvents.filter(e => e.provider === provider).map(e => e.durationMs)),
          durationDistribution: calculateDurationDistribution(slowEvents.filter(e => e.provider === provider))
        }
      });
    });
  }
  
  return patterns;
}

/**
 * Detect anomalies using statistical methods
 * @param {Array} events - Array of run events
 * @param {Object} options - Detection options
 * @returns {Array} Anomaly patterns
 */
function detectAnomalies(events, options) {
  const patterns = [];
  
  // Calculate basic statistics for duration
  const durations = events
    .filter(e => e.durationMs !== undefined)
    .map(e => e.durationMs);
  
  if (durations.length < 3) {
    return patterns;
  }
  
  // Calculate mean and standard deviation
  const mean = durations.reduce((sum, val) => sum + val, 0) / durations.length;
  const stdDev = Math.sqrt(durations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / durations.length);
  
  // Detect outliers (3 standard deviations from mean)
  const outliers = events.filter(e => {
    if (e.durationMs === undefined) return false;
    return Math.abs(e.durationMs - mean) > options.anomalyThreshold * stdDev;
  });
  
  if (outliers.length > 0) {
    patterns.push({
      patternType: 'anomaly',
      severity: outliers.length > 5 ? 'high' : 'medium',
      description: `Statistical anomalies detected (${outliers.length} outliers, >${options.anomalyThreshold}σ from mean)`,
      occurrences: outliers.length,
      affectedRuns: [...new Set(outliers.map(e => e.runId))],
      metrics: {
        avgImpact: mean + options.anomalyThreshold * stdDev,
        frequency: outliers.length / events.length,
        zScoreThreshold: options.anomalyThreshold
      },
      evidence: outliers,
      details: {
        meanDurationMs: mean,
        stdDevDurationMs: stdDev,
        anomalyThresholdMs: mean + options.anomalyThreshold * stdDev
      }
    });
  }
  
  return patterns;
}

/**
 * Detect temporal patterns (time-based anomalies)
 * @param {Array} events - Array of run events
 * @param {Object} options - Detection options
 * @returns {Array} Temporal patterns
 */
function detectTemporalPatterns(events, options) {
  const patterns = [];
  
  // Filter events within time window
  const filteredEvents = utils.filterEventsByTimeWindow(events, options.timeWindowDays);
  
  if (filteredEvents.length < events.length) {
    // Significant number of events outside time window
    const oldEvents = events.length - filteredEvents.length;
    if (oldEvents > 5) {
      patterns.push({
        patternType: 'temporal',
        severity: 'low',
        description: `Historical data outside analysis window (${oldEvents} events >${options.timeWindowDays} days old)`,
        occurrences: oldEvents,
        affectedRuns: [...new Set(events.slice(0, oldEvents).map(e => e.runId))],
        metrics: {
          avgImpact: oldEvents,
          frequency: oldEvents / events.length
        },
        evidence: events.slice(0, oldEvents),
        details: {
          timeWindowDays: options.timeWindowDays,
          oldestEvent: events[0].timestamp,
          newestOldEvent: events[oldEvents - 1].timestamp
        }
      });
    }
  }
  
  return patterns;
}

/**
 * Calculate failure severity based on metrics
 * @param {number} failureRate - Failure rate percentage
 * @param {number} failureCount - Number of failures
 * @param {number} totalCount - Total number of events
 * @returns {string} Severity level
 */
function calculateFailureSeverity(failureRate, failureCount, totalCount) {
  if (failureRate > 30 || failureCount > totalCount * 0.3) {
    return 'high';
  }
  if (failureRate > 15 || failureCount > totalCount * 0.15) {
    return 'medium';
  }
  return 'low';
}

/**
 * Calculate retry distribution
 * @param {Array} events - Events with retries
 * @returns {Object} Retry distribution
 */
function calculateRetryDistribution(events) {
  const distribution = {};
  events.forEach(event => {
    const retries = event.retryCount;
    distribution[retries] = (distribution[retries] || 0) + 1;
  });
  return distribution;
}

/**
 * Calculate duration distribution
 * @param {Array} events - Slow events
 * @returns {Object} Duration distribution
 */
function calculateDurationDistribution(events) {
  const buckets = {
    '5-10s': 0,
    '10-30s': 0,
    '30-60s': 0,
    '60s+': 0
  };
  
  events.forEach(event => {
    const durationSec = event.durationMs / 1000;
    if (durationSec < 10) buckets['5-10s']++;
    else if (durationSec < 30) buckets['10-30s']++;
    else if (durationSec < 60) buckets['30-60s']++;
    else buckets['60s+']++;
  });
  
  return buckets;
}

module.exports = {
  detectPatterns,
  detectFailurePatterns,
  detectRetryPatterns,
  detectPerformancePatterns,
  detectAnomalies,
  detectTemporalPatterns,
  calculateFailureSeverity,
  calculateRetryDistribution,
  calculateDurationDistribution
};