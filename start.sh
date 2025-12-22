#!/bin/bash

# ArchBoard Startup Script
# This script is a template. The installer will overwrite/configure it.
# Fallback behavior for manual execution:

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Starting ArchBoard from $DIR..."

if [ -f "$DIR/update.sh" ]; then
    "$DIR/update.sh" "$@"
fi

# Check for venv
if [ -d "$DIR/venv" ]; then
    source "$DIR/venv/bin/activate"
fi

exec python3 "$DIR/main.py"
