const fs = require('fs');
const path = require('path');

/**
 * Init command implementation
 *
 * This module implements the 'init' CLI command that:
 * 1. Creates the .kc-orchestrator directory structure
 * 2. Sets up initial configuration files
 * 3. Creates essential files like IMPLEMENTATION_GUIDE.json and NEXTSESSION_PROMPT.md
 * 4. Validates the setup
 */

/**
 * Add init command to CLI program
 *
 * @param {object} program - Commander program instance
 */
function initCommand(program) {
  program
    .command('init')
    .description('Initialize kc-orchestrator in the current directory')
    .option('--force', 'Force initialization even if already initialized', false)
    .option('--minimal', 'Create minimal setup without example files', false)
    .option('--verbose', 'Enable verbose logging', false)
    .action((options) => {
      try {
        const verbose = options.verbose || program.opts().verbose;
        
        if (verbose) {
          console.log('🚀 Starting kc-orchestrator initialization...');
        }
        
        // Check if already initialized
        const kcDir = path.join(process.cwd(), '.kc-orchestrator');
        const guideFile = path.join(process.cwd(), 'IMPLEMENTATION_GUIDE.json');
        const promptFile = path.join(process.cwd(), 'NEXTSESSION_PROMPT.md');
        
        if (!options.force && fs.existsSync(kcDir)) {
          console.error('❌ Error: kc-orchestrator is already initialized in this directory.');
          console.error('   Use --force to reinitialize or change to a different directory.');
          process.exit(1);
        }
        
        if (verbose) {
          console.log(`📁 Working directory: ${process.cwd()}`);
        }
        
        // Step 1: Create .kc-orchestrator directory structure
        if (verbose) {
          console.log('📁 Creating .kc-orchestrator directory structure...');
        }
        
        const directories = [
          '.kc-orchestrator',
          '.kc-orchestrator/runs',
          '.kc-orchestrator/checkpoints',
          '.kc-orchestrator/benchmarks',
          '.kc-orchestrator/agent-lightning'
        ];
        
        directories.forEach(dir => {
          const fullPath = path.join(process.cwd(), dir);
          if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            if (verbose) {
              console.log(`   ✅ Created ${dir}`);
            }
          }
        });
        
        // Step 2: Create IMPLEMENTATION_GUIDE.json (only if it doesn't exist)
        if (!fs.existsSync(guideFile)) {
          if (verbose) {
            console.log('📋 Creating IMPLEMENTATION_GUIDE.json...');
          }
          
          const implementationGuide = {
            "version": "1.0",
            "project": "kc-orchestrator",
            "phases": [
              {
                "name": "Initialization",
                "description": "Setup and configuration of kc-orchestrator",
                "tasks": [
                  {
                    "id": "T1",
                    "title": "Initialize kc-orchestrator",
                    "description": "Run kc-orchestrator init to set up the project",
                    "status": "completed",
                    "effort": "low",
                    "metadata": {
                      "category": "setup",
                      "priority": "high",
                      "dependencies": []
                    }
                  }
                ]
              }
            ],
            "completed": true,
            "timestamp": new Date().toISOString()
          };
          
          fs.writeFileSync(guideFile, JSON.stringify(implementationGuide, null, 2), 'utf8');
          if (verbose) {
            console.log('   ✅ Created IMPLEMENTATION_GUIDE.json');
          }
        } else {
          if (verbose) {
            console.log('📋 IMPLEMENTATION_GUIDE.json already exists, preserving existing file');
          }
        }
        
        // Step 3: Create NEXTSESSION_PROMPT.md (only if it doesn't exist)
        if (!fs.existsSync(promptFile)) {
          if (verbose) {
            console.log('📝 Creating NEXTSESSION_PROMPT.md...');
          }
          
          const nextSessionPrompt = `# kc-orchestrator Next Session Prompt

## Current Status

- **Project**: kc-orchestrator
- **Initialization**: ✅ Completed
- **Version**: 0.1.0

## Next Session Objectives

### Primary Goals
1. Review the current implementation
2. Identify areas for improvement
3. Plan next development steps

### Technical Tasks
- [ ] Review existing code structure
- [ ] Identify missing functionality
- [ ] Plan implementation approach

### Quality Assurance
- [ ] Run existing tests
- [ ] Identify test coverage gaps
- [ ] Plan additional test cases

## Implementation Constraints

- Maintain backward compatibility
- Follow existing code patterns
- Add appropriate documentation
- Ensure proper error handling
- Write comprehensive tests

## Resources

- Documentation: See docs/ directory
- Examples: See examples/ directory
- Tests: See tests/ directory

## Notes

This is a new kc-orchestrator initialization. Review the setup and plan next steps accordingly.
`;
          
          fs.writeFileSync(promptFile, nextSessionPrompt, 'utf8');
          if (verbose) {
            console.log('   ✅ Created NEXTSESSION_PROMPT.md');
          }
        } else {
          if (verbose) {
            console.log('📝 NEXTSESSION_PROMPT.md already exists, preserving existing file');
          }
        }
        
        // Step 4: Create config directory and basic config
        if (!options.minimal) {
          if (verbose) {
            console.log('⚙️  Creating config directory...');
          }
          
          const configDir = path.join(process.cwd(), 'config');
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
            if (verbose) {
              console.log('   ✅ Created config directory');
            }
          }
          
          if (verbose) {
            console.log('📄 Creating example configuration files...');
          }
          
          // Create a basic config file
          const configFile = path.join(configDir, 'logging.js');
          const configContent = `// Basic logging configuration for kc-orchestrator

module.exports = {
  level: 'info',
  format: 'json',
  file: {
    enabled: true,
    path: '.kc-orchestrator/logs',
    maxSize: '10m',
    maxFiles: '7'
  },
  console: {
    enabled: true,
    level: 'info'
  }
};
`;
          
          fs.writeFileSync(configFile, configContent, 'utf8');
          if (verbose) {
            console.log('   ✅ Created config/logging.js');
          }
        }
        
        // Step 6: Create .gitignore entries
        if (verbose) {
          console.log('📝 Updating .gitignore...');
        }
        
        const gitignorePath = path.join(process.cwd(), '.gitignore');
        const gitignoreEntries = [
          '.kc-orchestrator/',
          'node_modules/',
          '*.log',
          '.env',
          '*.swp',
          '*.swo'
        ];
        
        let gitignoreContent = '';
        if (fs.existsSync(gitignorePath)) {
          gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        }
        
        gitignoreEntries.forEach(entry => {
          if (!gitignoreContent.includes(entry)) {
            gitignoreContent += `${entry}\n`;
          }
        });
        
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
        if (verbose) {
          console.log('   ✅ Updated .gitignore');
        }
        
        // Final summary
        console.log('\n✅ kc-orchestrator initialization complete!');
        console.log('\n📋 Next steps:');
        console.log('1. Review the created files:');
        console.log('   - IMPLEMENTATION_GUIDE.json');
        console.log('   - NEXTSESSION_PROMPT.md');
        console.log('   - .kc-orchestrator/ directory');
        console.log('\n2. Customize the configuration in config/ directory');
        console.log('\n3. Start using kc-orchestrator commands:');
        console.log('   - kc-orchestrator improve');
        console.log('   - kc-orchestrator --help');
        
        if (verbose) {
          console.log('\n📁 Created structure:');
          console.log('   .kc-orchestrator/');
          console.log('   ├── runs/');
          console.log('   ├── checkpoints/');
          console.log('   ├── benchmarks/');
          console.log('   └── agent-lightning/');
          console.log('   IMPLEMENTATION_GUIDE.json');
          console.log('   NEXTSESSION_PROMPT.md');
          console.log('   config/');
          console.log('   └── logging.js');
        }
        
      } catch (error) {
        console.error(`❌ Initialization failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
      }
    });
}

module.exports = {
  initCommand
};