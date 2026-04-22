import sys
import os
sys.path.insert(0, os.path.abspath('.'))

try:
    from app.main import app
    print("Backend imported successfully!")
except Exception as e:
    print(f"Backend import failed: {e}")
    import traceback
    traceback.print_exc()
