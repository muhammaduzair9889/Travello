from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import APIException
from django.db import transaction
from .models import Hotel, Booking
from .serializers import HotelSerializer, BookingSerializer, BookingCreateSerializer
from .api_serializers import HotelSearchSerializer
from .services import hotel_api_service
import logging

logger = logging.getLogger(__name__)


class IsStaffUser(IsAuthenticated):
    """
    Custom permission to allow staff users (admins) to access
    """
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_staff


class HotelViewSet(viewsets.ModelViewSet):
    queryset = Hotel.objects.all()
    serializer_class = HotelSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsStaffUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def create(self, request, *args, **kwargs):
        """Create a new hotel with better error handling"""
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search hotels by city, location or name"""
        query = request.query_params.get('q', '')
        city = request.query_params.get('city', '')
        
        hotels = Hotel.objects.all()
        
        if city:
            hotels = hotels.filter(city__icontains=city)
        
        if query:
            hotels = hotels.filter(
                hotel_name__icontains=query
            ) | hotels.filter(
                location__icontains=query
            ) | hotels.filter(
                city__icontains=query
            )
        
        serializer = self.get_serializer(hotels, many=True)
        return Response(serializer.data)


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Users can only see their own bookings"""
        if self.request.user.is_staff:
            return Booking.objects.all()
        return Booking.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return BookingCreateSerializer
        return BookingSerializer
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create a new booking"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Set the user to the current logged-in user
        booking = serializer.save(user=request.user)
        
        # Return full booking details
        response_serializer = BookingSerializer(booking)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def confirm_payment(self, request, pk=None):
        """Confirm payment and update room availability"""
        booking = self.get_object()
        
        if booking.payment_status:
            return Response(
                {'error': 'Payment already confirmed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update payment status
        booking.payment_status = True
        booking.save()
        
        # Decrease available rooms
        hotel = booking.hotel
        hotel.available_rooms -= booking.rooms_booked
        hotel.save()
        
        serializer = self.get_serializer(booking)
        return Response({
            'message': 'Payment confirmed successfully',
            'booking': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def my_bookings(self, request):
        """Get current user's bookings"""
        bookings = Booking.objects.filter(user=request.user)
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)


class RealTimeHotelSearchView(APIView):
    """
    Real-time hotel search API for Lahore, Pakistan
    POST /api/hotels/search-live/
    
    Integrates with Booking.com RapidAPI to fetch live hotel data
    """
    authentication_classes = []  # Disable authentication
    permission_classes = [AllowAny]  # Allow unauthenticated access for hotel search
    
    def post(self, request):
        """
        Search for hotels in Lahore with real-time data
        
        Request Body:
        {
            "check_in": "2025-12-15",
            "check_out": "2025-12-18",
            "adults": 2,
            "children": 1,
            "infants": 0,
            "room_type": "double"
        }
        
        Response:
        {
            "success": true,
            "count": 15,
            "destination": "Lahore, Pakistan",
            "hotels": [...]
        }
        """
        
        # Validate input
        serializer = HotelSearchSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Invalid search parameters: {serializer.errors}")
            return Response(
                {
                    'success': False,
                    'error': 'Invalid search parameters',
                    'details': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract validated data
        validated_data = serializer.validated_data
        check_in = validated_data['check_in'].strftime('%Y-%m-%d')
        check_out = validated_data['check_out'].strftime('%Y-%m-%d')
        adults = validated_data['adults']
        children = validated_data.get('children', 0)
        room_type = validated_data.get('room_type', 'double')
        
        logger.info(f"Hotel search request: {check_in} to {check_out}, {adults} adults, {children} children, {room_type} room")
        
        try:
            # Call hotel API service
            hotels = hotel_api_service.search_lahore_hotels(
                check_in=check_in,
                check_out=check_out,
                adults=adults,
                children=children,
                room_type=room_type
            )
            
            logger.info(f"Successfully fetched {len(hotels)} hotels from API")
            logger.info(f"Hotel IDs: {[h.get('id', 'N/A') for h in hotels[:5]]}")
            
            # Always return hotels array, even if empty
            hotels_list = hotels if hotels else []
            
            logger.info(f"Returning response with {len(hotels_list)} hotels")
            
            # Return success even if no hotels found (valid scenario)
            return Response(
                {
                    'success': True,
                    'count': len(hotels_list),
                    'destination': 'Lahore, Pakistan',
                    'search_params': {
                        'check_in': check_in,
                        'check_out': check_out,
                        'adults': adults,
                        'children': children,
                        'room_type': room_type
                    },
                    'hotels': hotels_list
                },
                status=status.HTTP_200_OK
            )
        
        except APIException as e:
            # Handle API-specific errors
            logger.error(f"Hotel API error: {str(e)}")
            return Response(
                {
                    'success': False,
                    'error': 'Hotel search service error',
                    'message': str(e),
                    'hotels': []
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        except Exception as e:
            # Handle unexpected errors
            logger.error(f"Hotel search failed: {str(e)}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': 'Failed to fetch hotel data',
                    'message': f'An error occurred: {str(e)}',
                    'hotels': []
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )