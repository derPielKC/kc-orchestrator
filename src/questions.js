const fs = require('fs');
const path = require('path');
const { detectAmbiguity } = require('./interview');
const { findRepositoryRoot } = require('./discovery');

/**
 * Loads questions configuration from file
 * 
 * @param {string} configPath - Path to questions.json file
 * @returns {object|null} Questions configuration or null if invalid
 */
function loadQuestionsConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    
    // Basic validation
    if (!config.version || !config.triggers || !config.questions) {
      console.error('Invalid questions.json structure');
      return null;
    }
    
    return config;
  } catch (error) {
    console.error(`Failed to load questions config: ${error.message}`);
    return null;
  }
}

/**
 * Gets the default questions configuration path
 * 
 * @returns {string} Path to default questions.json
 */
function getDefaultQuestionsPath() {
  return path.join(__dirname, '../config/questions.json');
}

/**
 * Evaluates a simple condition (without || and &&)
 * 
 * @param {string} condition - Condition string to evaluate
 * @param {object} config - Config object
 * @param {string} projectPath - Project path
 * @param {boolean} negated - Whether the condition is negated
 * @returns {boolean} Result of condition evaluation
 */
function evaluateSimpleCondition(condition, config, projectPath, negated = false) {
  try {
    // Handle negated conditions
    const actualNegated = condition.startsWith('!');
    const conditionToCheck = actualNegated ? condition.substring(1).trim() : condition;
    const finalNegated = negated || actualNegated;
    
    // Handle config property checks
    if (conditionToCheck.includes('config.')) {
      const prop = conditionToCheck.replace('config.', '').trim();
      const value = prop.split('.').reduce((obj, key) => obj?.[key], config);
      
      // Handle empty string check
      if (conditionToCheck.includes('.trim() === ""')) {
        const isEmpty = !value || value.trim() === '';
        return finalNegated ? !isEmpty : isEmpty;
      }
      
      return finalNegated ? !value : !!value;
    }
    
    // Handle fs.existsSync checks
    if (conditionToCheck.includes('fs.existsSync')) {
      const pathMatch = conditionToCheck.match(/fs\.existsSync\((.*?)\)/);
      if (pathMatch) {
        const filePath = path.join(projectPath, pathMatch[1].replace(/'/g, '').replace(/"'/g, ''));
        const exists = fs.existsSync(filePath);
        return finalNegated ? !exists : exists;
      }
    }
    
    // Handle discovery.findRepositoryRoot checks
    if (conditionToCheck.includes('discovery.findRepositoryRoot')) {
      const hasRepo = !!findRepositoryRoot(projectPath);
      return finalNegated ? !hasRepo : hasRepo;
    }
    
    return true;
  } catch (error) {
    console.warn(`Failed to evaluate simple condition '${condition}': ${error.message}`);
    return false;
  }
}

/**
 * Evaluates trigger conditions dynamically
 * 
 * @param {string} condition - Condition string to evaluate
 * @param {object} context - Context object (config, projectPath, etc.)
 * @returns {boolean} Result of condition evaluation
 */
function evaluateCondition(condition, context) {
  try {
    // Simple condition evaluation
    if (condition.startsWith('!')) {
      const prop = condition.substring(1).trim();
      return !context[prop];
    } else if (condition.includes('||')) {
      const parts = condition.split('||').map(p => p.trim());
      return parts.some(p => evaluateCondition(p, context));
    } else if (condition.includes('&&')) {
      const parts = condition.split('&&').map(p => p.trim());
      return parts.every(p => evaluateCondition(p, context));
    } else {
      // Direct property access
      return !!context[condition];
    }
  } catch (error) {
    console.warn(`Failed to evaluate condition '${condition}': ${error.message}`);
    return false;
  }
}

/**
 * Detects which triggers apply to current configuration
 * 
 * @param {object} config - Current configuration
 * @param {string} projectPath - Project path
 * @param {object} questionsConfig - Questions configuration
 * @returns {Array<string>} Array of triggered ambiguity types
 */
