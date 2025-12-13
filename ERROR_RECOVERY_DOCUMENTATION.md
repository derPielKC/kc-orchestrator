# kc-orchestrator Error Handling and Recovery System Documentation

## Overview

The kc-orchestrator error handling and recovery system provides robust mechanisms for classifying errors, determining appropriate recovery strategies, and executing recovery operations. This system enhances the reliability and resilience of the kc-orchestrator by handling both expected and unexpected errors gracefully.

## Architecture

The error recovery system consists of three main components:

### 1. ErrorClassifier
Responsible for classifying errors based on their type and context, determining the appropriate recovery strategy.

### 2. RecoveryManager
Manages the execution of recovery strategies and provides hooks for monitoring recovery operations.

### 3. ErrorRecoverySystem
The main interface that combines error classification and recovery management into a cohesive system.

## Features

### Error Classification
- **Customizable Rules**: Define classification rules for different error types
- **Severity Levels**: Classify errors by severity (low, medium, high)
- **Recovery Strategies**: Assign appropriate recovery strategies to error types
- **Extensible**: Add custom classification rules at runtime

### Recovery Strategies
The system includes seven built-in recovery strategies:

#### 1. Retry with Fallback
- Attempts to retry the operation multiple times
- Falls back to an alternative approach if all retries fail
- Configurable retry count and delay

#### 2. Skip and Continue
- Skips the failed operation
- Continues execution with the next operation
- Useful for non-critical failures

#### 3. Fail Fast
- Immediately stops execution
- Prevents cascading failures
- Used for critical errors that cannot be recovered

#### 4. Retry with Backoff
- Exponential backoff retry mechanism
- Increasing delays between retry attempts
- Prevents overwhelming failing systems

#### 5. Fallback to Next Provider
- Switches to the next available provider
- Maintains operation continuity
- Used in multi-provider scenarios

#### 6. Continue Without Ollama
- Gracefully degrades functionality
- Continues execution without Ollama features
- Used when Ollama operations fail

#### 7. Retry Once
- Single retry attempt
- Simple and effective for transient errors
- Minimal delay impact

### Recovery Hooks
- **Pre-Recovery Hooks**: Executed before recovery attempts
- **Post-Recovery Hooks**: Executed after recovery attempts
- **Recovery Success Hooks**: Executed on successful recovery
- **Recovery Failure Hooks**: Executed on failed recovery

### Error Context Preservation
- Maintains complete error context throughout recovery
- Provides detailed logging and debugging information
- Supports error escalation and reporting

## Installation

The error recovery system is already included in the kc-orchestrator package. No additional installation is required.

## Usage

### Basic Usage

```javascript
const { ErrorRecoverySystem } = require('./src/recovery');

// Create error recovery system
const recoverySystem = new ErrorRecoverySystem();

// Handle errors with automatic recovery
try {
  // Your operation that might fail
  riskyOperation();
} catch (error) {
  const recoveryResult = await recoverySystem.handleError(error, {
    maxRetries: 3,
    retryOperation: async (attempt) => {
      // Retry logic here
      return performOperationWithRetry(attempt);
    }
  });
  
  if (!recoveryResult.success) {
    // Handle unrecoverable error
    console.error('Recovery failed:', recoveryResult.recoveryError);
  }
}
```

### Error Classification

```javascript
const { ErrorRecoverySystem } = require('./src/recovery');

const recoverySystem = new ErrorRecoverySystem();

// Classify an error
const error = new Error('Operation failed');
error.name = 'TaskExecutionError';

const classification = recoverySystem.classifyError(error);

console.log('Error classification:', classification);
// Output: { errorType: 'TaskExecutionError', classification: 'recoverable', ... }
```

### Custom Classification Rules

```javascript
const recoverySystem = new ErrorRecoverySystem();

// Add custom classification rule
recoverySystem.addClassificationRule({
  name: 'CustomError',
  type: 'recoverable',
  severity: 'low',
  recoveryStrategy: 'skip_and_continue'
});

// Now CustomError will be classified and handled appropriately
```

### Recovery Hooks

```javascript
const recoverySystem = new ErrorRecoverySystem();

// Add pre-recovery hook
recoverySystem.addRecoveryHook('preRecovery', (error, context) => {
  console.log('About to attempt recovery for:', error.message);
  // Log to monitoring system, notify administrators, etc.
});

// Add post-recovery hook
recoverySystem.addRecoveryHook('postRecovery', (error, context, result) => {
  console.log('Recovery completed with result:', result.success);
  // Clean up resources, update status, etc.
});
```

## Integration with Other Modules

### Task Engine Integration

