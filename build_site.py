#!/usr/bin/env python3
import os
import shutil

def build():
    os.makedirs('dist', exist_ok=True)
    
    if not os.path.exists('dist/index.html'):
        print("Error: dist/index.html not found")
        return False
    
    print("✓ Static site ready in dist/")
    print("✓ index.html found")
    return True

if __name__ == "__main__":
    success = build()
    exit(0 if success else 1)