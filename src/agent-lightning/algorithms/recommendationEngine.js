/**
 * Recommendation Engine Algorithms
 * Intelligent recommendation generation based on pain points
 */

const utils = require('../utils');

/**
 * Generate recommendations from pain points
 * @param {Array} painPoints - Identified pain points
 * @param {Object} options - Generation options
 * @returns {Array} Generated recommendations
 */
function generateRecommendations(painPoints, options = {}) {
  if (!painPoints || painPoints.length === 0) {
    return [];
  }

  // Validate and merge options
  const generationOptions = {
    maxRecommendations: 10,
    minSeverity: 'low',
    includeImplementation: true,
    includeAcceptanceCriteria: true,
    includeConstraints: true,
    ...options
  };

  const recommendations = [];

  // Generate recommendations for each pain point
  painPoints.forEach((painPoint, index) => {
    if (index >= generationOptions.maxRecommendations) {
      return;
    }

    // Skip pain points below minimum severity
    const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const painPointSeverityScore = severityOrder[painPoint.severity] || 0;
    const minSeverityScore = severityOrder[generationOptions.minSeverity] || 0;
    
    if (painPointSeverityScore < minSeverityScore) {
      return;
    }

    const recommendation = createRecommendationFromPainPoint(painPoint, generationOptions);
    recommendations.push(recommendation);
  });

  // Sort recommendations by priority
  recommendations.sort((a, b) => {
    // Primary sort by priority score
    const priorityDiff = (b.metrics?.priorityScore || 0) - (a.metrics?.priorityScore || 0);
    if (priorityDiff !== 0) return priorityDiff;

    // Secondary sort by business impact
    return (b.metrics?.businessImpact || 0) - (a.metrics?.businessImpact || 0);
  });

  // Add deduplication
  return deduplicateRecommendations(recommendations);
}

/**
 * Create recommendation from pain point
 * @param {Object} painPoint - Pain point object
 * @param {Object} options - Generation options
 * @returns {Object} Recommendation
 */
function createRecommendationFromPainPoint(painPoint, options) {
  const recommendation = {
    id: `rec-${Date.now()}-${utils.generateUniqueId()}`,
    title: generateRecommendationTitle(painPoint),
    description: generateRecommendationDescription(painPoint),
    priority: painPoint.severity,
    category: painPoint.type,
    impact: painPoint.impact,
    effort: estimateEffort(painPoint),
    metadata: {
      source: 'native-recommendation-engine',
      generatedAt: new Date().toISOString(),
      relatedPainPoints: [painPoint.id],
      contentHash: utils.calculateContentHash(JSON.stringify(painPoint))
    }
  };

  if (options.includeImplementation) {
    recommendation.implementation = generateImplementationSteps(painPoint);
  }

  if (options.includeAcceptanceCriteria) {
    recommendation.acceptanceCriteria = generateAcceptanceCriteria(painPoint);
  }

  if (options.includeConstraints) {
    recommendation.constraints = generateConstraints(painPoint);
  }

  // Copy metrics from pain point
  if (painPoint.metrics) {
    recommendation.metrics = {
      ...painPoint.metrics,
      recommendationScore: calculateRecommendationScore(painPoint)
    };
  }

  return recommendation;
}

/**
 * Deduplicate recommendations
 * @param {Array} recommendations - Array of recommendations
 * @returns {Array} Deduplicated recommendations
 */
function deduplicateRecommendations(recommendations) {
  const uniqueRecommendations = [];
  const seenHashes = new Set();

  recommendations.forEach(recommendation => {
    const contentHash = recommendation.metadata.contentHash;
    
    if (!seenHashes.has(contentHash)) {
      seenHashes.add(contentHash);
      uniqueRecommendations.push(recommendation);
    }
  });

  return uniqueRecommendations;
}

/**
 * Generate recommendation title
 * @param {Object} painPoint - Pain point object
 * @returns {string} Title
 */
function generateRecommendationTitle(painPoint) {
  const typeTitles = {
    'reliability': `Enhance System Reliability`,
    'performance': `Optimize Performance`,
    'usability': `Improve Usability`,
    'maintenance': `Streamline Maintenance`,
    'security': `Strengthen Security`
  };

  const severityTitles = {
    'high': `Urgent`,
    'medium': `Important`,
    'low': `Recommended`
  };

  const baseTitle = typeTitles[painPoint.type] || `Address ${painPoint.type} Issues`;
  const severityTitle = severityTitles[painPoint.severity] || `Recommended`;

  return `${severityTitle}: ${baseTitle} to Resolve ${painPoint.category} Problems`;
}

/**
 * Generate recommendation description
 * @param {Object} painPoint - Pain point object
 * @returns {string} Description
 */
