"""
Wpaperd (wallpaper daemon) configuration router.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup

wpaperd_router = APIRouter(prefix="/wpaperd", tags=["wpaperd"])

# Register navigation
register_navigation(
    items=[NavItem(id="wpaperd", title="Wpaperd", url="/wpaperd", icon="config", group="config", order=50)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

@wpaperd_router.get("", response_class=HTMLResponse)
async def wpaperd_page():
    parser = Parser(path="wpaperd.pypx")
    parser.render(context=get_context({
        "current_page": "wpaperd",
        "page_title": "ArchBoard - Wpaperd Settings",
        "page_header": "Wpaperd Settings",
        "page_description": "Configure Wpaperd settings",
    }))
    return HTMLResponse(parser.html_content)
