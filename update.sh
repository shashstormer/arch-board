#!/bin/bash

# ArchBoard Update Script

# Configuration file
CONFIG_FILE=".update_policy"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Parse arguments
for arg in "$@"; do
    if [ "$arg" == "--no-update" ]; then
        exit 0
    fi
done

# Load Config
POLICY="ASK"
LAST_CHECK=0

if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Function to save config
save_config() {
    echo "POLICY=\"$POLICY\"" > "$CONFIG_FILE"
    echo "LAST_CHECK=\"$LAST_CHECK\"" >> "$CONFIG_FILE"
}

# Function to perform update
do_update() {
    echo "Updating ArchBoard..."
    if git pull; then
        echo "Installing requirements..."

        # Check if venv exists and is active, otherwise detect how to run pip
        if [ -n "$VIRTUAL_ENV" ]; then
            pip install -r requirements.txt
        elif [ -d "venv" ]; then
             ./venv/bin/pip install -r requirements.txt
        else
            # Try to use pip3 or pip, respecting the install.sh logic implies
            # we might need to assume system pip if no venv.
            if command -v pip3 &>/dev/null; then
                pip3 install -r requirements.txt
            else
                pip install -r requirements.txt
            fi
        fi
        echo "Update complete."
    else
        echo "Update failed. Please check git status."
    fi
}

# Check Policy: DISABLE
if [ "$POLICY" == "DISABLE" ]; then
    exit 0
fi

# Check Policy: REMIND_LATER
if [ "$POLICY" == "REMIND_LATER" ]; then
    NOW=$(date +%s)
    # 1 week = 604800 seconds
    NEXT_CHECK=$((LAST_CHECK + 604800))

    if [ "$NOW" -lt "$NEXT_CHECK" ]; then
        exit 0
    fi
    # If time passed, reset to ASK behavior but keep policy until changed?
    # User said "remind later" means "dont ask for 1 week".
    # So after 1 week, we should probably ask again.
    POLICY="ASK"
fi

# Check Internet
if ! ping -c 1 github.com &>/dev/null; then
    # echo "No internet connection. Skipping update check."
    exit 0
fi

# Check for updates
echo "Checking for updates..."
if ! git fetch origin >/dev/null 2>&1; then
    # echo "Failed to fetch updates."
    exit 0
fi

LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse @{u} 2>/dev/null)

if [ -z "$LOCAL" ] || [ -z "$REMOTE" ]; then
    # echo "Could not determine versions."
    exit 0
fi

if [ "$LOCAL" == "$REMOTE" ]; then
    # echo "Already up to date."
    exit 0
fi

# New version available

# Check Policy: AUTO
if [ "$POLICY" == "AUTO" ]; then
    do_update
    exit 0
fi

# Interactive Prompt
echo ""
echo "A new version of ArchBoard is available!"
echo "What would you like to do?"
echo "  [u] Update now"
echo "  [s] Skip this time"
echo "  [d] Disable update checks"
echo "  [r] Remind me in 1 week"
echo "  [a] Enable auto-updates"
echo ""
read -p "Select an option [u/s/d/r/a]: " choice

case "$choice" in
    u|U)
        do_update
        ;;
    s|S)
        echo "Skipping update."
        ;;
    d|D)
        POLICY="DISABLE"
        save_config
        echo "Update checks disabled."
        ;;
    r|R)
        POLICY="REMIND_LATER"
        LAST_CHECK=$(date +%s)
        save_config
        echo "Will remind you in 1 week."
        ;;
    a|A)
        POLICY="AUTO"
        save_config
        do_update
        ;;
    *)
        echo "Invalid option. Skipping update."
        ;;
esac
