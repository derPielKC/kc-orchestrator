const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Improvement Task Generator - Converts Agent Lightning recommendations into tasks
 *
 * This class handles the conversion of Agent Lightning recommendations into
 * properly formatted tasks for the IMPLEMENTATION_GUIDE.json file.
 */
class ImprovementTaskGenerator {
  /**
   * Constructor for ImprovementTaskGenerator
   *
   * @param {object} options - Configuration options
   * @param {string} options.guidePath - Path to IMPLEMENTATION_GUIDE.json
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.guidePath = options.guidePath || path.join(process.cwd(), 'IMPLEMENTATION_GUIDE.json');
    this.verbose = options.verbose || false;
  }
  
  /**
   * Generate improvement tasks from Agent Lightning recommendations
   *
   * @param {Array} recommendations - Array of recommendations from Agent Lightning
   * @param {object} context - Context information
   * @returns {object} Task generation result
   */
  generateImprovementTasks(recommendations, context = {}) {
    const { projectName = 'kc-orchestrator', existingTasks = [] } = context;
    
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      if (this.verbose) {
        console.log('⚠️  No recommendations provided');
      }
      return {
        success: true,
        generatedTasks: [],
        skippedTasks: 0,
        message: 'No recommendations to process'
      };
    }
    
    const generatedTasks = [];
    let skippedTasks = 0;
    
    recommendations.forEach((recommendation, index) => {
      try {
        // Check for duplicates
        const isDuplicate = this._isDuplicateTask(recommendation, existingTasks);
        
        if (isDuplicate) {
          skippedTasks++;
          if (this.verbose) {
            console.log(`⏭️  Skipped duplicate recommendation: ${recommendation.title}`);
          }
          return;
        }
        
        // Generate task
        const task = this._generateTaskFromRecommendation(recommendation, index, projectName);
        generatedTasks.push(task);
        
        if (this.verbose) {
          console.log(`✅ Generated task: ${task.id} - ${task.title}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to generate task from recommendation ${index}: ${error.message}`);
      }
    });
    
    return {
      success: true,
      generatedTasks: generatedTasks,
      skippedTasks: skippedTasks,
      message: `Generated ${generatedTasks.length} tasks, skipped ${skippedTasks} duplicates`
    };
  }
  
  /**
   * Check if a recommendation is a duplicate of existing tasks
   *
   * @param {object} recommendation - Recommendation to check
   * @param {Array} existingTasks - Array of existing tasks
   * @returns {boolean} True if duplicate
   */
  _isDuplicateTask(recommendation, existingTasks) {
    if (!Array.isArray(existingTasks) || existingTasks.length === 0) {
      return false;
    }
    
    const recommendationHash = this._generateContentHash(recommendation);
    
    return existingTasks.some(existingTask => {
      // Check by title similarity
      if (existingTask.title && recommendation.title) {
        const similarity = this._calculateTitleSimilarity(existingTask.title, recommendation.title);
        if (similarity > 0.8) {
          return true;
        }
      }
      
      // Check by content hash if available
      if (existingTask.contentHash) {
        return existingTask.contentHash === recommendationHash;
      }
      
      return false;
    });
  }
  
