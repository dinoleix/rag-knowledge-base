#!/bin/bash
set -e
pip3 install -r /Users/alexisleishangthem/Downloads/webdeveloper/rag-knowledge-base/backend/requirements.txt -q
cd /Users/alexisleishangthem/Downloads/webdeveloper/rag-knowledge-base/backend
exec uvicorn main:app --reload --port 8000
