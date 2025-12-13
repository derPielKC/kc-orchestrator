/**
 * Log Summarization System
 * 
 * This module provides comprehensive log analysis and summarization capabilities
 * using Ollama for AI-assisted root cause analysis and improvement suggestions.
 */

const fs = require('fs');
const path = require('path');
const { OllamaClient } = require('./ollama');
const { LogSummarizationError } = require('./errors');

/**
 * Log Summarizer
 * 
 * Analyzes execution logs and generates actionable summaries using Ollama.
 */
class LogSummarizer {
  /**
   * Create a new LogSummarizer instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.projectPath - Project directory path
   * @param {OllamaClient} options.ollamaClient - Ollama client instance
   * @param {number} options.maxLogSize - Maximum log size to process in bytes
   * @param {number} options.chunkSize - Chunk size for large logs
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.ollamaClient = options.ollamaClient || new OllamaClient();
    this.maxLogSize = options.maxLogSize || 1000000; // 1MB default
    this.chunkSize = options.chunkSize || 10000; // 10KB chunks
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
        `[${timestamp}] [LogSummarizer] [${level.toUpperCase()}] ${message}`,
        data
      );
    }
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
   * Read and validate log file
   * 
   * @param {string} logPath - Path to log file
   * @returns {Promise<Object>} Log file information
   */
  async readLogFile(logPath) {
    try {
      const fullPath = path.resolve(this.projectPath, logPath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new LogSummarizationError(`Log file not found: ${logPath}`);
      }

      // Get file stats
      const stats = fs.statSync(fullPath);
      
      // Check file size
      if (stats.size > this.maxLogSize) {
        throw new LogSummarizationError(
          `Log file too large (${stats.size} bytes, max ${this.maxLogSize} bytes): ${logPath}`
        );
      }

      // Read file content
      const content = fs.readFileSync(fullPath, 'utf8');
      
      this.log('info', `Read log file successfully`, {
        path: logPath,
        size: stats.size,
        lines: content.split('\n').length
      });
      
      return {
        path: logPath,
        fullPath,
        size: stats.size,
        content,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', `Failed to read log file: ${logPath}`, { error: error.message });
      throw new LogSummarizationError(`Failed to read log file: ${error.message}`, error);
    }
  }

  /**
   * Chunk large log content for processing
   * 
   * @param {string} content - Log content
   * @returns {Array} Array of content chunks
   */
  chunkLogContent(content) {
    if (content.length <= this.chunkSize) {
      return [content];
    }

    const chunks = [];
    let start = 0;
    
    while (start < content.length) {
      let end = start + this.chunkSize;
      
      // Try to find a natural break point (newline)
      const lastNewline = content.lastIndexOf('\n', end);
      if (lastNewline > start) {
        end = lastNewline;
      }
      
      chunks.push(content.substring(start, end));
      start = end;
    }
    
    this.log('info', `Chunked log content`, {
      originalSize: content.length,
      chunks: chunks.length,
      chunkSize: this.chunkSize
    });
    
    return chunks;
  }

  /**
   * Analyze log content using Ollama
   * 
   * @param {string} logContent - Log content to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeLogContent(logContent, options = {}) {
    try {
      if (!logContent || typeof logContent !== 'string') {
        throw new LogSummarizationError('Log content must be a non-empty string');
      }

      // Check if Ollama is available
      const ollamaAvailable = await this.checkOllamaAvailability();
      
      if (!ollamaAvailable) {
        this.log('warn', 'Ollama not available, returning basic analysis');
        return this.generateBasicAnalysis(logContent);
      }

      // Use Ollama to analyze the log
      const result = await this.ollamaClient.analyzeLogs({
        logData: logContent,
        model: options.model || this.ollamaClient.defaultModel,
        options: {
          temperature: options.temperature || 0.2,
          ...options.ollamaOptions
        }
      });

      this.log('info', 'Log analysis completed with Ollama', {
        model: result.model,
        responseLength: result.response.length
      });
      
      return {
        success: true,
        method: 'ollama',
        analysis: result.response,
        model: result.model,
        statistics: {
          duration: result.totalDuration,
          tokens: result.evalCount
        }
      };
    } catch (error) {
      this.log('error', 'Failed to analyze log content with Ollama', { error: error.message });
      
      // Fallback to basic analysis if Ollama fails
      if (error.name === 'OllamaClientError') {
        return this.generateBasicAnalysis(logContent);
      }
      
      throw new LogSummarizationError(`Failed to analyze log content: ${error.message}`, error);
    }
  }

  /**
   * Generate basic analysis without Ollama
   * 
   * @param {string} logContent - Log content
   * @returns {Object} Basic analysis result
   */
  generateBasicAnalysis(logContent) {
    try {
      // Basic analysis using simple text processing
      const lines = logContent.split('\n');
      const errorLines = lines.filter(line => line.includes('ERROR') || line.includes('error'));
      const warningLines = lines.filter(line => line.includes('WARNING') || line.includes('warning'));
      
      const summary = {
        totalLines: lines.length,
        errorCount: errorLines.length,
        warningCount: warningLines.length,
        successCount: lines.length - errorLines.length - warningLines.length,
        firstError: errorLines.length > 0 ? errorLines[0] : null,
        lastError: errorLines.length > 0 ? errorLines[errorLines.length - 1] : null
      };

      const basicAnalysis = `Basic Log Analysis:\n\n` +
        `Total lines: ${summary.totalLines}\n` +
        `Errors: ${summary.errorCount}\n` +
        `Warnings: ${summary.warningCount}\n` +
        `Success rate: ${Math.round((summary.successCount / summary.totalLines) * 100)}%\n`;

      if (summary.errorCount > 0) {
        summary.potentialIssues = [`Found ${summary.errorCount} errors in the log`];
        if (summary.firstError) {
          summary.potentialIssues.push(`First error: ${summary.firstError.substring(0, 100)}...`);
        }
      }

      this.log('info', 'Generated basic log analysis', summary);
      
      return {
        success: true,
        method: 'basic',
        analysis: basicAnalysis,
        statistics: summary
      };
    } catch (error) {
      this.log('error', 'Failed to generate basic analysis', { error: error.message });
      return {
        success: false,
        method: 'basic',
        analysis: 'Failed to analyze log content',
        error: error.message
      };
    }
  }

  /**
   * Summarize execution log
   * 
   * @param {string} logPath - Path to log file
   * @param {Object} options - Summarization options
   * @returns {Promise<Object>} Summarization result
   */
  async summarizeLog(logPath, options = {}) {
    try {
      const startTime = Date.now();
      
      // Read log file
      const logFile = await this.readLogFile(logPath);
      
      // Chunk content if needed
      const chunks = this.chunkLogContent(logFile.content);
      
      // Analyze each chunk
      const chunkResults = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkResult = await this.analyzeLogContent(chunks[i], {
          model: options.model,
          temperature: options.temperature,
          ollamaOptions: options.ollamaOptions
        });
        
        chunkResults.push(chunkResult);
      }
      
      // Combine results
      const combinedAnalysis = this.combineChunkResults(chunkResults, chunks.length);
      
      const duration = Date.now() - startTime;
      
      this.log('info', 'Log summarization completed', {
        logPath,
        chunks: chunks.length,
        duration,
        method: combinedAnalysis.method
      });
      
      return {
        success: true,
        logPath,
        fileSize: logFile.size,
        chunkCount: chunks.length,
        analysis: combinedAnalysis.analysis,
        summary: combinedAnalysis.summary,
        rootCauses: combinedAnalysis.rootCauses,
        suggestions: combinedAnalysis.suggestions,
        statistics: {
          duration,
          processingTime: combinedAnalysis.statistics?.duration || duration,
          tokens: combinedAnalysis.statistics?.tokens || 0
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', `Failed to summarize log: ${logPath}`, { error: error.message });
      throw new LogSummarizationError(`Failed to summarize log: ${error.message}`, error);
    }
  }

  /**
   * Combine results from multiple chunks
   * 
   * @param {Array} chunkResults - Analysis results from chunks
   * @param {number} chunkCount - Total number of chunks
   * @returns {Object} Combined analysis result
   */
  combineChunkResults(chunkResults, chunkCount) {
    try {
      // If only one chunk, return it directly but ensure it has a summary
      if (chunkCount === 1) {
        const result = chunkResults[0];
        // Ensure basic analysis has a summary
        if (result.method === 'basic' && !result.summary) {
          result.summary = `Basic analysis summary: ${result.statistics.errorCount} errors, ${result.statistics.warningCount} warnings found`;
        }
        return result;
      }

      // For multiple chunks, combine the analysis
      const combinedAnalysis = {
        method: chunkResults[0].method,
        analysis: '',
        summary: '',
        rootCauses: [],
        suggestions: [],
        statistics: {
          duration: 0,
          tokens: 0
        }
      };

      // Combine analysis text
      chunkResults.forEach((result, index) => {
        combinedAnalysis.analysis += `=== Chunk ${index + 1} Analysis ===\n`;
        combinedAnalysis.analysis += result.analysis + '\n\n';
        
        // Extract root causes and suggestions if available
        if (result.analysis) {
          const analysisText = result.analysis.toLowerCase();
          
          // Simple extraction of root causes
          if (analysisText.includes('root cause') || analysisText.includes('potential issue')) {
            combinedAnalysis.rootCauses.push(`Chunk ${index + 1}: Potential issues identified`);
          }
          
          // Simple extraction of suggestions
          if (analysisText.includes('suggestion') || analysisText.includes('recommendation')) {
            combinedAnalysis.suggestions.push(`Chunk ${index + 1}: Improvements suggested`);
          }
        }
        
        // Sum statistics
        if (result.statistics) {
          combinedAnalysis.statistics.duration += result.statistics.duration || 0;
          combinedAnalysis.statistics.tokens += result.statistics.tokens || 0;
        }
      });

      // Generate overall summary
      combinedAnalysis.summary = 
        `Multi-chunk log analysis (${chunkCount} chunks):\n\n` +
        `${combinedAnalysis.rootCauses.length} potential root causes identified\n` +
        `${combinedAnalysis.suggestions.length} improvement suggestions provided\n` +
        `Total processing time: ${combinedAnalysis.statistics.duration}ms\n`;

      this.log('info', 'Combined chunk results successfully', {
        chunks: chunkCount,
        rootCauses: combinedAnalysis.rootCauses.length,
        suggestions: combinedAnalysis.suggestions.length
      });
      
      return combinedAnalysis;
    } catch (error) {
      this.log('error', 'Failed to combine chunk results', { error: error.message });
      throw new LogSummarizationError(`Failed to combine chunk results: ${error.message}`, error);
    }
  }

  /**
   * Extract root causes from analysis
   * 
   * @param {string} analysis - Analysis text
   * @returns {Array} Extracted root causes
   */
  extractRootCauses(analysis) {
    try {
      const rootCauses = [];
      const lines = analysis.split('\n');
      
      lines.forEach((line, index) => {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('root cause') || 
            lowerLine.includes('potential issue') ||
            lowerLine.includes('main problem') ||
            lowerLine.includes('critical error')) {
          
          rootCauses.push({
            id: index + 1,
            description: line.trim(),
            context: this.getContextLines(lines, index)
          });
        }
      });
      
      this.log('info', 'Extracted root causes from analysis', {
        count: rootCauses.length
      });
      
      return rootCauses;
    } catch (error) {
      this.log('error', 'Failed to extract root causes', { error: error.message });
      return [];
    }
  }

  /**
   * Extract suggestions from analysis
   * 
   * @param {string} analysis - Analysis text
   * @returns {Array} Extracted suggestions
   */
  extractSuggestions(analysis) {
    try {
      const suggestions = [];
      const lines = analysis.split('\n');
      
      lines.forEach((line, index) => {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('suggestion') || 
            lowerLine.includes('recommendation') ||
            lowerLine.includes('improvement') ||
            lowerLine.includes('fix') ||
            lowerLine.includes('solution')) {
          
          suggestions.push({
            id: index + 1,
            description: line.trim(),
            context: this.getContextLines(lines, index)
          });
        }
      });
      
      this.log('info', 'Extracted suggestions from analysis', {
        count: suggestions.length
      });
      
      return suggestions;
    } catch (error) {
      this.log('error', 'Failed to extract suggestions', { error: error.message });
      return [];
    }
  }

