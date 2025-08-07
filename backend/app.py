"""
Flask Web Server for Personality Analysis - COMPLETE BACKEND API INTEGRATION
Integrates the refactored llm_integration.py for all analysis tasks.
Includes WebSocket support for real-time progress tracking.
"""

import os
import sys
import time
import logging
import threading
import json
import uuid
import re
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
from flask_cors import CORS # pyinset-inline-end: ignore[reportMissingModuleSource]
from flask_socketio import SocketIO, emit, join_room, leave_room
from api_key_storage import api_key_storage

# Ensure the app's root directory is on the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Import the correctly refactored analysis component
try:
    from llm.llm_integration import LLMAnalyzer
except ImportError:
    LLMAnalyzer = None
    logging.error("CRITICAL: Failed to import LLMAnalyzer from llm.llm_integration.py. The application will not function.")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configure Flask to serve sophisticated UI from ui_assets/web_ui
app = Flask(__name__,
            static_folder='ui_assets/web_ui',
            static_url_path='')

# Configure WebSocket support for real-time progress tracking
app.config['SECRET_KEY'] = 'personality-analysis-secret-key'
socketio = SocketIO(
    app,
    cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000", "http://127.0.0.1:5000"],
    logger=True,
    engineio_logger=True,
    ping_timeout=120,
    ping_interval=25,
    allow_upgrades=True,
    transports=['websocket', 'polling']
)

# Enable CORS for frontend-backend communication
# A more robust CORS configuration that specifically targets the API endpoints
CORS(
    app,
    resources={r"/api/*": {"origins": [
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]}},
    supports_credentials=True
)
logger.info("FRONTEND-BACKEND BRIDGE: CORS enabled for http://localhost:5000 and http://127.0.0.1:5000 with credentials support.")

# ===== GLOBAL ANALYSIS STATE MANAGEMENT =====
analysis_sessions = {}
active_connections = {}

class AnalysisSession:
    """Manages the state of an analysis session with progress tracking."""

    def __init__(self, session_id: str, request_data: Dict[str, Any]):
        self.session_id = session_id
        self.request_data = request_data
        self.progress = 0
        self.status = "initializing"
        self.current_step = ""
        self.results = None
        self.error = None
        self.intervention = None
        self.created_at = datetime.now()
        self.completed_at = None

    def update_progress(self, progress: int, status: str, current_step: str = ""):
        """Update analysis progress and emit to connected clients."""
        self.progress = progress
        self.status = status
        self.current_step = current_step

        socketio.emit('analysis_progress', {
            'session_id': self.session_id,
            'progress': self.progress,
            'status': self.status,
            'current_step': self.current_step,
            'timestamp': datetime.now().isoformat()
        }, room=self.session_id)

        logger.info(f"Analysis {self.session_id}: {progress}% - {status} - {current_step}")

    def complete(self, results: Dict[str, Any]):
        """Mark analysis as complete with results."""
        self.results = results
        self.status = "completed"
        self.progress = 100
        self.completed_at = datetime.now()

        socketio.emit('analysis_complete', {
            'session_id': self.session_id,
            'results': results,
            'timestamp': self.completed_at.isoformat()
        }, room=self.session_id)

        logger.info(f"Analysis {self.session_id} completed successfully")

    def error_out(self, error: str):
        """Mark analysis as failed with error."""
        self.error = error
        self.status = "error"
        self.completed_at = datetime.now()

        socketio.emit('analysis_error', {
            'session_id': self.session_id,
            'error': error,
            'timestamp': self.completed_at.isoformat()
        }, room=self.session_id)

        logger.error(f"Analysis {self.session_id} failed: {error}")

    def request_intervention(self, intervention_data: Dict[str, Any]):
        """Signal that an intervention is required."""
        self.intervention = intervention_data
        self.status = "intervention_required"
        
        socketio.emit('analysis_intervention', {
            'session_id': self.session_id,
            'intervention': self.intervention,
            'timestamp': datetime.now().isoformat()
        }, room=self.session_id)

        logger.info(f"Analysis {self.session_id} requires intervention.")

# ===== WEBSOCKET EVENT HANDLERS =====
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    active_connections[request.sid] = {'connected_at': datetime.now(), 'session_ids': []}

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")
    if request.sid in active_connections:
        del active_connections[request.sid]

