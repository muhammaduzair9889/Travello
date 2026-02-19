import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Lazy import emotion service
_emotion_service = None
_EMOTION_SERVICE_AVAILABLE = True


def _get_emotion_service():
    """Lazy load emotion service on first use."""
    global _emotion_service, _EMOTION_SERVICE_AVAILABLE

    if _emotion_service is not None:
        return _emotion_service

    try:
        from .emotion_service import emotion_service
        _emotion_service = emotion_service
        _EMOTION_SERVICE_AVAILABLE = True
        return _emotion_service
    except Exception as e:
        logger.warning(f"Could not import emotion service: {e}")
        _EMOTION_SERVICE_AVAILABLE = False
        return None


# ---------------------------------------------------------------------------
# Request classification
# ---------------------------------------------------------------------------

TEXT_PROCESSING_TYPES = {
    'grammar': [
        'correct the grammar', 'fix grammar', 'fix spelling', 'fix punctuation',
        'grammar and spelling', 'spelling and punctuation', 'correct spelling',
        'proofread', 'correct the text', 'fix the text', 'grammar check',
    ],
    'enhance': [
        'enhance', 'improve', 'make it better', 'rewrite', 'polish',
        'make it more descriptive', 'make it more engaging', 'improve writing',
        'enhance writing', 'better wording',
    ],
    'summarize': [
        'summarize', 'summary', 'shorten', 'make it shorter', 'brief version',
        'tldr', 'condense', 'key points',
    ],
    'expand': [
        'expand', 'add details', 'elaborate', 'make it longer',
        'more detail', 'more descriptive', 'add more', 'flesh out',
        'vivid descriptions', 'sensory details',
    ],
}


def _classify_request(message: str):
    """Return ('text_processing', kind) or ('chat', None)."""
    msg_lower = message.lower()

    for kind, keywords in TEXT_PROCESSING_TYPES.items():
        if any(kw in msg_lower for kw in keywords):
            return 'text_processing', kind

    return 'chat', None


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def _build_text_processing_prompt(message: str, kind: str) -> tuple:
    """Build Gemini system instruction + contents for text-processing requests."""
    system_instructions = {
        'grammar': (
            "You are a precise proofreader. "
            "Correct all grammar, spelling, and punctuation errors in the user's text. "
            "Return ONLY the corrected text — no explanations, no commentary, no quotes around it. "
            "Preserve the original tone, meaning, and paragraph structure."
        ),
        'enhance': (
            "You are a skilled writing editor. "
            "Enhance the user's text to be more vivid, engaging, and well-written. "
            "Keep the original meaning and facts intact. "
            "Return ONLY the enhanced text — no explanations, no commentary, no quotes around it."
        ),
        'summarize': (
            "You are a concise summarizer. "
            "Provide a clear, brief summary of the user's text. "
            "Capture the key points in 2-4 sentences. "
            "Return ONLY the summary — no labels, no prefixes like 'Summary:', no extra commentary."
        ),
        'expand': (
            "You are a creative travel writer. "
            "Expand the user's text with richer descriptions, sensory details, and vivid imagery. "
            "Stay faithful to the original content and facts. "
            "Return ONLY the expanded text — no explanations, no commentary, no quotes around it."
        ),
    }

    system_text = system_instructions.get(kind, system_instructions['grammar'])
    contents = [{"parts": [{"text": message}]}]
    return system_text, contents


