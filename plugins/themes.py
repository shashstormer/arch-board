import shutil
import os
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
    dependencies: List[Dict[str, str]] = []
    source_url: Optional[str] = None


class ThemeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    presets: Optional[Dict[str, str]] = None
    dependencies: Optional[List[Dict[str, str]]] = None
    source_url: Optional[str] = None


class ThemeResponse(BaseModel):
    id: str
    name: str
    description: str
    author: str
    created_at: str
    updated_at: str
    version: str
    presets: Dict[str, str]
    dependencies: List[Dict[str, str]]
    source_url: Optional[str] = None


class ExportOptions(BaseModel):
    include_presets: Optional[List[str]] = None
    included_assets: Optional[List[str]] = None


class AssetInfo(BaseModel):
    original_path: str
    arcname: str
    tool: str


class ThemeApplyResponse(BaseModel):
    success: bool
    results: Dict[str, bool]


class GithubImport(BaseModel):
    url: str


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
            dependencies=data.dependencies,
            source_url=data.source_url
        )
        return ThemeResponse(**theme.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@themes_router.put("/{theme_id}")
async def update_theme(theme_id: str, data: ThemeUpdate) -> ThemeResponse:
    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}

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


@themes_router.post("/{theme_id}/analyze_export")
async def analyze_export(theme_id: str, options: ExportOptions = None) -> List[AssetInfo]:
    try:
        include_presets = options.include_presets if options else None
        assets = theme_manager.analyze_theme_export(theme_id, include_presets)
        return [AssetInfo(**a) for a in assets]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@themes_router.post("/{theme_id}/export")
async def export_theme(theme_id: str, options: ExportOptions = None):
    try:
        include_presets = options.include_presets if options else None
        included_assets = options.included_assets if options else None

        zip_path = theme_manager.export_theme(theme_id, include_presets=include_presets,
                                              included_assets=included_assets)
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
async def import_theme(file: UploadFile = File(...), source_url: Optional[str] = None) -> ThemeResponse:
    try:
        temp_dir = theme_manager.themes_dir / "temp"
        temp_dir.mkdir(exist_ok=True)
        temp_path = temp_dir / file.filename

        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            theme = theme_manager.import_theme(str(temp_path), source_url=source_url)
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


@themes_router.post("/import/github")
async def import_github(data: GithubImport) -> ThemeResponse:
    try:
        zip_path = theme_manager.download_from_github(data.url)
        try:
            theme = theme_manager.import_theme(zip_path, source_url=data.url)
            return ThemeResponse(**theme.to_dict())
        finally:
            if os.path.exists(zip_path):
                os.remove(zip_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@themes_router.post("/{theme_id}/update")
async def update_theme_source(theme_id: str) -> ThemeResponse:
    try:
        theme = theme_manager.get_theme(theme_id)
        if not theme:
            raise HTTPException(status_code=404, detail="Theme not found")

        if not theme.source_url:
            raise HTTPException(status_code=400, detail="Theme has no source URL")

        zip_path = theme_manager.download_from_github(theme.source_url)
        try:
            updated_theme = theme_manager.import_theme(zip_path, source_url=theme.source_url)
            return ThemeResponse(**updated_theme.to_dict())
        finally:
            if os.path.exists(zip_path):
                os.remove(zip_path)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@themes_router.post("/detect_dependencies")
async def detect_dependencies(data: Dict[str, Dict[str, str]]) -> Dict[str, List[Dict[str, str]]]:
    """
    Detect dependencies for the given presets.
    Body: { "presets": { "tool": "preset_id" } }
    """
    presets = data.get("presets", {})
    if not presets:
        return {"dependencies": []}

    try:
        deps = theme_manager.detect_dependencies(presets)
        return {"dependencies": deps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
