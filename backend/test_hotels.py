import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.travello_backend.settings')
django.setup()

from hotels.services import HotelAPIService

service = HotelAPIService()
hotels = service._get_comprehensive_lahore_hotels()

print(f'Total hotels: {len(hotels)}')
print(f'\nFirst hotel:')
for key, value in hotels[0].items():
    print(f'  {key}: {value}')

print(f'\nPrice fields check:')
print(f'  single_bed_price_per_day: {hotels[0].get("single_bed_price_per_day")}')
print(f'  double_bed_price_per_day: {hotels[0].get("double_bed_price_per_day")}')
print(f'  triple_bed_price_per_day: {hotels[0].get("triple_bed_price_per_day")}')
print(f'  quad_bed_price_per_day: {hotels[0].get("quad_bed_price_per_day")}')
print(f'  family_room_price_per_day: {hotels[0].get("family_room_price_per_day")}')
