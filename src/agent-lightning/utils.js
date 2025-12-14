/**
 * Native Agent Lightning Utilities
 * Utility functions for the native implementation
 */

const { performance } = require('perf_hooks');
const crypto = require('crypto');

/**
 * Calculate statistics from run events
 * @param {Array} events - Array of run events
 * @returns {Object} Statistics object
 */
function calculateStatistics(events) {
  if (!events || events.length === 0) {
    return {
      totalRuns: 0,
      successRate: 0,
      failureRate: 0,
      avgDurationMs: 0,
      maxDurationMs: 0,
      minDurationMs: 0
    };
  }

  const totalRuns = events.length;
  const successfulRuns = events.filter(e => e.success === true).length;
  const failedRuns = events.filter(e => e.success === false).length;
  
  const durations = events
    .filter(e => e.durationMs !== undefined && typeof e.durationMs === 'number')
    .map(e => e.durationMs)
    .sort((a, b) => a - b);
  
  const avgDurationMs = durations.length > 0 
    ? durations.reduce((sum, val) => sum + val, 0) / durations.length
    : 0;
  
  return {
    totalRuns,
    successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
    failureRate: totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0,
    avgDurationMs: Math.round(avgDurationMs),
    maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
    minDurationMs: durations.length > 0 ? Math.min(...durations) : 0
  };
}

/**
 * Calculate provider statistics
 * @param {Array} events - Array of run events
 * @returns {Object} Provider statistics
 */
function calculateProviderStatistics(events) {
  const providers = {};
  
  events.forEach(event => {
    if (event.provider && event.durationMs !== undefined) {
      if (!providers[event.provider]) {
        providers[event.provider] = {
          usageCount: 0,
          successCount: 0,
          totalDurationMs: 0
        };
      }
      
      providers[event.provider].usageCount++;
      if (event.success) {
        providers[event.provider].successCount++;
      }
      providers[event.provider].totalDurationMs += event.durationMs;
    }
  });
  
  // Calculate averages and rates
  Object.keys(providers).forEach(provider => {
    const stats = providers[provider];
    stats.successRate = stats.usageCount > 0 
      ? (stats.successCount / stats.usageCount) * 100
      : 0;
    stats.avgDurationMs = stats.usageCount > 0
      ? Math.round(stats.totalDurationMs / stats.usageCount)
      : 0;
  });
  
  return providers;
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateUniqueId() {
  return `agl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
}

/**
 * Calculate content hash for duplicate detection
 * @param {string} content - Content to hash
 * @returns {string} Hash string
 */
function calculateContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Format duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Validate analysis options
 * @param {Object} options - Analysis options
 * @returns {Object} Validated options with defaults
 */
function validateAnalysisOptions(options = {}) {
  return {
    minSeverity: options.minSeverity || 'low',
    timeWindowDays: options.timeWindowDays || 30,
    maxRecommendations: options.maxRecommendations || 10,
    includeExperimental: options.includeExperimental || false,
    detailedAnalysis: options.detailedAnalysis || true,
    performanceThresholds: {
      highLatencyMs: options.performanceThresholds?.highLatencyMs || 5000,
      highFailureRate: options.performanceThresholds?.highFailureRate || 10,
      highRetryRate: options.performanceThresholds?.highRetryRate || 3
    }
  };
}

/**
 * Filter events by time window
 * @param {Array} events - Array of events
 * @param {number} days - Time window in days
 * @returns {Array} Filtered events
 */
function filterEventsByTimeWindow(events, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return events.filter(event => {
    try {
      const eventDate = new Date(event.timestamp);
      return eventDate >= cutoffDate;
    } catch (error) {
      return false;
    }
  });
}

/**
 * Categorize severity based on metrics
 * @param {Object} metrics - Metrics object
 * @returns {string} Severity level
 */
function categorizeSeverity(metrics) {
  if (metrics.failureRate > 30) return 'high';
  if (metrics.failureRate > 15) return 'medium';
  if (metrics.retryCount > 5) return 'medium';
  if (metrics.durationMs > 10000) return 'medium';
  return 'low';
}

/**
 * Performance timer utility
 * @returns {Object} Timer object with start/end methods
 */
function createPerformanceTimer() {
  const startTime = performance.now();
  let endTime = null;
  
  return {
    start: () => {
      return performance.now();
    },
    end: () => {
      endTime = performance.now();
      return endTime;
    },
    elapsed: () => {
      return endTime ? endTime - startTime : performance.now() - startTime;
    },
    elapsedMs: () => {
      return Math.round(endTime ? endTime - startTime : performance.now() - startTime);
    }
  };
}

module.exports = {
  calculateStatistics,
  calculateProviderStatistics,
  generateUniqueId,
  calculateContentHash,
  formatDuration,
  deepClone,
  validateAnalysisOptions,
  filterEventsByTimeWindow,
  categorizeSeverity,
  createPerformanceTimer
};