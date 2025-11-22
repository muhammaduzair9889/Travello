import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def get_ai_response(message):
    """Get response from OpenAI's GPT model with fallback responses."""
    
    # Check if OpenAI API key is configured
    if not hasattr(settings, 'OPENAI_API_KEY') or not settings.OPENAI_API_KEY:
        logger.warning("OpenAI API key not configured")
        return {
            'status': 'success',
            'reply': get_fallback_response(message)
        }
    
    try:
        # Try to import and use OpenAI
        try:
            # Try new OpenAI v1.0+ syntax
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            
            system_prompt = """You are a helpful travel assistant for Travello, a travel booking platform. 
            You can help with:
            - Hotel and flight recommendations
            - Travel tips and destination information
            - Booking assistance
            - Travel safety and requirements
            Be friendly, informative, and helpful. Keep responses concise but detailed enough to be useful."""
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            return {
                'status': 'success',
                'reply': response.choices[0].message.content.strip()
            }
            
        except ImportError:
            # Fall back to old OpenAI syntax
            import openai
            openai.api_key = settings.OPENAI_API_KEY
            
            system_prompt = """You are a helpful travel assistant for Travello, a travel booking platform. 
            You can help with:
            - Hotel and flight recommendations
            - Travel tips and destination information
            - Booking assistance
            - Travel safety and requirements
            Be friendly, informative, and helpful. Keep responses concise but detailed enough to be useful."""
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            return {
                'status': 'success',
                'reply': response.choices[0].message.content.strip()
            }
            
    except Exception as e:
        logger.error(f"Error in AI service: {str(e)}")
        # Return fallback response instead of error
        return {
            'status': 'success',
            'reply': get_fallback_response(message)
        }


def get_fallback_response(message):
    """Provide intelligent fallback responses when AI is not available."""
    message_lower = message.lower()
    
    # Hotel related queries
    if any(word in message_lower for word in ['hotel', 'accommodation', 'stay', 'room']):
        return """I can help you find hotels! 🏨
        
To search for hotels:
1. Go to the Hotels section in the dashboard
2. Enter your destination
3. Select check-in and check-out dates
4. Choose number of guests and room type
5. Click 'Search Hotels' to see available options

Popular destinations: Dubai, London, Paris, New York, Bangkok, Singapore"""
    
    # Flight related queries
    elif any(word in message_lower for word in ['flight', 'fly', 'plane', 'airline']):
        return """I can assist with flight bookings! ✈️
        
To search for flights:
1. Navigate to the Flights section
2. Enter departure and destination cities
3. Select travel dates
4. Choose number of passengers
5. Search for available flights

Tip: Book in advance for better prices!"""
    
    # Sightseeing/activities
    elif any(word in message_lower for word in ['sightseeing', 'tour', 'activity', 'attraction', 'visit', 'see']):
        return """Discover amazing places! 🗺️
        
Check out our Sightseeing section for:
- Popular tourist attractions
- Local tours and activities
- Cultural experiences
- Adventure activities
- Food tours

Each destination has unique experiences waiting for you!"""
    
    # Booking management
    elif any(word in message_lower for word in ['booking', 'reservation', 'manage', 'cancel', 'modify']):
        return """Manage your bookings easily! 📋
        
In the Bookings section you can:
- View all your reservations
- Check booking details
- Modify or cancel bookings
- Download booking confirmations
- Contact support for assistance

Your travel plans, all in one place!"""
    
    # Greeting
    elif any(word in message_lower for word in ['hello', 'hi', 'hey', 'greetings']):
        return """Hello! 👋 Welcome to Travello!

I'm here to help you with:
✈️ Flight bookings
🏨 Hotel reservations
🗺️ Sightseeing tours
📋 Managing your bookings

What would you like to explore today?"""
    
    # Help/general
    elif any(word in message_lower for word in ['help', 'assist', 'support', 'how']):
        return """I'm here to help! 🤝

Travello offers:
🏨 Hotels - Find and book accommodations worldwide
✈️ Flights - Search and book flights easily
🗺️ Sightseeing - Discover tours and activities
📋 Bookings - Manage all your reservations

Use the dashboard to explore these features. What can I help you with?"""
    
    # Default response
    else:
        return """Thank you for your message! 😊

I'm Travello Assistant, here to help with your travel needs:
- Hotel bookings
- Flight reservations
- Sightseeing tours
- Travel planning

Please use the dashboard features to search and book, or ask me specific questions about hotels, flights, or activities!

What would you like to know?"""