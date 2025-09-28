#!/usr/bin/env python3
"""
SentenceTransformer embeddings for semantic image search
Uses all-MiniLM-L6-v2 model (384 dimensions)
"""

import sys
import json

try:
    from sentence_transformers import SentenceTransformer
    
    # Load the model once
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    def get_embedding(text):
        """Get SentenceTransformer embedding"""
        embedding = model.encode(text)
        return embedding.tolist()
        
except ImportError:
    # Fallback to simple hash-based embeddings if SentenceTransformer not available
    import hashlib
    
    def get_embedding(text, dimensions=384):
        """
        Create a simple hash-based embedding for text matching.
        Fallback when SentenceTransformer is not available.
        """
        text = text.lower().strip()
        embedding = []
        words = text.split()
        
        for i in range(dimensions):
            seed_text = f"{text}_{i}"
            if i < len(words):
                seed_text += f"_{words[i]}"
            
            hash_val = int(hashlib.md5(seed_text.encode()).hexdigest()[:8], 16)
            normalized = (hash_val % 2000 - 1000) / 1000.0
            embedding.append(normalized)
        
        return embedding

def main():
    try:
        # Read text from stdin
        text = sys.stdin.read().strip()
        if text:
            # Generate embedding
            embedding = get_embedding(text)
            # Output as JSON
            print(json.dumps(embedding))
            sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()