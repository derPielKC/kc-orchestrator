/**
 * Agent Lightning Integration Layer
 * Bridges between native and external Agent Lightning implementations
 */

const NativeAgentLightning = require('./NativeAgentLightning');
const patternDetection = require('./algorithms/patternDetection');
const painPointAnalysis = require('./algorithms/painPointAnalysis');
const recommendationEngine = require('./algorithms/recommendationEngine');

class AgentLightningIntegration {
  /**
   * Create Agent Lightning Integration instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = {
      mode: 'native', // 'native', 'external', or 'hybrid'
      native: {
        enabled: true,
        ...config.native
      },
      external: {
        enabled: false,
        cliPath: process.env.AGENT_LIGHTNING_CLI || 'agl',
        ...config.external
      },
      fallback: {
        enabled: true,
        onExternalFailure: 'native', // 'native', 'fail', or 'warn'
        ...config.fallback
      },
      logging: {
        level: 'info',
        ...config.logging
      }
    };
    
    // Initialize native implementation
    this.nativeAgentLightning = new NativeAgentLightning(this.config.native);
    
    // Validate configuration
    this._validateConfiguration();
  }

  /**
   * Validate configuration
   */
  _validateConfiguration() {
    const validModes = ['native', 'external', 'hybrid'];
    if (!validModes.includes(this.config.mode)) {
      throw new Error(`Invalid mode: ${this.config.mode}. Must be one of: ${validModes.join(', ')}`);
    }

    // Ensure at least one implementation is enabled
    if (this.config.mode !== 'external' && !this.config.native.enabled) {
      console.warn('⚠️  Native implementation disabled but mode is not external');
    }

    if (this.config.mode !== 'native' && !this.config.external.enabled) {
      console.warn('⚠️  External implementation disabled but mode is not native');
    }
  }

  /**
   * Check if native mode is available
   * @returns {boolean} True if native mode is available
   */
  isNativeAvailable() {
    return this.config.native.enabled;
  }

  /**
   * Check if external mode is available
   * @returns {boolean} True if external mode is available
   */
  isExternalAvailable() {
    return this.config.external.enabled;
  }

  /**
   * Get current mode
   * @returns {string} Current mode
   */
  getCurrentMode() {
    return this.config.mode;
  }

  /**
   * Set mode
   * @param {string} mode - Mode to set ('native', 'external', or 'hybrid')
   */
  setMode(mode) {
    const validModes = ['native', 'external', 'hybrid'];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    this.config.mode = mode;
  }

  /**
   * Invoke Agent Lightning analysis
   * @param {string} summaryReport - Summary report
   * @param {Array} runData - Run data
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async invokeAgentLightning(summaryReport, runData, options = {}) {
    const startTime = Date.now();
    
    try {
      // Determine which implementation to use
      const implementation = this._determineImplementation();
      
      let result;
      
      if (implementation === 'native') {
        // Use native implementation
        result = await this._invokeNative(summaryReport, runData, options);
        result.metadata = {
          ...result.metadata,
          implementation: 'native',
          mode: this.config.mode
        };
      } else if (implementation === 'external') {
        // Use external implementation (would call original AgentLightningIntegration)
        // For now, we'll use native as fallback since we don't have the external CLI
        console.warn('⚠️  External mode not fully implemented, using native fallback');
        result = await this._invokeNative(summaryReport, runData, options);
        result.metadata = {
          ...result.metadata,
          implementation: 'native-fallback',
          mode: this.config.mode,
          warning: 'External CLI not available, used native fallback'
        };
      } else {
        // Hybrid mode - try external first, fallback to native
        try {
          // TODO: Implement actual external call
          console.warn('⚠️  Hybrid mode not fully implemented, using native');
          result = await this._invokeNative(summaryReport, runData, options);
          result.metadata = {
            ...result.metadata,
            implementation: 'native',
            mode: this.config.mode,
            warning: 'Hybrid mode not fully implemented'
          };
        } catch (externalError) {
          console.warn(`⚠️  External implementation failed, falling back to native: ${externalError.message}`);
          result = await this._invokeNative(summaryReport, runData, options);
          result.metadata = {
            ...result.metadata,
            implementation: 'native-fallback',
            mode: this.config.mode,
            externalError: externalError.message
          };
        }
      }

      // Add performance metrics
      result.performance = {
        analysisTimeMs: Date.now() - startTime,
        implementationUsed: result.metadata.implementation
      };

      return result;
      
    } catch (error) {
      console.error(`❌ Agent Lightning invocation failed: ${error.message}`);
      throw new Error(`Agent Lightning failed: ${error.message}`);
    }
  }

  /**
   * Determine which implementation to use
   * @returns {string} Implementation to use ('native', 'external', or 'hybrid')
   */
  _determineImplementation() {
    // Follow configuration mode
    if (this.config.mode === 'native') {
      return 'native';
    } else if (this.config.mode === 'external') {
      return 'external';
    } else {
      // Hybrid mode
      return 'hybrid';
    }
  }

