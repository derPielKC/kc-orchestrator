/**
 * Execution Report Generator
 * 
 * This module provides comprehensive execution reporting capabilities
 * for the kc-orchestrator system, including JSON, HTML, and Markdown
 * report generation with visualization support.
 */

const fs = require('fs');
const path = require('path');
const { readGuide } = require('./config');
const { TaskExecutionError, ReportGenerationError } = require('./errors');

/**
 * Execution Report Generator
 * 
 * Generates comprehensive reports from execution logs and validation results.
 */
class ExecutionReportGenerator {
  /**
   * Create a new ExecutionReportGenerator instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.projectPath - Project directory path
   * @param {string} options.guidePath - Path to IMPLEMENTATION_GUIDE.json
   * @param {string} options.reportDir - Directory to save reports (default: 'reports')
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.guidePath = options.guidePath || `${this.projectPath}/IMPLEMENTATION_GUIDE.json`;
    this.reportDir = options.reportDir || path.join(this.projectPath, 'reports');
    this.verbose = options.verbose || false;
    
    // Ensure report directory exists
    this._ensureReportDirectory();
  }

  /**
   * Ensure report directory exists
   */
  _ensureReportDirectory() {
    try {
      if (!fs.existsSync(this.reportDir)) {
        fs.mkdirSync(this.reportDir, { recursive: true });
        if (this.verbose) {
          console.log(`📁 Created report directory: ${this.reportDir}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to create report directory: ${error.message}`);
    }
  }

  /**
   * Log messages
   * 
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    if (this.verbose || level === 'error') {
      const timestamp = new Date().toISOString();
      console[level === 'error' ? 'error' : 'log'](
        `[${timestamp}] [ReportGenerator] [${level.toUpperCase()}] ${message}`,
        data
      );
    }
  }

  /**
   * Generate JSON report from execution data
   * 
   * @param {Object} executionData - Execution data including log and validation results
   * @returns {Promise<Object>} JSON report object
   */
  async generateJSONReport(executionData) {
    try {
      if (!executionData || typeof executionData !== 'object') {
        throw new ReportGenerationError('Invalid execution data for report generation');
      }

      // Read project guide for context
      const guide = await readGuide(this.guidePath);
      
      // Create comprehensive JSON report
      const jsonReport = {
        metadata: {
          timestamp: new Date().toISOString(),
          reportType: 'execution',
          generator: 'kc-orchestrator',
          version: '1.0.0'
        },
        project: {
          name: guide.project || 'Unknown Project',
          description: guide.description || 'No description',
          timestamp: new Date().toISOString()
        },
        executionSummary: this._generateExecutionSummary(executionData),
        taskDetails: this._generateTaskDetails(executionData, guide),
        validationResults: this._generateValidationResults(executionData),
        statistics: this._generateStatistics(executionData, guide),
        recommendations: this._generateRecommendations(executionData)
      };

      this.log('info', 'Generated JSON report', {
        tasks: jsonReport.taskDetails.length,
        statistics: Object.keys(jsonReport.statistics).length
      });

      return jsonReport;
    } catch (error) {
      throw new ReportGenerationError(`Failed to generate JSON report: ${error.message}`, error);
    }
  }

  /**
   * Generate execution summary
   * 
   * @param {Object} executionData - Execution data
   * @returns {Object} Execution summary
   */
  _generateExecutionSummary(executionData) {
    const summary = {
      startTime: executionData.startTime || new Date().toISOString(),
      endTime: executionData.endTime || new Date().toISOString(),
      durationMs: executionData.duration || 0,
      totalTasks: executionData.totalTasks || 0,
      completedTasks: executionData.completed || 0,
      failedTasks: executionData.failed || 0,
      successRate: 0,
      status: 'unknown'
    };

    // Calculate success rate
    if (summary.totalTasks > 0) {
      summary.successRate = Math.round((summary.completedTasks / summary.totalTasks) * 100);
    }

    // Determine overall status
    if (summary.failedTasks === 0 && summary.totalTasks > 0) {
      summary.status = 'success';
    } else if (summary.completedTasks === 0 && summary.totalTasks > 0) {
      summary.status = 'failure';
    } else if (summary.completedTasks > 0 && summary.failedTasks > 0) {
      summary.status = 'partial';
    }

    return summary;
  }

  /**
   * Generate task details
   * 
   * @param {Object} executionData - Execution data
   * @param {Object} guide - Project guide
   * @returns {Array} Task details array
   */
  _generateTaskDetails(executionData, guide) {
    const taskDetails = [];
    const tasks = guide.tasks || [];
    const executionLog = executionData.executionLog || [];
    
    tasks.forEach(task => {
      const taskDetail = {
        taskId: task.id,
        title: task.title || `Task ${task.id}`,
        description: task.description || 'No description',
        status: task.status || 'unknown',
        phase: this._getTaskPhase(task, guide),
        executionInfo: null,
        validationResults: []
      };

      // Find execution info for this task
      const executionInfo = executionLog.find(log => log.taskId === task.id);
      if (executionInfo) {
        taskDetail.executionInfo = {
          provider: executionInfo.provider || 'unknown',
          attempt: executionInfo.attempt || 1,
          durationMs: executionInfo.duration || 0,
          timestamp: executionInfo.timestamp || new Date().toISOString(),
          success: executionInfo.status === 'completed'
        };
      }

      // Add validation results if available
      if (executionData.validationResults && executionData.validationResults[task.id]) {
        taskDetail.validationResults = executionData.validationResults[task.id];
      }

      taskDetails.push(taskDetail);
    });

    return taskDetails;
  }

  /**
   * Get task phase information
   * 
   * @param {Object} task - Task object
   * @param {Object} guide - Project guide
   * @returns {Object} Phase information
   */
  _getTaskPhase(task, guide) {
    const phase = guide.phases.find(p => p.tasks && p.tasks.includes(task.id));
    return phase ? {
      name: phase.name,
      description: phase.description || ''
    } : {
      name: 'Unknown',
      description: ''
    };
  }

  /**
   * Generate validation results section
   * 
   * @param {Object} executionData - Execution data
   * @returns {Object} Validation results
   */
  _generateValidationResults(executionData) {
    const validationResults = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      validationTypes: {},
      aiJudgments: []
    };

    if (!executionData.validationResults) {
      return validationResults;
    }

    // Count validation results
    Object.values(executionData.validationResults).forEach(taskValidations => {
      if (Array.isArray(taskValidations)) {
        taskValidations.forEach(validation => {
          validationResults.totalValidations++;
          
          if (validation.passed) {
            validationResults.passedValidations++;
          } else {
            validationResults.failedValidations++;
          }
          
          // Track validation types
          const validationType = validation.validationType || 'unknown';
          validationResults.validationTypes[validationType] = (
            validationResults.validationTypes[validationType] || 0
          ) + 1;
          
          // Collect AI judgments
          if (validation.validationType === 'ai_judging' && validation.aiJudgment) {
            validationResults.aiJudgments.push({
              taskId: validation.taskId,
              assessment: validation.aiJudgment.assessment,
              confidence: validation.aiJudgment.confidence,
              model: validation.aiJudgment.model
            });
          }
        });
      }
    });

    return validationResults;
  }

  /**
   * Generate statistics
   * 
   * @param {Object} executionData - Execution data
   * @param {Object} guide - Project guide
   * @returns {Object} Statistics object
   */
  _generateStatistics(executionData, guide) {
    const stats = {
      project: {
        totalTasks: guide.tasks ? guide.tasks.length : 0,
        totalPhases: guide.phases ? guide.phases.length : 0,
        completedTasks: guide.tasks ? guide.tasks.filter(t => t.status === 'completed').length : 0,
        inProgressTasks: guide.tasks ? guide.tasks.filter(t => t.status === 'in_progress').length : 0,
        todoTasks: guide.tasks ? guide.tasks.filter(t => t.status === 'todo').length : 0,
        failedTasks: guide.tasks ? guide.tasks.filter(t => t.status === 'failed').length : 0
      },
      execution: {
        totalDurationMs: executionData.duration || 0,
        averageTaskDurationMs: 0,
        providersUsed: {},
        attempts: {}
      }
    };

    // Calculate average task duration
    const executionLog = executionData.executionLog || [];
    if (executionLog.length > 0) {
      const totalDuration = executionLog.reduce((sum, log) => sum + (log.duration || 0), 0);
      stats.execution.averageTaskDurationMs = Math.round(totalDuration / executionLog.length);
    }

    // Count providers and attempts
    executionLog.forEach(log => {
      const provider = log.provider || 'unknown';
      stats.execution.providersUsed[provider] = (stats.execution.providersUsed[provider] || 0) + 1;
      
      const attempt = log.attempt || 1;
      if (attempt > 1) {
        stats.execution.attempts[`${attempt}_attempts`] = (stats.execution.attempts[`${attempt}_attempts`] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Generate recommendations
   * 
   * @param {Object} executionData - Execution data
   * @returns {Array} Recommendations array
   */
  _generateRecommendations(executionData) {
    const recommendations = [];
    
    // Analyze execution data for recommendations
    const summary = executionData.executionSummary || {};
    const rawValidationResults = executionData.validationResults || {};
    
    // Generate validation results to get processed data
    const processedValidationResults = this._generateValidationResults(executionData);
    
    // Success rate recommendations
    if (summary.successRate < 50) {
      recommendations.push({
        type: 'critical',
        message: 'Low success rate detected. Review task requirements and provider capabilities.',
        priority: 'high',
        action: 'Analyze failed tasks and improve task definitions'
      });
    } else if (summary.successRate < 80) {
      recommendations.push({
        type: 'warning',
        message: 'Moderate success rate. Consider optimizing task parameters.',
        priority: 'medium',
        action: 'Review partially successful tasks for improvement opportunities'
      });
    } else {
      recommendations.push({
        type: 'success',
        message: 'High success rate achieved. Consider scaling up execution.',
        priority: 'low',
        action: 'Monitor performance and maintain current approach'
      });
    }

    // Validation recommendations
    if (processedValidationResults.failedValidations > 0) {
      recommendations.push({
        type: 'validation',
        message: `Validation failures detected (${processedValidationResults.failedValidations} failures).`,
        priority: 'high',
        action: 'Review validation criteria and task outputs'
      });
    }

    // AI judgment recommendations
    if (processedValidationResults.aiJudgments && processedValidationResults.aiJudgments.length > 0) {
      const lowConfidenceJudgments = processedValidationResults.aiJudgments.filter(j => j.confidence < 70);
      if (lowConfidenceJudgments.length > 0) {
        recommendations.push({
          type: 'ai',
          message: `Low confidence AI judgments detected (${lowConfidenceJudgments.length} judgments with <70% confidence).`,
          priority: 'medium',
          action: 'Review AI judgment criteria and task requirements'
        });
      }
    }

    return recommendations;
  }

  /**
   * Save JSON report to file
   * 
   * @param {Object} jsonReport - JSON report object
   * @param {string} filename - Filename (without extension)
   * @returns {Promise<string>} Path to saved file
   */
  async saveJSONReport(jsonReport, filename = 'execution-report') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportFilename = `${filename}-${timestamp}.json`;
      const reportPath = path.join(this.reportDir, reportFilename);
      
      const jsonContent = JSON.stringify(jsonReport, null, 2);
      await fs.promises.writeFile(reportPath, jsonContent, 'utf8');
      
      this.log('info', 'Saved JSON report', {
        path: reportPath,
        size: jsonContent.length
      });
      
      return reportPath;
    } catch (error) {
      throw new ReportGenerationError(`Failed to save JSON report: ${error.message}`, error);
    }
  }

  /**
   * Generate HTML report from JSON report
   * 
   * @param {Object} jsonReport - JSON report object
   * @returns {Promise<string>} HTML report content
   */
  async generateHTMLReport(jsonReport) {
    try {
      if (!jsonReport || typeof jsonReport !== 'object') {
        throw new ReportGenerationError('Invalid JSON report for HTML generation');
      }

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>kc-orchestrator Execution Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
        .header { background: #4a6fa5; color: white; padding: 20px; text-align: center; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background: #d4edda; }
        .warning { background: #fff3cd; }
        .danger { background: #f8d7da; }
        .info { background: #d1ecf1; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
        .stat-box { display: inline-block; margin: 10px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .progress-bar { height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress { height: 100%; background: #4a6fa5; width: ${jsonReport.executionSummary.successRate}%; }
    </style>
</head>
<body>
    <div class="header">
        <h1>kc-orchestrator Execution Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    
    <div class="section">
        <h2>📊 Execution Summary</h2>
        <div class="stat-box">
            <strong>Status:</strong> ${jsonReport.executionSummary.status.toUpperCase()}
        </div>
        <div class="stat-box">
            <strong>Success Rate:</strong> ${jsonReport.executionSummary.successRate}%
        </div>
        <div class="stat-box">
            <strong>Duration:</strong> ${jsonReport.executionSummary.durationMs}ms
        </div>
        <div class="stat-box">
            <strong>Tasks:</strong> ${jsonReport.executionSummary.completedTasks}/${jsonReport.executionSummary.totalTasks} completed
        </div>
        
        <div class="progress-bar">
            <div class="progress"></div>
        </div>
    </div>
    
    <div class="section">
        <h2>📋 Task Details</h2>
        <table>
            <thead>
                <tr>
                    <th>Task ID</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Phase</th>
                    <th>Provider</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody>
                ${jsonReport.taskDetails.map(task => `
                <tr>
                    <td>${task.taskId}</td>
                    <td>${task.title}</td>
                    <td>${task.status}</td>
                    <td>${task.phase.name}</td>
                    <td>${task.executionInfo ? task.executionInfo.provider : 'N/A'}</td>
                    <td>${task.executionInfo ? task.executionInfo.durationMs + 'ms' : 'N/A'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>✅ Validation Results</h2>
        <p><strong>Total Validations:</strong> ${jsonReport.validationResults.totalValidations}</p>
        <p><strong>Passed:</strong> ${jsonReport.validationResults.passedValidations}</p>
        <p><strong>Failed:</strong> ${jsonReport.validationResults.failedValidations}</p>
        
        <h3>Validation Types:</h3>
        <ul>
            ${Object.entries(jsonReport.validationResults.validationTypes).map(([type, count]) => `
            <li>${type}: ${count} validations</li>
            `).join('')}
        </ul>
        
        ${jsonReport.validationResults.aiJudgments.length > 0 ? `
        <h3>AI Judgments:</h3>
        <table>
            <thead>
                <tr>
                    <th>Task ID</th>
                    <th>Assessment</th>
                    <th>Confidence</th>
                    <th>Model</th>
                </tr>
            </thead>
            <tbody>
                ${jsonReport.validationResults.aiJudgments.map(judgment => `
                <tr>
                    <td>${judgment.taskId}</td>
                    <td>${judgment.assessment}</td>
                    <td>${judgment.confidence}%</td>
                    <td>${judgment.model}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}
    </div>
    
    <div class="section">
        <h2>📈 Statistics</h2>
        <h3>Project Statistics:</h3>
        <ul>
            <li>Total Tasks: ${jsonReport.statistics.project.totalTasks}</li>
            <li>Completed: ${jsonReport.statistics.project.completedTasks}</li>
            <li>In Progress: ${jsonReport.statistics.project.inProgressTasks}</li>
            <li>Todo: ${jsonReport.statistics.project.todoTasks}</li>
            <li>Failed: ${jsonReport.statistics.project.failedTasks}</li>
        </ul>
        
        <h3>Execution Statistics:</h3>
        <ul>
            <li>Total Duration: ${jsonReport.statistics.execution.totalDurationMs}ms</li>
            <li>Average Task Duration: ${jsonReport.statistics.execution.averageTaskDurationMs}ms</li>
        </ul>
        
        ${Object.keys(jsonReport.statistics.execution.providersUsed).length > 0 ? `
        <h3>Providers Used:</h3>
        <ul>
            ${Object.entries(jsonReport.statistics.execution.providersUsed).map(([provider, count]) => `
            <li>${provider}: ${count} tasks</li>
            `).join('')}
        </ul>
        ` : ''}
    </div>
    
    <div class="section">
        <h2>💡 Recommendations</h2>
        ${jsonReport.recommendations.length > 0 ? `
        <ul>
            ${jsonReport.recommendations.map(rec => `
            <li class="${rec.type}">
                <strong>${rec.message}</strong> 
                (Priority: ${rec.priority}, Action: ${rec.action})
            </li>
            `).join('')}
        </ul>
        ` : '<p>No recommendations at this time.</p>'}
    </div>
    
    <div class="section info">
        <p>Generated by kc-orchestrator v1.0.0</p>
    </div>
</body>
</html>
`;

      return htmlContent;
    } catch (error) {
      throw new ReportGenerationError(`Failed to generate HTML report: ${error.message}`, error);
    }
  }

  /**
   * Save HTML report to file
   * 
   * @param {string} htmlContent - HTML report content
   * @param {string} filename - Filename (without extension)
   * @returns {Promise<string>} Path to saved file
   */
  async saveHTMLReport(htmlContent, filename = 'execution-report') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportFilename = `${filename}-${timestamp}.html`;
      const reportPath = path.join(this.reportDir, reportFilename);
      
      await fs.promises.writeFile(reportPath, htmlContent, 'utf8');
      
      this.log('info', 'Saved HTML report', {
        path: reportPath
      });
      
      return reportPath;
    } catch (error) {
      throw new ReportGenerationError(`Failed to save HTML report: ${error.message}`, error);
    }
  }

  /**
   * Generate Markdown report from JSON report
   * 
   * @param {Object} jsonReport - JSON report object
   * @returns {Promise<string>} Markdown report content
   */
  async generateMarkdownReport(jsonReport) {
    try {
      if (!jsonReport || typeof jsonReport !== 'object') {
        throw new ReportGenerationError('Invalid JSON report for Markdown generation');
      }

      const lines = [
        '# kc-orchestrator Execution Report',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## 📊 Execution Summary',
        '',
        `- **Status**: ${jsonReport.executionSummary.status.toUpperCase()}`,
        `- **Success Rate**: ${jsonReport.executionSummary.successRate}%`,
        `- **Duration**: ${jsonReport.executionSummary.durationMs}ms`,
        `- **Tasks**: ${jsonReport.executionSummary.completedTasks}/${jsonReport.executionSummary.totalTasks} completed`,
        '',
        '## 📋 Task Details',
        '',
        '| Task ID | Title | Status | Phase | Provider | Duration |',
        '|---------|-------|--------|-------|----------|----------|'
      ];

      // Add task rows
      jsonReport.taskDetails.forEach(task => {
        lines.push(
          `| ${task.taskId} | ${task.title} | ${task.status} | ${task.phase.name} | ${task.executionInfo ? task.executionInfo.provider : 'N/A'} | ${task.executionInfo ? task.executionInfo.durationMs + 'ms' : 'N/A'} |`
        );
      });

      lines.push(
        '',
        '## ✅ Validation Results',
        '',
        `- **Total Validations**: ${jsonReport.validationResults.totalValidations}`,
        `- **Passed**: ${jsonReport.validationResults.passedValidations}`,
        `- **Failed**: ${jsonReport.validationResults.failedValidations}`,
        '',
        '### Validation Types:',
        ''
      );

      // Add validation types
      Object.entries(jsonReport.validationResults.validationTypes).forEach(([type, count]) => {
        lines.push(`- ${type}: ${count} validations`);
      });

      if (jsonReport.validationResults.aiJudgments.length > 0) {
        lines.push(
          '',
          '### AI Judgments:',
          '',
          '| Task ID | Assessment | Confidence | Model |',
          '|---------|------------|------------|-------|'
        );

        jsonReport.validationResults.aiJudgments.forEach(judgment => {
          lines.push(
            `| ${judgment.taskId} | ${judgment.assessment} | ${judgment.confidence}% | ${judgment.model} |`
          );
        });
      }

      lines.push(
        '',
        '## 📈 Statistics',
        '',
        '### Project Statistics:',
        `- Total Tasks: ${jsonReport.statistics.project.totalTasks}`,
        `- Completed: ${jsonReport.statistics.project.completedTasks}`,
        `- In Progress: ${jsonReport.statistics.project.inProgressTasks}`,
        `- Todo: ${jsonReport.statistics.project.todoTasks}`,
        `- Failed: ${jsonReport.statistics.project.failedTasks}`,
        '',
        '### Execution Statistics:',
        `- Total Duration: ${jsonReport.statistics.execution.totalDurationMs}ms`,
        `- Average Task Duration: ${jsonReport.statistics.execution.averageTaskDurationMs}ms`,
        ''
      );

      if (Object.keys(jsonReport.statistics.execution.providersUsed).length > 0) {
        lines.push('### Providers Used:');
        Object.entries(jsonReport.statistics.execution.providersUsed).forEach(([provider, count]) => {
          lines.push(`- ${provider}: ${count} tasks`);
        });
        lines.push('');
      }

      lines.push(
        '## 💡 Recommendations',
        ''
      );

      if (jsonReport.recommendations.length > 0) {
        jsonReport.recommendations.forEach(rec => {
          lines.push(
            `- **${rec.message}** (Priority: ${rec.priority}, Action: ${rec.action})`
          );
        });
      } else {
        lines.push('No recommendations at this time.');
      }

      lines.push(
        '',
        "",
        "",
        "---",
        "",
        "Generated by kc-orchestrator v1.0.0"
      );

      return lines.join('\n');
    } catch (error) {
      throw new ReportGenerationError(`Failed to generate Markdown report: ${error.message}`, error);
    }
  }

  /**
   * Save Markdown report to file
   * 
   * @param {string} markdownContent - Markdown report content
   * @param {string} filename - Filename (without extension)
   * @returns {Promise<string>} Path to saved file
   */
  async saveMarkdownReport(markdownContent, filename = 'execution-report') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportFilename = `${filename}-${timestamp}.md`;
      const reportPath = path.join(this.reportDir, reportFilename);
      
      await fs.promises.writeFile(reportPath, markdownContent, 'utf8');
      
      this.log('info', 'Saved Markdown report', {
        path: reportPath
      });
      
      return reportPath;
    } catch (error) {
      throw new ReportGenerationError(`Failed to save Markdown report: ${error.message}`, error);
    }
  }

  /**
   * Generate comprehensive report (all formats)
   * 
   * @param {Object} executionData - Execution data
   * @param {string} baseFilename - Base filename for reports
   * @returns {Promise<Object>} Report generation results
   */
  async generateComprehensiveReport(executionData, baseFilename = 'execution-report') {
    try {
      // Generate JSON report first
      const jsonReport = await this.generateJSONReport(executionData);
      
      // Save JSON report
      const jsonReportPath = await this.saveJSONReport(jsonReport, baseFilename);
      
      // Generate and save HTML report
      const htmlContent = await this.generateHTMLReport(jsonReport);
      const htmlReportPath = await this.saveHTMLReport(htmlContent, baseFilename);
      
      // Generate and save Markdown report
      const markdownContent = await this.generateMarkdownReport(jsonReport);
      const markdownReportPath = await this.saveMarkdownReport(markdownContent, baseFilename);
      
      return {
        success: true,
        jsonReport,
        jsonReportPath,
        htmlReportPath,
        markdownReportPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new ReportGenerationError(`Failed to generate comprehensive report: ${error.message}`, error);
    }
  }

  /**
   * Get all report files in directory
   * 
   * @returns {Promise<Array>} List of report files
   */
  async getReportFiles() {
    try {
      const files = await fs.promises.readdir(this.reportDir);
      return files
        .filter(file => ['.json', '.html', '.md'].includes(path.extname(file)))
        .sort((a, b) => fs.statSync(path.join(this.reportDir, b)).mtime.getTime() - 
                      fs.statSync(path.join(this.reportDir, a)).mtime.getTime());
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new ReportGenerationError(`Failed to read report files: ${error.message}`, error);
    }
  }

  /**
   * Clean up old report files
   * 
   * @param {number} maxAgeDays - Maximum age in days (default: 30)
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupOldReports(maxAgeDays = 30) {
    try {
      const files = await this.getReportFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
      
      let deletedCount = 0;
      const deletedFiles = [];
      
      for (const file of files) {
        const filePath = path.join(this.reportDir, file);
        const stat = await fs.promises.stat(filePath);
        
        if (stat.mtime < cutoffDate) {
          await fs.promises.unlink(filePath);
          deletedCount++;
          deletedFiles.push(file);
        }
      }
      
      this.log('info', 'Cleaned up old reports', {
        deletedCount,
        maxAgeDays
      });
      
      return {
        success: true,
        deletedCount,
        deletedFiles,
        remainingFiles: files.length - deletedCount
      };
    } catch (error) {
      throw new ReportGenerationError(`Failed to cleanup old reports: ${error.message}`, error);
    }
  }
}

module.exports = {
  ExecutionReportGenerator,
  ReportGenerationError
};