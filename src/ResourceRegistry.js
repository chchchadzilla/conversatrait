/**
 * @class ValidationRule
 * @description Represents a single validation rule
 */
class ValidationRule {
    constructor({ name, priority = 5, validate, message }) {
        this.name = name;
        this.priority = priority;
        this.validate = validate;
        this.message = message;
    }

    execute(resource) {
        try {
            const isValid = this.validate(resource);
            return {
                rule: this.name,
                isValid,
                error: isValid ? null : this.message
            };
        } catch (error) {
            return {
                rule: this.name,
                isValid: false,
                error: `Validation rule "${this.name}" failed: ${error.message}`
            };
        }
    }
}

/**
 * @class ValidationError
 * @description Custom error class for validation failures
 */
class ValidationError extends Error {
    constructor(message, results = []) {
        super(message);
        this.name = 'ValidationError';
        this.results = results;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            results: this.results,
            timestamp: this.timestamp
        };
    }
}

/**
 * @class ValidationManager
 * @description Manages validation rules and executes validations
 */
class ValidationManager {
    constructor(categoryManager) {
        this.rules = new Map();
        this._categoryManager = categoryManager;
        this.initializeDefaultRules();
    }

    initializeDefaultRules() {
        // Initialize default validation rules
        this.addRule(new ValidationRule({
            name: 'requiredFields',
            priority: 10,
            validate: (resource) => {
                const requiredFields = ['name', 'description', 'category', 'priority'];
                // Ensure all required fields are present and not null/undefined
                return requiredFields.every(field => resource[field] !== undefined && resource[field] !== null);
            },
            message: 'Required fields missing (name, description, category, priority)'
        }));
        
        // Add category validation rule
        this.addRule(new ValidationRule({
            name: 'validCategory',
            priority: 8,
            validate: (resource) => {
                // Check if category is valid through ResourceRegistry
                // Assuming _categoryManager.validateCategory returns an array of errors,
                // so an empty array means the category is valid.
                const categoryResults = this._categoryManager.validateCategory(resource);
                return categoryResults.length === 0;
            },
            message: 'Resource category is not valid'
        }));
    }

    addRule(rule) {
        this.rules.set(rule.name, rule);
    }

    validate(resource) {
        const results = Array.from(this.rules.values())
            .sort((a, b) => b.priority - a.priority)
            .map(rule => rule.execute(resource));

        const failures = results.filter(result => !result.isValid);
        if (failures.length > 0) {
            throw new ValidationError(
                `Validation failed: ${failures.map(f => f.error).join('; ')}`,
                results
            );
        }

        const categoryResults = this._categoryManager.validateCategory(resource);
        return [...results, ...categoryResults];
    }
}

/**
 * @class APIClient
 * @description Handles API communication
 */
class APIClient {
    constructor(apiKey, baseUrl = 'https://openrouter.ai/api/v1') {
        if (!apiKey) {
            console.error('APIClient: API Key is required!');
            // Potentially throw an error or handle this state appropriately
        }
        this.apiKey = apiKey;
        console.log('APIClient: Initializing with baseUrl:', baseUrl);
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async get(endpoint, options = {}) {
        console.log('APIClient: Making GET request to:', endpoint);
        return this._makeRequest('GET', endpoint, null, options);
    }

    async post(endpoint, data = null, options = {}) {
        console.log('APIClient: Making POST request to:', endpoint);
        return this._makeRequest('POST', endpoint, data, options);
    }

    async put(endpoint, data = null, options = {}) {
        console.log('APIClient: Making PUT request to:', endpoint);
        return this._makeRequest('PUT', endpoint, data, options);
    }

    async delete(endpoint, options = {}) {
        console.log('APIClient: Making DELETE request to:', endpoint);
        return this._makeRequest('DELETE', endpoint, null, options);
    }

    async getModels(options = {}) {
        console.log('APIClient: Fetching models...');
        return this._makeRequest('GET', '/models', null, options);
    }

    async testConnection() {
        console.log('APIClient: Testing connection by fetching models...');
        try {
            // Using getModels which now points to /models endpoint
            const response = await this.getModels(); 
            console.log('APIClient: Test connection successful (models fetched):', response);
            return response;
        } catch (error) {
            console.error('APIClient: Test connection failed:', error);
            throw error;
        }
    }

    /* // Commenting out healthCheck as testConnection is more relevant for OpenRouter
    async healthCheck() {
        console.log('APIClient: Checking health...');
        try {
            const response = await this.get('/health'); // Updated endpoint for health check
            console.log('APIClient: Health check successful:', response);
            return response;
        } catch (error) {
            console.error('APIClient: Health check failed:', error);
            throw error;
        }
    }
    */

    async _makeRequest(method, endpoint, data = null, options = {}) {
        // Wait for APIService to be loaded and get APIError from it
        // await this._waitForAPIService();
        const APIError = window.APIError || Error;

        const url = `${this.baseUrl}${endpoint}`;
        console.log('APIClient: Making request:', { method, url });
        
        const config = {
            method,
            headers: {
                ...this.defaultHeaders,
                'Authorization': `Bearer ${this.apiKey}`, // Added Authorization header
                ...options.headers
            },
            ...options
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);
            console.log('APIClient: Received response:', { 
                status: response.status,
                statusText: response.statusText
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    errorData,
                    response.status
                );
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const jsonData = await response.json();
                console.log('APIClient: Parsed JSON response:', jsonData);
                return jsonData;
            } else {
                const textData = await response.text();
                console.log('APIClient: Received text response:', textData);
                return textData;
            }
        } catch (error) {
            console.error('APIClient: Request failed:', error);
            throw error;
        }
    }