function detectTriggeredAmbiguities(config, projectPath, questionsConfig) {
  const triggered = [];
  const context = {
    config,
    projectPath,
    fs,
    path,
    discovery: { findRepositoryRoot }
  };
  
  for (const [triggerName, triggerConfig] of Object.entries(questionsConfig.triggers)) {
    try {
      // Evaluate all conditions for this trigger
      const allConditionsMet = triggerConfig.conditions.every(condition => {
        try {
          // Handle complex conditions with || and &&
          if (condition.includes('||')) {
            // OR condition - at least one part must be true
            const parts = condition.split('||').map(p => p.trim());
            return parts.some(part => evaluateSimpleCondition(part, config, projectPath));
          } else if (condition.includes('&&')) {
            // AND condition - all parts must be true
            const parts = condition.split('&&').map(p => p.trim());
            return parts.every(part => evaluateSimpleCondition(part, config, projectPath));
          } else {
            // Simple condition
            return evaluateSimpleCondition(condition, config, projectPath);
          }
        } catch (conditionError) {
          console.warn(`Failed to evaluate condition '${condition}': ${conditionError.message}`);
          return false;
        }
      });
      
      if (allConditionsMet) {
        triggered.push(triggerName);
      }
    } catch (error) {
      console.warn(`Failed to evaluate trigger '${triggerName}': ${error.message}`);
    }
  }
  
  return triggered;
}

/**
 * Gets questions for specific ambiguity types
 * 
 * @param {Array<string>} ambiguities - Array of ambiguity types
 * @param {object} questionsConfig - Questions configuration
 * @returns {Array<object>} Array of question objects
 */
function getQuestionsForAmbiguities(ambiguities, questionsConfig) {
  const questions = [];
  
  // Get questions that match the ambiguities
  for (const ambiguity of ambiguities) {
    const trigger = questionsConfig.triggers[ambiguity];
    if (trigger) {
      // Find questions that are relevant to this ambiguity
      for (const [questionId, questionConfig] of Object.entries(questionsConfig.questions)) {
        // Simple mapping - in real implementation, this would be more sophisticated
        if (ambiguity === 'new_project' && ['project_name', 'project_description', 'create_implementation_guide'].includes(questionId)) {
          questions.push({ ...questionConfig, id: questionId });
        } else if (ambiguity === 'missing_implementation_guide' && questionId === 'create_implementation_guide') {
          questions.push({ ...questionConfig, id: questionId });
        } else if (ambiguity === 'ambiguous_provider' && questionId === 'provider_selection') {
          questions.push({ ...questionConfig, id: questionId });
        }
      }
    }
  }
  
  // Sort by priority
  return questions.sort((a, b) => a.priority - b.priority);
}

/**
 * Gets all questions grouped by category
 * 
 * @param {object} questionsConfig - Questions configuration
 * @returns {Array<object>} Array of question group objects
 */
function getQuestionGroups(questionsConfig) {
  return questionsConfig.question_groups ? questionsConfig.question_groups.sort((a, b) => a.priority - b.priority) : [];
}

/**
 * Validates an answer against question requirements
 * 
 * @param {object} question - Question configuration
 * @param {string} answer - User's answer
 * @returns {boolean} True if answer is valid
 */
function validateAnswer(question, answer) {
  if (!answer && question.required) {
    return false;
  }
  
  if (question.type === 'choice' && question.choices && !question.choices.includes(answer)) {
    return false;
  }
  
  if (question.type === 'confirm' && !['yes', 'no', 'y', 'n'].includes(answer.toLowerCase())) {
    return false;
  }
  
  if (question.type === 'number' && isNaN(parseFloat(answer))) {
    return false;
  }
  
  return true;
}

/**
 * Gets default answer for a question
 * 
 * @param {object} question - Question configuration
 * @param {object} context - Context for dynamic defaults
 * @returns {string} Default answer
 */
function getDefaultAnswer(question, context = {}) {
  if (!question.default) {
    return '';
  }
  
  // Handle dynamic defaults
  if (question.default.includes('path.basename')) {
    return context.projectPath ? path.basename(context.projectPath) : '';
  }
  
  return question.default;
}

module.exports = {
  loadQuestionsConfig,
  getDefaultQuestionsPath,
  detectTriggeredAmbiguities,
  getQuestionsForAmbiguities,
  getQuestionGroups,
  validateAnswer,
  getDefaultAnswer
};