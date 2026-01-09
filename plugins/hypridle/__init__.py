"""
Hypridle Plugin - Configuration editor for Hyprland's idle daemon.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup
from plugins.hyprland.helpers.hyprlang import HyprLang
import os

hypridle_router = APIRouter(prefix="/hypridle", tags=["hypridle"])

# Register navigation
register_navigation(
    items=[NavItem(id="hypridle", title="Hypridle", url="/hypridle", icon="hypridle", group="config", order=40)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

CONFIG_PATH = os.path.expanduser("~/.config/hypr/hypridle.conf")


# ========== Models ==========

class GeneralConfig(BaseModel):
    lock_cmd: str = ""
    unlock_cmd: str = ""
    before_sleep_cmd: str = ""
    after_sleep_cmd: str = ""
    ignore_dbus_inhibit: bool = False


class Listener(BaseModel):
    id: Optional[str] = None  # For frontend tracking
    timeout: int = 300  # seconds
    on_timeout: str = ""
    on_resume: str = ""


class HypridleConfig(BaseModel):
    general: GeneralConfig = GeneralConfig()
    listeners: List[Listener] = []


# ========== Routes ==========

@hypridle_router.get("", response_class=HTMLResponse)
async def hypridle_page():
    parser = Parser(path="hypridle.pypx")
    parser.render(context=get_context({
        "current_page": "hypridle",
        "page_title": "ArchBoard - Hypridle Settings",
        "page_header": "Hypridle Settings",
        "page_description": "Configure Hypridle idle management",
    }))
    return HTMLResponse(parser.html_content)


@hypridle_router.get("/config", response_model=HypridleConfig)
def get_config():
    """Parse and return current hypridle config."""
    if not os.path.exists(CONFIG_PATH):
        return HypridleConfig()
    
    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()
        
        config = HypridleConfig()
        listener_id = 0
        
        for cat in conf.categories:
            if cat.name == "general":
                data = {}
                for line in cat.lines:
                    key = line.key.replace("-", "_")
                    value = line.value.raw
                    if value.lower() == "true":
                        value = True
                    elif value.lower() == "false":
                        value = False
                    data[key] = value
                config.general = GeneralConfig(**data)
            
            elif cat.name == "listener":
                data = {"id": f"listener_{listener_id}"}
                listener_id += 1
                for line in cat.lines:
                    key = line.key.replace("-", "_")
                    value = line.value.raw
                    if key == "timeout":
                        value = int(value)
                    data[key] = value
                config.listeners.append(Listener(**data))
        
        return config
    except Exception as e:
        print(f"Error parsing hypridle config: {e}")
        return HypridleConfig()


@hypridle_router.post("/config")
def save_config(config: HypridleConfig):
    """Save hypridle config to file."""
    lines = []
    
    # General section
    lines.append("general {")
    if config.general.lock_cmd:
        lines.append(f"    lock_cmd = {config.general.lock_cmd}")
    if config.general.unlock_cmd:
        lines.append(f"    unlock_cmd = {config.general.unlock_cmd}")
    if config.general.before_sleep_cmd:
        lines.append(f"    before_sleep_cmd = {config.general.before_sleep_cmd}")
    if config.general.after_sleep_cmd:
        lines.append(f"    after_sleep_cmd = {config.general.after_sleep_cmd}")
    if config.general.ignore_dbus_inhibit:
        lines.append(f"    ignore_dbus_inhibit = true")
    lines.append("}")
    lines.append("")
    
    # Listeners
    for listener in config.listeners:
        lines.append("listener {")
        lines.append(f"    timeout = {listener.timeout}")
        if listener.on_timeout:
            lines.append(f"    on-timeout = {listener.on_timeout}")
        if listener.on_resume:
            lines.append(f"    on-resume = {listener.on_resume}")
        lines.append("}")
        lines.append("")
    
    try:
        with open(CONFIG_PATH, "w") as f:
            f.write("\n".join(lines))
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
