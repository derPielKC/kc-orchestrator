/**
 * Comprehensive Logging System
 *
 * This module provides a robust logging system with multiple transports,
 * log levels, and structured logging capabilities for the kc-orchestrator.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { format, transports } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');

/**
 * Logger Class
 *
 * Comprehensive logging system with multiple transports and levels.
 */
class Logger {
  /**
   * Create a new Logger instance
   *
   * @param {Object} options - Configuration options
   * @param {string} options.logDirectory - Directory for log files
   * @param {string} options.logLevel - Minimum log level
   * @param {string} options.serviceName - Service name for logging
   * @param {boolean} options.enableFileLogging - Enable file logging
   * @param {boolean} options.enableConsoleLogging - Enable console logging
   */
  constructor(options = {}) {
    this.logDirectory = options.logDirectory || path.join(__dirname, '..', 'logs');
    this.logLevel = options.logLevel || 'info';
    this.serviceName = options.serviceName || 'kc-orchestrator';
    this.enableFileLogging = options.enableFileLogging !== false;
    this.enableConsoleLogging = options.enableConsoleLogging !== false;
    
    // Ensure log directory exists
    this._ensureLogDirectory();
    
    // Create logger instance
    this.logger = this._createLogger();
  }

  /**
   * Ensure log directory exists
   */
  _ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create log directory: ${error.message}`);
      // Fallback to default directory
      this.logDirectory = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    }
  }

  /**
   * Create logger instance with configured transports
   *
   * @returns {winston.Logger} Configured logger instance
   */
  _createLogger() {
    // Custom format for structured logging
    const customFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    );

    // Console transport
    const consoleTransport = new transports.Console({
      level: this.logLevel,
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, service, context, ...meta }) => {
          const contextStr = context ? `[${context}] ` : '';
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${contextStr}${message}${metaStr}`;
        })
      ),
      handleExceptions: true,
      handleRejections: true
    });

    // Configure transports
    const loggerTransports = [];
    
    if (this.enableConsoleLogging) {
      loggerTransports.push(consoleTransport);
    }
    
    // Only create file transports if file logging is enabled
    if (this.enableFileLogging) {
      // File transport with rotation
      const fileTransport = new DailyRotateFile({
        level: this.logLevel,
        filename: path.join(this.logDirectory, `${this.serviceName}-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: customFormat,
        handleExceptions: true,
        handleRejections: true
      });

      // Error file transport
      const errorFileTransport = new DailyRotateFile({
        level: 'error',
        filename: path.join(this.logDirectory, `${this.serviceName}-error-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: customFormat,
        handleExceptions: true,
        handleRejections: true
      });
      
      loggerTransports.push(fileTransport);
      loggerTransports.push(errorFileTransport);
    }

    // Create logger
    const logger = winston.createLogger({
      level: this.logLevel,
      levels: winston.config.npm.levels,
      format: customFormat,
      transports: loggerTransports,
      exitOnError: false
    });

    // Add stream for morgan or other HTTP logging
    logger.stream = {
      write: (message) => {
        logger.info(message.trim());
      }
    };

    return logger;
  }

  /**
   * Log a message at the specified level
   *
   * @param {string} level - Log level (info, warn, error, debug, etc.)
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Object} meta - Additional metadata
   */
  log(level, message, context = null, meta = {}) {
    const logData = {
      service: this.serviceName,
      context: context,
      ...meta
    };
    
    this.logger.log(level, message, logData);
  }

  /**
   * Log an info message
   *
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Object} meta - Additional metadata
   */
  info(message, context = null, meta = {}) {
    this.log('info', message, context, meta);
  }

  /**
   * Log a warning message
   *
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Object} meta - Additional metadata
   */
  warn(message, context = null, meta = {}) {
    this.log('warn', message, context, meta);
  }

  /**
   * Log an error message
   *
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Object} meta - Additional metadata
   */
  error(message, context = null, meta = {}) {
    this.log('error', message, context, meta);
  }

  /**
   * Log a debug message
   *
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Object} meta - Additional metadata
   */
  debug(message, context = null, meta = {}) {
    this.log('debug', message, context, meta);
  }

  /**
   * Log a verbose message
   *
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Object} meta - Additional metadata
   */
  verbose(message, context = null, meta = {}) {
    this.log('verbose', message, context, meta);
  }

  /**
   * Log a silly message
   *
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Object} meta - Additional metadata
   */
  silly(message, context = null, meta = {}) {
    this.log('silly', message, context, meta);
  }

  /**
   * Create a child logger with additional context
   *
   * @param {string} context - Additional context for child logger
   * @returns {Logger} Child logger instance
   */
  child(context) {
    // Sanitize context to remove invalid characters for file names
    const sanitizedContext = context.replace(/[^\w\-./]/g, '-');
    const childLogger = new Logger({
      ...this._getOptions(),
      serviceName: `${this.serviceName}:${sanitizedContext}`
    });
    return childLogger;
  }

  /**
   * Get current logger options
   *
   * @returns {Object} Current logger options
   */
  _getOptions() {
    return {
      logDirectory: this.logDirectory,
      logLevel: this.logLevel,
      serviceName: this.serviceName,
      enableFileLogging: this.enableFileLogging,
      enableConsoleLogging: this.enableConsoleLogging
    };
  }

  /**
   * Update logger configuration
   *
   * @param {Object} options - New configuration options
   */
  configure(options = {}) {
    this.logDirectory = options.logDirectory || this.logDirectory;
    this.logLevel = options.logLevel || this.logLevel;
    this.serviceName = options.serviceName || this.serviceName;
    this.enableFileLogging = options.enableFileLogging !== undefined 
      ? options.enableFileLogging 
      : this.enableFileLogging;
    this.enableConsoleLogging = options.enableConsoleLogging !== undefined
      ? options.enableConsoleLogging
      : this.enableConsoleLogging;
    
    // Recreate logger with new configuration
    this.logger = this._createLogger();
  }

  /**
   * Get current log level
   *
   * @returns {string} Current log level
   */
  getLogLevel() {
    return this.logLevel;
  }

  /**
   * Set log level
   *
   * @param {string} level - New log level
   */
  setLogLevel(level) {
    this.logLevel = level;
    this.logger.level = level;
    
    // Update all transports
    this.logger.transports.forEach(transport => {
      transport.level = level;
    });
  }

  /**
   * Close logger and clean up
   */
  close() {
    // Close all transports
    this.logger.transports.forEach(transport => {
      if (transport.close) {
        transport.close();
      }
    });
  }

  /**
   * Create a global logger instance
   *
   * @param {Object} options - Configuration options
   * @returns {Logger} Global logger instance
   */
  static createGlobalLogger(options = {}) {
    if (!Logger.globalInstance) {
      Logger.globalInstance = new Logger(options);
    }
    return Logger.globalInstance;
  }

  /**
   * Get the global logger instance
   *
   * @returns {Logger} Global logger instance
   */
  static getGlobalLogger() {
    return Logger.globalInstance;
  }

  /**
   * Close the global logger instance
   */
  static closeGlobalLogger() {
    if (Logger.globalInstance) {
      Logger.globalInstance.close();
      Logger.globalInstance = null;
    }
  }
}

// Initialize global logger instance
Logger.globalInstance = null;

module.exports = {
  Logger,
  winston
};