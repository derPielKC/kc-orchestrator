const fs = require('fs');
const path = require('path');

/**
 * Run Summarizer - Aggregates and analyzes telemetry data from multiple runs
 *
 * This class provides functionality to summarize recent runs, identify pain points,
 * and generate markdown reports for Agent Lightning analysis.
 */
class RunSummarizer {
  /**
   * Constructor for RunSummarizer
   *
   * @param {object} options - Configuration options
   * @param {string} options.baseDir - Base directory for telemetry storage
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), '.kc-orchestrator', 'runs');
    this.verbose = options.verbose || false;
  }
  
  /**
   * Generate a summary report from recent runs
   *
   * @param {number} limit - Number of recent runs to analyze
   * @param {string} projectFilter - Optional project filter
   * @returns {object} Summary report object
   */
  generateSummaryReport(limit = 5, projectFilter = null) {
    const runs = this._getRecentRunsWithEvents(limit, projectFilter);
    
    if (runs.length === 0) {
      return {
        runsAnalyzed: 0,
        summary: 'No runs found to analyze',
        painPoints: []
      };
    }
    
    const summary = this._analyzeRuns(runs);
    const markdownReport = this._generateMarkdownReport(summary, runs);
    
    return {
      runsAnalyzed: runs.length,
      summary: summary,
      markdownReport: markdownReport,
      painPoints: summary.painPoints
    };
  }
  
