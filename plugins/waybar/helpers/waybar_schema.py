"""
Waybar configuration schema.
Defines module-specific options for form generation.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional, Dict
from enum import Enum


class OptionType(Enum):
    BOOL = "bool"
    INT = "int"
    FLOAT = "float"
    STRING = "string"
    ENUM = "enum"
    JSON = "json"  # For complex nested objects
    COLOR = "color"


@dataclass
class Option:
    name: str
    type: OptionType
    default: Any
    description: str
    choices: Optional[List[str]] = None
    min: Optional[float] = None
    max: Optional[float] = None
    step: Optional[float] = None

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "type": self.type.value,
            "default": self.default,
            "description": self.description,
            "choices": self.choices,
            "min": self.min,
            "max": self.max,
            "step": self.step,
        }


@dataclass
class ModuleSchema:
    type: str  # e.g. "clock", "network", "custom"
    title: str
    icon: str
    options: List[Option] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "type": self.type,
            "title": self.title,
            "icon": self.icon,
            "options": [o.to_dict() for o in self.options]
        }


# Common options that apply to most modules
COMMON_OPTIONS = [
    Option("format", OptionType.STRING, "{}", "Display format"),
    Option("interval", OptionType.INT, 0, "Update interval in seconds"),
    Option("tooltip", OptionType.BOOL, True, "Enable tooltip"),
    Option("tooltip-format", OptionType.STRING, "", "Tooltip format"),
    Option("on-click", OptionType.STRING, "", "Command on left click"),
    Option("on-click-middle", OptionType.STRING, "", "Command on middle click"),
    Option("on-click-right", OptionType.STRING, "", "Command on right click"),
    Option("on-scroll-up", OptionType.STRING, "", "Command on scroll up"),
    Option("on-scroll-down", OptionType.STRING, "", "Command on scroll down"),
    Option("rotate", OptionType.INT, 0, "Rotation angle (0, 90, 180, 270)", choices=["0", "90", "180", "270"]),
    Option("max-length", OptionType.INT, 0, "Maximum length"),
    Option("min-length", OptionType.INT, 0, "Minimum length"),
    Option("align", OptionType.FLOAT, 0.5, "Text alignment (0.0 - 1.0)"),
]

WAYBAR_SCHEMA = [
    # HYPRLAND WORKSPACES
    ModuleSchema(
        type="hyprland/workspaces",
        title="Workspaces",
        icon="",
        options=[
            Option("format", OptionType.STRING, "{icon}", "Format"),
            Option("format-icons", OptionType.JSON, {}, "Icons mapping"),
            Option("all-outputs", OptionType.BOOL, False, "Show on all outputs"),
            Option("active-only", OptionType.BOOL, False, "Show active only"),
            Option("sort-by-number", OptionType.BOOL, True, "Sort by number"),
            Option("sort-by-name", OptionType.BOOL, False, "Sort by name"),
            Option("on-scroll-up", OptionType.STRING, "hyprctl dispatch workspace e+1", "Scroll up action"),
            Option("on-scroll-down", OptionType.STRING, "hyprctl dispatch workspace e-1", "Scroll down action"),
            Option("on-click", OptionType.STRING, "activate", "Click action"),
        ]
    ),
    # HYPRLAND WINDOW
    ModuleSchema(
        type="hyprland/window",
        title="Window",
        icon="",
        options=[
            Option("format", OptionType.STRING, "{}", "Format"),
            Option("icon", OptionType.BOOL, False, "Show icon"),
            Option("icon-size", OptionType.INT, 20, "Icon size"),
            Option("rewrite", OptionType.JSON, {}, "Rewrite rules"),
            Option("separate-outputs", OptionType.BOOL, False, "Separate outputs"),
        ]
    ),
    # CLOCK
    ModuleSchema(
        type="clock",
        title="Clock",
        icon="",
        options=[
            Option("format", OptionType.STRING, "{:%H:%M}", "Time format"),
            Option("format-alt", OptionType.STRING, "{:%Y-%m-%d}", "Alt format (click)"),
            Option("tooltip-format", OptionType.STRING, "", "Tooltip format"),
            Option("timezone", OptionType.STRING, "", "Timezone"),
            Option("locale", OptionType.STRING, "", "Locale"),
            Option("interval", OptionType.INT, 60, "Update interval"),
        ]
    ),
    # BATTERY
    ModuleSchema(
        type="battery",
        title="Battery",
        icon="",
        options=[
            Option("interval", OptionType.INT, 60, "Update interval"),
            Option("states", OptionType.JSON, {"warning": 30, "critical": 15}, "Battery states"),
            Option("format", OptionType.STRING, "{capacity}% {icon}", "Format"),
            Option("format-charging", OptionType.STRING, "{capacity}% ", "Charging format"),
            Option("format-plugged", OptionType.STRING, "{capacity}% ", "Plugged format"),
            Option("format-alt", OptionType.STRING, "{time} {icon}", "Alt format"),
            Option("format-icons", OptionType.JSON, ["", "", "", "", ""], "Icons"),
            Option("full-at", OptionType.INT, 100, "Full at %"),
        ]
    ),
    # NETWORK
    ModuleSchema(
        type="network",
        title="Network",
        icon="",
        options=[
            Option("interface", OptionType.STRING, "", "Interface (e.g. wlan0)"),
            Option("format", OptionType.STRING, "{ifname}", "Format"),
            Option("format-wifi", OptionType.STRING, "{essid} ({signalStrength}%) ", "WiFi Format"),
            Option("format-ethernet", OptionType.STRING, "{ipaddr}/{cidr} ", "Ethernet Format"),
            Option("format-disconnected", OptionType.STRING, "Disconnected ⚠", "Disconnected Format"),
            Option("format-linked", OptionType.STRING, "{ifname} (No IP) ", "Linked Format"),
            Option("interval", OptionType.INT, 10, "Update interval"),
            Option("family", OptionType.ENUM, "ipv4", "IP Family", choices=["ipv4", "ipv6"]),
            Option("tooltip-format", OptionType.STRING, "", "Tooltip format"),
        ]
    ),
    # PULSEAUDIO
    ModuleSchema(
        type="pulseaudio",
        title="PulseAudio",
        icon="",
        options=[
            Option("format", OptionType.STRING, "{volume}% {icon}", "Format"),
            Option("format-bluetooth", OptionType.STRING, "{volume}% {icon}", "Bluetooth Format"),
            Option("format-muted", OptionType.STRING, "", "Muted Format"),
            Option("format-icons", OptionType.JSON, {"default": ["", "", ""]}, "Icons"),
            Option("scroll-step", OptionType.FLOAT, 5.0, "Scroll step"),
            Option("on-click", OptionType.STRING, "pavucontrol", "Click action"),
            Option("ignored-sinks", OptionType.JSON, ["Easy Effects Sink"], "Ignored sinks"),
        ]
    ),
    # CPU
    ModuleSchema(
        type="cpu",
        title="CPU",
        icon="",
        options=[
            Option("interval", OptionType.INT, 10, "Interval"),
            Option("format", OptionType.STRING, "{usage}% ", "Format"),
            Option("tooltip", OptionType.BOOL, True, "Tooltip"),
        ]
    ),
    # MEMORY
    ModuleSchema(
        type="memory",
        title="Memory",
        icon="",
        options=[
            Option("interval", OptionType.INT, 30, "Interval"),
            Option("format", OptionType.STRING, "{}% ", "Format"),
            Option("max-length", OptionType.INT, 10, "Max Length"),
        ]
    ),
    # BACKLIGHT
    ModuleSchema(
        type="backlight",
        title="Backlight",
        icon="",
        options=[
            Option("device", OptionType.STRING, "intel_backlight", "Device"),
            Option("format", OptionType.STRING, "{percent}% {icon}", "Format"),
            Option("format-icons", OptionType.JSON, ["", ""], "Icons"),
            Option("on-scroll-up", OptionType.STRING, "", "Scroll up"),
            Option("on-scroll-down", OptionType.STRING, "", "Scroll down"),
        ]
    ),
    # TRAY
    ModuleSchema(
        type="tray",
        title="Tray",
        icon="📥",
        options=[
            Option("icon-size", OptionType.INT, 21, "Icon size"),
            Option("spacing", OptionType.INT, 10, "Spacing"),
            Option("show-passive-items", OptionType.BOOL, False, "Show passive items"),
        ]
    ),
    # IDLE INHIBITOR
    ModuleSchema(
        type="idle_inhibitor",
        title="Idle Inhibitor",
        icon="",
        options=[
            Option("format", OptionType.STRING, "{icon}", "Format"),
            Option("format-icons", OptionType.JSON, {"activated": "", "deactivated": ""}, "Icons"),
            Option("start-activated", OptionType.BOOL, False, "Start activated"),
        ]
    ),
    # TEMPERATURE
    ModuleSchema(
        type="temperature",
        title="Temperature",
        icon="",
        options=[
            Option("thermal-zone", OptionType.INT, 0, "Thermal zone"),
            Option("hwmon-path", OptionType.STRING, "", "Hwmon path"),
            Option("critical-threshold", OptionType.INT, 80, "Critical threshold"),
            Option("format-critical", OptionType.STRING, "{temperatureC}°C ", "Critical format"),
            Option("format", OptionType.STRING, "{temperatureC}°C ", "Format"),
            Option("interval", OptionType.INT, 10, "Interval"),
        ]
    ),
    # CUSTOM
    ModuleSchema(
        type="custom",
        title="Custom Script",
        icon="",
        options=[
            Option("exec", OptionType.STRING, "", "Command to execute"),
            Option("exec-if", OptionType.STRING, "", "Execute only if..."),
            Option("return-type", OptionType.ENUM, "", "Return type", choices=["", "json"]),
            Option("interval", OptionType.INT, 0, "Interval (seconds)"),
            Option("format", OptionType.STRING, "{}", "Format"),
            Option("format-icons", OptionType.JSON, {}, "Icons"),
            Option("on-click", OptionType.STRING, "", "Click command"),
            Option("signal", OptionType.INT, 0, "Signal number"),
            Option("restart-interval", OptionType.INT, 0, "Restart interval"),
        ]
    ),
    # GROUP (For Group module)
    ModuleSchema(
        type="group",
        title="Group",
        icon="",
        options=[
            Option("orientation", OptionType.ENUM, "horizontal", "Orientation",
                   choices=["horizontal", "vertical", "inherit"]),
            Option("modules", OptionType.JSON, [], "Modules in group"),
            Option("drawer", OptionType.JSON, {}, "Drawer configuration"),
        ]
    ),
]


def get_schema_dict() -> Dict[str, Dict]:
    """Returns schema keyed by module type."""
    return {s.type: s.to_dict() for s in WAYBAR_SCHEMA}


def get_module_schema(module_name: str) -> Optional[ModuleSchema]:
    """
    Determines schema for a given module name.
    e.g. "clock" -> clock schema
    "custom/weather" -> custom schema
    "hyprland/workspaces" -> hyprland/workspaces schema
    """
    # Exact match first
    for s in WAYBAR_SCHEMA:
        if s.type == module_name:
            return s

    # Prefix match (e.g. custom/...)
    if module_name.startswith("custom/"):
        for s in WAYBAR_SCHEMA:
            if s.type == "custom":
                return s

    if module_name.startswith("hyprland/"):
        # Might be a specific hyprland module that we haven't defined explicitly?
        # But we defined workspaces and window.
        pass

    return None
