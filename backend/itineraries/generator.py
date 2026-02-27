import math
import random
from datetime import timedelta

from django.db import transaction

from .models import Place, Itinerary


# ── Mapping from user-facing interest/mood strings to internal tags ──

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
    # Mood tags
    'relaxing': 'relaxing',
    'spiritual': 'spiritual',
    'historical': 'historical',
    'foodie': 'foodie',
    'fun': 'fun',
    'entertainment': 'entertainment',
    'romantic': 'romantic',
    'family': 'family',
}

# Mood → matching tags (highest weight in scoring)
MOOD_TAG_MAP = {
    'RELAXING':    ['relaxing', 'nature'],
    'SPIRITUAL':   ['spiritual', 'religious'],
    'HISTORICAL':  ['historical', 'history', 'culture'],
    'FOODIE':      ['foodie', 'food'],
    'FUN':         ['fun', 'entertainment', 'modern'],
    'SHOPPING':    ['shopping', 'modern'],
    'NATURE':      ['nature', 'relaxing'],
    'ROMANTIC':    ['romantic', 'nature', 'food'],
    'FAMILY':      ['family', 'fun', 'nature'],
}


DEFAULT_LAHORE_PLACES = [
    # History / Culture - Historical, Spiritual
    dict(name='Badshahi Mosque', category='Religious', tags=['religious', 'spiritual', 'history', 'historical', 'culture'], minutes=120, budget='LOW', lat=31.5881, lon=74.3106, rating=4.8, start=8, end=18, popularity=95),
    dict(name='Lahore Fort', category='History', tags=['history', 'historical', 'culture'], minutes=150, budget='LOW', lat=31.5887, lon=74.3133, rating=4.7, start=9, end=17, popularity=93),
    dict(name='Shalimar Gardens', category='Nature', tags=['nature', 'relaxing', 'history', 'historical', 'culture', 'romantic'], minutes=120, budget='LOW', lat=31.5840, lon=74.3816, rating=4.6, start=9, end=18, popularity=88),
    dict(name='Minar-e-Pakistan', category='History', tags=['history', 'historical', 'culture'], minutes=75, budget='LOW', lat=31.5925, lon=74.3095, rating=4.6, start=9, end=21, popularity=90),
    dict(name='Lahore Museum', category='Culture', tags=['culture', 'history', 'historical'], minutes=120, budget='LOW', lat=31.5696, lon=74.3096, rating=4.5, start=9, end=17, popularity=80),
    dict(name='Walled City (Delhi Gate Area)', category='Culture', tags=['culture', 'history', 'historical', 'food', 'foodie'], minutes=150, budget='LOW', lat=31.5822, lon=74.3150, rating=4.6, start=10, end=22, popularity=87),
    dict(name='Data Darbar', category='Religious', tags=['religious', 'spiritual', 'culture'], minutes=90, budget='LOW', lat=31.5725, lon=74.3127, rating=4.5, start=6, end=22, popularity=85),
    dict(name='Tomb of Jahangir', category='History', tags=['history', 'historical', 'culture', 'relaxing'], minutes=90, budget='LOW', lat=31.6176, lon=74.2960, rating=4.4, start=9, end=17, popularity=75),

    # Shopping
    dict(name='Anarkali Bazaar', category='Shopping', tags=['shopping', 'culture', 'food', 'foodie'], minutes=120, budget='LOW', lat=31.5690, lon=74.3173, rating=4.4, start=11, end=22, popularity=82),
    dict(name='Liberty Market (Gulberg)', category='Shopping', tags=['shopping', 'modern', 'food', 'foodie'], minutes=120, budget='MEDIUM', lat=31.5216, lon=74.3539, rating=4.4, start=12, end=23, popularity=78),
    dict(name='Emporium Mall', category='Shopping', tags=['shopping', 'modern', 'food', 'family', 'fun', 'entertainment'], minutes=150, budget='MEDIUM', lat=31.4697, lon=74.2710, rating=4.6, start=12, end=23, popularity=85),
    dict(name='Packages Mall', category='Shopping', tags=['shopping', 'modern', 'food', 'family', 'fun'], minutes=150, budget='MEDIUM', lat=31.4712, lon=74.3560, rating=4.6, start=12, end=23, popularity=83),
    dict(name='Fortress Square Mall', category='Shopping', tags=['shopping', 'modern', 'fun', 'family'], minutes=120, budget='MEDIUM', lat=31.5197, lon=74.3760, rating=4.3, start=12, end=23, popularity=72),

    # Nature / Parks - Relaxing, Nature, Romantic
    dict(name='Jilani Park (Race Course Park)', category='Nature', tags=['nature', 'relaxing', 'romantic', 'family'], minutes=90, budget='LOW', lat=31.5282, lon=74.3339, rating=4.5, start=7, end=21, popularity=80),
    dict(name='Greater Iqbal Park', category='Nature', tags=['nature', 'relaxing', 'romantic'], minutes=90, budget='LOW', lat=31.5925, lon=74.3096, rating=4.6, start=7, end=22, popularity=82),
    dict(name='Model Town Park', category='Nature', tags=['nature', 'relaxing', 'family'], minutes=60, budget='LOW', lat=31.4828, lon=74.3196, rating=4.2, start=7, end=21, popularity=60),
    dict(name='Bagh-e-Jinnah (Lawrence Gardens)', category='Nature', tags=['nature', 'relaxing', 'romantic', 'family'], minutes=90, budget='LOW', lat=31.5558, lon=74.3397, rating=4.5, start=7, end=20, popularity=78),

    # Modern / Attractions - Fun, Entertainment
    dict(name='Wagah Border Ceremony', category='Modern', tags=['modern', 'fun', 'entertainment', 'culture'], minutes=150, budget='LOW', lat=31.6042, lon=74.5750, rating=4.7, start=15, end=19, popularity=92),
    dict(name='Lahore Zoo', category='Nature', tags=['nature', 'family', 'fun'], minutes=120, budget='LOW', lat=31.5582, lon=74.3344, rating=4.1, start=9, end=17, popularity=65),
    dict(name='Joyland Amusement Park', category='Modern', tags=['fun', 'entertainment', 'family'], minutes=180, budget='LOW', lat=31.5165, lon=74.3483, rating=4.0, start=16, end=23, popularity=60),

    # Food spots - Foodie
    dict(name='Gawalmandi Food Street', category='Food', tags=['food', 'foodie', 'culture', 'romantic'], minutes=120, budget='LOW', lat=31.5807, lon=74.3171, rating=4.4, start=18, end=23, popularity=86),
    dict(name='MM Alam Road (Food)', category='Food', tags=['food', 'foodie', 'modern', 'romantic'], minutes=120, budget='LUXURY', lat=31.5092, lon=74.3443, rating=4.5, start=18, end=23, popularity=84),
    dict(name='Lakshmi Chowk Food', category='Food', tags=['food', 'foodie', 'culture'], minutes=90, budget='LOW', lat=31.5603, lon=74.3313, rating=4.3, start=19, end=2, popularity=75),
    dict(name='Hussain Chaghi (Nihari)', category='Food', tags=['food', 'foodie'], minutes=60, budget='LOW', lat=31.5553, lon=74.3233, rating=4.6, start=6, end=14, popularity=82),
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


def _get_mood_tags(mood: str) -> list:
    """Get the tag list for a given mood."""
    return MOOD_TAG_MAP.get(mood.upper() if mood else '', [])


def _score_place(place: Place, interests_tags, mood_tags=None, popularity_weight=0.5):
    """
    Score a place based on:
      1. Mood match (highest weight — 15 pts per tag match)
      2. Interest match (10 pts per tag match)
      3. Budget compatibility (implicit — already filtered)
      4. Popularity score (stored as rating * 10)
      5. Base rating
    """
    tags = set([t.lower() for t in (place.tags or [])])
    score = 0.0

    # Mood match — highest weight
    if mood_tags:
        mood_overlap = len(tags.intersection(set(mood_tags)))
        score += mood_overlap * 15

    # Interest match
    if interests_tags:
        interest_overlap = len(tags.intersection(set(interests_tags)))
        score += interest_overlap * 10

    # Popularity bonus
    score += (place.average_rating or 0) * popularity_weight

    return score


def _pick_nearby(seed_place: Place, candidates, k):
    """Pick the k nearest candidates to seed_place by distance."""
    scored = []
    for p in candidates:
        d = haversine_km(seed_place.latitude, seed_place.longitude, p.latitude, p.longitude)
        scored.append((d, p))
    scored.sort(key=lambda x: x[0])
    return [p for _, p in scored[:k]]


def _build_day_items(day_places, per_day):
    """Convert a list of Place objects into day item dicts with time slots."""
    items = []
    for idx, p in enumerate(day_places):
        slot = 'morning' if idx == 0 else ('afternoon' if idx < max(2, per_day - 1) else 'evening')
        items.append({
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
            'tags': p.tags or [],
            'ideal_hours': {'start': p.ideal_start_hour, 'end': p.ideal_end_hour},
        })
    return items


def generate_itinerary(*, user, city: str, start_date, end_date, travelers: int,
                       budget_level: str, interests, pace: str, mood: str = '',
                       excluded_ids=None, locked_ids=None):
    """
    Generate an AI-powered itinerary.
    
    Args:
        excluded_ids: Place IDs to exclude (from previous regenerations)
        locked_ids: Place IDs that must be kept (user-locked)
    """
    ensure_lahore_places_seeded()

    interests_tags = _normalize_interests(interests)
    mood_tags = _get_mood_tags(mood)
    
    # Combine mood tags with interests for comprehensive matching
    combined_tags = list(set(interests_tags + mood_tags))
    
    budget_cap = _budget_rank(budget_level)
    excluded_ids = set(excluded_ids or [])
    locked_ids = set(locked_ids or [])

    # Get all eligible places
    all_places = list(Place.objects.filter(city=city))
    places = [p for p in all_places if _budget_rank(p.budget_level) <= budget_cap and p.id not in excluded_ids]

    # Score and rank — mood gets highest weight
    places.sort(key=lambda p: _score_place(p, interests_tags, mood_tags), reverse=True)

    # Add small random jitter to prevent identical regenerations
    if excluded_ids:
        random.shuffle(places)
        places.sort(key=lambda p: _score_place(p, interests_tags, mood_tags) + random.uniform(0, 3), reverse=True)

    days_count = max(1, (end_date - start_date).days)
    per_day = _pace_target(pace)
    used_ids = set()

    days = []
    current_date = start_date
    for day_idx in range(days_count):
        day_places = []

        # 1. Seed: choose best not-yet-used "major" place
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

            # 2. Fill nearby mid-attractions (distance optimization)
            remaining = [p for p in places if p.id not in used_ids]
            nearby = _pick_nearby(major, remaining, k=max(0, per_day - 1))
            for p in nearby:
                used_ids.add(p.id)
                day_places.append(p)

        # 3. If still not enough, top-rank fill
        if len(day_places) < per_day:
            for p in places:
                if p.id in used_ids:
                    continue
                used_ids.add(p.id)
                day_places.append(p)
                if len(day_places) >= per_day:
                    break

        # 4. Ensure evening food/shopping spot if mood or interests call for it
        wants_evening = any(t in combined_tags for t in ('food', 'foodie', 'shopping', 'romantic'))
        if wants_evening:
            has_evening = any(p.category in ('Food', 'Shopping') for p in day_places)
            if not has_evening:
                for p in places:
                    if p.id in used_ids:
                        continue
                    if p.category in ('Food', 'Shopping'):
                        used_ids.add(p.id)
                        if day_places:
                            day_places[-1] = p  # replace last slot
                        else:
                            day_places.append(p)
                        break

        items = _build_day_items(day_places, per_day)

        days.append({
            'date': current_date.isoformat(),
            'title': f"Day {day_idx + 1} - {city}",
            'items': items,
        })
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
            mood=mood or '',
            days=days,
            locked_place_ids=list(locked_ids),
            excluded_place_ids=list(excluded_ids),
            saved=True,
        )

    return itinerary


