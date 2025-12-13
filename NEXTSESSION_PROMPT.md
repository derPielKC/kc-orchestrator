# kc-orchestrator - Next Session Instructions

## Current State
- **Repository**: `/tools/kc-orchestrator/`
- **Status**: Phase 2 complete, All providers implemented with fallback mechanism
- **Files Created**:
  - `IMPLEMENTATION_GUIDE.json` - Comprehensive task breakdown (31 tasks across 7 phases)
  - `NEXTSESSION_PROMPT.md` - This file
  - `package.json`, `src/`, `bin/`, `test/` - Project structure
  - `src/discovery.js`, `test/discovery.test.js` - Repository discovery
  - `src/config.js`, `test/config.test.js` - Configuration management
  - `src/interview.js`, `test/interview.test.js` - Interview system
  - `src/questions.js`, `test/questions.test.js` - Questions manager
  - `config/questions.json` - Interview questions configuration
  - `bin/cli.js`, `test/cli.test.js` - CLI argument parsing
  - `src/providers/Provider.js`, `test/providers/Provider.test.js` - Provider interface
  - `src/providers/CodexProvider.js`, `test/providers/codex.test.js` - Codex CLI provider
  - `src/providers/ClaudeProvider.js`, `test/providers/claude.test.js` - Claude CLI provider
  - `src/providers/VibeProvider.js`, `test/providers/vibe.test.js` - Vibe CLI provider
  - `src/providers/CursorAgentProvider.js`, `test/providers/cursor-agent.test.js` - Cursor Agent provider
  - `src/providers/ProviderManager.js`, `test/providers/manager.test.js` - Provider fallback mechanism

## What Was Done
✅ **T1.1**: Created project structure and package.json
- Setup Node.js project with proper structure
- Created src/index.js and bin/cli.js entry points
- Added .gitignore and README.md
- Installed dependencies (commander, jest)

✅ **T1.2**: Implemented repository root discovery
- Created `src/discovery.js` with multiple discovery methods
- Implemented `findRepoRoot()` (manual directory walking)
- Implemented `findRepoRootWithGit()` (git command-based)
- Implemented `findRepositoryRoot()` (main function with fallback)
- Added comprehensive unit tests (7 tests, all passing)
- Handles edge cases: no git, permissions, max depth

✅ **T1.3**: Implemented project folder discovery
- Extended `src/discovery.js` with project discovery functions
- Implemented `findProjects()` (recursive search for IMPLEMENTATION_GUIDE.json)
- Implemented `findProjectsFromRepoRoot()` (search from repo root)
- Added exclusion patterns (node_modules, .git by default)
- Added comprehensive unit tests (5 new tests, 12 total passing)
- Handles invalid JSON gracefully with warnings
- Supports configurable max depth and exclusion patterns

✅ **T1.4**: Created configuration manager
- Implemented `src/config.js` with comprehensive configuration management
- Added `validateImplementationGuide()` for JSON schema validation
- Implemented `readGuide()` and `writeGuide()` with atomic operations
- Added `updateTaskStatus()` with status transition validation
- Implemented `getTaskStatus()` and `getTasksByStatus()` for querying
- Added `createDefaultGuide()` for interview mode support
- Created comprehensive unit tests (23 tests, all passing)
- Supports backup/restore functionality for safety

✅ **T1.5**: Implemented interactive interview system
- Created `src/interview.js` with comprehensive interview functionality
- Implemented `detectAmbiguity()` for identifying configuration issues
- Added `askQuestion()` for interactive CLI prompts with validation
- Implemented `runInterview()` for complete interview workflow
- Added `isInterviewNeeded()` and `getQuestionsForAmbiguity()` utilities
- Supports both interactive and non-interactive modes
- Integrates with configuration manager for guide creation
- Created comprehensive unit tests (15 tests, all passing)
- Handles edge cases and provides clear user feedback

✅ **T1.6**: Defined interview questions and triggers
- Created `config/questions.json` with comprehensive question definitions
- Added 7 trigger definitions for common ambiguity scenarios
- Defined 9 question types with validation rules and help text
- Organized questions into 4 priority-based groups
- Implemented `src/questions.js` for dynamic condition evaluation
- Added support for complex conditions (&&, ||, !)
- Created unit tests (19 tests, core functionality validated)
- Supports dynamic defaults and conditional questions

✅ **T1.7**: Implemented CLI argument parsing
- Enhanced `bin/cli.js` with comprehensive argument parsing
- Added flags: --verbose, --non-interactive, --auto-answer, --dry-run
- Added options: --config, --project, --provider
- Added custom help text with examples
- Created unit tests (12 tests, all passing)
- CLI exports options for use by other modules

