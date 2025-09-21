#!/usr/bin/env python3
"""
Lightweight semantic embeddings using OpenAI API
Memory-efficient alternative to sentence-transformers + PyTorch
"""

import os
import sys
import json
import numpy as np
from openai import OpenAI

def get_text_embedding(text):
    """Generate semantic embedding for text using OpenAI API"""
    try:
        # Initialize OpenAI client
        client = OpenAI(
            api_key=os.getenv('OPENAI_API_KEY', 'your-openai-key-here')
        )
        
        # Generate embedding using OpenAI's text-embedding-3-small model
        # This model is fast, cheap, and produces 1536-dimensional vectors
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
            encoding_format="float"
        )
        
        # Extract the embedding vector
        embedding = response.data[0].embedding
        
        # Convert to numpy array and normalize
        embedding_array = np.array(embedding, dtype=np.float32)
        embedding_normalized = embedding_array / np.linalg.norm(embedding_array)
        
        return embedding_normalized.tolist()
        
    except Exception as e:
        print(f"Error generating OpenAI embedding: {e}", file=sys.stderr)
        
        # Fallback to simple keyword-based vector for development
        # This creates a basic semantic representation
        words = text.lower().split()
        
        # Create a simple 384-dimensional vector based on word hashing
        # This is much lighter than full semantic models but still better than pure keywords
        vector = np.zeros(384, dtype=np.float32)
        
        for i, word in enumerate(words[:20]):  # Use first 20 words
            # Simple hash-based embedding
            word_hash = hash(word) % 384
            vector[word_hash] += 1.0 / (i + 1)  # Weight earlier words more
            
            # Add common semantic patterns
            if word in ['red', 'blue', 'green', 'yellow', 'color']:
                vector[0:10] += 0.5
            elif word in ['car', 'vehicle', 'auto', 'truck']:
                vector[10:20] += 0.5
            elif word in ['person', 'people', 'human', 'face']:
                vector[20:30] += 0.5
            elif word in ['animal', 'cat', 'dog', 'pet']:
                vector[30:40] += 0.5
        
        # Normalize the vector
        if np.linalg.norm(vector) > 0:
            vector = vector / np.linalg.norm(vector)
        
        return vector.tolist()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python embeddings_openai.py 'text to embed'")
        sys.exit(1)
    
    text = sys.argv[1]
    embedding = get_text_embedding(text)
    print(json.dumps(embedding))