```javascript
const { TaskExecutionEngine } = require('./src/engine');
const { ErrorRecoverySystem } = require('./src/recovery');

const recoverySystem = new ErrorRecoverySystem();
const engine = new TaskExecutionEngine({
  // ... other options
});

engine.on('task:error', async (task, error) => {
  const recoveryResult = await recoverySystem.handleError(error, {
    maxRetries: 2,
    retryOperation: async (attempt) => {
      return engine.executeTask(task, attempt);
    },
    fallbackOperation: async () => {
      return engine.skipTask(task);
    }
  });
  
  if (recoveryResult.success) {
    console.log('Task recovered successfully');
  } else {
    console.error('Task recovery failed');
    engine.markTaskFailed(task);
  }
});
```

### Provider Integration

```javascript
const { ProviderManager } = require('./src/providers/ProviderManager');
const { ErrorRecoverySystem } = require('./src/recovery');

const recoverySystem = new ErrorRecoverySystem();
const providerManager = new ProviderManager({
  // ... other options
});

providerManager.on('provider:error', async (error, provider) => {
  const recoveryResult = await recoverySystem.handleError(error, {
    providers: providerManager.getAvailableProviders(),
    currentProvider: provider,
    fallbackOperation: async (nextProvider) => {
      return providerManager.executeWithProvider(nextProvider);
    }
  });
  
  if (!recoveryResult.success) {
    providerManager.disableProvider(provider);
  }
});
```

### Git Integration

```javascript
const { GitRepositoryManager } = require('./src/git');
const { ErrorRecoverySystem } = require('./src/recovery');

const recoverySystem = new ErrorRecoverySystem();
const gitManager = new GitRepositoryManager({
  // ... other options
});

gitManager.on('operation:error', async (error, operation) => {
  const recoveryResult = await recoverySystem.handleError(error, {
    maxRetries: 3,
    retryOperation: async (attempt) => {
      return gitManager.retryOperation(operation);
    }
  });
  
  if (!recoveryResult.success) {
    gitManager.logCriticalError(error);
  }
});
```

## Configuration

### ErrorClassifier Configuration

```javascript
const { ErrorClassifier } = require('./src/recovery');

const classifier = new ErrorClassifier({
  logger: yourLoggerInstance  // Optional: custom logger
});

// Default classification rules include:
// - TaskExecutionError: retry_with_fallback
// - TaskValidationError: skip_and_continue
// - ConfigurationError: fail_fast
// - DiscoveryError: retry_with_backoff
// - ProviderError: fallback_to_next_provider
// - OllamaClientError: continue_without_ollama
// - OllamaRequestError: retry_once
// - OllamaResponseError: continue_without_ollama
```

### RecoveryManager Configuration

```javascript
const { RecoveryManager, ErrorClassifier } = require('./src/recovery');

const classifier = new ErrorClassifier();
const recoveryManager = new RecoveryManager({
  logger: yourLoggerInstance,  // Optional: custom logger
  classifier: classifier        // Optional: custom classifier
});
```

### ErrorRecoverySystem Configuration

```javascript
const { ErrorRecoverySystem } = require('./src/recovery');

const recoverySystem = new ErrorRecoverySystem({
  logger: yourLoggerInstance  // Optional: custom logger
});
```

## Best Practices

### 1. Appropriate Error Classification
Classify errors accurately to ensure proper recovery:

```javascript
// Good: Specific error types with appropriate classification
const error = new TaskExecutionError('Task failed', { taskId: 'T1' });
// Will be classified as recoverable with retry_with_fallback

// Bad: Generic errors that are hard to classify
throw new Error('Something went wrong');
// Will be classified as critical with fail_fast
```

### 2. Contextual Recovery
Provide meaningful context for recovery operations:

```javascript
// Good: Detailed context for recovery
const context = {
  maxRetries: 3,
  retryDelay: 1000,
  retryOperation: async (attempt) => {
    return performOperation(taskId, attempt);
  },
  fallbackOperation: async () => {
    return performAlternativeOperation(taskId);
  }
};

// Bad: Minimal context
const context = {
  retryOperation: async () => performOperation()
};
```

### 3. Recovery Strategy Selection
Choose the appropriate recovery strategy for the error type:

- **Transient errors**: Use `retry_with_fallback` or `retry_with_backoff`
- **Non-critical errors**: Use `skip_and_continue`
- **Critical errors**: Use `fail_fast`
- **Provider failures**: Use `fallback_to_next_provider`
- **Ollama failures**: Use `continue_without_ollama`

### 4. Recovery Hooks
Use recovery hooks for monitoring and cleanup:

```javascript
// Good: Comprehensive hook usage
recoverySystem.addRecoveryHook('preRecovery', (error, context) => {
  logToMonitoringSystem('Recovery attempt starting', { error, context });
});

recoverySystem.addRecoveryHook('recoverySuccess', (error, context, result) => {
  logToMonitoringSystem('Recovery succeeded', { error, context, result });
  cleanUpTemporaryResources();
});

recoverySystem.addRecoveryHook('recoveryFailure', (error, context, recoveryError) => {
  logToMonitoringSystem('Recovery failed', { error, context, recoveryError });
  notifyAdministrators();
});
```

