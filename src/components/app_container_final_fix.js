'use strict';

const e = React.createElement;

/**
 * A centralized and reactive container for the ConversaTrait application.
 * This component manages the application's state, view transitions, and WebSocket communication.
 * It replaces the previous imperative and non-reactive implementation with a modern React Hooks-based approach.
 *
 * @component
 */
function AppContainer() {
    // --- STATE MANAGEMENT ---
    // Manages the current view of the application ('mainMenu', 'analysis', 'apiConfig')
    const [currentView, setCurrentView] = React.useState('mainMenu');
    // Stores the configuration for the currently selected analysis type
    const [selectedAnalysisType, setSelectedAnalysisType] = React.useState(null);
    // Holds the results from the backend analysis
    const [analysisResults, setAnalysisResults] = React.useState(null);
    // Tracks whether an analysis is currently in progress
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    // Stores the unique ID for the current analysis session
    const [currentSessionId, setCurrentSessionId] = React.useState(null);
    // Holds the user's API key status
    const [hasApiKey, setHasApiKey] = React.useState(false);
    // Tracks the initial loading state of the application
    const [isInitializing, setIsInitializing] = React.useState(true);
    // Tracks the progress percentage of the analysis
    const [progress, setProgress] = React.useState(0);
    // Displays status messages during the analysis process
    const [statusMessage, setStatusMessage] = React.useState('');
    // Stores the ID of the client-side analysis timeout
    const [analysisTimeoutId, setAnalysisTimeoutId] = React.useState(null);

    // --- SERVICES ---
    // Memoize service instances to prevent re-initialization on re-renders
    const apiService = React.useMemo(() => window.apiService, []);

    // --- EFFECTS ---

    /**
     * Effect to check the initial API key status when the component mounts.
     */
    React.useEffect(() => {
        const checkApiKey = async () => {
            console.log('🔍 Checking initial API key status...');
            try {
                // Add timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('API initialization timeout')), 10000)
                );
                
                await Promise.race([
                    apiService.getApiConfig(true), // Force refresh
                    timeoutPromise
                ]);
                
                setHasApiKey(apiService.hasApiKey);
                console.log(`API key status: ${apiService.hasApiKey ? 'Configured' : 'Not Configured'}`);
            } catch (error) {
                console.error('Error checking API key status:', error);
                setHasApiKey(false);
            } finally {
                setIsInitializing(false);
                console.log('✅ Initialization complete.');
            }
        };

        checkApiKey();
    }, [apiService]);


    /**
     * Clears the client-side analysis timeout.
     */
    const clearAnalysisTimeout = React.useCallback(() => {
        if (analysisTimeoutId) {
            clearTimeout(analysisTimeoutId);
            setAnalysisTimeoutId(null);
        }
    }, [analysisTimeoutId]);

    /**
     * Effect to handle WebSocket event listeners for final analysis results.
     * This is the primary mechanism for receiving the final data from the backend.
     */
    React.useEffect(() => {
        const socket = apiService.webSocket;
        if (!socket || !currentSessionId) {
            return;
        }

        console.log(`🎧 AppContainer: Attaching final result listeners for session: ${currentSessionId}`);

        const handleAnalysisComplete = (data) => {
            console.log('✅ AppContainer: Received analysis_complete event', data);
            if (data.session_id === currentSessionId) {
                clearAnalysisTimeout();
                // The final results are in the 'results' property of the payload
                setAnalysisResults(data.results || data);
                setIsAnalyzing(false);
                setProgress(100);
                setStatusMessage('Analysis complete!');
            }
        };

        const handleAnalysisError = (data) => {
            console.error('❌ AppContainer: Received analysis_error event', data);
            if (data.session_id === currentSessionId) {
                clearAnalysisTimeout();
                setAnalysisResults({
                    error: true,
                    message: data.error || 'An unknown error occurred during analysis.',
                    details: data.details || ''
                });
                setIsAnalyzing(false);
            }
        };

        socket.on('analysis_complete', handleAnalysisComplete);
        socket.on('analysis_error', handleAnalysisError);

        // Cleanup function to prevent memory leaks
        return () => {
            console.log(`🧹 AppContainer: Cleaning up listeners for session: ${currentSessionId}`);
            socket.off('analysis_complete', handleAnalysisComplete);
            socket.off('analysis_error', handleAnalysisError);
        };
    }, [currentSessionId, apiService, clearAnalysisTimeout]);


    /**
     * Initiates the analysis process by calling the APIService.
     * This function now only starts the analysis and sets the session ID.
     * The final result is handled by the WebSocket effect.
     */
    const handleAnalyze = React.useCallback(async (options) => {
        console.log('🚀 AppContainer: Initiating analysis with options:', options);
        clearAnalysisTimeout();
        setIsAnalyzing(true);
        setAnalysisResults(null);
        setProgress(0);
        setStatusMessage('Initiating analysis...');
        setCurrentSessionId(null);

        const timeoutId = setTimeout(() => {
            console.error('❌ Analysis timed out on client-side.');
            // This check is important to avoid setting a timeout error after a result has already been received.
            if (isAnalyzing) {
                setAnalysisResults({
                    error: true,
                    message: 'Analysis timed out. The server did not respond in time.',
                    details: `The analysis did not complete within the 150-second time limit.`
                });
                setIsAnalyzing(false);
            }
        }, 150000); // 150 seconds
        setAnalysisTimeoutId(timeoutId);

        try {
            const initialResponse = await apiService.analyzeContent({
                ...options,
                onProgress: (progressData) => {
                    // Progress updates are still handled via this callback for real-time feedback
                    setProgress(progressData.progress || 0);
                    setStatusMessage(progressData.message || 'Analysis in progress...');
                }
            });

            if (initialResponse && initialResponse.session_id) {
                console.log('✅ AppContainer: Analysis session started successfully. Session ID:', initialResponse.session_id);
                setCurrentSessionId(initialResponse.session_id);
            } else {
                // This handles cases where analysis might fail to start or completes synchronously
                clearAnalysisTimeout();
                console.warn('✅ AppContainer: Analysis did not return a session_id. Handling as synchronous result.', initialResponse);
                setAnalysisResults(initialResponse);
                setIsAnalyzing(false);
                if (initialResponse && !initialResponse.error) {
                    setProgress(100);
                    setStatusMessage('Analysis complete!');
                }
            }
        } catch (error) {
            clearAnalysisTimeout();
            console.error('❌ AppContainer: Failed to start analysis:', error);
            setAnalysisResults({
                error: true,
                message: error.message || 'Failed to start analysis',
                details: error.originalError ? JSON.stringify(error.originalError) : error.toString()
            });
            setIsAnalyzing(false);
        }
    }, [apiService, clearAnalysisTimeout, isAnalyzing]);

    /**
     * Handles the selection of an analysis type from the main menu.
     */
    const handleSelectAnalysis = React.useCallback((analysis) => {
        console.log('AppContainer: Analysis selected:', analysis);
        setSelectedAnalysisType(analysis);
        // Navigate to the correct view based on the analysis ID
        if (analysis.id === 'relationship_dynamics_analysis') {
            setCurrentView('relationshipAnalysis');
        } else {
            setCurrentView('analysis');
        }
        setAnalysisResults(null); // Clear previous results when starting a new analysis
    }, []);

    /**
     * Navigates back to the main menu and resets analysis-related state.
     */
    const handleBackToMainMenu = React.useCallback(() => {
        setCurrentView(() => 'mainMenu');
        setSelectedAnalysisType(() => null);
        setAnalysisResults(() => null);
        setIsAnalyzing(() => false);
        setProgress(() => 0);
        setStatusMessage(() => '');
        setCurrentSessionId(() => null);
        clearAnalysisTimeout();
    }, [clearAnalysisTimeout]);

    /**
     * Handles changes to the API configuration.
     */
    const handleConfigurationChange = React.useCallback(async (config) => {
        console.log('API config changed, re-validating and updating key status.');
        try {
            // Re-check the configuration from the backend to ensure it's valid
            await apiService.getApiConfig(true); // Force a refresh
            const newHasApiKey = apiService.hasApiKey;
            setHasApiKey(newHasApiKey);

            if (!newHasApiKey) {
                console.warn('Configuration was saved, but no valid API key was found.');
            }
        } catch (error) {
            console.error('Error after configuration change:', error);
            // Optionally, set an error state to display to the user
        }
    }, [apiService]);


    // --- RENDER LOGIC ---

    /**
     * Renders the main content of the application based on the current view.
     */
    const renderContent = () => {
        if (isInitializing) {
            return e('div', { className: 'flex justify-center items-center h-full' },
                e('div', { className: 'flex flex-col items-center space-y-4' }, [
                    e('div', {
                        key: 'spinner',
                        className: 'loading-spinner'
                    }),
                    e('div', {
                        key: 'text',
                        className: 'text-white text-lg'
                    }, 'Loading...')
                ])
            );
        }

        if (!hasApiKey) {
            return e(window.APIConfiguration, {
                onConfigurationChange: handleConfigurationChange,
                onProceedToMainMenu: handleBackToMainMenu
            });
        }

        switch (currentView) {
            case 'mainMenu':
                return e(window.MainMenu, { onSelectAnalysis: handleSelectAnalysis });
            case 'analysis':
                // RESTORED: Use AnalysisInterface to provide direct conversation input boxes
                return e(window.AnalysisInterface, {
                    analysisType: selectedAnalysisType,
                    onAnalyze: handleAnalyze,
                    onBackToMainMenu: handleBackToMainMenu,
                    isAnalyzing: isAnalyzing,
                    results: analysisResults,
                    progress: progress,
                    statusMessage: statusMessage,
                });
            case 'relationshipAnalysis':
                return e(window.RelationshipAnalyzer, {
                    onAnalyze: handleAnalyze,
                    onBackToMainMenu: handleBackToMainMenu,
                    isAnalyzing: isAnalyzing,
                    results: analysisResults,
                    progress: progress,
                    statusMessage: statusMessage,
                });
            default:
                return e(window.ErrorBoundary, {
                    location: 'AppContainer Unknown View',
                    fallback: e('div', { className: 'text-center text-white p-8' }, [
                        e('h2', { key: 'title', className: 'text-xl font-bold mb-4' }, 'Navigation Error'),
                        e('p', { key: 'message', className: 'text-gray-300 mb-4' }, `Unknown view: ${currentView}`),
                        e('button', {
                            key: 'home-btn',
                            onClick: handleBackToMainMenu,
                            className: 'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition'
                        }, 'Return to Main Menu')
                    ])
                }, e('div', null, `Unknown view: ${currentView}`));
        }
    };

    return e(
        'div',
        { key: 'app-wrapper', className: 'bg-gray-900 text-white min-h-screen' },
        [
            e(
                'div',
                {
                    key: 'header',
                    className: 'fixed top-0 left-0 right-0 bg-gray-900/50 backdrop-blur-sm p-4 z-50 flex justify-between items-center border-b border-gray-700/50'
                },
                [
                    e('h1', { key: 'title', className: 'text-xl font-bold text-white' }, 'ConversaTrait'),
                    hasApiKey && currentView !== 'mainMenu' && e(
                        'button',
                        {
                            key: 'main-menu-btn',
                            onClick: handleBackToMainMenu,
                            className: 'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors'
                        },
                        'Main Menu'
                    )
                ]
            ),
            e(
                'div',
                { key: 'view-wrapper', className: 'pt-20' },
                renderContent()
            )
        ]
    );
}

// --- INITIALIZATION ---
// Wait for the DOM to be fully loaded before rendering the application.
document.addEventListener('DOMContentLoaded', () => {
    const appElement = document.getElementById('app');
    if (appElement) {
        // Initialize services that are needed globally
        window.apiService = new APIService();
        
        // Create the React root and render the main AppContainer component.
        const root = ReactDOM.createRoot(appElement);
        root.render(e(AppContainer));
    } else {
        console.error('Failed to find the root element #app');
    }
});