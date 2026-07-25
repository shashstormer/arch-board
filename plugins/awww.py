"""
Awww (Wayland wallpaper daemon) configuration router with Matugen color palette generation.
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse, Response
from pydantic import BaseModel
from typing import Dict, List, Optional, Any, Literal
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup
import os
import io
import json
import mimetypes
import subprocess
from PIL import Image, ImageDraw

awww_router = APIRouter(prefix="/awww", tags=["awww"])

# Register navigation
register_navigation(
    items=[NavItem(id="awww", title="Awww", url="/awww", icon="awww", group="config", order=55)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

CONFIG_PATH = os.path.expanduser("~/.config/awww/config.json")


# ========== Models ==========

class DisplayConfig(BaseModel):
    path: str = ""
    resize: Optional[Literal["crop", "fit", "stretch", "no"]] = "crop"
    crop_gravity: Optional[Literal["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"]] = "center"
    fill_color: Optional[str] = "000000ff"
    filter: Optional[Literal["Lanczos3", "Nearest", "Bilinear", "CatmullRom", "Mitchell"]] = "Lanczos3"
    transition_type: Optional[str] = "simple"
    transition_step: Optional[int] = 90
    transition_duration: Optional[float] = 3.0
    transition_fps: Optional[int] = 30
    transition_angle: Optional[int] = 45
    transition_pos: Optional[str] = "center"
    transition_bezier: Optional[str] = ".54,0,.34,.99"


class AwwwConfig(BaseModel):
    displays: Dict[str, DisplayConfig] = {}


class ControlRequest(BaseModel):
    action: Literal["set-image", "clear", "restore", "clear-cache", "toggle", "pause", "unpause", "kill"]
    display: Optional[str] = None
    path: Optional[str] = None
    resize: Optional[str] = None
    crop_gravity: Optional[str] = None
    fill_color: Optional[str] = None
    filter: Optional[str] = None
    transition_type: Optional[str] = None
    transition_step: Optional[int] = None
    transition_duration: Optional[float] = None
    transition_fps: Optional[int] = None
    transition_angle: Optional[int] = None
    transition_pos: Optional[str] = None
    transition_bezier: Optional[str] = None


class MatugenApplyRequest(BaseModel):
    path: Optional[str] = None
    mode: Literal["dark", "light"] = "dark"
    type: str = "scheme-tonal-spot"


# ========== Helper Functions ==========

def get_first_screen_wallpaper(path: Optional[str] = None) -> tuple[str, str]:
    """
    Returns (display_name, image_path) for the 1st screen wallpaper.
    If path is provided and valid, uses path.
    Otherwise queries awww or config to find 1st screen wallpaper.
    """
    if path and os.path.exists(path) and os.path.isfile(path):
        return ("custom", path)
    
    current = get_current_wallpapers().get("current", {})
    if current:
        first_display = list(current.keys())[0]
        wallpaper_path = current[first_display]
        if os.path.exists(wallpaper_path) and os.path.isfile(wallpaper_path):
            return (first_display, wallpaper_path)

    # Fallback to config
    config = get_config().get("displays", {})
    for disp_name, disp_cfg in config.items():
        p = disp_cfg.get("path") if isinstance(disp_cfg, dict) else getattr(disp_cfg, "path", None)
        if p and os.path.exists(p) and os.path.isfile(p):
            return (disp_name, p)

    raise HTTPException(status_code=404, detail="No active wallpaper image found for 1st screen")


def run_matugen_json(img_path: str, mode: str = "dark", scheme_type: str = "scheme-tonal-spot") -> dict:
    """Run matugen CLI to generate JSON color scheme."""
    cmd = [
        "matugen", "image", img_path,
        "--json", "hex",
        "--source-color-index", "0",
        "-m", mode,
        "-t", scheme_type
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            raise HTTPException(status_code=500, detail=f"Matugen error: {result.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute matugen: {e}")


def generate_matugen_swatch_image(colors_dict: dict, title: str = "Matugen Color Palette") -> bytes:
    """Generate a PNG image showing the matugen color palette swatches."""
    width, height = 800, 260
    img = Image.new("RGB", (width, height), (24, 24, 27))
    draw = ImageDraw.Draw(img)

    # Title
    draw.text((20, 15), title, fill=(244, 244, 245))

    swatch_width = 85
    swatch_height = 80
    start_x = 20
    start_y = 45
    gap = 12

    items = list(colors_dict.items())[:14] # Up to 14 key colors
    for i, (name, hex_code) in enumerate(items):
        col = i % 7
        row = i // 7
        x = start_x + col * (swatch_width + gap)
        y = start_y + row * (swatch_height + 25)

        hex_clean = hex_code.lstrip("#")
        if len(hex_clean) == 6:
            r, g, b = int(hex_clean[0:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16)
        else:
            r, g, b = (100, 100, 100)

        # Draw color swatch box
        draw.rectangle([x, y, x + swatch_width, y + swatch_height - 20], fill=(r, g, b))
        # Draw labels
        draw.text((x, y + swatch_height - 15), name[:11], fill=(212, 212, 216))
        draw.text((x, y + swatch_height - 3), hex_code, fill=(161, 161, 170))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ========== Routes ==========

@awww_router.get("", response_class=HTMLResponse)
async def awww_page():
    parser = Parser(path="awww.pypx")
    parser.render(context=get_context({
        "current_page": "awww",
        "page_title": "ArchBoard - Awww Settings",
        "page_header": "Awww Wallpaper Settings",
        "page_description": "Configure Wayland wallpaper daemon (awww) and Matugen color palette generation",
    }))
    return HTMLResponse(parser.html_content)


@awww_router.get("/config")
def get_config():
    """Parse and return current awww config."""
    if not os.path.exists(CONFIG_PATH):
        return {"displays": {}}
    
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error parsing awww config: {e}")
        return {"displays": {}}


@awww_router.post("/config")
def save_config(config: AwwwConfig):
    """Save awww config to file and apply wallpaper settings."""
    try:
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        data = config.model_dump(exclude_none=True)

        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        for display, settings in config.displays.items():
            if settings.path and os.path.exists(settings.path) and os.path.isfile(settings.path):
                apply_wallpaper_setting(display, settings)

        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def apply_wallpaper_setting(display: str, settings: DisplayConfig):
    """Helper to call awww img with specified display settings."""
    cmd = ["awww", "img"]
    if display and display not in ["default", "any"]:
        cmd.extend(["-o", display])
    
    if settings.resize:
        cmd.extend(["--resize", settings.resize])
    if settings.crop_gravity and settings.resize == "crop":
        cmd.extend(["--crop-gravity", settings.crop_gravity])
    if settings.fill_color:
        cmd.extend(["--fill-color", settings.fill_color])
    if settings.filter:
        cmd.extend(["-f", settings.filter])
    if settings.transition_type:
        cmd.extend(["-t", settings.transition_type])
    if settings.transition_step is not None:
        cmd.extend(["--transition-step", str(settings.transition_step)])
    if settings.transition_duration is not None:
        cmd.extend(["--transition-duration", str(settings.transition_duration)])
    if settings.transition_fps is not None:
        cmd.extend(["--transition-fps", str(settings.transition_fps)])
    if settings.transition_angle is not None:
        cmd.extend(["--transition-angle", str(settings.transition_angle)])
    if settings.transition_pos:
        cmd.extend(["--transition-pos", settings.transition_pos])
    if settings.transition_bezier:
        cmd.extend(["--transition-bezier", settings.transition_bezier])

    cmd.append(settings.path)
    try:
        subprocess.run(cmd, capture_output=True, text=True)
    except Exception as e:
        print(f"Error executing awww img: {e}")


@awww_router.get("/monitors")
def get_monitors():
    """Get list of available monitors from Hyprland."""
    try:
        result = subprocess.run(
            ["hyprctl", "monitors", "-j"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
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


@awww_router.post("/control")
def control_awww(req: ControlRequest):
    """Run awww CLI commands."""
    try:
        if req.action == "set-image":
            if not req.path or not os.path.exists(req.path):
                raise HTTPException(status_code=400, detail="Valid image path required for set-image")
            cmd = ["awww", "img"]
            if req.display and req.display not in ["default", "any"]:
                cmd.extend(["-o", req.display])
            if req.resize:
                cmd.extend(["--resize", req.resize])
            if req.crop_gravity and req.resize == "crop":
                cmd.extend(["--crop-gravity", req.crop_gravity])
            if req.fill_color:
                cmd.extend(["--fill-color", req.fill_color])
            if req.filter:
                cmd.extend(["-f", req.filter])
            if req.transition_type:
                cmd.extend(["-t", req.transition_type])
            if req.transition_step is not None:
                cmd.extend(["--transition-step", str(req.transition_step)])
            if req.transition_duration is not None:
                cmd.extend(["--transition-duration", str(req.transition_duration)])
            if req.transition_fps is not None:
                cmd.extend(["--transition-fps", str(req.transition_fps)])
            if req.transition_angle is not None:
                cmd.extend(["--transition-angle", str(req.transition_angle)])
            if req.transition_pos:
                cmd.extend(["--transition-pos", req.transition_pos])
            if req.transition_bezier:
                cmd.extend(["--transition-bezier", req.transition_bezier])
            cmd.append(req.path)
        else:
            cmd = ["awww", req.action]
            if req.display and req.display not in ["default", "any"] and req.action in ["clear", "restore"]:
                cmd.extend(["-o", req.display])

        result = subprocess.run(cmd, capture_output=True, text=True)
        return {
            "status": "success" if result.returncode == 0 else "error",
            "output": result.stdout,
            "error": result.stderr
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@awww_router.post("/restart")
def restart_awww():
    """Restart awww daemon."""
    import time
    try:
        subprocess.run(["pkill", "-x", "awww-daemon"], capture_output=True)
        time.sleep(0.3)
        subprocess.Popen(
            "nohup awww-daemon > /dev/null 2>&1 &",
            shell=True,
            start_new_session=True
        )
        return {"status": "success", "message": "awww-daemon restarted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@awww_router.get("/current")
def get_current_wallpapers():
    """Get current wallpapers using awww query."""
    current = {}
    try:
        result = subprocess.run(
            ["awww", "query"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if "currently displaying: image: " in line:
                    parts = line.split("currently displaying: image: ", 1)
                    header = parts[0].strip(": ")
                    image_path = parts[1].strip()
                    display_name = header.split(":")[0].strip() if ":" in header else header
                    current[display_name] = image_path
                elif "currently displaying:" in line:
                    parts = line.split("currently displaying:", 1)
                    header = parts[0].strip(": ")
                    display_name = header.split(":")[0].strip() if ":" in header else header
                    current[display_name] = parts[1].strip()
    except Exception as e:
        print(f"Error getting awww query output: {e}")
    
    return {"current": current}


@awww_router.get("/preview")
def get_preview(path: str):
    """Serve wallpaper image preview from filesystem path."""
    real_path = os.path.realpath(path)
    if os.path.exists(real_path) and os.path.isfile(real_path):
        mime, _ = mimetypes.guess_type(real_path)
        return FileResponse(real_path, media_type=mime or "image/png")
    
    raise HTTPException(404, "Image not found")


def extract_color_dict(matugen_data: dict, mode: str = "dark") -> Dict[str, str]:
    """Extract flat {name: hex} dictionary from matugen JSON output."""
    colors = {}
    raw_colors = matugen_data.get("colors", {})
    mode_key = mode if mode in ["dark", "light"] else "dark"

    for color_name, color_modes in raw_colors.items():
        if isinstance(color_modes, dict):
            c_val = color_modes.get(mode_key, {}).get("color") or color_modes.get("default", {}).get("color")
            if c_val:
                colors[color_name] = c_val
        elif isinstance(color_modes, str):
            colors[color_name] = color_modes
    return colors


# ========== Matugen Color Scheme Routes ==========

@awww_router.get("/matugen/current")
def get_matugen_current(
    path: Optional[str] = Query(None, description="Optional image path. Defaults to 1st screen wallpaper."),
    mode: str = Query("dark", description="dark or light mode"),
    type: str = Query("scheme-tonal-spot", description="Matugen scheme type")
):
    """
    Generate Matugen color palette JSON based on current wallpaper of 1st screen (or specified image).
    Includes flat `colors` dictionary {name: hex}.
    """
    display_name, img_path = get_first_screen_wallpaper(path)
    matugen_data = run_matugen_json(img_path, mode=mode, scheme_type=type)
    color_dict = extract_color_dict(matugen_data, mode=mode)

    return {
        "status": "success",
        "display": display_name,
        "image_path": img_path,
        "mode": mode,
        "type": type,
        "colors": color_dict,
        "palette": matugen_data
    }


@awww_router.get("/matugen/colors")
def get_matugen_colors(
    path: Optional[str] = Query(None, description="Optional image path. Defaults to 1st screen wallpaper."),
    mode: str = Query("dark", description="dark or light mode"),
    type: str = Query("scheme-tonal-spot", description="Matugen scheme type")
) -> Dict[str, str]:
    """
    Directly return a flat {name: hex} dictionary of colors derived from 1st screen wallpaper for use in other programs.
    """
    display_name, img_path = get_first_screen_wallpaper(path)
    matugen_data = run_matugen_json(img_path, mode=mode, scheme_type=type)
    return extract_color_dict(matugen_data, mode=mode)


@awww_router.get("/matugen/image")
def get_matugen_palette_image(
    path: Optional[str] = Query(None, description="Optional image path. Defaults to 1st screen wallpaper."),
    mode: str = Query("dark", description="dark or light mode"),
    type: str = Query("scheme-tonal-spot", description="Matugen scheme type")
):
    """
    Generate and return a visual swatch PNG image of the Matugen palette derived from 1st screen wallpaper.
    """
    display_name, img_path = get_first_screen_wallpaper(path)
    matugen_data = run_matugen_json(img_path, mode=mode, scheme_type=type)
    colors = extract_color_dict(matugen_data, mode=mode)

    img_bytes = generate_matugen_swatch_image(colors, title=f"Matugen Palette ({display_name}: {os.path.basename(img_path)})")
    return Response(content=img_bytes, media_type="image/png")


@awww_router.post("/matugen/apply")
def apply_matugen_theme(req: MatugenApplyRequest):
    """
    Execute Matugen system-wide theme generation based on 1st screen wallpaper (or specified image).
    """
    display_name, img_path = get_first_screen_wallpaper(req.path)
    cmd = [
        "matugen", "image", img_path,
        "--source-color-index", "0",
        "-m", req.mode,
        "-t", req.type
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return {
                "status": "success",
                "message": f"Matugen color scheme applied for {display_name}",
                "display": display_name,
                "image_path": img_path
            }
        else:
            raise HTTPException(status_code=500, detail=f"Matugen apply failed: {result.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
