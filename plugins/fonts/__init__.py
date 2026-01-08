from fastapi import APIRouter
from fastapi.responses import JSONResponse, FileResponse
import subprocess
import os

import json
from pydantic import BaseModel
from typing import List

fonts_router = APIRouter(tags=["fonts"])

PINNED_FONTS_FILE = os.path.expanduser("~/.archboard/pinned_fonts.json")

class PinnedFontsRequest(BaseModel):
    fonts: List[str]

def get_pinned_fonts():
    if not os.path.exists(PINNED_FONTS_FILE):
        return []
    try:
        with open(PINNED_FONTS_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_pinned_fonts(fonts: List[str]):
    os.makedirs(os.path.dirname(PINNED_FONTS_FILE), exist_ok=True)
    with open(PINNED_FONTS_FILE, "w") as f:
        json.dump(fonts, f)

@fonts_router.get("/fonts/pinned")
async def list_pinned_fonts():
    return get_pinned_fonts()

@fonts_router.post("/fonts/pinned")
async def update_pinned_fonts(req: PinnedFontsRequest):
    save_pinned_fonts(req.fonts)
    return {"status": "success", "count": len(req.fonts)}

from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem

# Register Navigation (Child of Library)
register_navigation([
    NavItem(
        id="fonts",
        title="Browser Fonts",
        url="/fonts/preview",
        icon="font", 
        icon_svg='<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>', # Placeholder icon
        group="library",
        order=20 
    )
])

@fonts_router.get("/fonts/list")
async def list_fonts():
    """List all system fonts with their families and paths."""
    try:
        # Format: /path/to/file.ttf: Family1,Family2
        res = subprocess.run(
            ["fc-list", ":", "file", "family"], 
            capture_output=True, 
            text=True
        )
        if res.returncode != 0:
            return {"error": "fc-list failed"}
            
        fonts = []
        for line in res.stdout.splitlines():
            try:
                parts = line.split(":", 1)
                if len(parts) < 2: continue
                
                path = parts[0].strip()
                families = parts[1].strip()
                
                # A file can provide multiple families
                family_list = [f.strip() for f in families.split(",") if f.strip()]
                
                if family_list and path:
                    fonts.append({
                        "path": path,
                        "families": family_list
                    })
            except:
                continue
                
        return fonts
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@fonts_router.get("/fonts/serve")
async def serve_font(path: str):
    """Serve a font file from the system."""
    if not os.path.exists(path):
        return JSONResponse({"error": "File not found"}, status_code=404)
    
    # Basic security check: ensure it looks like a font file or is in common font dirs
    allowed_exts = ['.ttf', '.otf', '.woff', '.woff2', '.pcf', '.ttc']
    _, ext = os.path.splitext(path)
    if ext.lower() not in allowed_exts:
         return JSONResponse({"error": "Invalid font file type"}, status_code=400)
         
    return FileResponse(path)

# --- Frontend Page ---

@fonts_router.get("/fonts/preview", response_class=HTMLResponse)
async def fonts_page():
    parser = Parser(path="fonts.pypx")
    parser.render(context=get_context({
        "current_page": "fonts",
        "page_title": "ArchBoard - Browser Fonts",
        "page_header": "Browser Fonts",
        "page_description": "Preview all system fonts available to the browser",
        "title": "Fonts - ArchBoard",
        "description": "System Font Preview",
        "page_id": "fonts",
    }))
    return HTMLResponse(parser.html_content)
