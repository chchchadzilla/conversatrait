from typing import Dict, List, Optional
import requests
import json
from datetime import datetime
import re
import os

# Correctly import the enhanced prompts
try:
    from enhanced_prompts import get_analysis_prompt
except ImportError:
    print("ERROR: Could not import enhanced_prompts.py. Analysis will fail.")
    get_analysis_prompt = None


class LLMAnalyzer:
    """Enhanced LLM analyzer using enhanced_prompts.py for REAL analysis."""

    def __init__(self, api_key: str, endpoint: str):
        """Initialize the LLM analyzer."""
        self.api_key = api_key
        self.endpoint = endpoint
        self.retry_count = 3
        self.timeout = 60  # Increased timeout for longer analyses
        self.default_model = "google/gemini-flash-1.5"  # Free model with 1M context window

    def get_available_models(self) -> List[Dict]:
        """Fetch available models from OpenRouter and return sorted by price."""
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(
            'https://openrouter.ai/api/v1/models',
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            raise ValueError(f"Failed to fetch models: HTTP {response.status_code}")
        
        models_data = response.json()
        models = models_data['data']
        
        # Process and sort all models based on user requirements
        
        # 1. Filter out models that might be missing essential data
        processed_models = []
        for model in models:
            # Ensure pricing and context_length are present to avoid errors
            if model.get('pricing') and model.get('context_length') is not None:
                # Ensure pricing values are valid floats
                try:
                    prompt_price = float(model['pricing'].get('prompt', 'inf'))
                    # Add context length for sorting
                    model['context_length'] = int(model['context_length'])
                    processed_models.append(model)
                except (ValueError, TypeError):
                    # Skip models with invalid pricing data
                    continue

        # 2. Sort models: by price (ascending), then by context length (descending)
        # The key is a tuple: (price, -context_length)
        # The negative context_length achieves descending order for the secondary sort.
        processed_models.sort(key=lambda m: (float(m['pricing']['prompt']), -m['context_length']))
        
        return processed_models

    def analyze(self, conversations: List[Dict], analysis_type: str = "comprehensive", model: str = None, speaker: str = None, relationship_description: str = None) -> Dict:
        """Performs personality analysis using the correct prompts from enhanced_prompts.py."""
        if not conversations:
            raise ValueError("No conversations provided for analysis")

        if not self.api_key or not self.endpoint:
            raise ValueError("LLM configuration incomplete")
            
        if not get_analysis_prompt:
            raise ImportError("enhanced_prompts.py is not available. Cannot perform analysis.")

        # CRITICAL FIX: Advanced model validation and safety fallback
        # Prevent problematic models that return safety classifications instead of analysis
        
        # List of known problematic models to auto-correct
        PROBLEMATIC_MODELS = [
            'meta-llama/llama-guard-3-8b',
            'meta-llama/llama-guard-2-8b',
            'meta-llama/llama-guard',
            'openai/moderation',
            'anthropic/claude-moderation'
        ]
        
        selected_model = None
        user_specified_model = model.strip() if model and model.strip() else None
        
        if user_specified_model:
            # Check if user selected a problematic model
            if user_specified_model.lower() in [pm.lower() for pm in PROBLEMATIC_MODELS]:
                print(f"WARNING: User selected problematic model '{user_specified_model}' - auto-correcting to default")
                selected_model = self.default_model
                print(f"DEBUG: Switched from '{user_specified_model}' to safe default: {selected_model}")
            else:
                # User provided a valid model
                selected_model = user_specified_model
                print(f"DEBUG: Using user-specified model: {selected_model}")
        else:
            # No valid model provided - use our safe default
            selected_model = self.default_model
            print(f"DEBUG: No valid model specified, using default: {selected_model}")
        
        # Final safety check - ensure we have a valid model
        if not selected_model or not selected_model.strip():
            selected_model = self.default_model
            print(f"DEBUG: Final safety check triggered, forcing default: {selected_model}")
        
        # --- PROMPT GENERATION REFACTORED ---
        # 1. Get the correct prompt template from enhanced_prompts.py
        prompt_template = get_analysis_prompt(analysis_type, relationship_description)
        
        # 2. Format the conversation text and filter by speaker if specified
        speaker_counts = {}
        message_lines = []
        filtered_conversations = []
        
        # Filter conversations by speaker if specified
        if speaker:
            filtered_conversations = [conv for conv in conversations if conv.get('user', '').strip().lower() == speaker.lower()]
            if not filtered_conversations:
                raise ValueError(f"No conversations found for speaker '{speaker}'")
        else:
            filtered_conversations = conversations
        
        # Process filtered conversations
        for conv in filtered_conversations:
            conv_speaker = conv.get('user', 'Unknown')
            content = conv.get('content', '').strip()
            if content:
                speaker_counts[conv_speaker] = speaker_counts.get(conv_speaker, 0) + 1
                message_lines.append(f"{conv_speaker}: {content}")
        
        # Determine target speaker for analysis
        if speaker:
            target_speaker = speaker
        else:
            target_speaker = max(speaker_counts, key=speaker_counts.get) if speaker_counts else "the user"
        
        messages_text = "\n".join(message_lines)

        # 3. Format the final user prompt
        user_prompt = prompt_template.format(speaker=target_speaker, messages=messages_text)
        
        # 4. Define a simple, effective system prompt
        system_prompt = "You are an expert psychological analyst. Your response MUST be a valid JSON object that strictly adheres to the format requested in the user prompt. Do not include any explanatory text, markdown formatting, or anything else outside of the JSON structure."

        for attempt in range(self.retry_count):
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": selected_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 4096, # Increased for detailed JSON
                "temperature": 0.5, # Lowered for more consistent JSON output
                "response_format": {"type": "json_object"} # Request JSON output directly
            }

            print(f"DEBUG: Making request to {self.endpoint} (Attempt {attempt+1}/{self.retry_count})")
            print(f"DEBUG: Using model: {selected_model}")
            
            try:
                response = requests.post(
                    self.endpoint,
                    headers=headers,
                    json=payload,
                    timeout=self.timeout
                )

                print(f"DEBUG: Response status: {response.status_code}")
                response.raise_for_status()
                
                response_data = response.json()
                
                if 'choices' not in response_data or len(response_data['choices']) == 0:
                    raise ValueError("Invalid response from LLM: No 'choices' field.")
                
                full_content = response_data['choices'][0]['message']['content']
                print(f"DEBUG: Analysis complete, content length: {len(full_content)}")

                # The response should already be JSON, but we parse it to be sure
                return self._parse_real_analysis(full_content, analysis_type=analysis_type)

            except requests.exceptions.RequestException as e:
                print(f"ERROR: Request failed on attempt {attempt+1}: {e}")
                if attempt == self.retry_count - 1:
                    raise  # Re-raise the last exception
                continue # Retry
        
        raise ValueError("All retry attempts exhausted without success")

    def _fix_and_parse_json(self, content: str) -> Optional[Dict]:
        """
        Aggressively finds, cleans, and parses a JSON object from a string,
        including handling truncated JSON.
        """
        # Pattern to find a JSON object within a larger string, including markdown blocks
        json_match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', content, re.DOTALL)
        
        if not json_match:
            print("DEBUG: No JSON object found in the content.")
            return None

        json_str = json_match.group(1) if json_match.group(1) else json_match.group(2)

        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"DEBUG: Initial JSON parsing failed: {e}. Attempting to repair truncated JSON.")
            
            # --- Advanced JSON Repair Logic ---
            repaired_json = self._repair_truncated_json(json_str)
            if repaired_json:
                try:
                    return json.loads(repaired_json)
                except json.JSONDecodeError as final_e:
                    print(f"ERROR: JSON parsing failed even after repair: {final_e}")
                    return None
            else:
                return None

    def _repair_truncated_json(self, s: str) -> Optional[str]:
        """Attempts to repair a truncated JSON string."""
        # 1. Find the last sensible place to cut the string
        last_brace = s.rfind('}')
        last_bracket = s.rfind(']')
        cut_off_index = max(last_brace, last_bracket)
        
        if cut_off_index == -1:
            # No closing brace or bracket found, cannot repair
            return None
            
        truncated_str = s[:cut_off_index + 1]

        # 2. Balance braces and brackets
        open_braces = []
        in_string = False
        
        for char in truncated_str:
            if char == '"':
                in_string = not in_string
            if not in_string:
                if char == '{' or char == '[':
                    open_braces.append(char)
                elif char == '}':
                    if open_braces and open_braces[-1] == '{':
                        open_braces.pop()
                elif char == ']':
                    if open_braces and open_braces[-1] == '[':
                        open_braces.pop()

        # 3. Add closing characters
        while open_braces:
            opener = open_braces.pop()
            if opener == '{':
                truncated_str += '}'
            elif opener == '[':
                truncated_str += ']'
        
        # 4. Final cleanup: remove trailing comma if any
        cleaned_str = re.sub(r',\s*([\}\]])\s*$', r'\1', truncated_str)

        return cleaned_str

    def _parse_real_analysis(self, content: str, analysis_type: str) -> Dict:
        """Parse the LLM response content, which should be a JSON string."""
        print(f"DEBUG: Parsing real {analysis_type} analysis content...")

        parsed_json = self._fix_and_parse_json(content)

        if not parsed_json:
            # If JSON parsing fails completely, we must raise an error as per instructions.
            # We cannot fall back to manual extraction as the new prompts are designed for JSON output.
            error_message = f"Failed to extract a valid JSON object for '{analysis_type}' from the LLM response."
            print(f"ERROR: {error_message}")
            print(f"RAW CONTENT PREVIEW: {content[:500]}")
            raise ValueError(error_message)
            
        print(f"DEBUG: Successfully parsed JSON for {analysis_type}")

        # The new prompts return the entire structure, so we can just return it.
        # We add a bit of metadata for consistency with the web server's expectations.
        return {
            'status': 'success',
            'results': parsed_json,
            'analysis_metadata': {
                'analysis_type': analysis_type,
                'timestamp': datetime.now().isoformat(),
                'provider': 'openrouter'
            },
            'rawContent': content
        }