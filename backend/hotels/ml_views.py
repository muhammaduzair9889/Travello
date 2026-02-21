"""
API Views for ML-powered recommendations
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


class MLRecommendationsView(APIView):
    """
    Get ML-powered recommendations using DistilBERT embeddings and cosine similarity
    
    POST /api/ml-recommendations
    
    Request body:
    {
        "query": "luxury hotel near Badshahi Mosque",
        "top_n": 10,
        "city": "Lahore",
        "category": "hotel",
        "min_price": 10000,
        "max_price": 30000,
        "min_rating": 8.0,
        "item_type": "hotel"
    }
    
    Response:
    {
        "success": true,
        "count": 10,
        "query": "luxury hotel near Badshahi Mosque",
        "recommendations": [
            {
                "item_id": 123,
                "name": "Pearl Continental Lahore",
                "description": "...",
                "type": "hotel",
                "category": "hotel",
                "city": "Lahore",
                "latitude": 31.5204,
                "longitude": 74.3587,
                "price_pkr": 35000,
                "rating": 9.2,
                "tags": "luxury,wifi,pool,spa",
                "availability": true,
                "similarity_score": 0.85,
                "combined_score": 0.812,
                "reasons": [
                    "Excellent match (85% similarity)",
                    "Highly rated (9.2/5.0)",
                    "Premium (PKR 35,000)",
                    "Luxury experience"
                ],
                "can_book": true,
                "can_save": true
            },
            ...
        ]
    }
    """
    
    permission_classes = [AllowAny]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.engine = None
    
    def _get_engine(self):
        """Lazy load recommendation engine"""
        if self.engine is None:
            try:
                from ml_system.training.recommendation_engine import RecommendationEngine
                self.engine = RecommendationEngine()
                logger.info("✓ Loaded RecommendationEngine")
            except FileNotFoundError as e:
                logger.error(f"Model not trained: {e}")
                raise
        return self.engine
    
    def post(self, request):
        """Get recommendations based on query"""
        try:
            # Parse request
            query = request.data.get('query', '')
            if not query:
                return Response(
                    {'error': 'Query parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            top_n = int(request.data.get('top_n', 10))
            city = request.data.get('city', 'Lahore')
            category = request.data.get('category')
            min_price = request.data.get('min_price')
            max_price = request.data.get('max_price')
            min_rating = request.data.get('min_rating')
            item_type = request.data.get('item_type')
            availability = request.data.get('availability', True)
            
            # Convert to proper types
            if min_price is not None:
                min_price = float(min_price)
            if max_price is not None:
                max_price = float(max_price)
            if min_rating is not None:
                min_rating = float(min_rating)
            
            # Check cache
            cache_key = f"ml_rec_{query}_{top_n}_{city}_{category}_{min_price}_{max_price}_{min_rating}_{item_type}"
            cached_result = cache.get(cache_key)
            
            if cached_result:
                logger.info(f"✓ Cache hit for: {query}")
                return Response(cached_result)
            
            # Get recommendations
            engine = self._get_engine()
            
            recommendations = engine.recommend(
                query=query,
                top_n=top_n,
                city=city,
                category=category,
                min_price=min_price,
                max_price=max_price,
                min_rating=min_rating,
                item_type=item_type,
                availability=availability
            )
            
            result = {
                'success': True,
                'count': len(recommendations),
                'query': query,
                'filters': {
                    'city': city,
                    'category': category,
                    'min_price': min_price,
                    'max_price': max_price,
                    'min_rating': min_rating,
                    'item_type': item_type
                },
                'recommendations': recommendations
            }
            
            # Cache for 1 hour
            cache.set(cache_key, result, 3600)
            
            return Response(result, status=status.HTTP_200_OK)
            
        except FileNotFoundError:
            return Response(
                {
                    'error': 'ML model not trained',
                    'message': 'Please run: python ml_system/training/train_ml_model.py'
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            logger.error(f"Error in ML recommendations: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SimilarItemsView(APIView):
    """
    Get items similar to a given item
    
    GET /api/similar-items/<item_id>?top_n=5&same_type=true
    """
    
    permission_classes = [AllowAny]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.engine = None
    
    def _get_engine(self):
        """Lazy load recommendation engine"""
        if self.engine is None:
            from ml_system.training.recommendation_engine import RecommendationEngine
            self.engine = RecommendationEngine()
        return self.engine
    
    def get(self, request, item_id):
        """Get similar items"""
        try:
            top_n = int(request.query_params.get('top_n', 5))
            same_type = request.query_params.get('same_type', 'true').lower() == 'true'
            
            engine = self._get_engine()
            similar_items = engine.get_similar_items(
                item_id=int(item_id),
                top_n=top_n,
                same_type=same_type
            )
            
            return Response({
                'success': True,
                'item_id': item_id,
                'count': len(similar_items),
                'similar_items': similar_items
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error finding similar items: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TrainingStatusView(APIView):
    """
    Check ML model training status
    
    GET /api/ml-status
    """
    
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Get training status"""
        import json
        from pathlib import Path
        
        backend_dir = Path(__file__).parent.parent
        models_dir = backend_dir / "ml_system" / "models"
        config_file = models_dir / "travello_config.json"
        
        if not config_file.exists():
            return Response({
                'trained': False,
                'message': 'Model not trained. Run: python ml_system/training/train_ml_model.py'
            })
        
        with open(config_file, 'r') as f:
            config = json.load(f)
        
        return Response({
            'trained': True,
            'model_name': config['model_name'],
            'num_items': config['num_items'],
            'num_hotels': config['num_hotels'],
            'num_attractions': config['num_attractions'],
            'embedding_dim': config['embedding_dim'],
            'trained_at': config['trained_at'],
            'datasets': config['datasets']
        })