@socketio.on('join_analysis')
def handle_join_analysis(data):
    session_id = data.get('session_id')
    if session_id:
        join_room(session_id)
        if request.sid in active_connections:
            active_connections[request.sid]['session_ids'].append(session_id)
        logger.info(f"Client {request.sid} joined analysis session {session_id}")

@socketio.on('leave_analysis')
def handle_leave_analysis(data):
    session_id = data.get('session_id')
    if session_id:
        leave_room(session_id)
        if request.sid in active_connections and session_id in active_connections[request.sid]['session_ids']:
            active_connections[request.sid]['session_ids'].remove(session_id)
        logger.info(f"Client {request.sid} left analysis session {session_id}")

# ===== CONVERSATION PARSING INTEGRATION =====
class ConversationParserIntegration:
    """Simple conversation parser that works reliably."""

    def __init__(self):
        self.logger = logging.getLogger("conversation_parser")

    def parse_conversation_text(self, raw_text: str) -> List[Dict[str, Any]]:
        self.logger.info(f"Parsing {len(raw_text)} characters of conversation text")
        lines = raw_text.strip().split('\n')
        conversations = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Use a more robust regex to handle various formats like "Speaker: Message"
            match = re.match(r'^\s*([^:]+):\s*(.*)$', line)
            if match:
                speaker = match.group(1).strip()
                content = match.group(2).strip()
            else:
                # Fallback for lines without a clear speaker
                speaker = 'User'
                content = line

            if content:
                conversations.append({
                    'user': speaker,
                    'content': content,
                    'timestamp': None,
                    'platform': 'web_input'
                })

        if not conversations and raw_text.strip():
            conversations.append({
                'user': 'User',
                'content': raw_text.strip(),
                'timestamp': None,
                'platform': 'web_input'
            })

        self.logger.info(f"Parsed {len(conversations)} conversations.")
        return conversations

conversation_parser = ConversationParserIntegration()

# ===== INTERVENTION CHECK HELPER =====
def check_intervention(text):
    """Perform a context-aware content safety check."""
    import re
    
    # Context exclusion patterns - indicate legitimate discussions
    exclusion_contexts = {
        'medical_discussion': r'\b(doctor|medical|treatment|hospital|cancer|heart failure|medication|prescription|diagnosis|illness|disease|therapy)\b',
        'third_person_discussion': r'\b(my (friend|family|dad|mom|father|mother|brother|sister|relative)|he (died|passed)|she (died|passed)|family member|someone I know)\b',
        'past_events': r'\b(last (year|month|week)|months? ago|years? ago|(car )?accident happened|previously|in the past|used to|had been)\b',
        'educational_context': r'\b(discussing|awareness|helping others|support group|learning about|understanding|information about)\b'
    }
    
    # Check for excluding contexts first
    has_excluding_context = False
    for context_type, pattern in exclusion_contexts.items():
        if re.search(pattern, text, re.IGNORECASE):
            has_excluding_context = True
            break
    
    # More specific crisis patterns that require active, first-person, present-tense intent
    crisis_patterns = [
        r'\bI (want to|am going to|plan to|will) (kill myself|end my life|commit suicide)\b',
        r'\bI (have|am making) (a plan|plans) to (hurt|kill|harm) myself\b',
        r'\bI am (planning|going) to (attack|murder|shoot|stab|hurt|kill) (someone|people|him|her)\b',
        r'\bI (want|plan|intend) to (hurt|harm|kill|murder) (others|people|someone)\b'
    ]
    
    # Apply higher threshold for content with legitimate context
    severity_threshold = 0.9 if has_excluding_context else 0.7
    
    # Check crisis patterns
    matches_found = []
    for pattern in crisis_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            matches_found.append({
                'pattern': pattern,
                'match': match.group(),
                'confidence': 0.95  # High confidence for specific patterns
            })
    
    # Determine if intervention is needed
    if matches_found:
        # Calculate overall confidence
        max_confidence = max(match['confidence'] for match in matches_found)
        
        # Only trigger intervention if confidence exceeds threshold
        if max_confidence >= severity_threshold:
            return {
                "status": "intervention_required",
                "intervention": {
                    "type": "safety_check",
                    "message": "Your message contains content that raises serious concerns. Please solve the following challenge to continue.",
                    "requiresPuzzle": True,
                    "puzzle": {"word": "accntbl", "hint": "Spell the word from your resources."},
                    "debug_info": {
                        "has_excluding_context": has_excluding_context,
                        "severity_threshold": severity_threshold,
                        "max_confidence": max_confidence,
                        "matches": matches_found
                    }
                },
                "results": None
            }
    
    return None