def regenerate_day(itinerary: Itinerary, day_index: int):
    """
    Smart regeneration for a single day.
    - Preserves locked places
    - Excludes previously used high-ranked places
    - Maintains same mood, budget, pace
    - Ensures diversity (won't repeat identical plan)
    """
    ensure_lahore_places_seeded()

    interests_tags = _normalize_interests(itinerary.interests)
    mood_tags = _get_mood_tags(itinerary.mood)
    budget_cap = _budget_rank(itinerary.budget_level)
    per_day = _pace_target(itinerary.pace)

    # Collect IDs used in other days (don't reuse)
    used_ids = set()
    for di, day in enumerate(itinerary.days or []):
        if di == day_index:
            continue
        for item in day.get('items', []):
            if item.get('type') == 'place' and item.get('place_id'):
                used_ids.add(item['place_id'])

    # Collect current day's IDs to add to exclusion history
    current_day = itinerary.days[day_index] if day_index < len(itinerary.days) else {}
    current_ids = set()
    for item in current_day.get('items', []):
        if item.get('type') == 'place' and item.get('place_id'):
            current_ids.add(item['place_id'])

    # Global excluded IDs (history) — add current day's places
    excluded = set(itinerary.excluded_place_ids or [])
    excluded.update(current_ids)

    # Locked places must stay
    locked_ids = set(itinerary.locked_place_ids or [])
    
    # Build locked items (keep these in the day)
    locked_items = []
    for item in current_day.get('items', []):
        pid = item.get('place_id')
        if pid and pid in locked_ids:
            locked_items.append(item)

    # Get candidates
    candidates = list(Place.objects.filter(city=itinerary.city))
    candidates = [
        p for p in candidates
        if _budget_rank(p.budget_level) <= budget_cap
        and p.id not in used_ids
        and p.id not in locked_ids  # already handled
    ]
    
    # Penalize excluded places heavily but don't remove entirely
    def score_with_penalty(p):
        base = _score_place(p, interests_tags, mood_tags)
        if p.id in excluded:
            base -= 20  # Heavy penalty
        return base + random.uniform(0, 5)  # Randomize for diversity

    candidates.sort(key=score_with_penalty, reverse=True)

    # Pick new places
    slots_needed = per_day - len(locked_items)
    major = None
    picked = []
    
    for p in candidates:
        if p.estimated_visit_minutes >= 120 or p.category in ('History', 'Religious', 'Culture'):
            major = p
            break

    if major and slots_needed > 0:
        picked.append(major)
        rest = [p for p in candidates if p.id != major.id]
        picked.extend(_pick_nearby(major, rest, k=max(0, slots_needed - 1)))
    
    while len(picked) < slots_needed:
        for p in candidates:
            if p in picked:
                continue
            picked.append(p)
            break
        else:
            break

    # Build items: locked first, then new picks
    all_places = []
    locked_place_objects = {p.id: p for p in Place.objects.filter(id__in=locked_ids, city=itinerary.city)}
    for item in locked_items:
        pid = item.get('place_id')
        if pid in locked_place_objects:
            all_places.append(locked_place_objects[pid])
    all_places.extend(picked[:slots_needed])

    items = _build_day_items(all_places[:per_day], per_day)

    return items, list(excluded)


