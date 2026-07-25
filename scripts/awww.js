class AwwwEditor {
    constructor() {
        this.config = { displays: {} };
        this.monitors = [];
        this.current = {};
        this.selectedDisplay = null;
        this.saveTimeout = null;
        this.init();
    }

    async init() {
        await Promise.all([
            this.loadConfig(),
            this.loadMonitors(),
            this.loadCurrent()
        ]);
        this.render();
        this.selectDisplay('default');

        setTimeout(() => {
            if (window.PresetManagerUI) {
                window._presetManagers = window._presetManagers || {};
                window._presetManagers['awww'] = new PresetManagerUI('awww', {
                    containerId: 'preset-container',
                    onActivate: async () => {
                        await this.loadConfig();
                        this.render();
                    },
                    onSave: async () => await this.save()
                });
            }
        }, 50);

        const reloadLoop = async () => {
            await this.loadCurrent();
            this.renderCurrentPreview();
            setTimeout(reloadLoop, 3000);
        };
        setTimeout(reloadLoop, 3000);
    }

    async loadConfig() {
        try {
            const res = await fetch('/awww/config');
            if (res.ok) {
                const data = await res.json();
                this.config = data || { displays: {} };
                if (!this.config.displays) this.config.displays = {};
            }
        } catch (e) {
            console.error("Failed to load awww config", e);
        }
    }

    async loadMonitors() {
        try {
            const res = await fetch('/awww/monitors');
            if (res.ok) {
                const data = await res.json();
                this.monitors = data.monitors || [];
            }
        } catch (e) {
            console.error("Failed to load monitors", e);
        }
    }

    async loadCurrent() {
        try {
            const res = await fetch('/awww/current');
            if (res.ok) {
                const data = await res.json();
                this.current = data.current || {};
            }
        } catch (e) {
            console.error("Failed to load current wallpapers", e);
        }
    }

    render() {
        this.renderDisplaysList();
        this.renderCurrentPreview();
        if (this.selectedDisplay) {
            this.renderDisplaySettings(this.selectedDisplay);
        }
    }

    renderDisplaysList() {
        const container = document.getElementById('displays-list');
        if (!container) return;

        const configuredDisplays = Object.keys(this.config.displays || {});
        const specialDisplays = ['default', 'any'];
        const monitorNames = this.monitors.map(m => m.name);

        let html = '';

        specialDisplays.forEach(name => {
            const isActive = this.selectedDisplay === name;
            const hasConfig = configuredDisplays.includes(name);
            html += `
                <button onclick="awwwEditor.selectDisplay('${name}')"
                    class="w-full text-left px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-teal-500/20 text-teal-400 font-medium' : 'hover:bg-zinc-800 text-zinc-400'}">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium">${name}</span>
                        ${hasConfig ? '<span class="text-[10px] text-teal-500">●</span>' : ''}
                    </div>
                    <div class="text-xs text-zinc-600">${name === 'default' ? 'Global default settings' : 'Fallback display'}</div>
                </button>
            `;
        });

        html += '<div class="border-t border-zinc-800 my-2"></div>';

        configuredDisplays.filter(d => !specialDisplays.includes(d)).forEach(name => {
            const isActive = this.selectedDisplay === name;
            const monitor = this.monitors.find(m => m.name === name);
            html += `
                <button onclick="awwwEditor.selectDisplay('${name}')"
                    class="w-full text-left px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-teal-500/20 text-teal-400 font-medium' : 'hover:bg-zinc-800 text-zinc-300'}">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium">${name}</span>
                        <span class="text-[10px] text-teal-500">●</span>
                    </div>
                    ${monitor ? `<div class="text-xs text-zinc-600">${monitor.width}x${monitor.height}</div>` : ''}
                </button>
            `;
        });

        monitorNames.filter(m => !configuredDisplays.includes(m)).forEach(name => {
            const monitor = this.monitors.find(m => m.name === name);
            html += `
                <button onclick="awwwEditor.addDisplayConfig('${name}')"
                    class="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-zinc-800 text-zinc-500 border border-dashed border-zinc-700/60 my-1">
                    <div class="text-sm">+ Add ${name}</div>
                    ${monitor ? `<div class="text-xs text-zinc-600">${monitor.width}x${monitor.height}</div>` : ''}
                </button>
            `;
        });

        container.innerHTML = html;
    }

    selectDisplay(name) {
        this.selectedDisplay = name;
        this.renderDisplaysList();
        this.renderDisplaySettings(name);
    }

    addDisplay() {
        const name = prompt("Enter monitor/display name (e.g. eDP-1, HDMI-A-1):");
        if (name && name.trim()) {
            this.addDisplayConfig(name.trim());
        }
    }

    addDisplayConfig(name) {
        if (!this.config.displays[name]) {
            this.config.displays[name] = {
                path: "",
                resize: "crop",
                crop_gravity: "center",
                fill_color: "000000ff",
                filter: "Lanczos3",
                transition_type: "simple",
                transition_step: 90,
                transition_duration: 3.0,
                transition_fps: 30,
                transition_angle: 45,
                transition_pos: "center",
                transition_bezier: ".54,0,.34,.99"
            };
        }
        this.selectDisplay(name);
        this.triggerAutosave();
    }

    deleteCurrentDisplay(displayToDelete = null) {
        const target = displayToDelete || this.selectedDisplay;
        if (!target || ['default', 'any'].includes(target)) return;
        if (confirm(`Remove configuration for "${target}"?`)) {
            delete this.config.displays[target];
            this.selectDisplay('default');
            this.triggerAutosave();
        }
    }

    renderDisplaySettings(name) {
        const container = document.getElementById('display-settings');
        const titleEl = document.getElementById('display-title');
        const actionsEl = document.getElementById('display-actions');
        if (!container) return;

        if (titleEl) titleEl.textContent = `Display: ${name}`;
        if (actionsEl) {
            if (['default', 'any'].includes(name)) {
                actionsEl.classList.add('hidden');
            } else {
                actionsEl.classList.remove('hidden');
            }
        }

        if (!this.config.displays[name]) {
            this.config.displays[name] = {
                path: "",
                resize: "crop",
                crop_gravity: "center",
                fill_color: "000000ff",
                filter: "Lanczos3",
                transition_type: "simple",
                transition_step: 90,
                transition_duration: 3.0,
                transition_fps: 30,
                transition_angle: 45,
                transition_pos: "center",
                transition_bezier: ".54,0,.34,.99"
            };
        }

        const settings = this.config.displays[name];
        container.innerHTML = '';

        const children = [];

        // Wallpaper Path Input with File Module Browser
        children.push(UIManager.createActionInput(
            "Wallpaper Path",
            "Image file or directory containing wallpapers",
            settings.path || '',
            "/path/to/wallpaper.png or /path/to/folder",
            "📁",
            () => this.browsePath(name),
            (val) => {
                this.updateField(name, 'path', val);
                setTimeout(() => this.renderDisplaySettings(name), 10);
            }
        ));

        // Preview Element
        if (settings.path) {
            const prevDiv = document.createElement('div');
            prevDiv.className = "px-5 py-2 hover:bg-zinc-800/30 transition-colors";
            prevDiv.innerHTML = `
                <div class="relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 h-44 flex items-center justify-center">
                    <img src="/awww/preview?path=${encodeURIComponent(settings.path)}" class="max-h-full max-w-full object-contain" alt="Preview" onerror="this.style.display='none'">
                </div>
            `;
            children.push(prevDiv);
        }

        // Resize Mode
        children.push(UIManager.createSelect(
            "Resize Mode",
            "How image is scaled to screen dimensions",
            settings.resize || "crop",
            [
                { label: 'Crop (Fill Screen)', value: 'crop' },
                { label: 'Fit (Keep Aspect Ratio)', value: 'fit' },
                { label: 'Stretch', value: 'stretch' },
                { label: 'No Resize (Original Size)', value: 'no' }
            ],
            (val) => this.updateField(name, 'resize', val)
        ));

        // Crop Gravity
        children.push(UIManager.createSelect(
            "Crop Gravity",
            "Anchor position when crop mode is active",
            settings.crop_gravity || "center",
            [
                { label: 'Center', value: 'center' },
                { label: 'Top', value: 'top' },
                { label: 'Bottom', value: 'bottom' },
                { label: 'Left', value: 'left' },
                { label: 'Right', value: 'right' },
                { label: 'Top-Left', value: 'top-left' },
                { label: 'Top-Right', value: 'top-right' },
                { label: 'Bottom-Left', value: 'bottom-left' },
                { label: 'Bottom-Right', value: 'bottom-right' }
            ],
            (val) => this.updateField(name, 'crop_gravity', val)
        ));

        // Filter Algorithm
        children.push(UIManager.createSelect(
            "Filter Algorithm",
            "Scaling filter quality algorithm",
            settings.filter || "Lanczos3",
            [
                { label: 'Lanczos3 (High Quality)', value: 'Lanczos3' },
                { label: 'Mitchell', value: 'Mitchell' },
                { label: 'CatmullRom', value: 'CatmullRom' },
                { label: 'Bilinear', value: 'Bilinear' },
                { label: 'Nearest (Fastest / Pixel Art)', value: 'Nearest' }
            ],
            (val) => this.updateField(name, 'filter', val)
        ));

        // Padding Fill Color
        children.push(UIManager.createInput(
            "Padding Fill Color (Hex)",
            "Hex color for padding when fit mode is used",
            settings.fill_color || "000000ff",
            "000000ff",
            (val) => this.updateField(name, 'fill_color', val)
        ));

        // Transition Type
        children.push(UIManager.createSelect(
            "Transition Type",
            "Wallpaper transition animation effect",
            settings.transition_type || "simple",
            ['simple', 'fade', 'wipe', 'wave', 'grow', 'center', 'any', 'outer', 'random', 'left', 'right', 'top', 'bottom', 'none'].map(t => ({ label: t, value: t })),
            (val) => this.updateField(name, 'transition_type', val)
        ));

        // Transition Duration
        children.push(UIManager.createInput(
            "Transition Duration (s)",
            "Duration of transition animation in seconds",
            settings.transition_duration ?? 3.0,
            "3.0",
            (val) => this.updateField(name, 'transition_duration', val ? parseFloat(val) : 3.0),
            null,
            "number"
        ));

        // Transition FPS
        children.push(UIManager.createInput(
            "Transition Frame Rate (FPS)",
            "Animation target frame rate",
            settings.transition_fps ?? 30,
            "30",
            (val) => this.updateField(name, 'transition_fps', val ? parseInt(val) : 30),
            null,
            "number"
        ));

        // Transition Step
        children.push(UIManager.createInput(
            "Transition Step Speed",
            "Step speed factor (1-255)",
            settings.transition_step ?? 90,
            "90",
            (val) => this.updateField(name, 'transition_step', val ? parseInt(val) : 90),
            null,
            "number"
        ));

        // Transition Angle
        children.push(UIManager.createInput(
            "Wipe/Wave Angle (deg)",
            "Transition angle in degrees (0-360)",
            settings.transition_angle ?? 45,
            "45",
            (val) => this.updateField(name, 'transition_angle', val ? parseInt(val) : 45),
            null,
            "number"
        ));

        // Transition Position
        children.push(UIManager.createInput(
            "Transition Position",
            "Center point for grow/outer (e.g. center or 0.5,0.5)",
            settings.transition_pos || "center",
            "center",
            (val) => this.updateField(name, 'transition_pos', val)
        ));

        // Delete Button Container
        if (name !== 'default' && name !== 'any') {
            const btnContainer = document.createElement('div');
            btnContainer.className = "p-5 border-t border-zinc-800 flex justify-end";
            const delBtn = document.createElement('button');
            delBtn.className = "px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors border border-red-500/20 font-medium";
            delBtn.textContent = "Delete Display Config";
            delBtn.onclick = () => this.deleteCurrentDisplay(name);
            btnContainer.appendChild(delBtn);
            children.push(btnContainer);
        }

        const section = UIManager.createSection(null, null, children);
        container.appendChild(section);
    }

    browsePath(displayName) {
        ImagePicker.open({
            multiselect: false,
            allowFolderSelect: true,
            onSelect: (items) => {
                if (items && items.length > 0) {
                    const item = items[0];
                    const finalPath = item.path || item.name;
                    this.updateField(displayName, 'path', finalPath);
                    this.renderDisplaySettings(displayName);
                    this.triggerAutosave();
                }
            }
        });
    }

    updateField(displayName, key, value) {
        if (!this.config.displays[displayName]) {
            this.config.displays[displayName] = {};
        }
        if (value === null || value === '' || value === undefined) {
            delete this.config.displays[displayName][key];
        } else {
            this.config.displays[displayName][key] = value;
        }
        this.triggerAutosave();
    }

    triggerAutosave() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            await this.save(true);
        }, 500);
    }

    renderCurrentPreview() {
        const container = document.getElementById('current-preview');
        if (!container) return;

        if (Object.keys(this.current).length === 0) {
            container.innerHTML = '<div class="text-zinc-500 text-center py-10">No active wallpapers reported by awww query</div>';
            return;
        }

        let html = '';
        for (const [display, target] of Object.entries(this.current)) {
            const isImage = target.includes('/');
            const filename = isImage ? target.split('/').pop() : target;

            html += `
                <div class="bg-zinc-950/80 border border-zinc-800 rounded-xl overflow-hidden p-3 space-y-2">
                    <div class="flex items-center justify-between text-xs font-semibold text-teal-400">
                        <span>🖥️ ${display} (1st Screen)</span>
                    </div>
                    <div class="aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center relative">
                        ${isImage ? `
                            <img src="/awww/preview?path=${encodeURIComponent(target)}"
                                class="max-w-full max-h-full object-contain"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='block'" alt="Wallpaper">
                            <div class="hidden text-zinc-500 text-xs p-2 text-center break-all">${filename}</div>
                        ` : `
                            <div class="text-zinc-400 text-xs p-2 text-center font-mono break-all">${target}</div>
                        `}
                    </div>
                    <div class="text-[11px] text-zinc-400 truncate" title="${target}">
                        ${filename}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    refreshMatugenPalette() {
        const container = document.getElementById('matugen-swatch-container');
        if (!container) return;

        const mode = document.getElementById('matugen-mode-select')?.value || 'dark';
        const type = document.getElementById('matugen-type-select')?.value || 'scheme-tonal-spot';
        const currentPath = this.selectedDisplay && this.config.displays[this.selectedDisplay]?.path ? this.config.displays[this.selectedDisplay].path : '';

        let url = `/awww/matugen/image?mode=${encodeURIComponent(mode)}&type=${encodeURIComponent(type)}&t=${Date.now()}`;
        if (currentPath) {
            url += `&path=${encodeURIComponent(currentPath)}`;
        }

        container.innerHTML = `<img src="${url}" class="w-full h-full object-cover" alt="Matugen Palette Swatch" onerror="this.outerHTML='<div class=\\'text-xs text-red-400 p-2 text-center\\'>Failed to generate palette image</div>'">`;
    }

    async applyMatugenTheme() {
        const mode = document.getElementById('matugen-mode-select')?.value || 'dark';
        const type = document.getElementById('matugen-type-select')?.value || 'scheme-tonal-spot';
        const currentPath = this.selectedDisplay && this.config.displays[this.selectedDisplay]?.path ? this.config.displays[this.selectedDisplay].path : null;

        try {
            const res = await fetch('/awww/matugen/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: currentPath, mode, type })
            });
            if (res.ok) {
                const data = await res.json();
                if (window.showToast) showToast(`Applied Matugen theme for ${data.display || '1st screen'}!`, 'success');
                this.refreshMatugenPalette();
            } else {
                const err = await res.json();
                if (window.showToast) showToast(`Matugen failed: ${err.detail || 'Error'}`, 'error');
            }
        } catch (e) {
            console.error("Apply matugen error", e);
            if (window.showToast) showToast('Failed to apply Matugen theme', 'error');
        }
    }

    async save(silent = false) {
        try {
            const res = await fetch('/awww/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });
            if (res.ok) {
                if (!silent && window.showToast) showToast('Awww config saved & applied!', 'success');
                if (window._presetManagers?.['awww']) {
                    window._presetManagers['awww'].updateActivePreset(true);
                }
                await this.loadCurrent();
                this.renderCurrentPreview();
                this.refreshMatugenPalette();
            } else {
                if (!silent && window.showToast) showToast('Failed to save awww config', 'error');
            }
        } catch (e) {
            console.error("Save error", e);
            if (!silent && window.showToast) showToast('Error saving config', 'error');
        }
    }

    async control(action) {
        try {
            const res = await fetch('/awww/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, display: this.selectedDisplay })
            });
            if (res.ok) {
                if (window.showToast) showToast(`Action ${action} executed`, 'success');
                await this.loadCurrent();
                this.renderCurrentPreview();
                this.refreshMatugenPalette();
            }
        } catch (e) {
            console.error("Control error", e);
        }
    }

    async restart() {
        try {
            const res = await fetch('/awww/restart', { method: 'POST' });
            if (res.ok) {
                if (window.showToast) showToast('awww-daemon restarted', 'success');
                setTimeout(() => {
                    this.loadCurrent();
                    this.refreshMatugenPalette();
                }, 1000);
            } else {
                if (window.showToast) showToast('Failed to restart daemon', 'error');
            }
        } catch (e) {
            console.error("Restart error", e);
        }
    }
}
