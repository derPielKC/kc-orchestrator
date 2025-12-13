/**
 * Custom Error Classes for kc-orchestrator
 * 
 * This module defines custom error classes used throughout the application
 * for consistent error handling and debugging.
 */

/**
 * Base error class for all kc-orchestrator errors
 */
class OrchestratorError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Task Execution Error
 * 
 * Thrown when there are issues with task execution
 */
class TaskExecutionError extends OrchestratorError {
  constructor(message, cause) {
    super(message, cause);
    this.taskId = cause?.taskId || (cause?.task && cause.task.id);
    this.attempt = cause?.attempt;
    this.provider = cause?.provider;
  }
}

/**
 * Task Validation Error
 * 
 * Thrown when task validation fails
 */
class TaskValidationError extends OrchestratorError {
  constructor(message, cause) {
    super(message, cause);
    this.taskId = cause?.taskId || (cause?.task && cause.task.id);
    this.validationType = cause?.validationType;
  }
}

/**
 * Configuration Error
 * 
 * Thrown when there are issues with configuration
 */
class ConfigurationError extends OrchestratorError {
  constructor(message, cause) {
    super(message, cause);
    this.configPath = cause?.configPath;
  }
}

/**
 * Discovery Error
 * 
 * Thrown when repository or project discovery fails
 */
class DiscoveryError extends OrchestratorError {
  constructor(message, cause) {
    super(message, cause);
    this.searchPath = cause?.searchPath;
  }
}

/**
 * Provider Error
 * 
 * Thrown when there are issues with AI providers
 */
class ProviderError extends OrchestratorError {
  constructor(message, cause) {
    super(message, cause);
    this.providerName = cause?.providerName;
    this.command = cause?.command;
  }
}

module.exports = {
  OrchestratorError,
  TaskExecutionError,
  TaskValidationError,
  ConfigurationError,
  DiscoveryError,
  ProviderError
};