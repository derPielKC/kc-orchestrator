const path = require('path');
const { TaskExecutionEngine } = require('../engine');
const { TelemetryManager } = require('../telemetry/TelemetryManager');

/**
 * Continue command implementation
 * 
 * Resumes interrupted task execution from the latest checkpoint
 */

/**
 * Add continue command to CLI program
 * 
 * @param {object} program - Commander program instance
 */
function continueCommand(program) {
  program
    .command('continue')
    .alias('resume')
    .description('Resume interrupted task execution from the latest checkpoint')
    .option('--checkpoint <path>', 'Specific checkpoint to resume from')
    .option('--project <name>', 'Project name for telemetry')
    .option('--max-retries <number>', 'Maximum retries per task', '3')
    .option('--timeout <ms>', 'Task timeout in milliseconds', '300000')
    .option('--verbose', 'Enable verbose output', false)
    .action(async (options) => {
      try {
        const verbose = options.verbose || program.opts().verbose;
        const projectPath = process.cwd();
        const guidePath = options.config || program.opts().config || path.join(projectPath, 'IMPLEMENTATION_GUIDE.json');
        const projectName = options.project || program.opts().project || path.basename(projectPath);
        
        if (verbose) {
          console.log('🔄 Resuming task execution...');
          console.log(`   Project: ${projectName}`);
          console.log(`   Guide: ${guidePath}`);
        }
        
        // Initialize telemetry
        const telemetryManager = new TelemetryManager({
          baseDir: path.join(projectPath, '.kc-orchestrator', 'runs'),
          verbose
        });
        
        const runId = telemetryManager.startRun({
          project: projectName,
          command: 'continue',
          options: {
            checkpoint: options.checkpoint,
            maxRetries: options.maxRetries,
            timeout: options.timeout
          }
        });
        
        // Initialize engine
        const engine = new TaskExecutionEngine({
          projectPath,
          guidePath,
          maxRetries: parseInt(options.maxRetries) || 3,
          taskTimeout: parseInt(options.timeout) || 300000,
          verbose
        });
        
        // Check for checkpoints
        const checkpointDir = path.join(projectPath, '.kc-orchestrator', 'checkpoints');
        const fs = require('fs');
        
        if (!fs.existsSync(checkpointDir)) {
          console.error('❌ Error: No checkpoint directory found.');
          console.error(`   Expected: ${checkpointDir}`);
          console.error('   Run "kc-orchestrator execute" first to create checkpoints.');
          process.exit(1);
        }
        
        // Find checkpoint
        let checkpointPath = options.checkpoint;
        
        if (!checkpointPath) {
          // Find latest checkpoint
          try {
            const checkpoints = fs.readdirSync(checkpointDir)
              .filter(f => f.endsWith('.json'))
              .map(f => ({
                path: path.join(checkpointDir, f),
                mtime: fs.statSync(path.join(checkpointDir, f)).mtime
              }))
              .sort((a, b) => b.mtime - a.mtime);
            
            if (checkpoints.length === 0) {
              console.error('❌ Error: No checkpoints found.');
              console.error(`   Directory: ${checkpointDir}`);
              console.error('   Run "kc-orchestrator execute" first to create checkpoints.');
              process.exit(1);
            }
            
            checkpointPath = checkpoints[0].path;
            
            if (verbose) {
              console.log(`📂 Found ${checkpoints.length} checkpoint(s), using latest:`);
              console.log(`   ${checkpointPath}`);
            }
          } catch (error) {
            console.error(`❌ Error reading checkpoint directory: ${error.message}`);
            process.exit(1);
          }
        }
        
        // Verify checkpoint exists
        if (!fs.existsSync(checkpointPath)) {
          console.error(`❌ Error: Checkpoint not found: ${checkpointPath}`);
          process.exit(1);
        }
        
        // Log resumption
        telemetryManager.logEvent('execution_resume', {
          runId,
          checkpointPath
        });
        
        if (verbose) {
          console.log(`📂 Loading checkpoint: ${checkpointPath}`);
        }
        
        // Resume execution
        const result = await engine.executeAllTasksWithRecovery({
          resume: true,
          checkpointPath
        });
        
        // Log completion
        telemetryManager.logRunCompletion({
          runId,
          success: result.success !== false,
          totalTasks: result.totalTasks || (result.completed + result.failed),
          completed: result.completed || 0,
          failed: result.failed || 0,
          duration: result.duration || 0,
          recoveredFromCheckpoint: true
        });
        
        // Output results
        console.log('\n📊 Execution Summary (Resumed)');
        console.log('═'.repeat(60));
        console.log(`Total Tasks:  ${result.totalTasks || (result.completed + result.failed)}`);
        console.log(`✅ Completed: ${result.completed || 0}`);
        console.log(`❌ Failed:    ${result.failed || 0}`);
        console.log(`⏭️  Skipped:   ${result.skipped || 0}`);
        
        if (result.duration) {
          console.log(`⏱️  Duration:   ${(result.duration / 1000).toFixed(2)}s`);
        }
        
        if (result.recoveredFromCheckpoint) {
          console.log('🔄 Successfully recovered from checkpoint');
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

module.exports = { continueCommand };
