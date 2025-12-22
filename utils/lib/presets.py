"""
Reusable Preset Manager for configuration files.

Provides a generic mechanism for saving, loading, and switching between
configuration presets. Can be used by any tool (Hyprland, Waybar, etc).

Usage:
    manager = PresetManager(
        config_path="~/.config/hypr/hyprland.conf",
        presets_dir="~/.config/hypr/presets"
    )

    # Save current config as preset
    manager.create_preset("battery_save", "Low power mode")

    # Activate a preset
    manager.activate_preset("battery_save")

    # List all presets
    presets = manager.list_presets()
"""

import os
import json
import shutil
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class Preset:
    """Represents a configuration preset."""
    id: str
    name: str
    description: str
    created_at: str
    updated_at: str
    is_active: bool = False
    tool: str = ""  # e.g., "hyprland", "waybar"
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Preset':
        return cls(**data)


class PresetManager:
    """
    Generic preset manager for configuration files.
    
    Stores presets in a dedicated directory with a manifest.json for metadata.
    Each preset is a full copy of the configuration file.
    """
    
    MANIFEST_FILE = "manifest.json"
    BACKUP_SUFFIX = ".backup"
    
    def __init__(self, config_path: str, presets_dir: str, tool_name: str = ""):
        """
        Initialize preset manager.
        
        Args:
            config_path: Path to the main config file (e.g., ~/.config/hypr/hyprland.conf)
            presets_dir: Directory to store presets (e.g., ~/.config/hypr/presets)
            tool_name: Name of the tool (e.g., "hyprland") for identification
        """
        self.config_path = Path(os.path.expanduser(config_path))
        self.presets_dir = Path(os.path.expanduser(presets_dir))
        self.tool_name = tool_name
        self.manifest_path = self.presets_dir / self.MANIFEST_FILE
        
        # Ensure presets directory exists
        self._ensure_presets_dir()
    
    def _ensure_presets_dir(self):
        """Create presets directory if it doesn't exist."""
        self.presets_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize manifest if it doesn't exist
        if not self.manifest_path.exists():
            self._save_manifest({"presets": [], "active_preset": None})
    
    def _load_manifest(self) -> Dict[str, Any]:
        """Load the manifest file."""
        try:
            with open(self.manifest_path, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"presets": [], "active_preset": None}
    
    def _save_manifest(self, manifest: Dict[str, Any]):
        """Save the manifest file."""
        with open(self.manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
    
    def _get_preset_path(self, preset_id: str) -> Path:
        """Get the file path for a preset's config file."""
        return self.presets_dir / f"{preset_id}.conf"
    
    def _sanitize_id(self, name: str) -> str:
        """Convert a name to a valid file ID."""
        # Replace spaces and special chars with underscores
        sanitized = "".join(c if c.isalnum() else "_" for c in name.lower())
        # Remove consecutive underscores
        while "__" in sanitized:
            sanitized = sanitized.replace("__", "_")
        return sanitized.strip("_")
    
    def _generate_unique_id(self, base_name: str) -> str:
        """Generate a unique ID for a preset."""
        base_id = self._sanitize_id(base_name)
        manifest = self._load_manifest()
        existing_ids = {p["id"] for p in manifest["presets"]}
        
        if base_id not in existing_ids:
            return base_id
        
        # Add suffix if ID exists
        counter = 1
        while f"{base_id}_{counter}" in existing_ids:
            counter += 1
        return f"{base_id}_{counter}"
    
    def list_presets(self) -> List[Preset]:
        """Get all presets."""
        manifest = self._load_manifest()
        return [Preset.from_dict(p) for p in manifest["presets"]]
    
    def get_preset(self, preset_id: str) -> Optional[Preset]:
        """Get a specific preset by ID."""
        manifest = self._load_manifest()
        for p in manifest["presets"]:
            if p["id"] == preset_id:
                return Preset.from_dict(p)
        return None
    
    def get_active_preset(self) -> Optional[str]:
        """Get the currently active preset ID, if any."""
        manifest = self._load_manifest()
        return manifest.get("active_preset")
    
    def create_preset(self, name: str, description: str = "") -> Preset:
        """
        Create a new preset from the current configuration.
        
        Args:
            name: Display name for the preset
            description: Optional description
            
        Returns:
            The created Preset object
        """
        if not self.config_path.exists():
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        
        preset_id = self._generate_unique_id(name)
        now = datetime.utcnow().isoformat() + "Z"
        
        preset = Preset(
            id=preset_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
            is_active=False,
            tool=self.tool_name
        )
        
        # Copy current config to preset file
        preset_path = self._get_preset_path(preset_id)
        shutil.copy2(self.config_path, preset_path)
        
        # Update manifest
        manifest = self._load_manifest()
        manifest["presets"].append(preset.to_dict())
        self._save_manifest(manifest)
        
        return preset
    
    def update_preset(self, preset_id: str, name: Optional[str] = None, 
                      description: Optional[str] = None) -> Optional[Preset]:
        """
        Update preset metadata (name/description).
        
        Args:
            preset_id: ID of preset to update
            name: New name (optional)
            description: New description (optional)
            
        Returns:
            Updated Preset or None if not found
        """
        manifest = self._load_manifest()
        
        for i, p in enumerate(manifest["presets"]):
            if p["id"] == preset_id:
                if name is not None:
                    p["name"] = name
                if description is not None:
                    p["description"] = description
                p["updated_at"] = datetime.utcnow().isoformat() + "Z"
                
                manifest["presets"][i] = p
                self._save_manifest(manifest)
                return Preset.from_dict(p)
        
        return None
    
    def update_preset_content(self, preset_id: str) -> bool:
        """
        Update a preset's config content from the current config.
        
        Args:
            preset_id: ID of preset to update
            
        Returns:
            True if successful, False if preset not found
        """
        if not self.config_path.exists():
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        
        preset_path = self._get_preset_path(preset_id)
        if not preset_path.exists():
            return False
        
        # Copy current config to preset file
        shutil.copy2(self.config_path, preset_path)
        
        # Update timestamp
        manifest = self._load_manifest()
        for p in manifest["presets"]:
            if p["id"] == preset_id:
                p["updated_at"] = datetime.utcnow().isoformat() + "Z"
                break
        self._save_manifest(manifest)
        
        return True
    
    def delete_preset(self, preset_id: str) -> bool:
        """
        Delete a preset.
        
        Args:
            preset_id: ID of preset to delete
            
        Returns:
            True if deleted, False if not found
        """
        manifest = self._load_manifest()
        
        # Find and remove from manifest
        original_len = len(manifest["presets"])
        manifest["presets"] = [p for p in manifest["presets"] if p["id"] != preset_id]
        
        if len(manifest["presets"]) == original_len:
            return False  # Not found
        
        # Clear active preset if this was it
        if manifest.get("active_preset") == preset_id:
            manifest["active_preset"] = None
        
        self._save_manifest(manifest)
        
        # Remove preset file
        preset_path = self._get_preset_path(preset_id)
        if preset_path.exists():
            preset_path.unlink()
        
        return True
    
    def activate_preset(self, preset_id: str, backup_current: bool = True) -> bool:
        """
        Activate a preset by replacing the current config.
        
        Args:
            preset_id: ID of preset to activate
            backup_current: Whether to backup current config before replacing
            
        Returns:
            True if successful, False if preset not found
        """
        preset_path = self._get_preset_path(preset_id)
        if not preset_path.exists():
            return False
        
        # Backup current config if requested
        if backup_current and self.config_path.exists():
            backup_path = self.config_path.with_suffix(
                self.config_path.suffix + self.BACKUP_SUFFIX
            )
            shutil.copy2(self.config_path, backup_path)
        
        # Copy preset to active config
        shutil.copy2(preset_path, self.config_path)
        
        # Update manifest
        manifest = self._load_manifest()
        for p in manifest["presets"]:
            p["is_active"] = (p["id"] == preset_id)
        manifest["active_preset"] = preset_id
        self._save_manifest(manifest)
        
        return True
    
    def deactivate_preset(self) -> bool:
        """
        Mark no preset as active (doesn't change config).
        
        Returns:
            True if there was an active preset to deactivate
        """
        manifest = self._load_manifest()
        had_active = manifest.get("active_preset") is not None
        
        for p in manifest["presets"]:
            p["is_active"] = False
        manifest["active_preset"] = None
        self._save_manifest(manifest)
        
        return had_active
    
    def get_preset_content(self, preset_id: str) -> Optional[str]:
        """
        Get the raw content of a preset's config file.
        
        Args:
            preset_id: ID of preset
            
        Returns:
            Config content as string, or None if not found
        """
        preset_path = self._get_preset_path(preset_id)
        if not preset_path.exists():
            return None
        
        with open(preset_path, 'r') as f:
            return f.read()
    
    def get_current_content(self) -> Optional[str]:
        """
        Get the current active config content.
        
        Returns:
            Config content as string, or None if file doesn't exist
        """
        if not self.config_path.exists():
            return None
        
        with open(self.config_path, 'r') as f:
            return f.read()
    
    def restore_backup(self) -> bool:
        """
        Restore the backup config (created during last activate).
        
        Returns:
            True if backup was restored, False if no backup exists
        """
        backup_path = self.config_path.with_suffix(
            self.config_path.suffix + self.BACKUP_SUFFIX
        )
        
        if not backup_path.exists():
            return False
        
        shutil.copy2(backup_path, self.config_path)
        
        # Clear active preset since we restored
        self.deactivate_preset()
        
        return True