function generateRecommendationDescription(painPoint) {
  const descriptions = {
    'reliability': `Implement comprehensive improvements to address the reliability pain point: ${painPoint.description}. This will enhance system stability, reduce error rates, and improve overall user experience.`,
    'performance': `Optimize system performance to address the identified bottlenecks: ${painPoint.description}. This will reduce response times, improve throughput, and enhance user satisfaction.`,
    'usability': `Enhance system usability to resolve the identified issues: ${painPoint.description}. This will improve user interface clarity, reduce cognitive load, and increase user productivity.`,
    'maintenance': `Streamline maintenance processes to address the identified challenges: ${painPoint.description}. This will reduce operational overhead, improve system manageability, and enhance developer productivity.`
  };

  return descriptions[painPoint.type] || `Implement targeted improvements to address the identified pain point: ${painPoint.description}.`;
}

/**
 * Generate implementation steps
 * @param {Object} painPoint - Pain point object
 * @returns {string} Implementation steps
 */
function generateImplementationSteps(painPoint) {
  const steps = {
    'reliability': `1. Conduct root cause analysis of the ${painPoint.category} issues\n2. Implement robust error handling and recovery mechanisms\n3. Add comprehensive logging and monitoring for debugging\n4. Develop automated tests to prevent regression\n5. Deploy fixes and monitor impact in production`,
    'performance': `1. Profile system performance to identify specific bottlenecks\n2. Optimize database queries, API calls, and resource usage\n3. Implement caching strategies where appropriate\n4. Review and optimize algorithms and data structures\n5. Monitor performance improvements and iterate`,
    'usability': `1. Conduct user research to understand pain points\n2. Redesign problematic user interface elements\n3. Improve error messages and user guidance\n4. Implement usability testing with real users\n5. Iterate based on user feedback`
  };

  return steps[painPoint.type] || `1. Analyze the root causes of the identified pain point\n2. Design and implement appropriate solutions\n3. Add comprehensive tests and documentation\n4. Deploy changes and monitor impact`;
}

/**
 * Generate acceptance criteria
 * @param {Object} painPoint - Pain point object
 * @returns {Array} Acceptance criteria
 */
function generateAcceptanceCriteria(painPoint) {
  const criteria = {
    'reliability': [
      `Reduce failure rate by at least 50%`,
      `Implement comprehensive error handling for all identified scenarios`,
      `Add monitoring and alerting for the specific reliability issues`,
      `Achieve 95% test coverage for the implemented fixes`,
      `Document all changes and update runbooks`
    ],
    'performance': [
      `Reduce average response time by 30% or more`,
      `Optimize all identified performance bottlenecks`,
      `Implement performance monitoring and alerting`,
      `Maintain or improve existing success rates`,
      `Document performance characteristics and optimization strategies`
    ],
    'usability': [
      `Improve user satisfaction scores by 20%`,
      `Reduce user error rates by 30%`,
      `Implement usability improvements based on user feedback`,
      `Conduct usability testing with at least 5 representative users`,
      `Document usability guidelines and best practices`
    ]
  };

  return criteria[painPoint.type] || [
    `Address the root causes of the identified pain point`,
    `Implement comprehensive solutions with proper error handling`,
    `Add appropriate monitoring and logging`,
    `Create automated tests to prevent regression`,
    `Document all changes and updates`
  ];
}

/**
 * Generate constraints
 * @param {Object} painPoint - Pain point object
 * @returns {Object} Constraints object
 */
function generateConstraints(painPoint) {
  return {
    do: [
      `Implement comprehensive error handling and logging`,
      `Add appropriate unit and integration tests`,
      `Document all changes and updates`,
      `Follow existing code style and patterns`,
      `Consider backward compatibility requirements`
    ],
    dont: [
      `Break existing functionality`,
      `Remove existing validation checks`,
      `Introduce new dependencies without justification`,
      `Make changes without proper testing`,
      `Ignore security best practices`
    ]
  };
}

/**
 * Estimate effort
 * @param {Object} painPoint - Pain point object
 * @returns {string} Effort estimate (S, M, L, XL)
 */
function estimateEffort(painPoint) {
  const severityEffort = {
    'high': 2,
    'medium': 1,
    'low': 0
  };

  const typeEffort = {
    'reliability': 1,
    'performance': 2,
    'usability': 1,
    'maintenance': 1,
    'security': 2
  };

  const effortScore = (severityEffort[painPoint.severity] || 1) + (typeEffort[painPoint.type] || 1);

  if (effortScore >= 3) return 'L';
  if (effortScore >= 2) return 'M';
  return 'S';
}

/**
 * Calculate recommendation score
 * @param {Object} painPoint - Pain point object
 * @returns {number} Recommendation score (0-100)
 */
