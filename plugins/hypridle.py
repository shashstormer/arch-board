"""
Hypridle configuration router.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup

hypridle_router = APIRouter(prefix="/hypridle", tags=["hypridle"])

# Register navigation
register_navigation(
    items=[NavItem(id="hypridle", title="Hypridle", url="/hypridle", icon="config", group="config", order=40)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

@hypridle_router.get("", response_class=HTMLResponse)
async def hypridle_page():
    parser = Parser(path="hypridle.pypx")
    parser.render(context=get_context({
        "current_page": "hypridle",
        "page_title": "ArchBoard - Hypridle Settings",
        "page_header": "Hypridle Settings",
        "page_description": "Configure Hypridle settings",
    }))
    return HTMLResponse(parser.html_content)
