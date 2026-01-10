#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "Restarting ArchBoard..."
./stop.sh
sleep 2
./start.sh
