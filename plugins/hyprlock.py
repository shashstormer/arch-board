"""
Hyprlock configuration router.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup

hyprlock_router = APIRouter(prefix="/hyprlock", tags=["hyprlock"])

# Register navigation
register_navigation(
    items=[NavItem(id="hyprlock", title="Hyprlock", url="/hyprlock", icon="config", group="config", order=30)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

@hyprlock_router.get("", response_class=HTMLResponse)
async def hyprlock_page():
    parser = Parser(path="hyprlock.pypx")
    parser.render(context=get_context({
        "current_page": "hyprlock",
        "page_title": "ArchBoard - Hyprlock Settings",
        "page_header": "Hyprlock Settings",
        "page_description": "Configure Hyprlock settings",
    }))
    return HTMLResponse(parser.html_content)
