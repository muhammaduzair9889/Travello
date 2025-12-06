"""
ML Model Training Pipeline for Travello
Uses real datasets with DistilBERT/RoBERTa embeddings and Scikit-learn

Dataset Sources:
- ml_datasets/hotels-in-lahore-pakistan.csv (169 hotels)
- ml_datasets/Lahore_Tourism.csv (78 tourism spots)
"""

import pandas as pd
import numpy as np
import torch
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime
from transformers import AutoTokenizer, AutoModel
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
import pickle

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TravelloMLTrainer:
    """Train ML models using real Lahore hotel and tourism datasets"""
    
    def __init__(self, model_name: str = 'distilbert-base-uncased'):
        """
        Initialize trainer with DistilBERT or RoBERTa
        
        Args:
            model_name: 'distilbert-base-uncased' or 'distilroberta-base'
        """
        self.backend_dir = Path(__file__).parent.parent.parent
        self.ml_datasets_dir = self.backend_dir / "ml_datasets"
        self.models_dir = self.backend_dir / "ml_system" / "models"
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        self.model_name = model_name
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        logger.info(f"Initializing ML Trainer with {model_name}")
        logger.info(f"Device: {self.device}")
        
        # Load tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(self.device)
        self.model.eval()
        
        logger.info(f"✓ Loaded {model_name}")
    
    def load_hotel_dataset(self) -> pd.DataFrame:
        """
        Load and clean hotels-in-lahore-pakistan.csv
        Returns: DataFrame with cleaned hotel data
        """
        logger.info("\n" + "="*80)
        logger.info("LOADING HOTEL DATASET")
        logger.info("="*80)
        
        hotels_file = self.ml_datasets_dir / "hotels-in-lahore-pakistan.csv"
        
        try:
            # Read CSV with proper encoding
            df = pd.read_csv(hotels_file, encoding='utf-8')
            logger.info(f"✓ Loaded {len(df)} hotels from {hotels_file}")
            
            # Clean column names
            df.columns = df.columns.str.strip()
            
            # Rename columns for consistency
            df = df.rename(columns={
                'Name ': 'name',
                'Catag': 'category',
                'Address': 'address',
                'Pro': 'province',
                'Mobile No': 'mobile',
                'Lat': 'latitude',
                'Log': 'longitude'
            })
            
            # Clean and process data
            df['name'] = df['name'].fillna('').str.strip()
            df['address'] = df['address'].fillna('').str.strip()
            df['category'] = 'hotel'
            df['city'] = 'Lahore'
            
            # Extract price estimates from hotel names/addresses
            df['price_pkr'] = df.apply(self._estimate_hotel_price, axis=1)
            
            # Add availability (all available by default)
            df['availability'] = True
            
            # Clean coordinates
            df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
            df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
            
            # Create description from available info
            df['description'] = df.apply(self._create_hotel_description, axis=1)
            
            # Remove rows with missing essential data
            df = df.dropna(subset=['name', 'latitude', 'longitude'])
            
            # Add tags based on hotel names
            df['tags'] = df['name'].apply(self._extract_hotel_tags)
            
            # Add rating (estimated from hotel tier)
            df['rating'] = df.apply(self._estimate_rating, axis=1)
            
            logger.info(f"\n✓ Cleaned dataset:")
            logger.info(f"  - Hotels: {len(df)}")
            logger.info(f"  - Price range: PKR {df['price_pkr'].min():.0f} - {df['price_pkr'].max():.0f}")
            logger.info(f"  - Avg rating: {df['rating'].mean():.2f}")
            
            return df
            
        except Exception as e:
            logger.error(f"❌ Error loading hotels: {e}")
            raise
    
    def load_tourism_dataset(self) -> pd.DataFrame:
        """
        Load and clean Lahore_Tourism.csv
        Returns: DataFrame with tourism spots
        """
        logger.info("\n" + "="*80)
        logger.info("LOADING TOURISM DATASET")
        logger.info("="*80)
        
        tourism_file = self.ml_datasets_dir / "Lahore_Tourism.csv"
        
        try:
            df = pd.read_csv(tourism_file, encoding='utf-8')
            logger.info(f"✓ Loaded {len(df)} tourism spots from {tourism_file}")
            
            # Rename columns for consistency
            df = df.rename(columns={
                '_key': 'name',
                'Desc': 'description',
                'district': 'city'
            })
            
            # Add missing fields
            df['address'] = df['description'].str[:100] + '...'
            df['province'] = 'Punjab'
            df['mobile'] = ''
            df['price_pkr'] = df['entry_fee'].fillna(0)
            df['availability'] = True
            
            # Clean tags
            df['tags'] = df['tags'].fillna('')
            
            # Ensure rating is numeric
            df['rating'] = pd.to_numeric(df['rating'], errors='coerce').fillna(4.0)
            
            logger.info(f"\n✓ Cleaned tourism dataset:")
            logger.info(f"  - Attractions: {len(df)}")
            logger.info(f"  - Categories: {df['category'].nunique()}")
            logger.info(f"  - Avg rating: {df['rating'].mean():.2f}")
            
            return df
            
        except Exception as e:
            logger.error(f"❌ Error loading tourism spots: {e}")
            raise
    
    def _estimate_hotel_price(self, row) -> float:
        """Estimate hotel price based on name and category"""
        name = str(row.get('name', '')).lower()
        
        # Luxury hotels
        if any(word in name for word in ['pearl continental', 'marriott', 'avari', 'hilton', 'sheraton', 'luxury', 'grand']):
            return np.random.randint(25000, 40000)
        
        # Mid-range hotels
        elif any(word in name for word in ['hotel one', 'best western', 'ramada', 'inn', 'palace', 'royal']):
            return np.random.randint(12000, 25000)
        
        # Budget hotels
        elif any(word in name for word in ['guest house', 'motel', 'hostel', 'budget']):
            return np.random.randint(5000, 12000)
        
        # Default mid-range
        else:
            return np.random.randint(8000, 18000)
    
    def _estimate_rating(self, row) -> float:
        """Estimate rating based on hotel tier"""
        price = row.get('price_pkr', 10000)
        
        if price > 25000:
            return round(np.random.uniform(8.5, 9.5), 1)
        elif price > 12000:
            return round(np.random.uniform(7.5, 8.5), 1)
        else:
            return round(np.random.uniform(6.5, 7.8), 1)
    
    def _create_hotel_description(self, row) -> str:
        """Create description from available hotel info"""
        parts = []
        
        name = row.get('name', '')
        if name:
            parts.append(f"{name}")
        
        address = row.get('address', '')
        if address and len(address) > 10:
            parts.append(f"Located at {address}")
        
        category = row.get('category', '')
        if category:
            parts.append(f"Category: {category}")
        
        return '. '.join(parts) if parts else name
    
    def _extract_hotel_tags(self, name: str) -> str:
        """Extract tags from hotel name"""
        name_lower = name.lower()
        tags = []
        
        if any(word in name_lower for word in ['luxury', 'grand', 'royal', 'palace']):
            tags.append('luxury')
        if 'inn' in name_lower or 'hotel' in name_lower:
            tags.append('accommodation')
        if 'guest house' in name_lower:
            tags.append('guesthouse')
        if any(word in name_lower for word in ['family', 'home']):
            tags.append('family-friendly')
        if 'business' in name_lower or 'executive' in name_lower:
            tags.append('business')
        
        return ','.join(tags) if tags else 'hotel,accommodation'
    
    def combine_datasets(self, hotels_df: pd.DataFrame, tourism_df: pd.DataFrame) -> pd.DataFrame:
        """
        Combine hotels and tourism datasets into unified format
        """
        logger.info("\n" + "="*80)
        logger.info("COMBINING DATASETS")
        logger.info("="*80)
        
        # Select common columns
        common_cols = ['name', 'description', 'category', 'city', 'latitude', 'longitude', 
                       'tags', 'rating', 'price_pkr', 'availability']
        
        hotels_subset = hotels_df[common_cols].copy()
        hotels_subset['type'] = 'hotel'
        
        tourism_subset = tourism_df[common_cols].copy()
        tourism_subset['type'] = 'attraction'
        
        # Combine
        combined_df = pd.concat([hotels_subset, tourism_subset], ignore_index=True)
        
        # Add unique ID
        combined_df['item_id'] = combined_df.index
        
        # Create search text for embeddings
        combined_df['search_text'] = combined_df.apply(
            lambda row: f"{row['name']}. {row['description']}. {row['tags']}. Category: {row['category']}",
            axis=1
        )
        
        logger.info(f"\n✓ Combined dataset:")
        logger.info(f"  - Total items: {len(combined_df)}")
        logger.info(f"  - Hotels: {len(combined_df[combined_df['type']=='hotel'])}")
        logger.info(f"  - Attractions: {len(combined_df[combined_df['type']=='attraction'])}")
        logger.info(f"  - Cities: {combined_df['city'].nunique()}")
        
        return combined_df
    
    def generate_embeddings(self, texts: List[str], batch_size: int = 16) -> np.ndarray:
        """
        Generate DistilBERT/RoBERTa embeddings for texts
        
        Args:
            texts: List of text strings
            batch_size: Batch size for processing
        
        Returns:
            numpy array of embeddings (n_texts, embedding_dim)
        """
        logger.info(f"\nGenerating embeddings for {len(texts)} texts...")
        logger.info(f"Model: {self.model_name}")
        logger.info(f"Batch size: {batch_size}")
        
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            
            # Tokenize
            inputs = self.tokenizer(
                batch_texts,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors='pt'
            ).to(self.device)
            
            # Generate embeddings
            with torch.no_grad():
                outputs = self.model(**inputs)
                # Use [CLS] token embedding (first token)
                embeddings = outputs.last_hidden_state[:, 0, :].cpu().numpy()
            
            all_embeddings.append(embeddings)
            
            if (i + batch_size) % 100 == 0:
                logger.info(f"  Processed {min(i+batch_size, len(texts))}/{len(texts)} texts")
        
        # Concatenate all batches
        all_embeddings = np.vstack(all_embeddings)
        
        logger.info(f"✓ Generated embeddings: shape {all_embeddings.shape}")
        
        return all_embeddings
    
    def train_and_save(self):
        """
        Complete training pipeline:
        1. Load real datasets
        2. Combine and clean
        3. Generate DistilBERT embeddings
        4. Save embeddings and metadata
        """
        logger.info("\n" + "="*80)
        logger.info("TRAVELLO ML TRAINING PIPELINE")
        logger.info("="*80)
        logger.info(f"Using real datasets from: {self.ml_datasets_dir}")
        logger.info(f"Model: {self.model_name}")
        logger.info(f"Device: {self.device}")
        
        # Step 1: Load datasets
        hotels_df = self.load_hotel_dataset()
        tourism_df = self.load_tourism_dataset()
        
        # Step 2: Combine
        combined_df = self.combine_datasets(hotels_df, tourism_df)
        
        # Step 3: Generate embeddings
        logger.info("\n" + "="*80)
        logger.info("GENERATING TEXT EMBEDDINGS")
        logger.info("="*80)
        
        search_texts = combined_df['search_text'].tolist()
        embeddings = self.generate_embeddings(search_texts, batch_size=16)
        
        # Step 4: Save everything
        logger.info("\n" + "="*80)
        logger.info("SAVING TRAINED MODEL")
        logger.info("="*80)
        
        # Save embeddings
        embeddings_file = self.models_dir / "travello_embeddings.npy"
        np.save(embeddings_file, embeddings)
        logger.info(f"✓ Saved embeddings: {embeddings_file}")
        logger.info(f"  Shape: {embeddings.shape}")
        logger.info(f"  Size: {embeddings_file.stat().st_size / 1024 / 1024:.2f} MB")
        
        # Save metadata
        metadata_file = self.models_dir / "travello_metadata.csv"
        combined_df.to_csv(metadata_file, index=False, encoding='utf-8')
        logger.info(f"✓ Saved metadata: {metadata_file}")
        
        # Save config
        config = {
            'model_name': self.model_name,
            'embedding_dim': embeddings.shape[1],
            'num_items': len(combined_df),
            'num_hotels': len(combined_df[combined_df['type']=='hotel']),
            'num_attractions': len(combined_df[combined_df['type']=='attraction']),
            'trained_at': datetime.now().isoformat(),
            'device': self.device,
            'datasets': {
                'hotels': str(self.ml_datasets_dir / "hotels-in-lahore-pakistan.csv"),
                'tourism': str(self.ml_datasets_dir / "Lahore_Tourism.csv")
            }
        }
        
        config_file = self.models_dir / "travello_config.json"
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        logger.info(f"✓ Saved config: {config_file}")
        
        # Print summary
        logger.info("\n" + "="*80)
        logger.info("TRAINING COMPLETE!")
        logger.info("="*80)
        logger.info(f"✓ Total items trained: {len(combined_df)}")
        logger.info(f"  - Hotels: {config['num_hotels']}")
        logger.info(f"  - Attractions: {config['num_attractions']}")
        logger.info(f"✓ Embedding dimension: {config['embedding_dim']}")
        logger.info(f"✓ Model: {self.model_name}")
        logger.info(f"\nFiles saved to: {self.models_dir}")
        logger.info(f"  - travello_embeddings.npy")
        logger.info(f"  - travello_metadata.csv")
        logger.info(f"  - travello_config.json")
        logger.info("\nNext: Use RecommendationEngine to get recommendations!")
        
        return embeddings, combined_df, config


def main():
    """Run training pipeline"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Train Travello ML model')
    parser.add_argument(
        '--model',
        type=str,
        default='distilbert-base-uncased',
        choices=['distilbert-base-uncased', 'distilroberta-base'],
        help='Model to use for embeddings'
    )
    
    args = parser.parse_args()
    
    try:
        trainer = TravelloMLTrainer(model_name=args.model)
        embeddings, data, config = trainer.train_and_save()
        
        logger.info("\n✅ SUCCESS! Model trained and saved.")
        logger.info(f"\nTo use the model:")
        logger.info(f"  from ml_system.training.recommendation_engine import RecommendationEngine")
        logger.info(f"  engine = RecommendationEngine()")
        logger.info(f"  results = engine.recommend('luxury hotel near Badshahi Mosque', top_n=5)")
        
    except Exception as e:
        logger.error(f"\n❌ Training failed: {e}")
        raise


if __name__ == '__main__':
    main()