  /**
   * Invoke native implementation
   * @param {string} summaryReport - Summary report
   * @param {Array} runData - Run data
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async _invokeNative(summaryReport, runData, options = {}) {
    // Use the native implementation with our new algorithms
    
    // Step 1: Detect patterns using native algorithms
    const patterns = patternDetection.detectPatterns(runData, {
      failureRateThreshold: options.failureRateThreshold || 10,
      retryRateThreshold: options.retryRateThreshold || 2,
      latencyThresholdMs: options.latencyThresholdMs || 5000,
      anomalyThreshold: options.anomalyThreshold || 3
    });

    // Step 2: Identify pain points
    const painPoints = painPointAnalysis.identifyPainPoints(patterns, {
      minSeverity: options.minSeverity || 'low',
      groupSimilar: true
    });

    // Step 3: Generate recommendations
    const recommendations = recommendationEngine.generateRecommendations(painPoints, {
      maxRecommendations: options.maxRecommendations || 10
    });

    // Create comprehensive result
    const result = {
      summaryReport,
      runData,
      patterns,
      painPoints,
      recommendations,
      statistics: {
        patternsDetected: patterns.length,
        painPointsIdentified: painPoints.length,
        recommendationsGenerated: recommendations.length,
        analysisTimestamp: new Date().toISOString()
      },
      metadata: {
        version: '1.0.0-native',
        timestamp: new Date().toISOString(),
        implementation: 'native'
      }
    };

    return result;
  }

  /**
   * Check health of Agent Lightning integration
   * @returns {Object} Health check result
   */
  checkHealth() {
    const nativeHealth = this.nativeAgentLightning.checkHealth();
    
    return {
      healthy: nativeHealth.healthy,
      mode: this.config.mode,
      nativeAvailable: this.isNativeAvailable(),
      externalAvailable: this.isExternalAvailable(),
      nativeHealth,
      externalHealth: this.isExternalAvailable() ? { healthy: false, message: 'Not implemented' } : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get configuration
   * @returns {Object} Current configuration
   */
  getConfiguration() {
    return {
      ...this.config,
      // Don't expose sensitive information
      external: {
        ...this.config.external,
        cliPath: '***'
      }
    };
  }

  /**
   * Prepare input files (for external mode, not used in native)
   * @param {string} summaryReport - Summary report
   * @param {Array} runData - Run data
   * @returns {Object} Prepared input files
   */
  prepareInputFiles(summaryReport, runData) {
    // This would be used for external CLI mode
    // In native mode, we don't need file I/O
    return {
      summaryReport,
      runData,
      inputType: 'memory'
    };
  }

  /**
   * Parse Agent Lightning output (for external mode)
   * @param {string} rawOutput - Raw output from CLI
   * @returns {Object} Parsed output
   */
  parseAgentLightningOutput(rawOutput) {
    // This would be used for external CLI mode
    // In native mode, we return structured data directly
    try {
      return JSON.parse(rawOutput);
    } catch (error) {
      console.error(`❌ Failed to parse Agent Lightning output: ${error.message}`);
      return {
        error: 'Failed to parse output',
        rawOutput
      };
    }
  }

  /**
   * Validate configuration for external mode
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    const result = {
      available: false,
      mode: this.config.mode,
      issues: [],
      warnings: []
    };

    // Check if external CLI is available
    if (this.config.mode !== 'native' && this.config.external.enabled) {
      try {
        // TODO: Actually check if CLI is available
        result.warnings.push('External CLI availability check not implemented');
      } catch (error) {
        result.issues.push(`External CLI check failed: ${error.message}`);
      }
    }

    // Native is always available
    if (this.config.native.enabled) {
      result.available = true;
      result.mode = 'native';
    }

    return result;
  }
}

module.exports = AgentLightningIntegration;