/**
 * Fix Prompt Drafting System
 * 
 * This module provides comprehensive fix prompt drafting capabilities
 * using Ollama for generating actionable fix prompts based on failure analysis.
 */

const { OllamaClient } = require('./ollama');
const { LogSummarizer } = require('./summary');
const { FixPromptError } = require('./errors');

/**
 * Fix Prompt Drafter
 * 
 * Generates actionable fix prompts based on failure analysis using Ollama.
 */
class FixPromptDrafter {
  /**
   * Create a new FixPromptDrafter instance
   * 
   * @param {Object} options - Configuration options
   * @param {OllamaClient} options.ollamaClient - Ollama client instance
   * @param {LogSummarizer} options.logSummarizer - Log summarizer instance
   * @param {Object} options.promptTemplates - Custom prompt templates
   * @param {number} options.maxPromptLength - Maximum prompt length
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.ollamaClient = options.ollamaClient || new OllamaClient();
    this.logSummarizer = options.logSummarizer || new LogSummarizer();
    this.promptTemplates = options.promptTemplates || this.getDefaultTemplates();
    this.maxPromptLength = options.maxPromptLength || 4000; // 4KB max prompt size
    this.verbose = options.verbose || false;
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
        `[${timestamp}] [FixPromptDrafter] [${level.toUpperCase()}] ${message}`,
        data
      );
    }
  }

  /**
   * Get default prompt templates
   * 
   * @returns {Object} Default prompt templates
   */
  getDefaultTemplates() {
    return {
      general: {
        name: 'General Fix Prompt',
        description: 'Generic template for most failure types',
        template: `Based on the following task failure information, draft a comprehensive fix prompt:

Task ID: {taskId}
Task Title: {taskTitle}
Task Description: {taskDescription}

Failure Information:
- Error Type: {errorType}
- Error Message: {errorMessage}
- Context: {errorContext}

Log Analysis:
{logAnalysis}

Please provide a detailed fix prompt that includes:
1. Clear problem statement
2. Technical requirements and constraints
3. Implementation guidelines
4. Testing requirements
5. Acceptance criteria
6. Any relevant code examples or patterns

The fix prompt should be specific, actionable, and focused on resolving the exact issue described.`
      },

      code_error: {
        name: 'Code Error Fix',
        description: 'Template for code execution errors',
        template: `Draft a fix prompt for the following code execution error:

Task: {taskTitle}
Error: {errorMessage}

Code Context:
{errorContext}

Log Analysis:
{logAnalysis}

The fix should:
1. Identify the root cause of the code error
2. Provide specific code changes needed
3. Include any required imports or dependencies
4. Specify testing approach
5. Define success criteria

Focus on practical, implementable solutions with clear examples.`
      },

      validation_failure: {
        name: 'Validation Failure Fix',
        description: 'Template for validation failures',
        template: `Create a fix prompt for the following validation failure:

Task: {taskTitle}
Validation Error: {errorMessage}

Expected Output: {expectedOutput}
Actual Output: {actualOutput}

Log Analysis:
{logAnalysis}

The fix should address:
1. Why the validation failed
2. What needs to be changed to meet requirements
3. Specific acceptance criteria that weren't met
4. Testing approach to verify the fix
5. Any data or format transformations needed

Provide concrete, actionable steps with examples where possible.`
      },

      configuration_error: {
        name: 'Configuration Error Fix',
        description: 'Template for configuration issues',
        template: `Draft a fix prompt for the following configuration error:

Task: {taskTitle}
Configuration Issue: {errorMessage}

Current Configuration:
{errorContext}

Log Analysis:
{logAnalysis}

The fix should include:
1. Identification of incorrect configuration
2. Correct configuration values and structure
3. Location of configuration files that need updating
4. Any environment variables or settings involved
5. Verification steps to confirm proper configuration

Be specific about file paths, variable names, and expected values.`
      },

      permission_error: {
        name: 'Permission Error Fix',
        description: 'Template for file/access permission issues',
        template: `Create a fix prompt for the following permission error:

Task: {taskTitle}
Permission Error: {errorMessage}

File/Resource: {errorContext}

Log Analysis:
{logAnalysis}

The fix should address:
1. What permissions are needed
2. How to apply them (commands, configuration)
3. Security considerations
4. User/group ownership requirements
5. Verification steps

Include specific commands or configuration changes needed.`
      }
    };
  }

