// services/rcaEngine.js
class RCAEngine {
  constructor() {
    this.models = {
      isolationForest: null,
      linearRegression: null,
      patternMatcher: null
    };
    this.historicalData = [];
    this.patterns = {};
  }

  /**
   * Analyze failure and find root causes with probabilities
   */
  async analyzeFailure(assetId, failureData) {
    console.log('[RCA] 🔍 Starting Root Cause Analysis for:', assetId);
    
    const results = await this.performMultiModelAnalysis(assetId, failureData);
    const causes = this.prioritizeCauses(results);
    const recommendations = this.generateRecommendations(causes, failureData);
    
    return {
      asset_id: assetId,
      timestamp: new Date().toISOString(),
      confidence_score: this.calculateConfidence(causes),
      causes: causes.map(c => ({
        cause: c.name,
        probability: c.probability,
        evidence: c.evidence,
        contributing_factors: c.factors,
        severity: c.severity
      })),
      recommendations: recommendations,
      estimated_cost: this.estimateCost(causes),
      estimated_downtime: this.estimateDowntime(causes),
      similar_cases: await this.findSimilarCases(assetId, failureData)
    };
  }

  /**
   * Perform analysis using multiple ML models
   */
  async performMultiModelAnalysis(assetId, failureData) {
    const results = [];
    
    // 1. Time-based correlation analysis
    const timeCorrelation = this.analyzeTimeCorrelation(failureData);
    results.push(...timeCorrelation);
    
    // 2. Pattern recognition from historical data
    const patterns = this.findPatterns(assetId, failureData);
    results.push(...patterns);
    
    // 3. Sensor data analysis
    const sensorAnalysis = this.analyzeSensorData(failureData);
    results.push(...sensorAnalysis);
    
    // 4. ML model predictions
    const mlPredictions = await this.getMLPredictions(assetId, failureData);
    results.push(...mlPredictions);
    
    return results;
  }

  /**
   * Analyze time-based correlation of events
   */
  analyzeTimeCorrelation(failureData) {
    const causes = [];
    const events = failureData.events || [];
    const failureTime = new Date(failureData.timestamp);
    
    // Check for events that occurred before failure
    for (const event of events) {
      const eventTime = new Date(event.timestamp);
      const timeDiff = (failureTime - eventTime) / (1000 * 60 * 60); // hours
      
      if (timeDiff > 0 && timeDiff < 24) {
        causes.push({
          name: event.type,
          probability: Math.min(90, 60 + (24 - timeDiff) * 1.25),
          evidence: `Event occurred ${timeDiff.toFixed(1)} hours before failure`,
          factors: event.details || [],
          severity: this.getSeverity(event.type)
        });
      }
    }
    
    return causes;
  }

  /**
   * Find patterns in historical data
   */
  findPatterns(assetId, failureData) {
    const patterns = [];
    const history = this.historicalData
      .filter(d => d.asset_id === assetId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);
    
    if (history.length < 5) return patterns;
    
    // Look for similar patterns
    const current = {
      temperature: failureData.temperature,
      vibration: failureData.vibration,
      pressure: failureData.pressure,
      health: failureData.health_score
    };
    
    for (const record of history) {
      const similarity = this.calculateSimilarity(current, {
        temperature: record.temperature,
        vibration: record.vibration,
        pressure: record.pressure,
        health: record.health_score
      });
      
      if (similarity > 0.7 && record.failure) {
        patterns.push({
          name: record.failure_type || 'Similar pattern detected',
          probability: Math.min(85, 50 + similarity * 35),
          evidence: `${(similarity * 100).toFixed(0)}% similarity to previous failure`,
          factors: record.factors || [],
          severity: record.severity || 'Medium'
        });
      }
    }
    
    return patterns;
  }

  /**
   * Analyze sensor data for anomalies
   */
  analyzeSensorData(failureData) {
    const causes = [];
    const sensors = failureData.sensors || {};
    
    // Check each sensor for anomalies
    const sensorThresholds = {
      temperature: { warning: 75, critical: 85, max: 100 },
      vibration: { warning: 2.8, critical: 4.5, max: 8 },
      pressure: { warning: 4, critical: 6, max: 8 },
      energy: { warning: 1.5, critical: 2.0, max: 3 }
    };
    
    for (const [key, value] of Object.entries(sensors)) {
      const thresholds = sensorThresholds[key];
      if (!thresholds) continue;
      
      if (value > thresholds.critical) {
        causes.push({
          name: `Critical ${key} anomaly`,
          probability: Math.min(95, 70 + (value - thresholds.critical) / (thresholds.max - thresholds.critical) * 25),
          evidence: `${key} at ${value} (threshold: ${thresholds.critical})`,
          factors: [`Immediate ${key} issue detected`],
          severity: 'Critical'
        });
      } else if (value > thresholds.warning) {
        causes.push({
          name: `Elevated ${key} levels`,
          probability: Math.min(70, 50 + (value - thresholds.warning) / (thresholds.critical - thresholds.warning) * 20),
          evidence: `${key} at ${value} (warning: ${thresholds.warning})`,
          factors: [`Monitor ${key} closely`],
          severity: 'High'
        });
      }
    }
    
    return causes;
  }

