import os
import importlib
from typing import Dict, List
from fastapi import APIRouter
from requestez.helpers import get_logger, error
from logging import Logger

get_logger().logger = Logger("arch_board")

def list_plugins() -> Dict[str, str]:
    final_plugins = {}
    plugins = []
    if os.path.exists("plugins.txt"):
        with open("plugins.txt") as f:
            plugins = [line.strip() for line in f.read().splitlines()]
            for line in plugins:
                if line.startswith("#"): continue
                line = line.split("=", 1)
                if len(line) != 2: continue
                final_plugins["plugins."+line[0].strip()] = line[1].strip()  # plugin_name, router name
    default_routers = ["dashboard", "hyprland", "waybar", "hyprlock", "hypridle", "wpaperd", "system", "presets", "static", "navigation"]
    for router in default_routers:
        if "exclude:router:"+router in plugins:
            continue
        final_plugins["routers."+router] = router+"_router"
    return final_plugins

def get_routers() -> List[APIRouter]:
    """
    Load all the plugins in plugins.txt from the plugins directory
    :return:
    """
    plugins = list_plugins()
    routers = []
    for plugin_name, router_name in plugins.items():
        try:
            module = importlib.import_module(plugin_name)
            routers.append(getattr(module, router_name))
        except Exception as e:
            error(f"Failed to load plugin {plugin_name}: {e}")
    return routers


