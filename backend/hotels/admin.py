from django.contrib import admin
from .models import Hotel, Booking


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ('hotel_name', 'city', 'location', 'total_rooms', 'available_rooms', 'rating', 'created_at')
    list_filter = ('wifi_available', 'parking_available', 'city', 'location')
    search_fields = ('hotel_name', 'city', 'location', 'description')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('hotel_name', 'city', 'location', 'description', 'image', 'rating')
        }),
        ('Room Details', {
            'fields': ('total_rooms', 'available_rooms', 'single_bed_price_per_day', 'family_room_price_per_day')
        }),
        ('Amenities', {
            'fields': ('wifi_available', 'parking_available')
        }),
    )


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('user', 'hotel', 'room_type', 'rooms_booked', 'check_in_date', 'check_out_date', 'payment_status', 'booking_date')
    list_filter = ('payment_status', 'room_type', 'booking_date')
    search_fields = ('user__email', 'hotel__hotel_name')
    ordering = ('-booking_date',)
    readonly_fields = ('booking_date',)
    
    fieldsets = (
        ('Booking Information', {
            'fields': ('user', 'hotel', 'room_type', 'rooms_booked')
        }),
        ('Dates', {
            'fields': ('check_in_date', 'check_out_date', 'booking_date')
        }),
        ('Payment', {
            'fields': ('total_price', 'payment_status')
        }),
    )