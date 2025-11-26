"""Health check endpoint for bar-server"""

def add_health_endpoint(app):
    """Add a health check endpoint to the FastAPI app"""

    @app.get("/health")
    async def health():
        """Health check endpoint"""
        return {"status": "healthy", "service": "bar-server"}
