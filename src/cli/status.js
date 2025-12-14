const path = require('path');
const { readGuide } = require('../config');

/**
 * Status command implementation
 * 
 * Shows the current status of all tasks in IMPLEMENTATION_GUIDE.json
 */

/**
 * Add status command to CLI program
 * 
 * @param {object} program - Commander program instance
 */
function statusCommand(program) {
  program
    .command('status')
    .description('Show current status of all tasks from IMPLEMENTATION_GUIDE.json')
    .option('--project <name>', 'Filter by project name')
    .option('--phase <name>', 'Filter by phase name')
    .option('--status <status>', 'Filter by task status (todo, in_progress, completed, failed)')
    .option('--json', 'Output as JSON', false)
    .option('--verbose', 'Enable verbose output', false)
    .action((options) => {
      try {
        const verbose = options.verbose || program.opts().verbose;
        const guidePath = options.config || program.opts().config || path.join(process.cwd(), 'IMPLEMENTATION_GUIDE.json');
        
        if (verbose) {
          console.log(`📋 Reading IMPLEMENTATION_GUIDE.json from: ${guidePath}`);
        }
        
        // Read guide (non-strict mode to support different structures)
        const guide = readGuide(guidePath, false);
        
        if (!guide) {
          console.error('❌ Error: Could not read or parse IMPLEMENTATION_GUIDE.json');
          console.error(`   Path: ${guidePath}`);
          console.error('   Run "kc-orchestrator init" to create one.');
          process.exit(1);
        }
        
        // Extract project name (support both root.project and meta.project)
        const projectName = guide.project || (guide.meta && guide.meta.project) || 'unknown';
        
        // Extract tasks (support different structures)
        let tasks = [];
        
        if (Array.isArray(guide.tasks)) {
          // Standard structure
          tasks = guide.tasks;
        } else if (Array.isArray(guide.epics)) {
          // Epic-based structure - flatten epics into tasks
          guide.epics.forEach(epic => {
            if (Array.isArray(epic.tasks)) {
              tasks.push(...epic.tasks);
            }
            if (Array.isArray(epic.chunks)) {
              tasks.push(...epic.chunks);
            }
          });
        } else if (guide.meta && Array.isArray(guide.meta.policies)) {
          // Policy-based structure
          tasks = guide.meta.policies.filter(p => p.chunk_id || p.id);
        }
        
        // Normalize task structure
        tasks = tasks.map(task => {
          // Handle different task structures
          const normalized = {
            id: task.id || task.chunk_id || task.taskId || 'unknown',
            title: task.title || task.description || task.name || 'Untitled Task',
            status: task.status || 'unknown',
            phase: task.phase || task.epic || 'Unknown'
          };
          
          // Preserve original data
          Object.keys(task).forEach(key => {
            if (!normalized[key]) {
              normalized[key] = task[key];
            }
          });
          
          return normalized;
        });
        
        if (options.project && projectName !== options.project) {
          console.warn(`⚠️  Project mismatch: guide has "${projectName}", filter requested "${options.project}"`);
        }
        
        if (options.phase) {
          tasks = tasks.filter(task => {
            // Find task's phase
            const phase = guide.phases?.find(p => 
              p.tasks?.some(t => t.id === task.id)
            );
            return phase?.name === options.phase;
          });
        }
        
        if (options.status) {
          tasks = tasks.filter(task => task.status === options.status);
        }
        
        // Group tasks by status
        const byStatus = {
          todo: tasks.filter(t => t.status === 'todo' || t.status === 'pending'),
          in_progress: tasks.filter(t => t.status === 'in_progress'),
          completed: tasks.filter(t => t.status === 'completed'),
          failed: tasks.filter(t => t.status === 'failed')
        };
        
        // Calculate statistics
        const stats = {
          total: tasks.length,
          todo: byStatus.todo.length,
          in_progress: byStatus.in_progress.length,
          completed: byStatus.completed.length,
          failed: byStatus.failed.length
        };
        
        // Output format
        if (options.json) {
          console.log(JSON.stringify({
            project: projectName,
            statistics: stats,
            tasks: tasks.map(task => ({
              id: task.id,
              title: task.title,
              status: task.status,
              phase: task.phase || guide.phases?.find(p => 
                p.tasks?.some(t => t.id === task.id)
              )?.name || 'Unknown'
            }))
          }, null, 2));
        } else {
        // Human-readable output
        console.log('\n📊 Task Status Report');
        console.log('═'.repeat(60));
        console.log(`Project: ${projectName}`);
        console.log(`Guide: ${guidePath}`);
        
        if (tasks.length === 0) {
          console.log('\n⚠️  No tasks found in IMPLEMENTATION_GUIDE.json');
          console.log('   The file may use a different structure.');
          console.log('   Supported structures:');
          console.log('     - Standard: { project, tasks: [...] }');
          console.log('     - Epics: { epics: [{ tasks: [...] }] }');
          console.log('     - Meta: { meta: { project, policies: [...] } }');
          process.exit(0);
        }
        
        console.log('');
          
          // Statistics
          console.log('📈 Statistics:');
          console.log(`   Total Tasks:    ${stats.total}`);
          console.log(`   ✅ Completed:   ${stats.completed} (${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}%)`);
          console.log(`   🔄 In Progress:  ${stats.in_progress} (${stats.total > 0 ? Math.round(stats.in_progress / stats.total * 100) : 0}%)`);
          console.log(`   ❌ Failed:       ${stats.failed} (${stats.total > 0 ? Math.round(stats.failed / stats.total * 100) : 0}%)`);
          console.log(`   📝 Todo:         ${stats.todo} (${stats.total > 0 ? Math.round(stats.todo / stats.total * 100) : 0}%)`);
          console.log('');
          
          // Tasks by status
          if (byStatus.completed.length > 0) {
            console.log('✅ Completed Tasks:');
            byStatus.completed.forEach(task => {
              const phase = task.phase || guide.phases?.find(p => 
                p.tasks?.some(t => t.id === task.id)
              )?.name;
              console.log(`   ${String(task.id).padEnd(12)} ${task.title} ${phase ? `[${phase}]` : ''}`);
            });
            console.log('');
          }
          
          if (byStatus.in_progress.length > 0) {
            console.log('🔄 In Progress Tasks:');
            byStatus.in_progress.forEach(task => {
              const phase = task.phase || guide.phases?.find(p => 
                p.tasks?.some(t => t.id === task.id)
              )?.name;
              console.log(`   ${String(task.id).padEnd(12)} ${task.title} ${phase ? `[${phase}]` : ''}`);
            });
            console.log('');
          }
          
          if (byStatus.failed.length > 0) {
            console.log('❌ Failed Tasks:');
            byStatus.failed.forEach(task => {
              const phase = task.phase || guide.phases?.find(p => 
                p.tasks?.some(t => t.id === task.id)
              )?.name;
              console.log(`   ${String(task.id).padEnd(12)} ${task.title} ${phase ? `[${phase}]` : ''}`);
            });
            console.log('');
          }
          
          if (byStatus.todo.length > 0) {
            console.log('📝 Todo Tasks:');
            byStatus.todo.forEach(task => {
              const phase = task.phase || guide.phases?.find(p => 
                p.tasks?.some(t => t.id === task.id)
              )?.name;
              console.log(`   ${String(task.id).padEnd(12)} ${task.title} ${phase ? `[${phase}]` : ''}`);
            });
            console.log('');
          }
          
          // Progress bar
          if (stats.total > 0) {
            const progress = Math.round((stats.completed / stats.total) * 100);
            const barLength = 30;
            const filled = Math.round((progress / 100) * barLength);
            const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
            console.log(`Progress: [${bar}] ${progress}%`);
          }
        }
        
      } catch (error) {
        console.error('❌ Error:', error.message);
        if (verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}

module.exports = { statusCommand };
