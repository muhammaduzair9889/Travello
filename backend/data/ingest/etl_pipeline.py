"""
ETL Pipeline for Travello ML System

This module handles data ingestion, cleaning, validation, and preprocessing
for hotels, POIs, and user interaction data.

Features:
- CSV loading with schema validation
- Text normalization (unicode, lowercase, whitespace)
- Geohash generation for lat/lon coordinates
- Deduplication based on name + location
- Search text generation for semantic search
- Data quality checks and logging
"""

import pandas as pd
import numpy as np
import json
import logging
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import unicodedata
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ETLPipeline:
    """Main ETL pipeline for processing raw datasets"""
    
    def __init__(self, data_dir: str = None):
        """Initialize ETL pipeline with data directories"""
        if data_dir is None:
            # Get backend directory
            backend_dir = Path(__file__).parent.parent.parent
            data_dir = backend_dir / "data"
        
        self.data_dir = Path(data_dir)
        self.raw_dir = self.data_dir / "datasets"
        self.processed_dir = self.data_dir / "processed"
        self.ingest_dir = self.data_dir / "ingest"
        
        # Create directories if they don't exist
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.ingest_dir.mkdir(parents=True, exist_ok=True)
        
        # Expected schemas
        self.hotels_schema = {
            'required': ['id', 'name', 'description', 'city', 'lat', 'lon'],
            'optional': ['tags', 'category', 'price_pkr', 'rating', 'availability', 'images', 'owner_id']
        }
        
        self.events_schema = {
            'required': ['event_id', 'user_id', 'item_id', 'event_type', 'timestamp'],
            'optional': ['session_id', 'rating', 'duration_seconds']
        }
    
    def normalize_text(self, text: str) -> str:
        """
        Normalize text: remove extra whitespace, convert to lowercase,
        normalize unicode characters
        """
        if pd.isna(text) or not isinstance(text, str):
            return ""
        
        # Normalize unicode (NFD decomposition)
        text = unicodedata.normalize('NFD', text)
        text = text.encode('ascii', 'ignore').decode('utf-8')
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def generate_geohash(self, lat: float, lon: float, precision: int = 8) -> str:
        """
        Generate geohash for coordinates (simplified version)
        For production, use python-geohash library
        """
        try:
            # Simple grid-based hash for demo
            lat_grid = int((lat + 90) * 100)
            lon_grid = int((lon + 180) * 100)
            return f"{lat_grid:05d}_{lon_grid:06d}"
        except:
            return ""
    
    def create_search_text(self, row: pd.Series) -> str:
        """
        Create search text by combining relevant fields
        """
        parts = []
        
        # Add name
        if 'name' in row and row['name']:
            parts.append(self.normalize_text(str(row['name'])))
        
        # Add description
        if 'description' in row and row['description']:
            parts.append(self.normalize_text(str(row['description'])))
        
        # Add tags
        if 'tags' in row and row['tags']:
            tags = self.normalize_text(str(row['tags']))
            parts.append(tags.replace(',', ' '))
        
        # Add category
        if 'category' in row and row['category']:
            parts.append(self.normalize_text(str(row['category'])))
        
        # Add city
        if 'city' in row and row['city']:
            parts.append(self.normalize_text(str(row['city'])))
        
        return ' '.join(parts)
    
    def generate_item_hash(self, row: pd.Series) -> str:
        """
        Generate unique hash for deduplication based on name + location
        """
        key_parts = []
        
        if 'name' in row:
            key_parts.append(self.normalize_text(str(row['name'])))
        
        if 'lat' in row and 'lon' in row:
            key_parts.append(f"{row['lat']:.4f}_{row['lon']:.4f}")
        
        key = "_".join(key_parts)
        return hashlib.md5(key.encode()).hexdigest()[:16]
    
    def validate_schema(self, df: pd.DataFrame, schema: Dict) -> Tuple[bool, List[str]]:
        """
        Validate dataframe against expected schema
        Returns (is_valid, list_of_errors)
        """
        errors = []
        
        # Check required columns
        missing_cols = set(schema['required']) - set(df.columns)
        if missing_cols:
            errors.append(f"Missing required columns: {missing_cols}")
        
        # Check for empty required fields
        for col in schema['required']:
            if col in df.columns:
                null_count = df[col].isna().sum()
                if null_count > 0:
                    errors.append(f"Column '{col}' has {null_count} null values")
        
        is_valid = len(errors) == 0
        return is_valid, errors
    
    def process_hotels_pois(self, input_file: str = None) -> pd.DataFrame:
        """
        Process hotels and POIs dataset
        
        Steps:
        1. Load CSV
        2. Validate schema
        3. Normalize text fields
        4. Generate geohashes
        5. Create search text
        6. Deduplicate
        7. Add metadata
        """
        logger.info("=" * 80)
        logger.info("PROCESSING HOTELS & POIS DATASET")
        logger.info("=" * 80)
        
        # Load data
        if input_file is None:
            input_file = self.raw_dir / "hotels_pois.csv"
        
        logger.info(f"Loading data from: {input_file}")
        
        try:
            df = pd.read_csv(input_file, encoding='utf-8')
            logger.info(f"✓ Loaded {len(df)} records")
        except FileNotFoundError:
            logger.error(f"❌ File not found: {input_file}")
            logger.info("\n📋 Expected CSV format:")
            logger.info("id,name,description,tags,category,city,lat,lon,price_pkr,rating,availability,images,owner_id")
            logger.info("\nPlace your hotels_pois.csv in: backend/data/datasets/")
            return None
        except Exception as e:
            logger.error(f"❌ Error loading CSV: {e}")
            return None
        
        # Validate schema
        logger.info("\nValidating schema...")
        is_valid, errors = self.validate_schema(df, self.hotels_schema)
        if not is_valid:
            logger.warning(f"⚠️ Schema validation warnings:")
            for error in errors:
                logger.warning(f"  - {error}")
        else:
            logger.info("✓ Schema validation passed")
        
        # Normalize text fields
        logger.info("\nNormalizing text fields...")
        text_fields = ['name', 'description', 'tags', 'category', 'city']
        for field in text_fields:
            if field in df.columns:
                df[f'{field}_normalized'] = df[field].apply(self.normalize_text)
                logger.info(f"✓ Normalized '{field}'")
        
        # Generate geohashes
        logger.info("\nGenerating geohashes...")
        if 'lat' in df.columns and 'lon' in df.columns:
            df['geohash'] = df.apply(
                lambda row: self.generate_geohash(row['lat'], row['lon']),
                axis=1
            )
            logger.info(f"✓ Generated geohashes for {len(df)} records")
        
        # Create search text
        logger.info("\nCreating search text...")
        df['search_text'] = df.apply(self.create_search_text, axis=1)
        logger.info(f"✓ Created search text (avg length: {df['search_text'].str.len().mean():.0f} chars)")
        
        # Deduplicate
        logger.info("\nDeduplicating records...")
        initial_count = len(df)
        df['item_hash'] = df.apply(self.generate_item_hash, axis=1)
        df = df.drop_duplicates(subset=['item_hash'], keep='first')
        duplicates_removed = initial_count - len(df)
        logger.info(f"✓ Removed {duplicates_removed} duplicates ({len(df)} unique records remain)")
        
        # Add processing metadata
        df['processed_at'] = datetime.now().isoformat()
        df['data_version'] = '1.0'
        
        # Data quality summary
        logger.info("\n" + "=" * 80)
        logger.info("DATA QUALITY SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total records: {len(df)}")
        logger.info(f"Unique items: {df['item_hash'].nunique()}")
        
        if 'city' in df.columns:
            logger.info(f"Cities: {df['city'].nunique()}")
            logger.info(f"Top cities: {df['city'].value_counts().head(3).to_dict()}")
        
        if 'category' in df.columns:
            logger.info(f"Categories: {df['category'].nunique()}")
            logger.info(f"Category distribution: {df['category'].value_counts().to_dict()}")
        
        if 'price_pkr' in df.columns:
            logger.info(f"Price range: PKR {df['price_pkr'].min():.0f} - {df['price_pkr'].max():.0f}")
            logger.info(f"Average price: PKR {df['price_pkr'].mean():.0f}")
        
        if 'rating' in df.columns:
            logger.info(f"Average rating: {df['rating'].mean():.2f}")
        
        # Save processed data
        output_file = self.processed_dir / "hotels_pois_processed.csv"
        df.to_csv(output_file, index=False, encoding='utf-8')
        logger.info(f"\n✓ Saved processed data to: {output_file}")
        
        # Save metadata
        metadata = {
            'source_file': str(input_file),
            'processed_at': datetime.now().isoformat(),
            'total_records': len(df),
            'unique_items': int(df['item_hash'].nunique()),
            'duplicates_removed': int(duplicates_removed),
            'columns': list(df.columns),
            'data_version': '1.0'
        }
        
        metadata_file = self.processed_dir / "hotels_pois_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"✓ Saved metadata to: {metadata_file}")
        
        return df
    
    def process_user_events(self, input_file: str = None) -> pd.DataFrame:
        """
        Process user interaction events dataset
        
        Steps:
        1. Load CSV
        2. Validate schema
        3. Parse timestamps
        4. Validate event types
        5. Sort by timestamp
        6. Add session metadata
        """
        logger.info("\n" + "=" * 80)
        logger.info("PROCESSING USER EVENTS DATASET")
        logger.info("=" * 80)
        
        # Load data
        if input_file is None:
            input_file = self.raw_dir / "user_events.csv"
        
        logger.info(f"Loading data from: {input_file}")
        
        try:
            df = pd.read_csv(input_file, encoding='utf-8')
            logger.info(f"✓ Loaded {len(df)} events")
        except FileNotFoundError:
            logger.warning(f"⚠️ File not found: {input_file}")
            logger.info("\n📋 Expected CSV format:")
            logger.info("event_id,user_id,item_id,event_type,timestamp,session_id,rating,duration_seconds")
            logger.info("\nThis dataset is optional. You can generate synthetic events later.")
            return None
        except Exception as e:
            logger.error(f"❌ Error loading CSV: {e}")
            return None
        
        # Validate schema
        logger.info("\nValidating schema...")
        is_valid, errors = self.validate_schema(df, self.events_schema)
        if not is_valid:
            logger.warning(f"⚠️ Schema validation warnings:")
            for error in errors:
                logger.warning(f"  - {error}")
        else:
            logger.info("✓ Schema validation passed")
        
        # Parse timestamps
        logger.info("\nParsing timestamps...")
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        invalid_timestamps = df['timestamp'].isna().sum()
        if invalid_timestamps > 0:
            logger.warning(f"⚠️ Found {invalid_timestamps} invalid timestamps")
            df = df[df['timestamp'].notna()]
        logger.info(f"✓ Parsed {len(df)} valid timestamps")
        
        # Validate event types
        valid_event_types = ['search', 'view', 'click', 'booking', 'rating']
        if 'event_type' in df.columns:
            invalid_events = df[~df['event_type'].isin(valid_event_types)]
            if len(invalid_events) > 0:
                logger.warning(f"⚠️ Found {len(invalid_events)} invalid event types")
                logger.warning(f"Valid types: {valid_event_types}")
            
            logger.info(f"Event type distribution:")
            for event_type, count in df['event_type'].value_counts().items():
                logger.info(f"  - {event_type}: {count}")
        
        # Sort by timestamp
        logger.info("\nSorting events chronologically...")
        df = df.sort_values('timestamp').reset_index(drop=True)
        logger.info(f"✓ Sorted {len(df)} events")
        
        # Add processing metadata
        df['processed_at'] = datetime.now().isoformat()
        
        # Events summary
        logger.info("\n" + "=" * 80)
        logger.info("EVENTS SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total events: {len(df)}")
        logger.info(f"Unique users: {df['user_id'].nunique()}")
        logger.info(f"Unique items: {df['item_id'].nunique()}")
        logger.info(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        
        if 'session_id' in df.columns:
            logger.info(f"Unique sessions: {df['session_id'].nunique()}")
            avg_events_per_session = len(df) / df['session_id'].nunique()
            logger.info(f"Avg events per session: {avg_events_per_session:.2f}")
        
        # Save processed data
        output_file = self.processed_dir / "user_events_processed.csv"
        df.to_csv(output_file, index=False, encoding='utf-8')
        logger.info(f"\n✓ Saved processed data to: {output_file}")
        
        # Save metadata
        metadata = {
            'source_file': str(input_file),
            'processed_at': datetime.now().isoformat(),
            'total_events': len(df),
            'unique_users': int(df['user_id'].nunique()),
            'unique_items': int(df['item_id'].nunique()),
            'event_types': df['event_type'].value_counts().to_dict(),
            'date_range': {
                'start': str(df['timestamp'].min()),
                'end': str(df['timestamp'].max())
            },
            'columns': list(df.columns)
        }
        
        metadata_file = self.processed_dir / "user_events_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"✓ Saved metadata to: {metadata_file}")
        
        return df
    
    def run_full_pipeline(self):
        """
        Run complete ETL pipeline for all datasets
        """
        logger.info("\n" + "=" * 80)
        logger.info("TRAVELLO ETL PIPELINE - STARTING")
        logger.info("=" * 80)
        logger.info(f"Data directory: {self.data_dir}")
        logger.info(f"Raw data: {self.raw_dir}")
        logger.info(f"Processed data: {self.processed_dir}")
        logger.info("")
        
        # Process hotels and POIs
        hotels_df = self.process_hotels_pois()
        
        # Process user events
        events_df = self.process_user_events()
        
        # Final summary
        logger.info("\n" + "=" * 80)
        logger.info("ETL PIPELINE COMPLETE")
        logger.info("=" * 80)
        
        if hotels_df is not None:
            logger.info(f"✓ Hotels/POIs: {len(hotels_df)} records processed")
        else:
            logger.warning("⚠️ Hotels/POIs: No data processed")
        
        if events_df is not None:
            logger.info(f"✓ User Events: {len(events_df)} events processed")
        else:
            logger.warning("⚠️ User Events: No data processed (optional)")
        
        logger.info(f"\nProcessed data saved to: {self.processed_dir}")
        logger.info("\nNext steps:")
        logger.info("1. Review processed data in backend/data/processed/")
        logger.info("2. Generate embeddings: python ml_system/embeddings/generate_embeddings.py")
        logger.info("3. Build vector index: python ml_system/retrieval/build_index.py")
        logger.info("")
        
        return hotels_df, events_df


def main():
    """Main entry point for ETL pipeline"""
    pipeline = ETLPipeline()
    pipeline.run_full_pipeline()


if __name__ == '__main__':
    main()