    async _waitForAPIService(maxAttempts = 50) {
        console.log('APIClient: Waiting for APIService to be loaded...');
        let attempts = 0;
        
        while (!window.APIError && attempts <maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.APIError) {
            throw new Error('APIService failed to load after 5 seconds');
        }

        console.log('APIClient: APIService loaded successfully');
    }
}

/**
 * @class ResourceRegistry
 * @description Main registry for managing resources with API integration
 */
class ResourceRegistry {
    constructor() {
        console.log('ResourceRegistry: Initializing...');
        // IMPORTANT: Replace 'YOUR_OPENROUTER_API_KEY_PLACEHOLDER' with your actual key locally
        // and do not commit the actual key.
        this.apiClient = new APIClient('YOUR_OPENROUTER_API_KEY_PLACEHOLDER');
        this.resources = new Map();
        this.validationManager = new ValidationManager(this);
        this.isConnected = false;
        this._initializeConnection();
    }

    async _initializeConnection() {
        console.log('ResourceRegistry: Starting connection initialization...');
        try {
            await this.apiClient.testConnection();
            this.isConnected = true;
            console.log('ResourceRegistry: API connection established successfully');
        } catch (error) {
            this.isConnected = false;
            console.warn('ResourceRegistry: Failed to establish API connection:', error.message);
        }
    }

    async testAPIConnection() {
        console.log('ResourceRegistry: Testing API connection...');
        try {
            const response = await this.apiClient.testConnection();
            this.isConnected = true;
            console.log('ResourceRegistry: API connection test successful');
            return { success: true, response };
        } catch (error) {
            this.isConnected = false;
            console.error('ResourceRegistry: API connection test failed:', error);
            return { success: false, error: error.message };
        }
    }

    async getFreeModelsSorted() {
        console.log('ResourceRegistry: Fetching and sorting free models...');
        try {
            const response = await this.apiClient.getModels();
            if (!response || !Array.isArray(response.data)) {
                console.error('ResourceRegistry: Invalid response format from getModels:', response);
                throw new Error('Failed to fetch models or invalid data format.');
            }

            const models = response.data;

            const freeModels = models.filter(model => {
                const promptPrice = model.pricing && typeof model.pricing.prompt === 'string' ? parseFloat(model.pricing.prompt) : NaN;
                const completionPrice = model.pricing && typeof model.pricing.completion === 'string' ? parseFloat(model.pricing.completion) : NaN;
                return promptPrice === 0 && completionPrice === 0;
            });

            const sortedModels = freeModels.sort((a, b) => {
                const contextA = a.context_length || 0;
                const contextB = b.context_length || 0;
                return contextB - contextA; // Sort descending by context_length
            });

            const formattedModels = sortedModels.map(model => {
                let cleanedName = model.id;
                if (model.id && model.id.includes('/')) {
                    cleanedName = model.id.substring(model.id.indexOf('/') + 1);
                }
                // Further clean up common patterns like replacing hyphens with spaces and capitalizing
                cleanedName = cleanedName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                return {
                    id: model.id,
                    name: cleanedName, // Use the human-readable name from API, or cleaned id if preferred
                    displayName: `${model.name} (${cleanedName}, ${model.context_length || 'N/A'})`, // More descriptive for UI
                    context_length: model.context_length || 0,
                    rawModelData: model // Keep raw data if needed elsewhere
                };
            });

            console.log('ResourceRegistry: Processed free models:', formattedModels.length);
            return formattedModels;

        } catch (error) {
            console.error('ResourceRegistry: Error fetching or processing free models:', error);
            // Propagate the error or return an empty array/specific error object
            throw error; 
        }
    }

    /**
     * Validates the resource category.
     * Checks if resource.category is in the allowed list.
     * Returns an array of error objects if invalid, or an empty array if valid.
     * TODO: In the future, fetch valid categories from an API or config.
     * @param {Object} resource
     * @returns {Array<Object>} Array of validation result objects
     */
    validateCategory(resource) {
        const allowedCategories = ['general', 'model', 'api', 'utility'];
        const results = [];
        if (!allowedCategories.includes(resource.category)) {
            results.push({
                rule: 'categoryValidation',
                isValid: false,
                error: `Category "${resource.category}" is not valid. Allowed: ${allowedCategories.join(', ')}`
            });
        }
        return results;
    }
}

// Export classes for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResourceRegistry, APIClient, ValidationManager, ValidationRule, ValidationError };
} else {
    // Browser environment
    window.ResourceRegistry = ResourceRegistry;
    window.APIClient = APIClient;
    window.ValidationManager = ValidationManager;
    window.ValidationRule = ValidationRule;
    window.ValidationError = ValidationError;
}
