const { AgentLightningIntegration } = require('../../src/telemetry/AgentLightningIntegration');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('AgentLightningIntegration', () => {
  let agentLightning;
  let testDir;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-orchestrator-test-'));
    agentLightning = new AgentLightningIntegration({
      baseDir: testDir,
      verbose: false
    });
  });
  
  afterEach(() => {
    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('constructor', () => {
    it('should initialize with default CLI path', () => {
      const defaultAgentLightning = new AgentLightningIntegration();
      expect(defaultAgentLightning.agentLightningCli).toBe('agl');
    });
    
    it('should use AGENT_LIGHTNING_CLI environment variable', () => {
      process.env.AGENT_LIGHTNING_CLI = 'custom-agl';
      const envAgentLightning = new AgentLightningIntegration();
      expect(envAgentLightning.agentLightningCli).toBe('custom-agl');
      delete process.env.AGENT_LIGHTNING_CLI;
    });
    
    it('should create base directory if it does not exist', () => {
      expect(fs.existsSync(testDir)).toBe(true);
    });
  });
  
  describe('validateConfiguration', () => {
    it('should return configuration with availability status', () => {
      const config = agentLightning.validateConfiguration();
      
      expect(config).toHaveProperty('available');
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('cliPath');
      expect(config).toHaveProperty('baseDir');
      expect(config).toHaveProperty('issues');
      expect(Array.isArray(config.issues)).toBe(true);
    });
  });
  
  describe('_generateRecommendationId', () => {
    it('should generate unique recommendation IDs', () => {
      const id1 = agentLightning._generateRecommendationId('Test Recommendation 1');
      const id2 = agentLightning._generateRecommendationId('Test Recommendation 2');
      
      expect(id1).toMatch(/^AGL-\d+-[a-z0-9]{4}$/);
      expect(id2).toMatch(/^AGL-\d+-[a-z0-9]{4}$/);
      expect(id1).not.toBe(id2);
    });
  });
  
  describe('_normalizeRecommendation', () => {
    it('should normalize string recommendation', () => {
      const recommendation = 'Test recommendation';
      const normalized = agentLightning._normalizeRecommendation(recommendation);
      
      expect(normalized).toHaveProperty('id');
      expect(normalized.title).toBe('Test recommendation');
      expect(normalized.description).toBe('Test recommendation');
      expect(normalized.priority).toBe('medium');
      expect(normalized.category).toBe('general');
    });
    
    it('should normalize object recommendation', () => {
      const recommendation = {
        title: 'Test Recommendation',
        description: 'Test description',
        priority: 'high',
        category: 'performance'
      };
      
      const normalized = agentLightning._normalizeRecommendation(recommendation);
      
      expect(normalized).toHaveProperty('id');
      expect(normalized.title).toBe('Test Recommendation');
      expect(normalized.description).toBe('Test description');
      expect(normalized.priority).toBe('high');
      expect(normalized.category).toBe('performance');
    });
    
    it('should handle missing fields in recommendation', () => {
      const recommendation = {
        description: 'Test description'
      };
      
      const normalized = agentLightning._normalizeRecommendation(recommendation);
      
      expect(normalized.title).toBe('Test description');
      expect(normalized.description).toBe('Test description');
      expect(normalized.priority).toBe('medium');
      expect(normalized.category).toBe('general');
    });
  });
  
  describe('_parseMarkdownResponse', () => {
    it('should parse markdown recommendations', () => {
      const markdown = `
## Recommendation 1: Improve error handling

- Priority: high
- Category: error_handling
- Implement better error handling for network failures

## Recommendation 2: Add more tests

- Priority: medium
- Category: testing
- Add unit tests for edge cases
`;
      
      const result = agentLightning._parseMarkdownResponse(markdown);
      
      expect(result.success).toBe(true);
      expect(result.recommendations.length).toBe(2);
      expect(result.recommendations[0].title).toBe('Improve error handling');
      expect(result.recommendations[0].priority).toBe('high');
      expect(result.recommendations[0].category).toBe('error_handling');
      expect(result.recommendations[1].title).toBe('Add more tests');
      expect(result.recommendations[1].priority).toBe('medium');
      expect(result.recommendations[1].category).toBe('testing');
    });
    
    it('should handle empty markdown', () => {
      const result = agentLightning._parseMarkdownResponse('');
      expect(result.success).toBe(true);
      expect(result.recommendations.length).toBe(0);
    });
  });
  
  describe('_normalizeResponse', () => {
    it('should normalize response with recommendations array', () => {
      const response = {
        recommendations: [
          { title: 'Test 1', description: 'Desc 1' },
          { title: 'Test 2', description: 'Desc 2' }
        ],
        metadata: { version: '1.0' }
      };
      
      const normalized = agentLightning._normalizeResponse(response);
      
      expect(normalized.success).toBe(true);
      expect(normalized.recommendations.length).toBe(2);
      expect(normalized.metadata).toEqual({ version: '1.0' });
      // Check that IDs were generated
      expect(normalized.recommendations[0].id).toBeDefined();
      expect(normalized.recommendations[1].id).toBeDefined();
    });
    
    it('should normalize response with improvements array', () => {
      const response = {
        improvements: [
          { title: 'Test 1', description: 'Desc 1' }
        ]
      };
      
      const normalized = agentLightning._normalizeResponse(response);
      
      expect(normalized.success).toBe(true);
      expect(normalized.recommendations.length).toBe(1);
      expect(normalized.recommendations[0].id).toBeDefined();
    });
    
    it('should normalize array response', () => {
      const response = [
        { title: 'Test 1' },
        { title: 'Test 2' }
      ];
      
      const normalized = agentLightning._normalizeResponse(response);
      
      expect(normalized.success).toBe(true);
      expect(normalized.recommendations.length).toBe(2);
      expect(normalized.recommendations[0].id).toBeDefined();
      expect(normalized.recommendations[1].id).toBeDefined();
    });
  });
  
  describe('_buildAgentLightningCommand', () => {
    it('should build proper Agent Lightning command', () => {
      const command = agentLightning._buildAgentLightningCommand(
        '/path/to/summary.md',
        '/path/to/runs.json',
        '/path/to/output',
        'test-project',
        'markdown'
      );
      
      expect(command).toContain('agl analyze');
      expect(command).toContain('--input-summary "/path/to/summary.md"');
      expect(command).toContain('--input-runs "/path/to/runs.json"');
      expect(command).toContain('--output-dir "/path/to/output"');
      expect(command).toContain('--project "test-project"');
      expect(command).toContain('--format markdown');
    });
  });
});