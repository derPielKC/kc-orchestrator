/**
 * Task Validation System
 * 
 * This module provides comprehensive validation of task outputs and acceptance criteria
 * for the kc-orchestrator execution engine.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { readGuide } = require('./config');
const { TaskValidationError } = require('./errors');

/**
 * Task Validator
 * 
 * Validates task outputs and acceptance criteria.
 */
class TaskValidator {
  /**
   * Create a new TaskValidator instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.projectPath - Project directory path
   * @param {string} options.guidePath - Path to IMPLEMENTATION_GUIDE.json
   * @param {number} options.validationTimeout - Validation timeout in ms
   */
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.guidePath = options.guidePath || `${this.projectPath}/IMPLEMENTATION_GUIDE.json`;
    this.validationTimeout = options.validationTimeout || 30000; // 30 seconds
    this.validationResults = new Map(); // taskId -> validationResult
  }

  /**
   * Validate that required output files exist
   * 
   * @param {Object} task - Task to validate
   * @param {Object} executionResult - Execution result containing outputs
   * @returns {Promise<Object>} Validation result
   */
  async validateOutputFiles(task, executionResult) {
    try {
      const validationResult = {
        taskId: task.id,
        validationType: 'output_files',
        timestamp: new Date().toISOString(),
        checks: [],
        passed: true,
        message: 'All output files validated successfully'
      };

      // Check if task specifies required output files
      const requiredFiles = task.outputFiles || [];
      
      if (requiredFiles.length === 0) {
        validationResult.message = 'No output files specified for validation';
        this.validationResults.set(task.id, validationResult);
        return validationResult;
      }

      // Check each required file
      for (const filePattern of requiredFiles) {
        const fileCheck = {
          type: 'file_existence',
          pattern: filePattern,
          timestamp: new Date().toISOString()
        };

        try {
          // Support both exact paths and glob patterns
          const fullPath = path.resolve(this.projectPath, filePattern);
          
          if (fs.existsSync(fullPath)) {
            fileCheck.status = 'passed';
            fileCheck.message = `File ${filePattern} exists`;
            try {
              const stats = fs.statSync(fullPath);
              fileCheck.size = stats.size;
              fileCheck.modified = stats.mtime;
            } catch (statError) {
              // File exists but we can't get stats - still consider it passed
              fileCheck.message += ` (could not get file stats)`;
            }
          } else {
            fileCheck.status = 'failed';
            fileCheck.message = `File ${filePattern} does not exist`;
            validationResult.passed = false;
          }
        } catch (error) {
          fileCheck.status = 'error';
          fileCheck.message = `Error checking file ${filePattern}: ${error.message}`;
          validationResult.passed = false;
        }

        validationResult.checks.push(fileCheck);
      }

      if (!validationResult.passed) {
        validationResult.message = `${validationResult.checks.filter(c => c.status !== 'passed').length} file checks failed`;
      }

      this.validationResults.set(task.id, validationResult);
      return validationResult;
    } catch (error) {
      throw new TaskValidationError(`Failed to validate output files for task ${task.id}`, error);
    }
  }

  /**
   * Validate acceptance criteria
   * 
   * @param {Object} task - Task to validate
   * @param {Object} executionResult - Execution result
   * @returns {Promise<Object>} Validation result
   */
  async validateAcceptanceCriteria(task, executionResult) {
    try {
      const validationResult = {
        taskId: task.id,
        validationType: 'acceptance_criteria',
        timestamp: new Date().toISOString(),
        criteriaChecks: [],
        passed: true,
        message: 'All acceptance criteria validated successfully'
      };

      const criteria = task.acceptanceCriteria || [];
      
      if (criteria.length === 0) {
        validationResult.message = 'No acceptance criteria specified';
        this.validationResults.set(task.id, validationResult);
        return validationResult;
      }

      // Check each acceptance criterion
      for (let i = 0; i < criteria.length; i++) {
        const criterion = criteria[i];
        const criterionCheck = {
          index: i,
          criterion,
          timestamp: new Date().toISOString()
        };

        try {
          // Simple validation: check if criterion is met based on execution result
          // This can be enhanced with more sophisticated validation logic
          if (executionResult && executionResult.output) {
            // Check if criterion text appears in output
            const outputText = typeof executionResult.output === 'string' 
              ? executionResult.output 
              : JSON.stringify(executionResult.output);
            
            if (outputText.includes(criterion)) {
              criterionCheck.status = 'passed';
              criterionCheck.message = `Criterion found in execution output`;
            } else {
              criterionCheck.status = 'failed';
              criterionCheck.message = `Criterion not found in execution output`;
              validationResult.passed = false;
            }
          } else {
            criterionCheck.status = 'unknown';
            criterionCheck.message = `No execution output available for validation`;
            validationResult.passed = false;
          }
        } catch (error) {
          criterionCheck.status = 'error';
          criterionCheck.message = `Error validating criterion: ${error.message}`;
          validationResult.passed = false;
        }

        validationResult.criteriaChecks.push(criterionCheck);
      }

      if (!validationResult.passed) {
        const failedChecks = validationResult.criteriaChecks.filter(c => c.status !== 'passed');
        validationResult.message = `${failedChecks.length} of ${criteria.length} acceptance criteria not met`;
      }

      this.validationResults.set(task.id, validationResult);
      return validationResult;
    } catch (error) {
      throw new TaskValidationError(`Failed to validate acceptance criteria for task ${task.id}`, error);
    }
  }

  /**
   * Execute checkSteps commands for validation
   * 
   * @param {Object} task - Task to validate
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Validation result
   */
  async executeCheckSteps(task, options = {}) {
    try {
      const validationResult = {
        taskId: task.id,
        validationType: 'check_steps',
        timestamp: new Date().toISOString(),
        stepResults: [],
        passed: true,
        message: 'All check steps executed successfully'
      };

      const checkSteps = task.checkSteps || [];
      
      if (checkSteps.length === 0) {
        validationResult.message = 'No check steps specified';
        this.validationResults.set(task.id, validationResult);
        return validationResult;
      }

      // Execute each check step command
      for (let i = 0; i < checkSteps.length; i++) {
        const step = checkSteps[i];
        const stepResult = {
          index: i,
          command: step.command,
          description: step.description || `Check step ${i + 1}`,
          timestamp: new Date().toISOString()
        };

        try {
          // Execute command with timeout
          const startTime = Date.now();
          const commandResult = execSync(step.command, {
            cwd: this.projectPath,
            encoding: 'utf8',
            timeout: this.validationTimeout,
            ...options
          });
          const duration = Date.now() - startTime;

          stepResult.status = 'passed';
          stepResult.output = commandResult;
          stepResult.duration = duration;
          stepResult.message = `Command executed successfully in ${duration}ms`;

          // Check expected output if specified
          if (step.expectedOutput) {
            if (commandResult.includes(step.expectedOutput)) {
              stepResult.outputCheck = 'passed';
            } else {
              stepResult.outputCheck = 'failed';
              stepResult.message += ` (expected output not found)`;
              validationResult.passed = false;
            }
          }
        } catch (error) {
          stepResult.status = 'failed';
          stepResult.error = error.message;
          stepResult.message = `Command failed: ${error.message}`;
          
          if (error.stdout) stepResult.stdout = error.stdout;
          if (error.stderr) stepResult.stderr = error.stderr;
          
          validationResult.passed = false;
        }

        validationResult.stepResults.push(stepResult);
      }

      if (!validationResult.passed) {
        const failedSteps = validationResult.stepResults.filter(s => s.status !== 'passed');
        validationResult.message = `${failedSteps.length} of ${checkSteps.length} check steps failed`;
      }

      this.validationResults.set(task.id, validationResult);
      return validationResult;
    } catch (error) {
      throw new TaskValidationError(`Failed to execute check steps for task ${task.id}`, error);
    }
  }

  /**
   * Execute custom validation script
   * 
   * @param {Object} task - Task to validate
   * @param {Object} executionResult - Execution result
   * @returns {Promise<Object>} Validation result
   */
  async executeCustomValidationScript(task, executionResult) {
    try {
      const validationResult = {
        taskId: task.id,
        validationType: 'custom_script',
        timestamp: new Date().toISOString(),
        scriptResult: null,
        passed: false,
        message: 'Custom validation script not executed'
      };

      const validationScript = task.validationScript;
      
      if (!validationScript) {
        validationResult.message = 'No custom validation script specified';
        this.validationResults.set(task.id, validationResult);
        return validationResult;
      }

      // Execute the validation script
      try {
        const scriptPath = path.resolve(this.projectPath, validationScript);
        
        if (!fs.existsSync(scriptPath)) {
          throw new Error(`Validation script not found: ${validationScript}`);
        }

        // Execute the script with task and execution result as environment variables
        const env = {
          ...process.env,
          KC_TASK_ID: task.id,
          KC_TASK_TITLE: task.title,
          KC_EXECUTION_OUTPUT: JSON.stringify(executionResult || {}),
          KC_PROJECT_PATH: this.projectPath
        };

        const startTime = Date.now();
        const scriptResult = execSync(`node ${scriptPath}`, {
          cwd: this.projectPath,
          encoding: 'utf8',
          timeout: this.validationTimeout,
          env
        });
        const duration = Date.now() - startTime;

        // Parse script result (expected to be JSON)
        let parsedResult;
        try {
          parsedResult = JSON.parse(scriptResult);
        } catch (parseError) {
          throw new Error(`Validation script returned invalid JSON: ${parseError.message}`);
        }

        validationResult.scriptResult = parsedResult;
        validationResult.passed = parsedResult.passed || false;
        validationResult.message = parsedResult.message || 'Custom validation script executed';
        validationResult.duration = duration;
        
      } catch (error) {
        validationResult.error = error.message;
        validationResult.message = `Custom validation script failed: ${error.message}`;
        validationResult.passed = false;
      }

      this.validationResults.set(task.id, validationResult);
      return validationResult;
    } catch (error) {
      throw new TaskValidationError(`Failed to execute custom validation script for task ${task.id}`, error);
    }
  }

  /**
   * Run comprehensive validation for a task
   * 
   * @param {Object} task - Task to validate
   * @param {Object} executionResult - Execution result
   * @returns {Promise<Object>} Comprehensive validation report
   */
  async validateTask(task, executionResult) {
    try {
      const comprehensiveReport = {
        taskId: task.id,
        taskTitle: task.title,
        timestamp: new Date().toISOString(),
        validations: [],
        overallPassed: true,
        summary: 'Task validation completed successfully'
      };

      // Run all validation types
      const validationTypes = [
        { type: 'output_files', method: this.validateOutputFiles.bind(this) },
        { type: 'acceptance_criteria', method: this.validateAcceptanceCriteria.bind(this) },
        { type: 'check_steps', method: this.executeCheckSteps.bind(this) },
        { type: 'custom_script', method: this.executeCustomValidationScript.bind(this) }
      ];

      for (const validationType of validationTypes) {
        try {
          const result = await validationType.method(task, executionResult);
          comprehensiveReport.validations.push(result);
          
          if (!result.passed) {
            comprehensiveReport.overallPassed = false;
          }
        } catch (error) {
          comprehensiveReport.validations.push({
            validationType: validationType.type,
            taskId: task.id,
            timestamp: new Date().toISOString(),
            passed: false,
            message: `Validation failed: ${error.message}`,
            error: error.message
          });
          comprehensiveReport.overallPassed = false;
        }
      }

      // Generate summary
      const passedValidations = comprehensiveReport.validations.filter(v => v.passed).length;
      const totalValidations = comprehensiveReport.validations.length;
      
      if (comprehensiveReport.overallPassed) {
        comprehensiveReport.summary = `All ${totalValidations} validation checks passed`;
      } else {
        const failedValidations = totalValidations - passedValidations;
        comprehensiveReport.summary = `${failedValidations} of ${totalValidations} validation checks failed`;
      }

      this.validationResults.set(task.id, comprehensiveReport);
      return comprehensiveReport;
    } catch (error) {
      throw new TaskValidationError(`Failed to validate task ${task.id}`, error);
    }
  }

  /**
   * Get validation result for a task
   * 
   * @param {string} taskId - Task ID
   * @returns {Object|null} Validation result or null if not validated
   */
  getValidationResult(taskId) {
    return this.validationResults.get(taskId) || null;
  }

  /**
   * Get all validation results
   * 
   * @returns {Object} All validation results by task ID
   */
  getAllValidationResults() {
    const result = {};
    this.validationResults.forEach((validation, taskId) => {
      result[taskId] = validation;
    });
    return result;
  }

  /**
   * Generate validation report
   * 
   * @returns {Promise<Object>} Comprehensive validation report
   */
  async generateValidationReport() {
    try {
      const guide = await readGuide(this.guidePath);
      if (!guide || !guide.tasks) {
        return {
          timestamp: new Date().toISOString(),
          totalTasks: 0,
          validatedTasks: 0,
          validationSummary: 'No tasks found in guide'
        };
      }

      const report = {
        timestamp: new Date().toISOString(),
        totalTasks: guide.tasks.length,
        validatedTasks: 0,
        validationPassed: 0,
        validationFailed: 0,
        taskDetails: [],
        overallStatus: 'unknown'
      };

      // Analyze validation results for each task
      for (const task of guide.tasks) {
        const validationResult = this.getValidationResult(task.id);
        const taskDetail = {
          taskId: task.id,
          taskTitle: task.title,
          taskStatus: task.status,
          validated: !!validationResult,
          validationPassed: false,
          validationMessage: 'Not validated'
        };

        if (validationResult) {
          report.validatedTasks++;
          taskDetail.validated = true;
          taskDetail.validationPassed = validationResult.overallPassed || validationResult.passed || false;
          taskDetail.validationMessage = validationResult.summary || validationResult.message || 'Validated';
          taskDetail.validationType = validationResult.validationType;
          
          if (taskDetail.validationPassed) {
            report.validationPassed++;
          } else {
            report.validationFailed++;
          }
        }

        report.taskDetails.push(taskDetail);
      }

      // Determine overall status
      if (report.validatedTasks === 0) {
        report.overallStatus = 'no_validations_performed';
        report.validationSummary = 'No tasks have been validated yet';
      } else if (report.validationFailed === 0) {
        report.overallStatus = 'all_passed';
        report.validationSummary = `All ${report.validatedTasks} validated tasks passed`;
      } else if (report.validationPassed === 0) {
        report.overallStatus = 'all_failed';
        report.validationSummary = `All ${report.validatedTasks} validated tasks failed`;
      } else {
        report.overallStatus = 'partial';
        report.validationSummary = `${report.validationPassed} passed, ${report.validationFailed} failed out of ${report.validatedTasks} validated tasks`;
      }

      return report;
    } catch (error) {
      throw new TaskValidationError('Failed to generate validation report', error);
    }
  }

  /**
   * Reset validation results
   */
  reset() {
    this.validationResults.clear();
  }
}

module.exports = {
  TaskValidator
};