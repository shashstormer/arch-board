"""
Navigation API Router
Provides frontend navigation data.
"""
from fastapi import APIRouter
from utils.plugins_frontend import frontend_registry

navigation_router = APIRouter(prefix="/frontend", tags=["frontend"])


@navigation_router.get("/navigation")
async def get_navigation():
    """
    Get the navigation structure for the sidebar.
    This endpoint is used by the frontend to dynamically render navigation.
    """
    return frontend_registry.get_navigation()
