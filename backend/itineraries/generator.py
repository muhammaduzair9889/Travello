import math
from datetime import timedelta

from django.db import transaction

from .models import Place, Itinerary


INTEREST_TAGS = {
    'history': 'history',
    'culture': 'culture',
    'food': 'food',
    'shopping': 'shopping',
    'nature': 'nature',
    'religious sites': 'religious',
    'religious': 'religious',
    'modern attractions': 'modern',
    'modern': 'modern',
}


DEFAULT_LAHORE_PLACES = [
    # History / Culture
    dict(name='Badshahi Mosque', category='Religious', tags=['religious', 'history', 'culture'], minutes=120, budget='LOW', lat=31.5881, lon=74.3106, rating=4.8, start=8, end=18),
    dict(name='Lahore Fort', category='History', tags=['history', 'culture'], minutes=150, budget='LOW', lat=31.5887, lon=74.3133, rating=4.7, start=9, end=17),
    dict(name='Shalimar Gardens', category='Nature', tags=['nature', 'history', 'culture'], minutes=120, budget='LOW', lat=31.5840, lon=74.3816, rating=4.6, start=9, end=18),
    dict(name='Minar-e-Pakistan', category='History', tags=['history', 'culture'], minutes=75, budget='LOW', lat=31.5925, lon=74.3095, rating=4.6, start=9, end=21),
    dict(name='Lahore Museum', category='Culture', tags=['culture', 'history'], minutes=120, budget='LOW', lat=31.5696, lon=74.3096, rating=4.5, start=9, end=17),
    dict(name='Walled City (Delhi Gate Area)', category='Culture', tags=['culture', 'history', 'food'], minutes=150, budget='LOW', lat=31.5822, lon=74.3150, rating=4.6, start=10, end=22),

    # Shopping
    dict(name='Anarkali Bazaar', category='Shopping', tags=['shopping', 'culture', 'food'], minutes=120, budget='LOW', lat=31.5690, lon=74.3173, rating=4.4, start=11, end=22),
    dict(name='Liberty Market (Gulberg)', category='Shopping', tags=['shopping', 'modern', 'food'], minutes=120, budget='MEDIUM', lat=31.5216, lon=74.3539, rating=4.4, start=12, end=23),
    dict(name='Emporium Mall', category='Shopping', tags=['shopping', 'modern', 'food'], minutes=150, budget='MEDIUM', lat=31.4697, lon=74.2710, rating=4.6, start=12, end=23),
    dict(name='Packages Mall', category='Shopping', tags=['shopping', 'modern', 'food'], minutes=150, budget='MEDIUM', lat=31.4712, lon=74.3560, rating=4.6, start=12, end=23),

    # Nature / Parks
    dict(name='Jilani Park (Race Course Park)', category='Nature', tags=['nature', 'relaxed'], minutes=90, budget='LOW', lat=31.5282, lon=74.3339, rating=4.5, start=7, end=21),
    dict(name='Greater Iqbal Park', category='Nature', tags=['nature', 'culture'], minutes=90, budget='LOW', lat=31.5925, lon=74.3096, rating=4.6, start=7, end=22),

    # Modern / Attractions
    dict(name='Wagah Border Ceremony', category='Modern', tags=['modern', 'culture'], minutes=150, budget='LOW', lat=31.6042, lon=74.5750, rating=4.7, start=15, end=19),
    dict(name='Lahore Zoo', category='Nature', tags=['nature', 'family'], minutes=120, budget='LOW', lat=31.5582, lon=74.3344, rating=4.1, start=9, end=17),

    # Food spots
    dict(name='Gawalmandi Food Street', category='Food', tags=['food', 'culture'], minutes=120, budget='LOW', lat=31.5807, lon=74.3171, rating=4.4, start=18, end=23),
    dict(name='MM Alam Road (Food)', category='Food', tags=['food', 'modern'], minutes=120, budget='LUXURY', lat=31.5092, lon=74.3443, rating=4.5, start=18, end=23),
]


def ensure_lahore_places_seeded():
    if Place.objects.filter(city='Lahore').exists():
        return
    objs = []
    for p in DEFAULT_LAHORE_PLACES:
        objs.append(
            Place(
                city='Lahore',
                name=p['name'],
                category=p['category'],
                tags=p['tags'],
                estimated_visit_minutes=p['minutes'],
                budget_level=p['budget'],
                latitude=p['lat'],
                longitude=p['lon'],
                average_rating=p['rating'],
                ideal_start_hour=p['start'],
                ideal_end_hour=p['end'],
            )
        )
    Place.objects.bulk_create(objs, ignore_conflicts=True)