  /**
   * Get predictions from ML models
   */
  async getMLPredictions(assetId, failureData) {
    // Simulate ML predictions - replace with actual model calls
    const predictions = [
      {
        name: 'Bearing wear',
        probability: 78,
        evidence: 'Vibration pattern matches bearing degradation',
        factors: ['Lubrication issues', 'Normal wear and tear'],
        severity: 'High'
      },
      {
        name: 'Electrical fault',
        probability: 45,
        evidence: 'Intermittent power fluctuations detected',
        factors: ['Ageing components', 'Environmental factors'],
        severity: 'Medium'
      },
      {
        name: 'Cooling system failure',
        probability: 65,
        evidence: 'Temperature trends indicate cooling inefficiency',
        factors: ['Blocked cooling channels', 'Fan degradation'],
        severity: 'High'
      }
    ];
    
    return predictions;
  }

  /**
   * Calculate similarity between two states
   */
  calculateSimilarity(state1, state2) {
    let matches = 0;
    let total = 0;
    
    const keys = ['temperature', 'vibration', 'pressure', 'health'];
    for (const key of keys) {
      if (state1[key] !== undefined && state2[key] !== undefined) {
        total++;
        const diff = Math.abs(state1[key] - state2[key]);
        const maxDiff = key === 'temperature' ? 20 : key === 'vibration' ? 2 : 3;
        if (diff < maxDiff) matches++;
      }
    }
    
    return total > 0 ? matches / total : 0;
  }

  /**
   * Prioritize causes by probability and severity
   */
  prioritizeCauses(results) {
    return results
      .sort((a, b) => {
        const scoreA = a.probability * (a.severity === 'Critical' ? 1.5 : a.severity === 'High' ? 1.2 : 1);
        const scoreB = b.probability * (b.severity === 'Critical' ? 1.5 : b.severity === 'High' ? 1.2 : 1);
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }

  /**
   * Get severity based on cause type
   */
  getSeverity(type) {
    const severityMap = {
      'Critical': 'Critical',
      'Emergency': 'Critical',
      'Failure': 'Critical',
      'Warning': 'High',
      'Alert': 'High',
      'Info': 'Medium'
    };
    return severityMap[type] || 'Medium';
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(causes, failureData) {
    const recommendations = [];
    
    // Immediate actions
    if (causes.some(c => c.severity === 'Critical')) {
      recommendations.push('🚨 IMMEDIATE: Isolate equipment and perform emergency shutdown');
    }
    
    // High priority actions
    const highCauses = causes.filter(c => c.severity === 'High' || c.probability > 70);
    for (const cause of highCauses) {
      recommendations.push(`🔧 High priority: Address ${cause.name} - ${cause.evidence}`);
    }
    
    // Preventive actions
    recommendations.push('📋 Schedule comprehensive inspection within 48 hours');
    recommendations.push('📊 Review maintenance history for similar patterns');
    recommendations.push('🔬 Monitor related sensors for additional indicators');
    
    return recommendations;
  }

  /**
   * Estimate cost of failure
   */
  estimateCost(causes) {
    let baseCost = 5000;
    const hasCritical = causes.some(c => c.severity === 'Critical');
    const highCount = causes.filter(c => c.severity === 'High').length;
    
    if (hasCritical) baseCost += 10000;
    if (highCount > 2) baseCost += highCount * 2000;
    
    return {
      low: Math.round(baseCost * 0.8),
      high: Math.round(baseCost * 1.5),
      currency: 'USD',
      recommendation: 'Detailed cost assessment recommended'
    };
  }

  /**
   * Estimate downtime
   */
  estimateDowntime(causes) {
    let baseHours = 4;
    const hasCritical = causes.some(c => c.severity === 'Critical');
    const highCount = causes.filter(c => c.severity === 'High').length;
    
    if (hasCritical) baseHours += 12;
    if (highCount > 1) baseHours += highCount * 2;
    
    return {
      hours: baseHours,
      days: Math.round(baseHours / 8),
      recommendation: baseHours > 12 ? 'Plan for extended downtime' : 'Standard maintenance window'
    };
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(causes) {
    const avgProbability = causes.reduce((sum, c) => sum + c.probability, 0) / causes.length;
    const hasHighConfidence = causes.some(c => c.probability > 80);
    const hasCritical = causes.some(c => c.severity === 'Critical');
    
    let confidence = avgProbability;
    if (hasHighConfidence) confidence += 5;
    if (hasCritical) confidence += 5;
    
    return Math.min(95, Math.round(confidence));
  }

  /**
   * Find similar cases from history
   */
  async findSimilarCases(assetId, failureData) {
    const history = this.historicalData
      .filter(d => d.asset_id === assetId)
      .slice(0, 10);
    
    const similar = [];
    for (const record of history) {
      const similarity = this.calculateSimilarity(
        { temperature: failureData.temperature, vibration: failureData.vibration },
        { temperature: record.temperature, vibration: record.vibration }
      );
      
      if (similarity > 0.5) {
        similar.push({
          ...record,
          similarity: similarity
        });
      }
    }
    
    return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }
}

module.exports = new RCAEngine();