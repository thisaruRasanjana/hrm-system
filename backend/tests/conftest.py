"""
Pytest configuration — backend test suite.

Adds the backend directory to sys.path so that 'from app.x import y'
works correctly without installing the package.
"""
import sys
import os

# Insert the backend root directory at the front of the module search path.
# This allows tests to import 'app.*' modules directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
