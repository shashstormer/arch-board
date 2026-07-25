class AwwwEditor {
    constructor() {
        this.config = { displays: {} };
        this.monitors = [];
        this.current = {};
        this.selectedDisplay = null;
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
        if (name) {
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
    }

    deleteCurrentDisplay() {
        if (!this.selectedDisplay || ['default', 'any'].includes(this.selectedDisplay)) return;
        if (confirm(`Remove configuration for ${this.selectedDisplay}?`)) {
            delete this.config.displays[this.selectedDisplay];
            this.selectDisplay('default');
        }
    }

    renderDisplaySettings(name) {
        const titleEl = document.getElementById('display-title');
        const actionsEl = document.getElementById('display-actions');
        const container = document.getElementById('display-settings');
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

        const conf = this.config.displays[name];

        container.innerHTML = `
            <div class="space-y-6">
                <!-- Image Path Selection -->
                <div class="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80 space-y-3">
                    <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Wallpaper Image / GIF</label>
                    <div class="flex items-center gap-2">
                        <input type="text" id="cfg-path" value="${conf.path || ''}"
                            onchange="awwwEditor.updateField('${name}', 'path', this.value)"
                            placeholder="/path/to/image.png or gif"
                            class="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                        <button onclick="awwwEditor.browseImage('${name}')"
                            class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium border border-zinc-700">
                            📁 Browse
                        </button>
                    </div>
                    ${conf.path ? `
                        <div class="mt-2 relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 h-40 flex items-center justify-center">
                            <img src="/awww/preview?path=${encodeURIComponent(conf.path)}" class="max-h-full max-w-full object-contain" alt="Preview" onerror="this.style.display='none'">
                        </div>
                    ` : ''}
                </div>

                <!-- Scaling & Alignment -->
                <div class="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80 space-y-4">
                    <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Scaling & Fit Settings</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Resize Mode</label>
                            <select onchange="awwwEditor.updateField('${name}', 'resize', this.value)"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                                <option value="crop" ${conf.resize === 'crop' ? 'selected' : ''}>Crop (Fill Screen)</option>
                                <option value="fit" ${conf.resize === 'fit' ? 'selected' : ''}>Fit (Keep Aspect Ratio)</option>
                                <option value="stretch" ${conf.resize === 'stretch' ? 'selected' : ''}>Stretch</option>
                                <option value="no" ${conf.resize === 'no' ? 'selected' : ''}>No Resize (Original Size)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Crop Gravity</label>
                            <select onchange="awwwEditor.updateField('${name}', 'crop_gravity', this.value)"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                                <option value="center" ${conf.crop_gravity === 'center' ? 'selected' : ''}>Center</option>
                                <option value="top" ${conf.crop_gravity === 'top' ? 'selected' : ''}>Top</option>
                                <option value="bottom" ${conf.crop_gravity === 'bottom' ? 'selected' : ''}>Bottom</option>
                                <option value="left" ${conf.crop_gravity === 'left' ? 'selected' : ''}>Left</option>
                                <option value="right" ${conf.crop_gravity === 'right' ? 'selected' : ''}>Right</option>
                                <option value="top-left" ${conf.crop_gravity === 'top-left' ? 'selected' : ''}>Top-Left</option>
                                <option value="top-right" ${conf.crop_gravity === 'top-right' ? 'selected' : ''}>Top-Right</option>
                                <option value="bottom-left" ${conf.crop_gravity === 'bottom-left' ? 'selected' : ''}>Bottom-Left</option>
                                <option value="bottom-right" ${conf.crop_gravity === 'bottom-right' ? 'selected' : ''}>Bottom-Right</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Filter Algorithm</label>
                            <select onchange="awwwEditor.updateField('${name}', 'filter', this.value)"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                                <option value="Lanczos3" ${conf.filter === 'Lanczos3' ? 'selected' : ''}>Lanczos3 (High Quality)</option>
                                <option value="Mitchell" ${conf.filter === 'Mitchell' ? 'selected' : ''}>Mitchell</option>
                                <option value="CatmullRom" ${conf.filter === 'CatmullRom' ? 'selected' : ''}>CatmullRom</option>
                                <option value="Bilinear" ${conf.filter === 'Bilinear' ? 'selected' : ''}>Bilinear</option>
                                <option value="Nearest" ${conf.filter === 'Nearest' ? 'selected' : ''}>Nearest (Fastest / Pixel Art)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Padding Fill Color (Hex)</label>
                            <input type="text" value="${conf.fill_color || '000000ff'}"
                                onchange="awwwEditor.updateField('${name}', 'fill_color', this.value)"
                                placeholder="000000ff"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                        </div>
                    </div>
                </div>

                <!-- Transition Options -->
                <div class="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80 space-y-4">
                    <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Transition Animation Settings</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Transition Type</label>
                            <select onchange="awwwEditor.updateField('${name}', 'transition_type', this.value)"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                                ${['simple', 'fade', 'wipe', 'wave', 'grow', 'center', 'any', 'outer', 'random', 'left', 'right', 'top', 'bottom', 'none'].map(t =>
            `<option value="${t}" ${conf.transition_type === t ? 'selected' : ''}>${t}</option>`
        ).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Duration (Seconds)</label>
                            <input type="number" step="0.1" min="0.1" value="${conf.transition_duration ?? 3.0}"
                                onchange="awwwEditor.updateField('${name}', 'transition_duration', parseFloat(this.value))"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                        </div>
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Frame Rate (FPS)</label>
                            <input type="number" min="1" max="240" value="${conf.transition_fps ?? 30}"
                                onchange="awwwEditor.updateField('${name}', 'transition_fps', parseInt(this.value))"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                        </div>
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Transition Step (Speed)</label>
                            <input type="number" min="1" max="255" value="${conf.transition_step ?? 90}"
                                onchange="awwwEditor.updateField('${name}', 'transition_step', parseInt(this.value))"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                        </div>
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Wipe/Wave Angle (Degrees)</label>
                            <input type="number" min="0" max="360" value="${conf.transition_angle ?? 45}"
                                onchange="awwwEditor.updateField('${name}', 'transition_angle', parseInt(this.value))"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                        </div>
                        <div>
                            <label class="block text-xs text-zinc-400 mb-1">Transition Position</label>
                            <input type="text" value="${conf.transition_pos || 'center'}"
                                onchange="awwwEditor.updateField('${name}', 'transition_pos', this.value)"
                                placeholder="center, top-left, or 0.5,0.5"
                                class="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-teal-500">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    updateField(displayName, key, value) {
        if (!this.config.displays[displayName]) {
            this.config.displays[displayName] = {};
        }
        this.config.displays[displayName][key] = value;
    }

    browseImage(displayName) {
        if (window.ImagePicker) {
            new ImagePicker({
                onSelect: (path) => {
                    this.updateField(displayName, 'path', path);
                    this.renderDisplaySettings(displayName);
                }
            });
        } else {
            const path = prompt("Enter full path to image file:");
            if (path) {
                this.updateField(displayName, 'path', path);
                this.renderDisplaySettings(displayName);
            }
        }
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

    async save() {
        try {
            const res = await fetch('/awww/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });
            if (res.ok) {
                if (window.showToast) showToast('Awww config saved & applied!', 'success');
                await this.loadCurrent();
                this.renderCurrentPreview();
                this.refreshMatugenPalette();
            } else {
                if (window.showToast) showToast('Failed to save awww config', 'error');
            }
        } catch (e) {
            console.error("Save error", e);
            if (window.showToast) showToast('Error saving config', 'error');
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