def _budget_rank(level: str) -> int:
    return {'LOW': 1, 'MEDIUM': 2, 'LUXURY': 3}.get(level or 'MEDIUM', 2)


def haversine_km(a_lat, a_lon, b_lat, b_lon):
    r = 6371.0
    p1 = math.radians(a_lat)
    p2 = math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lon - a_lon)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(x)))


def _pace_target(pace: str) -> int:
    if pace == Itinerary.Pace.RELAXED:
        return 3
    if pace == Itinerary.Pace.PACKED:
        return 7
    return 5  # balanced


def _normalize_interests(interests):
    out = []
    for i in interests or []:
        key = str(i).strip().lower()
        tag = INTEREST_TAGS.get(key, key)
        if tag and tag not in out:
            out.append(tag)
    return out


def _score_place(place: Place, interests_tags):
    if not interests_tags:
        return place.average_rating
    tags = set([t.lower() for t in (place.tags or [])])
    overlap = len(tags.intersection(set(interests_tags)))
    return overlap * 10 + (place.average_rating or 0)


def _pick_nearby(seed_place: Place, candidates, k):
    scored = []
    for p in candidates:
        d = haversine_km(seed_place.latitude, seed_place.longitude, p.latitude, p.longitude)
        scored.append((d, p))
    scored.sort(key=lambda x: x[0])
    return [p for _, p in scored[:k]]


def generate_itinerary(*, user, city: str, start_date, end_date, travelers: int, budget_level: str, interests, pace: str):
    ensure_lahore_places_seeded()

    interests_tags = _normalize_interests(interests)
    budget_cap = _budget_rank(budget_level)

    places = list(Place.objects.filter(city=city))
    places = [p for p in places if _budget_rank(p.budget_level) <= budget_cap]

    # Rank by interests (and rating)
    places.sort(key=lambda p: _score_place(p, interests_tags), reverse=True)

    days_count = (end_date - start_date).days
    days_count = max(1, days_count)

    per_day = _pace_target(pace)
    used_ids = set()

    days = []
    current_date = start_date
    for day_idx in range(days_count):
        day_places = []

        # Seed: choose best not-yet-used "major" place first
        major = None
        for p in places:
            if p.id in used_ids:
                continue
            if p.estimated_visit_minutes >= 120 or p.category in ('History', 'Religious', 'Culture'):
                major = p
                break

        if major:
            used_ids.add(major.id)
            day_places.append(major)

            # Fill nearby mid-attractions (distance optimization)
            remaining = [p for p in places if p.id not in used_ids]
            nearby = _pick_nearby(major, remaining, k=max(0, per_day - 1))
            for p in nearby:
                used_ids.add(p.id)
                day_places.append(p)

        # If still not enough, just top-rank fill
        if len(day_places) < per_day:
            for p in places:
                if p.id in used_ids:
                    continue
                used_ids.add(p.id)
                day_places.append(p)
                if len(day_places) >= per_day:
                    break

        # Ensure an evening food/shopping spot if user likes it
        wants_evening = ('food' in interests_tags) or ('shopping' in interests_tags)
        if wants_evening:
            has_evening = any(p.category in ('Food', 'Shopping') for p in day_places)
            if not has_evening:
                for p in places:
                    if p.id in used_ids:
                        continue
                    if p.category in ('Food', 'Shopping'):
                        used_ids.add(p.id)
                        if day_places:
                            day_places[-1] = p  # replace last slot to keep pace count
                        else:
                            day_places.append(p)
                        break

        items = []
        for idx, p in enumerate(day_places):
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

        days.append(
            {
                'date': current_date.isoformat(),
                'title': f"Day {day_idx + 1} - {city}",
                'items': items,
            }
        )
        current_date = current_date + timedelta(days=1)

    with transaction.atomic():
        itinerary = Itinerary.objects.create(
            user=user,
            city=city,
            start_date=start_date,
            end_date=end_date,
            travelers=max(1, int(travelers or 1)),
            budget_level=budget_level,
            interests=interests_tags,
            pace=pace,
            days=days,
            saved=True,
        )

    return itinerary

