/**
 * Pain Point Analysis Algorithms
 * Advanced analysis for identifying and categorizing pain points
 */

const utils = require('../utils');

/**
 * Analyze patterns and identify pain points
 * @param {Array} patterns - Detected patterns
 * @param {Object} options - Analysis options
 * @returns {Array} Identified pain points
 */
function identifyPainPoints(patterns, options = {}) {
  if (!patterns || patterns.length === 0) {
    return [];
  }

  // Validate and merge options
  const analysisOptions = {
    minSeverity: 'low',
    groupSimilar: true,
    similarityThreshold: 0.8,
    ...options
  };

  let painPoints = [];

  // Convert patterns to pain points
  patterns.forEach((pattern, index) => {
    // Skip patterns below minimum severity
    const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const patternSeverityScore = severityOrder[pattern.severity] || 0;
    const minSeverityScore = severityOrder[analysisOptions.minSeverity] || 0;
    
    if (patternSeverityScore < minSeverityScore) {
      return;
    }

    const painPoint = createPainPointFromPattern(pattern, index);
    painPoints.push(painPoint);
  });

  // Group similar pain points
  if (analysisOptions.groupSimilar) {
    painPoints = groupSimilarPainPoints(painPoints, analysisOptions.similarityThreshold);
  }

  // Calculate comprehensive metrics
  painPoints = painPoints.map(painPoint => {
    return enhancePainPointWithMetrics(painPoint);
  });

  // Sort by severity and impact
  painPoints.sort((a, b) => {
    const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const impactOrder = { 'critical': 4, 'major': 3, 'moderate': 2, 'minor': 1 };

    // Primary sort by severity
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
    if (severityDiff !== 0) return severityDiff;

    // Secondary sort by impact
    const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
    if (impactDiff !== 0) return impactDiff;

    // Tertiary sort by business impact
    return (b.metrics.businessImpact || 0) - (a.metrics.businessImpact || 0);
  });

  return painPoints;
}

/**
 * Create pain point from pattern
 * @param {Object} pattern - Detected pattern
 * @param {number} index - Index for unique ID
 * @returns {Object} Pain point
 */
function createPainPointFromPattern(pattern, index) {
  return {
    id: `pp-${Date.now()}-${index}`,
    type: mapPatternToPainPointType(pattern.patternType),
    severity: pattern.severity,
    title: generatePainPointTitle(pattern),
    description: generatePainPointDescription(pattern),
    impact: mapSeverityToImpact(pattern.severity),
    category: pattern.patternType,
    metrics: {
      occurrenceRate: pattern.metrics.frequency || 0,
      affectedComponents: pattern.affectedRuns.length,
      firstSeen: pattern.details?.firstOccurrence || new Date().toISOString(),
      lastSeen: pattern.details?.lastOccurrence || new Date().toISOString()
    },
    evidence: pattern.evidence || [],
    relatedPatterns: [pattern.patternType],
    tags: generateTagsFromPattern(pattern)
  };
}

/**
 * Group similar pain points
 * @param {Array} painPoints - Array of pain points
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Array} Grouped pain points
 */
function groupSimilarPainPoints(painPoints, threshold) {
  const groups = [];
  const usedIndices = new Set();

  // Simple similarity grouping based on type and description
  painPoints.forEach((painPoint, index) => {
    if (usedIndices.has(index)) return;

    const group = [painPoint];
    usedIndices.add(index);

    // Find similar pain points
    for (let i = index + 1; i < painPoints.length; i++) {
      if (usedIndices.has(i)) continue;

      const other = painPoints[i];
      if (arePainPointsSimilar(painPoint, other, threshold)) {
        group.push(other);
        usedIndices.add(i);
      }
    }

    // Merge group into single pain point
    if (group.length > 1) {
      groups.push(mergePainPoints(group));
    } else {
      groups.push(group[0]);
    }
  });

  return groups;
}

/**
 * Check if two pain points are similar
 * @param {Object} a - First pain point
 * @param {Object} b - Second pain point
 * @param {number} threshold - Similarity threshold
 * @returns {boolean} True if similar
 */
function arePainPointsSimilar(a, b, threshold) {
  // Same type and category
  if (a.type !== b.type || a.category !== b.category) {
    return false;
  }

  // Similar description (simple text similarity)
  const descA = a.description.toLowerCase();
  const descB = b.description.toLowerCase();
  
  const commonWords = descA.split(' ').filter(word => 
    descB.includes(word) && word.length > 3
  );
  
  const similarity = commonWords.length / Math.max(
    descA.split(' ').length,
    descB.split(' ').length
  );

  return similarity > threshold;
}

/**
 * Merge multiple pain points into one
 * @param {Array} painPoints - Array of pain points to merge
 * @returns {Object} Merged pain point
 */
