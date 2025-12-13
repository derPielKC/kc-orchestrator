# kc-orchestrator

Universal CLI orchestrator for multi-project repositories.

## Description

kc-orchestrator is a tool designed to automate task execution across multiple projects in a repository using various AI providers.

## Installation

```bash
npm install -g .
```

## Usage

```bash
# Basic help
kc-orchestrator --help

# Run continuous improvement analysis
kc-orchestrator improve --help
kc-orchestrator improve --last 5 --project my-project
kc-orchestrator improve --last 1 --dry-run

# Test telemetry components
node -e "const { TelemetryManager } = require('./src/telemetry/TelemetryManager'); console.log('TelemetryManager loaded');"
node -e "const { RunSummarizer } = require('./src/telemetry/RunSummarizer'); console.log('RunSummarizer loaded');"
```

## Features

- ✅ Multi-project discovery and management
- ✅ Configuration management with validation
- ✅ Interactive interview system for ambiguity resolution
- ✅ CLI provider interface (base class for AI providers)
- ✅ AI provider implementations (Codex, Claude, Vibe, Cursor Agent)
- ✅ Task execution engine with validation
- ✅ Git workflow integration
- ✅ Ollama integration for log analysis
- ✅ **Continuous Improvement with Agent Lightning**
  - Telemetry capture and analysis
  - Agent Lightning integration for recommendations
  - Automatic improvement task generation
  - CLI command for continuous improvement workflow

## Current Implementation Status

**Phase 1: Discovery and Configuration - COMPLETE**
- Repository root discovery
- Project folder discovery  
- Configuration management
- Interactive interview system
- CLI argument parsing

**Phase 2: Provider Integration - COMPLETE**
- ✅ Provider interface (abstract base class)
- ✅ Codex CLI provider
- ✅ Claude CLI provider
- ✅ Vibe CLI provider
- ✅ Cursor Agent CLI provider
- ✅ Provider fallback mechanism

**Completed Phases**
- Phase 1: Discovery and Configuration - COMPLETE
- Phase 2: Provider Integration - COMPLETE
- Phase 3: Task Execution Loop - COMPLETE
- Phase 4: Git Workflow Integration - COMPLETE
- Phase 5: Ollama Integration - COMPLETE
- Phase 6: Reporting and Error Handling - COMPLETE
- Phase 7: Testing and Validation - COMPLETE
- Phase 8: Continuous Improvement (Agent Lightning) - COMPLETE

**Current Status**
All core phases are complete. The system now includes:
- Full provider integration with fallback mechanism
- Task execution engine with validation
- Git workflow integration
- Ollama integration for log analysis
- Comprehensive telemetry and continuous improvement system
- Agent Lightning integration for automated recommendations

## Continuous Improvement System

The kc-orchestrator now includes a powerful continuous improvement loop powered by Agent Lightning:

### Telemetry Capture
- **Automatic logging** of all orchestrator runs
- **Structured events** (run start/end, task execution, provider fallbacks)
- **Sensitive data redaction** (secrets, paths, tokens)
- **JSONL storage** in `.kc-orchestrator/runs/<timestamp>/`

### Run Analysis
- **Statistical analysis** of execution patterns
- **Pain point identification** (high failure rates, retries, fallbacks)
- **Provider performance metrics**
- **Markdown reports** with clear visualizations

### Agent Lightning Integration
- **Automated recommendations** from telemetry analysis
- **Configurable CLI** via `AGENT_LIGHTNING_CLI` environment variable
- **Graceful fallback** when Agent Lightning is unavailable
- **Response parsing** for both JSON and markdown formats

### Improvement Workflow
- **Automatic task generation** from recommendations
- **Duplicate detection** using content hashing
- **Task prioritization** based on impact and effort
- **Documentation updates** for next development sessions

### CLI Command
```bash
kc-orchestrator improve [options]

Options:
  --last <number>         Number of recent runs to analyze (default: 5)
  --project <name>        Filter runs by project name
  --output-dir <path>     Output directory for reports
  --dry-run               Test without updating files
  --skip-agent-lightning  Use summary-only mode
  --verbose               Enable detailed logging
```

## Development

```bash
npm install
npm test

# Run telemetry tests specifically
npm test -- telemetry
```

## License

MIT