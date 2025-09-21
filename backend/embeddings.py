# embeddings.py
import sys
import json
from sentence_transformers import SentenceTransformer

# Load the model once
model = SentenceTransformer("all-MiniLM-L6-v2")

# Read text from stdin
text = sys.stdin.read().strip()

# Generate embedding
embedding = model.encode([text])[0].tolist()

# Return as JSON
print(json.dumps(embedding))