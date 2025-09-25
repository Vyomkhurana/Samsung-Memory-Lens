#!/usr/bin/env python3
"""
Real Semantic Search using Sentence Transformers
This will automatically understand semantic relationships like:
- "tyres" → finds car images
- "steering wheel" → finds car images  
- "bark" → finds dog images
- "whiskers" → finds cat images
- etc.
"""

import sys
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import warnings
warnings.filterwarnings('ignore')

# Global model - load once for efficiency
model = None

def load_model():
    """Load the sentence transformer model"""
    global model
    if model is None:
        try:
            # Use a fast, lightweight model that's good for semantic similarity
            model = SentenceTransformer('all-MiniLM-L6-v2')
            print("✅ Semantic search model loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"❌ Error loading model: {e}", file=sys.stderr)
            return False
    return True

def compute_semantic_similarity(query_text, image_labels, image_texts=None, celebrities=None):
    """
    Compute semantic similarity between query and image content
    Returns a similarity score between 0 and 1
    """
    if not load_model():
        return 0.0
    
    try:
        # Combine all image content
        image_content = []
        
        # Add labels
        if image_labels:
            image_content.extend(image_labels)
        
        # Add OCR text
        if image_texts:
            image_content.extend(image_texts)
            
        # Add celebrity names
        if celebrities:
            image_content.extend(celebrities)
        
        if not image_content:
            return 0.0
        
        # Create combined text for the image
        image_description = " ".join(image_content)
        
        # Compute embeddings
        query_embedding = model.encode([query_text])
        image_embedding = model.encode([image_description])
        
        # Compute cosine similarity
        similarity = np.dot(query_embedding[0], image_embedding[0]) / (
            np.linalg.norm(query_embedding[0]) * np.linalg.norm(image_embedding[0])
        )
        
        # Ensure similarity is between 0 and 1
        similarity = max(0.0, min(1.0, similarity))
        
        return float(similarity)
        
    except Exception as e:
        print(f"❌ Error computing similarity: {e}", file=sys.stderr)
        return 0.0

def batch_semantic_search(query_text, images_data):
    """
    Perform semantic search on a batch of images
    Returns list of (image_index, similarity_score) tuples
    """
    if not load_model():
        return []
    
    results = []
    
    for i, image_data in enumerate(images_data):
        similarity = compute_semantic_similarity(
            query_text,
            image_data.get('labels', []),
            image_data.get('texts', []),
            image_data.get('celebrities', [])
        )
        
        if similarity > 0.1:  # Only include reasonably similar results
            results.append((i, similarity))
    
    # Sort by similarity (highest first)
    results.sort(key=lambda x: x[1], reverse=True)
    
    return results

def main():
    """Main function for command line usage"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        query = input_data.get('query', '')
        images = input_data.get('images', [])
        
        if not query:
            print(json.dumps({'error': 'No query provided'}))
            return
        
        # Perform semantic search
        results = batch_semantic_search(query, images)
        
        # Format results
        output = {
            'query': query,
            'results': [
                {
                    'image_index': idx,
                    'similarity_score': score
                }
                for idx, score in results[:20]  # Top 20 results
            ]
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == "__main__":
    main()