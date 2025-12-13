/**
 * Ollama Client Integration
 * 
 * This module provides comprehensive integration with Ollama for AI-assisted operations
 * including log summarization, prompt drafting, and outcome judging.
 */

const axios = require('axios');
const { OllamaClientError, OllamaRequestError, OllamaResponseError } = require('./errors');

/**
 * Ollama Client
 * 
 * Handles communication with Ollama API for various AI-assisted operations.
 */
class OllamaClient {
  /**
   * Create a new OllamaClient instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - Ollama API base URL
   * @param {string} options.defaultModel - Default model to use
   * @param {number} options.timeout - Request timeout in ms
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.defaultModel = options.defaultModel || 'llama3';
    this.timeout = options.timeout || 30000; // 30 seconds
    this.verbose = options.verbose || false;
    
    // Initialize HTTP client
    this.client = options.httpClient || axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
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
        `[${timestamp}] [OllamaClient] [${level.toUpperCase()}] ${message}`,
        data
      );
    }
  }

  /**
   * Check if Ollama API is available
   * 
   * @returns {Promise<boolean>} True if Ollama is available
   */
  async checkAvailability() {
    try {
      const response = await this.client.get('/api/tags', {
        timeout: 5000 // Shorter timeout for health check
      });
      
      this.log('info', 'Ollama API is available', {
        models: response.data.models ? response.data.models.length : 0
      });
      
      return true;
    } catch (error) {
      this.log('error', 'Ollama API unavailable', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate text completion using Ollama
   * 
   * @param {Object} params - Request parameters
   * @param {string} params.prompt - Input prompt
   * @param {string} params.model - Model to use
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Completion result
   */
  async generateCompletion(params) {
    const { prompt, model = this.defaultModel, options = {} } = params;
    
    if (!prompt || typeof prompt !== 'string') {
      throw new OllamaRequestError('Prompt must be a non-empty string');
    }

    try {
      this.log('info', 'Generating completion', {
        model,
        promptLength: prompt.length
      });

      const response = await this.client.post('/api/generate', {
        model,
        prompt,
        stream: false,
        ...options
      });

      if (!response.data || !response.data.response) {
        throw new OllamaResponseError('Invalid response from Ollama API', response.data);
      }

      this.log('info', 'Completion generated successfully', {
        model,
        responseLength: response.data.response.length
      });

      return {
        success: true,
        model,
        prompt,
        response: response.data.response,
        context: response.data.context,
        totalDuration: response.data.total_duration,
        loadDuration: response.data.load_duration,
        promptEvalCount: response.data.prompt_eval_count,
        promptEvalDuration: response.data.prompt_eval_duration,
        evalCount: response.data.eval_count,
        evalDuration: response.data.eval_duration
      };
    } catch (error) {
      this.log('error', 'Failed to generate completion', {
        error: error.message
      });
      
      if (error.response) {
        throw new OllamaResponseError('Ollama API error', error.response.data, error);
      } else if (error.request) {
        throw new OllamaRequestError('Ollama request failed', error);
      } else {
        throw new OllamaClientError('Ollama client error', error);
      }
    }
  }

  /**
   * Generate chat completion using Ollama
   * 
   * @param {Object} params - Request parameters
   * @param {Array} params.messages - Chat messages
   * @param {string} params.model - Model to use
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Chat completion result
   */
  async generateChatCompletion(params) {
    const { messages, model = this.defaultModel, options = {} } = params;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new OllamaRequestError('Messages must be a non-empty array');
    }

    try {
      this.log('info', 'Generating chat completion', {
        model,
        messageCount: messages.length
      });

      const response = await this.client.post('/api/chat', {
        model,
        messages,
        stream: false,
        ...options
      });

      if (!response.data || !response.data.message) {
        throw new OllamaResponseError('Invalid chat response from Ollama API', response.data);
      }

      this.log('info', 'Chat completion generated successfully', {
        model,
        responseLength: response.data.message.content.length
      });

      return {
        success: true,
        model,
        messages,
        response: response.data.message.content,
        role: response.data.message.role,
        totalDuration: response.data.total_duration,
        loadDuration: response.data.load_duration,
        promptEvalCount: response.data.prompt_eval_count,
        promptEvalDuration: response.data.prompt_eval_duration,
        evalCount: response.data.eval_count,
        evalDuration: response.data.eval_duration
      };
    } catch (error) {
      this.log('error', 'Failed to generate chat completion', {
        error: error.message
      });
      
      if (error.response) {
        throw new OllamaResponseError('Ollama chat API error', error.response.data, error);
      } else if (error.request) {
        throw new OllamaRequestError('Ollama chat request failed', error);
      } else {
        throw new OllamaClientError('Ollama chat client error', error);
      }
    }
  }

  /**
   * Summarize text using Ollama
   * 
   * @param {Object} params - Summarization parameters
   * @param {string} params.text - Text to summarize
   * @param {string} params.model - Model to use
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Summarization result
   */
  async summarizeText(params) {
    const { text, model = this.defaultModel, options = {} } = params;
    
    if (!text || typeof text !== 'string') {
      throw new OllamaRequestError('Text must be a non-empty string');
    }

    const prompt = `Please provide a concise summary of the following text:

${text}

Summary:`;

    return this.generateCompletion({
      prompt,
      model,
      options: {
        temperature: 0.3,
        ...options
      }
    });
  }

  /**
   * Analyze log data and extract root causes using Ollama
   * 
   * @param {Object} params - Analysis parameters
   * @param {string} params.logData - Log data to analyze
   * @param {string} params.model - Model to use
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeLogs(params) {
    const { logData, model = this.defaultModel, options = {} } = params;
    
    if (!logData || typeof logData !== 'string') {
      throw new OllamaRequestError('Log data must be a non-empty string');
    }

    const prompt = `Analyze the following execution logs and identify potential root causes of any issues:

${logData}

Please provide:
1. Summary of the execution
2. Any errors or warnings encountered
3. Potential root causes
4. Suggested fixes or improvements

Analysis:`;

    return this.generateCompletion({
      prompt,
      model,
      options: {
        temperature: 0.2,
        ...options
      }
    });
  }

  /**
   * Draft a fix prompt based on failure analysis
   * 
   * @param {Object} params - Drafting parameters
   * @param {string} params.failureDescription - Description of the failure
   * @param {string} params.context - Additional context
   * @param {string} params.model - Model to use
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Drafting result
   */
  async draftFixPrompt(params) {
    const { failureDescription, context = '', model = this.defaultModel, options = {} } = params;
    
    if (!failureDescription || typeof failureDescription !== 'string') {
      throw new OllamaRequestError('Failure description must be a non-empty string');
    }

    const prompt = `Based on the following failure description and context, draft a comprehensive fix prompt:

Failure Description:
${failureDescription}

Context:
${context}

Please provide a detailed fix prompt that includes:
1. Clear problem statement
2. Technical requirements
3. Implementation guidelines
4. Testing requirements
5. Acceptance criteria

Fix Prompt:`;

    return this.generateCompletion({
      prompt,
      model,
      options: {
        temperature: 0.1,
        ...options
      }
    });
  }

  /**
   * Judge task outcome using Ollama
   * 
   * @param {Object} params - Judging parameters
   * @param {string} params.taskDescription - Task description
   * @param {string} params.executionResult - Execution result
   * @param {string} params.acceptanceCriteria - Acceptance criteria
   * @param {string} params.model - Model to use
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Judging result
   */
  async judgeOutcome(params) {
    const { taskDescription, executionResult, acceptanceCriteria, model = this.defaultModel, options = {} } = params;
    
    if (!taskDescription || typeof taskDescription !== 'string') {
      throw new OllamaRequestError('Task description must be a non-empty string');
    }

    if (!executionResult || typeof executionResult !== 'string') {
      throw new OllamaRequestError('Execution result must be a non-empty string');
    }

    if (!acceptanceCriteria || typeof acceptanceCriteria !== 'string') {
      throw new OllamaRequestError('Acceptance criteria must be a non-empty string');
    }

    const prompt = `Evaluate the following task execution against the acceptance criteria:

Task Description:
${taskDescription}

Acceptance Criteria:
${acceptanceCriteria}

Execution Result:
${executionResult}

Please provide:
1. Overall assessment (PASS/FAIL)
2. Detailed evaluation against each acceptance criterion
3. Confidence score (0-100%)
4. Recommendations for improvement if needed

Judgment:`;

    return this.generateCompletion({
      prompt,
      model,
      options: {
        temperature: 0.0,
        ...options
      }
    });
  }

  /**
   * Select appropriate provider based on task requirements
   * 
   * @param {Object} params - Selection parameters
   * @param {string} params.taskDescription - Task description
   * @param {Array} params.availableProviders - Available providers
   * @param {string} params.model - Model to use
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Selection result
   */
  async selectProvider(params) {
    const { taskDescription, availableProviders, model = this.defaultModel, options = {} } = params;
    
    if (!taskDescription || typeof taskDescription !== 'string') {
      throw new OllamaRequestError('Task description must be a non-empty string');
    }

    if (!availableProviders || !Array.isArray(availableProviders) || availableProviders.length === 0) {
      throw new OllamaRequestError('Available providers must be a non-empty array');
    }

    const providersList = availableProviders.join(', ');
    const prompt = `Based on the following task description, select the most appropriate provider from the available options:

Task Description:
${taskDescription}

Available Providers:
${providersList}

Please provide:
1. Recommended provider
2. Reasoning for the selection
3. Alternative options if the recommended provider fails
4. Any specific configuration recommendations

Provider Selection:`;

    return this.generateCompletion({
      prompt,
      model,
      options: {
        temperature: 0.0,
        ...options
      }
    });
  }

  /**
   * Get available models from Ollama
   * 
   * @returns {Promise<Array>} Array of available models
   */
  async getAvailableModels() {
    try {
      const response = await this.client.get('/api/tags', {
        timeout: 10000
      });

      if (!response.data || !response.data.models) {
        return [];
      }

      return response.data.models.map(model => model.name);
    } catch (error) {
      this.log('error', 'Failed to get available models', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get model information
   * 
   * @param {string} modelName - Model name
   * @returns {Promise<Object>} Model information
   */
  async getModelInfo(modelName) {
    try {
      const response = await this.client.post('/api/show', {
        name: modelName
      });

      return response.data || {};
    } catch (error) {
      this.log('error', `Failed to get model info for ${modelName}`, {
        error: error.message
      });
      return {};
    }
  }
}

module.exports = {
  OllamaClient,
  OllamaClientError,
  OllamaRequestError,
  OllamaResponseError
};