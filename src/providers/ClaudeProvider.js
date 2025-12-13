const { Provider } = require('./Provider');

/**
 * Claude CLI provider implementation
 * 
 * This provider wraps the Claude CLI tool for executing AI-powered tasks with conversational context.
 */
class ClaudeProvider extends Provider {
  
  /**
   * Constructor for ClaudeProvider
   */
  constructor(options = {}) {
    super({
      name: 'Claude',
      cliCommand: 'claude',
      defaultParams: {
        model: 'claude-3-opus-20240229',
        system: 'You are a helpful AI assistant that generates code and follows instructions precisely.',
        max_tokens: 4096,
        temperature: 0.3,
        ...options.defaultParams
      },
      timeout: options.timeout || 90000, // 90 seconds for Claude
      maxRetries: options.maxRetries || 2,
      ...options
    });
  }
  
  /**
   * Generates a prompt for Claude task execution
   * 
   * @param {object} task - Task object from IMPLEMENTATION_GUIDE.json
   * @param {object} context - Additional context
   * @returns {Promise<string>} Generated prompt
   */
  async generatePrompt(task, context = {}) {
    // Build prompt with task context and requirements
    const promptParts = [];
    
    // Add system message style header
    promptParts.push('Human: Please help me implement the following task:');
    promptParts.push('');
    
    // Add task header
    promptParts.push(`Task ID: ${task.id}`);
    promptParts.push(`Title: ${task.title}`);
    promptParts.push(`Description: ${task.description}`);
    
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
        promptParts.push('\nConstraints - DO:');
        task.constraints.do.forEach(item => {
          promptParts.push(`  - ${item}`);
        });
      }
      
      if (task.constraints.dont && task.constraints.dont.length > 0) {
        promptParts.push('\nConstraints - DON\'T:');
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
      promptParts.push(`\nContext: This task is part of project ${context.project}`);
    }
    
    // Add execution instruction
    promptParts.push('\nImplementation Instructions:');
    promptParts.push('1. Analyze the task requirements above carefully');
    promptParts.push('2. Generate the complete implementation code that satisfies all acceptance criteria');
    promptParts.push('3. Follow all DO/DON\'T constraints strictly');
    promptParts.push('4. Return the implementation code within a code block');
    promptParts.push('5. Include brief comments explaining key decisions if helpful');
    
    // Add assistant response marker
    promptParts.push('\nAssistant:');
    
    return promptParts.join('\n');
  }
  
  /**
   * Parses the output from Claude CLI execution
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
      logs: [],
      response: result.stdout
    };
    
    // Parse Claude output format
    try {
      // Claude typically outputs conversational responses
      const lines = result.stdout.split('\n');
      let codeBlock = [];
      let inCodeBlock = false;
      let responseText = [];
      
      for (const line of lines) {
        if (line.trim() === '```') {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        
        if (inCodeBlock) {
          codeBlock.push(line);
        } else if (line.trim()) {
          // Collect all non-code lines as response text
          responseText.push(line.trim());
        }
      }
      
      // If we found a code block, use it as the main change
      if (codeBlock.length > 0) {
        output.changes.push({
          type: 'code',
          content: codeBlock.join('\n'),
          file: context.file || 'implementation.js'
        });
      }
      
      // Set the response text
      if (responseText.length > 0) {
        output.response = responseText.join('\n');
      }
      
      // Extract any thoughts or reasoning (lines starting with specific patterns)
      const thoughtLines = responseText.filter(line => 
        line.startsWith('Thought:') || 
        line.startsWith('Reasoning:') ||
        line.startsWith('Analysis:')
      );
      
      if (thoughtLines.length > 0) {
        output.thoughts = thoughtLines;
      }
      
    } catch (error) {
      console.warn(`Failed to parse Claude output: ${error.message}`);
      output.error = output.error ? `${output.error}\n${error.message}` : error.message;
    }
    
    return output;
  }
  
  /**
   * Checks if Claude CLI is available and healthy
   * 
   * @returns {Promise<boolean>} True if Claude is healthy
   */
  async checkHealth() {
    try {
      // Check if claude command is available
      const healthCheck = await super.checkHealth();
      
      if (!healthCheck) {
        console.warn('Claude CLI command not found or not working');
        return false;
      }
      
      // Additional check for Claude-specific functionality
      try {
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
          exec('claude --list-models', { timeout: 10000 }, (error, stdout, stderr) => {
            if (error) {
              // This is optional, so don't fail if models command doesn't work
              resolve(true);
            } else {
              console.log(`Claude models available: ${stdout.trim()}`);
              resolve(true);
            }
          });
        });
      } catch (modelError) {
        // Models command not available, but basic health check passed
      }
      
      return true;
    } catch (error) {
      console.warn(`Claude health check failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Builds the CLI command to execute for Claude
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
        // Handle system prompt specially
        if (key === 'system') {
          command += ` --system-prompt "${value}"`;
        } else {
          command += ` --${key} "${value}"`;
        }
      }
    }
    
    // Add custom parameters from options
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          // Handle system prompt specially
          if (key === 'system') {
            command += ` --system-prompt "${value}"`;
          } else {
            command += ` --${key} "${value}"`;
          }
        }
      }
    }
    
    return command;
  }
}

module.exports = { ClaudeProvider };