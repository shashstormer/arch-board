#!/bin/bash

# ArchBoard Installation Script

set -e

# Detect Python and Pip
PYTHON_CMD=""
PIP_CMD=""
PYTHON_INSTALLED_BY_SCRIPT=false

check_python() {
    if command -v python3 &>/dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &>/dev/null; then
        PYTHON_CMD="python"
    fi

    if command -v pip3 &>/dev/null; then
        PIP_CMD="pip3"
    elif command -v pip &>/dev/null; then
        PIP_CMD="pip"
    fi
}

check_python

if [ -z "$PYTHON_CMD" ] || [ -z "$PIP_CMD" ]; then
    echo "Python or Pip not found. Attempting to install..."

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        echo "Cannot detect OS. Please install Python manually."
        exit 1
    fi

    echo "Detected OS: $OS"

    # Check for sudo
    SUDO=""
    if command -v sudo &>/dev/null; then
        SUDO="sudo"
    elif [ "$EUID" -ne 0 ]; then
        echo "Root privileges required for installation and sudo not found."
        exit 1
    fi

    case $OS in
        arch)
            $SUDO pacman -Sy --noconfirm python python-pip git
            ;;
        debian|ubuntu|linuxmint|pop)
            $SUDO apt update
            $SUDO apt install -y python3 python3-pip python3-venv git
            ;;
        fedora)
            $SUDO dnf install -y python3 python3-pip git
            ;;
        *)
            echo "Unsupported OS for automatic installation ($OS). Please install Python and Pip manually."
            exit 1
            ;;
    esac

    PYTHON_INSTALLED_BY_SCRIPT=true
    check_python

    if [ -z "$PYTHON_CMD" ]; then
        echo "Failed to install Python."
        exit 1
    fi
fi

# Repo Logic
REPO_URL="https://github.com/shashstormer/arch-board"
INSTALL_DIR="$HOME/.archboard"
TARGET_DIR=""

if [ -f "xtracto.config.py" ]; then
    echo "Running inside repository."
    TARGET_DIR=$(pwd)
else
    echo "Installing to $INSTALL_DIR..."

    if command -v git &>/dev/null; then
        if [ -d "$INSTALL_DIR" ]; then
            echo "Directory exists. Updating..."
            cd "$INSTALL_DIR"
            git pull
        else
            git clone "$REPO_URL" "$INSTALL_DIR"
            cd "$INSTALL_DIR"
        fi
        TARGET_DIR="$INSTALL_DIR"
    else
         echo "Git not found and required for cloning. Please install git."
         exit 1
    fi
fi

# Requirements & Start Script
echo "Installing requirements..."

cd "$TARGET_DIR"

echo "Creating virtual environment..."
# Resolve absolute path of python command to ensure stability
ABS_PYTHON_CMD=$(which $PYTHON_CMD)
if command -v readlink &>/dev/null; then
    ABS_PYTHON_CMD=$(readlink -f "$ABS_PYTHON_CMD")
fi

$ABS_PYTHON_CMD -m venv venv

echo "Installing dependencies into venv..."
./venv/bin/pip install -r requirements.txt

# Resolve absolute path for the venv python
VENV_PYTHON="$TARGET_DIR/venv/bin/python"

echo "Generating start.sh..."
cat > start.sh <<EOF
#!/bin/bash
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "\$DIR"

# Check for updates
if [ -f "update.sh" ]; then
    ./update.sh "\$@"
fi

# Store PID
echo \$\$ > archboard.pid

source venv/bin/activate
exec "$VENV_PYTHON" main.py
EOF

chmod +x start.sh

echo "Installation complete!"
echo "Location: $TARGET_DIR"
echo "You can now run the application using: ./start.sh"
