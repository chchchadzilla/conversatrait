/**
 * @class APIService
 * @description Complete frontend-backend integration service with real API calls and WebSocket support
 * REMOVES ALL MOCK DATA - IMPLEMENTS REAL BACKEND INTEGRATION ONLY
 */
class APIService {
  constructor(options = {}) {
    // DEBUGGING: Track constructor timing to validate race condition theory
    this.constructorTimestamp = Date.now();
    this.socketIoAvailableAtConstruction = typeof io !== 'undefined';
    
    console.log('🔧 APIService constructor called:', {
      timestamp: this.constructorTimestamp,
      socketIoAvailable: this.socketIoAvailableAtConstruction,
      ioType: typeof io,
      ioObject: this.socketIoAvailableAtConstruction ? 'available' : 'undefined'
    });
    
    // FIXED: Always use port 5000 where the analysis is working
    this.baseUrl = options.baseUrl || 'http://localhost:5000';
    this.apiKey = this.sanitizeApiKey(options.apiKey || '');
    this.provider = options.provider || 'openrouter';
    this.debug = options.debug || true;
    
    console.log('🔧 APIService initialized with config:', {
      baseUrl: this.baseUrl,
      provider: this.provider,
      hasApiKey: Boolean(this.apiKey),
      socketIoAvailable: this.socketIoAvailableAtConstruction
    });

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.timeout = 30000;

    // WebSocket connection for real-time updates
    this.socket = null;
    this.webSocket = null; // FIXED: Expose as webSocket for app container
    this.progressCallbacks = new Map();
    this.analysisCallbacks = new Map();
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 10;
    this.initializationDelay = 100;
    this.isWebSocketInitialized = false;
    
    // Initialize connection
    this.initializeConnection();
    
    // CRITICAL FIX: Defer WebSocket initialization until Socket.IO is confirmed available
    this.deferredInitializeWebSocket();
  }

  /**
   * Sanitize API key by removing whitespace and validating
   * @private
   */
  sanitizeApiKey(apiKey) {
    return apiKey ? apiKey.trim() : '';
  }

  /**
   * CRITICAL FIX: Deferred WebSocket initialization with Socket.IO availability verification
   * This replaces the immediate initializeWebSocket() call to prevent race conditions
   * @private
   */
  deferredInitializeWebSocket() {
    console.log('🔄 Starting deferred APIService WebSocket initialization...');
    
    // If Socket.IO is already available, initialize immediately
    if (typeof io !== 'undefined') {
      console.log('✅ Socket.IO available at APIService construction time, initializing immediately');
      this.initializeWebSocket();
      return;
    }
    
    console.log('⏳ Socket.IO not available yet for APIService, implementing polling strategy...');
    this.pollForSocketIOInAPIService();
  }

  /**
   * CRITICAL FIX: Poll for Socket.IO availability with exponential backoff for APIService
   * This validates our race condition theory with extensive logging
   * @private
   */
  pollForSocketIOInAPIService() {
    const checkSocketIO = () => {
      this.initializationAttempts++;
      const socketIoNowAvailable = typeof io !== 'undefined';
      
      console.log(`🔍 APIService Socket.IO availability check #${this.initializationAttempts}:`, {
        attempt: this.initializationAttempts,
        maxAttempts: this.maxInitializationAttempts,
        socketIoAvailable: socketIoNowAvailable,
        ioType: typeof io,
        delay: this.initializationDelay,
        timeSinceConstruction: Date.now() - this.constructorTimestamp
      });
      
      if (socketIoNowAvailable) {
        console.log('✅ Socket.IO now available for APIService! Race condition theory VALIDATED');
        console.log('📊 APIService race condition metrics:', {
          constructorSocketIO: this.socketIoAvailableAtConstruction,
          nowSocketIO: socketIoNowAvailable,
          attemptsRequired: this.initializationAttempts,
          timeToAvailability: Date.now() - this.constructorTimestamp
        });
        
        this.isWebSocketInitialized = true;
        this.initializeWebSocket();
        return;
      }
      
      if (this.initializationAttempts >= this.maxInitializationAttempts) {
        console.error('❌ Socket.IO failed to become available for APIService after maximum attempts');
        console.error('🚨 CRITICAL DIAGNOSIS for APIService:', {
          theory: 'Race condition between module loading and Socket.IO availability',
          evidence: {
            constructorSocketIO: this.socketIoAvailableAtConstruction,
            finalSocketIO: socketIoNowAvailable,
            attempts: this.initializationAttempts,
            timeElapsed: Date.now() - this.constructorTimestamp
          },
          recommendation: 'Verify Socket.IO script load order in index.html'
        });
        return;
      }
      
      // Exponential backoff to reduce polling frequency
      this.initializationDelay = Math.min(this.initializationDelay * 1.5, 2000);
      setTimeout(checkSocketIO, this.initializationDelay);
    };
    
    // Start polling
    setTimeout(checkSocketIO, this.initializationDelay);
  }