  /**
   * Get context lines around a specific line
   * 
   * @param {Array} lines - All lines
   * @param {number} index - Current line index
   * @param {number} contextSize - Number of context lines
   * @returns {string} Context text
   */
  getContextLines(lines, index, contextSize = 2) {
    const start = Math.max(0, index - contextSize);
    const end = Math.min(lines.length - 1, index + contextSize);
    
    return lines.slice(start, end + 1)
      .map((line, i) => `${start + i + 1}: ${line}`)
      .join('\n');
  }

  /**
   * Generate comprehensive log summary report
   * 
   * @param {string} logPath - Path to log file
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Comprehensive summary report
   */
  async generateSummaryReport(logPath, options = {}) {
    try {
      const summarization = await this.summarizeLog(logPath, options);
      
      // Extract structured information
      const rootCauses = this.extractRootCauses(summarization.analysis);
      const suggestions = this.extractSuggestions(summarization.analysis);
      
      // Generate report
      const report = {
        logPath,
        fileSize: summarization.fileSize,
        chunkCount: summarization.chunkCount,
        analysisMethod: summarization.statistics.method || 'unknown',
        processingTime: summarization.statistics.processingTime,
        
        summary: {
          overall: summarization.analysis.substring(0, 500) + '...',
          statistics: summarization.statistics
        },
        
        rootCauses: rootCauses.map(cause => ({
          id: cause.id,
          description: cause.description,
          severity: this.estimateSeverity(cause.description)
        })),
        
        suggestions: suggestions.map(suggestion => ({
          id: suggestion.id,
          description: suggestion.description,
          priority: this.estimatePriority(suggestion.description)
        })),
        
        recommendations: this.generateRecommendations(rootCauses, suggestions),
        timestamp: new Date().toISOString()
      };
      
      this.log('info', 'Generated comprehensive summary report', {
        logPath,
        rootCauses: report.rootCauses.length,
        suggestions: report.suggestions.length,
        recommendations: report.recommendations.length
      });
      
      return report;
    } catch (error) {
      this.log('error', 'Failed to generate summary report', { error: error.message });
      throw new LogSummarizationError(`Failed to generate summary report: ${error.message}`, error);
    }
  }

