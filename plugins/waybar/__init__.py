"""
Waybar configuration router.
"""
from fastapi import APIRouter, Body
from fastapi.responses import HTMLResponse, JSONResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup, register_search, SearchItem
import os
from utils.jsonc_parser import parse, to_string, set_value, DictNode, ListNode, to_python
from plugins.waybar.helpers.waybar_schema import get_schema_dict, get_module_schema
import subprocess
import psutil
import time
from typing import Optional
from pydantic import BaseModel

# constants
WAYBAR_CONFIG_DIR = os.path.expanduser("~/.config/waybar")
CONFIG_FILE = os.path.join(WAYBAR_CONFIG_DIR, "config")
STYLE_FILE = os.path.join(WAYBAR_CONFIG_DIR, "style.css")

import shutil

# Fallback if config is named config.jsonc
if not os.path.exists(CONFIG_FILE) and os.path.exists(CONFIG_FILE + ".jsonc"):
    CONFIG_FILE = CONFIG_FILE + ".jsonc"


def create_backup():
    """Creates a backup of config and style files if they don't exist."""
    try:
        if os.path.exists(CONFIG_FILE) and not os.path.exists(CONFIG_FILE + ".backup"):
            shutil.copy2(CONFIG_FILE, CONFIG_FILE + ".backup")
        if os.path.exists(STYLE_FILE) and not os.path.exists(STYLE_FILE + ".backup"):
            shutil.copy2(STYLE_FILE, STYLE_FILE + ".backup")
    except Exception as e:
        print(f"Waybar Backup Failed: {e}")


create_backup()

waybar_router = APIRouter(prefix="/waybar", tags=["waybar"])

