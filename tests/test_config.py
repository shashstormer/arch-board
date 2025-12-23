import sys
import os
sys.path.append(os.getcwd())
from utils.jsonc_parser import parse, to_string

config_text = """{
    "layer": "top", // Waybar at top layer
    "position": "top", // Waybar position (top|bottom|left|right)
    "height": 40,
    "margin": "0 5 0 5",
    "spacing":0,

    // Choose the order of the modules
    // Add according to your wishes: "custom/weather"

    "modules-left": ["custom/launcher", "hyprland/workspaces", "hyprland/window"],
    "modules-center": ["custom/network_traffic"],
    "modules-right": ["custom/updates", "backlight", "custom/keyboard-layout", "temperature", "cpu", "memory", "battery", "pulseaudio", "network", "tray", "idle_inhibitor", "clock","custom/power"],

 // Modules configuration

  "hyprland/workspaces": {
    "format": "{icon}",
    "on-click": "activate",
    "all-outputs": true,
    "sort-by-number": true,
    "format-icons": {
      "1": "1",
      "2": "2",
      "3": "3",
      "4": "4",
      "5": "5",
      "6": "6",
      "7": "7",
      "8": "8",
      "9": "9",
      "10": "10",
      "focused": "",
      "default": ""
    },
    "on-scroll-up": "hyprctl dispatch workspace e+1",
    "on-scroll-down": "hyprctl dispatch workspace e-1",
    },
    "hyprland/window": {
        "format": "{}",
	"icon":true,
	"icon-size" : 20,
	"swap-icon-label": true
    },
    "idle_inhibitor": {
        "format": "{icon}",
       "format-icons": {
            "activated": "",
            "deactivated": "",
        },
        "on-click":"exec ~/.config/hypr/scripts/idle_inhibitor.sh",

    },
    "tray": {
        "icon-size": 20,
        "spacing": 5
    },
    "clock": {
        "tooltip-format": "<big>{:%A, %d.%B %Y }</big>\n<tt><small>{calendar}</small></tt>",
        "format": " {:%a %d %b  %I:%M %p}",	//12 hour format
        //"format": " {:%a %d %b  %H:%M}",	//24 hour format
        "format-alt": " {:%d/%m/%Y  %H:%M:%S}",
        //"max-length": 200
        "interval": 1,
        "on-click": "~/.config/waybar/scripts/OCV",
    },
    "cpu": {
        "format": "🖳{usage}%",
        "on-click": "foot -e htop"
    },
    "memory": {
        "format": "🖴 {: >3}%",
        "on-click": "foot -e htop"
    },
    "temperature": {
        "thermal-zone": 7,  // Check with: # cat /sys/class/hwmon/hwmon*/temp1_input
        "hwmon-path": "/sys/class/hwmon/hwmon7/temp1_input",
        "critical-threshold": 80,
        "format-critical": "{temperatureC}°C ",
        "format": "{temperatureC}°C "
    },
    "backlight": {
        // "device": "acpi_video1",
        "format": "{icon} {percent: >3}%",
        "format-icons": ["", ""],
        "on-scroll-down": "brightnessctl -c backlight set 1%-",
        "on-scroll-up": "brightnessctl -c backlight set +1%",
        "on-click": "~/.config/waybar/scripts/backlight-hint.sh"
    },
    "battery": {
        "states": {
            // "good": 95,
            "warning": 30,
            "critical": 15
        },
        "format": "{icon} {capacity: >3}%",
        "format-icons": ["", "", "", "", ""]
        // "format-good": "", // An empty format will hide the module
        // "format-full": "",
        //"format-icons": ["", "", "", "", "", "", "", "", "", ""]
        //"format": "&#x202b;{icon}&#x202c; {capacity}%",
        //"format-icons": ["ﱉ","ﱊ","ﱌ","ﱍ","ﱋ"]
    },
      "network": {
        //"interface": "wlp0s20f3", // (Optional) To force the use of this interface  "format-wifi": "  {essid}",
        "format": "⚠Disabled",
        "format-wifi": "",
        "format-ethernet": "",
        "format-linked": "{ifname} (No IP)",
        "format-disconnected": "⚠Disabled",
        "format-alt": "{ifname}: {ipaddr}/{cidr}",
        "family": "ipv4",
        "tooltip-format-wifi": "  {ifname} @ {essid}\nIP: {ipaddr}\nStrength: {signalStrength}%\nFreq: {frequency}MHz\nUp: {bandwidthUpBits} Down: {bandwidthDownBits}",
        "tooltip-format-ethernet": " {ifname}\nIP: {ipaddr}\n up: {bandwidthUpBits} down: {bandwidthDownBits}",
        //"min-length": 2,
        //"max-length": 2,
        "on-click": "nm-connection-editor"
    },
   "custom/updates": {
       "format": "{} {icon}",
       "return-type": "json",
       "format-icons": {
           "has-updates": "󱍷",
           "updated": "󰂪",
       },
       "exec-if": "which waybar-module-pacman-updates",
       "exec": "waybar-module-pacman-updates --interval-seconds 5 --network-interval-seconds 7200 --network-interval-seconds",
       "on-click": "foot -e update"
   },
    "custom/power": {
      	"format":"⏻",
       	"on-click": "nwgbar",
      	"tooltip": false,
   },
   "custom/keyboard-layout": {
      	"format": " Cheat", // Icon: keyboard
        "on-click": "~/.config/waybar/scripts/keyhint.sh",
     },
    "custom/launcher": {
    "format":"    ",
    	"on-click": "exec nwg-drawer -c 7 -is 70 -spacing 23",
    	"tooltip": false,
     },
     "custom/network_traffic": {
             "exec": "~/.config/waybar/scripts/network_traffic.sh",
             "return-type": "json",
             "format-ethernet": "{icon} {ifname} ⇣{bandwidthDownBytes} ⇡{bandwidthUpBytes}",    // optional
},
    "pulseaudio": {
        "scroll-step": 3, // %, can be a float
        "format": "{icon} {volume}% {format_source}",
        "format-bluetooth": "{volume}% {icon} {format_source}",
        "format-bluetooth-muted": " {icon} {format_source}",
        "format-muted": " {format_source}",
        //"format-source": "{volume}% ",
        //"format-source-muted": "",
        "format-source": "",
        "format-source-muted": "",
        "format-icons": {
            "headphone": "",
            "hands-free": "",
            "headset": "",
            "phone": "",
            "portable": "",
            "car": "",
            "default": ["", "", ""]
        },
        "on-click": "footclient -T waybar_alsamixer -e alsamixer -M",
        "on-click-right": "pavucontrol"
        },
        // https://github.com/chubin/wttr.in
        "custom/weather": {
        "exec": "curl 'https://wttr.in/Essen?format=2'",
        "interval": 900,
	    "on-click": "yad --html --uri='https://wttr.in/Essen' --center --fixed --width=1000 --height=680 --timeout=60 --timeout-indicator=right"
        },
    }
"""

try:
    print("Parsing config text...")
    root = parse(config_text)
    print("Success: Config parsed.")
    
    print("Generating string back...")
    new_text = to_string(root)
    
    # Verify strict equality might be hard if whitespace/normalization differs slightly
    # But let's check basic round trip length similarity
    print(f"Original length: {len(config_text)}")
    print(f"New length: {len(new_text)}")
    
    if len(new_text) < len(config_text) * 0.9:
        print("WARNING: Significant data loss detected!")
    
    # Try parsing the output again to ensure it's valid structure
    parse(new_text)
    print("Success: Round trip valid.")
    
except Exception as e:
    import traceback
    traceback.print_exc()
    print("FAIL: Parser crashed.")
