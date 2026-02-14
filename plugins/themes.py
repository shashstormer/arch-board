import shutil
from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from xtracto import Parser

from utils.config import get_context
from utils.lib.themes import ThemeManager
from utils.plugins_frontend import register_navigation, NavItem

theme_manager = ThemeManager()

themes_router = APIRouter(prefix="/themes", tags=["themes"])

register_navigation([
    NavItem(id="themes", title="Themes", url="/themes", icon="swatch", order=20)
])

class ThemeCreate(BaseModel):
    name: str
    description: str
    presets: Dict[str, str]  # tool -> preset_id
    author: str = "User"
    dependencies: List[str] = []

class ThemeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    presets: Optional[Dict[str, str]] = None
    dependencies: Optional[List[str]] = None

class ThemeResponse(BaseModel):
    id: str
    name: str
    description: str
    author: str
    created_at: str
    updated_at: str
    version: str
    presets: Dict[str, str]
    dependencies: List[str]

class ExportOptions(BaseModel):
    include_presets: Optional[List[str]] = None

class ThemeApplyResponse(BaseModel):
    success: bool
    results: Dict[str, bool]

@themes_router.get("/", response_class=HTMLResponse)
async def themes_page():
    parser = Parser(path="themes.pypx")
    parser.render(context=get_context({
        "current_page": "themes",
        "page_title": "ArchBoard - Themes",
        "page_header": "Theme Manager",
        "page_description": "Manage and share system themes",
    }))
    return HTMLResponse(parser.html_content)

@themes_router.get("/list")
async def list_themes() -> List[ThemeResponse]:
    try:
        themes = theme_manager.list_themes()
        return [ThemeResponse(**t.to_dict()) for t in themes]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@themes_router.post("/")
async def create_theme(data: ThemeCreate) -> ThemeResponse:
    try:
        author = data.author
        if author == "User" or not author:
            import os
            try:
                author = os.getlogin()
            except:
                author = os.environ.get("USER", "Unknown")

        theme = theme_manager.create_theme(
            name=data.name,
            description=data.description,
            presets=data.presets,
            author=author,
            dependencies=data.dependencies
        )
        return ThemeResponse(**theme.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@themes_router.put("/{theme_id}")
async def update_theme(theme_id: str, data: ThemeUpdate) -> ThemeResponse:
    try:
        update_data = {k: v for k, v in data.dict().items() if v is not None}
        
        theme = theme_manager.update_theme(theme_id, **update_data)
        if not theme:
            raise HTTPException(status_code=404, detail="Theme not found")
            
        return ThemeResponse(**theme.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@themes_router.delete("/{theme_id}")
async def delete_theme(theme_id: str):
    """Delete a theme."""
    try:
        success = theme_manager.delete_theme(theme_id)
        if not success:
            raise HTTPException(status_code=404, detail="Theme not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@themes_router.post("/{theme_id}/apply")
async def apply_theme(theme_id: str) -> ThemeApplyResponse:
    try:
        results = theme_manager.apply_theme(theme_id)
        all_failed = results and not any(results.values())
        return ThemeApplyResponse(success=not all_failed, results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@themes_router.post("/{theme_id}/export")
async def export_theme(theme_id: str, options: ExportOptions = None):
    try:
        include_presets = options.include_presets if options else None
        zip_path = theme_manager.export_theme(theme_id, include_presets=include_presets)
        if not zip_path:
            raise HTTPException(status_code=404, detail="Theme not found")
        
        return FileResponse(
            path=zip_path,
            filename=f"{theme_id}.zip",
            media_type='application/zip'
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@themes_router.post("/import")
async def import_theme(file: UploadFile = File(...)) -> ThemeResponse:
    try:
        temp_dir = theme_manager.themes_dir / "temp"
        temp_dir.mkdir(exist_ok=True)
        temp_path = temp_dir / file.filename
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        try:
            theme = theme_manager.import_theme(str(temp_path))
            return ThemeResponse(**theme.to_dict())
        finally:
            if temp_path.exists():
                temp_path.unlink()
                
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