function mergePainPoints(painPoints) {
  if (painPoints.length === 0) return null;
  
  const base = painPoints[0];
  
  // Calculate average severity
  const severityScores = { 'high': 3, 'medium': 2, 'low': 1 };
  const avgSeverityScore = painPoints.reduce((sum, p) => 
    sum + severityScores[p.severity], 0
  ) / painPoints.length;
  
  const severity = avgSeverityScore >= 2.5 ? 'high' : 
                   avgSeverityScore >= 1.5 ? 'medium' : 'low';

  // Merge evidence
  const allEvidence = painPoints.flatMap(p => p.evidence);
  const uniqueEvidence = Array.from(new Set(allEvidence.map(e => JSON.stringify(e))))
    .map(e => JSON.parse(e));

  // Merge related patterns
  const allPatterns = painPoints.flatMap(p => p.relatedPatterns);
  const uniquePatterns = [...new Set(allPatterns)];

  // Merge tags
  const allTags = painPoints.flatMap(p => p.tags);
  const uniqueTags = [...new Set(allTags)];

  return {
    ...base,
    id: `merged-${Date.now()}`,
    severity,
    impact: severity === 'high' ? 'major' : 'moderate',
    title: `Multiple ${base.type} issues detected (${painPoints.length} related problems)`,
    description: `Consolidated pain point representing ${painPoints.length} similar issues: ${base.description}`,
    evidence: uniqueEvidence,
    relatedPatterns: uniquePatterns,
    tags: uniqueTags,
    metrics: {
      ...base.metrics,
      occurrenceRate: painPoints.reduce((sum, p) => sum + (p.metrics.occurrenceRate || 0), 0),
      affectedComponents: painPoints.reduce((sum, p) => sum + (p.metrics.affectedComponents || 0), 0)
    }
  };
}

/**
 * Enhance pain point with comprehensive metrics
 * @param {Object} painPoint - Pain point to enhance
 * @returns {Object} Enhanced pain point
 */
function enhancePainPointWithMetrics(painPoint) {
  // Calculate business impact
  const businessImpact = calculateBusinessImpact(painPoint);
  
  // Calculate technical debt
  const technicalDebt = calculateTechnicalDebt(painPoint);
  
  // Calculate ROI potential
  const roiPotential = calculateROIPotential(painPoint);

  return {
    ...painPoint,
    metrics: {
      ...painPoint.metrics,
      businessImpact,
      technicalDebt,
      roiPotential,
      priorityScore: calculatePriorityScore(painPoint, businessImpact, technicalDebt)
    }
  };
}

/**
 * Map pattern type to pain point type
 * @param {string} patternType - Pattern type
 * @returns {string} Pain point type
 */
function mapPatternToPainPointType(patternType) {
  const mapping = {
    'failure': 'reliability',
    'retry': 'reliability',
    'performance': 'performance',
    'anomaly': 'reliability',
    'temporal': 'maintenance'
  };
  return mapping[patternType] || 'reliability';
}

/**
 * Map severity to impact
 * @param {string} severity - Severity level
 * @returns {string} Impact level
 */
function mapSeverityToImpact(severity) {
  const mapping = {
    'high': 'major',
    'medium': 'moderate',
    'low': 'minor'
  };
  return mapping[severity] || 'minor';
}

/**
 * Generate pain point title
 * @param {Object} pattern - Pattern object
 * @returns {string} Title
 */
function generatePainPointTitle(pattern) {
  const titles = {
    'failure': `Reliability Issues: ${pattern.affectedRuns.length} Runs Affected by ${pattern.description}`,
    'retry': `Operation Reliability: Excessive Retries in ${pattern.affectedRuns.length} Runs`,
    'performance': `Performance Degradation: ${pattern.affectedRuns.length} Runs with High Latency`,
    'anomaly': `Anomalous Behavior: Statistical Outliers in ${pattern.affectedRuns.length} Runs`,
    'temporal': `Temporal Analysis: Historical Data Patterns in ${pattern.affectedRuns.length} Runs`
  };
  return titles[pattern.patternType] || `Identified Pain Point: ${pattern.description}`;
}

/**
 * Generate pain point description
 * @param {Object} pattern - Pattern object
 * @returns {string} Description
 */
function generatePainPointDescription(pattern) {
  const descriptions = {
    'failure': `A pattern of failures has been detected with ${pattern.metrics.avgImpact.toFixed(1)}% impact across ${pattern.occurrences} occurrences. This affects ${pattern.affectedRuns.length} unique runs and indicates potential reliability issues that require attention.`,
    'retry': `Excessive retry behavior has been identified with an average of ${pattern.metrics.avgImpact.toFixed(1)} retries per operation across ${pattern.occurrences} occurrences. This impacts ${pattern.affectedRuns.length} runs and suggests issues with operation reliability or error handling mechanisms.`,
    'performance': `Performance bottlenecks have been detected with average durations of ${(pattern.metrics.avgImpact / 1000).toFixed(1)} seconds across ${pattern.occurrences} occurrences. This affects ${pattern.affectedRuns.length} runs and impacts overall system efficiency and user experience.`,
    'anomaly': `Statistical anomalies have been identified with ${pattern.occurrences} outliers detected using a ${pattern.metrics.zScoreThreshold}σ threshold. These anomalies affect ${pattern.affectedRuns.length} runs and may indicate unusual system behavior or edge cases.`
  };
  return descriptions[pattern.patternType] || pattern.description;
}

