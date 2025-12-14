const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Import native implementation
const NativeAgentLightningIntegration = require('../agent-lightning/integration');

/**
 * Agent Lightning Integration - Handles communication with Agent Lightning
 *
 * This class provides functionality to invoke Agent Lightning with telemetry data
 * and parse its recommendations for continuous improvement.
 * Supports both native JavaScript implementation and external CLI calls.
 */
class AgentLightningIntegration {
  /**
   * Constructor for AgentLightningIntegration
   *
   * @param {object} options - Configuration options
   * @param {string} options.agentLightningCli - Path to Agent Lightning CLI
   * @param {boolean} options.verbose - Enable verbose logging
   * @param {string} options.mode - Mode: 'native', 'external', or 'hybrid'
   */
  constructor(options = {}) {
    this.agentLightningCli = options.agentLightningCli || process.env.AGENT_LIGHTNING_CLI || 'agl';
    this.verbose = options.verbose || false;
    this.baseDir = path.join(process.cwd(), '.kc-orchestrator', 'agent-lightning');
    
    // Initialize native integration
    this.nativeIntegration = new NativeAgentLightningIntegration({
      mode: options.mode || 'native',
      verbose: this.verbose
    });
    
    // Ensure base directory exists
    this._ensureBaseDirectory();
    
    if (this.verbose) {
      console.log(`🔧 AgentLightningIntegration initialized in ${this.nativeIntegration.getCurrentMode()} mode`);
    }
  }
  
