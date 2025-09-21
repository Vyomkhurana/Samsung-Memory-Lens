# embeddings.py - Lightweight version for OnRender 512MB limit
import sys
import json
import hashlib

def create_simple_embedding(text, dimensions=384):
    """
    Create a simple hash-based embedding for text matching.
    This replaces sentence-transformers to stay within memory limits.
    """
    # Convert text to lowercase and clean
    text = text.lower().strip()
    
    # Create multiple hash seeds for different dimensions
    embedding = []
    words = text.split()
    
    for i in range(dimensions):
        # Use different combinations of words and positions
        seed_text = f"{text}_{i}"
        if i < len(words):
            seed_text += f"_{words[i]}"
        
        # Create hash and normalize to [-1, 1] range
        hash_val = int(hashlib.md5(seed_text.encode()).hexdigest()[:8], 16)
        normalized = (hash_val % 2000 - 1000) / 1000.0
        embedding.append(normalized)
    
    return embedding

# Read text from stdin
text = sys.stdin.read().strip()

# Generate simple embedding (no ML libraries needed)
embedding = create_simple_embedding(text)

# Return as JSON
print(json.dumps(embedding))