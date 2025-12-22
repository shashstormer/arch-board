import os
import pytest
import shutil
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from main import app

# Main config - contains items we will modify in tests
HYPRLAND_CONF = """
# Source other files
source = ./includes/monitors.conf

general {
    gaps_in = 5
    gaps_out = 20
    border_size = 2
    col.active_border = rgba(33ccffee) rgba(00ff99ee) 45deg
    col.inactive_border = rgba(595959aa)
    layout = dwindle
}

decoration {
    rounding = 10
    blur {
        enabled = true
        size = 3
        passes = 1
    }
}

exec-once = waybar
exec = swaybg

env = XCURSOR_SIZE,24
env = QT_QPA_PLATFORMTHEME,qt5ct

gesture {
    workspace_swipe = true
    workspace_swipe_fingers = 3
}

bind = SUPER, Q, exec, kitty
bind = SUPER, C, killactive,
bind = SUPER, M, exit,
bind = SUPER, E, exec, dolphin
bind = SUPER, V, togglefloating,
bind = SUPER, R, exec, wofi --show drun
bind = SUPER, P, pseudo, # dwindle
bind = SUPER, J, togglesplit, # dwindle

windowrule = float, ^(kitty)$
windowrulev2 = opacity 0.8 0.8,class:^(kitty)$

# Add a bind gesture for testing
gesture = 3, up, workspace, +1
"""

# Monitors config - items we will read but not modify in basic tests
# (If we test modification of monitors, it will happen in main file because router writes to main file)
MONITORS_CONF = """
monitor=HDMI-A-1,1920x1080@60,0x0,1
monitor=DP-1,2560x1440@144,1920x0,1
"""

@pytest.fixture
def test_env():
    """Setup a test environment with dummy config and fake hyprctl."""
    # Create a temporary directory for home
    test_home = tempfile.mkdtemp()

    # Setup config paths
    config_dir = Path(test_home) / ".config" / "hypr"
    includes_dir = config_dir / "includes"
    includes_dir.mkdir(parents=True, exist_ok=True)

    config_path = config_dir / "hyprland.conf"
    monitors_path = includes_dir / "monitors.conf"

    # Write config files
    with open(config_path, "w") as f:
        f.write(HYPRLAND_CONF)

    with open(monitors_path, "w") as f:
        f.write(MONITORS_CONF)

    # Setup fake hyprctl
    bin_dir = Path(test_home) / "bin"
    bin_dir.mkdir(exist_ok=True)
    hyprctl_path = bin_dir / "hyprctl"

    with open(hyprctl_path, "w") as f:
        f.write("#!/bin/bash\n")
        f.write("if [ \"$1\" = \"clients\" ]; then\n")
        f.write("  echo '[{\"address\":\"0x1234\",\"workspace\":{\"id\":1,\"name\":\"1\"},\"class\":\"kitty\",\"title\":\"kitty\"}]'\n")
        f.write("elif [ \"$1\" = \"reload\" ]; then\n")
        f.write("  echo 'ok'\n")
        f.write("else\n")
        f.write("  echo 'unknown command'\n")
        f.write("fi\n")

    hyprctl_path.chmod(0o755)

    # Modify environment variables
    old_home = os.environ.get("HOME")
    old_path = os.environ.get("PATH")

    os.environ["HOME"] = test_home
    os.environ["PATH"] = f"{bin_dir}:{os.environ['PATH']}"

    # Patch router config path
    from routers import hyprland
    old_config_path = hyprland.CONFIG_PATH
    hyprland.CONFIG_PATH = str(config_path)

    yield

    # Cleanup
    hyprland.CONFIG_PATH = old_config_path
    if old_home:
        os.environ["HOME"] = old_home
    if old_path:
        os.environ["PATH"] = old_path

    shutil.rmtree(test_home)

@pytest.fixture
def client(test_env):
    """Return a TestClient instance."""
    return TestClient(app)
