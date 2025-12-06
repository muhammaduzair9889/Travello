from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HotelViewSet, BookingViewSet, RealTimeHotelSearchView
from .ml_views import MLRecommendationsView, SimilarItemsView, TrainingStatusView

router = DefaultRouter()
router.register(r'hotels', HotelViewSet, basename='hotel')
router.register(r'bookings', BookingViewSet, basename='booking')

urlpatterns = [
    # ML recommendation endpoints (MUST come before router)
    path('ml-recommendations/', MLRecommendationsView.as_view(), name='ml-recommendations'),
    path('similar-items/<int:item_id>/', SimilarItemsView.as_view(), name='similar-items'),
    path('ml-status/', TrainingStatusView.as_view(), name='ml-status'),
    
    # Custom endpoints
    path('hotels/search-live/', RealTimeHotelSearchView.as_view(), name='hotel-search-live'),
    
    # Router endpoints
    path('', include(router.urls)),
]