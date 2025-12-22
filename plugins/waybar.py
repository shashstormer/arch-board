"""
Waybar configuration router.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup

waybar_router = APIRouter(prefix="/waybar", tags=["waybar"])

# Register navigation
register_navigation(
    items=[NavItem(id="waybar", title="Waybar", url="/waybar", icon="config", group="config", order=20)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

@waybar_router.get("", response_class=HTMLResponse)
async def waybar_page():
    parser = Parser(path="waybar.pypx")
    parser.render(context=get_context({
        "current_page": "waybar",
        "page_title": "ArchBoard - Waybar Settings",
        "page_header": "Waybar Settings",
        "page_description": "Configure Waybar settings",
    }))
    return HTMLResponse(parser.html_content)
