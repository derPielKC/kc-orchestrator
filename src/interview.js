const readline = require('readline');
const { createDefaultGuide, writeGuide } = require('./config');
const fs = require('fs');
const path = require('path');

/**
 * Detects ambiguous configuration scenarios that require user input
 * 
 * @param {object} config - Current configuration
 * @param {string} projectPath - Path to the project
 * @returns {Array<string>} Array of ambiguity types detected
 */
function detectAmbiguity(config, projectPath) {
  const ambiguities = [];
  
  // Check if this is a new project without existing configuration
  if (!config || Object.keys(config).length === 0) {
    ambiguities.push('new_project');
  }
  
  // Check if project name is missing or ambiguous
  if (!config.project || config.project.trim() === '') {
    ambiguities.push('missing_project_name');
  }
  
  // Check if project description is missing
  if (!config.description || config.description.trim() === '') {
    ambiguities.push('missing_project_description');
  }
  
  // Check if IMPLEMENTATION_GUIDE.json doesn't exist
  const guidePath = path.join(projectPath, 'IMPLEMENTATION_GUIDE.json');
  if (!fs.existsSync(guidePath)) {
    ambiguities.push('missing_implementation_guide');
  }
  
  // Check if tasks are empty or missing
  if (config.tasks && config.tasks.length === 0) {
    ambiguities.push('empty_tasks');
  }
  
  return ambiguities;
}

/**
 * Asks a question via CLI and returns the answer
 * 
 * @param {string} question - The question to ask
 * @param {object} options - Options for the question
 * @param {string} options.default - Default answer
 * @param {Array<string>} options.validAnswers - Valid answer options
 * @param {boolean} options.required - Whether answer is required
 * @returns {Promise<string>} The user's answer
 */
async function askQuestion(question, options = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    let prompt = question;
    
    if (options.default) {
      prompt += ` [${options.default}]`;
    }
    
    if (options.validAnswers) {
      prompt += ` (${options.validAnswers.join('/')})`;
    }
    
    prompt += ': ';
    
    rl.question(prompt, (answer) => {
      rl.close();
      
      // Use default if answer is empty and default is provided
      if (!answer && options.default) {
        answer = options.default;
      }
      
      // Validate required answers
      if (options.required && !answer) {
        console.log('This field is required.');
        return resolve(askQuestion(question, options));
      }
      
      // Validate against valid answers if provided
      if (options.validAnswers && !options.validAnswers.includes(answer)) {
        console.log(`Please enter one of: ${options.validAnswers.join(', ')}`);
        return resolve(askQuestion(question, options));
      }
      
      resolve(answer);
    });
  });
}

/**
 * Runs the interactive interview process
 * 
 * @param {string} projectPath - Path to the project
 * @param {object} existingConfig - Existing configuration (if any)
 * @param {boolean} nonInteractive - Whether to run in non-interactive mode
 * @param {string} autoAnswers - Auto answers for non-interactive mode
 * @returns {Promise<object>} Final configuration
 */
async function runInterview(projectPath, existingConfig = {}, nonInteractive = false, autoAnswers = '') {
  console.log('🤖 kc-orchestrator - Interactive Setup');
  console.log('======================================');
  console.log(`Project path: ${projectPath}`);
  console.log('');
  
  // Detect ambiguities
  const ambiguities = detectAmbiguity(existingConfig, projectPath);
  
  if (ambiguities.length === 0) {
    console.log('✅ No ambiguities detected. Configuration looks good!');
    return existingConfig;
  }
  
  console.log(`📋 Found ${ambiguities.length} configuration issue(s) to resolve:`);
  ambiguities.forEach(ambiguity => {
    console.log(`  - ${ambiguity.replace(/_/g, ' ')}`);
  });
  console.log('');
  
  // Prepare questions based on ambiguities
  const questions = [];
  
  if (ambiguities.includes('new_project') || ambiguities.includes('missing_project_name')) {
    questions.push({
      id: 'project_name',
      question: 'What is the name of this project?',
      required: true,
      default: existingConfig.project || path.basename(projectPath)
    });
  }
  
  if (ambiguities.includes('missing_project_description')) {
    questions.push({
      id: 'project_description',
      question: 'Please provide a brief description of this project',
      required: true,
      default: existingConfig.description || ''
    });
  }
  
  if (ambiguities.includes('missing_implementation_guide') || ambiguities.includes('empty_tasks')) {
    questions.push({
      id: 'create_guide',
      question: 'Should I create a default IMPLEMENTATION_GUIDE.json?',
      required: true,
      validAnswers: ['yes', 'no'],
      default: 'yes'
    });
  }
  
  // Run interview
  const answers = {};
  
  for (const question of questions) {
    let answer;
    
    if (nonInteractive) {
      // Use auto answers in non-interactive mode
      const autoAnswer = autoAnswers.split(',')[questions.indexOf(question)] || '';
      answer = autoAnswer.trim() || question.default || '';
      console.log(`${question.question}: ${answer}`);
    } else {
      // Ask interactively
      answer = await askQuestion(question.question, {
        default: question.default,
        validAnswers: question.validAnswers,
        required: question.required
      });
    }
    
    answers[question.id] = answer;
  }
  
  // Apply answers to configuration
  const finalConfig = { ...existingConfig };
  
  if (answers.project_name) {
    finalConfig.project = answers.project_name;
  }
  
  if (answers.project_description) {
    finalConfig.description = answers.project_description;
  }
  
  // Create implementation guide if requested
  if (answers.create_guide === 'yes' || (nonInteractive && answers.create_guide !== 'no')) {
    const guidePath = path.join(projectPath, 'IMPLEMENTATION_GUIDE.json');
    const defaultGuide = createDefaultGuide(finalConfig.project, finalConfig.description);
    
    const success = writeGuide(guidePath, defaultGuide);
    if (success) {
      console.log(`✅ Created IMPLEMENTATION_GUIDE.json at ${guidePath}`);
      finalConfig.guideCreated = true;
    } else {
      console.error(`❌ Failed to create IMPLEMENTATION_GUIDE.json`);
    }
  }
  
  console.log('');
  console.log('✅ Interview complete! Configuration updated.');
  console.log('');
  
  return finalConfig;
}

/**
 * Checks if interview is needed based on configuration
 * 
 * @param {object} config - Current configuration
 * @param {string} projectPath - Path to the project
 * @returns {boolean} True if interview is needed
 */
function isInterviewNeeded(config, projectPath) {
  const ambiguities = detectAmbiguity(config, projectPath);
  return ambiguities.length > 0;
}

/**
 * Gets interview questions for a given ambiguity
 * 
 * @param {string} ambiguityType - Type of ambiguity
 * @returns {Array<object>} Array of question objects
 */
function getQuestionsForAmbiguity(ambiguityType) {
  const questionsMap = {
    'new_project': [
      {
        id: 'project_name',
        question: 'What is the name of this project?',
        required: true
      },
      {
        id: 'project_description',
        question: 'Please provide a brief description of this project',
        required: true
      }
    ],
    'missing_implementation_guide': [
      {
        id: 'create_guide',
        question: 'Should I create a default IMPLEMENTATION_GUIDE.json?',
        required: true,
        validAnswers: ['yes', 'no'],
        default: 'yes'
      }
    ]
  };
  
  return questionsMap[ambiguityType] || [];
}

module.exports = {
  detectAmbiguity,
  askQuestion,
  runInterview,
  isInterviewNeeded,
  getQuestionsForAmbiguity
};