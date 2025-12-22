"""
Dashboard router - serves the home page.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem

dashboard_router = APIRouter()

# Register navigation
register_navigation([
    NavItem(id="home", title="Dashboard", url="/", icon="dashboard", order=1)
])

@dashboard_router.get("/", response_class=HTMLResponse)
async def read_root():
    parser = Parser(path="index.pypx")
    parser.render(context=get_context({
        "current_page": "home",
        "page_title": "ArchBoard - Dashboard",
        "page_header": "Dashboard",
        "page_description": "System overview and quick actions",
    }))
    return HTMLResponse(parser.html_content)