# ===== UI AND STATIC FILE SERVING =====
@app.route('/', defaults={'filename': 'index.html'})
@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files for the UI, defaulting to index.html."""
    logger.info(f"Serving file: {filename}")
    return send_from_directory(app.static_folder, filename)

# ===== API CONFIGURATION ENDPOINTS =====
@app.route('/api/config', methods=['GET', 'POST', 'OPTIONS'])
def api_config():
    """Handle API configuration from frontend"""
    logger.info(f"API CONFIG endpoint called. Origin: {request.headers.get('Origin')}, Credentials: {request.headers.get('Cookie') or 'No Cookie'}, Headers: {dict(request.headers)}")
    
    if request.method == 'GET':
        try:
            config = api_key_storage.get_config()
            return jsonify(config)
        except Exception as e:
            logger.error(f"Failed to get API config: {e}")
            return jsonify({"error": "Failed to load configuration", "details": str(e)}), 500

    elif request.method == 'POST':
        try:
            logger.info(f"API CONFIG POST. Origin: {request.headers.get('Origin')}, Credentials: {request.headers.get('Cookie') or 'No Cookie'}, Headers: {dict(request.headers)}")
            data = request.get_json()
            if not data:
                return jsonify({"error": "No configuration data provided"}), 400

            success = api_key_storage.update_config(data)
            if success:
                return jsonify({"status": "success", "message": "Configuration saved successfully"})
            else:
                return jsonify({"error": "Failed to save configuration"}), 500

        except Exception as e:
            logger.error(f"Error saving API config: {e}")
            return jsonify({"error": "Failed to save configuration", "details": str(e)}), 500

def get_api_key(provider='openrouter'):
    return api_key_storage.get_api_key(provider)

@app.route('/api/models', methods=['GET'])
def get_models():
    """Fetch the list of available models from OpenRouter following OpenRouter API specification."""
    try:
        api_key = get_api_key('openrouter')
        if not api_key:
            # Return empty models list when no API key is configured
            # This allows the frontend to work properly without causing crashes
            logger.info("No OpenRouter API key configured - returning empty models list")
            return jsonify({"data": []})

        # Make direct request to OpenRouter API following their specification
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': request.headers.get('Referer', 'http://localhost:5000'),  # Optional header for OpenRouter rankings
            'X-Title': 'Personality Analysis Tool'  # Optional header for OpenRouter rankings
        }
        
        response = requests.get(
            'https://openrouter.ai/api/v1/models',
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            logger.error(f"OpenRouter API error: HTTP {response.status_code} - {response.text}")
            # Return empty models list instead of error to prevent frontend crashes
            return jsonify({"data": [], "error": f"Failed to fetch models: HTTP {response.status_code}"})

        # Return the OpenRouter response directly (it already has the correct format)
        models_data = response.json()
        
        # Log successful response for debugging
        logger.info(f"Successfully fetched {len(models_data.get('data', []))} models from OpenRouter")
        
        return jsonify(models_data)

    except requests.exceptions.Timeout:
        logger.error("Timeout while fetching models from OpenRouter")
        # Return empty models list instead of error to prevent frontend crashes
        return jsonify({"data": [], "error": "Request to OpenRouter timed out. Please try again."})
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error while fetching models: {e}", exc_info=True)
        # Return empty models list instead of error to prevent frontend crashes
        return jsonify({"data": [], "error": "Network error while fetching models.", "details": str(e)})
        
    except Exception as e:
        logger.error(f"Unexpected error while fetching models: {e}", exc_info=True)
        # Return empty models list instead of error to prevent frontend crashes
        return jsonify({"data": [], "error": "Unexpected error while fetching models.", "details": str(e)})

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    """Simple health check endpoint."""
    logger.info(f"HEALTH CHECK endpoint called. Origin: {request.headers.get('Origin')}, Credentials: {request.headers.get('Cookie') or 'No Cookie'}, Headers: {dict(request.headers)}")
    # The Flask-CORS extension will handle OPTIONS requests automatically.
    # No need for manual handling here.
    return jsonify({"status": "ok"}), 200

@app.route('/api/parse', methods=['POST'])
def parse_text():
    """Parses raw text and returns the structured conversation data, including detected speakers."""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided for parsing."}), 400

        raw_text = data['text']
        logger.info(f"Received request to parse text of length {len(raw_text)}")

        # Use the existing conversation parser
        parsed_conversations = conversation_parser.parse_conversation_text(raw_text)
        
        # Extract unique speakers from the parsed data
        speakers = sorted(list(set(conv['user'] for conv in parsed_conversations)))
        
        logger.info(f"Successfully parsed text, detected {len(speakers)} speakers: {speakers}")

        return jsonify({
            "status": "success",
            "conversations": parsed_conversations,
            "speakers": speakers
        })

    except Exception as e:
        logger.error(f"Error in /api/parse endpoint: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "An unexpected server error occurred during parsing."}), 500

# ===== CORE ANALYSIS ENDPOINT =====
@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Main analysis endpoint, simplified to use the new LLMAnalyzer."""
    try:
        logger.info("Analysis request received.")
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        session_id = str(uuid.uuid4())
        session = AnalysisSession(session_id, data)
        analysis_sessions[session_id] = session

        session.update_progress(5, "initializing", "Validating request")

        conversations = data.get('conversations', [])
        raw_text = data.get('text', '')
        analysis_type = data.get('analysis_type', 'comprehensive')  # Default to comprehensive
        model = data.get('model')  # Let LLMAnalyzer handle default
        selected_speakers = data.get('selected_speakers')  # Optional speaker filtering
        speaker = selected_speakers[0] if selected_speakers else None
        relationship_description = data.get('relationship_description')  # Optional relationship context

        if raw_text and not conversations:
            session.update_progress(10, "parsing_conversation", "Parsing conversation text")
            conversations = conversation_parser.parse_conversation_text(raw_text)

        if not conversations:
            session.error_out("No conversation data provided.")
            return jsonify({"status": "error", "message": "No conversation data provided"}), 400

        full_text = " ".join([conv.get('content', '') for conv in conversations])
        intervention_response = check_intervention(full_text)
        if intervention_response:
            # Use the new WebSocket-based intervention flow
            session.request_intervention(intervention_response['intervention'])
        else:
            # Only proceed with analysis if no intervention is needed
            api_key = get_api_key('openrouter')
            if not api_key:
                session.error_out("OpenRouter API key not configured.")
                # This return is inside the main request thread, so it's fine.
                return jsonify({"status": "error", "message": "API key missing."}), 400

            if not LLMAnalyzer:
                session.error_out("LLMAnalyzer component is not available.")
                # This return is also fine.
                return jsonify({"status": "error", "message": "Analysis component not loaded."}), 500

            def run_analysis_thread():
                """The actual analysis logic to be run in a thread."""
                try:
                    session.update_progress(20, "initializing_analyzer", "Initializing analysis engine")
                    # api_key is now correctly in scope from the outer function
                    analyzer = LLMAnalyzer(api_key=api_key, endpoint="https://openrouter.ai/api/v1/chat/completions")

                    session.update_progress(30, "analyzing", f"Performing {analysis_type} analysis")

                    analysis_result = analyzer.analyze(
                        conversations,
                        analysis_type=analysis_type,
                        model=model,
                        speaker=speaker,
                        relationship_description=relationship_description
                    )

                    session.update_progress(80, "processing_results", "Finalizing analysis results")
                    session.complete(analysis_result)

                except Exception as e:
                    logger.error(f"Analysis thread error for session {session_id}: {e}", exc_info=True)
                    session.error_out(str(e))

            # Start the analysis in a background thread.
            # This is now correctly placed within the 'else' block.
            threading.Thread(target=run_analysis_thread, daemon=True).start()

        # This is the response for the initial POST request.
        return jsonify({
            "status": "started",
            "session_id": session_id
        })

    except Exception as e:
        logger.error(f"Error in /api/analyze endpoint: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "An unexpected server error occurred."}), 500

@app.route('/api/resolve_intervention', methods=['POST'])
def resolve_intervention():
    """Endpoint for submitting puzzle answers to resolve an intervention."""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        answer = data.get('answer', '').strip().lower()

        if not session_id or session_id not in analysis_sessions:
            return jsonify({"status": "error", "message": "Invalid session ID."}), 404

        session = analysis_sessions[session_id]
        if session.status != "intervention_required" or not session.intervention:
            return jsonify({"status": "error", "message": "No intervention is active for this session."}), 400

        correct_answer = session.intervention.get("puzzle", {}).get("word", "").lower()
        
        if answer == correct_answer:
            session.update_progress(15, "intervention_resolved", "Intervention resolved. Resuming analysis.")
            
            # Resume the analysis in a background thread
            # This logic is duplicated from the /analyze endpoint, which is not ideal
            # but necessary for this refactoring. A better solution would be to
            # encapsulate the analysis-thread-spawning logic into a shared function.
            api_key = get_api_key('openrouter')
            conversations = session.request_data.get('conversations', [])
            analysis_type = session.request_data.get('analysis_type', 'comprehensive')
            model = session.request_data.get('model')
            selected_speakers = session.request_data.get('selected_speakers')
            speaker = selected_speakers[0] if selected_speakers else None
            relationship_description = session.request_data.get('relationship_description')


            def run_analysis_thread():
                """The actual analysis logic to be run in a thread."""
                try:
                    session.update_progress(20, "initializing_analyzer", "Initializing analysis engine")
                    analyzer = LLMAnalyzer(api_key=api_key, endpoint="https://openrouter.ai/api/v1/chat/completions")
                    session.update_progress(30, "analyzing", f"Performing {analysis_type} analysis")
                    analysis_result = analyzer.analyze(
                        conversations,
                        analysis_type=analysis_type,
                        model=model,
                        speaker=speaker,
                        relationship_description=relationship_description
                    )
                    session.update_progress(80, "processing_results", "Finalizing analysis results")
                    session.complete(analysis_result)
                except Exception as e:
                    logger.error(f"Analysis thread error for session {session_id}: {e}", exc_info=True)
                    session.error_out(str(e))

            threading.Thread(target=run_analysis_thread, daemon=True).start()
            return jsonify({"status": "success", "message": "Answer correct. Analysis is resuming."})
        else:
            # Emit a failure event back to the client
            socketio.emit('intervention_failed', {
                'session_id': session_id,
                'message': 'Incorrect answer. Please try again.'
            }, room=session_id)
            return jsonify({"status": "error", "message": "Incorrect answer."}), 400

    except Exception as e:
        logger.error(f"Error in /api/resolve_intervention: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "An unexpected server error occurred."}), 500

@app.route('/api/validate_key', methods=['POST'])
def validate_api_key():
    """Validates an API key against the provider."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"valid": False, "message": "No data provided"}), 400

        api_key = data.get('api_key', '').strip()
        if not api_key:
            return jsonify({"valid": False, "message": "No API key provided"}), 400

        headers = {'Authorization': f'Bearer {api_key}'}
        response = requests.get('https://openrouter.ai/api/v1/models', headers=headers, timeout=10)

        if response.status_code == 200:
            # We don't store the key here, just validate it. The config endpoint handles storage.
            return jsonify({"valid": True, "message": "API key is valid"})
        else:
            return jsonify({"valid": False, "message": f"Invalid API key (status {response.status_code})"})

    except requests.exceptions.RequestException as e:
        return jsonify({"valid": False, "message": f"API validation failed: {e}"}), 500
    except Exception as e:
        return jsonify({"valid": False, "message": f"An unexpected error occurred: {e}"}), 500


def start_server(debug=None):
    """Start the Flask web server."""
    logger.info("Starting Flask web server with simplified, robust integration.")
    is_main_thread = threading.current_thread() is threading.main_thread()
    use_debug = debug if debug is not None else is_main_thread

    logger.info(f"Server accessible at: http://localhost:5000")
    logger.info(f"API KEY STATUS: OpenRouter configured: {bool(get_api_key('openrouter'))}")
    logger.info(f"LLM INTEGRATION: {'Available' if LLMAnalyzer else 'UNAVAILABLE - CRITICAL ERROR'}")

    socketio.run(app, debug=use_debug, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

if __name__ == '__main__':
    start_server(debug=True)