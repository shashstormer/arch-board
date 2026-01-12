"""
Hyprland configuration API routes.
Provides endpoints for reading and writing Hyprland config.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os

from plugins.hyprland.helpers.hyprlang import HyprLang
from plugins.hyprland.helpers.hyprland_schema import get_schema
from plugins.hyprland.models import EnvUpdate, ExecUpdate, WindowRuleUpdate, BindUpdate, LayerRuleUpdate
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup, register_search, SearchItem
from xtracto import Parser
from plugins.hyprland.helpers.migration import HyprlandVersion, ConfigMigrator

hyprland_router = APIRouter(prefix="/hyprland", tags=["hyprland"])

register_navigation(
    items=[NavItem(id="hyprland", title="Hyprland", url="/hyprland", icon="hyprland", group="config", order=10)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

from plugins.hyprland.helpers.hyprland_schema import HYPRLAND_SCHEMA

search_items = []

for tab in HYPRLAND_SCHEMA:

    search_items.append(SearchItem(
        id=f"hyprland-tab-{tab.id}",
        title=f"{tab.title} Settings",
        url=f"/hyprland?tab={tab.id}",
        category=f"Hyprland: {tab.title}",
        description=f"Configure {tab.title.lower()} settings",
        keywords=[tab.title.lower(), "settings", "config"]
    ))

    for section in tab.sections:
        for option in section.options:

            base_title = option.name.replace("_", " ").title()

            start_context = ""
            if section.title and "General" not in section.title and "Miscellaneous" not in section.title:
                start_context = f"{section.title}: "

            formatted_title = f"{start_context}{base_title}"

            search_items.append(SearchItem(
                id=f"hyprland-opt-{section.name}-{option.name}",
                title=formatted_title,
                url=f"/hyprland?tab={tab.id}",
                category=f"Hyprland: {tab.title}",
                description=option.description,
                keywords=option.name.split("_") + [tab.title.lower(), section.title.lower()],
                selector=f'[data-path="{section.name}:{option.name}"]'
            ))

special_tabs = [
    ("monitors", "Monitors", "Configure displays, resolution, positioning"),
    ("binds", "Keybinds", "Manage keyboard shortcuts and hotkeys"),
    ("gestures", "Gestures", "Touchpad and touchscreen gestures"),
    ("windowrules", "Window Rules", "Window placement and opacity rules"),
    ("exec", "Startup Commands", "Autostart applications and scripts"),
    ("env", "Environment Variables", "Session environment variables (QT, GTK, etc)")
]

for tab_id, title, desc in special_tabs:
    search_items.append(SearchItem(
        id=f"hyprland-special-{tab_id}",
        title=title,
        url=f"/hyprland?tab={tab_id}",
        category=f"Hyprland: {title}",
        description=desc,
        keywords=[title.lower(), "settings", "config"]
    ))

register_search(search_items)

CONFIG_PATH = os.path.expanduser("~/.config/hypr/hyprland.conf")


@hyprland_router.get("", response_class=HTMLResponse)
async def hyprland_page():
    parser = Parser(path="hyprland.pypx")
    parser.render(context=get_context({
        "current_page": "hyprland",
        "page_title": "ArchBoard - Hyprland Config",
        "page_header": "Hyprland Configuration",
        "page_description": "Configure your Hyprland window manager",
    }))
    return HTMLResponse(parser.html_content)


def to_hypr_value(value: Any) -> str:
    """Convert Python value to hyprland config format."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


class ConfigUpdate(BaseModel):
    """Request model for config updates."""
    path: str
    value: Any


class BulkConfigUpdate(BaseModel):
    """Request model for bulk config updates."""
    updates: Dict[str, Any]


@hyprland_router.get("/schema")
async def get_config_schema():
    """Return the config schema for UI generation."""
    return {"schema": get_schema()}


