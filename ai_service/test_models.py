import os
from google import genai

try:
    client = genai.Client(api_key="AIzaSyD_DM24IkarGsWZjKPJvcSgrf0eRPgtH5o")
    print("Available models:")
    for m in client.models.list():
        print(m.name)
except Exception as e:
    print(f"Error: {e}")
