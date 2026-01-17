from fastapi import APIRouter, Body
from xtracto import Parser
from fastapi.responses import HTMLResponse
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem
from utils.command import run_command

warp_router = APIRouter(prefix="/warp", tags=["warp"])

register_navigation(
    items=[NavItem(id="warp", title="Warp", url="/warp", icon="warp", group="config", order=50)],
)

@warp_router.get("")
async def warp():
    parser = Parser(path="warp.pypx")
    parser.render(context=get_context({
        "current_page": "warp",
        "page_title": "ArchBoard - Warp Settings",
        "page_header": "Warp Settings",
        "page_description": "connect and disconnect CF warp",
    }))
    return HTMLResponse(parser.html_content)


@warp_router.get("/enabled")
async def warp_enabled():
    output = run_command("warp-cli status | grep 'Status' | awk '{print $3}'")
    enabled = "Connected" in output
    return {"enabled": enabled}

@warp_router.post("/update")
async def update_warp(enabled: bool = Body(..., embed=True)):
    if enabled:
        out, stat =run_command("warp-cli connect")
    else:
        out, stat =run_command("warp-cli disconnect")
    return {"status": "success" if stat == 0 else "failed"}
