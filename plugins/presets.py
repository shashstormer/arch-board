"""
Preset management API routes.
Provides endpoints for saving, loading, and switching configuration presets.
Uses the reusable PresetManager from utils/lib/presets.py.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import subprocess

from utils.lib.presets import PresetManager, Preset


# Create router
presets_router = APIRouter(prefix="/presets", tags=["presets"])


# =============================================================================
# PRESET MANAGERS REGISTRY
# =============================================================================

# Registry of preset managers for different tools
_managers = {}

def get_manager(tool: str) -> PresetManager:
    """Get or create a PresetManager for a specific tool."""
    if tool not in _managers:
        if tool == "hyprland":
            _managers[tool] = PresetManager(
                config_path="~/.config/hypr/hyprland.conf",
                presets_dir="~/.config/hypr/presets",
                tool_name="hyprland"
            )
        elif tool == "waybar":
            _managers[tool] = PresetManager(
                config_path="~/.config/waybar/config",
                presets_dir="~/.config/waybar/presets",
                tool_name="waybar"
            )
        elif tool == "hypridle":
            _managers[tool] = PresetManager(
                config_path="~/.config/hypr/hypridle.conf",
                presets_dir="~/.config/hypr/presets/hypridle",
                tool_name="hypridle"
            )
        elif tool == "hyprlock":
            _managers[tool] = PresetManager(
                config_path="~/.config/hypr/hyprlock.conf",
                presets_dir="~/.config/hypr/presets/hyprlock",
                tool_name="hyprlock"
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown tool: {tool}")
    
    return _managers[tool]


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class PresetCreate(BaseModel):
    """Request model for creating a preset."""
    name: str
    description: str = ""

class PresetUpdate(BaseModel):
    """Request model for updating a preset."""
    name: Optional[str] = None
    description: Optional[str] = None

class PresetActivate(BaseModel):
    """Request model for activating a preset."""
    backup_current: bool = True

class PresetResponse(BaseModel):
    """Response model for a preset."""
    id: str
    name: str
    description: str
    created_at: str
    updated_at: str
    is_active: bool
    tool: str

class PresetsListResponse(BaseModel):
    """Response model for listing presets."""
    presets: List[PresetResponse]
    active_preset: Optional[str]


# =============================================================================
# ENDPOINTS
# =============================================================================

@presets_router.get("/{tool}")
async def list_presets(tool: str) -> PresetsListResponse:
    """List all presets for a tool."""
    try:
        manager = get_manager(tool)
        presets = manager.list_presets()
        active = manager.get_active_preset()
        
        return PresetsListResponse(
            presets=[PresetResponse(**p.to_dict()) for p in presets],
            active_preset=active
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.post("/{tool}")
async def create_preset(tool: str, data: PresetCreate) -> PresetResponse:
    """Create a new preset from the current configuration."""
    try:
        manager = get_manager(tool)
        preset = manager.create_preset(data.name, data.description)
        return PresetResponse(**preset.to_dict())
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.get("/{tool}/{preset_id}")
async def get_preset(tool: str, preset_id: str) -> PresetResponse:
    """Get a specific preset."""
    try:
        manager = get_manager(tool)
        preset = manager.get_preset(preset_id)
        
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        return PresetResponse(**preset.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.put("/{tool}/{preset_id}")
async def update_preset(tool: str, preset_id: str, data: PresetUpdate) -> PresetResponse:
    """Update preset metadata (name/description)."""
    try:
        manager = get_manager(tool)
        preset = manager.update_preset(preset_id, data.name, data.description)
        
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        return PresetResponse(**preset.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.delete("/{tool}/{preset_id}")
async def delete_preset(tool: str, preset_id: str):
    """Delete a preset."""
    try:
        manager = get_manager(tool)
        success = manager.delete_preset(preset_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        return {"success": True, "message": f"Preset '{preset_id}' deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.post("/{tool}/{preset_id}/activate")
async def activate_preset(tool: str, preset_id: str, data: PresetActivate = PresetActivate()):
    """
    Activate a preset by replacing the current config.
    Optionally backs up the current config first.
    """
    try:
        manager = get_manager(tool)
        success = manager.activate_preset(preset_id, backup_current=data.backup_current)
        
        if not success:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        # Trigger reload for supported tools
        reload_result = None
        if tool == "hyprland":
            try:
                result = subprocess.run(["hyprctl", "reload"], capture_output=True, text=True)
                reload_result = {
                    "reloaded": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            except Exception:
                reload_result = {"reloaded": False, "error": "hyprctl not available"}
        
        return {
            "success": True, 
            "message": f"Preset '{preset_id}' activated",
            "reload": reload_result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.post("/{tool}/{preset_id}/update-content")
async def update_preset_content(tool: str, preset_id: str):
    """Update a preset's config content from the current config."""
    try:
        manager = get_manager(tool)
        success = manager.update_preset_content(preset_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        return {"success": True, "message": f"Preset '{preset_id}' content updated"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.get("/{tool}/{preset_id}/content")
async def get_preset_content(tool: str, preset_id: str):
    """Get the raw config content of a preset."""
    try:
        manager = get_manager(tool)
        content = manager.get_preset_content(preset_id)
        
        if content is None:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        return {"content": content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.post("/{tool}/restore-backup")
async def restore_backup(tool: str):
    """Restore the backup config (created during last preset activation)."""
    try:
        manager = get_manager(tool)
        success = manager.restore_backup()
        
        if not success:
            raise HTTPException(status_code=404, detail="No backup found")
        
        # Trigger reload for supported tools
        reload_result = None
        if tool == "hyprland":
            try:
                result = subprocess.run(["hyprctl", "reload"], capture_output=True, text=True)
                reload_result = {"reloaded": result.returncode == 0}
            except Exception:
                reload_result = {"reloaded": False}
        
        return {
            "success": True, 
            "message": "Backup restored",
            "reload": reload_result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@presets_router.post("/{tool}/deactivate")
async def deactivate_preset(tool: str):
    """Mark no preset as active (doesn't change config)."""
    try:
        manager = get_manager(tool)
        manager.deactivate_preset()
        return {"success": True, "message": "No preset is now active"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
