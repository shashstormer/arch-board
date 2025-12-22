from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from utils.lib.background import bg_service
from utils.plugins_frontend import register_navigation, NavItem
from utils.config import get_context
from xtracto import Parser

system_router = APIRouter()

# Register navigation for system
register_navigation([
    NavItem(id="system", title="System", url="/system", icon="system", order=100)
])

# Page route
@system_router.get("/system", response_class=HTMLResponse)
async def system_page():
    parser = Parser(path="system.pypx")
    parser.render(context=get_context({
        "current_page": "system",
        "page_title": "ArchBoard - System Settings",
        "page_header": "System Settings",
        "page_description": "Configure system settings",
    }))
    return HTMLResponse(parser.html_content)

@system_router.get("/system/info")
async def system_info():
    return bg_service.get("system_info", {})
