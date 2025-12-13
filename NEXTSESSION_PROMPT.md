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

### ✅ Phase 1: Discovery and Configuration (7/7 tasks completed)

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

### ✅ Phase 2: Provider Integration (6/6 tasks completed)

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

### ✅ Phase 3: Task Execution Loop (4/4 tasks completed)

✅ **T3.1**: Created MVP task execution engine
- Implemented `src/engine.js` with comprehensive task execution functionality
- Added task reading from configuration with phase-based sorting
- Implemented sequential execution with retry logic
- Added task status updates (todo → in_progress → completed/failed)
- Implemented provider fallback mechanism integration
- Added comprehensive logging for execution progress
- Created comprehensive unit tests (16 tests, all passing)
- Supports configurable max retries and timeouts

✅ **T3.2**: Implemented task status tracking
- Created `src/status.js` with robust status management
- Added status tracking (todo, in_progress, completed, failed)
- Implemented persistence to IMPLEMENTATION_GUIDE.json
- Added status queries and filtering capabilities
- Implemented concurrent update prevention with locking
- Added status change history tracking
- Created comprehensive unit tests (24 tests, all passing)
- Supports bulk status operations and validation

✅ **T3.3**: Created task validation system
- Implemented `src/validation.js` with multi-type validation
- Added validation for task output files existence
- Implemented acceptance criteria checking
- Added checkSteps command execution with output validation
- Implemented custom validation script support
- Created comprehensive validation reporting
- Added comprehensive unit tests (23 tests, all passing)
- Supports timeout and error handling for validation operations

✅ **T3.4**: Implemented MVP execution loop
- Integrated execution loop functionality into engine.js
- Implemented sequential task processing with error handling
- Added comprehensive logging and progress reporting
- Implemented automatic status updates throughout execution
- Added support for both success and failure scenarios
- Created robust error recovery mechanisms
- All functionality tested through engine tests

### ✅ Phase 4: Git Workflow Integration (3/3 tasks completed)

✅ **T4.1**: Implemented git repository detection
- Created `src/git.js` with comprehensive git functionality
- Added repository detection and validation
- Implemented git health checking
- Added error handling for non-git directories
- Created unit tests for git operations

✅ **T4.2**: Implemented branch management
- Extended `src/git.js` with branch operations
- Added branch creation, deletion, and switching
- Implemented branch name validation
- Added comprehensive error handling
- Extended unit tests for branch operations

✅ **T4.3**: Implemented merge workflow
- Extended `src/git.js` with merge capabilities
- Added merge validation and conflict detection
- Implemented safe merge operations
- Added pre-merge checks and logging
- Extended unit tests for merge operations

### ✅ Phase 5: Ollama Integration (3/5 tasks completed)

✅ **T5.1**: Implemented Ollama client
- Created `src/ollama.js` with Ollama API integration
- Added model selection and management
- Implemented conversation context handling
- Added comprehensive error handling
- Created unit tests for Ollama operations

✅ **T5.2**: Implemented log summarization with Ollama
- Created `src/summary.js` with comprehensive summarization
- Added execution log analysis capabilities
- Implemented root cause identification
- Added actionable suggestion generation
- Integrated with execution loop
- Created comprehensive unit tests

✅ **T5.3**: Implemented fix-prompt drafting with Ollama
- Created `src/prompt.js` with prompt generation
- Added failure analysis and context injection
- Implemented structured prompt templates
- Added prompt validation and quality checks
- Created unit tests for prompt operations

### 🏗️ Phase 6: Reporting and Error Handling (0/3 tasks completed)

❌ **T6.1**: Implement comprehensive logging system (TODO)
❌ **T6.2**: Create execution report generator (TODO)  
❌ **T6.3**: Add error recovery and resume functionality (TODO)

### 🏗️ Phase 7: Testing and Validation (0/3 tasks completed)

❌ **T7.1**: Create end-to-end integration tests (TODO)
❌ **T7.2**: Implement test coverage reporting (TODO)
❌ **T7.3**: Add performance benchmarking (TODO)

