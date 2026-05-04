"""
Diagnostic script — lists all Gemini models available for this API key
and shows which ones support generateContent.
Run: python3 list_models.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)

import google.generativeai as genai

api_key = os.getenv("GEMINI_API_KEY", "")
if not api_key:
    print("ERROR: No GEMINI_API_KEY found in .env")
    exit(1)

genai.configure(api_key=api_key)

print(f"API Key: {api_key[:10]}...{api_key[-4:]}\n")
print("Available models that support generateContent:\n")

try:
    for m in genai.list_models():
        if "generateContent" in m.supported_generation_methods:
            print(f"  ✓ {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
