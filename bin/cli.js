#!/usr/bin/env node

// CLI entry point for kc-orchestrator

const { program } = require('commander');
const packageJson = require('../package.json');
const { improveCommand } = require('../src/telemetry/cli/improve');

program
  .name('kc-orchestrator')
  .description('Universal CLI orchestrator for multi-project repositories')
  .version(packageJson.version, '-v, --version', 'output the current version')
  .option('--verbose', 'enable verbose output', false)
  .option('--non-interactive', 'disable interactive prompts', false)
  .option('--auto-answer <answers>', 'provide automatic answers for interview mode')
  .option('--dry-run', 'perform a dry run without making changes', false)
  .option('--config <path>', 'specify custom config file path')
  .option('--project <name>', 'specify project to work on')
  .option('--provider <name>', 'specify AI provider to use')
  .addHelpText('before', `
kc-orchestrator v${packageJson.version}
Universal CLI orchestrator for multi-project repositories
`) 
  .addHelpText('after', `
Examples:
  $ kc-orchestrator --help
  $ kc-orchestrator --version
  $ kc-orchestrator init --verbose
  $ kc-orchestrator status
  $ kc-orchestrator execute
  $ kc-orchestrator continue
  $ kc-orchestrator improve --last 5 --project my-project
`);

// Add improve command
improveCommand(program);

// Add init command
const { initCommand } = require('../src/cli/init');
initCommand(program);

// Add status command
const { statusCommand } = require('../src/cli/status');
statusCommand(program);

// Add execute command
const { executeCommand } = require('../src/cli/execute');
executeCommand(program);

// Add continue command
const { continueCommand } = require('../src/cli/continue');
continueCommand(program);

// Parse arguments
program.parse(process.argv);

// Store options for use by other modules
const options = program.opts();

// If no command is provided, show help
if (program.args.length === 0) {
  program.help();
}

// Export options for use by other modules
module.exports = { options };