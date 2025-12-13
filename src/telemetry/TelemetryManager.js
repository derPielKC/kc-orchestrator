const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Telemetry Manager - Handles capture, storage, and analysis of orchestrator telemetry
 *
 * This class implements structured telemetry logging for orchestrator runs,
 * with redaction of sensitive information and organized storage.
 */
class TelemetryManager {
  /**
   * Constructor for TelemetryManager
   *
   * @param {object} options - Configuration options
   * @param {string} options.baseDir - Base directory for telemetry storage
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), '.kc-orchestrator', 'runs');
    this.verbose = options.verbose || false;
    this.runId = null;
    this.runStartTime = null;
    this.events = [];
    
    // Ensure base directory exists
    this._ensureBaseDirectory();
  }
  
  /**
   * Ensure base directory exists
   */
  _ensureBaseDirectory() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
        if (this.verbose) {
          console.log(`📁 Created telemetry directory: ${this.baseDir}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to create telemetry directory: ${error.message}`);
    }
  }
  
  /**
   * Start a new telemetry run
   *
   * @param {object} runInfo - Information about the run
   * @param {string} runInfo.project - Project name
   * @param {string} runInfo.command - Command being executed
   * @param {object} runInfo.options - CLI options
   * @returns {string} Run ID
   */
  startRun(runInfo) {
    this.runId = this._generateRunId();
    this.runStartTime = new Date();
    this.events = [];
    
    // Create run directory
    const runDir = path.join(this.baseDir, this.runId);
    fs.mkdirSync(runDir, { recursive: true });
    
    // Log run start event
    this.logEvent('run_start', {
      timestamp: this.runStartTime.toISOString(),
      runId: this.runId,
      project: this._redactSensitiveInfo(runInfo.project),
      command: runInfo.command,
      options: this._redactOptions(runInfo.options),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    });
    
    if (this.verbose) {
      console.log(`🚀 Started telemetry run: ${this.runId}`);
      console.log(`📁 Run directory: ${runDir}`);
    }
    
    return this.runId;
  }
  
  /**
   * Generate a unique run ID
   *
   * @returns {string} Unique run ID
   */
  _generateRunId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }
  
  /**
   * Log a telemetry event
   *
   * @param {string} eventType - Type of event
   * @param {object} eventData - Event data
   */
  logEvent(eventType, eventData) {
    if (!this.runId) {
      console.warn('⚠️  Cannot log event - no active run');
      return;
    }
    
    const event = {
      eventType,
      timestamp: new Date().toISOString(),
      runId: this.runId,
      ...this._redactEventData(eventType, eventData)
    };
    
    this.events.push(event);
    
    if (this.verbose) {
      console.log(`📊 Logged event: ${eventType}`);
    }
  }
  
  /**
   * Log task selection event
   *
   * @param {object} task - Task being executed
   * @param {string} provider - Selected provider
   */
  logTaskSelection(task, provider) {
    this.logEvent('task_selection', {
      taskId: task.id,
      taskTitle: task.title,
      provider: provider,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log task execution event
   *
   * @param {object} task - Task being executed
   * @param {string} provider - Provider used
   * @param {object} result - Execution result
   */
  logTaskExecution(task, provider, result) {
    this.logEvent('task_execution', {
      taskId: task.id,
      taskTitle: task.title,
      provider: provider,
      success: result.success,
      executionTime: result.executionTime,
      retryCount: result.retryCount || 0,
      fallbackCount: result.fallbackLog ? result.fallbackLog.length : 0,
      error: result.error ? this._redactError(result.error) : null
    });
  }
  
  /**
   * Log provider fallback event
   *
   * @param {string} fromProvider - Original provider
   * @param {string} toProvider - Fallback provider
   * @param {string} reason - Reason for fallback
   */
  logProviderFallback(fromProvider, toProvider, reason) {
    this.logEvent('provider_fallback', {
      fromProvider,
      toProvider,
      reason: this._redactError(reason)
    });
  }
  
  /**
   * Log run completion event
   *
   * @param {object} summary - Run summary
   */
  logRunCompletion(summary) {
    this.logEvent('run_completion', {
      timestamp: new Date().toISOString(),
      duration: summary.duration,
      tasksCompleted: summary.tasksCompleted,
      tasksFailed: summary.tasksFailed,
      totalRetries: summary.totalRetries,
      totalFallbacks: summary.totalFallbacks,
      providersUsed: summary.providersUsed
    });
    
    // Write all events to file
    this._writeEventsToFile();
    
    if (this.verbose) {
      console.log(`🏁 Completed telemetry run: ${this.runId}`);
    }
  }
  
  /**
   * Write events to JSONL file
   */
  _writeEventsToFile() {
    if (!this.runId || this.events.length === 0) {
      return;
    }
    
    const runDir = path.join(this.baseDir, this.runId);
    const eventsFile = path.join(runDir, 'events.jsonl');
    
    try {
      // Write events as JSON Lines
      const eventLines = this.events.map(event => JSON.stringify(event));
      fs.writeFileSync(eventsFile, eventLines.join('\n') + '\n', 'utf8');
      
      // Also write a summary file
      const summary = {
        runId: this.runId,
        startTime: this.runStartTime.toISOString(),
        endTime: new Date().toISOString(),
        eventCount: this.events.length,
        eventTypes: [...new Set(this.events.map(e => e.eventType))]
      };
      
      fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
      
      if (this.verbose) {
        console.log(`💾 Written telemetry data to ${eventsFile}`);
      }
    } catch (error) {
      console.error(`❌ Failed to write telemetry data: ${error.message}`);
    }
  }
  
  /**
   * Redact sensitive information from event data
   *
   * @param {string} eventType - Event type
   * @param {object} data - Event data
   * @returns {object} Redacted data
   */
  _redactEventData(eventType, data) {
    const redacted = { ...data };
    
    // Redact sensitive fields based on event type
    switch (eventType) {
      case 'run_start':
        if (redacted.options) {
          redacted.options = this._redactOptions(redacted.options);
        }
        break;
      case 'task_execution':
        if (redacted.error) {
          redacted.error = this._redactError(redacted.error);
        }
        break;
      case 'provider_fallback':
        if (redacted.reason) {
          redacted.reason = this._redactError(redacted.reason);
        }
        break;
    }
    
    return redacted;
  }
  
  /**
   * Redact sensitive information from options
   *
   * @param {object} options - CLI options
   * @returns {object} Redacted options
   */
  _redactOptions(options) {
    if (!options) return options;
    
    const redacted = { ...options };
    
    // Redact sensitive fields
    const sensitiveFields = ['token', 'apiKey', 'secret', 'password', 'key', 'credential'];
    
    Object.keys(redacted).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        redacted[key] = '[REDACTED]';
      }
      
      // Redact absolute paths
      if (typeof redacted[key] === 'string') {
        redacted[key] = this._redactPaths(redacted[key]);
      }
    });
    
    return redacted;
  }
  
  /**
   * Redact sensitive information from strings
   *
   * @param {string} str - String to redact
   * @returns {string} Redacted string
   */
  _redactSensitiveInfo(str) {
    if (!str || typeof str !== 'string') return str;
    
    // Redact absolute paths
    str = this._redactPaths(str);
    
    // Redact common sensitive patterns
    const patterns = [
      /\b[A-Za-z0-9]{32,}\b/g, // Long tokens
      /\b(sk-|sk_|api-|key-)[A-Za-z0-9]{10,}\b/g, // API keys
      /\b(ghp_|gho_|ghu_|ghs_)[A-Za-z0-9]{36,}\b/g // GitHub tokens
    ];
    
    patterns.forEach(pattern => {
      str = str.replace(pattern, '[REDACTED]');
    });
    
    return str;
  }
  
  /**
   * Redact absolute paths from strings
   *
   * @param {string} str - String to process
   * @returns {string} String with paths redacted
   */
  _redactPaths(str) {
    if (!str || typeof str !== 'string') return str;
    
    // Simple path detection - look for common path patterns
    const simplePathPattern = /([A-Za-z]:[\\/]|\\|\/)[^\s]*[\\/][^\s]+/g;
    
    return str.replace(simplePathPattern, (match) => {
      // Extract filename from the end of the path
      const parts = match.split(/[\\/]/);
      const filename = parts[parts.length - 1];
      if (filename && filename.trim()) {
        return `[PATH]/${filename}`;
      }
      return '[PATH]';
    });
  }
  
  /**
   * Redact error messages
   *
   * @param {string|object} error - Error to redact
   * @returns {string|object} Redacted error
   */
  _redactError(error) {
    if (!error) return error;
    
    if (typeof error === 'string') {
      return this._redactSensitiveInfo(error);
    }
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: this._redactSensitiveInfo(error.message),
        stack: error.stack ? this._redactSensitiveInfo(error.stack) : undefined
      };
    }
    
    if (typeof error === 'object') {
      const redacted = { ...error };
      Object.keys(redacted).forEach(key => {
        if (typeof redacted[key] === 'string') {
          redacted[key] = this._redactSensitiveInfo(redacted[key]);
        }
      });
      return redacted;
    }
    
    return error;
  }
  
  /**
   * Get all recent runs
   *
   * @param {number} limit - Maximum number of runs to return
   * @returns {Array<object>} List of run summaries
   */
  getRecentRuns(limit = 10) {
    try {
      const runDirs = fs.readdirSync(this.baseDir)
        .filter(dir => fs.statSync(path.join(this.baseDir, dir)).isDirectory())
        .sort((a, b) => {
          // Sort by timestamp (newest first)
          const aTime = fs.statSync(path.join(this.baseDir, a)).mtime.getTime();
          const bTime = fs.statSync(path.join(this.baseDir, b)).mtime.getTime();
          return bTime - aTime;
        })
        .slice(0, limit);
      
      return runDirs.map(runId => {
        try {
          const summaryPath = path.join(this.baseDir, runId, 'summary.json');
          if (fs.existsSync(summaryPath)) {
            const content = fs.readFileSync(summaryPath, 'utf8');
            return JSON.parse(content);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to read summary for run ${runId}: ${error.message}`);
        }
        return null;
      }).filter(Boolean);
      
    } catch (error) {
      console.error(`❌ Failed to get recent runs: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get events for a specific run
   *
   * @param {string} runId - Run ID
   * @returns {Array<object>} List of events
   */
  getRunEvents(runId) {
    try {
      const eventsPath = path.join(this.baseDir, runId, 'events.jsonl');
      if (fs.existsSync(eventsPath)) {
        const content = fs.readFileSync(eventsPath, 'utf8');
        return content.trim().split('\n').map(line => JSON.parse(line));
      }
      return [];
    } catch (error) {
      console.error(`❌ Failed to get events for run ${runId}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Clean up old runs
   *
   * @param {number} maxAgeDays - Maximum age in days to keep runs
   * @returns {number} Number of runs deleted
   */
  cleanupOldRuns(maxAgeDays = 30) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - maxAgeDays);
      
      const runDirs = fs.readdirSync(this.baseDir)
        .filter(dir => fs.statSync(path.join(this.baseDir, dir)).isDirectory())
        .filter(dir => {
          const stat = fs.statSync(path.join(this.baseDir, dir));
          return stat.mtime < cutoff;
        });
      
      let deletedCount = 0;
      runDirs.forEach(runId => {
        try {
          const runPath = path.join(this.baseDir, runId);
          fs.rmSync(runPath, { recursive: true, force: true });
          deletedCount++;
          if (this.verbose) {
            console.log(`🗑️  Deleted old run: ${runId}`);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to delete run ${runId}: ${error.message}`);
        }
      });
      
      return deletedCount;
      
    } catch (error) {
      console.error(`❌ Failed to cleanup old runs: ${error.message}`);
      return 0;
    }
  }
}

module.exports = { TelemetryManager };
