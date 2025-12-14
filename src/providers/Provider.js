const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Base class for all CLI-based AI providers
 */
class Provider {
  /**
   * Constructor for provider
   * 
   * @param {object} options - Provider options
   * @param {string} options.name - Provider name
   * @param {string} options.cliCommand - CLI command to execute
   * @param {object} options.defaultParams - Default parameters
   */
  constructor(options = {}) {
    this.name = options.name || 'BaseProvider';
    this.cliCommand = options.cliCommand || (this.name ? this.name.toLowerCase() : 'provider');
    this.defaultParams = options.defaultParams || {};
    this.timeout = options.timeout || 30000; // 30 seconds default timeout
    this.maxRetries = options.maxRetries || 3;
  }
  
  /**
   * Generates a prompt for task execution
   * 
   * @param {object} task - Task object from IMPLEMENTATION_GUIDE.json
   * @param {object} context - Additional context
   * @returns {Promise<string>} Generated prompt
   */
  async generatePrompt(task, context = {}) {
    throw new Error('generatePrompt must be implemented by subclass');
  }
  
  /**
   * Executes the provider CLI with given input
   * 
   * @param {string} prompt - Prompt to send to provider
   * @param {object} options - Execution options
   * @param {number} options.timeout - Timeout in ms
   * @param {object} options.env - Environment variables
   * @param {string} options.cwd - Working directory
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} Execution result
   */
  async executeCLI(prompt, options = {}) {
    const timeout = options.timeout || this.timeout;
    const env = options.env || process.env;
    const cwd = options.cwd || process.cwd();
    
    return new Promise((resolve, reject) => {
      // Create a temporary file for the prompt
      const tempFile = path.join(cwd, `.kc-orchestrator_prompt_${Date.now()}.txt`);
      
      try {
        // Write prompt to temporary file
        fs.writeFileSync(tempFile, prompt, 'utf8');
        
        // Build command - provider-specific implementation
        const command = this.buildCommand(tempFile, options);
        
        if (options.verbose || this.verbose) {
          console.log(`🔧 Executing provider: ${this.name}`);
          console.log(`   Command: ${command.substring(0, 150)}${command.length > 150 ? '...' : ''}`);
        }
        
        // Execute command with timeout
        const child = exec(command, { env, cwd, timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
          // Clean up temp file
          try {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          } catch (cleanupError) {
            console.warn(`Failed to clean up temp file ${tempFile}: ${cleanupError.message}`);
          }
          
          if (error) {
            const result = {
              stdout: stdout || '',
              stderr: stderr || '',
              exitCode: error.code || -1,
              timedOut: error.killed
            };
            
            if (error.code === 124 || error.killed) {
              reject(new ProviderTimeoutError(`Provider ${this.name} timed out after ${timeout}ms`));
            } else {
              reject(new ProviderExecutionError(`Provider ${this.name} failed`, result));
            }
          } else {
            resolve({
              stdout: stdout || '',
              stderr: stderr || '',
              exitCode: 0
            });
          }
        });
        
        // Handle timeout separately
        const timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          try {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          } catch (cleanupError) {
            console.warn(`Failed to clean up temp file ${tempFile}: ${cleanupError.message}`);
          }
          reject(new ProviderTimeoutError(`Provider ${this.name} timed out after ${timeout}ms`));
        }, timeout);
        
        // Clean up timeout on process exit
        child.on('exit', () => {
          clearTimeout(timeoutId);
        });
        
      } catch (error) {
        // Clean up temp file on error
        try {
          fs.unlinkSync(tempFile);
        } catch (cleanupError) {
          console.warn(`Failed to clean up temp file ${tempFile}: ${cleanupError.message}`);
        }
        reject(error);
      }
    });
  }
  
  /**
   * Builds the CLI command to execute
   * 
   * @param {string} promptFile - Path to prompt file
   * @param {object} options - Execution options
   * @returns {string} Complete command string
   */
  buildCommand(promptFile, options = {}) {
    // Base command with prompt file
    let command = `${this.cliCommand} --prompt-file "${promptFile}"`;
    
    // Add default parameters
    for (const [key, value] of Object.entries(this.defaultParams)) {
      if (value !== undefined && value !== null) {
        command += ` --${key} "${value}"`;
      }
    }
    
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
   * Parses the output from provider execution
   * 
   * @param {object} result - Execution result
   * @param {string} result.stdout - Standard output
   * @param {string} result.stderr - Standard error
   * @param {number} result.exitCode - Exit code
   * @returns {Promise<object>} Parsed output
   */
  async parseOutput(result) {
    throw new Error('parseOutput must be implemented by subclass');
  }
  
  /**
   * Checks if the provider is available and healthy
   * 
   * @returns {Promise<boolean>} True if provider is healthy
   */
  async checkHealth() {
    try {
      // Try to execute version command if available
      const versionCommand = `${this.cliCommand} --version`;
      
      const result = await new Promise((resolve, reject) => {
        exec(versionCommand, { timeout: 5000 }, (error, stdout, stderr) => {
          if (error) {
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true, version: stdout.trim() });
          }
        });
      });
      
      return result.success;
    } catch (error) {
      console.warn(`Health check failed for ${this.name}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Executes a complete task using the provider
   * 
   * @param {object} task - Task to execute
   * @param {object} context - Execution context
   * @returns {Promise<object>} Task execution result
   */
  async executeTask(task, context = {}) {
    try {
      // Generate prompt
      const prompt = await this.generatePrompt(task, context);
      
      if (context.verbose || this.verbose) {
        console.log(`📝 Generated prompt (${prompt.length} chars) for task ${task.id}`);
      }
      
      // Execute CLI
      const executionResult = await this.executeCLI(prompt, {
        timeout: this.timeout,
        verbose: context.verbose || this.verbose,
        ...context
      });
      
      if (context.verbose || this.verbose) {
        console.log(`✅ Provider ${this.name} execution completed`);
        console.log(`   Output length: ${executionResult.stdout.length} chars`);
      }
      
      // Parse output
      const parsedOutput = await this.parseOutput(executionResult, context);
      
      // Return complete result
      return {
        success: executionResult.exitCode === 0 && parsedOutput.success !== false,
        prompt,
        executionResult,
        parsedOutput,
        output: parsedOutput.changes.length > 0 ? parsedOutput.changes[0].content : parsedOutput.raw,
        provider: this.name
      };
    } catch (error) {
      if (context.verbose || this.verbose) {
        console.error(`❌ Provider ${this.name} execution failed: ${error.message}`);
      }
      throw error; // Re-throw to let ProviderManager handle fallback
    }
  }
}

/**
 * Custom error for provider timeouts
 */
class ProviderTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderTimeoutError';
  }
}

/**
 * Custom error for provider execution failures
 */
class ProviderExecutionError extends Error {
  constructor(message, result) {
    super(message);
    this.name = 'ProviderExecutionError';
    this.result = result;
  }
}

module.exports = {
  Provider,
  ProviderTimeoutError,
  ProviderExecutionError
};