def _build_chat_prompt(message: str, detected_emotion=None, emotion_confidence=0.0) -> tuple:
    """Build Gemini system instruction + contents for travel-chat requests."""

    emotion_hint = ""
    if detected_emotion and emotion_confidence > 0.4:
        emotion_map = {
            'stress': "The user seems stressed — be calming and suggest relaxing destinations or activities.",
            'anxiety': "The user seems anxious — be reassuring, suggest peaceful places.",
            'joy': "The user is in a great mood — match their energy, suggest exciting experiences.",
            'sadness': "The user seems down — be warm and empathetic, suggest uplifting experiences.",
            'disappointment': "The user seems disappointed — be understanding, offer helpful alternatives.",
            'anger': "The user seems frustrated — be patient and understanding, suggest calming getaways.",
            'fear': "The user seems nervous — be reassuring, provide safety tips and reliable recommendations.",
            'surprise': "The user is surprised — engage their curiosity with interesting facts and suggestions.",
            'neutral': "",
        }
        emotion_hint = emotion_map.get(detected_emotion, "")

    system_text = f"""You are the Travello travel assistant — friendly, knowledgeable, and concise.

ABOUT TRAVELLO:
- Travel booking platform with Hotels, Flights, Sightseeing, Bookings, and Journal sections.
- Covers Lahore, Karachi, Islamabad and international destinations.
- Users search hotels by dates, guests, and room type. Prices in PKR.

RESPONSE STYLE:
- Be natural and conversational — like a helpful friend who knows travel well.
- Keep answers short (2-4 sentences for simple questions, up to a short paragraph for complex ones).
- Use markdown sparingly: bold for hotel/place names, bullet points only when listing 3+ items.
- Do NOT overuse emojis — at most one per response, and only if it feels natural.
- Never start with "Great question!" or similar filler.
- If you don't know something specific, say so honestly and suggest how the user can find out.
- For hotel/flight/booking questions, guide users to the relevant section on the platform.
{f"EMOTIONAL CONTEXT: {emotion_hint}" if emotion_hint else ""}"""

    contents = [{"parts": [{"text": message}]}]
    return system_text, contents


# ---------------------------------------------------------------------------
# Gemini API call
# ---------------------------------------------------------------------------

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


def _call_gemini(system_instruction: str, contents: list, temperature: float = 0.7, max_tokens: int = 1024) -> str:
    """Make a single Gemini API call and return the text response."""
    gemini_api_key = getattr(settings, 'GEMINI_API_KEY', '')
    if not gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured. Set it in your .env file.")

    payload = {
        "system_instruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }

    response = requests.post(
        f"{GEMINI_API_URL}?key={gemini_api_key}",
        headers={'Content-Type': 'application/json'},
        json=payload,
        timeout=30,
    )

    logger.info(f"Gemini API response status: {response.status_code}")

    if response.status_code != 200:
        logger.error(f"Gemini API error: {response.text[:300]}")
        raise Exception(f"Gemini API returned status {response.status_code}")

    data = response.json()

    if 'candidates' not in data or not data['candidates']:
        logger.error(f"No candidates in Gemini response: {data}")
        raise Exception("No response candidates from Gemini API")

    return data['candidates'][0]['content']['parts'][0]['text'].strip()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def get_ai_response(message: str) -> dict:
    """Main entry point — detect emotion, classify request, call Gemini."""

    # 1. Detect emotion
    detected_emotion = None
    emotion_confidence = 0.0

    emotion_service = _get_emotion_service()
    if emotion_service and _EMOTION_SERVICE_AVAILABLE:
        try:
            detected_emotion, emotion_confidence = emotion_service.detect_emotion(message)
            logger.info(f"Detected emotion: {detected_emotion} (confidence: {emotion_confidence:.2f})")
        except Exception as e:
            logger.warning(f"Emotion detection failed: {e}")

    # 2. Classify request
    request_type, processing_kind = _classify_request(message)
    logger.info(f"Request classified: {request_type}" + (f" ({processing_kind})" if processing_kind else ""))

    # 3. Build prompt and call Gemini
    try:
        if request_type == 'text_processing':
            system_instruction, contents = _build_text_processing_prompt(message, processing_kind)
            # Lower temperature for grammar/summarize (precision), higher for enhance/expand (creativity)
            temp = 0.3 if processing_kind in ('grammar', 'summarize') else 0.8
            max_tok = 512 if processing_kind == 'summarize' else 2048
            reply = _call_gemini(system_instruction, contents, temperature=temp, max_tokens=max_tok)
        else:
            system_instruction, contents = _build_chat_prompt(message, detected_emotion, emotion_confidence)
            reply = _call_gemini(system_instruction, contents, temperature=0.7, max_tokens=1024)

        result = {
            'status': 'success',
            'reply': reply,
            'model': 'gemini-2.5-flash',
        }

        if detected_emotion and emotion_confidence > 0.4:
            result['emotion_detected'] = detected_emotion
            result['confidence'] = round(emotion_confidence, 2)

        return result

    except Exception as e:
        logger.error(f"Gemini API failed: {e}")
        return {
            'status': 'success',
            'reply': "I'm having trouble connecting right now. Please try again in a moment.",
            'emotion_detected': detected_emotion if emotion_confidence > 0.4 else None,
            'confidence': round(emotion_confidence, 2) if emotion_confidence > 0.4 else None,
        }