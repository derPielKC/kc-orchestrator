const { Provider } = require('./Provider');

/**
 * Codex CLI provider implementation
 * 
 * This provider wraps the Codex CLI tool for executing AI-powered code generation tasks.
 */
class CodexProvider extends Provider {
  
  /**
   * Constructor for CodexProvider
   */
  constructor(options = {}) {
    super({
      name: 'Codex',
      cliCommand: 'codex',
      defaultParams: {
        model: 'code-davinci-002',
        temperature: 0.2,
        max_tokens: 2048,
        stop: ['\n', ';'],
        ...options.defaultParams
      },
      timeout: options.timeout || 60000, // 60 seconds for Codex
      maxRetries: options.maxRetries || 2,
      ...options
    });
  }
  
  /**
   * Generates a prompt for Codex task execution
   * 
   * @param {object} task - Task object from IMPLEMENTATION_GUIDE.json
   * @param {object} context - Additional context
   * @returns {Promise<string>} Generated prompt
   */
  async generatePrompt(task, context = {}) {
    // Build prompt with task context and requirements
    const promptParts = [];
    
    // Add task header
    promptParts.push(`# Task: ${task.id} - ${task.title}`);
    promptParts.push(`# Description: ${task.description}`);
    
    // Add acceptance criteria
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      promptParts.push('# Acceptance Criteria:');
      task.acceptanceCriteria.forEach((criteria, index) => {
        promptParts.push(`  ${index + 1}. ${criteria}`);
      });
    }
    
    // Add constraints
    if (task.constraints) {
      if (task.constraints.do && task.constraints.do.length > 0) {
        promptParts.push('# DO:');
        task.constraints.do.forEach(item => {
          promptParts.push(`  - ${item}`);
        });
      }
      
      if (task.constraints.dont && task.constraints.dont.length > 0) {
        promptParts.push('# DON\'T:');
        task.constraints.dont.forEach(item => {
          promptParts.push(`  - ${item}`);
        });
      }
    }
    
    // Add outputs section
    if (task.outputs && task.outputs.length > 0) {
      promptParts.push('# Expected Outputs:');
      task.outputs.forEach(output => {
        promptParts.push(`  - ${output}`);
      });
    }
    
    // Add check steps
    if (task.checkSteps && task.checkSteps.length > 0) {
      promptParts.push('# Verification Commands:');
      task.checkSteps.forEach(step => {
        promptParts.push(`  - ${step}`);
      });
    }
    
    // Add context information
    if (context.project) {
      promptParts.push(`# Context: Project ${context.project}`);
    }
    
    // Add execution instruction
    promptParts.push('\n# Implementation Instructions:');
    promptParts.push('1. Analyze the task requirements above');
    promptParts.push('2. Generate the complete implementation code');
    promptParts.push('3. Ensure all acceptance criteria are met');
    promptParts.push('4. Follow all DO/DON\'T constraints');
    promptParts.push('5. Return only the implementation code, no explanations');
    
    // Add code block marker
    promptParts.push('\n```');
    
    return promptParts.join('\n');
  }
  
  /**
   * Parses the output from Codex CLI execution
   * 
   * @param {object} result - Execution result
   * @param {string} result.stdout - Standard output
   * @param {string} result.stderr - Standard error
   * @param {number} result.exitCode - Exit code
   * @param {object} context - Additional context (optional)
   * @returns {Promise<object>} Parsed output
   */
  async parseOutput(result, context = {}) {
    const output = {
      raw: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      success: result.exitCode === 0,
      changes: [],
      logs: []
    };
    
    // Parse Codex output format
    try {
      // Codex typically outputs code directly, but may include markers
      const lines = result.stdout.split('\n');
      let codeBlock = [];
      let inCodeBlock = false;
      
      for (const line of lines) {
        if (line.trim() === '```') {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        
        if (inCodeBlock) {
          codeBlock.push(line);
        } else if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
          // Skip comment lines
          continue;
        } else if (line.trim()) {
          // Other non-code lines are treated as logs
          output.logs.push(line.trim());
        }
      }
      
      // If we found a code block, use it as the main change
      if (codeBlock.length > 0) {
        output.changes.push({
          type: 'code',
          content: codeBlock.join('\n'),
          file: context.file || 'implementation.js'
        });
      } else if (result.stdout.trim()) {
        // If no code block, use entire output as code
        output.changes.push({
          type: 'code',
          content: result.stdout.trim(),
          file: context.file || 'implementation.js'
        });
      }
      
    } catch (error) {
      console.warn(`Failed to parse Codex output: ${error.message}`);
      output.error = output.error ? `${output.error}\n${error.message}` : error.message;
    }
    
    return output;
  }
  
  /**
   * Checks if Codex CLI is available and healthy
   * 
   * @returns {Promise<boolean>} True if Codex is healthy
   */
  async checkHealth() {
    try {
      // Check if codex command is available
      const healthCheck = await super.checkHealth();
      
      if (!healthCheck) {
        console.warn('Codex CLI command not found or not working');
        return false;
      }
      
      // Additional check for Codex-specific functionality
      // Try to get model list if available
      try {
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
          exec('codex --list-models', { timeout: 10000 }, (error, stdout, stderr) => {
            if (error) {
              // This is optional, so don't fail if models command doesn't work
              resolve(true);
            } else {
              console.log(`Codex models available: ${stdout.trim()}`);
              resolve(true);
            }
          });
        });
      } catch (modelError) {
        // Models command not available, but basic health check passed
      }
      
      return true;
    } catch (error) {
      console.warn(`Codex health check failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = { CodexProvider };