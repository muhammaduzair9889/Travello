from django.urls import path

from . import views

app_name = 'itineraries'

urlpatterns = [
    path('places/', views.PlaceListView.as_view(), name='places'),
    path('generate/', views.ItineraryGenerateView.as_view(), name='generate'),
    path('', views.ItineraryListView.as_view(), name='list'),
    path('<int:itinerary_id>/', views.ItineraryDetailView.as_view(), name='detail'),
    path('<int:itinerary_id>/regenerate-day/', views.ItineraryRegenerateDayView.as_view(), name='regenerate-day'),
    path('<int:itinerary_id>/replace-place/', views.ItineraryReplacePlaceView.as_view(), name='replace-place'),
    path('<int:itinerary_id>/remove-place/', views.ItineraryRemovePlaceView.as_view(), name='remove-place'),
]

