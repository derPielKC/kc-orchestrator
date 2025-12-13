/**
 * Logger Tests
 *
 * Comprehensive tests for the Logger class
 */

const { Logger } = require('../src/logger');
const loggingConfig = require('../config/logging');
const fs = require('fs');
const path = require('path');

// Test setup
const testLogDirectory = path.join(__dirname, 'test-logs');
const testLogFile = path.join(testLogDirectory, 'kc-orchestrator-test-*.log');

describe('Logger', () => {
  let logger;
  let testLogger;

  beforeAll(() => {
    // Create test log directory
    if (!fs.existsSync(testLogDirectory)) {
      fs.mkdirSync(testLogDirectory, { recursive: true });
    }
  });

  beforeEach(() => {
    // Create logger instances for testing
    logger = new Logger({
      logDirectory: testLogDirectory,
      logLevel: 'debug',
      serviceName: 'test-service',
      enableFileLogging: true,
      enableConsoleLogging: false
    });

    testLogger = new Logger({
      logDirectory: testLogDirectory,
      logLevel: 'info',
      serviceName: 'test-logger',
      enableFileLogging: false,
      enableConsoleLogging: true
    });
  });

  afterEach(() => {
    // Clean up test log files
    try {
      const files = fs.readdirSync(testLogDirectory);
      files.forEach(file => {
        if (file.startsWith('test-service-') || file.startsWith('test-logger-')) {
          fs.unlinkSync(path.join(testLogDirectory, file));
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create logger with default options', () => {
      const defaultLogger = new Logger();
      
      expect(defaultLogger.logDirectory).toContain('logs');
      expect(defaultLogger.logLevel).toBe('info');
      expect(defaultLogger.serviceName).toBe('kc-orchestrator');
      expect(defaultLogger.enableFileLogging).toBe(true);
      expect(defaultLogger.enableConsoleLogging).toBe(true);
    });

    test('should create logger with custom options', () => {
      const customLogger = new Logger({
        logDirectory: '/custom/logs',
        logLevel: 'debug',
        serviceName: 'custom-service',
        enableFileLogging: false,
        enableConsoleLogging: true
      });
      
      // Logger falls back to default directory when custom directory can't be created
      expect(customLogger.logDirectory).toContain('logs');
      expect(customLogger.logLevel).toBe('debug');
      expect(customLogger.serviceName).toBe('custom-service');
      expect(customLogger.enableFileLogging).toBe(false);
      expect(customLogger.enableConsoleLogging).toBe(true);
    });

    test('should create logger instance with winston logger', () => {
      expect(logger.logger).toBeDefined();
      expect(typeof logger.logger.log).toBe('function');
      expect(typeof logger.logger.info).toBe('function');
      expect(typeof logger.logger.error).toBe('function');
    });
  });

  describe('Logging Methods', () => {
    test('should log info messages', () => {
      // Test that logging doesn't throw errors
      expect(() => {
        testLogger.info('Test info message', 'test-context');
      }).not.toThrow();
    });

    test('should log warning messages', () => {
      expect(() => {
        testLogger.warn('Test warning message', 'test-context');
      }).not.toThrow();
    });

    test('should log error messages', () => {
      expect(() => {
        testLogger.error('Test error message', 'test-context');
      }).not.toThrow();
    });

    test('should log debug messages', () => {
      expect(() => {
        testLogger.debug('Test debug message', 'test-context');
      }).not.toThrow();
    });

    test('should log verbose messages', () => {
      expect(() => {
        testLogger.verbose('Test verbose message', 'test-context');
      }).not.toThrow();
    });

    test('should log silly messages', () => {
      expect(() => {
        testLogger.silly('Test silly message', 'test-context');
      }).not.toThrow();
    });
  });

  describe('Log Level Management', () => {
    test('should get current log level', () => {
      expect(testLogger.getLogLevel()).toBe('info');
    });

    test('should set new log level', () => {
      testLogger.setLogLevel('debug');
      expect(testLogger.getLogLevel()).toBe('debug');
    });

    test('should update all transports when setting log level', () => {
      const originalLevel = testLogger.getLogLevel();
      testLogger.setLogLevel('error');
      
      testLogger.logger.transports.forEach(transport => {
        expect(transport.level).toBe('error');
      });
      
      // Restore original level
      testLogger.setLogLevel(originalLevel);
    });
  });

  describe('Configuration Management', () => {
    test('should update logger configuration', () => {
      const originalLevel = logger.getLogLevel();
      
      logger.configure({
        logLevel: 'error',
        enableFileLogging: false
      });
      
      expect(logger.getLogLevel()).toBe('error');
      expect(logger.enableFileLogging).toBe(false);
      
      // Restore original configuration
      logger.configure({
        logLevel: originalLevel,
        enableFileLogging: true
      });
    });

    test('should recreate logger when configuration changes', () => {
      const originalLogger = logger.logger;
      
      logger.configure({ logLevel: 'warn' });
      
      expect(logger.logger).not.toBe(originalLogger);
      expect(logger.getLogLevel()).toBe('warn');
    });
  });

  describe('Child Loggers', () => {
    test('should create child logger with additional context', () => {
      // Use testLogger which has file logging disabled
      const childLogger = testLogger.child('child-context');
      
      expect(childLogger).toBeInstanceOf(Logger);
      expect(childLogger.serviceName).toBe('test-logger:child-context');
    });

    test('should inherit parent logger configuration', () => {
      // Use testLogger which has file logging disabled
      const childLogger = testLogger.child('test-child');
      
      expect(childLogger.logLevel).toBe(testLogger.logLevel);
      expect(childLogger.enableFileLogging).toBe(testLogger.enableFileLogging);
    });
  });

  describe('Global Logger', () => {
    test('should create and get global logger instance', () => {
      const globalLogger = Logger.createGlobalLogger({
        serviceName: 'global-test',
        logLevel: 'debug'
      });
      
      expect(globalLogger).toBeInstanceOf(Logger);
      expect(Logger.getGlobalLogger()).toBe(globalLogger);
      
      // Clean up
      Logger.closeGlobalLogger();
    });

    test('should return same global logger instance', () => {
      const logger1 = Logger.createGlobalLogger({ serviceName: 'test1' });
      const logger2 = Logger.createGlobalLogger({ serviceName: 'test2' });
      
      expect(logger1).toBe(logger2);
      
      // Clean up
      Logger.closeGlobalLogger();
    });

    test('should close global logger', () => {
      const globalLogger = Logger.createGlobalLogger();
      Logger.closeGlobalLogger();
      
      expect(Logger.getGlobalLogger()).toBeNull();
    });
  });

  describe('Log Directory Management', () => {
    test('should create log directory if it does not exist', () => {
      const tempDir = path.join(__dirname, 'temp-logs');
      const tempLogger = new Logger({
        logDirectory: tempDir,
        enableFileLogging: true,
        enableConsoleLogging: false
      });
      
      expect(fs.existsSync(tempDir)).toBe(true);
      
      // Clean up
      tempLogger.close();
      try {
        fs.rmdirSync(tempDir);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should handle log directory creation errors gracefully', () => {
      const mockFs = jest.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });
      
      const fallbackLogger = new Logger({
        logDirectory: '/invalid/path',
        enableFileLogging: true,
        enableConsoleLogging: false
      });
      
      expect(fallbackLogger.logDirectory).toContain('logs');
      
      mockFs.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle logging errors gracefully', () => {
      const testLogger = new Logger({
        enableFileLogging: false,
        enableConsoleLogging: false
      });
      
      // Test with a logger that has no transports (which causes winston to warn but not crash)
      testLogger.setLogLevel('error');
      
      // Should not throw
      expect(() => {
        testLogger.info('Test message');
      }).not.toThrow();
    });

    test('should handle invalid log levels gracefully', () => {
      const logger = new Logger({
        logLevel: 'invalid-level',
        enableFileLogging: false,
        enableConsoleLogging: false
      });
      
      // Should keep the invalid level
      expect(logger.getLogLevel()).toBe('invalid-level');
      // But winston should handle it gracefully
      expect(() => {
        logger.info('Test message');
      }).not.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    test('should work with default logging configuration', () => {
      const configLogger = new Logger(loggingConfig.default);
      
      expect(configLogger.logLevel).toBe('info');
      expect(configLogger.serviceName).toBe('kc-orchestrator');
    });

    test('should work with development logging configuration', () => {
      const devLogger = new Logger(loggingConfig.development);
      
      expect(devLogger.logLevel).toBe('debug');
      expect(devLogger.serviceName).toBe('kc-orchestrator-dev');
    });

    test('should work with test logging configuration', () => {
      const testLogger = new Logger(loggingConfig.test);
      
      expect(testLogger.logLevel).toBe('warn');
      expect(testLogger.enableFileLogging).toBe(false);
    });
  });

  describe('Stream Support', () => {
    test('should have stream property for HTTP logging', () => {
      expect(logger.logger.stream).toBeDefined();
      expect(typeof logger.logger.stream.write).toBe('function');
    });

    test('should write to stream without errors', () => {
      expect(() => {
        logger.logger.stream.write('HTTP request log message\n');
      }).not.toThrow();
    });
  });
});