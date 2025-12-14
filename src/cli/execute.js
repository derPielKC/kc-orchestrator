const path = require('path');
const { TaskExecutionEngine } = require('../engine');
const { TelemetryManager } = require('../telemetry/TelemetryManager');
const { findTaskById, extractTasks } = require('../utils/taskExtractor');

/**
 * Execute command implementation
 * 
 * Executes tasks from IMPLEMENTATION_GUIDE.json using TaskExecutionEngine
 */

/**
 * Add execute command to CLI program
 * 
 * @param {object} program - Commander program instance
 */
function executeCommand(program) {
  program
    .command('execute')
    .description('Execute tasks from IMPLEMENTATION_GUIDE.json')
    .option('--project <name>', 'Project name for telemetry')
    .option('--task <id>', 'Execute specific task by ID')
    .option('--phase <name>', 'Execute all tasks in a specific phase')
    .option('--max-retries <number>', 'Maximum retries per task', '3')
    .option('--timeout <ms>', 'Task timeout in milliseconds', '300000')
    .option('--provider <name>', 'Preferred AI provider')
    .option('--non-interactive', 'Disable interactive prompts', false)
    .option('--verbose', 'Enable verbose output', false)
    .action(async (options) => {
      try {
        const verbose = options.verbose || program.opts().verbose;
        const nonInteractive = options.nonInteractive || program.opts().nonInteractive;
        const projectPath = process.cwd();
        const guidePath = options.config || program.opts().config || path.join(projectPath, 'IMPLEMENTATION_GUIDE.json');
        const projectName = options.project || program.opts().project || path.basename(projectPath);
        
        if (verbose) {
          console.log('🚀 Starting task execution...');
          console.log(`   Project: ${projectName}`);
          console.log(`   Guide: ${guidePath}`);
          console.log(`   Path: ${projectPath}`);
        }
        
        // Initialize telemetry
        const telemetryManager = new TelemetryManager({
          baseDir: path.join(projectPath, '.kc-orchestrator', 'runs'),
          verbose
        });
        
        const runId = telemetryManager.startRun({
          project: projectName,
          command: 'execute',
          options: {
            task: options.task,
            phase: options.phase,
            maxRetries: options.maxRetries,
            timeout: options.timeout,
            provider: options.provider
          }
        });
        
        // Initialize engine
        const engine = new TaskExecutionEngine({
          projectPath,
          guidePath,
          maxRetries: parseInt(options.maxRetries) || 3,
          taskTimeout: parseInt(options.timeout) || 300000,
          verbose,
          nonInteractive
        });
        
        // Set provider order if specified
        if (options.provider) {
          const providerOrder = [options.provider.toLowerCase()];
          engine.providerOrder = providerOrder;
          engine.providerManager = new (require('../providers/ProviderManager'))({
            providerOrder,
            timeout: parseInt(options.timeout) || 300000,
            verbose: verbose
          });
          
          if (verbose) {
            console.log(`🎯 Using provider: ${options.provider}`);
            console.log(`   Available providers: ${engine.providerManager.getAvailableProviders().join(', ')}`);
          }
        }
        
        // Log execution start
        telemetryManager.logEvent('execution_start', {
          runId,
          taskFilter: options.task || options.phase || 'all'
        });
        
        let result;
        
        // Execute specific task, phase, or all tasks
        if (options.task) {
          if (verbose) {
            console.log(`🎯 Executing task: ${options.task}`);
          }
          
          const { readGuide: readGuideConfig } = require('../config');
          const guide = readGuideConfig(guidePath, false);
          
          if (!guide) {
            console.error(`❌ Error: Could not read IMPLEMENTATION_GUIDE.json`);
            process.exit(1);
          }
          
          const task = findTaskById(guide, options.task);
          
          if (!task) {
            console.error(`❌ Error: Task ${options.task} not found in IMPLEMENTATION_GUIDE.json`);
            process.exit(1);
          }
          
          telemetryManager.logTaskSelection(task, options.provider || 'auto');
          const taskResult = await engine.executeTask(task);
          
          // Create result object
          result = {
            totalTasks: 1,
            completed: taskResult.success ? 1 : 0,
            failed: taskResult.success ? 0 : 1,
            skipped: 0,
            executionLog: [{
              taskId: task.id,
              status: taskResult.success ? 'completed' : 'failed',
              ...taskResult
            }],
            duration: taskResult.duration || 0,
            success: taskResult.success !== false
          };
          
          telemetryManager.logTaskExecution(task, taskResult.provider || 'unknown', {
            success: taskResult.success !== false,
            duration: taskResult.duration,
            error: taskResult.error
          });
          
        } else if (options.phase) {
          if (verbose) {
            console.log(`📦 Executing phase: ${options.phase}`);
          }
          
          // Filter tasks by phase
          const { readGuide: readGuideConfig } = require('../config');
          const guide = readGuideConfig(guidePath, false);
          
          if (!guide) {
            console.error(`❌ Error: Could not read IMPLEMENTATION_GUIDE.json`);
            process.exit(1);
          }
          
          // Extract all tasks
          const allTasks = extractTasks(guide);
          
          // Filter by phase
          const phaseTasks = allTasks.filter(task => {
            // Check if task belongs to phase
            if (task.phase === options.phase) return true;
            if (task.epic === options.phase) return true;
            
            // Check phases array
            const phase = guide.phases?.find(p => p.name === options.phase);
            if (phase) {
              if (phase.tasks?.some(pt => pt.id === task.id)) return true;
              if (phase.tasks?.some(pt => pt === task.id)) return true;
            }
            
            return false;
          });
          
          if (phaseTasks.length === 0) {
            console.warn(`⚠️  No tasks found for phase "${options.phase}"`);
            process.exit(0);
          }
          
          // Execute tasks sequentially
          result = {
            totalTasks: phaseTasks.length,
            completed: 0,
            failed: 0,
            skipped: 0,
            executionLog: []
          };
          
          for (const task of phaseTasks) {
            try {
              telemetryManager.logTaskSelection(task, options.provider || 'auto');
              const taskResult = await engine.executeTask(task);
              result.completed++;
              result.executionLog.push({
                taskId: task.id,
                status: 'completed',
                ...taskResult
              });
              
              telemetryManager.logTaskExecution(task, taskResult.provider || 'unknown', {
                success: true,
                duration: taskResult.duration
              });
              
            } catch (error) {
              result.failed++;
              result.executionLog.push({
                taskId: task.id,
                status: 'failed',
                error: error.message
              });
              
              telemetryManager.logTaskExecution(task, 'unknown', {
                success: false,
                error: error.message
              });
              
              if (!nonInteractive) {
                console.error(`❌ Task ${task.id} failed: ${error.message}`);
              }
            }
          }
          
        } else {
          // Execute all tasks
          if (verbose) {
            console.log('📋 Executing all tasks...');
          }
          
          result = await engine.executeAllTasksWithRecovery({
            resume: false
          });
        }
        
        // Log completion
        telemetryManager.logRunCompletion({
          runId,
          success: result.success !== false,
          totalTasks: result.totalTasks || result.completed + result.failed,
          completed: result.completed || 0,
          failed: result.failed || 0,
          duration: result.duration || 0
        });
        
        // Output results
        console.log('\n📊 Execution Summary');
        console.log('═'.repeat(60));
        console.log(`Total Tasks:  ${result.totalTasks || (result.completed + result.failed)}`);
        console.log(`✅ Completed: ${result.completed || 0}`);
        console.log(`❌ Failed:    ${result.failed || 0}`);
        console.log(`⏭️  Skipped:   ${result.skipped || 0}`);
        
        if (result.duration) {
          console.log(`⏱️  Duration:   ${(result.duration / 1000).toFixed(2)}s`);
        }
        
        if (result.recoveredFromCheckpoint) {
          console.log('🔄 Recovered from checkpoint');
        }
        
        // Exit with appropriate code
        if (result.failed > 0) {
          process.exit(1);
        }
        
      } catch (error) {
        console.error('❌ Fatal error:', error.message);
        if (verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}

module.exports = { executeCommand };
