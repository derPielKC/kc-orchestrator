/**
 * Performance Benchmarking System
 *
 * This module provides comprehensive performance benchmarking for the kc-orchestrator
 * execution engine, including timing, memory usage, and performance analysis.
 */

const fs = require('fs');
const path = require('path');
const { performance, PerformanceObserver } = require('perf_hooks');
const { TaskExecutionEngine } = require('./engine');
const { TaskValidator } = require('./validation');
const { ExecutionReportGenerator } = require('./report');

/**
 * Performance Benchmark Class
 *
 * Provides methods to measure and analyze performance of kc-orchestrator operations.
 */
class PerformanceBenchmark {
  /**
   * Create a new PerformanceBenchmark instance
   *
   * @param {Object} options - Configuration options
   * @param {string} options.projectPath - Project directory path
   * @param {number} options.maxSamples - Maximum number of samples to collect
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.maxSamples = options.maxSamples || 100;
    this.verbose = options.verbose || false;
    this.benchmarkDir = path.join(this.projectPath, '.kc-orchestrator', 'benchmarks');
    this.performanceData = [];
    
    // Ensure benchmark directory exists
    this._ensureBenchmarkDirectory();
    
    // Setup performance observer for memory measurements
    this._setupPerformanceObserver();
  }

  /**
   * Ensure benchmark directory exists
   */
  _ensureBenchmarkDirectory() {
    try {
      if (!fs.existsSync(this.benchmarkDir)) {
        fs.mkdirSync(this.benchmarkDir, { recursive: true });
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(`Failed to create benchmark directory: ${error.message}`);
      }
    }
  }

  /**
   * Setup performance observer for memory measurements
   */
  _setupPerformanceObserver() {
    this.perfObserver = new PerformanceObserver((items) => {
      const entries = items.getEntries();
      for (const entry of entries) {
        if (entry.entryType === 'measure') {
          this._recordPerformanceMetric(entry.name, entry.duration, entry.detail);
        }
      }
    });
    this.perfObserver.observe({ entryTypes: ['measure'] });
  }