  /**
   * Get recent runs with their events
   *
   * @param {number} limit - Maximum number of runs
   * @param {string} projectFilter - Optional project filter
   * @returns {Array} Array of run objects with events
   */
  _getRecentRunsWithEvents(limit, projectFilter) {
    try {
      const runDirs = fs.readdirSync(this.baseDir)
        .filter(dir => fs.statSync(path.join(this.baseDir, dir)).isDirectory())
        .sort((a, b) => {
          const aTime = fs.statSync(path.join(this.baseDir, a)).mtime.getTime();
          const bTime = fs.statSync(path.join(this.baseDir, b)).mtime.getTime();
          return bTime - aTime; // Newest first
        })
        .slice(0, limit);
      
      const runs = [];
      
      for (const runId of runDirs) {
        try {
          const summaryPath = path.join(this.baseDir, runId, 'summary.json');
          const eventsPath = path.join(this.baseDir, runId, 'events.jsonl');
          
          if (!fs.existsSync(summaryPath) || !fs.existsSync(eventsPath)) {
            continue;
          }
          
          const summaryContent = fs.readFileSync(summaryPath, 'utf8');
          const summary = JSON.parse(summaryContent);
          
          const eventsContent = fs.readFileSync(eventsPath, 'utf8');
          const events = eventsContent.trim().split('\n').map(line => JSON.parse(line));
          
          // Filter by project if specified
          if (projectFilter) {
            const runStartEvent = events.find(e => e.eventType === 'run_start');
            if (runStartEvent && runStartEvent.project !== projectFilter) {
              continue;
            }
          }
          
          runs.push({
            runId: runId,
            summary: summary,
            events: events
          });
          
        } catch (error) {
          console.warn(`⚠️  Failed to process run ${runId}: ${error.message}`);
        }
      }
      
      return runs;
      
    } catch (error) {
      console.error(`❌ Failed to get runs with events: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Analyze runs to identify patterns and pain points
   *
   * @param {Array} runs - Array of run objects
   * @returns {object} Analysis summary
   */
  _analyzeRuns(runs) {
    const summary = {
      totalRuns: runs.length,
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalExecutionTime: 0,
      totalRetries: 0,
      totalFallbacks: 0,
      providersUsed: new Set(),
      providerStats: {},
      failureReasons: {},
      highRetryTasks: [],
      longRunningTasks: [],
      frequentFallbacks: [],
      painPoints: []
    };
    
    // Initialize provider stats
    runs.forEach(run => {
      run.events.forEach(event => {
        if (event.eventType === 'task_execution' && event.provider) {
          summary.providersUsed.add(event.provider);
        }
      });
    });
    
    summary.providersUsed.forEach(provider => {
      summary.providerStats[provider] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalExecutionTime: 0,
        avgExecutionTime: 0
      };
    });
    
    // Process all events
    runs.forEach(run => {
      run.events.forEach(event => {
        switch (event.eventType) {
          case 'task_execution':
            summary.totalTasks++;
            if (event.success) {
              summary.successfulTasks++;
              summary.providerStats[event.provider].successes++;
            } else {
              summary.failedTasks++;
              summary.providerStats[event.provider].failures++;
              
              // Track failure reasons
              if (event.error) {
                const errorMsg = typeof event.error === 'string' ? event.error : event.error.message;
                const reason = this._extractFailureReason(errorMsg);
                summary.failureReasons[reason] = (summary.failureReasons[reason] || 0) + 1;
              }
            }
            
            summary.providerStats[event.provider].attempts++;
            summary.providerStats[event.provider].totalExecutionTime += event.executionTime || 0;
            summary.totalExecutionTime += event.executionTime || 0;
            summary.totalRetries += event.retryCount || 0;
            summary.totalFallbacks += event.fallbackCount || 0;
            
            // Track high retry tasks
            if ((event.retryCount || 0) > 2) {
              summary.highRetryTasks.push({
                taskId: event.taskId,
                taskTitle: event.taskTitle,
                retries: event.retryCount,
                runId: run.runId
              });
            }
            
            // Track long running tasks
            if ((event.executionTime || 0) > 30000) { // > 30 seconds
              summary.longRunningTasks.push({
                taskId: event.taskId,
                taskTitle: event.taskTitle,
                executionTime: event.executionTime,
                provider: event.provider,
                runId: run.runId
              });
            }
            break;
          
          case 'provider_fallback':
            summary.frequentFallbacks.push({
              fromProvider: event.fromProvider,
              toProvider: event.toProvider,
              reason: event.reason,
              runId: run.runId
            });
            break;
        }
      });
    });
    
    // Calculate averages
    summary.providersUsed.forEach(provider => {
      const stats = summary.providerStats[provider];
      if (stats.attempts > 0) {
        stats.avgExecutionTime = stats.totalExecutionTime / stats.attempts;
      }
    });
    
    // Identify pain points
    this._identifyPainPoints(summary);
    
    return summary;
  }
  
  /**
   * Extract failure reason from error message
   *
   * @param {string} errorMsg - Error message
   * @returns {string} Normalized failure reason
   */
  _extractFailureReason(errorMsg) {
    if (!errorMsg) return 'unknown';
    
    const lowerMsg = errorMsg.toLowerCase();
    
    if (lowerMsg.includes('timeout')) return 'timeout';
    if (lowerMsg.includes('network')) return 'network_error';
    if (lowerMsg.includes('auth')) return 'authentication_error';
    if (lowerMsg.includes('rate limit')) return 'rate_limit';
    if (lowerMsg.includes('quota')) return 'quota_exceeded';
    if (lowerMsg.includes('invalid')) return 'invalid_request';
    if (lowerMsg.includes('not found')) return 'resource_not_found';
    
    return 'other_error';
  }
  
  /**
   * Identify pain points from analysis
   *
   * @param {object} summary - Analysis summary
   */
  _identifyPainPoints(summary) {
    const painPoints = [];
    
    // High failure rate
    if (summary.totalTasks > 0) {
      const failureRate = summary.failedTasks / summary.totalTasks;
      if (failureRate > 0.2) { // > 20% failure rate
        painPoints.push({
          type: 'high_failure_rate',
          severity: 'high',
          description: `High task failure rate (${(failureRate * 100).toFixed(1)}%)`,
          details: {
            failedTasks: summary.failedTasks,
            totalTasks: summary.totalTasks,
            failureRate: failureRate
          }
        });
      }
    }
    
    // High retry count
    if (summary.totalRetries / Math.max(summary.totalTasks, 1) > 1.5) {
      painPoints.push({
        type: 'high_retry_count',
        severity: 'medium',
        description: 'High average retry count per task',
        details: {
          totalRetries: summary.totalRetries,
          avgRetries: (summary.totalRetries / Math.max(summary.totalTasks, 1)).toFixed(2)
        }
      });
    }
    
    // Frequent fallbacks
    if (summary.totalFallbacks / Math.max(summary.totalTasks, 1) > 0.5) {
      painPoints.push({
        type: 'frequent_fallbacks',
        severity: 'medium',
        description: 'Frequent provider fallbacks',
        details: {
          totalFallbacks: summary.totalFallbacks,
          avgFallbacks: (summary.totalFallbacks / Math.max(summary.totalTasks, 1)).toFixed(2)
        }
      });
    }
    
    // Long running tasks
    if (summary.longRunningTasks.length > 0) {
      painPoints.push({
        type: 'long_running_tasks',
        severity: 'medium',
        description: `${summary.longRunningTasks.length} tasks took longer than 30 seconds`,
        details: {
          count: summary.longRunningTasks.length,
          examples: summary.longRunningTasks.slice(0, 3).map(t => t.taskTitle)
        }
      });
    }
    
    // High retry tasks
    if (summary.highRetryTasks.length > 0) {
      painPoints.push({
        type: 'high_retry_tasks',
        severity: 'high',
        description: `${summary.highRetryTasks.length} tasks required multiple retries`,
        details: {
          count: summary.highRetryTasks.length,
          examples: summary.highRetryTasks.slice(0, 3).map(t => t.taskTitle)
        }
      });
    }
    
    // Common failure reasons
    const commonFailures = Object.entries(summary.failureReasons)
      .sort((a, b) => b[1] - a[1])
      .filter(([reason, count]) => count > 1);
    
    if (commonFailures.length > 0) {
      painPoints.push({
        type: 'common_failures',
        severity: 'high',
        description: 'Common failure patterns detected',
        details: {
          failures: commonFailures.slice(0, 3).map(([reason, count]) => ({ reason, count }))
        }
      });
    }
    
    // Provider performance issues
    Object.entries(summary.providerStats).forEach(([provider, stats]) => {
      if (stats.attempts > 0) {
        const failureRate = stats.failures / stats.attempts;
        if (failureRate > 0.3) { // > 30% failure rate for provider
          painPoints.push({
            type: 'provider_performance',
            severity: 'high',
            description: `Provider ${provider} has high failure rate (${(failureRate * 100).toFixed(1)}%)`,
            details: {
              provider: provider,
              failureRate: failureRate,
              attempts: stats.attempts,
              failures: stats.failures
            }
          });
        }
      }
    });
    
    // Sort pain points by severity
    const severityOrder = { high: 1, medium: 2, low: 3 };
    summary.painPoints = painPoints.sort((a, b) => 
      severityOrder[a.severity] - severityOrder[b.severity]
    );
  }
  
  /**
   * Generate markdown report from analysis
   *
   * @param {object} summary - Analysis summary
   * @param {Array} runs - Array of run objects
   * @returns {string} Markdown report
   */
  _generateMarkdownReport(summary, runs) {
    let report = `# Orchestrator Run Analysis Report\n\n`;
    
    report += `## Summary\n\n`;
    report += `- **Runs Analyzed**: ${summary.totalRuns}\n`;
    report += `- **Total Tasks**: ${summary.totalTasks}\n`;
    report += `- **Successful Tasks**: ${summary.successfulTasks} (${summary.totalTasks > 0 ? ((summary.successfulTasks / summary.totalTasks * 100).toFixed(1)) : '0'}%)\n`;
    report += `- **Failed Tasks**: ${summary.failedTasks} (${summary.totalTasks > 0 ? ((summary.failedTasks / summary.totalTasks * 100).toFixed(1)) : '0'}%)\n`;
    report += `- **Total Execution Time**: ${(summary.totalExecutionTime / 1000).toFixed(1)} seconds\n`;
    report += `- **Average Execution Time**: ${summary.totalTasks > 0 ? (summary.totalExecutionTime / summary.totalTasks / 1000).toFixed(1) : '0'} seconds\n`;
    report += `- **Total Retries**: ${summary.totalRetries}\n`;
    report += `- **Total Fallbacks**: ${summary.totalFallbacks}\n`;
    report += `- **Providers Used**: ${Array.from(summary.providersUsed).join(', ')}\n\n`;
    
    // Provider Statistics
    if (summary.providersUsed.size > 0) {
      report += `## Provider Performance\n\n`;
      report += `| Provider | Attempts | Successes | Failures | Success Rate | Avg Time (s) |\n`;
      report += `|----------|-----------|------------|----------|--------------|--------------|\n`;
      
      Object.entries(summary.providerStats).forEach(([provider, stats]) => {
        const successRate = stats.attempts > 0 ? (stats.successes / stats.attempts * 100).toFixed(1) : '0';
        const avgTime = stats.attempts > 0 ? (stats.totalExecutionTime / stats.attempts / 1000).toFixed(1) : '0';
        
        report += `| ${provider} | ${stats.attempts} | ${stats.successes} | ${stats.failures} | ${successRate}% | ${avgTime} |\n`;
      });
      
      report += `\n`;
    }
    
    // Failure Reasons
    if (Object.keys(summary.failureReasons).length > 0) {
      report += `## Failure Analysis\n\n`;
      report += `- **Total Failures**: ${summary.failedTasks}\n`;
      report += `- **Unique Failure Types**: ${Object.keys(summary.failureReasons).length}\n\n`;
      
      const sortedFailures = Object.entries(summary.failureReasons)
        .sort((a, b) => b[1] - a[1]);
      
      report += `| Reason | Count | Percentage |\n`;
      report += `|--------|-------|------------|\n`;
      
      sortedFailures.forEach(([reason, count]) => {
        const percentage = (count / summary.failedTasks * 100).toFixed(1);
        report += `| ${this._formatFailureReason(reason)} | ${count} | ${percentage}% |\n`;
      });
      
      report += `\n`;
    }
    
    // Pain Points
    if (summary.painPoints.length > 0) {
      report += `## 🔴 Pain Points Identified\n\n`;
      
      summary.painPoints.forEach((painPoint, index) => {
        report += `${index + 1}. **${painPoint.description}** (Severity: ${painPoint.severity.toUpperCase()})\n`;
        
        if (painPoint.details) {
          if (painPoint.details.failureRate) {
            report += `   - Failure Rate: ${(painPoint.details.failureRate * 100).toFixed(1)}%\n`;
          }
          if (painPoint.details.avgRetries) {
            report += `   - Average Retries: ${painPoint.details.avgRetries}\n`;
          }
          if (painPoint.details.avgFallbacks) {
            report += `   - Average Fallbacks: ${painPoint.details.avgFallbacks}\n`;
          }
          if (painPoint.details.count) {
            report += `   - Count: ${painPoint.details.count}\n`;
          }
          if (painPoint.details.examples && painPoint.details.examples.length > 0) {
            report += `   - Examples: ${painPoint.details.examples.join(', ')}\n`;
          }
          if (painPoint.details.failures) {
            report += `   - Common Failures:\n`;
            painPoint.details.failures.forEach(failure => {
              report += `     - ${this._formatFailureReason(failure.reason)}: ${failure.count} occurrences\n`;
            });
          }
        }
        
        report += `\n`;
      });
    } else {
      report += `## ✅ No Significant Pain Points\n\n`;
      report += `The orchestrator appears to be running smoothly based on the analyzed runs.\n\n`;
    }
    
    // High Retry Tasks
    if (summary.highRetryTasks.length > 0) {
      report += `## High Retry Tasks\n\n`;
      report += `Tasks that required multiple retries:\n\n`;
      report += `| Task ID | Task Title | Retries | Run ID |\n`;
      report += `|---------|------------|---------|--------|\n`;
      
      summary.highRetryTasks.slice(0, 10).forEach(task => {
        report += `| ${task.taskId} | ${task.taskTitle} | ${task.retries} | ${task.runId} |\n`;
      });
      
      report += `\n`;
    }
    
    // Long Running Tasks
    if (summary.longRunningTasks.length > 0) {
      report += `## Long Running Tasks\n\n`;
      report += `Tasks that took longer than 30 seconds:\n\n`;
      report += `| Task ID | Task Title | Duration (s) | Provider | Run ID |\n`;
      report += `|---------|------------|---------------|----------|--------|\n`;
      
      summary.longRunningTasks.slice(0, 10).forEach(task => {
        report += `| ${task.taskId} | ${task.taskTitle} | ${(task.executionTime / 1000).toFixed(1)} | ${task.provider} | ${task.runId} |\n`;
      });
      
      report += `\n`;
    }
    
    // Frequent Fallbacks
    if (summary.frequentFallbacks.length > 0) {
      report += `## Frequent Provider Fallbacks\n\n`;
      report += `Provider fallback patterns:\n\n`;
      report += `| From | To | Reason | Count |\n`;
      report += `|------|----|--------|-------|\n`;
      
      // Group fallbacks by pattern
      const fallbackPatterns = {};
      summary.frequentFallbacks.forEach(fallback => {
        const key = `${fallback.fromProvider}->${fallback.toProvider}`;
        fallbackPatterns[key] = fallbackPatterns[key] || { ...fallback, count: 0 };
        fallbackPatterns[key].count++;
      });
      
      Object.values(fallbackPatterns).slice(0, 10).forEach(fallback => {
        report += `| ${fallback.fromProvider} | ${fallback.toProvider} | ${typeof fallback.reason === 'string' ? fallback.reason : fallback.reason.message} | ${fallback.count} |\n`;
      });
      
      report += `\n`;
    }
    
    // Recent Runs
    report += `## Recent Runs Analyzed\n\n`;
    runs.slice(0, 5).forEach(run => {
      report += `- **Run ${run.runId}**: ${run.summary.eventCount} events, ${run.summary.eventTypes.length} event types\n`;
    });
    
    report += `\n---\n\n`;
    report += `*Report generated by kc-orchestrator RunSummarizer*\n`;
    
    return report;
  }
  
  /**
   * Format failure reason for display
   *
   * @param {string} reason - Failure reason
   * @returns {string} Formatted reason
   */
  _formatFailureReason(reason) {
    const reasonMap = {
      'timeout': 'Timeout',
      'network_error': 'Network Error',
      'authentication_error': 'Authentication Error',
      'rate_limit': 'Rate Limit Exceeded',
      'quota_exceeded': 'Quota Exceeded',
      'invalid_request': 'Invalid Request',
      'resource_not_found': 'Resource Not Found',
      'other_error': 'Other Error'
    };
    
    return reasonMap[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  /**
   * Write summary report to file
   *
   * @param {string} report - Markdown report
   * @param {string} outputPath - Output file path
   * @returns {boolean} True if successful
   */
  writeSummaryReport(report, outputPath) {
    try {
      fs.writeFileSync(outputPath, report, 'utf8');
      if (this.verbose) {
        console.log(`📄 Written summary report to ${outputPath}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ Failed to write summary report: ${error.message}`);
      return false;
    }
  }
}

module.exports = { RunSummarizer };