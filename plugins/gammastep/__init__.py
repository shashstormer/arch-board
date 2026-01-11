import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
import subprocess

from xtracto import Parser

from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem
from plugins.gammastep.config import gammastep_config

gammastep_router = APIRouter(prefix="/gammastep", tags=["gammastep"])

register_navigation([
    NavItem(
        id="gammastep",
        title="Gammastep",
        url="/gammastep",
        icon="moon",
        group="config",
        order=20
    )
])


class GammastepSettings(BaseModel):
    temp_day: int
    temp_night: int
    fade: str
    location_provider: str
    lat: Optional[float] = 0.0
    lon: Optional[float] = 0.0


@gammastep_router.get("", response_class=HTMLResponse)
async def gammastep_page():
    parser = Parser(path="gammastep.pypx")
    parser.render(context=get_context({
        "current_page": "gammastep",
        "page_title": "ArchBoard - gammastep Settings",
        "page_header": "Gammastep Settings",
        "page_description": "Gammastep management",
    }))
    return HTMLResponse(parser.html_content)


@gammastep_router.get("/config")
def get_config():
    return gammastep_config.get_all()


@gammastep_router.post("/config")
def update_config(settings: GammastepSettings):
    try:
        gammastep_config.update(settings.model_dump())
        if is_running():
            reload_config()
        return {"success": True, "message": "Configuration saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@gammastep_router.get("/status")
def get_status():
    running = is_running()
    return {
        "running": running
    }


@gammastep_router.post("/toggle")
def toggle_status():
    if is_running():
        stop_process()
        return {"running": False, "message": "Gammastep stopped"}
    else:
        start_process()
        return {"running": True, "message": "Gammastep started"}


def is_running():
    try:
        subprocess.check_output(["pgrep", "-x", "gammastep"])
        return True
    except subprocess.CalledProcessError:
        return False

def get_pid():
    return subprocess.check_output(["pgrep", "-x", "gammastep"]).decode("utf-8").strip()

def reload_config():
    # subprocess.run(["kill", "-HUP", get_pid()])
    stop_process()
    start_process()

def stop_process():
    subprocess.run(["pkill", "-9", "gammastep"])
    time.sleep(0.3)


def start_process():
    subprocess.Popen(["gammastep"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
