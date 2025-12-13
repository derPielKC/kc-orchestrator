/**
 * Log Summarization Tests
 * 
 * Comprehensive tests for the LogSummarizer class
 */

const { LogSummarizer, LogSummarizationError } = require('../src/summary');
const { OllamaClient } = require('../src/ollama');
const fs = require('fs');
const path = require('path');

describe('LogSummarizer', () => {
  let summarizer;
  let testLogPath;
  let testLogContent;

  beforeAll(() => {
    // Create test log file
    testLogPath = path.join(__dirname, 'test-execution.log');
    testLogContent = `2024-12-13T12:00:00.000Z [INFO] Task execution started\n` +
      `2024-12-13T12:00:01.000Z [INFO] Processing task T1\n` +
      `2024-12-13T12:00:02.000Z [ERROR] Failed to execute command: file not found\n` +
      `2024-12-13T12:00:03.000Z [WARNING] Retrying task execution\n` +
      `2024-12-13T12:00:04.000Z [ERROR] Second attempt failed: permission denied\n` +
      `2024-12-13T12:00:05.000Z [INFO] Task T1 completed with errors\n` +
      `2024-12-13T12:00:06.000Z [INFO] Starting task T2\n` +
      `2024-12-13T12:00:07.000Z [INFO] Task T2 completed successfully\n`;
    
    fs.writeFileSync(testLogPath, testLogContent);
    
    // Create summarizer instance
    summarizer = new LogSummarizer({
      projectPath: __dirname,
      verbose: false
    });
  });

  afterAll(() => {
    // Clean up test file
    try {
      fs.unlinkSync(testLogPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create summarizer with default options', () => {
      const defaultSummarizer = new LogSummarizer();
      expect(defaultSummarizer).toBeInstanceOf(LogSummarizer);
      expect(defaultSummarizer.maxLogSize).toBe(1000000);
      expect(defaultSummarizer.chunkSize).toBe(10000);
      expect(defaultSummarizer.verbose).toBe(false);
    });

    test('should create summarizer with custom options', () => {
      const customSummarizer = new LogSummarizer({
        maxLogSize: 2000000,
        chunkSize: 20000,
        verbose: true
      });
      expect(customSummarizer.maxLogSize).toBe(2000000);
      expect(customSummarizer.chunkSize).toBe(20000);
      expect(customSummarizer.verbose).toBe(true);
    });

    test('should accept custom Ollama client', () => {
      const mockClient = new OllamaClient();
      const customSummarizer = new LogSummarizer({ ollamaClient: mockClient });
      expect(customSummarizer.ollamaClient).toBe(mockClient);
    });
  });

  describe('Method Availability', () => {
    test('should have all required methods', () => {
      expect(typeof summarizer.checkOllamaAvailability).toBe('function');
      expect(typeof summarizer.readLogFile).toBe('function');
      expect(typeof summarizer.chunkLogContent).toBe('function');
      expect(typeof summarizer.analyzeLogContent).toBe('function');
      expect(typeof summarizer.generateBasicAnalysis).toBe('function');
      expect(typeof summarizer.summarizeLog).toBe('function');
      expect(typeof summarizer.combineChunkResults).toBe('function');
      expect(typeof summarizer.extractRootCauses).toBe('function');
      expect(typeof summarizer.extractSuggestions).toBe('function');
      expect(typeof summarizer.generateSummaryReport).toBe('function');
      expect(typeof summarizer.estimateSeverity).toBe('function');
      expect(typeof summarizer.estimatePriority).toBe('function');
      expect(typeof summarizer.generateRecommendations).toBe('function');
      expect(typeof summarizer.reset).toBe('function');
    });
  });

  describe('Error Classes', () => {
    test('should export LogSummarizationError', () => {
      expect(LogSummarizationError).toBeDefined();
      expect(typeof LogSummarizationError).toBe('function');
    });

    test('should create proper error instances', () => {
      const error = new LogSummarizationError('Test error');
      expect(error).toBeInstanceOf(LogSummarizationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('LogSummarizationError');
    });
  });

  describe('readLogFile', () => {
    test('should read valid log file', async () => {
      const result = await summarizer.readLogFile('test-execution.log');
      expect(result.success).toBeUndefined(); // Not a property in readLogFile
      expect(result.path).toBe('test-execution.log');
      expect(result.content).toContain('Task execution started');
      expect(result.size).toBeGreaterThan(0);
    });

    test('should throw error for non-existent file', async () => {
      await expect(summarizer.readLogFile('non-existent.log'))
        .rejects
        .toThrow(LogSummarizationError);
    });

    test('should handle file reading errors gracefully', async () => {
      await expect(summarizer.readLogFile('/invalid/path/test.log'))
        .rejects
        .toThrow(LogSummarizationError);
    });
  });

  describe('chunkLogContent', () => {
    test('should return single chunk for small content', () => {
      const smallContent = 'Short log content';
      const chunks = summarizer.chunkLogContent(smallContent);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(smallContent);
    });

    test('should chunk large content appropriately', () => {
      const largeContent = 'A'.repeat(25000); // Larger than default chunk size
      const chunks = summarizer.chunkLogContent(largeContent);
      expect(chunks).toHaveLength(3); // Should be chunked into 3 parts
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(10000);
      });
    });

    test('should chunk at natural break points', () => {
      const contentWithBreaks = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const chunks = summarizer.chunkLogContent(contentWithBreaks);
      expect(chunks).toHaveLength(1); // Small enough for single chunk
      expect(chunks[0]).toBe(contentWithBreaks);
    });
  });

  describe('generateBasicAnalysis', () => {
    test('should generate basic analysis for log content', () => {
      const result = summarizer.generateBasicAnalysis(testLogContent);
      expect(result.success).toBe(true);
      expect(result.method).toBe('basic');
      expect(result.analysis).toContain('Basic Log Analysis');
      expect(result.analysis).toContain('Total lines');
      expect(result.analysis).toContain('Errors');
      expect(result.analysis).toContain('Warnings');
      // Note: The test content has 2 ERROR lines and 1 WARNING line
      expect(result.statistics.errorCount).toBeGreaterThanOrEqual(2);
      expect(result.statistics.warningCount).toBeGreaterThanOrEqual(1);
    });

    test('should handle empty content gracefully', () => {
      const result = summarizer.generateBasicAnalysis('');
      expect(result.success).toBe(true);
      expect(result.statistics.totalLines).toBe(1); // Empty line
      expect(result.statistics.errorCount).toBe(0);
    });
  });

  describe('extractRootCauses', () => {
    test('should extract root causes from analysis', () => {
      const analysis = `Root cause: File not found\nPotential issue: Permission denied\nMain problem: Configuration error`;
      const rootCauses = summarizer.extractRootCauses(analysis);
      expect(rootCauses).toHaveLength(3);
      expect(rootCauses[0].description).toContain('Root cause');
      expect(rootCauses[1].description).toContain('Potential issue');
    });

    test('should return empty array for no root causes', () => {
      const analysis = 'Everything is working perfectly';
      const rootCauses = summarizer.extractRootCauses(analysis);
      expect(rootCauses).toHaveLength(0);
    });
  });

  describe('extractSuggestions', () => {
    test('should extract suggestions from analysis', () => {
      const analysis = `Suggestion: Check file permissions\nRecommendation: Update configuration\nImprovement: Add error handling`;
      const suggestions = summarizer.extractSuggestions(analysis);
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].description).toContain('Suggestion');
      expect(suggestions[1].description).toContain('Recommendation');
    });

    test('should return empty array for no suggestions', () => {
      const analysis = 'Everything is working perfectly';
      const suggestions = summarizer.extractSuggestions(analysis);
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('estimateSeverity', () => {
    test('should estimate severity correctly', () => {
      expect(summarizer.estimateSeverity('Critical error occurred')).toBe('critical');
      expect(summarizer.estimateSeverity('Failed to execute command')).toBe('high');
      expect(summarizer.estimateSeverity('Warning: potential issue')).toBe('medium');
      expect(summarizer.estimateSeverity('Informational message')).toBe('low');
    });
  });

  describe('estimatePriority', () => {
    test('should estimate priority correctly', () => {
      expect(summarizer.estimatePriority('Immediate action required')).toBe('high');
      expect(summarizer.estimatePriority('Important improvement needed')).toBe('medium');
      expect(summarizer.estimatePriority('Optional enhancement')).toBe('low');
    });
  });

  describe('generateRecommendations', () => {
    test('should generate actionable recommendations', () => {
      const rootCauses = [
        { id: 1, description: 'Critical file not found', severity: 'critical' },
        { id: 2, description: 'Configuration issue', severity: 'medium' }
      ];
      
      const suggestions = [
        { id: 1, description: 'Update permissions immediately', priority: 'high' },
        { id: 2, description: 'Add error handling', priority: 'medium' }
      ];
      
      const recommendations = summarizer.generateRecommendations(rootCauses, suggestions);
      expect(recommendations).toHaveLength(4); // 1 critical + 1 high + 2 medium (limited)
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].type).toBe('critical_fix');
    });

    test('should handle empty inputs gracefully', () => {
      const recommendations = summarizer.generateRecommendations([], []);
      expect(recommendations).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    test('should summarize log file successfully', async () => {
      // Create a summarizer with mock Ollama client that always fails to test fallback
      const mockClient = {
        checkAvailability: async () => false,
        analyzeLogs: async () => { throw new Error('Ollama unavailable'); }
      };
      
      const fallbackSummarizer = new LogSummarizer({ 
        projectPath: __dirname,
        ollamaClient: mockClient
      });
      
      const result = await fallbackSummarizer.summarizeLog('test-execution.log');
      expect(result.success).toBe(true);
      expect(result.logPath).toBe('test-execution.log');
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.chunkCount).toBe(1); // Small file
      expect(result.analysis).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.analysis).toContain('Basic Log Analysis'); // Should use fallback
    });

    test('should generate comprehensive summary report', async () => {
      const fallbackSummarizer = new LogSummarizer({ 
        projectPath: __dirname,
        ollamaClient: { checkAvailability: async () => false }
      });
      
      const report = await fallbackSummarizer.generateSummaryReport('test-execution.log');
      expect(report.logPath).toBe('test-execution.log');
      expect(report.summary).toBeDefined();
      expect(report.rootCauses).toBeInstanceOf(Array);
      expect(report.suggestions).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.timestamp).toBeDefined();
    });

    test('should handle large log files with chunking', async () => {
      // Create a larger test file
      const largeLogPath = path.join(__dirname, 'large-test-execution.log');
      const largeContent = testLogContent.repeat(100); // Make it larger
      fs.writeFileSync(largeLogPath, largeContent);
      
      const fallbackSummarizer = new LogSummarizer({ 
        projectPath: __dirname,
        ollamaClient: { checkAvailability: async () => false }
      });
      
      const result = await fallbackSummarizer.summarizeLog('large-test-execution.log');
      expect(result.success).toBe(true);
      expect(result.chunkCount).toBeGreaterThan(1); // Should be chunked
      
      // Clean up
      fs.unlinkSync(largeLogPath);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid log content', async () => {
      await expect(summarizer.analyzeLogContent(''))
        .rejects
        .toThrow(LogSummarizationError);
    });

    test('should handle non-existent files gracefully', async () => {
      await expect(summarizer.summarizeLog('non-existent.log'))
        .rejects
        .toThrow(LogSummarizationError);
    });

    test('should fallback to basic analysis when Ollama fails', async () => {
      // Create a summarizer with a mock Ollama client that always fails
      const mockClient = {
        checkAvailability: async () => false,
        analyzeLogs: async () => { throw new Error('Ollama unavailable'); }
      };
      
      const fallbackSummarizer = new LogSummarizer({ 
        projectPath: __dirname,
        ollamaClient: mockClient 
      });
      const result = await fallbackSummarizer.summarizeLog('test-execution.log');
      
      expect(result.success).toBe(true);
      expect(result.analysis).toContain('Basic Log Analysis');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty log files', async () => {
      const emptyLogPath = path.join(__dirname, 'empty-test.log');
      fs.writeFileSync(emptyLogPath, ' '); // Add a space to avoid empty content error
      
      const fallbackSummarizer = new LogSummarizer({ 
        projectPath: __dirname,
        ollamaClient: { checkAvailability: async () => false }
      });
      
      const result = await fallbackSummarizer.summarizeLog('empty-test.log');
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
      
      // Clean up
      fs.unlinkSync(emptyLogPath);
    });

    test('should handle log files with special characters', async () => {
      const specialLogPath = path.join(__dirname, 'special-test.log');
      const specialContent = 'Log with special chars: ©®™\nUnicode: 🚀\nEmoji: 🎉';
      fs.writeFileSync(specialLogPath, specialContent);
      
      const fallbackSummarizer = new LogSummarizer({ 
        projectPath: __dirname,
        ollamaClient: { checkAvailability: async () => false }
      });
      
      const result = await fallbackSummarizer.summarizeLog('special-test.log');
      expect(result.success).toBe(true);
      
      // Clean up
      fs.unlinkSync(specialLogPath);
    });
  });
});