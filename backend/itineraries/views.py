import logging

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .generator import generate_itinerary, ensure_lahore_places_seeded, _normalize_interests, _budget_rank, _score_place, _pick_nearby, _pace_target
from .models import Itinerary, Place
from .serializers import ItinerarySerializer, ItineraryGenerateSerializer, PlaceSerializer

logger = logging.getLogger(__name__)


class PlaceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        city = request.query_params.get('city', 'Lahore')
        ensure_lahore_places_seeded()
        places = Place.objects.filter(city=city).order_by('category', 'name')
        return Response({'success': True, 'count': places.count(), 'places': PlaceSerializer(places, many=True).data})


class ItineraryGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ItineraryGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        itinerary = generate_itinerary(
            user=request.user,
            city=data.get('city', 'Lahore'),
            start_date=data['start_date'],
            end_date=data['end_date'],
            travelers=data.get('travelers', 1),
            budget_level=data.get('budget_level', Itinerary.Budget.MEDIUM),
            interests=data.get('interests', []),
            pace=data.get('pace', Itinerary.Pace.BALANCED),
        )

        return Response({'success': True, 'itinerary': ItinerarySerializer(itinerary).data}, status=status.HTTP_201_CREATED)


class ItineraryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Itinerary.objects.filter(user=request.user).order_by('-created_at')
        return Response({'success': True, 'count': qs.count(), 'itineraries': ItinerarySerializer(qs, many=True).data})


class ItineraryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, itinerary_id):
        itinerary = get_object_or_404(Itinerary, id=itinerary_id, user=request.user)
        return Response({'success': True, 'itinerary': ItinerarySerializer(itinerary).data})

    def patch(self, request, itinerary_id):
        itinerary = get_object_or_404(Itinerary, id=itinerary_id, user=request.user)

        budget_level = request.data.get('budget_level')
        pace = request.data.get('pace')
        interests = request.data.get('interests')
        notes = request.data.get('notes')
        regenerate = bool(request.data.get('regenerate', False))

        with transaction.atomic():
            if budget_level:
                itinerary.budget_level = budget_level
            if pace:
                itinerary.pace = pace
            if interests is not None:
                itinerary.interests = _normalize_interests(interests)
            if notes is not None:
                itinerary.notes = str(notes)

            if regenerate:
                # regenerate full itinerary using updated settings
                regenerated = generate_itinerary(
                    user=request.user,
                    city=itinerary.city,
                    start_date=itinerary.start_date,
                    end_date=itinerary.end_date,
                    travelers=itinerary.travelers,
                    budget_level=itinerary.budget_level,
                    interests=itinerary.interests,
                    pace=itinerary.pace,
                )
                itinerary.days = regenerated.days
                regenerated.delete()

            itinerary.save()

        return Response({'success': True, 'itinerary': ItinerarySerializer(itinerary).data})


def _regenerate_day_items(*, itinerary: Itinerary, day_index: int):
    ensure_lahore_places_seeded()

    interests_tags = _normalize_interests(itinerary.interests)
    budget_cap = _budget_rank(itinerary.budget_level)
    per_day = _pace_target(itinerary.pace)

    used_ids = set()
    for di, day in enumerate(itinerary.days or []):
        if di == day_index:
            continue
        for item in day.get('items', []):
            if item.get('type') == 'place' and item.get('place_id'):
                used_ids.add(item['place_id'])

    candidates = list(Place.objects.filter(city=itinerary.city))
    candidates = [p for p in candidates if _budget_rank(p.budget_level) <= budget_cap and p.id not in used_ids]
    candidates.sort(key=lambda p: _score_place(p, interests_tags), reverse=True)

    major = None
    for p in candidates:
        if p.estimated_visit_minutes >= 120 or p.category in ('History', 'Religious', 'Culture'):
            major = p
            break
    picked = []
    if major:
        picked.append(major)
        rest = [p for p in candidates if p.id != major.id]
        picked.extend(_pick_nearby(major, rest, k=max(0, per_day - 1)))
    while len(picked) < per_day:
        for p in candidates:
            if p in picked:
                continue
            picked.append(p)
            break
        else:
            break

    items = []
    for idx, p in enumerate(picked[:per_day]):
        slot = 'morning' if idx == 0 else ('afternoon' if idx < max(2, per_day - 1) else 'evening')
        items.append(
            {
                'type': 'place',
                'slot': slot,
                'place_id': p.id,
                'name': p.name,
                'category': p.category,
                'estimated_visit_minutes': p.estimated_visit_minutes,
                'budget_level': p.budget_level,
                'latitude': p.latitude,
                'longitude': p.longitude,
                'average_rating': p.average_rating,
                'ideal_hours': {'start': p.ideal_start_hour, 'end': p.ideal_end_hour},
            }
        )
    return items


