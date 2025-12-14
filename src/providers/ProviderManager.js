const { ProviderTimeoutError, ProviderExecutionError } = require('./Provider');
const { CodexProvider } = require('./CodexProvider');
const { ClaudeProvider } = require('./ClaudeProvider');
const { VibeProvider } = require('./VibeProvider');
const { CursorAgentProvider } = require('./CursorAgentProvider');
const { OllamaClient } = require('../ollama');

/**
 * Provider Manager - Handles provider selection, fallback, and execution
 * 
 * This class implements a robust provider fallback mechanism that tries multiple
 * AI providers in sequence when failures occur, with comprehensive logging and
 * performance tracking.
 */
class ProviderManager {
  /**
   * Constructor for ProviderManager
   * 
   * @param {object} options - Configuration options
   * @param {Array} options.providerOrder - Order of providers to try
   * @param {number} options.timeout - Global timeout in ms
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.providerOrder = options.providerOrder || ['Codex', 'Claude', 'Vibe', 'CursorAgent'];
    this.timeout = options.timeout || 120000; // 120 seconds default
    this.verbose = options.verbose || false;
    this.useAIProviderSelection = options.useAIProviderSelection !== false; // Enable AI selection by default
    this.aiSelectionCache = new Map(); // Cache for AI recommendations
    this.aiSelectionCacheTTL = options.aiSelectionCacheTTL || 3600000; // 1 hour cache TTL
    this.ollamaClient = options.ollamaClient || new OllamaClient();
    this.providerInstances = {};
    this.providerStats = {};
    
    // Initialize provider instances
    this._initializeProviders();
  }
  
  /**
   * Normalize provider name to standard format
   * 
   * @param {string} name - Provider name in any format
   * @returns {string} Normalized provider name
   */
  _normalizeProviderName(name) {
    if (!name || typeof name !== 'string') return name;
    
    // Normalize common variations
    const normalized = name.toLowerCase().trim();
    
    const nameMap = {
      'codex': 'Codex',
      'claude': 'Claude',
      'vibe': 'Vibe',
      'cursor-agent': 'CursorAgent',
      'cursoragent': 'CursorAgent',
      'cursor': 'CursorAgent'
    };
    
    return nameMap[normalized] || name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  
  /**
   * Initialize provider instances based on configured order
   */
  _initializeProviders() {
    const providerMap = {
      'Codex': CodexProvider,
      'Claude': ClaudeProvider,
      'Vibe': VibeProvider,
      'CursorAgent': CursorAgentProvider
    };
    
    this.providerOrder.forEach(providerName => {
      // Normalize provider name
      const normalizedName = this._normalizeProviderName(providerName);
      
      if (providerMap[normalizedName]) {
        try {
          this.providerInstances[normalizedName] = new providerMap[normalizedName]({
            timeout: this.timeout
          });
          this.providerStats[normalizedName] = {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastUsed: null,
            lastSuccess: null,
            lastFailure: null
          };
        } catch (error) {
          console.warn(`Failed to initialize provider ${normalizedName}: ${error.message}`);
        }
      } else {
        console.warn(`Unknown provider in configuration: ${providerName} (normalized: ${normalizedName})`);
      }
    });
    
    if (this.verbose) {
      console.log(`ProviderManager initialized with ${Object.keys(this.providerInstances).length} providers:`);
      console.log(`- Order: ${this.providerOrder.join(' > ')}`);
      console.log(`- Timeout: ${this.timeout}ms`);
    }
  }
  
  /**
   * Get available providers
   * 
   * @returns {Array} List of available provider names
   */
  getAvailableProviders() {
    return Object.keys(this.providerInstances);
  }
  
  /**
   * Get provider statistics
   * 
   * @param {string} providerName - Optional provider name to get stats for
   * @returns {object} Statistics for all providers or specific provider
   */
  getProviderStats(providerName = null) {
    if (providerName) {
      return this.providerStats[providerName] || null;
    }
    return this.providerStats;
  }
  
  /**
   * Check health of all providers
   * 
   * @returns {Promise<object>} Health status of all providers
   */
  async checkAllProviderHealth() {
    const healthResults = {};
    
    for (const [providerName, provider] of Object.entries(this.providerInstances)) {
      try {
        const isHealthy = await provider.checkHealth();
        healthResults[providerName] = {
          healthy: isHealthy,
          timestamp: new Date().toISOString()
        };
        
        if (this.verbose) {
          console.log(`✅ ${providerName} health check: ${isHealthy ? 'PASS' : 'FAIL'}`);
        }
      } catch (error) {
        healthResults[providerName] = {
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        if (this.verbose) {
          console.log(`❌ ${providerName} health check failed: ${error.message}`);
        }
      }
    }
    
    return healthResults;
  }
  
  /**
   * Execute a task with provider fallback
   * 
   * @param {object} task - Task to execute
   * @param {object} context - Execution context
   * @param {number} maxRetries - Maximum number of retries per provider
   * @returns {Promise<object>} Task execution result with fallback information
   */
  async executeWithFallback(task, context = {}, maxRetries = 3) {
    const startTime = Date.now();
    const fallbackLog = [];
    let lastError = null;
    
      if (this.verbose) {
        const { normalizeTask } = require('../utils/taskExtractor');
        const normalized = normalizeTask(task);
        console.log(`\n🚀 Starting task execution with fallback strategy`);
        console.log(`   Task ID: ${normalized.id || task.id || 'unknown'}`);
        console.log(`   Task Title: ${normalized.title || task.title || task.description || 'Untitled'}`);
        console.log(`   Provider order: ${this.providerOrder.join(' > ')}`);
        console.log(`   Available providers: ${Object.keys(this.providerInstances).join(', ')}`);
      }
    
    // Try each provider in order
    for (const providerName of this.providerOrder) {
      // Normalize provider name to match instance keys
      const normalizedName = this._normalizeProviderName(providerName);
      const provider = this.providerInstances[normalizedName];
      
      if (!provider) {
        if (this.verbose) {
          console.log(`⚠️  Skipping ${providerName} (normalized: ${normalizedName}) - not available`);
        }
        continue;
      }
      
      // Update stats (use normalized name for stats)
      this.providerStats[normalizedName].attempts++;
      this.providerStats[normalizedName].lastUsed = new Date().toISOString();
      
      if (this.verbose) {
        console.log(`\n🔄 Trying provider: ${normalizedName}`);
        console.log(`   Attempt: ${this.providerStats[normalizedName].attempts}`);
        console.log(`   Previous attempts: ${this.providerStats[normalizedName].attempts - 1} success, ${this.providerStats[normalizedName].failures} failures`);
      }
      
      const providerStartTime = Date.now();
      try {
        const result = await provider.executeTask(task, {
          ...context,
          maxRetries: maxRetries,
          verbose: this.verbose
        });
        
        // Success!
        this.providerStats[normalizedName].successes++;
        this.providerStats[normalizedName].lastSuccess = new Date().toISOString();
        
        const endTime = Date.now();
        const providerDuration = endTime - providerStartTime;
        
        if (this.verbose) {
          console.log(`\n✅ ${normalizedName} succeeded!`);
          console.log(`   Duration: ${(providerDuration / 1000).toFixed(2)}s`);
          if (result.parsedOutput) {
            if (result.parsedOutput.changes && result.parsedOutput.changes.length > 0) {
              console.log(`   Changes: ${result.parsedOutput.changes.length} file(s)`);
            }
            if (result.parsedOutput.logs && result.parsedOutput.logs.length > 0) {
              console.log(`   Logs: ${result.parsedOutput.logs.length} message(s)`);
            }
          }
        }
        
        return {
          success: true,
          provider: normalizedName,
          result: result,
          fallbackLog: fallbackLog,
          executionTime: endTime - startTime,
          timestamp: new Date().toISOString()
        };
        
      } catch (error) {
        // Failure - add to fallback log and continue
        this.providerStats[normalizedName].failures++;
        this.providerStats[normalizedName].lastFailure = new Date().toISOString();
        lastError = error;
        
        const errorInfo = {
          provider: normalizedName,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        if (error instanceof ProviderTimeoutError) {
          errorInfo.type = 'timeout';
          errorInfo.details = `Timeout after ${provider.timeout}ms`;
        } else if (error instanceof ProviderExecutionError) {
          errorInfo.type = 'execution';
          errorInfo.details = error.result || {};
        } else {
          errorInfo.type = 'unknown';
        }
        
        fallbackLog.push(errorInfo);
        
        if (this.verbose) {
          const providerDuration = Date.now() - providerStartTime;
          console.log(`\n❌ ${normalizedName} failed:`);
          console.log(`   Error: ${error.message}`);
          console.log(`   Duration: ${(providerDuration / 1000).toFixed(2)}s`);
          if (error.result) {
            if (error.result.stderr) {
              console.log(`   Stderr: ${error.result.stderr.substring(0, 200)}${error.result.stderr.length > 200 ? '...' : ''}`);
            }
          }
          console.log(`🔄 Falling back to next provider...`);
        }
        
        continue;
      }
    }
    
    // If we get here, all providers failed
    const endTime = Date.now();
    
    if (this.verbose) {
      console.log(`💥 All providers failed for task ${task.id}`);
      console.log(`📋 Fallback log:`);
      fallbackLog.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.provider}: ${log.error} (${log.type})`);
      });
    }
    
    return {
      success: false,
      error: lastError ? lastError.message : 'All providers failed',
      fallbackLog: fallbackLog,
      executionTime: endTime - startTime,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Execute a task with circuit breaker pattern
   * 
   * @param {object} task - Task to execute
   * @param {object} context - Execution context
   * @param {object} circuitBreaker - Circuit breaker configuration
   * @returns {Promise<object>} Task execution result
   */
  async executeWithCircuitBreaker(task, context = {}, circuitBreaker = {}) {
    const { failureThreshold = 3, resetTimeout = 300000 } = circuitBreaker;
    
    // Check if any providers are in circuit breaker state
    const now = Date.now();
    const availableProviders = [];
    
    for (const providerName of this.providerOrder) {
      const provider = this.providerInstances[providerName];
      const stats = this.providerStats[providerName];
      
      if (!provider) continue;
      
      // Check if provider is in circuit breaker state
      if (stats.lastFailure) {
        const lastFailureTime = new Date(stats.lastFailure).getTime();
        const consecutiveFailures = stats.failures - (stats.successes > 0 ? 1 : 0);
        
        if (consecutiveFailures >= failureThreshold) {
          const timeSinceFailure = now - lastFailureTime;
          
          if (timeSinceFailure < resetTimeout) {
            if (this.verbose) {
              console.log(`🚫 ${providerName} in circuit breaker state until ${new Date(lastFailureTime + resetTimeout)}`);
            }
            continue; // Skip this provider
          } else {
            // Reset circuit breaker
            stats.failures = 0;
            if (this.verbose) {
              console.log(`🔄 ${providerName} circuit breaker reset`);
            }
          }
        }
      }
      
      availableProviders.push(providerName);
    }
    
    if (availableProviders.length === 0) {
      throw new Error('All providers in circuit breaker state');
    }
    
    // Execute with available providers - override the provider order temporarily
    const originalProviderOrder = this.providerOrder;
    this.providerOrder = availableProviders;
    
    try {
      return await this.executeWithFallback(task, context, circuitBreaker.maxRetries);
    } finally {
      // Restore original provider order
      this.providerOrder = originalProviderOrder;
    }
  }
  
  /**
   * Get the best available provider based on statistics
   * 
   * @returns {string|null} Best provider name or null if none available
   */
  getBestAvailableProvider() {
    const availableProviders = Object.keys(this.providerInstances);
    
    if (availableProviders.length === 0) {
      return null;
    }
    
    // Simple algorithm: prefer providers with highest success rate
    // and most recent success
    let bestProvider = null;
    let bestScore = -Infinity;
    
    availableProviders.forEach(providerName => {
      const stats = this.providerStats[providerName];
      
      // Calculate score based on success rate and recency
      const successRate = stats.attempts > 0 ? stats.successes / stats.attempts : 0;
      const recencyBonus = stats.lastSuccess ? 0.1 : 0;
      const score = successRate + recencyBonus;
      
      if (score > bestScore) {
        bestScore = score;
        bestProvider = providerName;
      }
    });
    
    return bestProvider;
  }
  
  /**
   * Execute a task with the best available provider
   * 
   * @param {object} task - Task to execute
   * @param {object} context - Execution context
   * @returns {Promise<object>} Task execution result
   */
  async executeWithBestProvider(task, context = {}) {
    const bestProvider = this.getBestAvailableProvider();
    
    if (!bestProvider) {
      throw new Error('No available providers');
    }
    
    if (this.verbose) {
      console.log(`🎯 Selected best provider: ${bestProvider}`);
    }
    
    const provider = this.providerInstances[bestProvider];
    
    // Update stats
    this.providerStats[bestProvider].attempts++;
    this.providerStats[bestProvider].lastUsed = new Date().toISOString();
    
    try {
      const result = await provider.executeTask(task, context);
      this.providerStats[bestProvider].successes++;
      this.providerStats[bestProvider].lastSuccess = new Date().toISOString();
      return {
        success: true,
        provider: bestProvider,
        result: result
      };
    } catch (error) {
      this.providerStats[bestProvider].failures++;
      this.providerStats[bestProvider].lastFailure = new Date().toISOString();
      throw error;
    }
  }
  
  /**
   * Reset provider statistics
   * 
   * @param {string} providerName - Optional provider name to reset
   */
  resetProviderStats(providerName = null) {
    if (providerName) {
      if (this.providerStats[providerName]) {
        this.providerStats[providerName] = {
          attempts: 0,
          successes: 0,
          failures: 0,
          lastUsed: null,
          lastSuccess: null,
          lastFailure: null
        };
      }
    } else {
      // Reset all providers
      Object.keys(this.providerStats).forEach(name => {
        this.resetProviderStats(name);
      });
    }
  }

  /**
   * Check if Ollama is available for AI provider selection
   * 
   * @returns {Promise<boolean>} True if Ollama is available
   */
  async checkOllamaAvailability() {
    try {
      return await this.ollamaClient.checkAvailability();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get AI-based provider recommendation using Ollama
   * 
   * @param {object} task - Task to execute
   * @param {Array} availableProviders - List of available providers
   * @returns {Promise<object>} AI recommendation result
   */
  async getAIProviderRecommendation(task, availableProviders) {
    try {
      // Check if AI selection is enabled
      if (!this.useAIProviderSelection) {
        return {
          success: false,
          message: 'AI provider selection is disabled'
        };
      }

      // Check if Ollama is available
      const ollamaAvailable = await this.checkOllamaAvailability();
      
      if (!ollamaAvailable) {
        return {
          success: false,
          message: 'Ollama not available for AI provider selection'
        };
      }

      // Check cache first
      const cacheKey = JSON.stringify({ taskId: task.id, providers: availableProviders.sort() });
      const cachedRecommendation = this.aiSelectionCache.get(cacheKey);
      
      if (cachedRecommendation && (Date.now() - cachedRecommendation.timestamp < this.aiSelectionCacheTTL)) {
        if (this.verbose) {
          console.log(`🤖 Using cached AI provider recommendation for task ${task.id}`);
        }
        return cachedRecommendation;
      }

      // Prepare task description for AI
      const taskDescription = task.description || task.title || `Task ${task.id}`;
      const taskContext = task.context ? `\nContext: ${task.context}` : '';
      const requirements = task.requirements ? `\nRequirements: ${task.requirements.join(', ')}` : '';

      // Use Ollama to select the best provider
      const selectionResult = await this.ollamaClient.selectProvider({
        taskDescription: `${taskDescription}${taskContext}${requirements}`,
        availableProviders,
        options: {
          temperature: 0.0 // Deterministic selection
        }
      });

      // Parse the AI recommendation
      const recommendationText = selectionResult.response;
      
      // Extract recommended provider (look for pattern like "Recommended provider: Claude")
      const providerMatch = recommendationText.match(/Recommended\s+provider:\s*(\w+)/i);
      const recommendedProvider = providerMatch ? providerMatch[1] : null;
      
      // Extract reasoning
      const reasoningMatch = recommendationText.match(/Reasoning[^:]*:\s*([\s\S]*?)(?=\n\n|\nAlternative|\n$)/i);
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided';
      
      // Extract alternative providers
      const alternativesMatch = recommendationText.match(/Alternative\s+options[^:]*:\s*([\s\S]*?)(?=\n\n|\nSpecific|\n$)/i);
      const alternatives = alternativesMatch ? alternativesMatch[1].trim() : '';
      
      // Extract specific configuration recommendations
      const configMatch = recommendationText.match(/Specific\s+configuration[^:]*:\s*([\s\S]*?)(?=\n\n|$)/i);
      const configuration = configMatch ? configMatch[1].trim() : '';

      // Create recommendation result
      const recommendation = {
        success: true,
        recommendedProvider,
        reasoning,
        alternatives: alternatives.split(',').map(a => a.trim()).filter(a => a),
        configuration,
        model: selectionResult.model,
        duration: selectionResult.totalDuration,
        timestamp: Date.now(),
        confidence: this._extractConfidenceFromText(recommendationText)
      };

      // Cache the recommendation
      this.aiSelectionCache.set(cacheKey, recommendation);
      
      if (this.verbose) {
        console.log(`🤖 AI provider recommendation for task ${task.id}: ${recommendedProvider || 'unknown'}`);
      }

      return recommendation;
    } catch (error) {
      return {
        success: false,
        message: `AI provider selection failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Extract confidence score from AI recommendation text
   * 
   * @param {string} text - Recommendation text
   * @returns {number} Confidence score (0-100)
   */
  _extractConfidenceFromText(text) {
    const confidenceMatch = text.match(/Confidence\s+score:\s*(\d+)%/i);
    return confidenceMatch ? parseInt(confidenceMatch[1], 10) : 70; // Default to 70% confidence
  }

  /**
   * Get best provider with AI assistance
   * 
   * @param {object} task - Task to execute
   * @returns {Promise<string|null>} Best provider name or null
   */
  async getBestProviderWithAI(task) {
    try {
      const availableProviders = this.getAvailableProviders();
      
      if (availableProviders.length === 0) {
        return null;
      }

      // Try AI recommendation first
      if (this.useAIProviderSelection) {
        const aiRecommendation = await this.getAIProviderRecommendation(task, availableProviders);
        
        if (aiRecommendation.success && aiRecommendation.recommendedProvider) {
          // Check if recommended provider is available
          if (availableProviders.includes(aiRecommendation.recommendedProvider)) {
            if (this.verbose) {
              console.log(`🎯 AI selected provider: ${aiRecommendation.recommendedProvider}`);
            }
            return aiRecommendation.recommendedProvider;
          }
        }
      }

      // Fallback to traditional selection if AI fails or provider not available
      return this.getBestAvailableProvider();
    } catch (error) {
      if (this.verbose) {
        console.log(`⚠️  AI provider selection failed, falling back to traditional method: ${error.message}`);
      }
      return this.getBestAvailableProvider();
    }
  }

  /**
   * Execute a task with AI-assisted provider selection
   * 
   * @param {object} task - Task to execute
   * @param {object} context - Execution context
   * @returns {Promise<object>} Task execution result
   */
  async executeWithAIAssistedProvider(task, context = {}) {
    const bestProvider = await this.getBestProviderWithAI(task);
    
    if (!bestProvider) {
      throw new Error('No available providers');
    }
     
    if (this.verbose) {
      console.log(`🎯 Selected provider: ${bestProvider}`);
    }
     
    const provider = this.providerInstances[bestProvider];
    
    // Update stats
    this.providerStats[bestProvider].attempts++;
    this.providerStats[bestProvider].lastUsed = new Date().toISOString();
    
    try {
      const result = await provider.executeTask(task, context);
      this.providerStats[bestProvider].successes++;
      this.providerStats[bestProvider].lastSuccess = new Date().toISOString();
      
      return {
        success: true,
        provider: bestProvider,
        result: result,
        aiAssisted: true
      };
    } catch (error) {
      this.providerStats[bestProvider].failures++;
      this.providerStats[bestProvider].lastFailure = new Date().toISOString();
      throw error;
    }
  }
}

module.exports = { ProviderManager };