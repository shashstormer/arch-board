"""
Hyprland configuration schema with metadata for UI generation.
Defines all config options with types, defaults, descriptions, and constraints.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional, Dict
from enum import Enum


class OptionType(Enum):
    BOOL = "bool"
    INT = "int"
    FLOAT = "float"
    COLOR = "color"
    GRADIENT = "gradient"
    STRING = "string"
    VEC2 = "vec2"
    ENUM = "enum"


@dataclass
class Option:
    """Schema for a single config option."""
    name: str
    type: OptionType
    default: Any
    description: str
    min: Optional[float] = None
    max: Optional[float] = None
    step: Optional[float] = None
    choices: Optional[List[str]] = None
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "type": self.type.value,
            "default": self.default,
            "description": self.description,
            "min": self.min,
            "max": self.max,
            "step": self.step,
            "choices": self.choices,
        }


@dataclass
class Section:
    """A group of related options."""
    name: str  # Must match the Hyprland category path (e.g., "general", "decoration:blur")
    title: str
    options: List[Option] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "title": self.title,
            "options": [o.to_dict() for o in self.options],
        }


@dataclass
class Tab:
    """A tab containing multiple sections."""
    id: str
    title: str
    icon: str
    sections: List[Section] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "title": self.title,
            "icon": self.icon,
            "sections": [s.to_dict() for s in self.sections],
        }


# =============================================================================
# SCHEMA DEFINITION
# =============================================================================

HYPRLAND_SCHEMA = [
    # =========================================================================
    # GENERAL TAB
    # =========================================================================
    Tab(
        id="general",
        title="General",
        icon="⚙️",
        sections=[
            Section(
                name="general",
                title="General Settings",
                options=[
                    # Gaps & Borders
                    Option("border_size", OptionType.INT, 1, "Border size in pixels", min=0, max=10, step=1),
                    Option("gaps_in", OptionType.INT, 5, "Gaps between windows", min=0, max=50, step=1),
                    Option("gaps_out", OptionType.INT, 20, "Gaps between windows and edges", min=0, max=100, step=1),
                    Option("gaps_workspaces", OptionType.INT, 0, "Gaps between workspaces", min=0, max=50, step=1),
                    # Colors
                    Option("col.active_border", OptionType.GRADIENT, "0xffffffff", "Active window border color"),
                    Option("col.inactive_border", OptionType.GRADIENT, "0xff444444", "Inactive window border color"),
                    # Layout
                    Option("layout", OptionType.ENUM, "dwindle", "Window layout", choices=["dwindle", "master"]),
                    Option("resize_on_border", OptionType.BOOL, False, "Resize by clicking borders"),
                    Option("extend_border_grab_area", OptionType.INT, 15, "Border grab area", min=0, max=50, step=1),
                    Option("hover_icon_on_border", OptionType.BOOL, True, "Show cursor on border hover"),
                    Option("no_focus_fallback", OptionType.BOOL, False, "No focus fallback"),
                    Option("allow_tearing", OptionType.BOOL, False, "Allow tearing"),
                ]
            ),
            Section(
                name="general:snap",
                title="Window Snapping",
                options=[
                    Option("enabled", OptionType.BOOL, False, "Enable floating window snapping"),
                    Option("window_gap", OptionType.INT, 10, "Gap before snapping", min=0, max=50, step=1),
                    Option("monitor_gap", OptionType.INT, 10, "Monitor edge snap gap", min=0, max=50, step=1),
                    Option("border_overlap", OptionType.BOOL, False, "Snap with border overlap"),
                ]
            ),
            Section(
                name="dwindle",
                title="Dwindle Layout",
                options=[
                    Option("pseudotile", OptionType.BOOL, False, "Enable pseudotiling"),
                    Option("force_split", OptionType.INT, 0, "Force split (0=mouse, 1=left, 2=right)", min=0, max=2, step=1),
                    Option("preserve_split", OptionType.BOOL, False, "Preserve split direction"),
                    Option("smart_split", OptionType.BOOL, False, "Cursor-based split direction"),
                    Option("smart_resizing", OptionType.BOOL, True, "Mouse-based resize direction"),
                    Option("permanent_direction_override", OptionType.BOOL, False, "Persist preselect direction"),
                    Option("special_scale_factor", OptionType.FLOAT, 1.0, "Special workspace scale", min=0.0, max=1.0, step=0.05),
                    Option("split_width_multiplier", OptionType.FLOAT, 1.0, "Auto-split width multiplier", min=0.5, max=2.0, step=0.1),
                    Option("use_active_for_splits", OptionType.BOOL, True, "Prefer active window for splits"),
                    Option("default_split_ratio", OptionType.FLOAT, 1.0, "Default split ratio", min=0.1, max=1.9, step=0.1),
                    Option("split_bias", OptionType.INT, 0, "Split ratio receiver (0=directional, 1=current)", min=0, max=1, step=1),
                    Option("precise_mouse_move", OptionType.BOOL, False, "Mouse-precise window drop"),
                ]
            ),
            Section(
                name="master",
                title="Master Layout",
                options=[
                    Option("allow_small_split", OptionType.BOOL, False, "Horizontal split for masters"),
                    Option("special_scale_factor", OptionType.FLOAT, 1.0, "Special workspace scale", min=0.0, max=1.0, step=0.05),
                    Option("mfact", OptionType.FLOAT, 0.55, "Master area ratio", min=0.0, max=1.0, step=0.05),
                    Option("new_status", OptionType.ENUM, "slave", "New window position", choices=["master", "slave", "inherit"]),
                    Option("new_on_top", OptionType.BOOL, False, "New windows on top"),
                    Option("new_on_active", OptionType.ENUM, "none", "New window relative position", choices=["before", "after", "none"]),
                    Option("orientation", OptionType.ENUM, "left", "Master orientation", choices=["left", "right", "top", "bottom", "center"]),
                    Option("inherit_fullscreen", OptionType.BOOL, True, "Inherit fullscreen on swap"),
                    Option("slave_count_for_center_master", OptionType.INT, 2, "Min slaves for center mode", min=0, max=10, step=1),
                    Option("center_master_fallback", OptionType.ENUM, "left", "Fallback when few slaves", choices=["left", "right", "top", "bottom"]),
                    Option("smart_resizing", OptionType.BOOL, True, "Mouse-based resize direction"),
                    Option("drop_at_cursor", OptionType.BOOL, True, "Drop windows at cursor"),
                    Option("always_keep_position", OptionType.BOOL, False, "Keep master position when alone"),
                ]
            ),
        ]
    ),
    
    # =========================================================================
    # DECORATION TAB
    # =========================================================================
    Tab(
        id="decoration",
        title="Decoration",
        icon="🎨",
        sections=[
            Section(
                name="decoration",
                title="Decoration",
                options=[
                    Option("rounding", OptionType.INT, 0, "Corner radius", min=0, max=30, step=1),
                    Option("rounding_power", OptionType.FLOAT, 2.0, "Rounding curve", min=1.0, max=10.0, step=0.1),
                    Option("active_opacity", OptionType.FLOAT, 1.0, "Active window opacity", min=0.0, max=1.0, step=0.05),
                    Option("inactive_opacity", OptionType.FLOAT, 1.0, "Inactive window opacity", min=0.0, max=1.0, step=0.05),
                    Option("fullscreen_opacity", OptionType.FLOAT, 1.0, "Fullscreen opacity", min=0.0, max=1.0, step=0.05),
                    Option("dim_inactive", OptionType.BOOL, False, "Dim inactive windows"),
                    Option("dim_strength", OptionType.FLOAT, 0.5, "Dim strength", min=0.0, max=1.0, step=0.05),
                    Option("dim_special", OptionType.FLOAT, 0.2, "Special workspace dim", min=0.0, max=1.0, step=0.05),
                    Option("dim_around", OptionType.FLOAT, 0.4, "Dim around strength", min=0.0, max=1.0, step=0.05),
                ]
            ),
            Section(
                name="decoration:blur",
                title="Blur",
                options=[
                    Option("enabled", OptionType.BOOL, True, "Enable blur"),
                    Option("size", OptionType.INT, 8, "Blur size", min=1, max=20, step=1),
                    Option("passes", OptionType.INT, 1, "Blur passes", min=1, max=10, step=1),
                    Option("ignore_opacity", OptionType.BOOL, True, "Ignore window opacity"),
                    Option("new_optimizations", OptionType.BOOL, True, "New optimizations"),
                    Option("xray", OptionType.BOOL, False, "X-ray mode"),
                    Option("noise", OptionType.FLOAT, 0.0117, "Noise amount", min=0.0, max=1.0, step=0.01),
                    Option("contrast", OptionType.FLOAT, 0.8916, "Contrast", min=0.0, max=2.0, step=0.05),
                    Option("brightness", OptionType.FLOAT, 0.8172, "Brightness", min=0.0, max=2.0, step=0.05),
                    Option("vibrancy", OptionType.FLOAT, 0.1696, "Vibrancy", min=0.0, max=1.0, step=0.05),
                    Option("special", OptionType.BOOL, False, "Blur special workspace"),
                    Option("popups", OptionType.BOOL, False, "Blur popups"),
                ]
            ),
            Section(
                name="decoration:shadow",
                title="Shadow",
                options=[
                    Option("enabled", OptionType.BOOL, True, "Enable shadows"),
                    Option("range", OptionType.INT, 4, "Shadow range", min=1, max=50, step=1),
                    Option("render_power", OptionType.INT, 3, "Falloff power", min=1, max=4, step=1),
                    Option("sharp", OptionType.BOOL, False, "Sharp shadows"),
                    Option("ignore_window", OptionType.BOOL, True, "Ignore window"),
                    Option("color", OptionType.COLOR, "0xee1a1a1a", "Shadow color"),
                    Option("offset", OptionType.VEC2, "0 0", "Shadow offset"),
                    Option("scale", OptionType.FLOAT, 1.0, "Shadow scale", min=0.0, max=1.0, step=0.1),
                ]
            ),
        ]
    ),
    
    # =========================================================================
    # INPUT TAB
    # =========================================================================
    Tab(
        id="input",
        title="Input",
        icon="⌨️",
        sections=[
            Section(
                name="input",
                title="Keyboard & Mouse",
                options=[
                    # Keyboard
                    Option("kb_layout", OptionType.STRING, "us", "Keyboard layout"),
                    Option("kb_variant", OptionType.STRING, "", "Keyboard variant"),
                    Option("kb_options", OptionType.STRING, "", "XKB options"),
                    Option("numlock_by_default", OptionType.BOOL, False, "Numlock on startup"),
                    Option("repeat_rate", OptionType.INT, 25, "Key repeat rate", min=1, max=100, step=1),
                    Option("repeat_delay", OptionType.INT, 600, "Key repeat delay (ms)", min=100, max=2000, step=50),
                    # Mouse
                    Option("sensitivity", OptionType.FLOAT, 0.0, "Mouse sensitivity", min=-1.0, max=1.0, step=0.1),
                    Option("accel_profile", OptionType.ENUM, "", "Acceleration", choices=["", "adaptive", "flat"]),
                    Option("force_no_accel", OptionType.BOOL, False, "Force no acceleration"),
                    Option("left_handed", OptionType.BOOL, False, "Left handed mode"),
                    Option("natural_scroll", OptionType.BOOL, False, "Natural scrolling"),
                    Option("scroll_factor", OptionType.FLOAT, 1.0, "Scroll multiplier", min=0.1, max=5.0, step=0.1),
                    # Focus
                    Option("follow_mouse", OptionType.INT, 1, "Focus follows mouse (0-3)", min=0, max=3, step=1),
                    Option("mouse_refocus", OptionType.BOOL, True, "Refocus on mouse move"),
                    Option("float_switch_override_focus", OptionType.INT, 1, "Focus on float switch (0-2)", min=0, max=2, step=1),
                ]
            ),
            Section(
                name="input:touchpad",
                title="Touchpad",
                options=[
                    Option("disable_while_typing", OptionType.BOOL, True, "Disable while typing"),
                    Option("natural_scroll", OptionType.BOOL, False, "Natural scrolling"),
                    Option("scroll_factor", OptionType.FLOAT, 1.0, "Scroll multiplier", min=0.1, max=5.0, step=0.1),
                    Option("tap-to-click", OptionType.BOOL, True, "Tap to click"),
                    Option("tap-and-drag", OptionType.BOOL, True, "Tap and drag"),
                    Option("clickfinger_behavior", OptionType.BOOL, False, "Clickfinger behavior"),
                    Option("middle_button_emulation", OptionType.BOOL, False, "Middle button emulation"),
                ]
            ),
            Section(
                name="input:gestures",
                title="Gestures",
                options=[
                    Option("workspace_swipe_distance", OptionType.INT, 300, "Swipe distance (px)", min=100, max=1000, step=50),
                    Option("workspace_swipe_touch", OptionType.BOOL, False, "Enable touchscreen edge swipe"),
                    Option("workspace_swipe_invert", OptionType.BOOL, True, "Invert direction (touchpad)"),
                    Option("workspace_swipe_touch_invert", OptionType.BOOL, False, "Invert direction (touchscreen)"),
                    Option("workspace_swipe_min_speed_to_force", OptionType.INT, 30, "Min speed to force switch", min=0, max=100, step=5),
                    Option("workspace_swipe_cancel_ratio", OptionType.FLOAT, 0.5, "Cancel ratio threshold", min=0.0, max=1.0, step=0.1),
                    Option("workspace_swipe_create_new", OptionType.BOOL, True, "Create new workspace on end swipe"),
                    Option("workspace_swipe_direction_lock", OptionType.BOOL, True, "Lock swipe direction"),
                    Option("workspace_swipe_direction_lock_threshold", OptionType.INT, 10, "Direction lock threshold (px)", min=0, max=100, step=5),
                    Option("workspace_swipe_forever", OptionType.BOOL, False, "Continue past neighbors"),
                    Option("workspace_swipe_use_r", OptionType.BOOL, False, "Use r prefix for workspaces"),
                    Option("close_max_timeout", OptionType.INT, 1000, "Close gesture timeout (ms)", min=100, max=5000, step=100),
                ]
            ),
        ]
    ),
    
    # =========================================================================
    # ANIMATIONS TAB
    # =========================================================================
    Tab(
        id="animations",
        title="Animations",
        icon="✨",
        sections=[
            Section(
                name="animations",
                title="Animation Settings",
                options=[
                    Option("enabled", OptionType.BOOL, True, "Enable animations"),
                    # Option("first_launch_animation", OptionType.BOOL, True, "Initial launch animation"),  # This option is no longer there in hyprland
                ]
            ),
        ]
    ),
    
    # =========================================================================
    # MISC TAB - Section name MUST be "misc" for vrr to work!
    # =========================================================================
    Tab(
        id="misc",
        title="Misc",
        icon="🔧",
        sections=[
            Section(
                name="misc",
                title="Miscellaneous",
                options=[
                    # Appearance
                    Option("disable_hyprland_logo", OptionType.BOOL, False, "Disable Hyprland logo"),
                    Option("disable_splash_rendering", OptionType.BOOL, False, "Disable splash text"),
                    Option("force_default_wallpaper", OptionType.INT, -1, "Force wallpaper (-1=random)", min=-1, max=2, step=1),
                    Option("font_family", OptionType.STRING, "Sans", "Default font"),
                    Option("background_color", OptionType.COLOR, "0x111111", "Background color"),
                    # Behavior - VRR is here!
                    Option("vfr", OptionType.BOOL, True, "Variable frame rate"),
                    Option("vrr", OptionType.INT, 0, "Adaptive sync (0=off, 1=on, 2=fullscreen, 3=enabled+fullscreen hint)", min=0, max=3, step=1),
                    Option("mouse_move_enables_dpms", OptionType.BOOL, False, "Wake on mouse move"),
                    Option("key_press_enables_dpms", OptionType.BOOL, False, "Wake on key press"),
                    Option("disable_autoreload", OptionType.BOOL, False, "Disable config auto-reload"),
                    Option("focus_on_activate", OptionType.BOOL, False, "Focus on activate request"),
                    Option("layers_hog_keyboard_focus", OptionType.BOOL, True, "Layers keep keyboard focus"),
                    Option("animate_manual_resizes", OptionType.BOOL, False, "Animate manual resizes"),
                    Option("animate_mouse_windowdragging", OptionType.BOOL, False, "Animate mouse dragging"),
                    # Swallowing
                    Option("enable_swallow", OptionType.BOOL, False, "Enable window swallowing"),
                    Option("swallow_regex", OptionType.STRING, "", "Swallow regex"),
                    Option("swallow_exception_regex", OptionType.STRING, "", "Swallow exception regex"),
                ]
            ),
        ]
    ),
    
    # =========================================================================
    # CURSOR TAB
    # =========================================================================
    Tab(
        id="cursor",
        title="Cursor",
        icon="🖱️",
        sections=[
            Section(
                name="cursor",
                title="Cursor Settings",
                options=[
                    Option("no_hardware_cursors", OptionType.INT, 2, "Hardware cursors (0=on, 1=off, 2=auto)", min=0, max=2, step=1),
                    Option("inactive_timeout", OptionType.INT, 0, "Hide after seconds (0=never)", min=0, max=60, step=1),
                    Option("no_warps", OptionType.BOOL, False, "Disable cursor warping"),
                    Option("persistent_warps", OptionType.BOOL, False, "Persistent warps"),
                    Option("enable_hyprcursor", OptionType.BOOL, True, "Enable hyprcursor"),
                    Option("hide_on_key_press", OptionType.BOOL, False, "Hide on key press"),
                    Option("hide_on_touch", OptionType.BOOL, True, "Hide on touch"),
                    Option("zoom_factor", OptionType.FLOAT, 1.0, "Cursor zoom factor", min=1.0, max=10.0, step=0.5),
                    Option("no_break_fs_vrr", OptionType.BOOL, False, "Don't break fullscreen VRR"),
                ]
            ),
        ]
    ),
    
    # =========================================================================
    # ADVANCED TAB
    # =========================================================================
    Tab(
        id="advanced",
        title="Advanced",
        icon="⚡",
        sections=[
            Section(
                name="xwayland",
                title="XWayland",
                options=[
                    Option("enabled", OptionType.BOOL, True, "Enable XWayland"),
                    Option("use_nearest_neighbor", OptionType.BOOL, True, "Pixelated scaling"),
                    Option("force_zero_scaling", OptionType.BOOL, False, "Force 1x scale for HiDPI"),
                    Option("create_abstract_socket", OptionType.BOOL, True, "Create abstract unix socket"),
                ]
            ),
            Section(
                name="opengl",
                title="OpenGL",
                options=[
                    Option("nvidia_anti_flicker", OptionType.BOOL, True, "NVIDIA anti-flicker"),
                ]
            ),
            Section(
                name="render",
                title="Rendering",
                options=[
                    Option("direct_scanout", OptionType.INT, 0, "Direct scanout (0=off, 1=on, 2=auto)", min=0, max=2, step=1),
                    Option("expand_undersized_textures", OptionType.BOOL, True, "Expand undersized textures"),
                ]
            ),
            Section(
                name="binds",
                title="Keybind Settings",
                options=[
                    Option("pass_mouse_when_bound", OptionType.BOOL, False, "Pass mouse when bound"),
                    Option("workspace_back_and_forth", OptionType.BOOL, False, "Workspace toggle"),
                    Option("allow_workspace_cycles", OptionType.BOOL, False, "Allow workspace cycles"),
                    Option("movefocus_cycles_fullscreen", OptionType.BOOL, False, "Focus cycles fullscreen"),
                    Option("scroll_event_delay", OptionType.INT, 300, "Scroll event delay (ms)", min=0, max=1000, step=50),
                    Option("drag_threshold", OptionType.INT, 10, "Drag threshold (px)", min=0, max=50, step=1),
                    Option("focus_preferred_method", OptionType.INT, 0, "Focus method (0=history, 1=length)", min=0, max=1, step=1),
                ]
            ),
            Section(
                name="ecosystem",
                title="Ecosystem",
                options=[
                    Option("enforce_permissions", OptionType.BOOL, False, "Enforce app permissions"),
                    Option("no_update_news", OptionType.BOOL, False, "Disable update news"),
                ]
            ),
            Section(
                name="debug",
                title="Debug",
                options=[
                    Option("disable_logs", OptionType.BOOL, True, "Disable debug logs"),
                    Option("disable_time", OptionType.BOOL, True, "Disable log timestamps"),
                    Option("damage_tracking", OptionType.INT, 2, "Damage tracking (0=none, 1=monitor, 2=full)", min=0, max=2, step=1),
                    Option("enable_stdout_logs", OptionType.BOOL, False, "Enable stdout logs"),
                ]
            ),
        ]
    ),
]


def get_schema() -> List[Dict]:
    """Return schema as list of dicts for JSON serialization."""
    return [tab.to_dict() for tab in HYPRLAND_SCHEMA]


def get_flat_options() -> Dict[str, Option]:
    """Return flat dict of all options keyed by full path (section:option)."""
    result = {}
    for tab in HYPRLAND_SCHEMA:
        for section in tab.sections:
            for option in section.options:
                key = f"{section.name}:{option.name}"
                result[key] = option
    return result
