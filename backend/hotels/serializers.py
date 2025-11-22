from rest_framework import serializers
from .models import Hotel, Booking
from authentication.serializers import UserSerializer


class HotelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hotel
        fields = '__all__'
        read_only_fields = ('created_at',)


class BookingSerializer(serializers.ModelSerializer):
    hotel_details = HotelSerializer(source='hotel', read_only=True)
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ('booking_date', 'user')
    
    def validate(self, attrs):
        hotel = attrs.get('hotel')
        rooms_booked = attrs.get('rooms_booked')
        check_in_date = attrs.get('check_in_date')
        check_out_date = attrs.get('check_out_date')
        
        # Validate room availability
        if rooms_booked > hotel.available_rooms:
            raise serializers.ValidationError(
                f"Only {hotel.available_rooms} rooms available. Cannot book {rooms_booked} rooms."
            )
        
        # Validate dates
        if check_out_date <= check_in_date:
            raise serializers.ValidationError(
                "Check-out date must be after check-in date."
            )
        
        return attrs


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ('hotel', 'room_type', 'rooms_booked', 'check_in_date', 'check_out_date', 'total_price')
    
    def validate(self, attrs):
        hotel = attrs.get('hotel')
        rooms_booked = attrs.get('rooms_booked')
        check_in_date = attrs.get('check_in_date')
        check_out_date = attrs.get('check_out_date')
        
        # Validate room availability
        if rooms_booked > hotel.available_rooms:
            raise serializers.ValidationError(
                f"Only {hotel.available_rooms} rooms available. Cannot book {rooms_booked} rooms."
            )
        
        # Validate dates
        if check_out_date <= check_in_date:
            raise serializers.ValidationError(
                "Check-out date must be after check-in date."
            )
        
        return attrs