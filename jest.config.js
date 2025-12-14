module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'json-summary'],
  coverageThreshold: {
    global: {
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 80
    }
  },
  
  // Test matching
  testMatch: ['**/test/**/*.test.js'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dashboard/',
    '/test-logs/'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/',
    '/agent-lightning/'
  ],
  
  // Verbose output
  verbose: true,
  
  // Timeout
  testTimeout: 30000
};