  /**
   * Initialize WebSocket connection for real-time progress tracking
   * @private
   */
  initializeWebSocket() {
    try {
      if (typeof io !== 'undefined') {
        console.log('🔌 Initializing APIService WebSocket connection to:', this.baseUrl);
        console.log('🔧 WebSocket configuration:', {
          url: this.baseUrl,
          transports: ['websocket', 'polling'],
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          forceNew: true
        });
        
        this.socket = io(this.baseUrl, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          forceNew: true
        });
        
        // FIXED: Expose the socket as webSocket for app container compatibility
        this.webSocket = this.socket;
        
        this.socket.on('connect', () => {
          console.log('✅ APIService WebSocket connected successfully to:', this.baseUrl);
          console.log('🔌 APIService Socket ID:', this.socket.id);
          console.log('📊 APIService connection metrics:', {
            totalInitializationAttempts: this.initializationAttempts,
            timeToConnection: Date.now() - this.constructorTimestamp,
            raceConditionResolved: this.initializationAttempts > 0
          });
        });

        this.socket.on('disconnect', (reason) => {
          console.log('❌ APIService WebSocket disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ APIService WebSocket connection error:', error);
          console.error('🔧 APIService error details:', {
            message: error.message,
            type: error.type,
            description: error.description,
            context: error.context,
            transport: error.transport
          });
        });

        this.socket.on('analysis_progress', (data) => {
          console.log('📊 APIService received analysis progress:', data);
          const callback = this.progressCallbacks.get(data.session_id);
          if (callback) {
            callback(data);
          }
        });

        this.socket.on('analysis_complete', (data) => {
          console.log('✅ APIService received analysis complete:', data);
          const callback = this.analysisCallbacks.get(data.session_id);
          if (callback) {
            callback(null, data.results || data);
            this.progressCallbacks.delete(data.session_id);
            this.analysisCallbacks.delete(data.session_id);
          }
        });

        this.socket.on('analysis_error', (data) => {
          console.error('❌ APIService received analysis error:', data);
          const callback = this.analysisCallbacks.get(data.session_id);
          if (callback) {
            callback(new APIError(data.error), null);
            this.progressCallbacks.delete(data.session_id);
            this.analysisCallbacks.delete(data.session_id);
          }
        });
      } else {
        console.warn('Socket.IO not available for APIService, real-time progress disabled');
      }
    } catch (error) {
      console.error('Failed to initialize APIService WebSocket:', error);
    }
  }

  /**
   * Initialize API connection and test connectivity
   */
  async initializeConnection() {
    try {
      console.log('🔄 Initializing real API connection...');
      const health = await this.healthCheck();
      console.log('✅ Real API connection established:', health);
      return true;
    } catch (error) {
      console.warn('❌ Real API connection failed:', error.message);
      return false;
    }
  }

  /**
   * Health check endpoint - REAL API CALL
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    console.log('🏥 Performing real health check at /api/health');
    return this.request('GET', '/api/health');
  }

  /**
   * Test API connectivity - REAL API CALL
   * @returns {Promise<Object>} Test response
   */
  async testConnection() {
    return this.request('GET', '/api/test');
  }

  /**
   * Analyze content using REAL backend analysis engine
   * @param {string} text - Text content to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Real analysis results from backend
   */
  async analyzeContent(options = {}) {
   if (!options.text || !options.text.trim()) {
       throw new APIError('No text provided for analysis', 400);
   }

   console.log('🚀 Starting REAL analysis with backend integration');

   const payload = {
       text: options.text.trim(),
       analysis_type: options.analysis_type || 'personality_analysis',
       model: options.model,
       conversations: options.conversations || [],
       selected_speakers: options.selected_speakers || [],
       relationship_description: options.relationship_description || null
   };

   console.log('📊 Sending real analysis request to backend:', {
       analysisType: payload.analysis_type,
       textLength: payload.text.length,
       model: payload.model
   });

   try {
       // Use real-time analysis endpoint with WebSocket progress tracking
       if (this.socket && this.isWebSocketInitialized) {
           return this.analyzeWithProgress(payload, options); // Pass full options object
       } else {
           console.log('📡 WebSocket not available, using synchronous analysis');
           // Fallback to synchronous analysis if WebSocket unavailable
           return await this.request('POST', '/api/analyze', payload);
       }
   } catch (error) {
       console.error('❌ Real analysis failed:', error);
       throw error;
   }
  }

  /**
   * Perform analysis with real-time progress tracking via WebSocket
   * @private
   */
  async analyzeWithProgress(payload, options = {}) {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting analysis with progress tracking via WebSocket');
      
      this.request('POST', '/api/analyze', payload)
        .then(response => {
          if (response.status === 'started' && response.session_id) {
            console.log('📊 Analysis session started:', response.session_id);
            
            // Set up progress and completion callbacks
            if (options.onProgress) {
              this.progressCallbacks.set(response.session_id, options.onProgress);
            }
            
            this.analysisCallbacks.set(response.session_id, (error, results) => {
              if (error) {
                reject(error);
              } else {
                resolve(results);
              }
            });

            // Join analysis session for WebSocket updates
            if (this.socket) {
              this.socket.emit('join_analysis', { session_id: response.session_id });
            }
            // Resolve with the initial response so the UI can get the session_id
            resolve(response);
          } else {
            // Immediate response without progress tracking
            resolve(response);
          }
        })
        .catch(reject);
    });
  }

  /**
   * Get analysis history - REAL API CALL
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Real analysis history from backend
   */
  async getAnalysisHistory(filters = {}) {
    const queryParams = new URLSearchParams();
    
    if (filters.limit) queryParams.append('limit', filters.limit);
    if (filters.offset) queryParams.append('offset', filters.offset);
    if (filters.startDate) queryParams.append('start_date', filters.startDate);
    if (filters.endDate) queryParams.append('end_date', filters.endDate);
    if (filters.analysisType) queryParams.append('analysis_type', filters.analysisType);

    console.log('📚 Fetching real analysis history from backend:', filters);

    const url = `/api/analysis/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.request('GET', url);
  }

  /**
   * Save analysis results - REAL API CALL
   * @param {Object} analysis - Analysis data to save
   * @returns {Promise<Object>} Save response from backend
   */
  async saveAnalysis(analysis) {
    console.log('💾 Saving analysis to real backend:', {
      id: analysis.id,
      type: analysis.type,
      timestamp: analysis.timestamp
    });
    return this.request('POST', '/api/analysis/save', analysis);
  }

  /**
   * Delete analysis by ID - REAL API CALL
   * @param {string} analysisId - Analysis ID to delete
   * @returns {Promise<Object>} Delete response from backend
   */
  async deleteAnalysis(analysisId) {
    console.log('🗑️ Deleting analysis from real backend:', analysisId);
    return this.request('DELETE', `/api/analysis/${analysisId}`);
  }

  /**
   * Export analysis data - REAL API CALL
   * @param {Array} analysisIds - Array of analysis IDs to export
   * @param {string} format - Export format (json, csv, pdf)
   * @returns {Promise<Blob>} Export data from backend
   */
  async exportAnalysis(analysisIds, format = 'json') {
    const payload = {
      analysis_ids: analysisIds,
      format
    };

    console.log('📤 Exporting analysis from real backend:', {
      count: analysisIds.length,
      format,
      ids: analysisIds
    });

    return this.request('POST', '/api/analysis/export', payload, {
      responseType: 'blob'
    });
  }

  /**
   * Get user profile - REAL API CALL
   * @returns {Promise<Object>} Real user profile data from backend
   */
  async getUserProfile() {
    console.log('👤 Fetching real user profile from backend');
    return this.request('GET', '/api/user/profile');
  }

  /**
   * Update user profile - REAL API CALL
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} Updated profile from backend
   */
  async updateUserProfile(profileData) {
    console.log('✏️ Updating user profile in real backend:', {
      fields: Object.keys(profileData)
    });
    return this.request('PUT', '/api/user/profile', profileData);
  }

  /**
   * Get user preferences - REAL API CALL
   * @returns {Promise<Object>} Real user preferences from backend
   */
  async getUserPreferences() {
    console.log('⚙️ Fetching real user preferences from backend');
    return this.request('GET', '/api/user/preferences');
  }

  /**
   * Update user preferences - REAL API CALL
   * @param {Object} preferences - Preferences to update
   * @returns {Promise<Object>} Updated preferences from backend
   */
  async updateUserPreferences(preferences) {
    console.log('⚙️ Updating user preferences in real backend:', {
      settings: Object.keys(preferences)
    });
    return this.request('PUT', '/api/user/preferences', preferences);
  }

  /**
   * Validate API key with REAL backend validation
   * @param {string} apiKey - API key to validate
   * @returns {Promise<Object>} Real validation result from backend
   */
  async validateApiKey(apiKey) {
    console.log('🔑 Validating API key with real backend...');
    
    const url = `${this.baseUrl}/api/auth/validate`;
    
    const requestConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ api_key: apiKey })
    };

    try {
      console.log(`🌐 Making real validation request to: ${url}`);
      
      const response = await fetch(url, requestConfig);
      
      const contentType = response.headers.get('content-type');
      let responseData;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        const errorMessage = responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('❌ Real validation failed:', errorMessage);
        throw new APIError(errorMessage, response.status, responseData);
      }

      console.log('✅ Real API key validation successful');
      return responseData;

    } catch (error) {
      console.error('❌ Real validation request failed:', error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw new APIError('Network request failed during real validation', 0, error);
    }
  }

  /**
   * Get conversation parsing options - REAL API CALL
   * @returns {Promise<Object>} Real parsing options from backend
   */
  async getParsingOptions() {
    console.log('🔍 Fetching real parsing options from backend');
    return this.request('GET', '/api/parsing/options');
  }

  /**
   * Parse conversation content - REAL API CALL
   * @param {string} content - Raw conversation content
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} Real parsed conversation data from backend
   */
  async parseConversation(content, options = {}) {
    const payload = {
      text: content,
      format: options.format || 'auto',
      speakers: options.speakers || [],
      parameters: options.parameters || {}
    };

    console.log('🗣️ Parsing conversation with real backend:', {
      contentLength: content.length,
      format: payload.format,
      speakerCount: payload.speakers.length
    });

    return this.request('POST', '/api/parsing/parse', payload);
   }
 
   /**
    * Parse raw text to detect speakers and structure conversation - REAL API CALL
    * @param {string} text - Raw text content
    * @returns {Promise<Object>} Real parsed conversation data from backend, including speakers
    */
   async parseText(text) {
     const payload = { text };
     console.log('🗣️ Parsing raw text with real backend:', {
       contentLength: text.length,
     });
     return this.request('POST', '/api/parse', payload);
  }

  /**
   * Get available analysis models - REAL API CALL
   * @returns {Promise<Array>} Real available models from backend
   */
  async getAvailableModels() {
    console.log('🤖 Fetching real available models from backend');
    return this.request('GET', '/api/models');
  }

  /**
   * Get model capabilities - REAL API CALL
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} Real model capabilities from backend
   */
  async getModelCapabilities(modelId) {
    console.log('🔍 Fetching real capabilities for model from backend:', modelId);
    return this.request('GET', `/api/models/${modelId}/capabilities`);
  }

  /**
   * Get system statistics - REAL API CALL
   * @returns {Promise<Object>} Real system statistics from backend
   */
  async getSystemStats() {
    console.log('📊 Fetching real system statistics from backend');
    return this.request('GET', '/api/system/stats');
  }

  /**
   * Get system configuration - REAL API CALL
   * @returns {Promise<Object>} Real system configuration from backend
   */
  async getSystemConfig() {
    console.log('⚙️ Fetching real system configuration from backend');
    return this.request('GET', '/api/system/config');
  }

  /**
   * Submit feedback - REAL API CALL
   * @param {Object} feedback - Feedback data
   * @returns {Promise<Object>} Real submission response from backend
   */
  async submitFeedback(feedback) {
    console.log('📝 Submitting feedback to real backend:', {
      type: feedback.type,
      category: feedback.category
    });
    return this.request('POST', '/api/feedback', feedback);
  }

  /**
   * Report an issue - REAL API CALL
   * @param {Object} issue - Issue data
   * @returns {Promise<Object>} Real report response from backend
   */
  async reportIssue(issue) {
    console.log('🐛 Reporting issue to real backend:', {
      type: issue.type,
      severity: issue.severity
    });
    return this.request('POST', '/api/support/issue', issue);
  }

  /**
   * Get detailed analysis report by ID - REAL API CALL
   * @param {string} analysisId - ID of the analysis to retrieve
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Real analysis report data from backend
   */
  async getAnalysisReport(analysisId, options = {}) {
    console.log('📋 Fetching real analysis report from backend:', analysisId);
    return this.request('GET', `/api/analysis/report/${analysisId}`, null, options);
  }

  /**
   * Get API configuration - REAL API CALL
   * @param {boolean} refresh - Force refresh of configuration
   * @returns {Promise<Object>} Real configuration from backend
   */
  async getApiConfig(refresh = false) {
    console.log('⚙️ Fetching real API configuration from backend', { refresh });
    
    try {
      const config = await this.request('GET', '/api/config');
      
      // Update internal state based on config
      if (config && config.api_key) {
        this.apiKey = this.sanitizeApiKey(config.api_key);
        this.provider = config.provider || this.provider;
      }
      
      // Update hasApiKey property for app container
      this.hasApiKey = Boolean(this.apiKey && this.apiKey.trim());
      
      console.log('✅ API configuration loaded:', {
        hasApiKey: this.hasApiKey,
        provider: this.provider
      });
      
      return config;
    } catch (error) {
      console.error('❌ Failed to get API configuration:', error);
      this.hasApiKey = false;
      throw error;
    }
  }

  /**
   * Update API configuration - REAL API CALL
   * @param {Object} config - Configuration to update
   * @returns {Promise<Object>} Update response from backend
   */
  async updateApiConfig(config) {
    console.log('⚙️ Updating API configuration in real backend:', {
      keys: Object.keys(config)
    });
    return this.request('POST', '/api/config', config);
  }

  /**
   * Get WebSocket connection status
   * @returns {Object} WebSocket status information
   */
  getWebSocketStatus() {
    return {
      initialized: this.isWebSocketInitialized,
      connected: this.socket?.connected || false,
      socket_id: this.socket?.id || null,
      transport: this.socket?.io?.engine?.transport?.name || null,
      initialization_attempts: this.initializationAttempts,
      server_url: this.baseUrl,
      socket_io_available: typeof io !== 'undefined',
      race_condition_detected: this.initializationAttempts > 0
    };
  }

  /**
   * Generic request method with retry logic and error handling - REAL API CALLS ONLY
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise<*>} Real response data from backend
   */
  async request(method, endpoint, data = null, options = {}) {
    const requestId = Date.now() + Math.random();
    
    console.log(`🌐 Making REAL ${method} request to ${endpoint}`, {
      requestId,
      hasData: Boolean(data),
      options: Object.keys(options)
    });

    // Add to queue if specified
    if (options.queued) {
      console.log(`📥 Adding real request ${requestId} to queue`);
      return this.queueRequest(method, endpoint, data, options);
    }

    let attempt = 0;
    const maxAttempts = options.retryAttempts || this.retryAttempts;

    while (attempt <maxAttempts) {
      try {
        const response = await this.makeRequest(method, endpoint, data, options);
        
        // Log successful request
        console.log(`✅ REAL API Request [${requestId}] successful:`, {
          method,
          endpoint,
          attempt: attempt + 1
        });

        return response;

      } catch (error) {
        attempt++;
        
        // Log failed attempt
        console.warn(`❌ REAL API Request [${requestId}] Attempt ${attempt} failed:`, error.message);

        // Check if error is retryable
        if (error instanceof APIError && !error.isRetryable()) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt>= maxAttempts) {
          throw error;
        }

        // Wait before retry using exponential backoff
        const delay = (options.retryDelay || this.retryDelay) * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying real request ${requestId} in ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Make the actual HTTP request to real backend
   * @private
   */
  async makeRequest(method, endpoint, data, options) {
    const url = `${this.baseUrl}${endpoint}`;

    console.log(`🌐 Making REAL request to ${url}`, {
      method,
      hasData: Boolean(data),
      hasHeaders: Boolean(options.headers)
    });

    const requestConfig = {
      method,
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      },
      credentials: 'include'
    };

    // Add timeout
    const timeoutMs = options.timeout || this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    requestConfig.signal = controller.signal;

    // Add body for POST/PUT/PATCH requests
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (data instanceof FormData) {
        requestConfig.body = data;
        delete requestConfig.headers['Content-Type']; // Let browser set it
      } else {
        requestConfig.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(url, requestConfig);
      clearTimeout(timeoutId);

      // Handle different response types
      if (options.responseType === 'blob') {
        if (!response.ok) {
          const errorText = await response.text();
          throw new APIError(`HTTP ${response.status}: ${errorText}`, response.status);
        }
        return await response.blob();
      }

      if (options.responseType === 'text') {
        if (!response.ok) {
          throw new APIError(`HTTP ${response.status}: ${response.statusText}`, response.status);
        }
        return await response.text();
      }

      // Parse JSON response
      const contentType = response.headers.get('content-type');
      let responseData;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        const errorMessage = responseData?.message || responseData?.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new APIError(errorMessage, response.status, responseData);
      }

      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408);
      }
      
      throw error instanceof APIError ? error : new APIError('Network request failed', 0, error);
    }
  }

  /**
   * Queue a request for batch processing
   * @private
   */
  async queueRequest(method, endpoint, data, options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        method,
        endpoint,
        data,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });

      console.log('📥 Real request added to queue:', {
        method,
        endpoint,
        queueLength: this.requestQueue.length
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue
   * @private
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log('🔄 Processing real request queue:', {
      length: this.requestQueue.length
    });

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        const response = await this.makeRequest(
          request.method,
          request.endpoint,
          request.data,
          { ...request.options, queued: false }
        );
        request.resolve(response);
      } catch (error) {
        request.reject(error);
      }

      // Small delay between requests to avoid overwhelming the server
      await this.sleep(100);
    }

    this.isProcessingQueue = false;
    console.log('✅ Real queue processing complete');
  }

  /**
   * Utility function for delays
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    console.log('🚫 Cancelling all pending real requests:', {
      count: this.requestQueue.length
    });

    this.requestQueue.forEach(request => {
      request.reject(new APIError('Request cancelled', 499));
    });
    this.requestQueue = [];
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    const status = {
      pending: this.requestQueue.length,
      processing: this.isProcessingQueue,
      oldestRequest: this.requestQueue.length > 0 ? this.requestQueue[0].timestamp : null
    };

    console.log('📊 Real queue status:', status);

    return status;
  }

  /**
   * Disconnect WebSocket connection
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.webSocket = null; // FIXED: Clear both references
    }
    this.progressCallbacks.clear();
    this.analysisCallbacks.clear();
  }
}

/**
 * @class APIError
 * @description Enhanced API error class for real backend errors
 */
class APIError extends Error {
  constructor(message, statusCode = null, originalError = null) {
    super(message);
    this.name = 'APIError';
    this.status = statusCode;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if error is retryable
   * @returns {boolean} Whether the error is retryable
   */
  isRetryable() {
    // Don't retry client errors (4xx) except for 408, 429
    if (this.status >= 400 && this.status <500) {
      return this.status === 408 || this.status === 429;
    }
    
    // Retry server errors (5xx) and network errors
    return this.status>= 500 || !this.status;
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    switch (this.status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Authentication required. Please check your API key.';
      case 403:
        return 'Access denied. You may not have permission for this action.';
      case 404:
        return 'The requested resource was not found.';
      case 408:
        return 'Request timeout. Please try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please try again later.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return this.message || 'An unexpected error occurred.';
    }
  }

  /**
   * Convert to JSON for logging
   * @returns {Object} Error details
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      timestamp: this.timestamp,
      originalError: this.originalError?.message || this.originalError
    };
  }
}

// Create singleton instance with default configuration
const apiService = new APIService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APIService, APIError, apiService };
} else {
  // Browser environment
  window.APIService = APIService;
  window.apiService = apiService;
}