@hyprland_router.get("/config")
async def get_config():
    """Load and return the current config."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        config_values = {}

        schema = get_schema()
        for tab in schema:
            for section in tab["sections"]:
                section_name = section["name"]
                for option in section["options"]:
                    option_name = option["name"]

                    full_path = f"{section_name}:{option_name}"
                    value = conf.get(full_path)

                    if value is not None:
                        config_values[full_path] = value
                    else:

                        config_values[full_path] = option["default"]

        return {
            "config": config_values,
            "path": CONFIG_PATH
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/config")
async def update_config(update: ConfigUpdate):
    """Update a single config value."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        success = conf.set(update.path, to_hypr_value(update.value))

        if not success:
            raise HTTPException(status_code=400, detail=f"Failed to set {update.path}")

        hl.save()

        return {"success": True, "path": update.path, "value": update.value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/config/bulk")
async def bulk_update_config(update: BulkConfigUpdate):
    """Update multiple config values at once."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        results = {}
        for path, value in update.updates.items():
            success = conf.set(path, to_hypr_value(value))
            results[path] = {"success": success, "value": value}

        hl.save()

        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/reload")
async def reload_hyprland():
    """Trigger hyprctl reload."""
    try:
        import subprocess
        result = subprocess.run(["hyprctl", "reload"], capture_output=True, text=True)
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.get("/monitors")
async def get_monitors():
    """Get all monitor configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        monitors = []
        for line in conf.lines:
            if line.key == "monitor":

                parts = [p.strip() for p in line.value.raw.split(",")]
                if len(parts) >= 4:
                    monitors.append({
                        "raw": line.value.raw,
                        "name": parts[0],
                        "resolution": parts[1],
                        "position": parts[2],
                        "scale": parts[3],
                        "extras": parts[4:] if len(parts) > 4 else []
                    })
                elif len(parts) == 1 and parts[0] == "disable":
                    monitors.append({
                        "raw": line.value.raw,
                        "name": parts[0],
                        "disabled": True
                    })

        return {"monitors": monitors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class MonitorUpdate(BaseModel):
    """Monitor update model."""
    name: str
    resolution: str
    position: str
    scale: str
    extras: list = []


@hyprland_router.post("/monitors")
async def update_monitor(monitor: MonitorUpdate):
    """Add or update a monitor configuration."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        value = f"{monitor.name}, {monitor.resolution}, {monitor.position}, {monitor.scale}"
        if monitor.extras:
            value += ", " + ", ".join(monitor.extras)

        found = False
        for line in conf.lines:
            if line.key == "monitor" and line.value.raw.startswith(monitor.name + ","):
                line.value.raw = value
                found = True
                break

        if not found:
            from plugins.hyprland.helpers.hyprlang import HyprLine, HyprValue
            conf.lines.append(HyprLine(key="monitor", value=HyprValue(raw=value)))

        hl.save()
        return {"success": True, "monitor": monitor.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.get("/binds")
async def get_binds():
    """Get all keybind configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        binds = []
        submaps = {"global"}
        current_submap = "global"

        import re
        bindd_pattern = re.compile(r"^([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+)(?:,\s*(.*))?$")
        standard_pattern = re.compile(r"^([^,]*),\s*([^,]+),\s*([^,]+)(?:,\s*(.*))?$")

        for line in conf.lines:
            key = line.key.strip()
            if key == "submap":
                val = line.value.raw.strip().split(",")[0].strip()
                if val == "reset":
                    current_submap = "global"
                else:
                    current_submap = val
                    submaps.add(val)
                continue

            if key == "unbind":
                p = [x.strip() for x in line.value.raw.split(",", 1)]
                bind_info = {
                    "type": "unbind",
                    "raw_type": "unbind",
                    "raw": line.value.raw,
                    "flags": "",
                    "mods": p[0] if len(p) > 0 else "",
                    "key": p[1] if len(p) > 1 else "",
                    "dispatcher": "",
                    "params": "",
                    "description": "",
                    "submap": current_submap
                }
                binds.append(bind_info)
                continue

            if key.startswith("bind"):
                raw = line.value.raw
                flags = ""
                description = ""

                if key != "bind":
                    suffix = key[4:]
                    if suffix:
                        flags = suffix

                if "[" in key and key.endswith("]"):
                    flags += key[key.find("[") + 1: key.find("]")]

                parts = {}

                if key == "bindd":
                    match = bindd_pattern.match(raw)
                    if match:
                        parts = {
                            "mods": match.group(1).strip(),
                            "key": match.group(2).strip(),
                            "description": match.group(3).strip(),
                            "dispatcher": match.group(4).strip(),
                            "params": match.group(5).strip() if match.group(5) else ""
                        }
                    else:
                        p = [x.strip() for x in raw.split(",", 4)]
                        if len(p) >= 4:
                            parts = {"mods": p[0], "key": p[1], "description": p[2], "dispatcher": p[3],
                                     "params": p[4] if len(p) > 4 else ""}

                else:
                    match = standard_pattern.match(raw)
                    if match:
                        parts = {
                            "mods": match.group(1).strip(),
                            "key": match.group(2).strip(),
                            "dispatcher": match.group(3).strip(),
                            "params": match.group(4).strip() if match.group(4) else ""
                        }
                    else:
                        p = [x.strip() for x in raw.split(",", 3)]
                        parts = {
                            "mods": p[0] if len(p) > 0 else "",
                            "key": p[1] if len(p) > 1 else "",
                            "dispatcher": p[2] if len(p) > 2 else "",
                            "params": p[3] if len(p) > 3 else ""
                        }

                bind_info = {
                    "type": "bind",
                    "raw_type": key,
                    "raw": raw,
                    "flags": flags,
                    "mods": parts.get("mods", ""),
                    "key": parts.get("key", ""),
                    "dispatcher": parts.get("dispatcher", ""),
                    "params": parts.get("params", ""),
                    "description": parts.get("description", ""),
                    "submap": current_submap
                }
                binds.append(bind_info)

        return {"binds": binds, "submaps": sorted(list(submaps))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BindUpdate(BaseModel):
    """Keybind update model."""
    action: str = "add"
    type: str = "bind"
    flags: str = ""
    mods: str
    key: str
    dispatcher: str
    params: str = ""
    description: str = ""
    submap: str = "global"
    old_raw: Optional[str] = None


@hyprland_router.get("/windowrules")
async def get_windowrules():
    """Get all window rule configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        rules = []
        for line in conf.lines:
            if line.key == "windowrule" or line.key == "windowrulev2":
                parts = [p.strip() for p in line.value.raw.split(",", 1)]
                rules.append({
                    "type": line.key,
                    "raw": line.value.raw,
                    "effect": parts[0] if len(parts) > 0 else "",
                    "match": parts[1] if len(parts) > 1 else ""
                })

        return {"windowrules": rules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SubmapUpdate(BaseModel):
    """Submap update model."""
    action: str
    name: str


class BindReorder(BaseModel):
    """Bind reordering model."""
    submap: str
    ordered_raws: list[str]


@hyprland_router.post("/submaps")
async def update_submap(update: SubmapUpdate):
    """Add or delete a submap."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        if update.action == "add":
            # Check if exists
            if any(l.strip() == f"submap = {update.name}" for l in lines):
                return {"success": False, "message": "Submap already exists"}

            # Append to end
            lines.append(f"\n# Submap: {update.name}\n")
            lines.append(f"bind = ALT, M, submap, {update.name} # Example entry\n")
            lines.append(f"submap = {update.name}\n")
            lines.append(f"bind = , ESCAPE, submap, reset\n")
            lines.append(f"submap = reset\n")

        elif update.action == "delete":
            # Remove the submap block
            # We look for `submap = name` ... `submap = reset`
            new_lines = []
            in_submap = False
            for line in lines:
                if line.strip() == f"submap = {update.name}":
                    in_submap = True
                    continue
                if in_submap and line.strip() == "submap = reset":
                    in_submap = False
                    continue
                if not in_submap:
                    new_lines.append(line)
            lines = new_lines

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# @hyprland_router.post("/binds/reorder")
# async def reorder_binds(update: BindReorder):
#     """Reorder keybinds within a submap."""
#     if not os.path.exists(CONFIG_PATH):
#         raise HTTPException(status_code=404, detail="Hyprland config not found")
#
#     try:
#         with open(CONFIG_PATH, 'r') as f:
#             lines = f.readlines()
#
#         # Identify submap range
#         start_idx = -1
#         end_idx = -1
#
#         if update.submap == "global":
#             start_idx = 0
#             pass # FUTURE
#         else:
#             for i, line in enumerate(lines):
#                 if line.strip() == f"submap = {update.submap}":
#                     start_idx = i
#                 if start_idx != -1 and line.strip() == "submap = reset" and i > start_idx:
#                     end_idx = i
#                     break
#
#         lines_to_move = {}
#         indices_to_remove = []
#
#         search_range = range(len(lines))
#         if start_idx != -1 and end_idx != -1:
#             search_range = range(start_idx + 1, end_idx)
#         elif update.submap != "global":
#             # Submap not found?
#             return {"success": False}
#
#         # Find matching lines
#         for i in search_range:
#             raw_val = lines[i].split("=", 1)[1].strip() if "=" in lines[i] else ""
#             if "=" in lines[i]:
#                 parts = lines[i].split("=", 1)
#                 val = parts[1].strip()
#                 if val in update.ordered_raws:
#                     lines_to_move[val] = lines[i]
#                     indices_to_remove.append(i)
#
#         # Remove
#         for i in sorted(indices_to_remove, reverse=True):
#             del lines[i]
#
#         # Insert back
#         insert_point = indices_to_remove[0] if indices_to_remove else (start_idx + 1 if start_idx != -1 else len(lines))
#
#         for raw in update.ordered_raws:
#             if raw in lines_to_move:
#                 lines.insert(insert_point, lines_to_move[raw])
#                 insert_point += 1
#
#         with open(CONFIG_PATH, 'w') as f:
#             f.writelines(lines)
#
#         return {"success": True}
#
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.get("/layerrules")
async def get_layerrules():
    """Get all layer rule configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        rules = []
        for line in conf.lines:
            if line.key == "layerrule":

                raw = line.value.raw
                parts = [p.strip() for p in raw.split(",", 1)]

                effect = parts[0] if len(parts) > 0 else ""
                namespace = ""

                if len(parts) > 1:
                    match_part = parts[1]
                    if "match:namespace" in match_part.lower():

                        idx = match_part.lower().find("match:namespace")
                        rest = match_part[idx + 15:].strip()
                        namespace = rest.split(",")[0].strip()
                    else:

                        namespace = match_part.strip()

                rules.append({
                    "raw": raw,
                    "effect": effect,
                    "namespace": namespace
                })

        return {"layerrules": rules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/layerrules")
async def update_layer_rule(update: LayerRuleUpdate):
    """Add, update, or delete a layer rule."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        version = HyprlandVersion.detect()
        use_new_syntax = False

        if version:
            use_new_syntax = version.supports_new_window_rules()
        else:

            hl = HyprLang(CONFIG_PATH)
            conf = hl.load()
            for line in conf.lines:
                if (line.key == "layerrule" and "match:" in line.value.raw):
                    use_new_syntax = True
                    break

        if use_new_syntax:
            # New syntax: effect on, match:namespace namespace
            effect_part = update.effect.strip()

            # Normalize common legacy inputs to new syntax
            if effect_part == "ignorezero":
                effect_part = "ignore_alpha 0"
            elif effect_part == "stayfocused":
                effect_part = "stay_focused"
            elif effect_part.startswith("ignorealpha"):
                effect_part = effect_part.replace("ignorealpha", "ignore_alpha", 1)

            # Ensure proper formatting
            # "blur" -> "blur on"
            # "ignore_alpha 0.5" -> "ignore_alpha 0.5" (no on)
            if " " not in effect_part:
                effect_part = f"{effect_part} on"

            new_line = f"layerrule = {effect_part}, match:namespace {update.namespace}\n"
        else:
            # Legacy syntax: effect, namespace
            effect_part = update.effect.strip()

            # Back-port new syntax inputs to legacy if needed
            if effect_part == "stay_focused":
                effect_part = "stayfocused"
            elif effect_part == "ignore_alpha 0":
                effect_part = "ignorezero"
            elif effect_part.startswith("ignore_alpha"):
                effect_part = effect_part.replace("ignore_alpha", "ignorealpha", 1)
            if effect_part.endswith(" on"):
                effect_part = effect_part[:-3]
            new_line = f"layerrule = {effect_part}, {update.namespace}\n"

        if update.action == "add":
            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("layerrule"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            if update.old_raw:
                for i, line in enumerate(lines):
                    if update.old_raw in line:
                        lines[i] = new_line
                        break

        elif update.action == "delete":
            if update.old_raw:
                lines = [l for l in lines if update.old_raw not in l]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.get("/exec")
async def get_exec_commands():
    """Get all exec and exec-once commands."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        commands = []
        for line in conf.lines:
            if line.key in ["exec", "exec-once"]:
                commands.append({
                    "type": line.key,
                    "command": line.value.raw
                })

        return {"exec": commands}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.get("/env")
async def get_env_vars():
    """Get all environment variable configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        env_vars = []
        for i, line in enumerate(conf.lines):
            if line.key == "env":
                parts = line.value.raw.split(",", 1)
                if len(parts) >= 2:
                    env_vars.append({
                        "index": i,
                        "name": parts[0].strip(),
                        "value": parts[1].strip(),
                        "raw": line.value.raw
                    })
                elif len(parts) == 1:
                    env_vars.append({
                        "index": i,
                        "name": parts[0].strip(),
                        "value": "",
                        "raw": line.value.raw
                    })

        return {"env": env_vars}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/env")
async def update_env_var(update: EnvUpdate):
    """Add, update, or delete an environment variable."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        new_line = f"env = {update.name},{update.value}\n"

        if update.action == "add":
            insert_idx = 0
            for i, line in enumerate(lines):
                if line.strip().startswith("env ="):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            old_pattern = f"env = {update.old_name}," if update.old_name else None
            for i, line in enumerate(lines):
                if old_pattern and line.strip().startswith(old_pattern):
                    lines[i] = new_line
                    break

        elif update.action == "delete":
            pattern = f"env = {update.name},"
            lines = [l for l in lines if not l.strip().startswith(pattern)]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/exec")
async def update_exec_command(update: ExecUpdate):
    """Add, update, or delete an exec command."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        new_line = f"{update.type} = {update.command}\n"

        if update.action == "add":
            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("exec"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            old_line = f"{update.type} = {update.old_command}"
            for i, line in enumerate(lines):
                if line.strip() == old_line.strip():
                    lines[i] = new_line
                    break

        elif update.action == "delete":
            target = f"{update.type} = {update.command}"
            lines = [l for l in lines if l.strip() != target.strip()]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/windowrules")
async def update_window_rule(update: WindowRuleUpdate):
    """Add, update, or delete a window rule."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        version = HyprlandVersion.detect()
        use_new_syntax = False
        if version:
            use_new_syntax = version.supports_new_window_rules()
        else:
            hl = HyprLang(CONFIG_PATH)
            conf = hl.load()
            for line in conf.lines:
                if (line.key == "windowrule" and "match:" in line.value.raw):
                    use_new_syntax = True
                    break
        if use_new_syntax:
            rule_type = "windowrule"
            effect = update.effect
            if " " not in effect:
                effect = f"{effect} on"
            if effect.startswith("ignorealpha"):
                effect = effect.replace("ignorealpha", "ignore_alpha", 1)
            match_parts = [p.strip() for p in update.match.split(",")]
            new_matches = []
            KNOWN_KEYS = {
                'class', 'title', 'initialclass', 'initialtitle',
                'floating', 'xwayland', 'pinned', 'workspace',
                'fullscreen', 'monitor', 'address', 'pid', 'uid', 'group'
            }

            for part in match_parts:
                part_lower = part.lower()
                if part_lower.startswith("match:"):
                    new_matches.append(part)
                elif ":" in part:
                    key, val = part.split(":", 1)
                    if key.lower() in KNOWN_KEYS:
                        new_matches.append(f"match:{key.lower()} {val}")
                    else:
                        new_matches.append(f"match:class {part}")
                else:
                    new_matches.append(f"match:class {part}")

            match_str = ", ".join(new_matches)
            new_line = f"windowrule = {effect}, {match_str}\n"
        else:
            new_line = f"{update.type} = {update.effect},{update.match}\n"

        if update.action == "add":

            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("windowrule"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            if update.old_raw:
                for i, line in enumerate(lines):
                    if update.old_raw in line:
                        lines[i] = new_line
                        break

        elif update.action == "delete":
            if update.old_raw:
                lines = [l for l in lines if update.old_raw not in l]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/binds")
async def update_bind(update: BindUpdate):
    """Add, update, or delete a keybind."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        if update.action == "add":
            if update.type == "unbind":
                new_line = f"{update.type} = {update.mods},{update.key}\n"
            else:
                params = f",{update.params}" if update.params else ""
                new_line = f"{update.type} = {update.mods},{update.key},{update.dispatcher}{params}\n"

            if update.submap and update.submap != "global":
                submap_start = -1
                submap_end = -1
                for i, line in enumerate(lines):
                    if line.strip() == f"submap = {update.submap}":
                        submap_start = i
                    if submap_start != -1 and i > submap_start and line.strip() == "submap = reset":
                        submap_end = i
                        break
                
                if submap_end != -1:
                    lines.insert(submap_end, new_line)
                else:
                    lines.append(f"\n# Submap: {update.submap}\n")
                    lines.append(f"submap = {update.submap}\n")
                    lines.append(new_line)
                    lines.append("submap = reset\n")
            else:
                lines.append(new_line)

        elif update.action == "update":
            if update.old_raw:
                if update.type == "unbind":
                    new_line = f"{update.type} = {update.mods},{update.key}\n"
                else:
                    params = f",{update.params}" if update.params else ""
                    new_line = f"{update.type} = {update.mods},{update.key},{update.dispatcher}{params}\n"
                
                for i, line in enumerate(lines):
                    if update.old_raw in line:
                        lines[i] = new_line
                        break

        elif update.action == "delete":
            if update.old_raw:
                lines = [l for l in lines if update.old_raw not in l]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.get("/windows")
async def get_open_windows():
    """Get list of open windows via hyprctl."""
    import subprocess
    import json

    try:
        result = subprocess.run(
            ["hyprctl", "clients", "-j"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode != 0:
            return {"windows": []}

        clients = json.loads(result.stdout)
        windows = []
        for client in clients:
            windows.append({
                "title": client.get("title", ""),
                "class": client.get("class", ""),
                "initialClass": client.get("initialClass", ""),
                "initialTitle": client.get("initialTitle", ""),
                "address": client.get("address", ""),
                "workspace": client.get("workspace", {}).get("name", "")
            })

        return {"windows": windows}
    except Exception as e:
        return {"windows": [], "error": str(e)}


class GestureUpdate(BaseModel):
    """Request model for gesture updates."""
    action: str
    fingers: int
    direction: str
    gesture_action: str
    dispatcher: Optional[str] = ""
    params: Optional[str] = ""
    mod: Optional[str] = ""
    scale: Optional[str] = ""
    old_raw: Optional[str] = None


@hyprland_router.get("/gestures")
async def get_gestures():
    """Get all gesture configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        gestures = []
        for line in conf.lines:
            if line.key == "gesture":

                raw = line.value.raw
                parts = [p.strip() for p in raw.split(",")]

                if len(parts) >= 3:
                    fingers = parts[0]
                    direction = parts[1]

                    mod = ""
                    scale = ""
                    idx = 2

                    while idx < len(parts):
                        part = parts[idx]
                        if part.startswith("mod:"):
                            mod = part.replace("mod:", "").strip()
                            idx += 1
                        elif part.startswith("scale:"):
                            scale = part.replace("scale:", "").strip()
                            idx += 1
                        else:
                            break

                    if idx < len(parts):
                        action = parts[idx]
                        dispatcher = ""
                        params = ""

                        if action.lower() == "dispatcher" and idx + 1 < len(parts):
                            dispatcher = parts[idx + 1]
                            params = ",".join(parts[idx + 2:]) if idx + 2 < len(parts) else ""
                            action = "dispatcher"
                        else:
                            params = ",".join(parts[idx + 1:]) if idx + 1 < len(parts) else ""

                        gestures.append({
                            "fingers": fingers,
                            "direction": direction,
                            "action": action,
                            "dispatcher": dispatcher,
                            "params": params,
                            "mod": mod,
                            "scale": scale,
                            "raw": raw
                        })

        return {"gestures": gestures}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/gestures")
async def update_gesture(update: GestureUpdate):
    """Add, update, or delete a gesture."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        parts = [str(update.fingers), update.direction]

        if update.mod:
            parts.append(f"mod: {update.mod}")

        if update.scale:
            parts.append(f"scale: {update.scale}")

        if update.gesture_action == "dispatcher":

            parts.append("dispatcher")
            parts.append(update.dispatcher)
            if update.params:
                parts.append(update.params)
        else:
            parts.append(update.gesture_action)
            if update.params:
                parts.append(update.params)

        new_line = f"gesture = {', '.join(parts)}\n"

        if update.action == "add":

            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("gesture"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            if update.old_raw:
                for i, line in enumerate(lines):
                    if update.old_raw in line:
                        lines[i] = new_line
                        break

        elif update.action == "delete":
            if update.old_raw:
                lines = [l for l in lines if update.old_raw not in l]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from plugins.hyprland.helpers.migration import HyprlandVersion, ConfigMigrator, MigrationResult
from pathlib import Path


@hyprland_router.get("/migration/version")
async def get_hyprland_version():
    """Get the detected Hyprland version."""
    version = HyprlandVersion.detect()
    if version:
        return {
            "version": str(version),
            "major": version.major,
            "minor": version.minor,
            "patch": version.patch,
            "supports_new_window_rules": version.supports_new_window_rules()
        }
    return {"version": None, "error": "Could not detect Hyprland version"}


@hyprland_router.get("/migration/status")
async def get_migration_status():
    """Check if config needs migration and return summary."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        needs_migration = ConfigMigrator.needs_migration(conf)
        summary = ConfigMigrator.get_migration_summary(conf) if needs_migration else ""

        version = HyprlandVersion.detect()
        version_info = None
        if version:
            version_info = {
                "version": str(version),
                "supports_new_window_rules": version.supports_new_window_rules()
            }

        return {
            "needs_migration": needs_migration,
            "summary": summary,
            "version": version_info,
            "config_path": CONFIG_PATH
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/migration/migrate")
async def migrate_config():
    """Perform migration with automatic backup."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        if not ConfigMigrator.needs_migration(conf):
            return {
                "success": True,
                "migrated": False,
                "message": "Config is already using new syntax"
            }

        config_path = Path(CONFIG_PATH)
        backup_path = ConfigMigrator.backup_config(config_path)

        result = ConfigMigrator.migrate(conf)

        hl.save()

        return {
            "success": True,
            "migrated": True,
            "migrated_rules": result.migrated_rules,
            "renamed_options": result.renamed_options,
            "backup_path": str(backup_path),
            "message": f"Migrated {result.migrated_rules} rules, renamed {result.renamed_options} options. Backup saved to {backup_path.name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/submaps")
async def update_submap(update: SubmapUpdate):
    """Add or delete a submap."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        if update.action == "add":
            # Append new submap at the end
            lines.append(f"\n# Submap: {update.name}\n")
            lines.append(f"submap = {update.name}\n")
            lines.append(f"submap = reset\n")

        elif update.action == "delete":
            # Remove submap block
            new_lines = []
            in_target_submap = False

            for line in lines:
                strip = line.strip()
                if strip.startswith(f"submap = {update.name}"):
                    in_target_submap = True
                    continue

                if in_target_submap:
                    if strip.startswith("submap = reset"):
                        in_target_submap = False
                    continue

                new_lines.append(line)

            lines = new_lines

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/binds/reorder")
async def reorder_binds(update: BindReorder):
    """Reorder binds within a submap."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        start_idx = 0
        end_idx = len(lines)

        if update.submap != "global":
            found_start = False
            for i, line in enumerate(lines):
                if line.strip().startswith(f"submap = {update.submap}"):
                    start_idx = i + 1
                    found_start = True
                    break

            if not found_start:
                raise HTTPException(status_code=404, detail=f"Submap {update.submap} not found")

            for i in range(start_idx, len(lines)):
                if lines[i].strip().startswith("submap = reset"):
                    end_idx = i
                    break

        lines_to_move = []
        order_map = {r.strip(): i for i, r in enumerate(update.ordered_raws)}
        indices_to_delete = []

        for i in range(start_idx, end_idx):
            line = lines[i]
            parts = line.split('=', 1)
            if len(parts) > 1:
                key = parts[0].strip()
                val = parts[1].strip()
                if key.startswith("bind") and val in order_map:
                    lines_to_move.append({
                        "original_line": line,
                        "sort_index": order_map[val]
                    })
                    indices_to_delete.append(i)

        if not lines_to_move:
            return {"success": True, "message": "No binds moved"}

        lines_to_move.sort(key=lambda x: x["sort_index"])

        insert_point = indices_to_delete[0]

        for idx in sorted(indices_to_delete, reverse=True):
            del lines[idx]

        for i, item in enumerate(lines_to_move):
            lines.insert(insert_point + i, item["original_line"])

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
