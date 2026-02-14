import json
import os
import shutil
import zipfile
from dataclasses import dataclass, asdict, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any


@dataclass
class Theme:
    id: str
    name: str
    description: str
    created_at: str
    updated_at: str
    author: str = "Unknown"
    version: str = "1.0.0"
    presets: Dict[str, str] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Theme':
        return cls(**data)


class ThemeManager:
    THEMES_DIR = os.path.expanduser("~/.archboard/themes")
    MANIFEST_FILE = "manifest.json"

    def __init__(self):
        self.themes_dir = Path(self.THEMES_DIR)
        self._ensure_themes_dir()

    def _ensure_themes_dir(self):
        self.themes_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = self.themes_dir / self.MANIFEST_FILE
        if not manifest_path.exists():
            self._save_manifest({"themes": []})

    def _load_manifest(self) -> Dict[str, Any]:
        try:
            with open(self.themes_dir / self.MANIFEST_FILE, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"themes": []}

    def _save_manifest(self, manifest: Dict[str, Any]):
        with open(self.themes_dir / self.MANIFEST_FILE, 'w') as f:
            json.dump(manifest, f, indent=2)

    def _sanitize_id(self, name: str) -> str:
        sanitized = "".join(c if c.isalnum() else "_" for c in name.lower())
        while "__" in sanitized:
            sanitized = sanitized.replace("__", "_")
        return sanitized.strip("_")

    def _generate_unique_id(self, base_name: str) -> str:
        base_id = self._sanitize_id(base_name)
        manifest = self._load_manifest()
        existing_ids = {t["id"] for t in manifest["themes"]}

        if base_id not in existing_ids:
            return base_id

        counter = 1
        while f"{base_id}_{counter}" in existing_ids:
            counter += 1
        return f"{base_id}_{counter}"

    def list_themes(self) -> List[Theme]:
        manifest = self._load_manifest()
        return [Theme.from_dict(t) for t in manifest["themes"]]

    def get_theme(self, theme_id: str) -> Optional[Theme]:
        manifest = self._load_manifest()
        for t in manifest["themes"]:
            if t["id"] == theme_id:
                return Theme.from_dict(t)
        return None

    def create_theme(self, name: str, description: str, presets: Dict[str, str], author: str = "User",
                     dependencies: List[str] = None) -> Theme:
        theme_id = self._generate_unique_id(name)
        now = datetime.utcnow().isoformat() + "Z"

        theme = Theme(
            id=theme_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
            author=author,
            presets=presets,
            dependencies=dependencies or []
        )

        manifest = self._load_manifest()
        manifest["themes"].append(theme.to_dict())
        self._save_manifest(manifest)

        return theme

    def update_theme(self, theme_id: str, **kwargs) -> Optional[Theme]:
        manifest = self._load_manifest()
        found_idx = -1

        for i, t in enumerate(manifest["themes"]):
            if t["id"] == theme_id:
                found_idx = i
                break

        if found_idx == -1:
            return None

        theme_data = manifest["themes"][found_idx]
        valid_fields = {"name", "description", "author", "presets", "dependencies"}
        updated = False

        for key, value in kwargs.items():
            if key in valid_fields and value is not None:
                theme_data[key] = value
                updated = True

        if updated:
            theme_data["updated_at"] = datetime.utcnow().isoformat() + "Z"
            manifest["themes"][found_idx] = theme_data
            self._save_manifest(manifest)

        return Theme.from_dict(theme_data)

    def delete_theme(self, theme_id: str) -> bool:
        manifest = self._load_manifest()
        original_len = len(manifest["themes"])
        manifest["themes"] = [t for t in manifest["themes"] if t["id"] != theme_id]

        if len(manifest["themes"]) == original_len:
            return False

        self._save_manifest(manifest)
        return True

    def export_theme(self, theme_id: str, include_presets: List[str] = None) -> Optional[str]:
        theme = self.get_theme(theme_id)
        if not theme:
            return None

        export_dir = self.themes_dir / "exports"
        export_dir.mkdir(exist_ok=True)
        zip_path = export_dir / f"{theme_id}.zip"

        with zipfile.ZipFile(zip_path, 'w') as zf:
            presets_to_export = theme.presets
            if include_presets is not None:
                presets_to_export = {k: v for k, v in theme.presets.items() if k in include_presets}

            theme_dataset = theme.to_dict()
            theme_dataset["presets"] = presets_to_export

            zf.writestr("theme.json", json.dumps(theme_dataset, indent=2))
            from plugins.presets import get_manager

            for tool, preset_id in presets_to_export.items():
                try:
                    manager = get_manager(tool)
                    preset_content = manager.get_preset_content(preset_id)
                    if preset_content:
                        zf.writestr(f"presets/{tool}/{preset_id}.conf", preset_content)
                        if tool == "wpaperd":
                            self._bundle_wpaperd_assets(preset_content, zf)

                except Exception as e:
                    print(f"Warning: Failed to export preset {tool}/{preset_id}: {e}")

        return str(zip_path)

    def _bundle_wpaperd_assets(self, config_content: str, zf: zipfile.ZipFile):
        import re
        matches = re.findall(r'path\s*=\s*["\']([^"\']+)["\']', config_content)

        for path in matches:
            file_path = Path(os.path.expanduser(path))
            if file_path.exists() and file_path.is_file():
                arcname = f"assets/wpaperd/{file_path.name}"
                try:
                    zf.getinfo(arcname)
                except KeyError:
                    zf.write(file_path, arcname)

    def import_theme(self, zip_path: str) -> Optional[Theme]:
        if not zipfile.is_zipfile(zip_path):
            raise ValueError("Invalid zip file")

        with zipfile.ZipFile(zip_path, 'r') as zf:
            try:
                theme_data = json.loads(zf.read("theme.json").decode('utf-8'))
            except KeyError:
                raise ValueError("Invalid theme file: missing theme.json")

            asset_map = {}  # old_filename -> new_absolute_path
            assets_dir = self.themes_dir / "assets" / self._sanitize_id(theme_data["name"])
            assets_dir.mkdir(parents=True, exist_ok=True)

            for file in zf.namelist():
                if file.startswith("assets/"):
                    source = zf.open(file)
                    try:
                        filename = os.path.basename(file)
                        target_path = assets_dir / filename

                        with open(target_path, "wb") as target:
                            shutil.copyfileobj(source, target)

                        asset_map[filename] = str(target_path.absolute())
                    finally:
                        source.close()

            from plugins.presets import get_manager

            new_presets_map = {}

            for file in zf.namelist():
                if file.startswith("presets/") and file.endswith(".conf"):
                    parts = file.split("/")
                    if len(parts) >= 3:
                        tool = parts[1]

                        content = zf.read(file).decode('utf-8')

                        if tool == "wpaperd":
                            for filename, local_path in asset_map.items():
                                import re
                                content = re.sub(
                                    f'path\\s*=\\s*["\'][^"\']*/{re.escape(filename)}["\']',
                                    f'path = "{local_path}"',
                                    content
                                )

                        # original_id = parts[-1].replace(".conf", "")

                        try:
                            manager = get_manager(tool)
                            item_name = f"{theme_data['name']}"

                            new_id = manager._generate_unique_id(item_name)
                            preset_path = manager._get_preset_path(new_id)
                            with open(preset_path, 'w') as f:
                                f.write(content)

                            now = datetime.utcnow().isoformat() + "Z"
                            new_preset = {
                                "id": new_id,
                                "name": item_name,
                                "description": f"Imported from theme '{theme_data['name']}'",
                                "created_at": now,
                                "updated_at": now,
                                "is_active": False,
                                "tool": tool
                            }

                            p_manifest = manager._load_manifest()
                            p_manifest["presets"].append(new_preset)
                            manager._save_manifest(p_manifest)

                            new_presets_map[tool] = new_id

                        except Exception as e:
                            import traceback
                            traceback.print_exc()
                            print(f"Failed to import preset for {tool}: {e}")

            return self.create_theme(
                name=theme_data["name"] + " (Imported)",
                description=theme_data["description"],
                presets=new_presets_map,
                author=theme_data.get("author", "Unknown")
            )

    def apply_theme(self, theme_id: str) -> Dict[str, bool]:
        theme = self.get_theme(theme_id)
        if not theme:
            return {}

        results = {}
        from plugins.presets import get_manager

        for tool, preset_id in theme.presets.items():
            try:
                manager = get_manager(tool)
                success = manager.activate_preset(preset_id, backup_current=True)
                results[tool] = success
            except Exception as e:
                print(f"Failed to apply theme preset for {tool}: {e}")
                results[tool] = False

        return results
