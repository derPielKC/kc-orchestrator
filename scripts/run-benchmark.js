#!/usr/bin/env node

/**
 * Performance Benchmark Runner
 *
 * CLI tool to run performance benchmarks for kc-orchestrator
 */

const { PerformanceBenchmark } = require('../src/benchmark');
const { program } = require('commander');
const path = require('path');
const fs = require('fs').promises;

// Setup CLI
program
  .name('kc-orchestrator-benchmark')
  .description('Performance benchmarking tool for kc-orchestrator')
  .version('1.0.0');

program
  .command('run')
  .description('Run performance benchmarks')
  .option('-p, --project-path <path>', 'Project directory path', process.cwd())
  .option('-t, --task-count <number>', 'Number of test tasks to benchmark', '5')
  .option('-i, --iterations <number>', 'Number of iterations per task', '3')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('-o, --output <filename>', 'Output filename for benchmark report')
  .action(async (options) => {
    try {
      console.log('🚀 Starting performance benchmarks...');
      console.log(`Project Path: ${options.projectPath}`);
      console.log(`Task Count: ${options.taskCount}`);
      console.log(`Iterations: ${options.iterations}`);
      console.log(`Verbose: ${options.verbose}`);
      
      const benchmark = new PerformanceBenchmark({
        projectPath: options.projectPath,
        verbose: options.verbose
      });
      
      // Create test tasks
      const tasks = [];
      for (let i = 1; i <= options.taskCount; i++) {
        tasks.push({
          id: `BENCH-${i.toString().padStart(3, '0')}`,
          title: `Performance Benchmark Task ${i}`,
          description: `Automated performance test task ${i}`,
          acceptanceCriteria: [`Task BENCH-${i.toString().padStart(3, '0')} completed successfully`],
          outputs: [],
          checkSteps: [],
          phase: 1
        });
      }
      
      console.log(`📋 Created ${tasks.length} test tasks for benchmarking`);
      
      // Run comprehensive benchmark
      const benchmarkResults = await benchmark.runComprehensiveBenchmark(tasks, {
        maxRetries: 2,
        taskTimeout: 30000
      });
      
      console.log('✅ Benchmark completed successfully!');
      console.log(`📊 Execution Statistics:`);
      console.log(`   - Average: ${benchmarkResults.statistics.execution.average.toFixed(2)}ms`);
      console.log(`   - Min: ${benchmarkResults.statistics.execution.min.toFixed(2)}ms`);
      console.log(`   - Max: ${benchmarkResults.statistics.execution.max.toFixed(2)}ms`);
      console.log(`   - Std Dev: ${benchmarkResults.statistics.execution.stdDev.toFixed(2)}ms`);
      
      console.log(`📊 Validation Statistics:`);
      console.log(`   - Average: ${benchmarkResults.statistics.validation.average.toFixed(2)}ms`);
      console.log(`   - Min: ${benchmarkResults.statistics.validation.min.toFixed(2)}ms`);
      console.log(`   - Max: ${benchmarkResults.statistics.validation.max.toFixed(2)}ms`);
      console.log(`   - Std Dev: ${benchmarkResults.statistics.validation.stdDev.toFixed(2)}ms`);
      
      console.log(`📊 Reporting Statistics:`);
      console.log(`   - Average: ${benchmarkResults.statistics.reporting.average.toFixed(2)}ms`);
      console.log(`   - Min: ${benchmarkResults.statistics.reporting.min.toFixed(2)}ms`);
      console.log(`   - Max: ${benchmarkResults.statistics.reporting.max.toFixed(2)}ms`);
      console.log(`   - Std Dev: ${benchmarkResults.statistics.reporting.stdDev.toFixed(2)}ms`);
      
      // Generate performance report
      const reportName = options.output || 'performance-benchmark';
      const reportResult = await benchmark.generatePerformanceReport(reportName);
      
      if (reportResult.success) {
        console.log(`📄 Performance report generated: ${reportResult.reportPath}`);
        
        // Show report location
        const relativePath = path.relative(process.cwd(), reportResult.reportPath);
        console.log(`📁 Report location: ${relativePath}`);
      } else {
        console.error(`❌ Failed to generate performance report: ${reportResult.error}`);
      }
      
      // Cleanup
      benchmark.cleanup();
      
    } catch (error) {
      console.error(`❌ Benchmark failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze existing benchmark reports')
  .option('-p, --project-path <path>', 'Project directory path', process.cwd())
  .option('-r, --report <filename>', 'Specific report file to analyze')
  .action(async (options) => {
    try {
      const benchmarkDir = path.join(options.projectPath, '.kc-orchestrator', 'benchmarks');
      
      // Check if benchmark directory exists
      if (!fs.existsSync(benchmarkDir)) {
        console.error(`❌ Benchmark directory not found: ${benchmarkDir}`);
        process.exit(1);
      }
      
      // Find all benchmark reports
      const files = await fs.readdir(benchmarkDir);
      const reportFiles = files.filter(f => f.endsWith('.json') && f.includes('performance'));
      
      if (reportFiles.length === 0) {
        console.error('❌ No benchmark reports found');
        process.exit(1);
      }
      
      console.log(`📊 Found ${reportFiles.length} benchmark report(s):`);
      reportFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file}`);
      });
      
      // Analyze the most recent report or the specified one
      const reportFile = options.report || reportFiles[reportFiles.length - 1];
      const reportPath = path.join(benchmarkDir, reportFile);
      const reportContent = await fs.readFile(reportPath, 'utf8');
      const reportData = JSON.parse(reportContent);
      
      console.log(`\n📋 Analyzing report: ${reportFile}`);
      console.log(`📅 Generated: ${new Date(reportData.timestamp).toLocaleString()}`);
      console.log(`📊 Total Metrics: ${reportData.totalMetrics}`);
      
      // Analyze each metric type
      for (const [metricType, stats] of Object.entries(reportData.statisticsByMetric)) {
        console.log(`\n📈 ${metricType.replace(/-/g, ' ').toUpperCase()}:`);
        console.log(`   Count: ${stats.count}`);
        console.log(`   Average: ${stats.average.toFixed(2)}ms`);
        console.log(`   Min: ${stats.min.toFixed(2)}ms`);
        console.log(`   Max: ${stats.max.toFixed(2)}ms`);
        console.log(`   Std Dev: ${stats.stdDev.toFixed(2)}ms`);
        
        // Performance classification
        if (stats.average < 50) {
          console.log(`   🟢 Performance: Excellent`);
        } else if (stats.average < 100) {
          console.log(`   🟡 Performance: Good`);
        } else if (stats.average < 200) {
          console.log(`   🟠 Performance: Fair`);
        } else {
          console.log(`   🔴 Performance: Needs optimization`);
        }
      }
      
      // Show system info
      console.log(`\n💻 System Information:`);
      console.log(`   Node.js: ${reportData.systemInfo.nodeVersion}`);
      console.log(`   Platform: ${reportData.systemInfo.platform} (${reportData.systemInfo.arch})`);
      console.log(`   Uptime: ${reportData.systemInfo.uptime.toFixed(2)} seconds`);
      
    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare multiple benchmark reports')
  .option('-p, --project-path <path>', 'Project directory path', process.cwd())
  .option('-f, --files <files>', 'Comma-separated list of report files to compare')
  .action(async (options) => {
    try {
      const benchmarkDir = path.join(options.projectPath, '.kc-orchestrator', 'benchmarks');
      
      // Get report files
      let reportFiles;
      if (options.files) {
        reportFiles = options.files.split(',').map(f => f.trim());
      } else {
        const files = await fs.readdir(benchmarkDir);
        reportFiles = files.filter(f => f.endsWith('.json') && f.includes('performance'));
        // Take the 3 most recent reports
        reportFiles = reportFiles.sort().slice(-3);
      }
      
      if (reportFiles.length < 2) {
        console.error('❌ Need at least 2 reports for comparison');
        process.exit(1);
      }
      
      console.log(`📊 Comparing ${reportFiles.length} benchmark reports:`);
      
      const reports = [];
      for (const reportFile of reportFiles) {
        const reportPath = path.join(benchmarkDir, reportFile);
        const reportContent = await fs.readFile(reportPath, 'utf8');
        const reportData = JSON.parse(reportContent);
        reports.push({
          name: reportFile,
          timestamp: reportData.timestamp,
          data: reportData
        });
      }
      
      // Sort reports by timestamp
      reports.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Compare metrics across reports
      const metricTypes = new Set();
      reports.forEach(report => {
        Object.keys(report.data.statisticsByMetric).forEach(metricType => {
          metricTypes.add(metricType);
        });
      });
      
      console.log('\n📈 Performance Trends:');
      for (const metricType of metricTypes) {
        console.log(`\n${metricType.replace(/-/g, ' ').toUpperCase()}:`);
        console.log('Report | Average (ms) | Min (ms) | Max (ms) | Change (%)');
        console.log('-------|-------------|----------|----------|------------');
        
        let previousAvg = null;
        for (let i = 0; i < reports.length; i++) {
          const report = reports[i];
          const stats = report.data.statisticsByMetric[metricType];
          if (!stats) continue;
          
          const change = previousAvg ? (((stats.average - previousAvg) / previousAvg) * 100).toFixed(1) : '0';
          const changeSymbol = change > 0 ? '↑' : change < 0 ? '↓' : '=';
          
          console.log(`${i + 1}. ${report.name.split('-').slice(0, 2).join('-')} | ${stats.average.toFixed(1).padStart(11)} | ${stats.min.toFixed(1).padStart(8)} | ${stats.max.toFixed(1).padStart(8)} | ${changeSymbol}${change.padStart(6)}%`);
          
          previousAvg = stats.average;
        }
      }
      
    } catch (error) {
      console.error(`❌ Comparison failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean up old benchmark reports')
  .option('-p, --project-path <path>', 'Project directory path', process.cwd())
  .option('-d, --days <days>', 'Keep reports from last N days', '30')
  .option('-a, --all', 'Delete all benchmark reports', false)
  .action(async (options) => {
    try {
      const benchmarkDir = path.join(options.projectPath, '.kc-orchestrator', 'benchmarks');
      
      if (!fs.existsSync(benchmarkDir)) {
        console.log('ℹ️ No benchmark directory found, nothing to clean');
        return;
      }
      
      const files = await fs.readdir(benchmarkDir);
      const reportFiles = files.filter(f => f.endsWith('.json') && f.includes('performance'));
      
      if (reportFiles.length === 0) {
        console.log('ℹ️ No benchmark reports found, nothing to clean');
        return;
      }
      
      if (options.all) {
        console.log(`🗑️  Deleting all ${reportFiles.length} benchmark reports...`);
        for (const file of reportFiles) {
          await fs.unlink(path.join(benchmarkDir, file));
        }
        console.log('✅ All benchmark reports deleted');
        return;
      }
      
      // Filter reports by age
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(options.days));
      
      const oldReports = [];
      for (const file of reportFiles) {
        // Extract timestamp from filename (format: performance-report-1234567890123.json)
        const timestampMatch = file.match(/performance-(?:report|benchmark)-(\d+)\.json/);
        if (timestampMatch) {
          const fileTimestamp = parseInt(timestampMatch[1]);
          const fileDate = new Date(fileTimestamp);
          
          if (fileDate < cutoffDate) {
            oldReports.push(file);
          }
        }
      }
      
      if (oldReports.length === 0) {
        console.log(`ℹ️ No old reports found (keeping last ${options.days} days)`);
        return;
      }
      
      console.log(`🗑️  Deleting ${oldReports.length} old benchmark reports (older than ${options.days} days)...`);
      for (const file of oldReports) {
        await fs.unlink(path.join(benchmarkDir, file));
      }
      console.log('✅ Old benchmark reports cleaned up');
      
    } catch (error) {
      console.error(`❌ Cleanup failed: ${error.message}`);
      process.exit(1);
    }
  });

// Default command (show help)
program.parse(process.argv);