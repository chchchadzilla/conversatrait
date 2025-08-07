class InterventionManager {
  // Risk level definitions
  static RISK_LEVELS = {
    NONE: {
      level: 0,
      label: 'No Risk',
      description: 'No concerning content detected',
      requiresAction: false
    },
    LOW: {
      level: 1,
      label: 'Low Risk',
      description: 'Minor concerns detected',
      requiresAction: false
    },
    MEDIUM: {
      level: 2,
      label: 'Medium Risk',
      description: 'Moderate concerns requiring attention',
      requiresAction: false
    },
    HIGH: {
      level: 3,
      label: 'High Risk',
      description: 'Serious concerns requiring immediate attention',
      requiresAction: true
    },
    CRISIS: {
      level: 4,
      label: 'Crisis',
      description: 'Immediate intervention recommended',
      requiresAction: true
    }
  };

  // Mental health resources
  static RESOURCES = {
    CRISIS: {
      name: 'Crisis Support',
      services: [
        {
          name: '988 Suicide & Crisis Lifeline',
          phone: '988',
          url: 'https://988lifeline.org/',
          available: '24/7'
        },
        {
          name: 'Crisis Text Line',
          text: 'HOME to 741741',
          url: 'https://www.crisistextline.org/',
          available: '24/7'
        },
        {
          name: 'RAINN Sexual Assault Hotline',
          phone: '1-800-656-HOPE',
          url: 'https://www.rainn.org/',
          available: '24/7'
        }
      ]
    },
    PROFESSIONAL: {
      name: 'Professional Help',
      services: [
        {
          name: 'SAMHSA Treatment Locator',
          url: 'https://findtreatment.samhsa.gov/',
          description: 'Find mental health treatment services'
        },
        {
          name: 'Psychology Today Therapist Finder',
          url: 'https://www.psychologytoday.com/us/therapists',
          description: 'Search for therapists in your area'
        }
      ]
    },
    SELF_HELP: {
      name: 'Self-Help Resources',
      services: [
        {
          name: 'Mindfulness Exercises',
          url: 'https://www.mindful.org/meditation/mindfulness-getting-started/',
          type: 'meditation'
        },
        {
          name: 'Mental Health Apps',
          url: 'https://www.psycom.net/25-best-mental-health-apps',
          type: 'apps'
        }
      ]
    }
  };

  constructor() {
    this.interventionHistory = new Map();
    this.activeSessions = new Set();
    this.lastAssessment = null;
    this.debugMode = true; // Enable detailed debugging
  }

  // Main assessment method
  async assessContent(content, context = {}) {
    const startTime = Date.now();
    
    if (this.debugMode) {
      console.log('🛡️ [INTERVENTION DEBUG] === STARTING CONTENT ASSESSMENT ===');
      console.log('🛡️ [INTERVENTION DEBUG] Content preview:', content.slice(0, 200) + (content.length > 200 ? '...' : ''));
      console.log('🛡️ [INTERVENTION DEBUG] Context:', context);
    }

    try {
      const sessionId = context.sessionId || this.generateSessionId();
      
      // Create assessment record
      const assessment = {
        timestamp: Date.now(),
        content: content,
        context: context,
        riskLevel: 'NONE',
        triggers: [],
        concerns: [],
        requiresIntervention: false,
        recommendedResources: [],
        sessionId: sessionId,
        debugInfo: {
          processingTime: 0,
          crisisCheckResults: null,
          analysisResults: null,
          finalDecision: null
        }
      };

      // Check for immediate crisis triggers
      if (this.debugMode) {
        console.log('🔍 [INTERVENTION DEBUG] Step 1: Checking crisis indicators...');
      }
      
      const crisisCheck = this.checkCrisisIndicators(content);
      assessment.debugInfo.crisisCheckResults = crisisCheck.debugInfo || [];
      
      if (crisisCheck.detected) {
        assessment.riskLevel = 'CRISIS';
        assessment.triggers.push(...crisisCheck.triggers);
        assessment.requiresIntervention = true;
        
        if (this.debugMode) {
          console.warn('🚨 [INTERVENTION DEBUG] CRISIS DETECTED - Skipping further analysis');
        }
      }

      // Perform comprehensive analysis if not in crisis
      if (assessment.riskLevel !== 'CRISIS') {
        if (this.debugMode) {
          console.log('🔍 [INTERVENTION DEBUG] Step 2: Performing comprehensive analysis...');
        }
        
        const analysis = await this.analyzeContent(content);
        assessment.debugInfo.analysisResults = analysis;
        
        assessment.riskLevel = this.determineRiskLevel(analysis);
        assessment.triggers.push(...analysis.triggers);
        assessment.concerns.push(...analysis.concerns);
        assessment.requiresIntervention =
          InterventionManager.RISK_LEVELS[assessment.riskLevel].requiresAction;
      }

      // Get recommended resources
      assessment.recommendedResources = this.getRecommendedResources(
        assessment.riskLevel,
        assessment.concerns
      );

      // Final processing
      assessment.debugInfo.processingTime = Date.now() - startTime;
      assessment.debugInfo.finalDecision = {
        riskLevel: assessment.riskLevel,
        requiresIntervention: assessment.requiresIntervention,
        triggerCount: assessment.triggers.length,
        concernCount: assessment.concerns.length
      };

      // Update session state
      this.updateSessionState(sessionId, assessment);
      this.lastAssessment = assessment;

      // Enhanced final logging
      if (this.debugMode) {
        console.log('🛡️ [INTERVENTION DEBUG] === ASSESSMENT COMPLETE ===');
        console.log('🛡️ [INTERVENTION DEBUG] Final Results:', {
          riskLevel: assessment.riskLevel,
          requiresIntervention: assessment.requiresIntervention,
          processingTime: assessment.debugInfo.processingTime + 'ms',
          triggers: assessment.triggers.map(t => t.type),
          concerns: assessment.concerns.map(c => c.type)
        });
        
        if (assessment.requiresIntervention) {
          console.warn('🚨 [INTERVENTION DEBUG] *** INTERVENTION WILL BE TRIGGERED ***');
          console.warn('🚨 [INTERVENTION DEBUG] Reason:', assessment.triggers.map(t => `${t.type} (confidence: ${t.confidence || 'high'})`).join(', '));
        } else {
          console.log('✅ [INTERVENTION DEBUG] *** NO INTERVENTION REQUIRED ***');
        }
        console.log('🛡️ [INTERVENTION DEBUG] ================================');
      }

      return assessment;
    } catch (error) {
      console.error('🚨 [INTERVENTION ERROR] Assessment failed:', error);
      if (this.debugMode) {
        console.error('🚨 [INTERVENTION ERROR] Stack trace:', error.stack);
      }
      throw new Error('Content assessment failed');
    }
  }

  // Method to control debug mode
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`🛡️ [INTERVENTION] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  // Method to get debug information from last assessment
  getLastAssessmentDebugInfo() {
    if (!this.lastAssessment || !this.lastAssessment.debugInfo) {
      return { error: 'No debug information available' };
    }
    
    return {
      timestamp: this.lastAssessment.timestamp,
      contentPreview: this.lastAssessment.content.slice(0, 100) + '...',
      processingTime: this.lastAssessment.debugInfo.processingTime,
      crisisCheckResults: this.lastAssessment.debugInfo.crisisCheckResults,
      analysisResults: this.lastAssessment.debugInfo.analysisResults,
      finalDecision: this.lastAssessment.debugInfo.finalDecision,
      fullTriggers: this.lastAssessment.triggers,
      fullConcerns: this.lastAssessment.concerns
    };
  }

  // Crisis check - FOCUSED ON GENUINE HARM INTENT WITH CONTEXT AWARENESS
  checkCrisisIndicators(content) {
    if (this.debugMode) {
      console.log('🔍 [INTERVENTION DEBUG] Starting crisis indicators check for content:', content.slice(0, 100) + '...');
    }

    // Context exclusion patterns - these indicate legitimate discussion, not crisis
    const contextExclusions = {
      medicalDiscussion: [
        /\b(doctor|doctors|medical|medicine|treatment|therapy|hospital|clinic)\b/i,
        /\b(medication|pills|prescription|dosage|side effects|reactions)\b/i,
        /\b(surgery|operation|procedure|recovery|healing)\b/i,
        /\b(cancer|heart failure|disease|illness|condition|diagnosis)\b/i
      ],
      thirdPersonDiscussion: [
        /\b(my (friend|dad|mom|father|mother|brother|sister|family)|he|she|they|them|his|her|their)\b.{0,50}\b(died|passed|lost|battle|fighting)\b/i,
        /\b(friend|relative|family member|loved one)\b.{0,50}\b(cancer|illness|disease)\b/i,
        /\btalking about (my|our|someone|a friend)\b/i
      ],
      pastEvents: [
        /\b(last year|months ago|years ago|previously|in the past|used to)\b/i,
        /\b(car accident|accident|crash)\b.{0,50}\b(happened|occurred|was in)\b/i,
        /\bhad (surgery|an accident|been through)\b/i
      ],
      educationalContext: [
        /\b(discussing|talking about|conversation about|sharing|information about)\b/i,
        /\b(awareness|education|helping others|support|resources)\b/i
      ]
    };

    // More specific crisis patterns that require ACTIVE, FIRST-PERSON, PRESENT-TENSE harm intent
    const crisisPatterns = {
      trolling: [
        /\b(just trolling|not serious|kidding|joking)\b/i,
        /\b(you mad|triggered|lolol|baited)\b/i,
        /\b(spam|nonsense|irrelevant|off-topic)\b/i
      ],
      activeSuicideIntent: [
        /\bI (want to|am going to|plan to|will) (kill myself|end my life|commit suicide)\b/i,
        /\bI (can't|cannot) (go on|live|take it) anymore\b/i,
        /\bI (have a plan|am planning) to (kill myself|end it|suicide)\b/i,
        /\bI (don't want to|want to stop) (living|being alive)\b/i
      ],
      activeSelfHarmIntent: [
        /\bI (want to|am going to|plan to) (cut|hurt|harm) myself\b/i,
        /\bI (have|am getting|bought) (razor|blade|knife) to (cut|hurt) myself\b/i,
        /\bI am (cutting|hurting|harming) myself\b/i
      ],
      activeOverdoseIntent: [
        /\bI (want to|am going to|plan to) (overdose|take all|swallow all)\b/i,
        /\bI (have|collected|am taking) (pills|medication) to (overdose|kill myself|die)\b/i
      ],
      directViolentThreats: [
        /\bI (will|am going to|plan to) (kill|murder|shoot|stab|hurt) (you|him|her|them)\b/i,
        /\bI (have|got|am getting) (gun|weapon|knife) to (kill|hurt|attack)\b/i,
        /\bI am (planning|preparing) (attack|violence|shooting)\b/i
      ],
      illegalContent: [
        /\b(child|kid|minor|underage|teen)\b.{0,50}\b(sex|porn|nude|naked)\b/i,
        /\b(traffic|traffick|selling|sold)\b.{0,30}\b(girls|women|kids|children)\b/i,
        /\b(forced|against.{0,10}will|kidnap)\b.{0,30}\b(sex|rape)\b/i
      ]
    };

    const detected = {
      detected: false,
      triggers: [],
      debugInfo: []
    };

    // First check for context exclusions
    let hasExcludingContext = false;
    for (const [contextType, patterns] of Object.entries(contextExclusions)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          hasExcludingContext = true;
          detected.debugInfo.push({
            type: 'context_exclusion',
            category: contextType,
            pattern: pattern.toString(),
            match: content.match(pattern)[0],
            reason: 'Content appears to be legitimate discussion, not crisis'
          });
          
          if (this.debugMode) {
            console.log(`🟢 [INTERVENTION DEBUG] Found excluding context (${contextType}):`, content.match(pattern)[0]);
          }
        }
      }
    }

    // If we found excluding context, be much more selective about what we flag
    const severityThreshold = hasExcludingContext ? 0.9 : 0.7;
    
    if (this.debugMode) {
      console.log(`🔍 [INTERVENTION DEBUG] Has excluding context: ${hasExcludingContext}, Severity threshold: ${severityThreshold}`);
    }

    // Check each crisis pattern category
    for (const [category, patterns] of Object.entries(crisisPatterns)) {
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          const severity = this.getSeverityForCategory(category);
          const shouldTrigger = !hasExcludingContext || severity >= severityThreshold;
          
          if (this.debugMode) {
            console.log(`🔍 [INTERVENTION DEBUG] Pattern match (${category}):`, match[0], `Severity: ${severity}, Should trigger: ${shouldTrigger}`);
          }

          detected.debugInfo.push({
            type: 'pattern_match',
            category: category,
            pattern: pattern.toString(),
            match: match[0],
            severity: severity,
            triggered: shouldTrigger,
            reason: shouldTrigger ? 'Crisis pattern detected' : 'Suppressed due to context'
          });

          if (shouldTrigger) {
            detected.detected = true;
            detected.triggers.push({
              type: category,
              pattern: pattern.toString(),
              match: match[0],
              severity: severity,
              confidence: hasExcludingContext ? 'low' : 'high'
            });
          }
        }
      }
    }

    // Enhanced logging
    if (this.debugMode) {
      console.log('🛡️ [INTERVENTION DEBUG] Crisis check results:', {
        detected: detected.detected,
        triggerCount: detected.triggers.length,
        hasExcludingContext: hasExcludingContext,
        debugInfo: detected.debugInfo
      });
      
      if (detected.detected) {
        console.warn('🚨 [INTERVENTION DEBUG] INTERVENTION TRIGGERED:', detected.triggers.map(t => t.type).join(', '));
      } else {
        console.log('✅ [INTERVENTION DEBUG] No intervention required');
      }
    }

    // Add custom message for trolling
    if (detected.triggers.some(trigger => trigger.type === 'trolling')) {
      detected.triggers.push({
        type: 'customMessage',
        message: "If you're trolling, you'll keep seeing this."
      });
    }

    return detected;
  }

  getSeverityForCategory(category) {
    const severityMap = {
      trolling: 0.7,
      suicide: 1.0,
      selfHarm: 0.9,
      overdoseIntent: 1.0,
      violentThreats: 1.0,
      illegalContent: 1.0
    };
    return severityMap[category] || 0.5;
  }

  // Content analysis - MENTAL HEALTH FOCUSED, NOT JUDGEMENTAL
  async analyzeContent(content) {
    const concernPatterns = {
      depression: [
        /\b(depressed|hopeless|worthless|useless)\b/i,
        /\b(no(thing)?\s+matters|pointless)\b/i,
        /\b(cant|can't|cannot)\b.{0,20}\b(cope|handle|go on)\b/i,
        /\b(hate.{0,10}myself|hate.{0,10}life)\b/i
      ],
      anxiety: [
        /\b(panic attack|anxiety attack)\b/i,
        /\b(constant(ly)?|always)\b.{0,20}\b(worry|anxious|fear|terrified)\b/i,
        /\b(cant.{0,10}breathe|hyperventilat)\b/i
      ],
      isolation: [
        /\b(completely alone|nobody cares|no one understands)\b/i,
        /\b(no|don't\s+have).{0,20}\b(friends|family|support|anyone)\b/i,
        /\b(isolated|cut off|abandoned)\b/i
      ]
    };

    const analysis = {
      triggers: [],
      concerns: [],
      severity: 0
    };

    // Check each concern pattern
    for (const [concern, patterns] of Object.entries(concernPatterns)) {
      const matches = patterns.filter(pattern => pattern.test(content));
      if (matches.length > 0) {
        analysis.concerns.push({
          type: concern,
          matches: matches.map(pattern => content.match(pattern)[0]),
          severity: matches.length / patterns.length
        });
      }
    }

    // Calculate overall severity
    if (analysis.concerns.length > 0) {
      analysis.severity = analysis.concerns.reduce(
        (sum, concern) => sum + concern.severity, 0
      ) / analysis.concerns.length;
    }

    return analysis;
  }

  // Risk level determination
  determineRiskLevel(analysis) {
    if (analysis.severity >= 0.8) return 'HIGH';
    if (analysis.severity >= 0.6) return 'MEDIUM';
    if (analysis.severity >= 0.3) return 'LOW';
    return 'NONE';
  }

  // Resource recommendations
  getRecommendedResources(riskLevel, concerns) {
    const recommendations = new Set();

    // Always include self-help resources
    InterventionManager.RESOURCES.SELF_HELP.services.forEach(service => 
      recommendations.add(service)
    );

    // Add crisis resources for high risk
    if (riskLevel === 'HIGH' || riskLevel === 'CRISIS') {
      InterventionManager.RESOURCES.CRISIS.services.forEach(service =>
        recommendations.add(service)
      );
    }

    // Add professional resources based on concerns
    if (concerns.length > 0) {
      InterventionManager.RESOURCES.PROFESSIONAL.services.forEach(service =>
        recommendations.add(service)
      );
    }

    return Array.from(recommendations);
  }

  // Session management
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateSessionState(sessionId, assessment) {
    this.activeSessions.add(sessionId);
    
    if (!this.interventionHistory.has(sessionId)) {
      this.interventionHistory.set(sessionId, []);
    }
    
    this.interventionHistory.get(sessionId).push({
      timestamp: Date.now(),
      assessment: assessment
    });
  }

  getSessionHistory(sessionId) {
    return this.interventionHistory.get(sessionId) || [];
  }

  clearSession(sessionId) {
    this.activeSessions.delete(sessionId);
    this.interventionHistory.delete(sessionId);
  }
}

try {
  window.InterventionManager = InterventionManager;
  window.componentLoadMonitor?.log('InterventionManager');
} catch (error) {
  console.error('Failed to register InterventionManager:', error);
  window.componentLoadMonitor?.log('InterventionManager', false);
}

// Debug utility functions - accessible via browser console
window.InterventionDebug = {
  // Enable/disable debug mode
  enableDebug: () => {
    if (window.interventionManager) {
      window.interventionManager.setDebugMode(true);
      console.log('🛡️ [INTERVENTION DEBUG] Debug mode ENABLED - you will now see detailed intervention analysis');
    } else {
      console.error('🚨 InterventionManager not available');
    }
  },

  disableDebug: () => {
    if (window.interventionManager) {
      window.interventionManager.setDebugMode(false);
      console.log('🛡️ [INTERVENTION DEBUG] Debug mode DISABLED');
    } else {
      console.error('🚨 InterventionManager not available');
    }
  },

  // Get debug info from last assessment
  getLastDebugInfo: () => {
    if (window.interventionManager) {
      const debugInfo = window.interventionManager.getLastAssessmentDebugInfo();
      console.log('🛡️ [INTERVENTION DEBUG] Last Assessment Debug Info:', debugInfo);
      return debugInfo;
    } else {
      console.error('🚨 InterventionManager not available');
      return null;
    }
  },

  // Test a specific message
  testMessage: async (message) => {
    if (window.interventionManager) {
      console.log('🛡️ [INTERVENTION DEBUG] Testing message:', message.slice(0, 100) + '...');
      try {
        const result = await window.interventionManager.assessContent(message, { test: true });
        console.log('🛡️ [INTERVENTION DEBUG] Test Results:', {
          requiresIntervention: result.requiresIntervention,
          riskLevel: result.riskLevel,
          triggers: result.triggers.map(t => t.type),
          processingTime: result.debugInfo?.processingTime
        });
        return result;
      } catch (error) {
        console.error('🚨 [INTERVENTION ERROR] Test failed:', error);
        return null;
      }
    } else {
      console.error('🚨 InterventionManager not available');
      return null;
    }
  },

  // Show help
  help: () => {
    console.log(`
🛡️ [INTERVENTION DEBUG] Available Commands:

InterventionDebug.enableDebug()    - Enable detailed debug logging
InterventionDebug.disableDebug()   - Disable debug logging  
InterventionDebug.getLastDebugInfo() - Show debug info from last assessment
InterventionDebug.testMessage("your message here") - Test a specific message
InterventionDebug.help()           - Show this help

Example Usage:
  InterventionDebug.enableDebug()
  InterventionDebug.testMessage("I lost my friend to cancer and my dad is dying")
  InterventionDebug.getLastDebugInfo()
    `);
  }
};

// Auto-expose help on load
console.log('🛡️ [INTERVENTION DEBUG] Debug utilities loaded. Type InterventionDebug.help() for commands.');