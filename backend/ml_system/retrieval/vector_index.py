"""
Vector Index using FAISS for Travello ML System

Builds and manages FAISS vector index for semantic search of hotels and POIs.

Features:
- Multiple index types (Flat, IVF, HNSW)
- Metadata filtering (city, price, rating, category)
- Geo-spatial filtering by distance
- Top-K retrieval with scores
- Index persistence and loading
"""

import numpy as np
import pandas as pd
import faiss
import json
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import pickle

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class VectorIndex:
    """FAISS-based vector index for semantic search"""
    
    def __init__(
        self,
        index_type: str = 'Flat',
        embedding_dim: int = 768,
        use_gpu: bool = False
    ):
        """
        Initialize vector index
        
        Args:
            index_type: Type of FAISS index
                - 'Flat': Exact search (best quality, slower)
                - 'IVF': Inverted file index (faster, approximate)
                - 'HNSW': Hierarchical NSW (fast, high recall)
            embedding_dim: Dimension of embeddings
            use_gpu: Use GPU for FAISS operations
        """
        self.index_type = index_type
        self.embedding_dim = embedding_dim
        self.use_gpu = use_gpu
        
        self.index = None
        self.metadata = None
        self.item_ids = None
        
        # Get directories
        backend_dir = Path(__file__).parent.parent.parent
        self.models_dir = backend_dir / "ml_system" / "models"
        self.models_dir.mkdir(parents=True, exist_ok=True)
    
    def build_index(
        self,
        embeddings: np.ndarray,
        metadata_df: pd.DataFrame,
        nlist: int = 100
    ):
        """
        Build FAISS index from embeddings
        
        Args:
            embeddings: numpy array of shape (n_items, embedding_dim)
            metadata_df: DataFrame with item metadata (id, name, city, etc.)
            nlist: Number of clusters for IVF index
        """
        logger.info("=" * 80)
        logger.info("BUILDING FAISS VECTOR INDEX")
        logger.info("=" * 80)
        logger.info(f"Index type: {self.index_type}")
        logger.info(f"Embeddings shape: {embeddings.shape}")
        logger.info(f"Embedding dimension: {self.embedding_dim}")
        
        # Validate embeddings
        if embeddings.shape[1] != self.embedding_dim:
            raise ValueError(
                f"Embedding dim mismatch: expected {self.embedding_dim}, "
                f"got {embeddings.shape[1]}"
            )
        
        # Ensure embeddings are normalized
        if not np.allclose(np.linalg.norm(embeddings, axis=1), 1.0, atol=1e-5):
            logger.warning("⚠️ Embeddings not normalized, normalizing now...")
            embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
        
        # Convert to float32 (FAISS requirement)
        embeddings = embeddings.astype(np.float32)
        
        # Build index based on type
        if self.index_type == 'Flat':
            # Exact search with inner product (cosine similarity for normalized vectors)
            self.index = faiss.IndexFlatIP(self.embedding_dim)
            logger.info("Creating Flat index (exact search)...")
        
        elif self.index_type == 'IVF':
            # IVF index for faster approximate search
            quantizer = faiss.IndexFlatIP(self.embedding_dim)
            self.index = faiss.IndexIVFFlat(quantizer, self.embedding_dim, nlist)
            
            logger.info(f"Creating IVF index with {nlist} clusters...")
            logger.info("Training index...")
            self.index.train(embeddings)
            logger.info("✓ Training complete")
        
        elif self.index_type == 'HNSW':
            # HNSW index for fast approximate search
            m = 32  # Number of connections per layer
            self.index = faiss.IndexHNSWFlat(self.embedding_dim, m)
            self.index.hnsw.efConstruction = 200  # Quality during construction
            self.index.hnsw.efSearch = 128  # Quality during search
            logger.info(f"Creating HNSW index (M={m}, efConstruction=200)...")
        
        else:
            raise ValueError(f"Unknown index type: {self.index_type}")
        
        # Add embeddings to index
        logger.info(f"Adding {len(embeddings)} embeddings to index...")
        self.index.add(embeddings)
        logger.info(f"✓ Index built: {self.index.ntotal} vectors")
        
        # Store metadata
        self.metadata = metadata_df.copy()
        self.item_ids = metadata_df['id'].tolist()
        
        logger.info("\n" + "=" * 80)
        logger.info("INDEX SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total vectors: {self.index.ntotal}")
        logger.info(f"Index type: {self.index_type}")
        logger.info(f"Embedding dim: {self.embedding_dim}")
        logger.info(f"Metadata columns: {list(self.metadata.columns)}")
        logger.info(f"Unique cities: {self.metadata['city'].nunique() if 'city' in self.metadata else 'N/A'}")
        logger.info(f"Unique categories: {self.metadata['category'].nunique() if 'category' in self.metadata else 'N/A'}")
    
    def search(
        self,
        query_embedding: np.ndarray,
        k: int = 10,
        city: Optional[str] = None,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        max_distance_km: Optional[float] = None,
        query_lat: Optional[float] = None,
        query_lon: Optional[float] = None
    ) -> List[Dict]:
        """
        Search for similar items with optional filtering
        
        Args:
            query_embedding: Query vector of shape (embedding_dim,)
            k: Number of results to return
            city: Filter by city name
            category: Filter by category
            min_price: Minimum price in PKR
            max_price: Maximum price in PKR
            min_rating: Minimum rating
            max_distance_km: Maximum distance in kilometers
            query_lat: Query latitude for distance filtering
            query_lon: Query longitude for distance filtering
        
        Returns:
            List of result dictionaries with item info and scores
        """
        if self.index is None:
            raise ValueError("Index not built. Call build_index() first.")
        
        # Ensure query is normalized
        query_embedding = query_embedding.astype(np.float32)
        if not np.allclose(np.linalg.norm(query_embedding), 1.0, atol=1e-5):
            query_embedding = query_embedding / np.linalg.norm(query_embedding)
        
        # Reshape for FAISS (needs 2D array)
        query_vector = query_embedding.reshape(1, -1)
        
        # Retrieve more candidates if filtering is needed
        retrieve_k = k * 10 if any([city, category, min_price, max_price, min_rating, max_distance_km]) else k
        retrieve_k = min(retrieve_k, self.index.ntotal)
        
        # Search index
        scores, indices = self.index.search(query_vector, retrieve_k)
        scores = scores[0]  # Remove batch dimension
        indices = indices[0]
        
        # Prepare results
        results = []
        for idx, score in zip(indices, scores):
            if idx < 0 or idx >= len(self.metadata):
                continue
            
            item = self.metadata.iloc[idx].to_dict()
            item['score'] = float(score)
            item['index'] = int(idx)
            
            # Apply filters
            if city and item.get('city', '').lower() != city.lower():
                continue
            
            if category and item.get('category', '').lower() != category.lower():
                continue
            
            if min_price and item.get('price_pkr', 0) < min_price:
                continue
            
            if max_price and item.get('price_pkr', float('inf')) > max_price:
                continue
            
            if min_rating and item.get('rating', 0) < min_rating:
                continue
            
            # Distance filtering
            if max_distance_km and query_lat and query_lon:
                if 'lat' in item and 'lon' in item:
                    distance = self._haversine_distance(
                        query_lat, query_lon,
                        item['lat'], item['lon']
                    )
                    if distance > max_distance_km:
                        continue
                    item['distance_km'] = round(distance, 2)
            
            results.append(item)
            
            # Stop if we have enough results
            if len(results) >= k:
                break
        
        return results
    
    def _haversine_distance(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """
        Calculate distance between two points using Haversine formula
        
        Returns:
            Distance in kilometers
        """
        from math import radians, sin, cos, sqrt, atan2
        
        # Earth radius in kilometers
        R = 6371.0
        
        # Convert to radians
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        distance = R * c
        
        return distance
    
    def save(self, output_prefix: str = 'hotels_pois'):
        """
        Save index and metadata to disk
        
        Args:
            output_prefix: Prefix for output files
        """
        logger.info(f"\nSaving index to: {self.models_dir}")
        
        # Save FAISS index
        index_file = self.models_dir / f"{output_prefix}_faiss_index.bin"
        faiss.write_index(self.index, str(index_file))
        logger.info(f"✓ Saved FAISS index: {index_file}")
        logger.info(f"  File size: {index_file.stat().st_size / 1024 / 1024:.2f} MB")
        
        # Save metadata
        metadata_file = self.models_dir / f"{output_prefix}_index_metadata.pkl"
        with open(metadata_file, 'wb') as f:
            pickle.dump({
                'metadata': self.metadata,
                'item_ids': self.item_ids,
                'index_type': self.index_type,
                'embedding_dim': self.embedding_dim
            }, f)
        logger.info(f"✓ Saved metadata: {metadata_file}")
        
        # Save config
        config = {
            'index_type': self.index_type,
            'embedding_dim': self.embedding_dim,
            'num_items': self.index.ntotal,
            'use_gpu': self.use_gpu,
            'created_at': datetime.now().isoformat()
        }
        
        config_file = self.models_dir / f"{output_prefix}_index_config.json"
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        logger.info(f"✓ Saved config: {config_file}")
    
    def load(self, output_prefix: str = 'hotels_pois'):
        """
        Load index and metadata from disk
        
        Args:
            output_prefix: Prefix for input files
        """
        logger.info(f"Loading index from: {self.models_dir}")
        
        # Load FAISS index
        index_file = self.models_dir / f"{output_prefix}_faiss_index.bin"
        if not index_file.exists():
            raise FileNotFoundError(f"Index file not found: {index_file}")
        
        self.index = faiss.read_index(str(index_file))
        logger.info(f"✓ Loaded FAISS index: {self.index.ntotal} vectors")
        
        # Load metadata
        metadata_file = self.models_dir / f"{output_prefix}_index_metadata.pkl"
        with open(metadata_file, 'rb') as f:
            data = pickle.load(f)
            self.metadata = data['metadata']
            self.item_ids = data['item_ids']
            self.index_type = data['index_type']
            self.embedding_dim = data['embedding_dim']
        
        logger.info(f"✓ Loaded metadata: {len(self.metadata)} items")
        
        # Load config
        config_file = self.models_dir / f"{output_prefix}_index_config.json"
        with open(config_file, 'r') as f:
            config = json.load(f)
        
        logger.info(f"✓ Index type: {config['index_type']}")
        logger.info(f"✓ Created at: {config['created_at']}")


def build_index_from_embeddings(
    embeddings_file: str = None,
    metadata_file: str = None,
    index_type: str = 'Flat',
    output_prefix: str = 'hotels_pois'
):
    """
    Build FAISS index from saved embeddings
    
    Args:
        embeddings_file: Path to embeddings .npy file
        metadata_file: Path to metadata .csv file
        index_type: Type of FAISS index
        output_prefix: Prefix for output files
    """
    logger.info("=" * 80)
    logger.info("BUILDING VECTOR INDEX FROM EMBEDDINGS")
    logger.info("=" * 80)
    
    # Get default paths
    backend_dir = Path(__file__).parent.parent.parent
    models_dir = backend_dir / "ml_system" / "models"
    
    if embeddings_file is None:
        embeddings_file = models_dir / f"{output_prefix}_embeddings.npy"
    
    if metadata_file is None:
        metadata_file = models_dir / f"{output_prefix}_metadata.csv"
    
    # Load embeddings
    logger.info(f"Loading embeddings from: {embeddings_file}")
    try:
        embeddings = np.load(embeddings_file)
        logger.info(f"✓ Loaded embeddings: shape {embeddings.shape}")
    except FileNotFoundError:
        logger.error(f"❌ Embeddings file not found: {embeddings_file}")
        logger.info("\nPlease generate embeddings first:")
        logger.info("python ml_system/embeddings/embedding_generator.py")
        return None
    
    # Load metadata
    logger.info(f"Loading metadata from: {metadata_file}")
    try:
        metadata_df = pd.read_csv(metadata_file)
        logger.info(f"✓ Loaded metadata: {len(metadata_df)} items")
    except FileNotFoundError:
        logger.error(f"❌ Metadata file not found: {metadata_file}")
        return None
    
    # Build index
    vector_index = VectorIndex(
        index_type=index_type,
        embedding_dim=embeddings.shape[1]
    )
    
    vector_index.build_index(embeddings, metadata_df)
    
    # Save index
    vector_index.save(output_prefix)
    
    logger.info("\n" + "=" * 80)
    logger.info("INDEX BUILD COMPLETE")
    logger.info("=" * 80)
    logger.info(f"✓ Index type: {index_type}")
    logger.info(f"✓ Total vectors: {vector_index.index.ntotal}")
    logger.info(f"✓ Saved to: {models_dir}")
    logger.info("\nNext step:")
    logger.info("Test the index with semantic search")
    logger.info("python ml_system/retrieval/test_search.py")
    logger.info("")
    
    return vector_index


def main():
    """Main entry point for index building"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Build FAISS vector index')
    parser.add_argument(
        '--index-type',
        type=str,
        default='Flat',
        choices=['Flat', 'IVF', 'HNSW'],
        help='Type of FAISS index'
    )
    parser.add_argument(
        '--prefix',
        type=str,
        default='hotels_pois',
        help='Output file prefix'
    )
    
    args = parser.parse_args()
    
    # Build index
    index = build_index_from_embeddings(
        index_type=args.index_type,
        output_prefix=args.prefix
    )
    
    if index is not None:
        logger.info("✅ Index build successful!")
    else:
        logger.error("❌ Index build failed!")


if __name__ == '__main__':
    main()