### 5. Error Prevention
While recovery is important, prevention is better:

```javascript
// Good: Prevent errors when possible
try {
  validateInputs();
  checkPreconditions();
  performOperation();
} catch (error) {
  // Handle with recovery system
}

// Bad: Rely solely on recovery
try {
  performOperationWithoutValidation();
} catch (error) {
  // Handle with recovery system
}
```

## Error Handling Patterns

### Retry Pattern
```javascript
const recoverySystem = new ErrorRecoverySystem();

async function executeWithRetry(operation, maxRetries = 3) {
  try {
    return await operation();
  } catch (error) {
    const result = await recoverySystem.handleError(error, {
      maxRetries,
      retryOperation: operation
    });
    
    if (result.success) {
      return result.recoveryResult.result;
    }
    
    throw new Error(`Operation failed after ${maxRetries} retries`);
  }
}
```

### Circuit Breaker Pattern
```javascript
class CircuitBreaker {
  constructor(operation, threshold = 3, timeout = 30000) {
    this.operation = operation;
    this.threshold = threshold;
    this.timeout = timeout;
    this.failures = 0;
    this.state = 'closed';
    this.nextAttempt = 0;
  }
  
  async execute() {
    if (this.state === 'open' && Date.now() < this.nextAttempt) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const result = await this.operation();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
        this.nextAttempt = Date.now() + this.timeout;
      }
      
      throw error;
    }
  }
}
```

### Fallback Pattern
```javascript
async function executeWithFallback(primaryOperation, fallbackOperation) {
  const recoverySystem = new ErrorRecoverySystem();
  
  try {
    return await primaryOperation();
  } catch (error) {
    const result = await recoverySystem.handleError(error, {
      retryOperation: primaryOperation,
      fallbackOperation: fallbackOperation
    });
    
    if (result.success && result.recoveryResult.usedFallback) {
      return result.recoveryResult.result;
    }
    
    throw error;
  }
}
```

## Troubleshooting

### Recovery Not Triggered
1. **Check error classification**: Ensure the error is classified as recoverable
2. **Verify recovery strategy**: Confirm the error type has an appropriate strategy
3. **Review error handling**: Make sure errors are properly caught and passed to the recovery system

### Recovery Fails
1. **Check retry operations**: Ensure retry operations are properly defined
2. **Verify fallback operations**: Confirm fallback operations work correctly
3. **Review error context**: Make sure the context provides all necessary information

### Performance Issues
1. **Check retry delays**: Ensure delays are not too long
2. **Review max retries**: Verify retry limits are reasonable
3. **Monitor recovery hooks**: Ensure hooks don't introduce significant overhead

### Memory Leaks
1. **Check recovery hooks**: Ensure hooks clean up resources
2. **Review error context**: Make sure context doesn't retain large objects
3. **Monitor long-running operations**: Ensure recovery doesn't accumulate state

## API Reference

### ErrorClassifier

#### Constructor
```javascript
new ErrorClassifier(options)
```

**Parameters:**
- `options.logger` (Logger): Optional logger instance

#### Methods

**classifyError(error)**
- Classify an error and determine recovery strategy
- Returns classification object with error type, classification, severity, and recovery strategy

**addClassificationRule(rule)**
- Add a custom classification rule
- Rule must include: name, type, severity, recoveryStrategy

**getClassificationRules()**
- Get all classification rules
- Returns array of classification rules

### RecoveryManager

#### Constructor
```javascript
new RecoveryManager(options)
```

**Parameters:**
- `options.logger` (Logger): Optional logger instance
- `options.classifier` (ErrorClassifier): Optional classifier instance

#### Methods

**handleError(error, context)**
- Handle an error with automatic recovery
- Returns recovery result with success status and details

**addRecoveryHook(hookType, hookFunction)**
- Add a recovery hook
- Hook types: preRecovery, postRecovery, recoverySuccess, recoveryFailure

**getRecoveryStatistics()**
- Get recovery statistics
- Returns statistics object with recovery metrics

### ErrorRecoverySystem

#### Constructor
```javascript
new ErrorRecoverySystem(options)
```

**Parameters:**
- `options.logger` (Logger): Optional logger instance

#### Methods

**handleError(error, context)**
- Handle an error through the complete system
- Returns recovery result

**classifyError(error)**
- Classify an error
- Returns classification result

**addClassificationRule(rule)**
- Add custom classification rule

**addRecoveryHook(hookType, hookFunction)**
- Add recovery hook

**getRecoveryStatistics()**
- Get recovery statistics

## Examples

### Basic Error Handling