  /**
   * Calculate title similarity (simple implementation)
   *
   * @param {string} title1 - First title
   * @param {string} title2 - Second title
   * @returns {number} Similarity score (0-1)
   */
  _calculateTitleSimilarity(title1, title2) {
    const t1 = title1.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const t2 = title2.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    
    const words1 = new Set(t1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(t2.split(' ').filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Generate content hash for recommendation
   *
   * @param {object} recommendation - Recommendation object
   * @returns {string} Content hash
   */
  _generateContentHash(recommendation) {
    const content = `${recommendation.title}|${recommendation.description}|${recommendation.category}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  /**
   * Generate a task from a recommendation
   *
   * @param {object} recommendation - Agent Lightning recommendation
   * @param {number} index - Recommendation index
   * @param {string} projectName - Project name
   * @returns {object} Generated task
   */
  _generateTaskFromRecommendation(recommendation, index, projectName) {
    const taskId = this._generateTaskId(index);
    const contentHash = this._generateContentHash(recommendation);
    
    // Map recommendation priority to task effort
    const priorityMap = {
      'high': 'L',
      'medium': 'M',
      'low': 'S'
    };
    
    // Generate task structure
    const task = {
      id: taskId,
      title: this._formatTaskTitle(recommendation.title),
      description: this._formatTaskDescription(recommendation),
      acceptanceCriteria: this._generateAcceptanceCriteria(recommendation),
      constraints: this._generateConstraints(recommendation),
      outputs: this._generateExpectedOutputs(recommendation),
      checkSteps: this._generateCheckSteps(recommendation),
      status: 'todo',
      effort: priorityMap[recommendation.priority] || 'M',
      dependencies: [],
      contentHash: contentHash,
      source: 'agent-lightning',
      metadata: {
        recommendationId: recommendation.id,
        category: recommendation.category,
        priority: recommendation.priority,
        generatedAt: new Date().toISOString()
      }
    };
    
    return task;
  }
  
  /**
   * Generate task ID
   *
   * @param {number} index - Recommendation index
   * @returns {string} Task ID
   */
  _generateTaskId(index) {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 8);
    const paddedIndex = (index + 1).toString().padStart(3, '0');
    return `AGL-${timestamp}-${paddedIndex}`;
  }
  
  /**
   * Format task title
   *
   * @param {string} title - Recommendation title
   * @returns {string} Formatted task title
   */
  _formatTaskTitle(title) {
    if (!title) return 'Implement Agent Lightning Recommendation';
    
    // Add action verb if missing
    const actionVerbs = ['Implement', 'Add', 'Create', 'Fix', 'Improve', 'Optimize', 'Enhance', 'Update', 'Refactor'];
    const hasActionVerb = actionVerbs.some(verb => title.startsWith(verb));
    
    if (!hasActionVerb) {
      title = `Implement ${title}`;
    }
    
    // Capitalize first letter
    return title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  /**
   * Format task description
   *
   * @param {object} recommendation - Recommendation object
   * @returns {string} Formatted description
   */
  _formatTaskDescription(recommendation) {
    let description = recommendation.description || recommendation.title || 'No description provided';
    
    // Add context about the recommendation
    if (recommendation.category) {
      description += `\n\n**Category**: ${recommendation.category}`;
    }
    
    if (recommendation.priority) {
      description += `\n**Priority**: ${recommendation.priority}`;
    }
    
    if (recommendation.impact) {
      description += `\n**Impact**: ${recommendation.impact}`;
    }
    
    if (recommendation.implementation) {
      description += `\n\n**Suggested Implementation**:\n${recommendation.implementation}`;
    }
    
    return description;
  }
  
  /**
   * Generate acceptance criteria
   *
   * @param {object} recommendation - Recommendation object
   * @returns {Array} Acceptance criteria
   */
  _generateAcceptanceCriteria(recommendation) {
    const criteria = [
      `Recommendation ${recommendation.id} has been implemented`,
      'Code changes are tested and working',
      'Documentation is updated if applicable'
    ];
    
    // Add specific criteria based on recommendation type
    if (recommendation.category === 'performance') {
      criteria.push('Performance metrics show improvement');
    } else if (recommendation.category === 'reliability') {
      criteria.push('Error rates are reduced');
      criteria.push('Fallback mechanisms are improved');
    } else if (recommendation.category === 'error_handling') {
      criteria.push('Error handling is more robust');
      criteria.push('Error messages are more informative');
    } else if (recommendation.category === 'logging') {
      criteria.push('Logging is more comprehensive');
      criteria.push('Sensitive information is properly redacted');
    }
    
    return criteria;
  }
  
  /**
   * Generate constraints
   *
   * @param {object} recommendation - Recommendation object
   * @returns {object} Constraints object
   */
  _generateConstraints(recommendation) {
    const constraints = {
      do: [
        'Follow existing code style and patterns',
        'Maintain backward compatibility',
        'Add appropriate tests',
        'Document changes in code comments'
      ],
      dont: [
        'Break existing functionality',
        'Introduce security vulnerabilities',
        'Store sensitive information in logs',
        'Make changes that require major version bump'
      ]
    };
    
    // Add specific constraints based on recommendation
    if (recommendation.category === 'security') {
      constraints.do.push('Follow security best practices');
      constraints.do.push('Use secure coding techniques');
    } else if (recommendation.category === 'performance') {
      constraints.do.push('Measure performance before and after changes');
      constraints.do.push('Avoid introducing performance regressions');
    }
    
    return constraints;
  }
  
  /**
   * Generate expected outputs
   *
   * @param {object} recommendation - Recommendation object
   * @returns {Array} Expected outputs
   */
  _generateExpectedOutputs(recommendation) {
    const outputs = [];
    
    // Add common outputs
    outputs.push('Updated code files');
    
    // Add specific outputs based on recommendation
    if (recommendation.implementation && recommendation.implementation.includes('telemetry')) {
      outputs.push('Enhanced telemetry logging');
    } else if (recommendation.category === 'error_handling') {
      outputs.push('Improved error handling code');
    } else if (recommendation.category === 'logging') {
      outputs.push('Enhanced logging functionality');
    } else if (recommendation.category === 'performance') {
      outputs.push('Optimized code paths');
    }
    
    // Add test files
    outputs.push('Updated test files');
    
    return outputs;
  }
  
  /**
   * Generate check steps
   *
   * @param {object} recommendation - Recommendation object
   * @returns {Array} Check steps
   */
  _generateCheckSteps(recommendation) {
    const steps = [
      'Run the test suite to ensure no regressions',
      'Verify the implementation addresses the recommendation',
      'Check that documentation is updated'
    ];
    
    // Add specific check steps based on recommendation
    if (recommendation.category === 'performance') {
      steps.push('Measure and compare performance metrics');
    } else if (recommendation.category === 'error_handling') {
      steps.push('Test error scenarios to verify improved handling');
    } else if (recommendation.category === 'logging') {
      steps.push('Verify that logs contain expected information');
      steps.push('Check that sensitive information is redacted');
    }
    
    return steps;
  }
  
  /**
   * Add improvement tasks to IMPLEMENTATION_GUIDE.json
   *
   * @param {Array} tasks - Array of tasks to add
   * @param {object} options - Options
   * @returns {boolean} True if successful
   */
  addTasksToGuide(tasks, options = {}) {
    const { phaseName = 'Continuous Improvement (Agent Lightning)' } = options;
    
    try {
      // Read existing guide
      const guideContent = fs.readFileSync(this.guidePath, 'utf8');
      const guide = JSON.parse(guideContent);
      
      // Check if phase exists, if not add it
      const phaseExists = guide.phases && guide.phases.some(p => p.name === phaseName);
      
      if (!phaseExists) {
        guide.phases = guide.phases || [];
        guide.phases.push({
          name: phaseName,
          description: 'Continuous improvement tasks generated by Agent Lightning analysis'
        });
      }
      
      // Add tasks
      guide.tasks = guide.tasks || [];
      
      tasks.forEach(task => {
        // Check for duplicates again before adding
        const isDuplicate = guide.tasks.some(existingTask => 
          existingTask.contentHash === task.contentHash
        );
        
        if (!isDuplicate) {
          guide.tasks.push(task);
        }
      });
      
      // Write updated guide
      fs.writeFileSync(this.guidePath, JSON.stringify(guide, null, 2), 'utf8');
      
      if (this.verbose) {
        console.log(`📄 Added ${tasks.length} improvement tasks to ${this.guidePath}`);
      }
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to update IMPLEMENTATION_GUIDE.json: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Read existing tasks from IMPLEMENTATION_GUIDE.json
   *
   * @returns {Array} Array of existing tasks
   */
  readExistingTasks() {
    try {
      const guideContent = fs.readFileSync(this.guidePath, 'utf8');
      const guide = JSON.parse(guideContent);
      return guide.tasks || [];
    } catch (error) {
      console.error(`❌ Failed to read existing tasks: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Generate improvement report
   *
   * @param {Array} recommendations - Agent Lightning recommendations
   * @param {Array} generatedTasks - Generated tasks
   * @param {number} skippedTasks - Number of skipped tasks
   * @returns {string} Improvement report
   */
  generateImprovementReport(recommendations, generatedTasks, skippedTasks) {
    let report = `# Continuous Improvement Report\n\n`;
    
    report += `## Agent Lightning Analysis Results\n\n`;
    report += `- **Total Recommendations**: ${recommendations.length}\n`;
    report += `- **Tasks Generated**: ${generatedTasks.length}\n`;
    report += `- **Duplicate Tasks Skipped**: ${skippedTasks}\n`;
    report += `- **Generated At**: ${new Date().toISOString()}\n\n`;
    
    if (generatedTasks.length > 0) {
      report += `## Generated Improvement Tasks\n\n`;
      
      generatedTasks.forEach((task, index) => {
        report += `${index + 1}. **${task.title}** (${task.id})\n`;
        report += `   - **Effort**: ${task.effort}\n`;
        report += `   - **Category**: ${task.metadata.category}\n`;
        report += `   - **Priority**: ${task.metadata.priority}\n`;
        report += `   - **Description**: ${task.description.split('\n')[0]}\n`;
        report += `\n`;
      });
    } else {
      report += `## No New Tasks Generated\n\n`;
      report += `All recommendations were either duplicates or not actionable.\n\n`;
    }
    
    if (skippedTasks > 0) {
      report += `## Skipped Recommendations\n\n`;
      report += `The following recommendations were skipped as they were identified as duplicates:\n\n`;
      
      const skippedRecommendations = recommendations.slice(0, skippedTasks);
      skippedRecommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec.title}\n`;
      });
      
      report += `\n`;
    }
    
    report += `## Next Steps\n\n`;
    report += `- Review the generated improvement tasks in IMPLEMENTATION_GUIDE.json\n`;
    report += `- Prioritize tasks based on impact and effort\n`;
    report += `- Implement tasks in upcoming development cycles\n`;
    report += `- Run "` + 'kc-orchestrator improve' + `" regularly to get new recommendations\n`;
    
    report += `\n---\n\n`;
    report += `*Report generated by kc-orchestrator ImprovementTaskGenerator*\n`;
    
    return report;
  }
  
  /**
   * Write improvement report to file
   *
   * @param {string} report - Improvement report
   * @param {string} outputPath - Output file path
   * @returns {boolean} True if successful
   */
  writeImprovementReport(report, outputPath) {
    try {
      fs.writeFileSync(outputPath, report, 'utf8');
      if (this.verbose) {
        console.log(`📄 Written improvement report to ${outputPath}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ Failed to write improvement report: ${error.message}`);
      return false;
    }
  }
}

module.exports = { ImprovementTaskGenerator };