def regenerate_full_trip(itinerary: Itinerary):
    """
    Smart regeneration for the entire trip.
    - Uses alternative scoring paths for diversity
    - Preserves locked places
    - Excludes previously shown places
    - Ensures a completely different plan
    """
    ensure_lahore_places_seeded()

    interests_tags = _normalize_interests(itinerary.interests)
    mood_tags = _get_mood_tags(itinerary.mood)
    budget_cap = _budget_rank(itinerary.budget_level)
    per_day = _pace_target(itinerary.pace)
    locked_ids = set(itinerary.locked_place_ids or [])

    # Collect all previously used place IDs
    prev_ids = set(itinerary.excluded_place_ids or [])
    for day in itinerary.days or []:
        for item in day.get('items', []):
            pid = item.get('place_id')
            if pid and pid not in locked_ids:
                prev_ids.add(pid)

    places = list(Place.objects.filter(city=itinerary.city))
    places = [p for p in places if _budget_rank(p.budget_level) <= budget_cap]

    # Heavy penalty for previously used (but not impossible)
    def diversity_score(p):
        base = _score_place(p, interests_tags, mood_tags)
        if p.id in prev_ids:
            base -= 25
        if p.id in locked_ids:
            base += 50  # Boost locked places
        return base + random.uniform(0, 8)  # Extra randomization for diversity

    places.sort(key=diversity_score, reverse=True)

    days_count = max(1, (itinerary.end_date - itinerary.start_date).days)
    used_ids = set()
    days = []
    current_date = itinerary.start_date

    for day_idx in range(days_count):
        day_places = []

        # Keep locked places that were in this day
        if day_idx < len(itinerary.days or []):
            old_day = itinerary.days[day_idx]
            for item in old_day.get('items', []):
                pid = item.get('place_id')
                if pid and pid in locked_ids:
                    place_obj = next((p for p in places if p.id == pid), None)
                    if place_obj:
                        day_places.append(place_obj)
                        used_ids.add(pid)

        # Fill remaining slots
        remaining_slots = per_day - len(day_places)
        
        # Find major attraction
        major = None
        if remaining_slots > 0:
            for p in places:
                if p.id in used_ids:
                    continue
                if p.estimated_visit_minutes >= 120 or p.category in ('History', 'Religious', 'Culture'):
                    major = p
                    break
            
            if major:
                used_ids.add(major.id)
                day_places.append(major)
                remaining_slots -= 1
                
                rest = [p for p in places if p.id not in used_ids]
                nearby = _pick_nearby(major, rest, k=remaining_slots)
                for p in nearby:
                    used_ids.add(p.id)
                    day_places.append(p)

        # Top-up if needed
        while len(day_places) < per_day:
            filled = False
            for p in places:
                if p.id in used_ids:
                    continue
                used_ids.add(p.id)
                day_places.append(p)
                filled = True
                break
            if not filled:
                break

        items = _build_day_items(day_places, per_day)

        days.append({
            'date': current_date.isoformat(),
            'title': f"Day {day_idx + 1} - {itinerary.city}",
            'items': items,
        })
        current_date += timedelta(days=1)

    return days, list(prev_ids)