class ItineraryRegenerateDayView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, itinerary_id):
        itinerary = get_object_or_404(Itinerary, id=itinerary_id, user=request.user)
        day_index = int(request.data.get('day_index', -1))
        if day_index < 0 or day_index >= len(itinerary.days or []):
            return Response({'success': False, 'error': 'Invalid day_index'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            itinerary.days[day_index]['items'] = _regenerate_day_items(itinerary=itinerary, day_index=day_index)
            itinerary.save(update_fields=['days', 'updated_at'])

        return Response({'success': True, 'itinerary': ItinerarySerializer(itinerary).data})


class ItineraryReplacePlaceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, itinerary_id):
        itinerary = get_object_or_404(Itinerary, id=itinerary_id, user=request.user)
        day_index = int(request.data.get('day_index', -1))
        item_index = int(request.data.get('item_index', -1))
        new_place_id = request.data.get('new_place_id')

        if day_index < 0 or day_index >= len(itinerary.days or []):
            return Response({'success': False, 'error': 'Invalid day_index'}, status=status.HTTP_400_BAD_REQUEST)
        items = itinerary.days[day_index].get('items', [])
        if item_index < 0 or item_index >= len(items):
            return Response({'success': False, 'error': 'Invalid item_index'}, status=status.HTTP_400_BAD_REQUEST)
        if items[item_index].get('type') != 'place':
            return Response({'success': False, 'error': 'Only place items can be replaced'}, status=status.HTTP_400_BAD_REQUEST)

        ensure_lahore_places_seeded()

        if new_place_id:
            new_place = get_object_or_404(Place, id=new_place_id, city=itinerary.city)
        else:
            # Auto-pick a replacement from same category within budget not already used
            old_category = items[item_index].get('category')
            budget_cap = _budget_rank(itinerary.budget_level)
            used = set()
            for day in itinerary.days or []:
                for it in day.get('items', []):
                    if it.get('type') == 'place' and it.get('place_id'):
                        used.add(it['place_id'])
            qs = Place.objects.filter(city=itinerary.city, category=old_category)
            qs = [p for p in qs if _budget_rank(p.budget_level) <= budget_cap and p.id not in used]
            qs.sort(key=lambda p: p.average_rating or 0, reverse=True)
            if not qs:
                return Response({'success': False, 'error': 'No replacement place available'}, status=status.HTTP_400_BAD_REQUEST)
            new_place = qs[0]

        new_item = {
            'type': 'place',
            'slot': items[item_index].get('slot'),
            'place_id': new_place.id,
            'name': new_place.name,
            'category': new_place.category,
            'estimated_visit_minutes': new_place.estimated_visit_minutes,
            'budget_level': new_place.budget_level,
            'latitude': new_place.latitude,
            'longitude': new_place.longitude,
            'average_rating': new_place.average_rating,
            'ideal_hours': {'start': new_place.ideal_start_hour, 'end': new_place.ideal_end_hour},
        }

        with transaction.atomic():
            itinerary.days[day_index]['items'][item_index] = new_item
            itinerary.save(update_fields=['days', 'updated_at'])

        return Response({'success': True, 'itinerary': ItinerarySerializer(itinerary).data})


class ItineraryRemovePlaceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, itinerary_id):
        itinerary = get_object_or_404(Itinerary, id=itinerary_id, user=request.user)
        day_index = int(request.data.get('day_index', -1))
        item_index = int(request.data.get('item_index', -1))

        if day_index < 0 or day_index >= len(itinerary.days or []):
            return Response({'success': False, 'error': 'Invalid day_index'}, status=status.HTTP_400_BAD_REQUEST)
        items = itinerary.days[day_index].get('items', [])
        if item_index < 0 or item_index >= len(items):
            return Response({'success': False, 'error': 'Invalid item_index'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            itinerary.days[day_index]['items'].pop(item_index)
            itinerary.save(update_fields=['days', 'updated_at'])

        return Response({'success': True, 'itinerary': ItinerarySerializer(itinerary).data})