  /**
   * Check if Ollama is available
   * 
   * @returns {Promise<boolean>} True if Ollama is available
   */
  async checkOllamaAvailability() {
    try {
      const available = await this.ollamaClient.checkAvailability();
      this.log('info', `Ollama availability: ${available}`);
      return available;
    } catch (error) {
      this.log('warn', 'Ollama availability check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Select appropriate prompt template based on error type
   * 
   * @param {string} errorType - Type of error
   * @param {Object} failureInfo - Failure information
   * @returns {Object} Selected template
   */
  selectPromptTemplate(errorType, failureInfo) {
    const lowerErrorType = (errorType || '').toLowerCase();
    const errorMessage = (failureInfo.errorMessage || '').toLowerCase();

    // Try to match specific error types
    if (lowerErrorType.includes('validation') || errorMessage.includes('validation')) {
      return this.promptTemplates.validation_failure;
    } else if (lowerErrorType.includes('code') || lowerErrorType.includes('execution') || 
               errorMessage.includes('syntax') || errorMessage.includes('undefined')) {
      return this.promptTemplates.code_error;
    } else if (lowerErrorType.includes('config') || lowerErrorType.includes('configuration') ||
               errorMessage.includes('config') || errorMessage.includes('setting')) {
      return this.promptTemplates.configuration_error;
    } else if (lowerErrorType.includes('permission') || lowerErrorType.includes('access') ||
               errorMessage.includes('permission') || errorMessage.includes('access denied')) {
      return this.promptTemplates.permission_error;
    }

    // Default to general template
    return this.promptTemplates.general;
  }

  /**
   * Validate prompt input data
   * 
   * @param {Object} inputData - Input data for prompt generation
   * @returns {Object} Validation result
   */
  validatePromptInput(inputData) {
    const validationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check required fields
    if (!inputData.taskId) {
      validationResult.errors.push('taskId is required');
      validationResult.valid = false;
    }

    if (!inputData.errorMessage) {
      validationResult.errors.push('errorMessage is required');
      validationResult.valid = false;
    }

    // Check field lengths
    if (inputData.taskDescription && inputData.taskDescription.length > 1000) {
      validationResult.warnings.push('taskDescription is very long (consider summarizing)');
    }

    if (inputData.errorContext && inputData.errorContext.length > 2000) {
      validationResult.warnings.push('errorContext is very long (consider summarizing)');
    }

    this.log('info', 'Prompt input validation completed', {
      valid: validationResult.valid,
      errors: validationResult.errors.length,
      warnings: validationResult.warnings.length
    });

    return validationResult;
  }

  /**
   * Generate fix prompt using Ollama
   * 
   * @param {Object} params - Prompt generation parameters
   * @param {string} params.taskId - Task ID
   * @param {string} params.taskTitle - Task title
   * @param {string} params.taskDescription - Task description
   * @param {string} params.errorType - Error type
   * @param {string} params.errorMessage - Error message
   * @param {string} params.errorContext - Error context
   * @param {string} params.logAnalysis - Log analysis (optional)
   * @param {string} params.expectedOutput - Expected output (optional)
   * @param {string} params.actualOutput - Actual output (optional)
   * @returns {Promise<Object>} Fix prompt result
   */
  async generateFixPrompt(params) {
    try {
      const startTime = Date.now();

      // Validate input
      const validation = this.validatePromptInput(params);
      if (!validation.valid) {
        throw new FixPromptError(`Invalid prompt input: ${validation.errors.join(', ')}`);
      }

      // Select appropriate template
      const template = this.selectPromptTemplate(params.errorType, params);

      // Prepare template data
      const templateData = {
        taskId: params.taskId,
        taskTitle: params.taskTitle || 'Untitled Task',
        taskDescription: params.taskDescription || 'No description provided',
        errorType: params.errorType || 'unknown',
        errorMessage: params.errorMessage,
        errorContext: params.errorContext || 'No additional context',
        logAnalysis: params.logAnalysis || 'No log analysis available',
        expectedOutput: params.expectedOutput || 'Not specified',
        actualOutput: params.actualOutput || 'Not specified'
      };

      // Fill template
      let prompt = template.template;
      for (const [key, value] of Object.entries(templateData)) {
        prompt = prompt.replace(new RegExp(`\{${key}\}`, 'g'), value);
      }

      // Check prompt length
      if (prompt.length > this.maxPromptLength) {
        this.log('warn', 'Prompt exceeds maximum length, truncating', {
          originalLength: prompt.length,
          maxLength: this.maxPromptLength
        });
        prompt = prompt.substring(0, this.maxPromptLength);
      }

      // Check if Ollama is available
      const ollamaAvailable = await this.checkOllamaAvailability();

      if (ollamaAvailable) {
        // Use Ollama to generate the fix prompt
        const result = await this.ollamaClient.draftFixPrompt({
          failureDescription: params.errorMessage,
          context: `Task: ${params.taskTitle}\n\n${params.errorContext}`,
          model: 'llama3',
          options: {
            temperature: 0.1
          }
        });

        const duration = Date.now() - startTime;

        this.log('info', 'Fix prompt generated with Ollama', {
          taskId: params.taskId,
          template: template.name,
          promptLength: prompt.length,
          duration
        });

        return {
          success: true,
          method: 'ollama',
          taskId: params.taskId,
          template: template.name,
          prompt: prompt,
          generatedFix: result.response,
          statistics: {
            duration,
            tokens: result.evalCount,
            promptLength: prompt.length
          },
          timestamp: new Date().toISOString()
        };
      } else {
        // Fallback to using the generated prompt directly
        const duration = Date.now() - startTime;

        this.log('info', 'Fix prompt generated with fallback (Ollama unavailable)', {
          taskId: params.taskId,
          template: template.name,
          promptLength: prompt.length,
          duration
        });

        return {
          success: true,
          method: 'fallback',
          taskId: params.taskId,
          template: template.name,
          prompt: prompt,
          generatedFix: 'Ollama unavailable - using generated prompt directly',
          statistics: {
            duration,
            promptLength: prompt.length
          },
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      this.log('error', 'Failed to generate fix prompt', {
        taskId: params.taskId,
        error: error.message
      });
      throw new FixPromptError(`Failed to generate fix prompt: ${error.message}`, error);
    }
  }

  /**
   * Generate fix prompt with log analysis
   * 
   * @param {Object} params - Prompt generation parameters
   * @param {string} params.taskId - Task ID
   * @param {string} params.logPath - Path to execution log
   * @param {Object} failureInfo - Failure information
   * @returns {Promise<Object>} Fix prompt with log analysis
   */
  async generateFixPromptWithLogAnalysis(params, failureInfo) {
    try {
      // First analyze the log
      const logAnalysis = await this.logSummarizer.summarizeLog(params.logPath);

      // Extract key information from log analysis
      const rootCauses = logAnalysis.rootCauses || [];
      const suggestions = logAnalysis.suggestions || [];

      // Prepare enhanced failure information
      const enhancedFailureInfo = {
        ...failureInfo,
        logAnalysis: `Log Analysis Summary:\n` +
          `- Root causes: ${rootCauses.length}\n` +
          `- Suggestions: ${suggestions.length}\n` +
          `- Key findings: ${logAnalysis.summary || 'None'}`,
        errorContext: failureInfo.errorContext + `
\nLog Analysis:\n${logAnalysis.analysis}`
      };

      // Generate the fix prompt
      return this.generateFixPrompt(enhancedFailureInfo);
    } catch (error) {
      this.log('error', 'Failed to generate fix prompt with log analysis', {
        taskId: params.taskId,
        error: error.message
      });
      throw new FixPromptError(`Failed to generate fix prompt with log analysis: ${error.message}`, error);
    }
  }

  /**
   * Validate generated fix prompt
   * 
   * @param {Object} fixPromptResult - Generated fix prompt result
   * @returns {Object} Validation result
   */
  validateFixPrompt(fixPromptResult) {
    const validationResult = {
      valid: true,
      qualityScore: 0,
      issues: [],
      suggestions: []
    };

    // Check if prompt was generated
    if (!fixPromptResult || !fixPromptResult.prompt) {
      validationResult.valid = false;
      validationResult.issues.push('No fix prompt generated');
      return validationResult;
    }

    // Calculate quality score (0-100)
    let score = 80; // Base score

    // Check prompt length
    const promptLength = fixPromptResult.prompt.length;
    if (promptLength < 100) {
      validationResult.issues.push('Prompt is too short');
      score -= 20;
    } else if (promptLength > 2000) {
      validationResult.suggestions.push('Prompt is quite long (consider summarizing)');
      score -= 5;
    }

    // Check for specific requirements
    const lowerPrompt = fixPromptResult.prompt.toLowerCase();
    const hasProblemStatement = lowerPrompt.includes('problem') || lowerPrompt.includes('issue');
    const hasSolutionApproach = lowerPrompt.includes('fix') || lowerPrompt.includes('solution') || 
                               lowerPrompt.includes('resolve') || lowerPrompt.includes('address');
    const hasTesting = lowerPrompt.includes('test') || lowerPrompt.includes('verify') || 
                      lowerPrompt.includes('validation');
    const hasAcceptanceCriteria = lowerPrompt.includes('acceptance') || lowerPrompt.includes('criteria') ||
                                 lowerPrompt.includes('success');

    if (!hasProblemStatement) {
      validationResult.issues.push('Missing clear problem statement');
      score -= 15;
    }

    if (!hasSolutionApproach) {
      validationResult.issues.push('Missing solution approach');
      score -= 15;
    }

    if (!hasTesting) {
      validationResult.suggestions.push('Consider adding testing requirements');
      score -= 5;
    }

    if (!hasAcceptanceCriteria) {
      validationResult.suggestions.push('Consider adding acceptance criteria');
      score -= 5;
    }

    // Ensure score is within bounds
    validationResult.qualityScore = Math.max(0, Math.min(100, score));
    validationResult.valid = validationResult.issues.length === 0;

    this.log('info', 'Fix prompt validation completed', {
      valid: validationResult.valid,
      qualityScore: validationResult.qualityScore,
      issues: validationResult.issues.length,
      suggestions: validationResult.suggestions.length
    });

    return validationResult;
  }

  /**
   * Get available prompt templates
   * 
   * @returns {Array} Available prompt templates
   */
  getAvailableTemplates() {
    return Object.values(this.promptTemplates).map(template => ({
      id: template.name.toLowerCase().replace(/\s+/g, '_'),
      name: template.name,
      description: template.description,
      usage: template.name
    }));
  }

  /**
   * Get prompt template by name
   * 
   * @param {string} templateName - Template name
   * @returns {Object|null} Template or null if not found
   */
  getPromptTemplate(templateName) {
    const lowerTemplateName = templateName.toLowerCase();
    for (const [key, template] of Object.entries(this.promptTemplates)) {
      if (key.toLowerCase() === lowerTemplateName || template.name.toLowerCase() === lowerTemplateName) {
        return template;
      }
    }
    return null;
  }

  /**
   * Add custom prompt template
   * 
   * @param {string} templateId - Template ID
   * @param {Object} template - Template object
   */
  addPromptTemplate(templateId, template) {
    this.promptTemplates[templateId] = template;
    this.log('info', 'Added custom prompt template', { templateId });
  }

  /**
   * Reset drafter state
   */
  reset() {
    this.log('info', 'Fix prompt drafter reset');
  }
}

module.exports = {
  FixPromptDrafter,
  FixPromptError
};