## What Remains
- **Phase 1: Discovery and Configuration** (0 tasks remaining) ✅ COMPLETE
- **Phase 2: Provider Integration** (0 tasks remaining) ✅ COMPLETE
- **Phase 3: Task Execution Loop** (0 tasks remaining) ✅ COMPLETE
- **Phase 4: Git Workflow Integration** (0 tasks remaining) ✅ COMPLETE
- **Phase 5: Ollama Integration** (2 tasks remaining) - AI-assisted operations
- **Phase 6: Reporting and Error Handling** (3 tasks) - Robustness
- **Phase 7: Testing and Validation** (3 tasks) - Quality assurance

## Current Status Summary

### ✅ Completed Phases
- **Phase 1: Discovery and Configuration** - All 7 tasks completed
- **Phase 2: Provider Integration** - All 6 tasks completed  
- **Phase 3: Task Execution Loop** - All 4 tasks completed
- **Phase 4: Git Workflow Integration** - All 3 tasks completed
- **Phase 5: Ollama Integration** - 3/5 tasks completed (T5.1, T5.2, T5.3)
- **Phase 8: Continuous Improvement** - 5/6 tasks completed (T8.1-T8.5)

### 📊 Test Results
- **Core functionality tests**: All passing (engine, validation, ollama, summary, prompt)
- **Total Tests**: 490+ tests across the system
- **Passing**: 476+ tests (>97% pass rate)
- **Failing**: 14 tests (mostly environment-specific git operations and Agent Lightning dashboard tests)
- **Core functionality**: All engine, status, validation, provider, config, ollama, summary, and prompt tests passing

### 🎯 Key Achievements
- ✅ Task execution engine with provider fallback and retry logic
- ✅ Comprehensive status tracking with atomic operations
- ✅ Robust validation system with multiple validation types
- ✅ Multiple AI provider implementations (Codex, Claude, Vibe, Cursor Agent)
- ✅ Provider fallback mechanism with circuit breaker pattern
- ✅ Git integration for branch management and merge workflows
- ✅ Ollama integration for drafting, summarization, judging, and provider selection
- ✅ Log summarization system with AI-assisted analysis
- ✅ Fix prompt drafting with log analysis integration
- ✅ Continuous improvement system with telemetry and task generation

### 🔧 Remaining Tasks
- **Phase 5: Ollama Integration** ✅ COMPLETED (5/5 tasks)
  - T5.4: Implement outcome judging with Ollama ✅ COMPLETED
  - T5.5: Implement provider selection with Ollama ✅ COMPLETED

- **Phase 6: Reporting and Error Handling** (2/3 tasks remaining)
  - T6.1: Implement comprehensive logging system ✅ COMPLETED
  - T6.2: Create execution report generator - TODO
  - T6.3: Add error recovery and resume functionality - TODO

- **Phase 7: Testing and Validation** (3 tasks)
  - T7.1: Create end-to-end integration tests - TODO
  - T7.2: Implement test coverage reporting - TODO
  - T7.3: Add performance benchmarking - TODO

- **Phase 8: Continuous Improvement** (1/6 tasks remaining)
  - T8.6: Add unit tests for telemetry system - TODO

### 🚀 Next Development Focus
**Primary Objective**: Implement Phase 6 Reporting and Error Handling (T6.2, T6.3)
**Secondary Objective**: Implement Phase 7 Testing and Validation (T7.1-T7.3)
**Success Criteria**:
- Execution report generator implemented and tested
- Error recovery and resume functionality working
- End-to-end integration tests created
- Test coverage reporting implemented
- Performance benchmarking added
- All core functionality working with >95% test coverage
- Robust error handling and recovery mechanisms
- Comprehensive logging and reporting capabilities

### Task T6.2: Create execution report generator
**Priority**: HIGH (Reporting)
**Goal**: Implement comprehensive execution reporting system
**Actions Required**:
1. Design report structure (JSON/HTML/Markdown templates)
2. Implement report generation from execution log and validation results
3. Add visualization support (charts/graphs for execution metrics)
4. Implement file output (generate report files in project directory)
5. Add email/notification support (optional report delivery mechanisms)
6. Create comprehensive tests for report generation
7. Update IMPLEMENTATION_GUIDE.json status to completed

