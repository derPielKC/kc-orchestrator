/**
 * Logging Configuration
 *
 * Configuration settings for the logging system
 */

module.exports = {
  // Default logging configuration
  default: {
    logDirectory: 'logs',
    logLevel: 'info',
    serviceName: 'kc-orchestrator',
    enableFileLogging: true,
    enableConsoleLogging: true,
    maxFileSize: '20m',
    maxFiles: '14d'
  },

  // Development configuration (more verbose)
  development: {
    logDirectory: 'logs',
    logLevel: 'debug',
    serviceName: 'kc-orchestrator-dev',
    enableFileLogging: true,
    enableConsoleLogging: true,
    maxFileSize: '10m',
    maxFiles: '7d'
  },

  // Production configuration (less verbose)
  production: {
    logDirectory: 'logs',
    logLevel: 'info',
    serviceName: 'kc-orchestrator-prod',
    enableFileLogging: true,
    enableConsoleLogging: true,
    maxFileSize: '50m',
    maxFiles: '30d'
  },

  // Test configuration (console only)
  test: {
    logDirectory: 'test-logs',
    logLevel: 'warn',
    serviceName: 'kc-orchestrator-test',
    enableFileLogging: false,
    enableConsoleLogging: true,
    maxFileSize: '5m',
    maxFiles: '3d'
  },

  // Log levels
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
    silly: 5
  },

  // Context names for different modules
  contexts: {
    engine: 'task-engine',
    provider: 'ai-provider',
    git: 'git-workflow',
    validation: 'validation',
    config: 'configuration',
    discovery: 'discovery',
    ollama: 'ollama-client',
    cli: 'cli-interface'
  }
};