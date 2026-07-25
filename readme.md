# ArchBoard

A modern web-based configuration manager for Arch Linux systems, focused on Hyprland and related tools.

> I will not be adding support for hyprland lua config as I was not able to figure out a way for simpler scripting and better config tools using UI only so have left it for now.

## Features

- **Dashboard**: System overview with CPU, memory, and disk usage statistics
- **Hyprland Config**: Visual editor for Hyprland window manager settings
- **Waybar, Hyprlock, Hypridle, Wpaperd**: Placeholder pages for future configuration modules
- **System Settings**: System configuration management (coming soon)
- **Live Reload**: Automatic page and server refresh during development



https://github.com/user-attachments/assets/3668c0e2-6877-4993-8702-92a0ed695692

## Requirements

- Python 3.10+
- Hyprland (for Hyprland configuration features)
- A running Arch Linux system (recommended)

### Python Dependencies

```
xtracto==0.0.10
pytailwind==0.0.6
requestez==0.1.13
authtuna>=0.2.2
```

## Installation

The easiest way to install ArchBoard is using our automated installer script.

**Using curl (Recommended)**:
```bash
bash <(curl -s https://raw.githubusercontent.com/shashstormer/arch-board/master/install.sh)
```

**Using git**:
```bash
git clone https://github.com/shashstormer/arch-board
cd arch-board
./install.sh
```

**Automatic Updates**:

ArchBoard automatically checks for updates on startup. You can configure this behavior when prompted:
- **Update now**: Updates the application immediately.
- **Skip**: Skips update for this session.
- **Disable**: Disables update checks (can be re-enabled by editing `.update_policy`).
- **Remind me in 1 week**: Suppresses prompts for 7 days.
- **Enable auto-updates**: Automatically updates without asking.

To run the application without checking for updates (useful for startup scripts):
```bash
./start.sh --no-update
```

**Manual Installation**:

1. Clone the repository:
   ```bash
   git clone https://github.com/shashstormer/arch-board
   cd arch-board
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Edit `.env` file (optional, for customization)

4. Run the application:
   ```bash
   python main.py
   ```

5. Open your browser and navigate to `http://localhost:5000`

## Configuration

## Enabling And Disabling Plugins

I plan on implementing a plugin installer in the future, which will copy pages, scripts etc.

Comments are supported using # at the start of the line.

To disable a default plugin you need to add a line

exclude:plugin_name

Default included plugins are
- dashboard (do not disable this, / will return 404 if disabled)
- hyprland
- waybar
- hyprlock
- hypridle
- wpaperd
- awww
- system (the system stats on dashboard page need this router)
- presets (presets on all pages need this)
- static (needed for serving the js files etc)
- navigation (needed for sidebar links)
- images (The Image picker which is used on hyprlock, wpaperd need this)
- fonts (for the font picker on hyprlock need this)
- gammastep (i use gammastep so i enabled by default, feel free to disable it)

to disable gammastep you need to create a `plugins.txt` file and add the exclude line
```text
# Exclude gammastep
exclude:gammastep
# Include some other plugin, plugin_name=APIRouter name 
# plugin name can be plugin_name.py or plugin_name/__init__.py coz its the same to python
# If you have a router for niri you can do this.
niri=niri_router 
# Niri planned for soon
```

### Production Mode

The application runs in **development mode** by default, which enables:
- Auto-reload on file changes
- Development toolbar with reload button
- Tailwind CSS regeneration on each request

To run in **production mode** (recommended when not actively developing):

1. Edit `xtracto.config.py`:
   ```python
   production = True
   ```

2. This will:
   - Hide the development toolbar/reload popup
   - Disable hot-reload
   - Use cached Tailwind CSS
   - Improve performance

> **Note**: Always set `production = True` when you're not actively working on the project to hide the auto-reload popup and improve performance.

### Environment Variables

| Variable       | Description                              | Default                     |
|----------------|------------------------------------------|-----------------------------|
| `USER`         | Username displayed in the sidebar        | System user                 |
| `VERSION`      | Cache key for static assets (production) | `0.0.0`                     |
| `API_BASE_URL` | Base URL for API calls                   | `http://localhost:5000/api` |

## Project Structure

```
arch_board/
├── assets/css/          # Global CSS and Tailwind output
├── components/          # Reusable HTML components
│   ├── dashboard/       # Dashboard-specific components
│   ├── hyprland/        # Hyprland config components
│   └── layout/          # Layout components (sidebar, header, footer)
├── pages/               # Page templates (.pypx files)
├── routers/             # FastAPI route handlers
├── scripts/             # JavaScript files
├── utils/               # Utility modules
├── main.py              # Application entry point
├── xtracto.config.py    # Xtracto framework configuration
└── requirements.txt     # Python dependencies
```

## Development

### Adding New Pages

1. Create a `.pypx` template in `pages/`
2. Create router in `plugins/name.py` or `plugins/name/__init__.py`
3. Add route
4. Register navigation component using utils, check out other plugins for reference

### Tailwind CSS

If you want to implement your own plugins/update things.
If you are not making any changes to files then you can skip this.

got too lazy to for fixing pytailwind, just using official tailwind cli now
You just need to install and add to path (accessible by `tailwindcss` cmd) it auto uses it.

The generated CSS is saved to `assets/css/tailwind.css`.


#### AI-NOTICE

The Parser and most backend was fully written by me, and then AI was used to fix edge cases.

The UI i.e. frontend is 85% AI-Generated.

## License

MIT