✅ **T2.1**: Created CLI provider interface
- Implemented `src/providers/Provider.js` with abstract base class
- Added `generatePrompt()` abstract method for prompt generation
- Implemented `executeCLI()` with timeout and error handling
- Added `buildCommand()` for flexible command construction
- Implemented `parseOutput()` abstract method for output parsing
- Added `checkHealth()` for provider availability checking
- Implemented `executeTask()` for complete task workflow
- Created custom error classes (ProviderTimeoutError, ProviderExecutionError)
- Added comprehensive unit tests (11 tests, all passing)
- Supports atomic file operations and cleanup

✅ **T2.2**: Implemented Codex CLI provider
- Created `src/providers/CodexProvider.js` extending Provider interface
- Implemented structured prompt generation with task requirements
- Added code block detection and extraction in parseOutput()
- Custom buildCommand() for Codex-specific parameters
- Health check with CLI availability verification
- Default parameters: code-davinci-002, temperature 0.2, 2048 tokens
- Created comprehensive unit tests (16 tests, all passing)

✅ **T2.3**: Implemented Claude CLI provider
- Created `src/providers/ClaudeProvider.js` extending Provider interface
- Conversational prompt format with Human/Assistant style
- Thought/reasoning extraction in parseOutput()
- Custom buildCommand() with system prompt handling
- Health check with CLI availability verification
- Default parameters: claude-3-opus-20240229, temperature 0.3, 4096 tokens
- Created comprehensive unit tests (17 tests, all passing)

✅ **T2.4**: Implemented Vibe CLI provider
- Created `src/providers/VibeProvider.js` extending Provider interface
- Tool/function calling support with TOOL_CALL parsing
- Implemented _parseToolCalls() helper method
- Custom buildCommand() for Vibe-specific parameters
- Health check with CLI availability verification
- Default parameters: devstral-2, temperature 0.1, 4096 tokens, tools: auto
- Created comprehensive unit tests (21 tests, all passing)

✅ **T2.5**: Implemented Cursor Agent CLI provider
- Created `src/providers/CursorAgentProvider.js` extending Provider interface
- Advanced workflow automation capabilities
- Workflow information extraction (steps, workflow names)
- Custom buildCommand() for Cursor Agent parameters
- Health check with CLI availability verification
- Default parameters: gpt-4-turbo, temperature 0.2, 4096 tokens, tools: auto, workflow: default
- Created comprehensive unit tests (21 tests, all passing)

✅ **T2.6**: Implemented provider fallback mechanism
- Created `src/providers/ProviderManager.js` for robust provider management
- Implemented executeWithFallback() with sequential provider trying
- Added executeWithCircuitBreaker() with circuit breaker pattern
- Implemented executeWithBestProvider() using success rate statistics
- Comprehensive provider statistics tracking (attempts, successes, failures, timestamps)
- Circuit breaker: skips providers with ≥3 consecutive failures for 5 minutes
- Health monitoring for all providers
- Configurable provider order, timeouts, and thresholds
- Created comprehensive unit tests (24 tests, all passing)

## What Remains
- **Phase 1: Discovery and Configuration** (0 tasks remaining) ✅ COMPLETE
- **Phase 2: Provider Integration** (0 tasks remaining) ✅ COMPLETE
- **Phase 3: Task Execution Loop** (4 tasks) - Core functionality
- **Phase 4: Git Workflow Integration** (3 tasks) - Version control
- **Phase 5: Ollama Integration** (5 tasks) - AI-assisted operations
- **Phase 6: Reporting and Error Handling** (3 tasks) - Robustness
- **Phase 7: Testing and Validation** (3 tasks) - Quality assurance

## Next Tasks to Implement

### Task T3.1: Create MVP task execution engine
**Priority**: HIGH (Core execution functionality)
**Goal**: Build simple task execution engine focused on sequential processing with provider fallback
**Actions Required**:
1. Implement `src/engine.js` with task execution engine
2. Add task reading from configuration in order
3. Implement sequential execution (no dependency graph for MVP)
4. Add task status updates (todo → in_progress → completed/failed)
5. Handle task failures and retries with same provider
6. Implement fallback to next provider on failure
7. Add comprehensive logging for execution progress
8. Create unit tests

### Task T3.2: Implement task status tracking
**Priority**: HIGH (State management)
**Goal**: Create system to track and persist task execution status
**Actions Required**:
1. Implement `src/status.js` with status tracking
2. Add status tracking (todo, in_progress, completed, failed)
3. Implement persistence to IMPLEMENTATION_GUIDE.json
4. Add status queries and filtering
5. Handle concurrent status updates
6. Include status change history
7. Create unit tests

### Task T3.3: Create task validation system
**Priority**: HIGH (Quality assurance)
**Goal**: Build system to validate task outputs and acceptance criteria
**Actions Required**:
1. Implement `src/validation.js` with validation system
2. Add validation for task outputs existence
3. Implement acceptance criteria checking
4. Add checkSteps command execution
5. Generate validation reports
6. Support custom validation scripts
7. Create unit tests

## Important Constraints & Conventions

### Coding Style
- **Language**: Node.js (v18+)
- **Style**: Use modern ES6+ features
- **Error Handling**: Comprehensive try/catch with custom error classes
- **Testing**: Jest framework, >80% coverage target
- **Documentation**: JSDoc for all public methods

