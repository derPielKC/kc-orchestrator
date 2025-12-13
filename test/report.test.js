/**
 * Execution Report Generator Tests
 * 
 * Comprehensive tests for the ExecutionReportGenerator class
 */

const { ExecutionReportGenerator } = require('../src/report');
const fs = require('fs');
const path = require('path');

// Mock execution data
const mockExecutionData = {
  startTime: '2024-12-13T10:00:00.000Z',
  endTime: '2024-12-13T11:00:00.000Z',
  duration: 3600000,
  totalTasks: 5,
  completed: 4,
  failed: 1,
  executionLog: [
    {
      taskId: 'T1',
      provider: 'Codex',
      attempt: 1,
      duration: 1000,
      timestamp: '2024-12-13T10:05:00.000Z',
      status: 'completed'
    },
    {
      taskId: 'T2',
      provider: 'Claude',
      attempt: 1,
      duration: 2000,
      timestamp: '2024-12-13T10:15:00.000Z',
      status: 'completed'
    }
  ],
  validationResults: {
    T1: [
      {
        taskId: 'T1',
        validationType: 'output_files',
        passed: true,
        message: 'All output files validated successfully'
      },
      {
        taskId: 'T1',
        validationType: 'acceptance_criteria',
        passed: true,
        message: 'All acceptance criteria validated successfully'
      },
      {
        taskId: 'T1',
        validationType: 'ai_judging',
        passed: true,
        confidenceScore: 85,
        message: 'AI judgment: PASS (85% confidence)',
        aiJudgment: {
          assessment: 'PASS',
          confidence: 85,
          model: 'llama3',
          judgmentText: 'Overall assessment: PASS\nConfidence score: 85%'
        }
      }
    ],
    T2: [
      {
        taskId: 'T2',
        validationType: 'output_files',
        passed: false,
        message: '2 file checks failed'
      },
      {
        taskId: 'T2',
        validationType: 'acceptance_criteria',
        passed: false,
        message: '1 of 2 acceptance criteria not met'
      }
    ]
  }
};

// Mock guide data
const mockGuide = {
  project: 'Test Project',
  description: 'Test project for report generation',
  phases: [
    {
      name: 'Phase 1',
      description: 'Initial phase',
      tasks: ['T1', 'T2']
    }
  ],
  tasks: [
    {
      id: 'T1',
      title: 'Task 1',
      description: 'First test task',
      status: 'completed',
      acceptanceCriteria: ['Criterion 1', 'Criterion 2']
    },
    {
      id: 'T2',
      title: 'Task 2',
      description: 'Second test task',
      status: 'failed',
      acceptanceCriteria: ['Criterion 1', 'Criterion 2']
    },
    {
      id: 'T3',
      title: 'Task 3',
      description: 'Third test task',
      status: 'todo',
      acceptanceCriteria: ['Criterion 1', 'Criterion 2']
    }
  ]
};

const testProjectPath = path.join(__dirname, 'test-project');
const testGuidePath = path.join(testProjectPath, 'test-guide.json');
const testReportDir = path.join(testProjectPath, 'reports');

