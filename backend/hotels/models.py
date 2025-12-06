from django.db import models
from authentication.models import User


class Hotel(models.Model):
    hotel_name = models.CharField(max_length=255)
    city = models.CharField(max_length=100, default='Unknown')
    location = models.CharField(max_length=255)
    total_rooms = models.IntegerField()
    available_rooms = models.IntegerField()
    single_bed_price_per_day = models.DecimalField(max_digits=10, decimal_places=2)
    family_room_price_per_day = models.DecimalField(max_digits=10, decimal_places=2)
    wifi_available = models.BooleanField(default=False)
    parking_available = models.BooleanField(default=False)
    description = models.TextField()
    image = models.URLField(max_length=500, blank=True, null=True)
    rating = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'hotels_hotel'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.hotel_name


class Booking(models.Model):
    ROOM_TYPE_CHOICES = [
        ('single', 'Single'),
        ('double', 'Double'),
        ('triple', 'Triple'),
        ('quad', 'Quad'),
        ('family', 'Family'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hotel_bookings')
    hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE, related_name='bookings')
    room_type = models.CharField(max_length=10, choices=ROOM_TYPE_CHOICES)
    rooms_booked = models.IntegerField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    check_in_date = models.DateField()
    check_out_date = models.DateField()
    payment_status = models.BooleanField(default=False)
    booking_date = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'hotels_booking'
        ordering = ['-booking_date']
    
    def __str__(self):
        return f"{self.user.email} - {self.hotel.hotel_name} - {self.room_type}"