import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn
uvicorn.run("main:app", host="0.0.0.0", port=8000)
