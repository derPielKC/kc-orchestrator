const { TelemetryManager } = require('../TelemetryManager');
const { RunSummarizer } = require('../RunSummarizer');
const { AgentLightningIntegration } = require('../AgentLightningIntegration');
const { ImprovementTaskGenerator } = require('../ImprovementTaskGenerator');
const fs = require('fs');
const path = require('path');

/**
 * Improve command implementation
 *
 * This module implements the 'improve' CLI command that:
 * 1. Aggregates recent telemetry data
 * 2. Generates summary reports
 * 3. Invokes Agent Lightning for analysis
 * 4. Generates improvement tasks
 * 5. Updates IMPLEMENTATION_GUIDE.json
 * 6. Updates NEXTSESSION_PROMPT.md
 */

/**
 * Add improve command to CLI program
 *
 * @param {object} program - Commander program instance
 */
function improveCommand(program) {
  program
    .command('improve')
    .description('Run continuous improvement analysis using Agent Lightning')
    .option('--last <number>', 'Number of recent runs to analyze (default: 5)', '5')
    .option('--project <name>', 'Filter runs by project name')
    .option('--output-dir <path>', 'Output directory for reports')
    .option('--dry-run', 'Perform analysis without updating files', false)
    .option('--skip-agent-lightning', 'Skip Agent Lightning invocation (use summary only)', false)
    .option('--verbose', 'Enable verbose logging', false)
    .action(async (options) => {
      try {
        const verbose = options.verbose || program.opts().verbose;
        
        if (verbose) {
          console.log('🚀 Starting continuous improvement analysis...');
          console.log(`📊 Analyzing last ${options.last} runs${options.project ? ` for project ${options.project}` : ''}`);
        }
        
        // Initialize components
        const telemetryManager = new TelemetryManager({ verbose });
        const runSummarizer = new RunSummarizer({ verbose });
        const agentLightning = new AgentLightningIntegration({ verbose });
        const taskGenerator = new ImprovementTaskGenerator({ verbose });
        
        // Check Agent Lightning availability
        const aglConfig = agentLightning.validateConfiguration();
        if (!options.skipAgentLightning && !aglConfig.available) {
          console.warn('⚠️  Agent Lightning not available, running in summary-only mode');
          console.warn(`   Issues: ${aglConfig.issues.join(', ')}`);
        }
        
        // Step 1: Get recent runs
        const recentRuns = telemetryManager.getRecentRuns(parseInt(options.last));
        
        if (verbose) {
          console.log(`📋 Found ${recentRuns.length} recent runs to analyze`);
        }
        
        if (recentRuns.length === 0) {
          console.log('⚠️  No recent runs found for analysis');
          return;
        }
        
        // Step 2: Generate summary report
        const summaryResult = runSummarizer.generateSummaryReport(
          parseInt(options.last), 
          options.project
        );
        
        if (verbose) {
          console.log(`📊 Generated summary report: ${summaryResult.runsAnalyzed} runs analyzed`);
          console.log(`🔴 Found ${summaryResult.painPoints.length} pain points`);
        }
        
        // Prepare output directory
        const outputDir = options.outputDir || path.join(process.cwd(), '.kc-orchestrator', 'improvement-reports');
        const reportTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportDir = path.join(outputDir, `report-${reportTimestamp}`);
        
        try {
          fs.mkdirSync(reportDir, { recursive: true });
        } catch (error) {
          console.warn(`⚠️  Failed to create output directory: ${error.message}`);
        }
        
        // Write summary report
        const summaryReportPath = path.join(reportDir, 'summary-report.md');
        runSummarizer.writeSummaryReport(summaryResult.markdownReport, summaryReportPath);
        
        if (verbose) {
          console.log(`📄 Written summary report to ${summaryReportPath}`);
        }
        
        // Step 3: Invoke Agent Lightning (unless skipped)
        let agentLightningResult = null;
        
        if (!options.skipAgentLightning && aglConfig.available) {
          if (verbose) {
            console.log('🤖 Invoking Agent Lightning for analysis...');
          }
          
          // Prepare run data for Agent Lightning
          const runData = recentRuns.map(run => {
            const events = telemetryManager.getRunEvents(run.runId);
            return {
              runId: run.runId,
              summary: run,
              events: events
            };
          });
          
          agentLightningResult = await agentLightning.invokeAgentLightning(
            summaryResult.markdownReport,
            runData,
            {
              projectName: options.project || 'kc-orchestrator',
              outputFormat: 'markdown'
            }
          );
          
          if (agentLightningResult.success) {
            if (verbose) {
              console.log(`✅ Agent Lightning generated ${agentLightningResult.recommendations.length} recommendations`);
            }
          } else {
            console.error(`❌ Agent Lightning failed: ${agentLightningResult.error}`);
          }
        } else {
          if (verbose) {
            console.log('📊 Using summary analysis only (Agent Lightning skipped)');
          }
          
          // Generate recommendations from pain points
          agentLightningResult = {
            success: true,
            recommendations: this._generateRecommendationsFromPainPoints(summaryResult.painPoints)
          };
        }
        
        // Step 4: Generate improvement tasks
        const existingTasks = taskGenerator.readExistingTasks();
        
        const taskGenerationResult = taskGenerator.generateImprovementTasks(
          agentLightningResult.recommendations,
          {
            projectName: options.project || 'kc-orchestrator',
            existingTasks: existingTasks
          }
        );
        
        if (verbose) {
          console.log(`🎯 Generated ${taskGenerationResult.generatedTasks.length} improvement tasks`);
          console.log(`⏭️  Skipped ${taskGenerationResult.skippedTasks} duplicate tasks`);
        }
        
        // Generate improvement report
        const improvementReport = taskGenerator.generateImprovementReport(
          agentLightningResult.recommendations,
          taskGenerationResult.generatedTasks,
          taskGenerationResult.skippedTasks
        );
        
        const improvementReportPath = path.join(reportDir, 'improvement-report.md');
        taskGenerator.writeImprovementReport(improvementReport, improvementReportPath);
        
        if (verbose) {
          console.log(`📄 Written improvement report to ${improvementReportPath}`);
        }
        
        // Step 5: Update IMPLEMENTATION_GUIDE.json (unless dry run)
        if (!options.dryRun && taskGenerationResult.generatedTasks.length > 0) {
          const success = taskGenerator.addTasksToGuide(taskGenerationResult.generatedTasks, {
            phaseName: 'Continuous Improvement (Agent Lightning)'
          });
          
          if (success) {
            console.log(`✅ Added ${taskGenerationResult.generatedTasks.length} improvement tasks to IMPLEMENTATION_GUIDE.json`);
          } else {
            console.error('❌ Failed to update IMPLEMENTATION_GUIDE.json');
          }
        } else if (options.dryRun) {
          console.log('📝 Dry run: Would add tasks to IMPLEMENTATION_GUIDE.json');
        }
        
        // Step 6: Update NEXTSESSION_PROMPT.md
        if (!options.dryRun) {
          this._updateNextSessionPrompt(
            taskGenerationResult.generatedTasks,
            summaryResult.painPoints,
            options.project
          );
        }
        
        // Final summary
        console.log('\n🎉 Continuous Improvement Analysis Complete!');
        console.log(`📊 Runs Analyzed: ${summaryResult.runsAnalyzed}`);
        console.log(`🔴 Pain Points Found: ${summaryResult.painPoints.length}`);
        console.log(`🤖 Agent Lightning Recommendations: ${agentLightningResult.recommendations.length}`);
        console.log(`🎯 Tasks Generated: ${taskGenerationResult.generatedTasks.length}`);
        console.log(`⏭️  Tasks Skipped: ${taskGenerationResult.skippedTasks}`);
        console.log(`📁 Reports Saved: ${reportDir}`);
        
        if (!options.dryRun && taskGenerationResult.generatedTasks.length > 0) {
          console.log('\n📋 Next Steps:');
          console.log('1. Review the generated improvement tasks in IMPLEMENTATION_GUIDE.json');
          console.log('2. Check the improvement reports for detailed analysis');
          console.log('3. Run `kc-orchestrator improve` regularly for continuous improvement');
        }
        
      } catch (error) {
        console.error(`❌ Continuous improvement analysis failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
      }
    });
}

/**
 * Generate recommendations from pain points (fallback when Agent Lightning is not available)
 *
 * @param {Array} painPoints - Array of pain points
 * @returns {Array} Generated recommendations
 */
function _generateRecommendationsFromPainPoints(painPoints) {
  const recommendations = [];
  
  painPoints.forEach((painPoint, index) => {
    const recommendation = {
      id: `FALLBACK-${Date.now()}-${index}`,
      title: `Address ${painPoint.type.replace(/_/g, ' ')} issue`,
      description: `Implement improvements to address the ${painPoint.type} pain point: ${painPoint.description}. ${painPoint.details ? JSON.stringify(painPoint.details) : ''}`,
      priority: painPoint.severity,
      category: painPoint.type,
      impact: 'medium',
      implementation: `Analyze the ${painPoint.type} issue and implement appropriate fixes. Consider ${painPoint.details ? painPoint.details.examples ? 'the specific examples mentioned' : 'the provided details' : 'best practices'}.`
    };
    
    recommendations.push(recommendation);
  });
  
  return recommendations;
}

/**
 * Update NEXTSESSION_PROMPT.md with improvement information
 *
 * @param {Array} generatedTasks - Generated improvement tasks
 * @param {Array} painPoints - Identified pain points
 * @param {string} projectName - Project name
 */
function _updateNextSessionPrompt(generatedTasks, painPoints, projectName) {
  try {
    const promptPath = path.join(process.cwd(), 'NEXTSESSION_PROMPT.md');
    
    // Read existing content
    let existingContent = '';
    if (fs.existsSync(promptPath)) {
      existingContent = fs.readFileSync(promptPath, 'utf8');
    }
    
    // Generate improvement section
    const improvementSection = this._generateImprovementSection(generatedTasks, painPoints, projectName);
    
    // Update or append to file
    const updatedContent = existingContent.includes('## Continuous Improvement')
      ? existingContent.replace(
          /## Continuous Improvement.*/s,
          improvementSection
        )
      : `${existingContent}\n\n${improvementSection}`;
    
    fs.writeFileSync(promptPath, updatedContent, 'utf8');
    
    console.log(`📝 Updated NEXTSESSION_PROMPT.md with improvement information`);
    
  } catch (error) {
    console.error(`⚠️  Failed to update NEXTSESSION_PROMPT.md: ${error.message}`);
  }
}

/**
 * Generate improvement section for NEXTSESSION_PROMPT.md
 *
 * @param {Array} generatedTasks - Generated improvement tasks
 * @param {Array} painPoints - Identified pain points
 * @param {string} projectName - Project name
 * @returns {string} Improvement section content
 */
function _generateImprovementSection(generatedTasks, painPoints, projectName) {
  let section = `## Continuous Improvement (Agent Lightning)\n\n`;
  
  section += `### Recent Analysis Results\n\n`;
  section += `- **Analysis Date**: ${new Date().toISOString()}\n`;
  section += `- **Project**: ${projectName || 'kc-orchestrator'}\n`;
  section += `- **Pain Points Identified**: ${painPoints.length}\n`;
  section += `- **Improvement Tasks Generated**: ${generatedTasks.length}\n\n`;
  
  if (painPoints.length > 0) {
    section += `### Key Pain Points\n\n`;
    
    painPoints.slice(0, 3).forEach((painPoint, index) => {
      section += `${index + 1}. **${painPoint.description}** (Severity: ${painPoint.severity})\n`;
    });
    
    section += `\n`;
  }
  
  if (generatedTasks.length > 0) {
    section += `### Next Improvement Tasks\n\n`;
    section += `The following tasks have been added to IMPLEMENTATION_GUIDE.json and should be prioritized:\n\n`;
    
    generatedTasks.slice(0, 5).forEach((task, index) => {
      section += `${index + 1}. **${task.title}** (${task.id})\n`;
      section += `   - Effort: ${task.effort}\n`;
      section += `   - Category: ${task.metadata.category}\n`;
      section += `   - Priority: ${task.metadata.priority}\n`;
      section += `\n`;
    });
    
    section += `### Implementation Constraints\n\n`;
    section += `- All improvements must maintain backward compatibility\n`;
    section += `- Follow existing code style and patterns\n`;
    section += `- Add appropriate tests for all changes\n`;
    section += `- Document changes in code comments and documentation\n`;
    section += `- Do not break existing functionality\n`;
    section += `- Respect privacy and security constraints\n\n`;
  } else {
    section += `### No New Tasks\n\n`;
    section += `No new improvement tasks were generated in this analysis cycle.\n\n`;
  }
  
  section += `### Next Steps\n\n`;
  section += `- Review and prioritize the generated improvement tasks\n`;
  section += `- Implement tasks in upcoming development sessions\n`;
  section += `- Run "` + 'kc-orchestrator improve' + `" regularly for continuous improvement\n`;
  section += `- Monitor telemetry to track progress on pain points\n\n`;
  
  return section;
}

module.exports = {
  improveCommand,
  _generateRecommendationsFromPainPoints,
  _updateNextSessionPrompt,
  _generateImprovementSection
};