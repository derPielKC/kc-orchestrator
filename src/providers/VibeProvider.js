const { Provider } = require('./Provider');

/**
 * Vibe CLI provider implementation
 * 
 * This provider wraps the Vibe CLI tool for executing AI-powered tasks with tool/function calling support.
 */
class VibeProvider extends Provider {
  
  /**
   * Constructor for VibeProvider
   */
  constructor(options = {}) {
    super({
      name: 'Vibe',
      cliCommand: 'vibe',
      defaultParams: {
        model: 'devstral-2',
        temperature: 0.1,
        max_tokens: 4096,
        tools: 'auto',
        ...options.defaultParams
      },
      timeout: options.timeout || 120000, // 120 seconds for Vibe
      maxRetries: options.maxRetries || 2,
      ...options
    });
  }
  
  /**
   * Generates a prompt for Vibe task execution
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
    promptParts.push('5. Return the implementation code within a code block');
    promptParts.push('6. If tool calls are needed, use the appropriate function calls');
    
    // Add code block marker
    promptParts.push('\n```');
    
    return promptParts.join('\n');
  }
  
  /**
   * Parses the output from Vibe CLI execution
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
      toolCalls: [],
      response: result.stdout
    };
    
    // Parse Vibe output format
    try {
      // Vibe can output both code and tool calls
      const lines = result.stdout.split('\n');
      let codeBlock = [];
      let inCodeBlock = false;
      let toolCallBlock = [];
      let inToolCall = false;
      let responseText = [];
      
      for (const line of lines) {
        if (line.trim() === '```') {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        
        if (line.trim().startsWith('TOOL_CALL:')) {
          inToolCall = true;
          toolCallBlock.push(line.trim());
          continue;
        }
        
        if (line.trim() === 'END_TOOL_CALL') {
          inToolCall = false;
          toolCallBlock.push(line.trim());
          continue;
        }
        
        if (inCodeBlock) {
          codeBlock.push(line);
        } else if (inToolCall) {
          toolCallBlock.push(line.trim());
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
      
      // Parse tool calls if any
      if (toolCallBlock.length > 0) {
        const toolCallText = toolCallBlock.join('\n');
        try {
          // Try to parse tool calls (simplified parsing for testing)
          const toolCalls = this._parseToolCalls(toolCallText);
          output.toolCalls = toolCalls;
        } catch (parseError) {
          console.warn(`Failed to parse tool calls: ${parseError.message}`);
          output.logs.push(`Tool call parsing failed: ${parseError.message}`);
        }
      }
      
      // Set the response text
      if (responseText.length > 0) {
        output.response = responseText.join('\n');
      }
      
    } catch (error) {
      console.warn(`Failed to parse Vibe output: ${error.message}`);
      output.error = output.error ? `${output.error}\n${error.message}` : error.message;
    }
    
    return output;
  }
  
  /**
   * Simple tool call parser for Vibe output
   * 
   * @param {string} toolCallText - Tool call text
   * @returns {Array} Parsed tool calls
   */
  _parseToolCalls(toolCallText) {
    const toolCalls = [];
    const lines = toolCallText.split('\n');
    
    let currentToolCall = null;
    
    for (const line of lines) {
      if (line.startsWith('TOOL_CALL:')) {
        // Start new tool call
        const toolName = line.replace('TOOL_CALL:', '').trim();
        currentToolCall = {
          name: toolName,
          parameters: {}
        };
        toolCalls.push(currentToolCall);
      } else if (line === 'END_TOOL_CALL') {
        // End current tool call
        currentToolCall = null;
      } else if (currentToolCall) {
        // Parse parameters (simple key: value parsing)
        const paramMatch = line.match(/^(\w+):\s*(.*)$/);
        if (paramMatch) {
          const [, key, value] = paramMatch;
          currentToolCall.parameters[key] = value;
        }
      }
    }
    
    return toolCalls;
  }
  
  /**
   * Checks if Vibe CLI is available and healthy
   * 
   * @returns {Promise<boolean>} True if Vibe is healthy
   */
  async checkHealth() {
    try {
      // Check if vibe command is available
      const healthCheck = await super.checkHealth();
      
      if (!healthCheck) {
        console.warn('Vibe CLI command not found or not working');
        return false;
      }
      
      // Additional check for Vibe-specific functionality
      try {
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
          exec('vibe --list-models', { timeout: 10000 }, (error, stdout, stderr) => {
            if (error) {
              // This is optional, so don't fail if models command doesn't work
              resolve(true);
            } else {
              console.log(`Vibe models available: ${stdout.trim()}`);
              resolve(true);
            }
          });
        });
      } catch (modelError) {
        // Models command not available, but basic health check passed
      }
      
      return true;
    } catch (error) {
      console.warn(`Vibe health check failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Builds the CLI command to execute for Vibe
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
}

module.exports = { VibeProvider };