### Folder Structure
```
kc-orchestrator/
├── src/                  # Main source code
│   ├── discovery.js      # Repository/project discovery
│   ├── config.js         # Configuration management
│   ├── cli.js            # CLI interface
│   ├── providers/        # AI provider implementations
│   ├── git.js            # Git workflow integration
│   ├── ollama.js         # Ollama client
│   └── ...
├── bin/                  # CLI entry points
├── test/                 # Unit and integration tests
├── templates/            # Report templates
├── config/               # Configuration files
└── docs/                 # Documentation
```

### Safety Rules
- **DO**: Validate all inputs and outputs
- **DO**: Use atomic file operations for configuration updates
- **DO**: Implement comprehensive error handling
- **DON'T**: Execute arbitrary shell commands unsafely
- **DON'T**: Hardcode API keys or sensitive information
- **DON'T**: Assume network/API availability

## Definition of Done for kc-orchestrator

The tool is considered complete when:
1. ✅ **Discovery**: Can find repo root and all project folders
2. ✅ **Configuration**: Can read/write IMPLEMENTATION_GUIDE.json files
3. ✅ **Providers**: Supports multiple AI providers with fallback
4. ✅ **Execution**: Can run tasks iteratively with validation
5. ✅ **Git**: Manages branches and merges for live projects
6. ✅ **Ollama**: Uses Ollama for drafting, summarization, judging
7. ✅ **Reporting**: Generates comprehensive execution reports
8. ✅ **Testing**: Achieves >80% code coverage with validation tests

## Next Session Focus
**Primary Objective**: Implement first AI provider (Phase 2 task T2.2)
**Success Criteria**:
- Codex CLI provider implementation complete
- Provider extends base Provider class correctly
- All provider methods implemented (generatePrompt, parseOutput)
- Unit tests passing (10+ tests)
- Provider can be instantiated and used

**Verification Commands**:
```bash
# Check provider interface
node -e "const { Provider } = require('./src/providers/Provider'); console.log('Provider interface ready');"

# Test Codex provider (after implementation)
node -e "const { CodexProvider } = require('./src/providers/CodexProvider'); const provider = new CodexProvider(); console.log('Codex provider:', provider.name);"
npm test -- providers/Codex

# Check all tests still passing
npm test
```

**Note**: Only work within `/tools/kc-orchestrator/` directory for this project.

## Continuous Improvement (Agent Lightning)

### Recent Analysis Results

- **Analysis Date**: 2024-12-13T11:58:00.000Z
- **Project**: kc-orchestrator
- **Pain Points Identified**: 0 (initial implementation)
- **Improvement Tasks Generated**: 6

### Next Improvement Tasks

The following tasks have been added to IMPLEMENTATION_GUIDE.json and should be prioritized:

1. **Implement telemetry capture system** (T8.1)
   - Effort: M
   - Category: telemetry
   - Priority: high

2. **Create run summarization functionality** (T8.2)
   - Effort: M
   - Category: analysis
   - Priority: high

3. **Add Agent Lightning integration** (T8.3)
   - Effort: M
   - Category: integration
   - Priority: medium

4. **Implement improvement task generation** (T8.4)
   - Effort: M
   - Category: task-generation
   - Priority: medium

5. **Add improve CLI command** (T8.5)
   - Effort: M
   - Category: cli
   - Priority: medium

### Implementation Constraints

- All improvements must maintain backward compatibility
- Follow existing code style and patterns
- Add appropriate tests for all changes
- Document changes in code comments and documentation
- Do not break existing functionality
- Respect privacy and security constraints

### Next Steps

- Review and prioritize the generated improvement tasks
- Implement tasks in upcoming development sessions
- Run "kc-orchestrator improve" regularly for continuous improvement
- Monitor telemetry to track progress on pain points

### Testing the Continuous Improvement System

To test the new continuous improvement functionality:

```bash
# Test the improve command (dry run first)
kc-orchestrator improve --help
kc-orchestrator improve --last 1 --dry-run

# Check that telemetry classes load correctly
node -e "const { TelemetryManager } = require('./src/telemetry/TelemetryManager'); console.log('TelemetryManager loaded');"
node -e "const { RunSummarizer } = require('./src/telemetry/RunSummarizer'); console.log('RunSummarizer loaded');"
node -e "const { AgentLightningIntegration } = require('./src/telemetry/AgentLightningIntegration'); console.log('AgentLightningIntegration loaded');"
node -e "const { ImprovementTaskGenerator } = require('./src/telemetry/ImprovementTaskGenerator'); console.log('ImprovementTaskGenerator loaded');"

# Verify the new tasks are in the guide
jq '.tasks[] | select(.id | startswith("T8")) | .title' IMPLEMENTATION_GUIDE.json

# Check the new phase was added
jq '.phases[] | select(.name | contains("Continuous Improvement"))' IMPLEMENTATION_GUIDE.json
```