"""
Embedding Generator for Travello ML System

Generates dense vector embeddings for hotels and POIs using Hugging Face
sentence-transformers models.

Features:
- Multi-model support (all-mpnet-base-v2, all-MiniLM-L6-v2)
- Batch processing for efficiency
- GPU acceleration when available
- Incremental updates for new items
- Normalized L2 embeddings for cosine similarity
"""

import pandas as pd
import numpy as np
import torch
import json
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EmbeddingGenerator:
    """Generate and manage embeddings for hotels and POIs"""
    
    def __init__(
        self,
        model_name: str = 'all-mpnet-base-v2',
        data_dir: str = None,
        batch_size: int = 32,
        use_gpu: bool = True
    ):
        """
        Initialize embedding generator
        
        Args:
            model_name: Hugging Face model name
                - 'all-mpnet-base-v2': Best quality (768 dim, ~420M params)
                - 'all-MiniLM-L6-v2': Fast inference (384 dim, ~80M params)
            data_dir: Root data directory
            batch_size: Batch size for encoding
            use_gpu: Use GPU if available
        """
        if data_dir is None:
            backend_dir = Path(__file__).parent.parent.parent
            data_dir = backend_dir / "data"
        
        self.data_dir = Path(data_dir)
        self.processed_dir = self.data_dir / "processed"
        self.models_dir = Path(__file__).parent.parent / "models"
        
        # Create models directory
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        self.model_name = model_name
        self.batch_size = batch_size
        
        # Check device
        if use_gpu and torch.cuda.is_available():
            self.device = 'cuda'
            logger.info(f"🚀 Using GPU: {torch.cuda.get_device_name(0)}")
        else:
            self.device = 'cpu'
            logger.info(f"💻 Using CPU (GPU not available or disabled)")
        
        # Load model
        logger.info(f"Loading model: {model_name}")
        try:
            self.model = SentenceTransformer(model_name, device=self.device)
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
            logger.info(f"✓ Model loaded (embedding dim: {self.embedding_dim})")
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            raise
    
    def prepare_text_for_embedding(self, row: pd.Series) -> str:
        """
        Prepare text from row for embedding generation
        Combines name, description, tags, category, and city
        """
        parts = []
        
        # Priority: name (most important)
        if 'name' in row and pd.notna(row['name']):
            parts.append(str(row['name']))
        
        # Description
        if 'description' in row and pd.notna(row['description']):
            desc = str(row['description'])
            # Truncate very long descriptions
            if len(desc) > 500:
                desc = desc[:500] + '...'
            parts.append(desc)
        
        # Tags (replace commas with spaces)
        if 'tags' in row and pd.notna(row['tags']):
            tags = str(row['tags']).replace(',', ' ')
            parts.append(tags)
        
        # Category
        if 'category' in row and pd.notna(row['category']):
            parts.append(f"Category: {row['category']}")
        
        # City
        if 'city' in row and pd.notna(row['city']):
            parts.append(f"Location: {row['city']}")
        
        # Combine with separators
        text = '. '.join(parts)
        
        return text
    
    def generate_embeddings(
        self,
        texts: List[str],
        show_progress: bool = True
    ) -> np.ndarray:
        """
        Generate embeddings for a list of texts
        
        Args:
            texts: List of text strings
            show_progress: Show progress bar
        
        Returns:
            numpy array of shape (len(texts), embedding_dim)
        """
        logger.info(f"Generating embeddings for {len(texts)} texts...")
        logger.info(f"Batch size: {self.batch_size}")
        
        # Encode in batches
        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            show_progress_bar=show_progress,
            convert_to_numpy=True,
            normalize_embeddings=True  # L2 normalize for cosine similarity
        )
        
        logger.info(f"✓ Generated embeddings: shape {embeddings.shape}")
        
        return embeddings
    
    def process_hotels_pois(
        self,
        input_file: str = None,
        output_prefix: str = 'hotels_pois'
    ) -> Tuple[np.ndarray, pd.DataFrame]:
        """
        Generate embeddings for hotels and POIs dataset
        
        Args:
            input_file: Path to processed CSV file
            output_prefix: Prefix for output files
        
        Returns:
            (embeddings_array, dataframe)
        """
        logger.info("=" * 80)
        logger.info("GENERATING EMBEDDINGS FOR HOTELS & POIS")
        logger.info("=" * 80)
        
        # Load processed data
        if input_file is None:
            input_file = self.processed_dir / "hotels_pois_processed.csv"
        
        logger.info(f"Loading data from: {input_file}")
        
        try:
            df = pd.read_csv(input_file, encoding='utf-8')
            logger.info(f"✓ Loaded {len(df)} records")
        except FileNotFoundError:
            logger.error(f"❌ File not found: {input_file}")
            logger.info("\nPlease run ETL pipeline first:")
            logger.info("python data/ingest/etl_pipeline.py")
            return None, None
        
        # Prepare texts for embedding
        logger.info("\nPreparing texts for embedding...")
        texts = df.apply(self.prepare_text_for_embedding, axis=1).tolist()
        
        # Log sample text
        logger.info(f"\nSample text (first item):")
        logger.info(f"  {texts[0][:200]}...")
        logger.info(f"\nAverage text length: {np.mean([len(t) for t in texts]):.0f} chars")
        
        # Generate embeddings
        logger.info(f"\nGenerating embeddings with {self.model_name}...")
        embeddings = self.generate_embeddings(texts, show_progress=True)
        
        # Verify embeddings
        logger.info("\n" + "=" * 80)
        logger.info("EMBEDDINGS SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Shape: {embeddings.shape}")
        logger.info(f"Dtype: {embeddings.dtype}")
        logger.info(f"Normalized: {np.allclose(np.linalg.norm(embeddings, axis=1), 1.0)}")
        logger.info(f"Mean: {embeddings.mean():.6f}")
        logger.info(f"Std: {embeddings.std():.6f}")
        logger.info(f"Min: {embeddings.min():.6f}")
        logger.info(f"Max: {embeddings.max():.6f}")
        
        # Save embeddings
        embeddings_file = self.models_dir / f"{output_prefix}_embeddings.npy"
        np.save(embeddings_file, embeddings)
        logger.info(f"\n✓ Saved embeddings to: {embeddings_file}")
        logger.info(f"  File size: {embeddings_file.stat().st_size / 1024 / 1024:.2f} MB")
        
        # Save item IDs and metadata
        metadata_df = df[['id', 'name', 'city', 'category']].copy()
        if 'price_pkr' in df.columns:
            metadata_df['price_pkr'] = df['price_pkr']
        if 'rating' in df.columns:
            metadata_df['rating'] = df['rating']
        if 'lat' in df.columns and 'lon' in df.columns:
            metadata_df['lat'] = df['lat']
            metadata_df['lon'] = df['lon']
        
        metadata_file = self.models_dir / f"{output_prefix}_metadata.csv"
        metadata_df.to_csv(metadata_file, index=False)
        logger.info(f"✓ Saved metadata to: {metadata_file}")
        
        # Save embedding config
        config = {
            'model_name': self.model_name,
            'embedding_dim': self.embedding_dim,
            'num_items': len(df),
            'device': self.device,
            'batch_size': self.batch_size,
            'created_at': datetime.now().isoformat(),
            'normalized': True,
            'source_file': str(input_file)
        }
        
        config_file = self.models_dir / f"{output_prefix}_embedding_config.json"
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        logger.info(f"✓ Saved config to: {config_file}")
        
        logger.info("\n" + "=" * 80)
        logger.info("EMBEDDING GENERATION COMPLETE")
        logger.info("=" * 80)
        logger.info(f"✓ Generated {len(embeddings)} embeddings")
        logger.info(f"✓ Embedding dimension: {self.embedding_dim}")
        logger.info(f"✓ Model: {self.model_name}")
        logger.info(f"\nNext step:")
        logger.info("python ml_system/retrieval/build_index.py")
        logger.info("")
        
        return embeddings, df
    
    def generate_query_embedding(self, query: str) -> np.ndarray:
        """
        Generate embedding for a single query text
        
        Args:
            query: Query text
        
        Returns:
            numpy array of shape (embedding_dim,)
        """
        embedding = self.model.encode(
            query,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        return embedding
    
    def update_embeddings_for_new_items(
        self,
        new_items_df: pd.DataFrame,
        output_prefix: str = 'hotels_pois'
    ) -> np.ndarray:
        """
        Generate embeddings for new items and append to existing embeddings
        
        Args:
            new_items_df: DataFrame with new items
            output_prefix: Prefix for output files
        
        Returns:
            New embeddings array
        """
        logger.info(f"Generating embeddings for {len(new_items_df)} new items...")
        
        # Prepare texts
        texts = new_items_df.apply(self.prepare_text_for_embedding, axis=1).tolist()
        
        # Generate embeddings
        new_embeddings = self.generate_embeddings(texts, show_progress=False)
        
        # Load existing embeddings
        embeddings_file = self.models_dir / f"{output_prefix}_embeddings.npy"
        if embeddings_file.exists():
            existing_embeddings = np.load(embeddings_file)
            
            # Append new embeddings
            updated_embeddings = np.vstack([existing_embeddings, new_embeddings])
            
            # Save updated embeddings
            np.save(embeddings_file, updated_embeddings)
            logger.info(f"✓ Updated embeddings: {existing_embeddings.shape} → {updated_embeddings.shape}")
        else:
            # Save new embeddings
            np.save(embeddings_file, new_embeddings)
            logger.info(f"✓ Saved new embeddings: {new_embeddings.shape}")
        
        return new_embeddings


def main():
    """Main entry point for embedding generation"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate embeddings for hotels and POIs')
    parser.add_argument(
        '--model',
        type=str,
        default='all-mpnet-base-v2',
        choices=['all-mpnet-base-v2', 'all-MiniLM-L6-v2'],
        help='Sentence-transformers model to use'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=32,
        help='Batch size for encoding'
    )
    parser.add_argument(
        '--no-gpu',
        action='store_true',
        help='Disable GPU usage'
    )
    
    args = parser.parse_args()
    
    # Initialize generator
    generator = EmbeddingGenerator(
        model_name=args.model,
        batch_size=args.batch_size,
        use_gpu=not args.no_gpu
    )
    
    # Generate embeddings
    embeddings, df = generator.process_hotels_pois()
    
    if embeddings is not None:
        logger.info("✅ Embedding generation successful!")
    else:
        logger.error("❌ Embedding generation failed!")


if __name__ == '__main__':
    main()
