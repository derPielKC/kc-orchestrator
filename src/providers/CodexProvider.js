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
        ...options.defaultParams
      },
      timeout: options.timeout || 300000, // 5 minutes for Codex
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
    promptParts.push(`Task: ${task.id} - ${task.title || task.description || 'Untitled Task'}`);
    
    if (task.description) {
      promptParts.push(`\nDescription:\n${task.description}`);
    }
    
    // Add acceptance criteria
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      promptParts.push('\nAcceptance Criteria:');
      task.acceptanceCriteria.forEach((criteria, index) => {
        promptParts.push(`  ${index + 1}. ${criteria}`);
      });
    }
    
    // Add constraints
    if (task.constraints) {
      if (task.constraints.do && task.constraints.do.length > 0) {
        promptParts.push('\nDO:');
        task.constraints.do.forEach(item => {
          promptParts.push(`  - ${item}`);
        });
      }
      
      if (task.constraints.dont && task.constraints.dont.length > 0) {
        promptParts.push('\nDON\'T:');
        task.constraints.dont.forEach(item => {
          promptParts.push(`  - ${item}`);
        });
      }
    }
    
    // Add outputs section
    if (task.outputs && task.outputs.length > 0) {
      promptParts.push('\nExpected Outputs:');
      task.outputs.forEach(output => {
        promptParts.push(`  - ${output}`);
      });
    }
    
    // Add check steps
    if (task.checkSteps && task.checkSteps.length > 0) {
      promptParts.push('\nVerification Commands:');
      task.checkSteps.forEach(step => {
        promptParts.push(`  - ${step}`);
      });
    }
    
    // Add context information
    if (context.project) {
      promptParts.push(`\nContext: Project ${context.project}`);
    }
    
    // Add execution instruction
    promptParts.push('\nPlease implement this task according to the requirements above.');
    
    return promptParts.join('\n');
  }
  
  /**
   * Builds the CLI command to execute Codex
   * 
   * @param {string} promptFile - Path to prompt file
   * @param {object} options - Execution options
   * @returns {string} Complete command string
   */
  buildCommand(promptFile, options = {}) {
    // Codex uses 'exec' subcommand for non-interactive execution
    // Read prompt from file and pipe to codex exec
    let command = `cat "${promptFile}" | ${this.cliCommand} exec`;
    
    // Add custom parameters from options
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          command += ` --${key} "${value}"`;
        }
      }
    }
    
    return command;
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
        if (line.trim().startsWith('```')) {
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
      // Try to execute version command
      const versionCommand = `${this.cliCommand} --version`;
      
      const result = await new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec(versionCommand, { timeout: 5000 }, (error, stdout, stderr) => {
          if (error) {
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true, version: stdout.trim() });
          }
        });
      });
      
      if (!result.success) {
        return false;
      }
      
      // Try to check if exec command is available
      try {
        const execCheck = await new Promise((resolve, reject) => {
          const { exec } = require('child_process');
          exec(`${this.cliCommand} exec --help`, { timeout: 5000 }, (error) => {
            resolve(!error);
          });
        });
        
        if (!execCheck) {
          console.warn('Codex exec command not available');
          return false;
        }
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
