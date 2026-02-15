import json
import os
import shutil
import zipfile
from dataclasses import dataclass, asdict, field
import datetime
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
    dependencies: List[Dict[str, str]] = field(default_factory=list)
    source_url: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Theme':
        if "source_url" not in data:
            data["source_url"] = None
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

    def _sync_active_presets(self, presets: Dict[str, str]):
        from plugins.presets import get_manager
        for tool, preset_id in presets.items():
            if not preset_id: continue
            try:
                manager = get_manager(tool)
                active_id = manager.get_active_preset()
                if active_id and active_id == preset_id:
                    manager.update_preset_content(preset_id)
            except Exception as e:
                print(f"Failed to sync preset {tool}/{preset_id}: {e}")

    def create_theme(self, name: str, description: str, presets: Dict[str, str], author: str = "User",
                     dependencies: List[str] = None, source_url: str = None) -> Theme:
        theme_id = self._generate_unique_id(name)
        now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

        self._sync_active_presets(presets)

        theme = Theme(
            id=theme_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
            author=author,
            presets=presets,
            dependencies=dependencies or [],
            source_url=source_url
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
        valid_fields = {"name", "description", "author", "presets", "dependencies", "source_url"}
        updated = False

        for key, value in kwargs.items():
            if key in valid_fields:
                theme_data[key] = value
                updated = True

        if updated:
            theme_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
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

    def export_theme(self, theme_id: str, include_presets: List[str] = None, included_assets: List[str] = None) -> \
            Optional[str]:
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

            self._sync_active_presets(presets_to_export)

            theme_dataset = theme.to_dict()
            theme_dataset["presets"] = presets_to_export

            zf.writestr("theme.json", json.dumps(theme_dataset, indent=2))
            from plugins.presets import get_manager

            for tool, preset_id in presets_to_export.items():
                try:
                    manager = get_manager(tool)
                    preset_content = manager.get_preset_content(preset_id)
                    if preset_content:

                        if tool in ["wpaperd", "hyprlock", "hyprland"]:
                            preset_content = self._process_and_bundle_assets(preset_content, zf, tool, included_assets)

                        if tool == "waybar":
                            self._bundle_waybar_style(manager.config_path, zf, included_assets)

                        zf.writestr(f"presets/{tool}/{preset_id}.conf", preset_content)

                except Exception as e:
                    print(f"Warning: Failed to export preset {tool}/{preset_id}: {e}")

        return str(zip_path)

    def _bundle_waybar_style(self, config_path: Path, zf: zipfile.ZipFile, included_assets: List[str] = None):
        style_path = config_path.parent / "style.css"
        if style_path.exists():
            if included_assets is not None and str(style_path.absolute()) not in included_assets:
                return

            arcname = "assets/waybar/style.css"
            try:
                zf.getinfo(arcname)
            except KeyError:
                zf.write(style_path, arcname)

    def _get_asset_patterns(self, tool: str) -> List[str]:
        patterns = []
        if tool in ["wpaperd", "hyprlock"]:
            patterns.append(r'path\s*=\s*["\']?([^"\']+\.(png|jpg|jpeg|conf))["\']?')
            patterns.append(r'image\s*=\s*["\']?([^"\']+\.(png|jpg|jpeg))["\']?')
        elif tool == "hyprland":
            patterns.append(r'source\s*=\s*["\']?([^"\']+\.conf)["\']?')
            patterns.append(r'exec-once\s*=\s*["\']?([^"\s\']+\.(sh|py))["\']?')
            patterns.append(r'exec\s*=\s*["\']?([^"\s\']+\.(sh|py))["\']?')
            patterns.append(r'bind[a-z]*\s*=.*,\s*exec\s*,\s*["\']?([^"\s\']+\.(sh|py))["\']?')
        elif tool == "waybar":
            patterns.append(r'"(?:exec|on-click)"\s*:\s*["\']([^"\']+\.(sh|py))["\']')
        return patterns

    def detect_dependencies(self, presets: Dict[str, str]) -> List[Dict[str, str]]:
        """
        Scan the provided presets (tool -> preset_id) for potential dependencies.
        Returns a list of dicts: [{"name": "pkg", "source": "pacman"}, ...]
        """
        dependencies = set()
        self._sync_active_presets(presets)
        from plugins.presets import get_manager
        import re

        IGNORE_LIST = {
            "hyprland", "waybar", "hypridle", "hyprlock", "wpaperd", "bash", "sh", "python", "python3",
            "mkdir", "rm", "cp", "mv", "cat", "echo", "sleep", "true", "false", "grep", "sed", "awk",
            "pkill", "pidof", "systemctl", "notify-send", "playerctl", "brightnessctl", "pamixer", "wpctl",
            "loginctl", "nm-connection-editor", "blueman-manager", "pavucontrol", "firefox", "kitty", "alacritty",
            "curl", "wget", "tar", "unzip", "git", "xdg-open", "viewnior", "thunar", "dolphin", "nautilus",
            "wofi", "rofi", "tofi", "fuzzel", "swww", "swww-daemon", "swaybg", "gammastep", "grim", "slurp", "wl-copy",
            "swaylock", "gtklock", "date", "cut", "tr", "wc", "sort", "uniq", "whoami", "hostname", "uptime", "free"
        }

        CORE_IGNORE = {
            "bash", "sh", "python", "python3", "mkdir", "rm", "cp", "mv", "cat", "echo", "sleep", "true", "false",
            "grep", "sed", "awk", "cut", "tr", "wc", "sort", "uniq", "whoami", "hostname", "uptime", "free",
            "pkill", "pidof", "systemctl", "loginctl", "date", "ls", "find", "xargs", "kill", "nice", "renice",
            "hyprland", "waybar", "hypridle", "hyprlock", "wpaperd", "exec", "activate", "apply-gsettings"
        }

        for tool, preset_id in presets.items():
            if not preset_id: continue
            try:
                manager = get_manager(tool)
                content = manager.get_preset_content(preset_id)
                if not content: continue

                commands = []

                if tool == "hyprland":
                    hypr_patterns = [
                        r'exec-once\s*=\s*([^,\s]+)',
                        r'exec\s*=\s*([^,\s]+)',
                        r'bind[a-z]*\s*=.*,\s*exec\s*,\s*([^,\s]+)'
                    ]
                    for pat in hypr_patterns:
                        commands.extend(re.findall(pat, content))

                elif tool == "waybar":
                    waybar_patterns = [
                        r'"exec"\s*:\s*["\']([^"\s]+)',
                        r'"on-click"\s*:\s*["\']([^"\s]+)',
                        r'"on-click-right"\s*:\s*["\']([^"\s]+)',
                        r'"on-click-middle"\s*:\s*["\']([^"\s]+)'
                    ]
                    for pat in waybar_patterns:
                        commands.extend(re.findall(pat, content))

                elif tool == "hypridle":
                    idle_patterns = [
                        r'on-timeout\s*=\s*([^,\s]+)',
                        r'on-resume\s*=\s*([^,\s]+)'
                    ]
                    for pat in idle_patterns:
                        commands.extend(re.findall(pat, content))

                for cmd in commands:
                    cmd = cmd.strip('"\'')
                    if not cmd: continue

                    if cmd.endswith(".sh") or cmd.endswith(".py"):
                        continue

                    name = os.path.basename(cmd)

                    if name not in CORE_IGNORE and name not in dependencies:
                        dependencies.add(name)

            except Exception as e:
                print(f"Error detecting deps for {tool}: {e}")

        return [{"name": d, "source": "pacman"} for d in sorted(list(dependencies))]

    def analyze_theme_export(self, theme_id: str, include_presets: List[str] = None) -> List[Dict[str, str]]:
        theme = self.get_theme(theme_id)
        if not theme:
            return []

        assets = []
        presets_to_analyze = theme.presets
        if include_presets is not None:
            presets_to_analyze = {k: v for k, v in theme.presets.items() if k in include_presets}

        self._sync_active_presets(presets_to_analyze)
        from plugins.presets import get_manager

        for tool, preset_id in presets_to_analyze.items():
            try:
                manager = get_manager(tool)

                if tool == "waybar":
                    style_path = manager.config_path.parent / "style.css"
                    if style_path.exists():
                        assets.append({
                            "original_path": str(style_path.absolute()),
                            "arcname": "assets/waybar/style.css",
                            "tool": "waybar"
                        })

                content = manager.get_preset_content(preset_id)
                if content and tool in ["wpaperd", "hyprlock", "hyprland", "waybar"]:
                    found = self._analyze_assets_in_content(content, tool)
                    assets.extend(found)

            except Exception as e:
                print(f"Error analyzing {tool}: {e}")

        return assets

    def _analyze_assets_in_content(self, content: str, tool: str) -> List[Dict[str, str]]:
        import re
        patterns = self._get_asset_patterns(tool)

        results = []
        path_map = {}
        counter = 1

        for pattern in patterns:
            for match in re.finditer(pattern, content):
                original_path_str = match.group(1)

                full_path = os.path.expanduser(os.path.expandvars(original_path_str))
                
                if not os.path.isabs(full_path):
                     if full_path.startswith(".config") or full_path.startswith(".local"):
                         full_path = os.path.join(os.path.expanduser("~"), full_path)
                
                real_path = os.path.abspath(full_path)

                if not os.path.exists(real_path) or not os.path.isfile(real_path):
                    continue
                if not real_path.startswith(os.path.expanduser("~")): continue

                if real_path not in path_map:
                    fname = os.path.basename(real_path)
                    unique_name = f"{counter}_{fname}"
                    path_map[real_path] = unique_name
                    counter += 1

                    results.append({
                        "original_path": real_path,
                        "arcname": f"assets/{tool}/{unique_name}",
                        "tool": tool
                    })

        return results

    def _process_and_bundle_assets(self, config_content: str, zf: zipfile.ZipFile, tool: str,
                                   included_assets: List[str] = None) -> str:
        import re

        patterns = self._get_asset_patterns(tool)
        path_map = {}
        counter = 1
        new_content = config_content

        for pattern in patterns:
            for match in re.finditer(pattern, config_content):
                full_match = match.group(0)
                original_path_str = match.group(1)

                full_path = os.path.expanduser(os.path.expandvars(original_path_str))
                if not os.path.isabs(full_path):
                     if full_path.startswith(".config") or full_path.startswith(".local"):
                         full_path = os.path.join(os.path.expanduser("~"), full_path)
                
                real_path = os.path.abspath(full_path)

                if not os.path.exists(real_path) or not os.path.isfile(real_path):
                    continue

                if not real_path.startswith(os.path.expanduser("~")): continue

                if included_assets is not None and real_path not in included_assets:
                    continue

                if real_path not in path_map:
                    fname = os.path.basename(real_path)
                    unique_name = f"{counter}_{fname}"
                    path_map[real_path] = unique_name
                    counter += 1

                    arcname = f"assets/{tool}/{unique_name}"
                    try:
                        zf.getinfo(arcname)
                    except KeyError:
                        zf.write(real_path, arcname)

                unique_name = path_map[real_path]

                new_val = f"assets/{tool}/{unique_name}"
                new_line = full_match.replace(original_path_str, new_val)

                new_content = new_content.replace(full_match, new_line)

        return new_content

    def download_from_github(self, url: str) -> str:
        import urllib.request
        import urllib.parse
        import tempfile

        download_url = url
        if "github.com" in url and "archive" not in url and ".zip" not in url:
            parts = url.rstrip("/").split("/")
            if len(parts) >= 2:
                user = parts[-2]
                repo = parts[-1]
                download_url = f"https://github.com/{user}/{repo}/raw/main/theme.zip"

        fd, temp_path = tempfile.mkstemp(suffix=".zip")
        os.close(fd)

        try:
            print(f"Downloading from {download_url}...")
            try:
                urllib.request.urlretrieve(download_url, temp_path)
            except Exception:
                if "main" in download_url:
                    alt_url = download_url.replace("main", "master", 1)
                    print(f"Retrying with {alt_url}...")
                    urllib.request.urlretrieve(alt_url, temp_path)
                else:
                    raise

            return temp_path
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise ValueError(f"Failed to download theme: {e}")

    def import_theme(self, zip_path: str, source_url: str = None) -> Optional[Theme]:
        if not zipfile.is_zipfile(zip_path):
            raise ValueError("Invalid zip file")

        with zipfile.ZipFile(zip_path, 'r') as zf:
            try:
                theme_data = json.loads(zf.read("theme.json").decode('utf-8'))
            except KeyError:
                raise ValueError("Invalid theme file: missing theme.json")

            target_id = theme_data.get("id")
            if not target_id:
                target_id = self._sanitize_id(theme_data["name"])
            existing_theme = self.get_theme(target_id)

            assets_dir = self.themes_dir / "assets" / self._sanitize_id(theme_data["name"])
            assets_dir.mkdir(parents=True, exist_ok=True)

            for file in zf.namelist():
                if file.startswith("assets/") and not file.endswith("/"):
                    source = zf.open(file)
                    try:
                        rel_path = file[7:]
                        target_path = assets_dir / rel_path
                        target_path.parent.mkdir(parents=True, exist_ok=True)
                        with open(target_path, "wb") as target:
                            shutil.copyfileobj(source, target)
                    finally:
                        source.close()

            from plugins.presets import get_manager

            new_presets_map = {}
            if existing_theme:
                new_presets_map = existing_theme.presets.copy()

            for file in zf.namelist():
                if file.startswith("presets/") and file.endswith(".conf"):
                    parts = file.split("/")
                    if len(parts) >= 3:
                        tool = parts[1]

                        content = zf.read(file).decode('utf-8')

                        if tool in ["wpaperd", "hyprlock", "hyprland"]:
                            abs_path_prefix = str(assets_dir).rstrip("/") + "/"
                            content = content.replace("assets/", abs_path_prefix)

                        try:
                            manager = get_manager(tool)

                            theme_author = theme_data.get("author", "Unknown")
                            preset_name = f"{theme_data['name']} ({theme_author})"

                            now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
                            p_manifest = manager._load_manifest()
                            existing_preset_id = existing_theme.presets.get(tool) if existing_theme else None

                            if existing_preset_id:
                                preset_id = existing_preset_id
                                preset_path = manager._get_preset_path(preset_id)
                                with open(preset_path, 'w') as f:
                                    f.write(content)
                                for p in p_manifest["presets"]:
                                    if p["id"] == preset_id:
                                        p["name"] = preset_name
                                        p["description"] = f"Imported from theme '{theme_data['name']}' by {theme_author}"
                                        p["updated_at"] = now
                                        break
                                manager._save_manifest(p_manifest)
                            else:
                                preset_id = manager._generate_unique_id(preset_name)
                                preset_path = manager._get_preset_path(preset_id)
                                with open(preset_path, 'w') as f:
                                    f.write(content)

                                preset_data = {
                                    "id": preset_id,
                                    "name": preset_name,
                                    "description": f"Imported from theme '{theme_data['name']}' by {theme_author}",
                                    "created_at": now,
                                    "updated_at": now,
                                    "is_active": False,
                                    "tool": tool
                                }

                                p_manifest["presets"].append(preset_data)
                                manager._save_manifest(p_manifest)

                            new_presets_map[tool] = preset_id

                        except Exception as e:
                            import traceback
                            traceback.print_exc()
                            print(f"Failed to import preset for {tool}: {e}")

            if existing_theme:
                return self.update_theme(
                    existing_theme.id,
                    name=theme_data["name"],
                    description=theme_data.get("description", existing_theme.description),
                    author=theme_data.get("author", existing_theme.author),
                    presets=new_presets_map,
                    dependencies=theme_data.get("dependencies", existing_theme.dependencies),
                    source_url=source_url or theme_data.get("source_url") or existing_theme.source_url
                )
            else:
                return self.create_theme(
                    name=theme_data["name"],
                    description=theme_data["description"],
                    presets=new_presets_map,
                    author=theme_data.get("author", "Unknown"),
                    dependencies=theme_data.get("dependencies", []),
                    source_url=source_url or theme_data.get("source_url")
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

                if success and tool == "waybar":
                    style_asset = self.themes_dir / "assets" / self._sanitize_id(theme.name) / "waybar" / "style.css"
                    if style_asset.exists():
                        config_dir = manager.config_path.parent
                        target_style = config_dir / "style.css"

                        if target_style.exists():
                            backup_style = target_style.with_suffix(".css.backup")
                            shutil.copy2(target_style, backup_style)

                        shutil.copy2(style_asset, target_style)

            except Exception as e:
                print(f"Failed to apply theme preset for {tool}: {e}")
                results[tool] = False

        return results
