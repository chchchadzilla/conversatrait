class ContentClassifier {
  // Content categories with descriptors
  static CATEGORIES = {
    PERSONAL: {
      label: 'Personal Experience',
      descriptors: [
        'I feel', 'I think', 'my experience',
        'happened to me', 'in my life',
        'personally', 'my situation'
      ],
      contextMarkers: [
        'my', 'me', 'mine', 'myself',
        'I am', "I'm", 'I was', "I've"
      ]
    },
    RELATIONSHIP: {
      label: 'Relationship Discussion',
      descriptors: [
        'dating', 'marriage', 'partner',
        'boyfriend', 'girlfriend', 'spouse',
        'relationship', 'breakup', 'divorce'
      ],
      contextMarkers: [
        'love', 'trust', 'commitment',
        'together', 'apart', 'dating'
      ]
    },
    ETHICAL: {
      label: 'Ethical Dilemma',
      descriptors: [
        'right thing', 'wrong thing', 'moral',
        'ethics', 'dilemma', 'should I',
        'conscience', 'guilt', 'regret'
      ],
      contextMarkers: [
        'right', 'wrong', 'fair',
        'unfair', 'justice', 'ethical'
      ]
    },
    PROFESSIONAL: {
      label: 'Professional Situation',
      descriptors: [
        'at work', 'job', 'career',
        'workplace', 'boss', 'coworker',
        'office', 'professional'
      ],
      contextMarkers: [
        'work', 'business', 'company',
        'employee', 'manager', 'team'
      ]
    },
    MENTAL_HEALTH: {
      label: 'Mental Health',
      descriptors: [
        'anxiety', 'depression', 'stress',
        'therapy', 'mental health', 'counseling',
        'psychiatrist', 'psychologist'
      ],
      contextMarkers: [
        'feel', 'cope', 'struggle',
        'overwhelmed', 'worried', 'scared'
      ]
    },
    CONFLICT: {
      label: 'Conflict Resolution',
      descriptors: [
        'argument', 'fight', 'disagreement',
        'conflict', 'dispute', 'tension',
        'resolution', 'compromise'
      ],
      contextMarkers: [
        'angry', 'upset', 'frustrated',
        'resolve', 'solve', 'deal with'
      ]
    }
  };

  // Topic indicators for deeper classification
  static TOPIC_INDICATORS = {
    SUPPORT_SEEKING: {
      keywords: [
        'help', 'advice', 'guidance',
        'what should', 'need help',
        'please help', 'suggestions'
      ],
      weight: 1.5
    },
    VENTING: {
      keywords: [
        'rant', 'frustrated', 'annoyed',
        'tired of', 'sick of', 'had enough',
        'cant take'
      ],
      weight: 1.2
    },
    DECISION_MAKING: {
      keywords: [
        'decide', 'choice', 'option',
        'should I', 'what if', 'wondering',
        'considering'
      ],
      weight: 1.3
    },
    REFLECTION: {
      keywords: [
        'thinking about', 'realized',
        'understand', 'perspective',
        'looking back', 'reflection'
      ],
      weight: 1.1
    }
  };

  // Writing style features
  static STYLE_FEATURES = {
    FORMAL: {
      patterns: [
        /therefore/i, /however/i, /furthermore/i,
        /nevertheless/i, /regarding/i, /consequently/i
      ],
      weight: 0.8
    },
    CASUAL: {
      patterns: [
        /lol/i, /tbh/i, /idk/i,
        /imo/i, /fyi/i, /btw/i
      ],
      weight: 1.2
    },
    EMOTIONAL: {
      patterns: [
        /!!+/g, /\?!+/g, /\?{2,}/g,
        /(\b(very|really|so|totally)\b.*){2,}/gi
      ],
      weight: 1.4
    },
    ANALYTICAL: {
      patterns: [
        /first.*second.*third/i,
        /\b(analyze|conclude|evidence|reason)\b/gi,
        /\b(compare|contrast|examine)\b/gi
      ],
      weight: 0.9
    }
  };

  constructor(categoryManager) {
    this.rules = [];
    this._categoryManager = categoryManager;
this.cache = new Map();
    this.initializeDefaultRules();
  }

  // Main classification method
  async classifyContent(text, options = {}) {
    const cacheKey = this.getCacheKey(text, options);
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Prepare text
    const normalizedText = this.normalizeText(text);
    const sentences = this.splitSentences(normalizedText);
    const words = this.tokenize(normalizedText);

    // Perform classification
    const [
      categories,
      topics,
      style,
      metrics
    ] = await Promise.all([
      this.detectCategories(normalizedText),
      this.analyzeTopics(normalizedText),
      this.analyzeStyle(normalizedText),
      this.calculateMetrics(words, sentences)
    ]);

    // Calculate confidence scores
    const confidenceScores = this.calculateConfidence(
      categories,
      topics,
      style,
      metrics
    );

    // Determine primary and secondary categories
    const sortedCategories = Object.entries(categories)
      .sort((a, b) => b[1].score - a[1].score);

    const results = {
      primary: {
        category: sortedCategories[0][0],
        confidence: confidenceScores[sortedCategories[0][0]]
      },
      secondary: sortedCategories.slice(1, 3).map(([category, data]) => ({
        category,
        confidence: confidenceScores[category]
      })),
      topics,
      style,
      metrics,
      timestamp: Date.now()
    };

    // Cache results
    this.cache.set(cacheKey, results);
    return results;
  }

  // Text preprocessing
  normalizeText(text) {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  splitSentences(text) {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  tokenize(text) {
    return text
      .split(/\W+/)
      .filter(Boolean);
  }

  // Category detection
  async detectCategories(text) {
    const categories = {};

    for (const [name, config] of Object.entries(ContentClassifier.CATEGORIES)) {
      // Check descriptors
      const descriptorMatches = config.descriptors.filter(descriptor =>
        text.includes(descriptor.toLowerCase())
      );

      // Check context markers
      const contextMatches = config.contextMarkers.filter(marker =>
        text.includes(marker.toLowerCase())
      );

      // Calculate category score
      const score = (
        (descriptorMatches.length / config.descriptors.length) * 0.6 +
        (contextMatches.length / config.contextMarkers.length) * 0.4
      );

      categories[name] = {
        score,
        matches: {
          descriptors: descriptorMatches,
          context: contextMatches
        }
      };
    }

    return categories;
  }

  // Topic analysis
  async analyzeTopics(text) {
    const topics = {};

    for (const [name, config] of Object.entries(ContentClassifier.TOPIC_INDICATORS)) {
      const matches = config.keywords.filter(keyword =>
        text.includes(keyword.toLowerCase())
      );

      topics[name] = {
        score: (matches.length / config.keywords.length) * config.weight,
        matches
      };
    }

    return topics;
  }

  // Style analysis
  async analyzeStyle(text) {
    const style = {};

    for (const [name, config] of Object.entries(ContentClassifier.STYLE_FEATURES)) {
      const matches = config.patterns.map(pattern => {
        if (pattern instanceof RegExp) {
          return (text.match(pattern) || []).length;
        }
        return 0;
      });

      const score = matches.reduce((sum, count) => sum + count, 0) * config.weight;
      style[name] = {
        score: Math.min(score / 10, 1), // Normalize to 0-1
        matches: matches.reduce((sum, count) => sum + count, 0)
      };
    }

    return style;
  }

  // Metrics calculation
  async calculateMetrics(words, sentences) {
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length,
      averageSentenceLength: words.length / sentences.length
    };
  }

  // Confidence calculation
  calculateConfidence(categories, topics, style, metrics) {
    const confidence = {};

    for (const [category, data] of Object.entries(categories)) {
      // Base confidence from category score
      let score = data.score;

      // Adjust based on topics
      const relevantTopics = this.getRelevantTopics(category);
      relevantTopics.forEach(topic => {
        if (topics[topic]) {
          score *= (1 + topics[topic].score * 0.2);
        }
      });

      // Adjust based on style
      const relevantStyles = this.getRelevantStyles(category);
      relevantStyles.forEach(styleName => {
        if (style[styleName]) {
          score *= (1 + style[styleName].score * 0.1);
        }
      });

      // Normalize to 0-1
      confidence[category] = Math.min(score, 1);
    }

    return confidence;
  }

  // Helper methods for confidence calculation
  getRelevantTopics(category) {
    const topicMap = {
      PERSONAL: ['SUPPORT_SEEKING', 'VENTING', 'REFLECTION'],
      RELATIONSHIP: ['DECISION_MAKING', 'VENTING', 'REFLECTION'],
      ETHICAL: ['DECISION_MAKING', 'REFLECTION'],
      PROFESSIONAL: ['DECISION_MAKING', 'SUPPORT_SEEKING'],
      MENTAL_HEALTH: ['SUPPORT_SEEKING', 'VENTING', 'REFLECTION'],
      CONFLICT: ['SUPPORT_SEEKING', 'VENTING', 'DECISION_MAKING']
    };
    return topicMap[category] || [];
  }

  getRelevantStyles(category) {
    const styleMap = {
      PERSONAL: ['CASUAL', 'EMOTIONAL'],
      RELATIONSHIP: ['EMOTIONAL', 'CASUAL'],
      ETHICAL: ['FORMAL', 'ANALYTICAL'],
      PROFESSIONAL: ['FORMAL', 'ANALYTICAL'],
      MENTAL_HEALTH: ['EMOTIONAL', 'REFLECTION'],
      CONFLICT: ['EMOTIONAL', 'CASUAL']
    };
    return styleMap[category] || [];
  }

  // Cache management
  getCacheKey(text, options) {
    return `${text.slice(0, 100)}_${JSON.stringify(options)}`;
  }

  clearCache() {
    this.cache.clear();
  }

  initializeDefaultRules() {
    this.rules = [];

    // Resource must have a title
    this.rules.push({
      name: 'title',
      validate: (resource) => {
        return resource.title && resource.title.length > 0;
      },
      message: 'Resource must have a title.'
    });

    // Resource must have content
    this.rules.push({
      name: 'content',
      validate: (resource) => {
        return resource.content && resource.content.length > 0;
      },
      message: 'Resource must have content.'
    });

    // Resource must have a category
    this.rules.push({
      name: 'categoryFormat',
      validate: (resource) => {
        if (!resource.category) {
          return false;
        }

        if (Array.isArray(resource.category)) {
          return resource.category.length > 0;
        } else {
          return typeof resource.category === 'string' && resource.category.length > 0;
        }
      },
      message: 'Resource must have at least one category.'
    });
  }
}

try {
  window.ContentClassifier = ContentClassifier;
  window.componentLoadMonitor?.log('ContentClassifier');
} catch (error) {
  console.error('Failed to register ContentClassifier:', error);
  window.componentLoadMonitor?.log('ContentClassifier', false);
}