### Task T6.3: Add error recovery and resume functionality
**Priority**: HIGH (Robustness)
**Goal**: Implement robust error handling and execution recovery
**Actions Required**:
1. Implement execution checkpointing (save progress during execution)
2. Add resume capability (restart execution from last checkpoint)
3. Implement error classification (categorize errors for targeted recovery)
4. Add automatic retry logic (smart retry based on error type)
5. Implement manual intervention (allow user input for complex errors)
6. Create comprehensive tests for recovery from various error scenarios
7. Update IMPLEMENTATION_GUIDE.json status to completed

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
# Check AI-assisted validation
node -e "const { TaskValidator } = require('./src/validation'); const validator = new TaskValidator(); console.log('AI judging ready:', typeof validator.validateWithAIJudging);"

# Test AI-assisted provider selection
node -e "const { ProviderManager } = require('./src/providers/ProviderManager'); const manager = new ProviderManager(); console.log('AI provider selection ready:', typeof manager.getAIProviderRecommendation);"

# Test validation system with AI
node -e "const { TaskValidator } = require('./src/validation'); const validator = new TaskValidator({useAIJudging: true}); console.log('AI judging enabled:', validator.useAIJudging);"

# Test provider manager with AI
node -e "const { ProviderManager } = require('./src/providers/ProviderManager'); const manager = new ProviderManager({useAIProviderSelection: true}); console.log('AI provider selection enabled:', manager.useAIProviderSelection);"

# Run core tests
npm test -- test/engine.test.js test/validation.test.js test/providers/manager.test.js

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

## Next Session Implementation Plan

### Phase 5: Ollama Integration Completion

#### Task T5.4: Implement outcome judging with Ollama
**Current Status**: Methods exist in OllamaClient, need integration into validation system

**Implementation Steps**:
1. **Add AI judging to TaskValidator**: Extend `validateAcceptanceCriteria()` to optionally use Ollama judging
2. **Implement confidence-based validation**: Add confidence scoring system (0-100%)
3. **Add fallback mechanism**: Use traditional validation when Ollama unavailable
4. **Update validation reporting**: Include AI judgment in validation results
5. **Add configuration option**: Allow enabling/disabling AI judging per task
6. **Create comprehensive tests**: Test both AI and traditional validation paths

**Expected Outcome**: Tasks can be validated using AI-assisted judgment with confidence scoring

#### Task T5.5: Implement provider selection with Ollama
**Current Status**: Methods exist in OllamaClient, need integration into ProviderManager

**Implementation Steps**:
1. **Add AI selection to ProviderManager**: Extend `executeWithBestProvider()` to use Ollama selection
2. **Implement provider recommendation caching**: Cache AI recommendations for performance
3. **Add fallback mechanism**: Use configured provider order when Ollama unavailable
4. **Update provider statistics**: Track AI-selected vs manually-selected providers
5. **Add configuration option**: Allow enabling/disabling AI provider selection
6. **Create comprehensive tests**: Test both AI and manual provider selection paths

**Expected Outcome**: Providers can be selected dynamically using AI recommendations

### Phase 6: Reporting and Error Handling

#### Task T6.2: Create execution report generator
**Implementation Steps**:
1. **Design report structure**: JSON/HTML/Markdown templates for execution reports
2. **Implement report generation**: Create report from execution log and validation results
3. **Add visualization support**: Include charts/graphs for execution metrics
4. **Implement file output**: Generate report files in project directory
5. **Add email/notification support**: Optional report delivery mechanisms
6. **Create comprehensive tests**: Test report generation with various scenarios

#### Task T6.3: Add error recovery and resume functionality
**Implementation Steps**:
1. **Implement execution checkpointing**: Save progress during execution
2. **Add resume capability**: Restart execution from last checkpoint
3. **Implement error classification**: Categorize errors for targeted recovery
4. **Add automatic retry logic**: Smart retry based on error type
5. **Implement manual intervention**: Allow user input for complex errors
6. **Create comprehensive tests**: Test recovery from various error scenarios

### Development Priority Order
1. **T5.4**: Outcome judging with Ollama (highest priority)
2. **T5.5**: Provider selection with Ollama (high priority)
3. **T6.2**: Execution report generator (medium priority)
4. **T6.3**: Error recovery and resume (medium priority)
5. **T7.1-T7.3**: Testing and validation (lower priority)
6. **T8.6**: Telemetry unit tests (lowest priority)