  /**
   * Estimate severity of a root cause
   * 
   * @param {string} description - Root cause description
   * @returns {string} Severity level (critical, high, medium, low)
   */
  estimateSeverity(description) {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('critical') || lowerDesc.includes('fatal') || lowerDesc.includes('crash')) {
      return 'critical';
    } else if (lowerDesc.includes('error') || lowerDesc.includes('failed') || lowerDesc.includes('major')) {
      return 'high';
    } else if (lowerDesc.includes('warning') || lowerDesc.includes('issue') || lowerDesc.includes('problem')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Estimate priority of a suggestion
   * 
   * @param {string} description - Suggestion description
   * @returns {string} Priority level (high, medium, low)
   */
  estimatePriority(description) {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('immediate') || lowerDesc.includes('urgent') || lowerDesc.includes('critical')) {
      return 'high';
    } else if (lowerDesc.includes('important') || lowerDesc.includes('should') || lowerDesc.includes('recommended')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Generate actionable recommendations
   * 
   * @param {Array} rootCauses - Extracted root causes
   * @param {Array} suggestions - Extracted suggestions
   * @returns {Array} Actionable recommendations
   */
  generateRecommendations(rootCauses, suggestions) {
    const recommendations = [];
    
    // Prioritize critical root causes
    const criticalCauses = rootCauses.filter(cause => cause.severity === 'critical');
    criticalCauses.forEach(cause => {
      recommendations.push({
        id: `REC-${recommendations.length + 1}`,
        type: 'critical_fix',
        description: `CRITICAL: Address ${cause.description}`,
        priority: 'high',
        relatedCauseId: cause.id
      });
    });
    
    // Add high priority suggestions
    const highSuggestions = suggestions.filter(suggestion => suggestion.priority === 'high');
    highSuggestions.forEach(suggestion => {
      recommendations.push({
        id: `REC-${recommendations.length + 1}`,
        type: 'high_priority',
        description: `HIGH PRIORITY: ${suggestion.description}`,
        priority: 'high',
        relatedSuggestionId: suggestion.id
      });
    });
    
    // Add medium priority items
    const mediumItems = [...rootCauses, ...suggestions]
      .filter(item => item.severity === 'medium' || item.priority === 'medium')
      .slice(0, 3); // Limit to top 3 medium items
    
    mediumItems.forEach(item => {
      recommendations.push({
        id: `REC-${recommendations.length + 1}`,
        type: 'medium_priority',
        description: `MEDIUM PRIORITY: ${item.description}`,
        priority: 'medium',
        relatedItemId: item.id
      });
    });
    
    this.log('info', 'Generated actionable recommendations', {
      count: recommendations.length,
      critical: criticalCauses.length,
      highPriority: highSuggestions.length,
      mediumPriority: mediumItems.length
    });
    
    return recommendations;
  }

  /**
   * Reset summarizer state
   */
  reset() {
    // Clear any cached data
    this.log('info', 'Log summarizer reset');
  }
}

module.exports = {
  LogSummarizer,
  LogSummarizationError
};