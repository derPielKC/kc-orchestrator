const { execSync } = require('child_process');
const path = require('path');

describe('CLI Argument Parsing', () => {
  const cliPath = path.join(__dirname, '../bin/cli.js');
  
  describe('Basic CLI functionality', () => {
    it('should show help when --help flag is used', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('kc-orchestrator');
      expect(result).toContain('Universal CLI orchestrator');
      expect(result).toContain('--help');
      expect(result).toContain('--version');
    });
    
    it('should show version when --version flag is used', () => {
      const result = execSync(`node ${cliPath} --version`, { encoding: 'utf8' });
      expect(result).toMatch(/\d+\.\d+\.\d+/); // Version number format
    });
    
    it('should show version when -v flag is used', () => {
      const result = execSync(`node ${cliPath} -v`, { encoding: 'utf8' });
      expect(result).toMatch(/\d+\.\d+\.\d+/); // Version number format
    });
  });
  
  describe('CLI options', () => {
    it('should accept --verbose flag', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('--verbose');
      expect(result).toContain('enable verbose output');
    });
    
    it('should accept --non-interactive flag', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('--non-interactive');
      expect(result).toContain('disable interactive prompts');
    });
    
    it('should accept --auto-answer flag', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('--auto-answer');
      expect(result).toContain('provide automatic answers');
    });
    
    it('should accept --dry-run flag', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('--dry-run');
      expect(result).toContain('perform a dry run');
    });
    
    it('should accept --config flag', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('--config');
      expect(result).toContain('specify custom config file path');
    });
    
    it('should accept --project flag', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('--project');
      expect(result).toContain('specify project to work on');
    });
    
    it('should accept --provider flag', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('--provider');
      expect(result).toContain('specify AI provider to use');
    });
  });
  
  describe('Help text', () => {
    it('should contain before help text', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('kc-orchestrator v');
    });
    
    it('should contain after help text with examples', () => {
      const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(result).toContain('Examples:');
      expect(result).toContain('kc-orchestrator --help');
      expect(result).toContain('kc-orchestrator --version');
      expect(result).toContain('--verbose --project');
      expect(result).toContain('--non-interactive');
    });
  });
});