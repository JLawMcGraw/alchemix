#!/usr/bin/env python3
"""
Wrapper for bar_server.py that adds health endpoint
"""

import os
import logging
from dotenv import load_dotenv
from query_constructor import BarQueryConstructor

# Import the example server factory from parent directory
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from example_server import app as base_app
from health_endpoint import add_health_endpoint

# Load environment variables from a .env file (e.g., for API keys)
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Initialization ---
# 1. Instantiate our custom query constructor.
#    This object will be passed into the application.
logger.info("Initializing BarQueryConstructor...")
bar_constructor = BarQueryConstructor()

# 2. Replace the default query constructor in the base app
# The example_server.py provides a FastAPI app with query_constructor variable
import example_server
example_server.query_constructor = bar_constructor
logger.info("Replaced query constructor with BarQueryConstructor")

# 3. Add health endpoint
add_health_endpoint(base_app)
logger.info("Added health endpoint")

# The FastAPI app instance
app = base_app

# --- Server Entry Point ---
if __name__ == "__main__":
    import uvicorn

    # Get port from environment variables, defaulting to 8001.
    port = int(os.getenv("PORT", 8001))

    # Use Uvicorn, a high-performance ASGI server, to run the app.
    logger.info(f"🍹 Alchemix Bar Assistant Memory Layer starting on http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