  /**
   * Ensure base directory exists
   */
  _ensureBaseDirectory() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
        if (this.verbose) {
          console.log(`📁 Created Agent Lightning directory: ${this.baseDir}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to create Agent Lightning directory: ${error.message}`);
    }
  }
  
  /**
   * Invoke Agent Lightning with telemetry data
   *
   * @param {string} summaryReport - Markdown summary report
   * @param {Array} runData - Array of run data objects
   * @param {object} options - Additional options
   * @returns {object} Agent Lightning response
   */
  async invokeAgentLightning(summaryReport, runData, options = {}) {
    const startTime = Date.now();
    
    try {
      // Use native implementation by default
      const result = await this.nativeIntegration.invokeAgentLightning(summaryReport, runData, options);
      
      // Add compatibility layer for existing code
      const compatibleResult = this._convertToLegacyFormat(result);
      
      if (this.verbose) {
        console.log(`✅ Agent Lightning (native) completed in ${Date.now() - startTime}ms`);
        console.log(`   Patterns: ${result.patterns.length}`);
        console.log(`   Pain Points: ${result.painPoints.length}`);
        console.log(`   Recommendations: ${result.recommendations.length}`);
      }
      
      return compatibleResult;
      
    } catch (error) {
      console.error(`❌ Agent Lightning invocation failed: ${error.message}`);
      
      // Fallback to external implementation if native fails and fallback is enabled
      if (this.nativeIntegration.getConfiguration().fallback.enabled) {
        console.warn('⚠️  Falling back to external Agent Lightning implementation');
        return this._invokeExternalAgentLightning(summaryReport, runData, options);
      }
      
      return {
        success: false,
        error: error.message,
        recommendations: []
      };
    }
  }

  /**
   * Invoke external Agent Lightning (fallback method)
   * This is the original implementation using CLI calls
   *
   * @param {string} summaryReport - Markdown summary report
   * @param {Array} runData - Array of run data objects
   * @param {object} options - Additional options
   * @returns {object} Agent Lightning response
   */
  async _invokeExternalAgentLightning(summaryReport, runData, options = {}) {
    const { projectName = 'kc-orchestrator', outputFormat = 'markdown' } = options;
    
    // Prepare input files
    const inputDir = path.join(this.baseDir, 'input', Date.now().toString());
    fs.mkdirSync(inputDir, { recursive: true });
    
    const summaryPath = path.join(inputDir, 'summary.md');
    const runsPath = path.join(inputDir, 'runs.json');
    
    try {
      // Write summary report
      fs.writeFileSync(summaryPath, summaryReport, 'utf8');
      
      // Write runs data
      fs.writeFileSync(runsPath, JSON.stringify(runData, null, 2), 'utf8');
      
      if (this.verbose) {
        console.log(`📄 Prepared input files for external Agent Lightning`);
        console.log(`   Summary: ${summaryPath}`);
        console.log(`   Runs: ${runsPath}`);
      }
      
      // Build Agent Lightning command
      const outputDir = path.join(this.baseDir, 'output', Date.now().toString());
      fs.mkdirSync(outputDir, { recursive: true });
      
      const command = this._buildAgentLightningCommand(summaryPath, runsPath, outputDir, projectName, outputFormat);
      
      if (this.verbose) {
        console.log(`🚀 Executing external Agent Lightning command:`);
        console.log(`   ${command}`);
      }
      
      // Execute command
      const response = this._executeCommand(command);
      
      // Parse response
      const result = this._parseAgentLightningResponse(response, outputDir);
      
      if (this.verbose) {
        console.log(`✅ External Agent Lightning completed successfully`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ External Agent Lightning invocation failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        recommendations: []
      };
    }
  }

  /**
   * Convert native result to legacy format for backward compatibility
   *
   * @param {object} nativeResult - Native result format
   * @returns {object} Legacy format result
   */
  _convertToLegacyFormat(nativeResult) {
    // Native result already contains recommendations, so we just need to ensure
    // the structure matches what existing code expects
    return {
      success: true,
      recommendations: nativeResult.recommendations,
      patterns: nativeResult.patterns,
      painPoints: nativeResult.painPoints,
      statistics: nativeResult.statistics,
      metadata: nativeResult.metadata,
      performance: nativeResult.performance,
      // Add legacy fields if needed
      ...(nativeResult.legacyData || {})
    };
  }
  }
  
  /**
   * Build Agent Lightning command
   *
   * @param {string} summaryPath - Path to summary file
   * @param {string} runsPath - Path to runs data file
   * @param {string} outputDir - Output directory
   * @param {string} projectName - Project name
   * @param {string} outputFormat - Output format
   * @returns {string} Command string
   */
  _buildAgentLightningCommand(summaryPath, runsPath, outputDir, projectName, outputFormat) {
    // Default command using AGL CLI
    let command = `${this.agentLightningCli} analyze `;
    command += `--input-summary "${summaryPath}" `;
    command += `--input-runs "${runsPath}" `;
    command += `--output-dir "${outputDir}" `;
    command += `--project "${projectName}" `;
    command += `--format ${outputFormat}`;
    
    return command;
  }
  
  /**
   * Execute command and return output
   *
   * @param {string} command - Command to execute
   * @returns {string} Command output
   */
  _executeCommand(command) {
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      return output;
    } catch (error) {
      console.error(`❌ Command execution failed: ${error.message}`);
      if (error.stdout) console.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) console.error(`STDERR: ${error.stderr}`);
      throw new Error(`Agent Lightning command failed: ${error.message}`);
    }
  }
  
  /**
   * Parse Agent Lightning response
   *
   * @param {string} response - Raw response from Agent Lightning
   * @param {string} outputDir - Output directory
   * @returns {object} Parsed response
   */
  _parseAgentLightningResponse(response, outputDir) {
    try {
      // Try to parse as JSON first
      try {
        const jsonResponse = JSON.parse(response);
        return this._normalizeResponse(jsonResponse);
      } catch (jsonError) {
        // If not JSON, try to read from output files
        const outputFiles = fs.readdirSync(outputDir);
        
        // Look for common output file patterns
        const resultFile = outputFiles.find(file => 
          file.includes('result') || file.includes('output') || file.includes('recommendations')
        );
        
        if (resultFile) {
          const resultPath = path.join(outputDir, resultFile);
          const resultContent = fs.readFileSync(resultPath, 'utf8');
          
          // Try to parse as JSON
          try {
            const jsonResult = JSON.parse(resultContent);
            return this._normalizeResponse(jsonResult);
          } catch (parseError) {
            // Parse as markdown
            return this._parseMarkdownResponse(resultContent);
          }
        } else {
          // Parse response as markdown
          return this._parseMarkdownResponse(response);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to parse Agent Lightning response: ${error.message}`);
      return {
        success: false,
        error: `Failed to parse response: ${error.message}`,
        recommendations: []
      };
    }
  }
  
  /**
   * Normalize Agent Lightning response to standard format
   *
   * @param {object} response - Raw response object
   * @returns {object} Normalized response
   */
  _normalizeResponse(response) {
    // Handle different response formats from Agent Lightning
    if (response.recommendations) {
      return {
        success: true,
        recommendations: response.recommendations.map(rec => this._normalizeRecommendation(rec)),
        metadata: response.metadata || {}
      };
    } else if (response.improvements) {
      return {
        success: true,
        recommendations: response.improvements.map(rec => this._normalizeRecommendation(rec)),
        metadata: response.metadata || {}
      };
    } else if (Array.isArray(response)) {
      return {
        success: true,
        recommendations: response.map(rec => this._normalizeRecommendation(rec)),
        metadata: {}
      };
    } else {
      return {
        success: true,
        recommendations: [this._normalizeRecommendation(response)],
        metadata: {}
      };
    }
  }
  
  /**
   * Normalize a single recommendation
   *
   * @param {object} recommendation - Raw recommendation
   * @returns {object} Normalized recommendation
   */
  _normalizeRecommendation(recommendation) {
    if (typeof recommendation === 'string') {
      return {
        id: this._generateRecommendationId(recommendation),
        title: recommendation,
        description: recommendation,
        priority: 'medium',
        category: 'general'
      };
    }
    
    // Generate ID if needed
    let id = recommendation.id;
    if (!id) {
      const titleOrDesc = recommendation.title || recommendation.description || 'Untitled Recommendation';
      id = this._generateRecommendationId(titleOrDesc);
    }
    
    return {
      id: id,
      title: recommendation.title || recommendation.description || 'Untitled Recommendation',
      description: recommendation.description || recommendation.title || 'No description provided',
      priority: recommendation.priority || recommendation.severity || 'medium',
      category: recommendation.category || recommendation.type || 'general',
      impact: recommendation.impact || 'medium',
      implementation: recommendation.implementation || recommendation.solution || '',
      metadata: recommendation.metadata || {}
    };
  }
  
  /**
   * Generate recommendation ID from title
   *
   * @param {string} title - Recommendation title
   * @returns {string} Generated ID
   */
  _generateRecommendationId(title) {
    return `AGL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  }
  
  /**
   * Parse markdown response from Agent Lightning
   *
   * @param {string} markdown - Markdown content
   * @returns {object} Parsed response
   */
  _parseMarkdownResponse(markdown) {
    const recommendations = [];
    const lines = markdown.split('\n');
    
    let currentRecommendation = null;
    let inRecommendation = false;
    
    lines.forEach((line, index) => {
      // Look for recommendation headers
      const headerMatch = line.match(/^##\s+Recommendation\s+(\d+):\s*(.+)/i);
      if (headerMatch) {
        if (currentRecommendation) {
          recommendations.push(currentRecommendation);
        }
        
        currentRecommendation = {
          id: `AGL-${Date.now()}-${headerMatch[1].padStart(3, '0')}`,
          title: headerMatch[2].trim(),
          description: '',
          priority: 'medium',
          category: 'general'
        };
        inRecommendation = true;
      } else if (inRecommendation) {
        // Look for priority
        const priorityMatch = line.match(/^-\s*Priority:\s*(high|medium|low)/i);
        if (priorityMatch) {
          currentRecommendation.priority = priorityMatch[1].toLowerCase();
        }
        
        // Look for category
        const categoryMatch = line.match(/^-\s*Category:\s*(.+)/i);
        if (categoryMatch) {
          currentRecommendation.category = categoryMatch[1].trim();
        }
        
        // Look for description
        if (line.startsWith('- ') && !line.match(/priority|category/i)) {
          if (currentRecommendation.description) {
            currentRecommendation.description += ' ' + line.substring(2).trim();
          } else {
            currentRecommendation.description = line.substring(2).trim();
          }
        }
        
        // Look for next header or end of file (end of recommendation)
        if ((line.trim() === '' && index < lines.length - 1 && lines[index + 1].match(/^##\s+Recommendation\s+\d+:/i)) || 
            (index === lines.length - 1 && currentRecommendation)) {
          recommendations.push(currentRecommendation);
          currentRecommendation = null;
          inRecommendation = false;
        }
      }
    });
    
    // Add last recommendation if exists
    if (currentRecommendation) {
      recommendations.push(currentRecommendation);
    }
    
    return {
      success: true,
      recommendations: recommendations,
      metadata: {
        source: 'markdown',
        parsedFrom: 'markdown'
      }
    };
  }
  
  /**
   * Check if Agent Lightning is available
   *
   * @returns {boolean} True if Agent Lightning is available
   */
  checkAgentLightningAvailable() {
    try {
      // Try to get version info
      const command = `${this.agentLightningCli} --version`;
      execSync(command, { stdio: 'pipe' });
      return true;
    } catch (error) {
      console.warn(`⚠️  Agent Lightning not found at ${this.agentLightningCli}`);
      return false;
    }
  }
  
  /**
   * Get Agent Lightning version
   *
   * @returns {string|null} Version string or null
   */
  getAgentLightningVersion() {
    try {
      const command = `${this.agentLightningCli} --version`;
      const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      return output.trim();
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Validate Agent Lightning configuration
   *
   * @returns {object} Validation result
   */
  validateConfiguration() {
    const available = this.checkAgentLightningAvailable();
    const version = available ? this.getAgentLightningVersion() : null;
    
    return {
      available: available,
      version: version,
      cliPath: this.agentLightningCli,
      baseDir: this.baseDir,
      issues: available ? [] : [`Agent Lightning CLI not found at ${this.agentLightningCli}`]
    };
  }
}

module.exports = { AgentLightningIntegration };