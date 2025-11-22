from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.db import transaction
from .models import Hotel, Booking
from .serializers import HotelSerializer, BookingSerializer, BookingCreateSerializer


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