# Register navigation
register_navigation(
    items=[NavItem(id="waybar", title="Waybar", url="/waybar", icon="waybar", group="config", order=31)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

# Register search
register_search([
    SearchItem(id="waybar_config", title="Waybar Settings", url="/waybar", category="Configuration",
               description="Configure Waybar modules and style")
])


@waybar_router.get("", response_class=HTMLResponse)
async def waybar_page():
    parser = Parser(path="waybar.pypx")
    parser.render(context=get_context({
        "current_page": "waybar",
        "page_title": "ArchBoard - Waybar Settings",
        "page_header": "Waybar Settings",
        "page_description": "Configure Waybar modules and appearance",
        "plugin_enabled": "true",
    }))
    return HTMLResponse(parser.html_content)


@waybar_router.get("/schema")
async def get_config_schema():
    """Returns the schema for Waybar modules."""
    return get_schema_dict()


@waybar_router.get("/config")
async def get_config():
    """Reads and parses the Waybar configuration file."""
    if not os.path.exists(CONFIG_FILE):
        return JSONResponse({"error": "Config file not found"}, status_code=404)

    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        try:
            root = parse(content)
            config_data = to_python(root)
            return config_data
        except Exception as e:
            return JSONResponse({"error": f"Parse error: {str(e)}"}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@waybar_router.post("/config/update")
async def update_module_config(data: dict = Body(...)):
    """
    Update a specific module's config while preserving comments.
    by finding the module in the JSONC AST and replacing its value node.
    """
    module_name = data.get("module")
    new_value = data.get("value")

    if not module_name or new_value is None:
        return JSONResponse({"error": "Missing module or value"}, status_code=400)

    if not os.path.exists(CONFIG_FILE):
        return JSONResponse({"error": "Config file not found"}, status_code=404)

    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        root = parse(content)

        # Strategy: Find path then set_value
        target_path = None

        if isinstance(root, DictNode):
            # Single bar config
            target_path = [module_name]

        elif isinstance(root, ListNode):
            # Multi-bar config: Find first bar containing this module
            for i, (child, _) in enumerate(root.children):
                if isinstance(child, DictNode):
                    for k_node, _, _ in child.children:
                        if k_node.value == module_name:
                            target_path = [i, module_name]
                            break
                if target_path: break

            # If not found, default to first bar
            if not target_path:
                target_path = [0, module_name]

        if target_path:
            set_value(root, target_path, new_value)

            # Write back
            new_content = to_string(root)
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                f.write(new_content)

            return {"status": "success", "message": f"Module {module_name} updated"}
        else:
            return JSONResponse({"error": "Could not determine update path"}, status_code=500)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@waybar_router.get("/style")
async def get_style():
    """Reads the Waybar style.css file."""
    if not os.path.exists(STYLE_FILE):
        return JSONResponse({"error": "Style file not found"}, status_code=404)

    try:
        with open(STYLE_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


from utils.css_parser import parse_css


@waybar_router.post("/style/update")
async def update_style_property(data: dict = Body(...)):
    """
    Updates a specific CSS selector's property.
    Payload: { "selector": "#waybar", "property": "background", "value": "red" }
    """
    selector = data.get("selector")
    prop = data.get("property")
    value = data.get("value")

    if not selector or not prop or not value:
        return JSONResponse({"error": "Missing selector, property or value"}, status_code=400)

    if not os.path.exists(STYLE_FILE):
        return JSONResponse({"error": "Style file not found"}, status_code=404)

    try:
        with open(STYLE_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        parser = parse_css(content)
        parser.set_property(selector, prop, value)
        new_content = parser.to_string()

        with open(STYLE_FILE, "w", encoding="utf-8") as f:
            f.write(new_content)

        return {"status": "success", "message": f"Style updated for {selector}"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@waybar_router.post("/style")
async def save_style(style: dict = Body(...)):
    """Saves the Waybar style.css file."""
    content = style.get("content")
    if content is None:
        return JSONResponse({"error": "Content required"}, status_code=400)

    try:
        with open(STYLE_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        return {"status": "success", "message": "Style saved"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# --- Script Management API ---

SCRIPTS_DIR = os.path.join(WAYBAR_CONFIG_DIR, "scripts")
if not os.path.exists(SCRIPTS_DIR):
    os.makedirs(SCRIPTS_DIR, exist_ok=True)

class ScriptFile(BaseModel):
    name: str
    content: str

@waybar_router.get("/scripts")
async def list_scripts():
    """List all scripts in the waybar scripts directory."""
    try:
        if not os.path.exists(SCRIPTS_DIR):
            return []
        
        scripts = []
        for f in os.listdir(SCRIPTS_DIR):
            if os.path.isfile(os.path.join(SCRIPTS_DIR, f)):
                scripts.append(f)
        return sorted(scripts)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@waybar_router.get("/scripts/{name}")
async def get_script(name: str):
    """Read content of a script."""
    try:
        path = os.path.join(SCRIPTS_DIR, name)
        # Security check: ensure path is within SCRIPTS_DIR
        if not os.path.abspath(path).startswith(os.path.abspath(SCRIPTS_DIR)):
             return JSONResponse({"error": "Invalid path"}, status_code=403)
             
        if not os.path.exists(path):
            return JSONResponse({"error": "Script not found"}, status_code=404)
            
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            
        return {"name": name, "content": content}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@waybar_router.post("/scripts")
async def save_script(script: ScriptFile):
    """Create or update a script."""
    try:
        path = os.path.join(SCRIPTS_DIR, script.name)
        if not os.path.abspath(path).startswith(os.path.abspath(SCRIPTS_DIR)):
             return JSONResponse({"error": "Invalid path"}, status_code=403)
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(script.content)
            
        # Make executable
        os.chmod(path, 0o755)
        
        return {"status": "success", "message": f"Script {script.name} saved"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@waybar_router.delete("/scripts/{name}")
async def delete_script(name: str):
    """Delete a script."""
    try:
        path = os.path.join(SCRIPTS_DIR, name)
        if not os.path.abspath(path).startswith(os.path.abspath(SCRIPTS_DIR)):
             return JSONResponse({"error": "Invalid path"}, status_code=403)
             
        if os.path.exists(path):
            os.remove(path)
            
        return {"status": "success", "message": f"Script {name} deleted"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# --- Execution Engine ---

class ExecRequest(BaseModel):
    command: str
    timeout: Optional[int] = 2

@waybar_router.post("/exec")
async def execute_command(req: ExecRequest):
    """Execute a shell command and return output."""
    try:
        # Security Note: This allows arbitrary command execution. 
        # Since this is a local tool for power users, it is acceptable but should be used with caution.
        
        result = subprocess.run(
            req.command, 
            shell=True, 
            text=True, 
            capture_output=True, 
            timeout=req.timeout,
            cwd=WAYBAR_CONFIG_DIR
        )
        
        return {
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return JSONResponse({"error": "Command timed out", "timeout": True}, status_code=408)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# --- System Stats ---

@waybar_router.get("/stats")
async def get_system_stats():
    """Get system stats for live preview."""
    try:
        cpu = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory().percent
        
        battery_info = {"percent": 100, "state": "Unknown"}
        if hasattr(psutil, "sensors_battery"):
            batt = psutil.sensors_battery()
            if batt:
                battery_info = {
                    "percent": round(batt.percent),
                    "state": "Charging" if batt.power_plugged else "Discharging",
                    "time_left": batt.secsleft if batt.secsleft != psutil.POWER_TIME_UNLIMITED else "Full"
                }

        # Disk usage /
        disk = psutil.disk_usage('/').percent
        
        return {
            "cpu": cpu,
            "memory": memory,
            "battery": battery_info,
            "disk": disk,
            "time": time.strftime("%H:%M:%S"),
            "audio": get_audio_info(),
            "network": get_network_info(),
            "backlight": get_backlight_info(),
            "bluetooth": get_bluetooth_info()
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

def get_audio_info():
    """Get volume and mute status using best available tool (pamixer > pactl)."""
    try:
        # Try pamixer first
        vol = subprocess.run("pamixer --get-volume", shell=True, capture_output=True, text=True)
        mute = subprocess.run("pamixer --get-mute", shell=True, capture_output=True, text=True)
        if vol.returncode == 0:
            return {"volume": int(vol.stdout.strip() or 0), "muted": mute.stdout.strip() == "true"}
        
        # Fallback to pactl (more complex parsing, skipping for MVP stability, assume 0)
        return {"volume": 0, "muted": False}
    except:
        return {"volume": 0, "muted": False}

def get_network_info():
    """Get network info (SSID, strength)."""
    try:
        # Simple check for active connection
        # returning a mock for now or simple nmcli
        res = subprocess.run("nmcli -t -f active,ssid,signal dev wifi", shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                if line.startswith("yes"):
                    _, ssid, signal = line.split(":")
                    return {"ssid": ssid, "signal": int(signal), "connected": True}
        return {"ssid": "Disconnected", "signal": 0, "connected": False}
    except:
        return {"ssid": "Disconnected", "signal": 0, "connected": False}

def get_backlight_info():
    try:
        res = subprocess.run("brightnessctl -m", shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            # output format: name,backlight,current,max,percent%,...
            parts = res.stdout.strip().split(',')
            if len(parts) >= 4:
                return {"percent": int(parts[3].replace('%', ''))}
        return {"percent": 100}
    except:
        return {"percent": 100}

def get_bluetooth_info():
    try:
        # Check if bluetooth is on
        res = subprocess.run("bluetoothctl show", shell=True, capture_output=True, text=True)
        powered = "Powered: yes" in res.stdout
        connected = False # Harder to parse, assume false for now unless we scan devices
        return {"on": powered, "connected": connected}
    except:
        return {"on": False, "connected": False}


class BatchExecRequest(BaseModel):
    commands: dict[str, str]  # module_name -> command
    timeout: Optional[int] = 2

@waybar_router.post("/exec_batch")
async def execute_batch(req: BatchExecRequest):
    """Execute multiple commands in parallel (up to a limit)."""
    import asyncio
    
    async def run_one(name, cmd):
        return name, await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=WAYBAR_CONFIG_DIR
        )

    results = {}
    
    # Process tasks
    tasks = []
    for name, cmd in req.commands.items():
        tasks.append(run_one(name, cmd))
        
    if not tasks:
        return {}

    # Gather processes
    procs = await asyncio.gather(*tasks)
    
    # Gather outputs with timeout
    async def wait_proc(name, proc):
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=req.timeout)
            return name, {
                "text": stdout.decode().strip(),
                "alt": "", # Could try to parse JSON if line is JSON
                "tooltip": "",
                "class": "",
                "returncode": proc.returncode
            }
        except asyncio.TimeoutError:
            proc.kill()
            return name, {"error": "Timeout"}

    output_tasks = [wait_proc(name, proc) for name, proc in procs]
    outputs = await asyncio.gather(*output_tasks)
    
    for name, out in outputs:
        # Try JSON parsing if output looks like JSON (Waybar custom module protocol)
        if "text" in out and out["text"].startswith("{") and out["text"].endswith("}"):
            try:
                import json
                json_val = json.loads(out["text"])
                results[name] = json_val
            except:
                results[name] = out
        else:
             results[name] = out

    return results


@waybar_router.post("/restart")
def restart_waybar():
    """Restart Waybar to apply config changes."""
    import subprocess
    import time
    try:
        subprocess.run(["pkill", "-x", "waybar"], capture_output=True)
        time.sleep(0.3)
        subprocess.Popen(
            "nohup waybar > /dev/null 2>&1 &",
            shell=True,
            start_new_session=True
        )
        return {"status": "success", "message": "Waybar restarted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