/**
 * Generate tags from pattern
 * @param {Object} pattern - Pattern object
 * @returns {Array} Tags
 */
function generateTagsFromPattern(pattern) {
  const tags = [pattern.patternType, pattern.severity];
  
  if (pattern.details?.errorType) {
    tags.push(`error:${pattern.details.errorType}`);
  }
  
  if (pattern.details?.provider) {
    tags.push(`provider:${pattern.details.provider}`);
  }
  
  return tags;
}

/**
 * Calculate business impact score (0-100)
 * @param {Object} painPoint - Pain point object
 * @returns {number} Business impact score
 */
function calculateBusinessImpact(painPoint) {
  const severityScores = { 'high': 80, 'medium': 50, 'low': 20 };
  const impactScores = { 'critical': 100, 'major': 70, 'moderate': 40, 'minor': 10 };
  
  const severityFactor = severityScores[painPoint.severity] || 50;
  const impactFactor = impactScores[painPoint.impact] || 40;
  const frequencyFactor = Math.min(painPoint.metrics.occurrenceRate * 100, 100);
  const scaleFactor = Math.min(painPoint.metrics.affectedComponents, 100);
  
  return Math.min(Math.round((severityFactor + impactFactor + frequencyFactor + scaleFactor) / 4), 100);
}

/**
 * Calculate technical debt score (0-100)
 * @param {Object} painPoint - Pain point object
 * @returns {number} Technical debt score
 */
function calculateTechnicalDebt(painPoint) {
  const debtScores = {
    'failure': 70,
    'retry': 60,
    'performance': 80,
    'anomaly': 50,
    'temporal': 30
  };
  
  const severityScores = { 'high': 30, 'medium': 20, 'low': 10 };
  
  const typeFactor = debtScores[painPoint.category] || 50;
  const severityFactor = severityScores[painPoint.severity] || 20;
  const ageFactor = calculateAgeFactor(painPoint.metrics.firstSeen);
  
  return Math.min(Math.round((typeFactor + severityFactor + ageFactor) / 3), 100);
}

/**
 * Calculate age factor for technical debt
 * @param {string} firstSeen - First seen timestamp
 * @returns {number} Age factor (0-50)
 */
function calculateAgeFactor(firstSeen) {
  try {
    const firstDate = new Date(firstSeen);
    const now = new Date();
    const ageDays = (now - firstDate) / (1000 * 60 * 60 * 24);
    
    // Older issues contribute more to technical debt
    return Math.min(Math.round(ageDays / 7), 50); // Max 50 after 350 days
  } catch (error) {
    return 10; // Default age factor
  }
}

/**
 * Calculate ROI potential score (0-100)
 * @param {Object} painPoint - Pain point object
 * @returns {number} ROI potential score
 */
function calculateROIPotential(painPoint) {
  const businessImpact = painPoint.metrics.businessImpact || 0;
  const technicalDebt = painPoint.metrics.technicalDebt || 0;
  
  // Higher business impact and technical debt mean higher ROI potential
  return Math.min(Math.round((businessImpact + technicalDebt) / 2 * 1.2), 100);
}

/**
 * Calculate priority score (0-100)
 * @param {Object} painPoint - Pain point object
 * @param {number} businessImpact - Business impact score
 * @param {number} technicalDebt - Technical debt score
 * @returns {number} Priority score
 */
function calculatePriorityScore(painPoint, businessImpact, technicalDebt) {
  const severityScores = { 'high': 40, 'medium': 25, 'low': 10 };
  const impactScores = { 'critical': 50, 'major': 35, 'moderate': 20, 'minor': 5 };
  
  const severityFactor = severityScores[painPoint.severity] || 25;
  const impactFactor = impactScores[painPoint.impact] || 20;
  const businessFactor = businessImpact / 2;
  const debtFactor = technicalDebt / 2;
  
  return Math.min(Math.round(severityFactor + impactFactor + businessFactor + debtFactor), 100);
}

module.exports = {
  identifyPainPoints,
  createPainPointFromPattern,
  groupSimilarPainPoints,
  enhancePainPointWithMetrics,
  mapPatternToPainPointType,
  mapSeverityToImpact,
  generatePainPointTitle,
  generatePainPointDescription,
  generateTagsFromPattern,
  calculateBusinessImpact,
  calculateTechnicalDebt,
  calculateROIPotential,
  calculatePriorityScore
};