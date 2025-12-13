#!/usr/bin/env node

/**
 * Coverage Report Generator
 * 
 * Generates a comprehensive coverage report from Jest coverage data
 */

const fs = require('fs').promises;
const path = require('path');

async function generateCoverageReport() {
  try {
    // Read coverage summary
    const coverageSummary = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'coverage', 'coverage-summary.json'), 'utf8'));
    
    console.log('📊 Coverage Report Summary');
    console.log('========================');
    console.log();
    
    // Overall coverage
    const total = coverageSummary.total;
    console.log('🌍 Overall Coverage:');
    console.log(`  Lines:        ${(total.lines.pct).toFixed(2)}% (${total.lines.covered}/${total.lines.total})`);
    console.log(`  Statements:   ${(total.statements.pct).toFixed(2)}% (${total.statements.covered}/${total.statements.total})`);
    console.log(`  Functions:    ${(total.functions.pct).toFixed(2)}% (${total.functions.covered}/${total.functions.total})`);
    console.log(`  Branches:     ${(total.branches.pct).toFixed(2)}% (${total.branches.covered}/${total.branches.total})`);
    console.log();
    
    // File-by-file coverage
    console.log('📁 File Coverage:');
    const files = Object.entries(coverageSummary).filter(([key]) => key !== 'total');
    
    files.forEach(([filePath, coverage]) => {
      const relativePath = filePath.replace(process.cwd(), '');
      console.log(`  ${relativePath}`);
      console.log(`    Lines: ${coverage.lines.pct.toFixed(2)}%`);
      console.log(`    Functions: ${coverage.functions.pct.toFixed(2)}%`);
      console.log(`    Branches: ${coverage.branches.pct.toFixed(2)}%`);
    });
    
    console.log();
    
    // Check thresholds
    const thresholds = {
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 80
    };
    
    console.log('✅ Threshold Check:');
    const passedLines = total.lines.pct >= thresholds.lines;
    const passedStatements = total.statements.pct >= thresholds.statements;
    const passedFunctions = total.functions.pct >= thresholds.functions;
    const passedBranches = total.branches.pct >= thresholds.branches;
    
    console.log(`  Lines: ${passedLines ? '✅ PASS' : '❌ FAIL'} (${total.lines.pct.toFixed(2)}% >= ${thresholds.lines}%)`);
    console.log(`  Statements: ${passedStatements ? '✅ PASS' : '❌ FAIL'} (${total.statements.pct.toFixed(2)}% >= ${thresholds.statements}%)`);
    console.log(`  Functions: ${passedFunctions ? '✅ PASS' : '❌ FAIL'} (${total.functions.pct.toFixed(2)}% >= ${thresholds.functions}%)`);
    console.log(`  Branches: ${passedBranches ? '✅ PASS' : '❌ FAIL'} (${total.branches.pct.toFixed(2)}% >= ${thresholds.branches}%)`);
    
    const allPassed = passedLines && passedStatements && passedFunctions && passedBranches;
    console.log();
    console.log(`🎯 Overall: ${allPassed ? '✅ ALL THRESHOLDS PASSED' : '❌ SOME THRESHOLDS FAILED'}`);
    
    return allPassed;
    
  } catch (error) {
    console.error('❌ Error generating coverage report:', error.message);
    return false;
  }
}

// Run the report generation
generateCoverageReport().then(success => {
  process.exit(success ? 0 : 1);
});