function calculateRecommendationScore(painPoint) {
  const businessImpact = painPoint.metrics?.businessImpact || 0;
  const technicalDebt = painPoint.metrics?.technicalDebt || 0;
  const roiPotential = painPoint.metrics?.roiPotential || 0;
  const priorityScore = painPoint.metrics?.priorityScore || 0;

  // Weighted average
  return Math.min(Math.round(
    (businessImpact * 0.3 + technicalDebt * 0.2 + roiPotential * 0.3 + priorityScore * 0.2)
  ), 100);
}

/**
 * Generate prioritized recommendation list
 * @param {Array} painPoints - Array of pain points
 * @param {Object} options - Generation options
 * @returns {Object} Prioritized recommendation report
 */
function generatePrioritizedRecommendationReport(painPoints, options = {}) {
  const recommendations = generateRecommendations(painPoints, options);

  // Group by category
  const byCategory = {};
  recommendations.forEach(rec => {
    if (!byCategory[rec.category]) {
      byCategory[rec.category] = [];
    }
    byCategory[rec.category].push(rec);
  });

  // Group by effort
  const byEffort = {};
  recommendations.forEach(rec => {
    if (!byEffort[rec.effort]) {
      byEffort[rec.effort] = [];
    }
    byEffort[rec.effort].push(rec);
  });

  // Calculate total metrics
  const totalBusinessImpact = recommendations.reduce((sum, rec) => 
    sum + (rec.metrics?.businessImpact || 0), 0
  );
  const avgBusinessImpact = recommendations.length > 0 
    ? totalBusinessImpact / recommendations.length
    : 0;

  return {
    recommendations,
    summary: {
      totalRecommendations: recommendations.length,
      totalBusinessImpact,
      avgBusinessImpact: Math.round(avgBusinessImpact),
      byCategory,
      byEffort,
      highPriority: recommendations.filter(r => r.priority === 'high').length,
      mediumPriority: recommendations.filter(r => r.priority === 'medium').length,
      lowPriority: recommendations.filter(r => r.priority === 'low').length
    }
  };
}

/**
 * Generate implementation roadmap
 * @param {Array} recommendations - Array of recommendations
 * @param {Object} options - Roadmap options
 * @returns {Object} Implementation roadmap
 */
function generateImplementationRoadmap(recommendations, options = {}) {
  const roadmapOptions = {
    sprintDurationWeeks: 2,
    teamCapacity: 20, // Story points per sprint
    ...options
  };

  // Estimate story points for each recommendation
  const recommendationsWithEstimates = recommendations.map(rec => ({
    ...rec,
    storyPoints: estimateStoryPoints(rec),
    sprint: calculateSprintAssignment(rec, roadmapOptions)
  }));

  // Group by sprint
  const sprints = {};
  recommendationsWithEstimates.forEach(rec => {
    const sprintNumber = rec.sprint;
    if (!sprints[sprintNumber]) {
      sprints[sprintNumber] = {
        recommendations: [],
        totalStoryPoints: 0
      };
    }
    sprints[sprintNumber].recommendations.push(rec);
    sprints[sprintNumber].totalStoryPoints += rec.storyPoints;
  });

  return {
    recommendations: recommendationsWithEstimates,
    sprints,
    totalStoryPoints: recommendationsWithEstimates.reduce((sum, rec) => sum + rec.storyPoints, 0),
    estimatedSprints: Object.keys(sprints).length,
    estimatedDurationWeeks: Object.keys(sprints).length * roadmapOptions.sprintDurationWeeks
  };
}

/**
 * Estimate story points
 * @param {Object} recommendation - Recommendation object
 * @returns {number} Story points estimate
 */
function estimateStoryPoints(recommendation) {
  const effortScores = { 'S': 2, 'M': 5, 'L': 8, 'XL': 13 };
  const priorityScores = { 'high': 1.5, 'medium': 1.0, 'low': 0.8 };

  const baseScore = effortScores[recommendation.effort] || 5;
  const priorityFactor = priorityScores[recommendation.priority] || 1.0;

  return Math.round(baseScore * priorityFactor);
}

/**
 * Calculate sprint assignment
 * @param {Object} recommendation - Recommendation object
 * @param {Object} options - Roadmap options
 * @returns {number} Sprint number
 */
function calculateSprintAssignment(recommendation, options) {
  // This is a simplified assignment - in a real scenario, we'd consider dependencies
  const storyPoints = estimateStoryPoints(recommendation);
  const capacity = options.teamCapacity;

  // Assign to first sprint that has capacity
  // In a real implementation, we'd track cumulative capacity across sprints
  return 1; // Simplified for this example
}

module.exports = {
  generateRecommendations,
  createRecommendationFromPainPoint,
  deduplicateRecommendations,
  generateRecommendationTitle,
  generateRecommendationDescription,
  generateImplementationSteps,
  generateAcceptanceCriteria,
  generateConstraints,
  estimateEffort,
  calculateRecommendationScore,
  generatePrioritizedRecommendationReport,
  generateImplementationRoadmap,
  estimateStoryPoints,
  calculateSprintAssignment
};