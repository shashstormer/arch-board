"""
Wpaperd (wallpaper daemon) configuration router.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Dict, List, Optional, Any, Literal
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup
import os
import subprocess
import tomllib
import tomli_w

wpaperd_router = APIRouter(prefix="/wpaperd", tags=["wpaperd"])

# Register navigation
register_navigation(
    items=[NavItem(id="wpaperd", title="Wpaperd", url="/wpaperd", icon="wpaperd", group="config", order=50)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

CONFIG_PATH = os.path.expanduser("~/.config/wpaperd/config.toml")


# ========== Models ==========

class DisplayConfig(BaseModel):
    path: str = ""
    duration: Optional[str] = None
    sorting: Optional[str] = None  # ascending, descending, random
    mode: Optional[Literal["fit", "fit-border-color", "center", "stretch", "tile"]] = None
    transition_time: Optional[int] = None
    recursive: Optional[bool] = None
    initial_transition: Optional[bool] = None
    group: Optional[int] = None
    queue_size: Optional[int] = None
    offset: Optional[float] = None
    exec: Optional[str] = None


class WpaperdConfig(BaseModel):
    displays: Dict[str, DisplayConfig] = {}


class ControlRequest(BaseModel):
    action: Literal["next", "previous", "pause", "resume", "toggle-pause"]
    display: Optional[str] = None


# ========== Routes ==========

@wpaperd_router.get("", response_class=HTMLResponse)
async def wpaperd_page():
    parser = Parser(path="wpaperd.pypx")
    parser.render(context=get_context({
        "current_page": "wpaperd",
        "page_title": "ArchBoard - Wpaperd Settings",
        "page_header": "Wpaperd Settings",
        "page_description": "Configure and manage wallpaper daemon",
    }))
    return HTMLResponse(parser.html_content)


@wpaperd_router.get("/config")
def get_config():
    """Parse and return current wpaperd config."""
    if not os.path.exists(CONFIG_PATH):
        return {"displays": {}}
    
    try:
        with open(CONFIG_PATH, "rb") as f:
            data = tomllib.load(f)

        displays = {}
        for section, values in data.items():
            if isinstance(values, dict):
                if "transition" in values:
                    del values["transition"] # Later
                normalized = {}
                for k, v in values.items():
                    normalized[k.replace("-", "_")] = v
                displays[section] = normalized
        
        return {"displays": displays}
    except Exception as e:
        print(f"Error parsing wpaperd config: {e}")
        return {"displays": {}}


@wpaperd_router.post("/config")
def save_config(config: WpaperdConfig):
    """Save wpaperd config to file."""
    try:
        data = {}
        for display, settings in config.displays.items():
            if os.path.exists(settings.path) and os.path.isfile(settings.path):
                settings.duration = None
                settings.sorting = None
                settings.transition_time = None
                settings.recursive = None
            section = {}
            for key, value in settings.model_dump(exclude_none=True).items():
                toml_key = key.replace("_", "-")
                section[toml_key] = value
            if section:
                data[display] = section

        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)

        with open(CONFIG_PATH, "wb") as f:
            tomli_w.dump(data, f)
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@wpaperd_router.get("/monitors")
def get_monitors():
    """Get list of available monitors from Hyprland."""
    try:
        result = subprocess.run(
            ["hyprctl", "monitors", "-j"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            import json
            monitors = json.loads(result.stdout)
            return {
                "monitors": [
                    {
                        "name": m.get("name", ""),
                        "description": m.get("description", ""),
                        "width": m.get("width", 0),
                        "height": m.get("height", 0),
                    }
                    for m in monitors
                ]
            }
        return {"monitors": []}
    except Exception as e:
        print(f"Error getting monitors: {e}")
        return {"monitors": []}


@wpaperd_router.post("/control")
def control_wpaperd(req: ControlRequest):
    """Run wpaperctl commands."""
    valid_actions = ["next", "previous", "pause", "resume", "toggle-pause"]
    if req.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {valid_actions}")
    
    try:
        cmd = ["wpaperctl", req.action]
        if req.display:
            cmd.extend(["--display", req.display])
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        return {
            "status": "success" if result.returncode == 0 else "error",
            "output": result.stdout,
            "error": result.stderr
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@wpaperd_router.post("/restart")
def restart_wpaperd():
    """Restart wpaperd daemon."""
    import time
    try:
        subprocess.run(["pkill", "-x", "wpaperd"], capture_output=True)
        time.sleep(0.3)
        subprocess.Popen(
            "nohup wpaperd > /dev/null 2>&1 &",
            shell=True,
            start_new_session=True
        )
        return {"status": "success", "message": "Wpaperd restarted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@wpaperd_router.get("/current")
def get_current_wallpapers():
    """Get current wallpapers using wpaperctl."""
    current = {}
    
    try:
        result = subprocess.run(
            ["wpaperctl", "all-wallpapers"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if ": " in line:
                    monitor, path = line.split(": ", 1)
                    current[monitor] = path
    except Exception as e:
        print(f"Error getting current wallpapers: {e}")
    
    return {"current": current}


@wpaperd_router.get("/status")
def get_status():
    """Get running/paused status for all displays."""
    status = {}
    
    try:
        result = subprocess.run(
            ["wpaperctl", "get-status"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if ": " in line:
                    monitor, state = line.split(": ", 1)
                    status[monitor] = state
    except Exception as e:
        print(f"Error getting wpaperd status: {e}")
    
    return {"status": status}


@wpaperd_router.get("/preview")
def get_preview(path: str):
    """Serve wallpaper image preview from filesystem path."""
    from fastapi.responses import FileResponse
    import mimetypes
    
    # Resolve symlinks
    real_path = os.path.realpath(path)
    
    if os.path.exists(real_path) and os.path.isfile(real_path):
        mime, _ = mimetypes.guess_type(real_path)
        return FileResponse(real_path, media_type=mime or "image/png")
    
    raise HTTPException(404, "Image not found")
