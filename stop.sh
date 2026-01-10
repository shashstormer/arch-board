#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PID_FILE="archboard.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null; then
        echo "Stopping ArchBoard (PID $PID)..."
        kill $PID
        # Wait for process to exit
        for i in {1..5}; do
            if ! ps -p $PID > /dev/null; then
                break
            fi
            sleep 1
        done
        
        if ps -p $PID > /dev/null; then
            echo "Process didn't stop, force killing..."
            kill -9 $PID
        fi
    else
        echo "PID file found but process likely not running."
    fi
    rm "$PID_FILE"
else
    echo "No PID file found ($PID_FILE). Cannot stop safely."
fi
