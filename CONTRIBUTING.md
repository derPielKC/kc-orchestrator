# Contributing to kc-orchestrator

Thank you for your interest in contributing to kc-orchestrator! This document provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/0/code_of_conduct/).

## How Can I Contribute?

### Reporting Bugs

Before reporting a bug, please:
1. Check if the issue already exists in the issue tracker
2. Provide clear steps to reproduce the issue
3. Include relevant logs and error messages
4. Specify your environment (Node.js version, OS, etc.)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please:
1. Check if the enhancement has already been suggested
2. Provide a clear description of the proposed enhancement
3. Explain the use case and benefits
4. Include any relevant examples or mockups

### Pull Requests

We welcome pull requests! Here's how to contribute code:

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding standards** described below
3. **Write tests** for your changes (we aim for >80% coverage)
4. **Update documentation** if applicable
5. **Submit your pull request** with a clear description

## Development Setup

### Prerequisites

- Node.js v18+
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/kc-orchestrator.git
cd kc-orchestrator

# Install dependencies
npm install

# Run tests
npm test
```

### Project Structure

```
kc-orchestrator/
├── src/                  # Main source code
│   ├── discovery.js      # Repository/project discovery
│   ├── config.js         # Configuration management
│   ├── interview.js      # Interactive interview system
│   ├── questions.js      # Questions manager
│   ├── providers/        # AI provider implementations
│   └── ...
├── bin/                  # CLI entry points
├── test/                 # Unit and integration tests
├── config/               # Configuration files
├── docs/                 # Documentation
└── ...
```

## Coding Standards

### JavaScript/Node.js

- Use modern ES6+ features
- Follow consistent indentation (2 spaces)
- Use meaningful variable and function names
- Add JSDoc comments for all public methods
- Use async/await for asynchronous code
- Handle errors appropriately

### Testing

- Write unit tests for all new functionality
- Aim for >80% code coverage
- Use Jest testing framework
- Follow the existing test patterns

### Documentation

- Update README.md if you add new features
- Add JSDoc comments for new public methods
- Update CHANGELOG.md for significant changes
- Keep documentation in sync with code

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

<body>

<footer>
```

Examples:
- `feat(discovery): add repository root detection`
- `fix(config): handle invalid JSON gracefully`
- `docs(readme): update installation instructions`
- `test(providers): add unit tests for Provider class`

## Development Workflow

1. **Create a feature branch**: `git checkout -b feat/your-feature`
2. **Make your changes**: Follow coding standards and write tests
3. **Run tests**: `npm test` (ensure all tests pass)
4. **Commit your changes**: Use conventional commit messages
5. **Push to your fork**: `git push origin feat/your-feature`
6. **Submit a pull request**: Target the `main` branch

## Code Review Process

All pull requests will be reviewed by project maintainers. We aim to:
- Respond to pull requests within 72 hours
- Provide constructive feedback
- Ensure code quality and consistency
- Maintain high test coverage

## License

By contributing to kc-orchestrator, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Questions?

If you have any questions about contributing, please open an issue or contact the project maintainers.

Thank you for contributing to kc-orchestrator! 🚀