  /**
   * Record performance metric
   *
   * @param {string} metricName - Name of the metric
   * @param {number} duration - Duration in milliseconds
   * @param {Object} details - Additional details
   */
  _recordPerformanceMetric(metricName, duration, details = {}) {
    const metric = {
      timestamp: new Date().toISOString(),
      metricName,
      duration,
      details
    };
    
    // Keep only the most recent samples
    this.performanceData.push(metric);
    if (this.performanceData.length > this.maxSamples) {
      this.performanceData.shift();
    }
    
    if (this.verbose) {
      console.log(`[BENCHMARK] ${metricName}: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Start performance measurement
   *
   * @param {string} metricName - Name of the metric to measure
   * @returns {string} Mark name for endMeasurement
   */
  startMeasurement(metricName) {
    const markName = `${metricName}-start-${Date.now()}`;
    performance.mark(markName);
    return markName;
  }

  /**
   * End performance measurement and record result
   *
   * @param {string} markName - Mark name from startMeasurement
   * @param {string} metricName - Name of the metric
   * @param {Object} details - Additional details
   */
  endMeasurement(markName, metricName, details = {}) {
    const endMark = `${metricName}-end-${Date.now()}`;
    performance.mark(endMark);
    
    // Measure and record directly instead of relying on observer
    performance.measure(metricName, markName, endMark);
    
    // Get the measurement result
    const measure = performance.getEntriesByName(metricName).find(entry => 
      entry.entryType === 'measure'
    );
    
    if (measure) {
      this._recordPerformanceMetric(metricName, measure.duration, details);
    }
    
    // Clean up marks and measures
    performance.clearMarks(markName);
    performance.clearMarks(endMark);
    performance.clearMeasures(metricName);
  }

  /**
   * Benchmark task execution engine
   *
   * @param {Object} task - Task to benchmark
   * @param {Object} engineOptions - Engine configuration options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkTaskExecution(task, engineOptions = {}) {
    const startMark = this.startMeasurement('task-execution');
    
    try {
      const engine = new TaskExecutionEngine({
        projectPath: this.projectPath,
        ...engineOptions
      });
      
      const result = await engine.executeTask(task);
      
      this.endMeasurement(startMark, 'task-execution', {
        taskId: task.id,
        provider: result?.provider,
        status: result?.status || 'completed'
      });
      
      return {
        success: true,
        taskId: task.id,
        executionResult: result,
        performanceData: this._getLatestMetrics('task-execution')
      };
    } catch (error) {
      this.endMeasurement(startMark, 'task-execution', {
        taskId: task.id,
        error: error.message,
        status: 'failed'
      });
      
      return {
        success: false,
        taskId: task.id,
        error: error.message,
        performanceData: this._getLatestMetrics('task-execution')
      };
    }
  }

  /**
   * Benchmark validation system
   *
   * @param {Object} task - Task to validate
   * @param {Object} executionResult - Execution result
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkValidation(task, executionResult) {
    const startMark = this.startMeasurement('task-validation');
    
    try {
      const validator = new TaskValidator({
        projectPath: this.projectPath
      });
      
      const result = await validator.validateTask(task, executionResult);
      
      this.endMeasurement(startMark, 'task-validation', {
        taskId: task.id,
        validationPassed: result.overallPassed
      });
      
      return {
        success: true,
        taskId: task.id,
        validationResult: result,
        performanceData: this._getLatestMetrics('task-validation')
      };
    } catch (error) {
      this.endMeasurement(startMark, 'task-validation', {
        taskId: task.id,
        error: error.message,
        status: 'failed'
      });
      
      return {
        success: false,
        taskId: task.id,
        error: error.message,
        performanceData: this._getLatestMetrics('task-validation')
      };
    }
  }

  /**
   * Benchmark report generation
   *
   * @param {Object} executionData - Execution data for report
   * @param {string} baseFilename - Base filename for reports
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkReportGeneration(executionData, baseFilename = 'benchmark-report') {
    const startMark = this.startMeasurement('report-generation');
    
    try {
      const reportGenerator = new ExecutionReportGenerator({
        projectPath: this.projectPath
      });
      
      const result = await reportGenerator.generateComprehensiveReport(executionData, baseFilename);
      
      this.endMeasurement(startMark, 'report-generation', {
        reportType: 'comprehensive',
        success: result.success
      });
      
      return {
        success: true,
        reportResult: result,
        performanceData: this._getLatestMetrics('report-generation')
      };
    } catch (error) {
      this.endMeasurement(startMark, 'report-generation', {
        error: error.message,
        status: 'failed'
      });
      
      return {
        success: false,
        error: error.message,
        performanceData: this._getLatestMetrics('report-generation')
      };
    }
  }

  /**
   * Get latest metrics for a specific metric name
   *
   * @param {string} metricName - Name of the metric
   * @returns {Array} Array of performance metrics
   */
  _getLatestMetrics(metricName) {
    return this.performanceData.filter(metric => metric.metricName === metricName);
  }

  /**
   * Calculate performance statistics
   *
   * @param {string} metricName - Name of the metric
   * @returns {Object} Performance statistics
   */
  calculateStatistics(metricName) {
    const metrics = this._getLatestMetrics(metricName);
    
    if (metrics.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        stdDev: 0
      };
    }
    
    const durations = metrics.map(m => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    // Calculate standard deviation
    const squaredDiffs = durations.map(d => Math.pow(d - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      count: durations.length,
      average: avg,
      min,
      max,
      stdDev,
      metrics
    };
  }

  /**
   * Generate performance report
   *
   * @param {string} reportName - Name for the performance report
   * @returns {Promise<Object>} Performance report generation result
   */
  async generatePerformanceReport(reportName = 'performance-report') {
    try {
      const reportPath = path.join(this.benchmarkDir, `${reportName}-${Date.now()}.json`);
      
      const performanceStatistics = {
        timestamp: new Date().toISOString(),
        totalMetrics: this.performanceData.length,
        statisticsByMetric: {}
      };
      
      // Calculate statistics for each metric type
      const metricTypes = [...new Set(this.performanceData.map(m => m.metricName))];
      for (const metricType of metricTypes) {
        performanceStatistics.statisticsByMetric[metricType] = this.calculateStatistics(metricType);
      }
      
      // Add system information
      performanceStatistics.systemInfo = this._getSystemInfo();
      
      // Write report to file
      await fs.promises.writeFile(reportPath, JSON.stringify(performanceStatistics, null, 2), 'utf8');
      
      return {
        success: true,
        reportPath,
        statistics: performanceStatistics
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get system information
   *
   * @returns {Object} System information
   */
  _getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Run comprehensive performance benchmark suite
   *
   * @param {Array} tasks - Array of tasks to benchmark
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Comprehensive benchmark results
   */
  async runComprehensiveBenchmark(tasks, options = {}) {
    const results = {
      timestamp: new Date().toISOString(),
      taskCount: tasks.length,
      executionResults: [],
      validationResults: [],
      reportResults: [],
      statistics: {}
    };
    
    // Benchmark task execution
    for (const task of tasks) {
      const execResult = await this.benchmarkTaskExecution(task, options);
      results.executionResults.push(execResult);
      
      if (execResult.success && execResult.executionResult) {
        const valResult = await this.benchmarkValidation(task, execResult.executionResult);
        results.validationResults.push(valResult);
      }
    }
    
    // Benchmark report generation
    const executionData = this._createExecutionDataFromResults(results);
    const reportResult = await this.benchmarkReportGeneration(executionData);
    results.reportResults.push(reportResult);
    
    // Calculate comprehensive statistics
    results.statistics.execution = this.calculateStatistics('task-execution');
    results.statistics.validation = this.calculateStatistics('task-validation');
    results.statistics.reporting = this.calculateStatistics('report-generation');
    
    // Generate performance report
    const perfReport = await this.generatePerformanceReport('comprehensive-benchmark');
    if (perfReport.success) {
      results.performanceReport = perfReport;
    }
    
    return results;
  }

  /**
   * Create execution data from benchmark results
   *
   * @param {Object} results - Benchmark results
   * @returns {Object} Execution data for reporting
   */
  _createExecutionDataFromResults(results) {
    const tasks = results.executionResults.map((result, index) => ({
      taskId: result.taskId,
      title: `Benchmark Task ${index + 1}`,
      status: result.success ? 'completed' : 'failed',
      provider: result.executionResult?.provider || 'unknown',
      duration: result.performanceData[0]?.duration || 0,
      validation: {
        success: results.validationResults[index]?.validationResult?.overallPassed || false,
        checksPassed: results.validationResults[index]?.validationResult?.validations?.filter(v => v.passed).length || 0,
        checksFailed: results.validationResults[index]?.validationResult?.validations?.filter(v => !v.passed).length || 0
      }
    }));
    
    return {
      project: 'Performance Benchmark',
      startTime: results.timestamp,
      endTime: new Date().toISOString(),
      tasks,
      summary: {
        totalTasks: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        successRate: Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) || 0
      }
    };
  }

  /**
   * Clean up performance data
   */
  cleanup() {
    this.performanceData = [];
    if (this.perfObserver) {
      this.perfObserver.disconnect();
    }
  }
}

/**
 * Performance Benchmark Error
 */
class PerformanceBenchmarkError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'PerformanceBenchmarkError';
    this.originalError = originalError;
    this.stack = originalError?.stack;
  }
}

module.exports = {
  PerformanceBenchmark,
  PerformanceBenchmarkError
};