describe('ExecutionReportGenerator', () => {
  let reportGenerator;
  
  beforeAll(() => {
    // Create test directory structure
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }
    
    // Write mock guide
    fs.writeFileSync(testGuidePath, JSON.stringify(mockGuide, null, 2));
    
    // Create report generator
    reportGenerator = new ExecutionReportGenerator({
      projectPath: testProjectPath,
      guidePath: testGuidePath,
      reportDir: testReportDir,
      verbose: false
    });
  });

  afterAll(() => {
    // Clean up test files
    try {
      if (fs.existsSync(testReportDir)) {
        const files = fs.readdirSync(testReportDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(testReportDir, file));
        });
        fs.rmdirSync(testReportDir);
      }
      if (fs.existsSync(testGuidePath)) {
        fs.unlinkSync(testGuidePath);
      }
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  });

  describe('Constructor', () => {
    it('should create report generator with default options', () => {
      const defaultGenerator = new ExecutionReportGenerator({
        projectPath: testProjectPath
      });
      
      expect(defaultGenerator.projectPath).toBe(testProjectPath);
      expect(defaultGenerator.reportDir).toBe(path.join(testProjectPath, 'reports'));
      expect(defaultGenerator.verbose).toBe(false);
    });

    it('should create report generator with custom options', () => {
      const customReportDir = path.join(testProjectPath, 'custom-reports');
      const customGenerator = new ExecutionReportGenerator({
        projectPath: testProjectPath,
        reportDir: customReportDir,
        verbose: true
      });
      
      expect(customGenerator.reportDir).toBe(customReportDir);
      expect(customGenerator.verbose).toBe(true);
    });

    it('should create report directory if it does not exist', () => {
      const newReportDir = path.join(testProjectPath, 'new-reports');
      const generator = new ExecutionReportGenerator({
        projectPath: testProjectPath,
        reportDir: newReportDir
      });
      
      expect(fs.existsSync(newReportDir)).toBe(true);
      
      // Clean up
      fs.rmdirSync(newReportDir);
    });
  });

  describe('JSON Report Generation', () => {
    it('should generate JSON report from execution data', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      
      expect(jsonReport).toBeDefined();
      expect(jsonReport.metadata).toBeDefined();
      expect(jsonReport.project).toBeDefined();
      expect(jsonReport.executionSummary).toBeDefined();
      expect(jsonReport.taskDetails).toBeDefined();
      expect(jsonReport.validationResults).toBeDefined();
      expect(jsonReport.statistics).toBeDefined();
      expect(jsonReport.recommendations).toBeDefined();
    });

    it('should generate correct execution summary', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const summary = jsonReport.executionSummary;
      
      expect(summary.totalTasks).toBe(5);
      expect(summary.completedTasks).toBe(4);
      expect(summary.failedTasks).toBe(1);
      expect(summary.successRate).toBe(80);
      expect(summary.status).toBe('partial');
    });

    it('should generate task details with execution info', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const taskDetails = jsonReport.taskDetails;
      
      expect(taskDetails).toHaveLength(3);
      
      const task1 = taskDetails.find(t => t.taskId === 'T1');
      expect(task1).toBeDefined();
      expect(task1.title).toBe('Task 1');
      expect(task1.executionInfo).toBeDefined();
      expect(task1.executionInfo.provider).toBe('Codex');
      expect(task1.executionInfo.durationMs).toBe(1000);
    });

    it('should generate validation results with AI judgments', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const validationResults = jsonReport.validationResults;
      
      expect(validationResults.totalValidations).toBe(5);
      expect(validationResults.passedValidations).toBe(3);
      expect(validationResults.failedValidations).toBe(2);
      expect(validationResults.aiJudgments).toHaveLength(1);
      expect(validationResults.aiJudgments[0].assessment).toBe('PASS');
      expect(validationResults.aiJudgments[0].confidence).toBe(85);
    });

    it('should generate project and execution statistics', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const stats = jsonReport.statistics;
      
      expect(stats.project.totalTasks).toBe(3);
      expect(stats.project.completedTasks).toBe(1);
      expect(stats.project.failedTasks).toBe(1);
      expect(stats.project.todoTasks).toBe(1);
      
      expect(stats.execution.totalDurationMs).toBe(3600000);
      expect(stats.execution.averageTaskDurationMs).toBe(1500);
    });

    it('should generate recommendations based on execution data', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const recommendations = jsonReport.recommendations;
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should have high success rate recommendation (80% success rate)
      const successRec = recommendations.find(r => r.type === 'success');
      expect(successRec).toBeDefined();
      expect(successRec.message).toContain('High success rate');
      
      // Should have validation failure recommendation
      const validationRec = recommendations.find(r => r.type === 'validation');
      expect(validationRec).toBeDefined();
      expect(validationRec.message).toContain('Validation failures detected');
    });
  });

  describe('Report File Operations', () => {
    it('should save JSON report to file', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const reportPath = await reportGenerator.saveJSONReport(jsonReport, 'test-report');
      
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(path.extname(reportPath)).toBe('.json');
      expect(reportPath).toContain('test-report');
      
      // Verify content
      const content = fs.readFileSync(reportPath, 'utf8');
      const savedReport = JSON.parse(content);
      expect(savedReport.metadata.reportType).toBe('execution');
    });

    it('should generate and save HTML report', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const htmlContent = await reportGenerator.generateHTMLReport(jsonReport);
      const reportPath = await reportGenerator.saveHTMLReport(htmlContent, 'test-report');
      
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(path.extname(reportPath)).toBe('.html');
      expect(reportPath).toContain('test-report');
      
      // Verify content
      const content = fs.readFileSync(reportPath, 'utf8');
      expect(content).toContain('<html>');
      expect(content).toContain('kc-orchestrator Execution Report');
      expect(content).toContain('Execution Summary');
    });

    it('should generate and save Markdown report', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const markdownContent = await reportGenerator.generateMarkdownReport(jsonReport);
      const reportPath = await reportGenerator.saveMarkdownReport(markdownContent, 'test-report');
      
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(path.extname(reportPath)).toBe('.md');
      expect(reportPath).toContain('test-report');
      
      // Verify content
      const content = fs.readFileSync(reportPath, 'utf8');
      expect(content).toContain('# kc-orchestrator Execution Report');
      expect(content).toContain('## 📊 Execution Summary');
      expect(content).toContain('| Task ID | Title | Status |');
    });

    it('should generate comprehensive report (all formats)', async () => {
      const result = await reportGenerator.generateComprehensiveReport(mockExecutionData, 'comprehensive-test');
      
      expect(result.success).toBe(true);
      expect(result.jsonReport).toBeDefined();
      expect(result.jsonReportPath).toBeDefined();
      expect(result.htmlReportPath).toBeDefined();
      expect(result.markdownReportPath).toBeDefined();
      
      // Verify all files exist
      expect(fs.existsSync(result.jsonReportPath)).toBe(true);
      expect(fs.existsSync(result.htmlReportPath)).toBe(true);
      expect(fs.existsSync(result.markdownReportPath)).toBe(true);
    });

    it('should get report files from directory', async () => {
      // First generate some reports
      await reportGenerator.generateComprehensiveReport(mockExecutionData, 'test-get-files');
      
      const reportFiles = await reportGenerator.getReportFiles();
      
      expect(Array.isArray(reportFiles)).toBe(true);
      expect(reportFiles.length).toBeGreaterThan(0);
      
      // Check that files have correct extensions
      const validExtensions = reportFiles.every(file => 
        ['.json', '.html', '.md'].includes(path.extname(file))
      );
      expect(validExtensions).toBe(true);
    });

    it('should cleanup old report files', async () => {
      // Create some old report files
      const oldReportPath = path.join(testReportDir, 'old-report.json');
      const oldContent = JSON.stringify({ old: true }, null, 2);
      fs.writeFileSync(oldReportPath, oldContent);
      
      // Set the file's modification time to 40 days ago
      const oldTime = new Date();
      oldTime.setDate(oldTime.getDate() - 40);
      fs.utimesSync(oldReportPath, oldTime, oldTime);
      
      // Run cleanup
      const cleanupResult = await reportGenerator.cleanupOldReports(30);
      
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.deletedCount).toBeGreaterThanOrEqual(1);
      expect(cleanupResult.deletedFiles).toContain('old-report.json');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid execution data gracefully', async () => {
      await expect(reportGenerator.generateJSONReport(null))
        .rejects
        .toThrow('Invalid execution data for report generation');
    });

    it('should handle invalid JSON report for HTML generation', async () => {
      await expect(reportGenerator.generateHTMLReport(null))
        .rejects
        .toThrow('Invalid JSON report for HTML generation');
    });

    it('should handle invalid JSON report for Markdown generation', async () => {
      await expect(reportGenerator.generateMarkdownReport(null))
        .rejects
        .toThrow('Invalid JSON report for Markdown generation');
    });

    it('should handle missing report directory gracefully', async () => {
      const tempGenerator = new ExecutionReportGenerator({
        projectPath: testProjectPath,
        reportDir: path.join(testProjectPath, 'nonexistent-reports')
      });
      
      // Should create the directory automatically
      expect(fs.existsSync(path.join(testProjectPath, 'nonexistent-reports'))).toBe(true);
    });
  });

  describe('Report Content Validation', () => {
    it('should include AI judgments in HTML report', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const htmlContent = await reportGenerator.generateHTMLReport(jsonReport);
      
      expect(htmlContent).toContain('AI Judgments');
      expect(htmlContent).toContain('T1');
      expect(htmlContent).toContain('PASS');
      expect(htmlContent).toContain('85%');
    });

    it('should include recommendations in Markdown report', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      const markdownContent = await reportGenerator.generateMarkdownReport(jsonReport);
      
      expect(markdownContent).toContain('## 💡 Recommendations');
      expect(markdownContent).toContain('Priority:');
      expect(markdownContent).toContain('Action:');
    });

    it('should include validation types in JSON report', async () => {
      const jsonReport = await reportGenerator.generateJSONReport(mockExecutionData);
      
      expect(jsonReport.validationResults.validationTypes).toBeDefined();
      expect(jsonReport.validationResults.validationTypes['output_files']).toBe(2);
      expect(jsonReport.validationResults.validationTypes['acceptance_criteria']).toBe(2);
      expect(jsonReport.validationResults.validationTypes['ai_judging']).toBe(1);
    });
  });
});