```javascript
const { ErrorRecoverySystem } = require('./src/recovery');

async function main() {
  const recoverySystem = new ErrorRecoverySystem();
  
  try {
    // Simulate an operation that might fail
    await performRiskyOperation();
  } catch (error) {
    const recoveryResult = await recoverySystem.handleError(error, {
      maxRetries: 3,
      retryDelay: 1000,
      retryOperation: async (attempt) => {
        console.log(`Retry attempt ${attempt}`);
        return performRiskyOperation();
      }
    });
    
    if (recoveryResult.success) {
      console.log('Operation recovered successfully');
    } else {
      console.error('Operation failed:', recoveryResult.recoveryError);
    }
  }
}
```

### Advanced Error Handling with Multiple Strategies

```javascript
const { ErrorRecoverySystem } = require('./src/recovery');

class TaskProcessor {
  constructor() {
    this.recoverySystem = new ErrorRecoverySystem();
    
    // Add custom classification rules
    this.recoverySystem.addClassificationRule({
      name: 'NetworkError',
      type: 'recoverable',
      severity: 'medium',
      recoveryStrategy: 'retry_with_backoff'
    });
    
    // Add recovery hooks
    this.recoverySystem.addRecoveryHook('preRecovery', (error) => {
      console.log('Attempting recovery for:', error.message);
    });
    
    this.recoverySystem.addRecoveryHook('recoverySuccess', (error, context, result) => {
      console.log('Recovery successful after', result.recoveryResult.attempt, 'attempts');
    });
  }
  
  async processTask(task) {
    try {
      return await this._executeTask(task);
    } catch (error) {
      const classification = this.recoverySystem.classifyError(error);
      
      if (classification.isRecoverable) {
        const recoveryResult = await this.recoverySystem.handleError(error, {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          retryOperation: async (attempt) => {
            return this._executeTaskWithRetry(task, attempt);
          },
          fallbackOperation: async () => {
            return this._executeTaskFallback(task);
          }
        });
        
        if (recoveryResult.success) {
          return recoveryResult.recoveryResult.result;
        }
      }
      
      // Handle unrecoverable errors
      this._handleCriticalError(error, task);
      throw error;
    }
  }
  
  async _executeTask(task) {
    // Task execution logic
  }
  
  async _executeTaskWithRetry(task, attempt) {
    // Task execution with retry logic
  }
  
  async _executeTaskFallback(task) {
    // Fallback task execution
  }
  
  _handleCriticalError(error, task) {
    // Critical error handling
  }
}
```

### Integration with Task Execution Engine

```javascript
const { TaskExecutionEngine } = require('./src/engine');
const { ErrorRecoverySystem } = require('./src/recovery');

class RobustTaskEngine extends TaskExecutionEngine {
  constructor(options) {
    super(options);
    this.recoverySystem = new ErrorRecoverySystem();
    
    // Enhance error handling
    this.on('task:error', this._handleTaskError.bind(this));
  }
  
  async _handleTaskError(task, error) {
    const classification = this.recoverySystem.classifyError(error);
    
    if (classification.isRecoverable) {
      const recoveryResult = await this.recoverySystem.handleError(error, {
        maxRetries: 2,
        retryOperation: async (attempt) => {
          return this.executeTask(task, attempt);
        },
        fallbackOperation: async () => {
          return this.skipTask(task);
        }
      });
      
      if (recoveryResult.success) {
        this.emit('task:recovered', task, recoveryResult);
        return;
      }
    }
    
    // Mark task as failed if recovery fails
    this.markTaskFailed(task, error);
  }
  
  async executeTask(task, attempt = 1) {
    try {
      // Enhanced execution with attempt tracking
      return await super.executeTask(task);
    } catch (error) {
      if (attempt < 3) {
        // Retry with the recovery system
        const recoveryResult = await this.recoverySystem.handleError(error, {
          maxRetries: 3 - attempt,
          retryOperation: async (retryAttempt) => {
            return this.executeTask(task, attempt + retryAttempt);
          }
        });
        
        if (recoveryResult.success) {
          return recoveryResult.recoveryResult.result;
        }
      }
      
      throw error;
    }
  }
}
```

## Conclusion

The kc-orchestrator error handling and recovery system provides a comprehensive solution for building resilient applications. With its flexible error classification, multiple recovery strategies, and extensible architecture, it can handle a wide range of error scenarios gracefully.

Key benefits include:
- **Improved Reliability**: Automatic recovery from transient failures
- **Enhanced Resilience**: Graceful degradation when full recovery isn't possible
- **Better Maintainability**: Centralized error handling logic
- **Comprehensive Monitoring**: Detailed logging and recovery hooks
- **Extensibility**: Custom classification rules and recovery strategies

For more information, refer to the source code and inline documentation in:
- `src/recovery.js` - Main recovery system implementation
- `test/recovery.test.js` - Comprehensive test suite