class WpaperdEditor {
    constructor() {
        this.config = { displays: {} };
        this.monitors = [];
        this.current = {};
        this.status = {};
        this.selectedDisplay = null;
        this.saveTimeout = null;
        this.init();
    }

    async init() {
        await Promise.all([
            this.loadConfig(),
            this.loadMonitors(),
            this.loadCurrent(),
            this.loadStatus()
        ]);
        this.render();
        this.selectDisplay('default');
        setTimeout(() => {
            if (window.PresetManagerUI) {
                window._presetManagers = window._presetManagers || {};
                window._presetManagers['wpaperd'] = new PresetManagerUI('wpaperd', {
                    containerId: 'preset-container',
                    onActivate: async () => {
                        await this.loadConfig();
                        this.render();
                    },
                    onSave: async () => await this.save()
                });
            }
        }, 50);
    }

    async loadConfig() {
        try {
            const res = await fetch('/wpaperd/config');
            if (res.ok) {
                const data = await res.json();
                this.config = data;
            }
        } catch (e) {
            console.error("Failed to load wpaperd config", e);
        }
    }

    async loadMonitors() {
        try {
            const res = await fetch('/wpaperd/monitors');
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
            const res = await fetch('/wpaperd/current');
            if (res.ok) {
                const data = await res.json();
                this.current = data.current || {};
            }
        } catch (e) {
            console.error("Failed to load current wallpapers", e);
        }
    }

    async loadStatus() {
        try {
            const res = await fetch('/wpaperd/status');
            if (res.ok) {
                const data = await res.json();
                this.status = data.status || {};
            }
        } catch (e) {
            console.error("Failed to load status", e);
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

        const displays = Object.keys(this.config.displays || {});
        const specialDisplays = ['default', 'any'];


        const monitorNames = this.monitors.map(m => m.name);

        let html = '';


        specialDisplays.forEach(name => {
            const isActive = this.selectedDisplay === name;
            const hasConfig = displays.includes(name);
            html += `
                <button onclick="wpaperdEditor.selectDisplay('${name}')"
                    class="w-full text-left px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-teal-500/20 text-teal-400' : 'hover:bg-zinc-800 text-zinc-400'}">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium">${name}</span>
                        ${hasConfig ? '<span class="text-[10px] text-zinc-600">●</span>' : ''}
                    </div>
                    <div class="text-xs text-zinc-600">${name === 'default' ? 'Base settings' : 'Fallback display'}</div>
                </button>
            `;
        });


        if (displays.length > 0 || this.monitors.length > 0) {
            html += '<div class="border-t border-zinc-800 my-2"></div>';
        }


        displays.filter(d => !specialDisplays.includes(d)).forEach(name => {
            const isActive = this.selectedDisplay === name;
            const monitor = this.monitors.find(m => m.name === name);
            html += `
                <button onclick="wpaperdEditor.selectDisplay('${name}')"
                    class="w-full text-left px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-teal-500/20 text-teal-400' : 'hover:bg-zinc-800 text-zinc-300'}">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium">${name}</span>
                        <span class="text-[10px] text-zinc-600">●</span>
                    </div>
                    ${monitor ? `<div class="text-xs text-zinc-600">${monitor.width}x${monitor.height}</div>` : ''}
                </button>
            `;
        });


        monitorNames.filter(m => !displays.includes(m)).forEach(name => {
            const monitor = this.monitors.find(m => m.name === name);
            html += `
                <button onclick="wpaperdEditor.addDisplayConfig('${name}')"
                    class="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-zinc-800 text-zinc-500 border border-dashed border-zinc-700">
                    <div class="text-sm">${name}</div>
                    ${monitor ? `<div class="text-xs text-zinc-600">${monitor.width}x${monitor.height}</div>` : ''}
                </button>
            `;
        });

        if (!html) {
            html = '<div class="text-zinc-500 text-center py-10">No displays found</div>';
        }

        container.innerHTML = html;
    }

    renderCurrentPreview() {
        const container = document.getElementById('current-preview');
        if (!container) return;

        if (Object.keys(this.current).length === 0) {
            container.innerHTML = '<div class="text-zinc-500 text-center py-10">No active wallpapers</div>';
            return;
        }

        let html = '';
        for (const [display, path] of Object.entries(this.current)) {
            const filename = path.split('/').pop();
            const displayStatus = this.status[display] || 'unknown';
            const statusColor = displayStatus === 'running' ? 'bg-green-500' :
                displayStatus === 'paused' ? 'bg-yellow-500' : 'bg-zinc-500';
            const statusText = displayStatus === 'running' ? '▶' :
                displayStatus === 'paused' ? '⏸' : '?';

            html += `
                <div class="bg-zinc-800/50 rounded-lg overflow-hidden">
                    <div class="aspect-video bg-zinc-950 flex items-center justify-center relative">
                        <img src="/wpaperd/preview?path=${encodeURIComponent(path)}" 
                            class="max-w-full max-h-full object-contain"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
                            alt="${filename}">
                        <div class="hidden absolute inset-0 items-center justify-center text-zinc-600 text-xs text-center px-2">
                            <span class="break-all">${filename}</span>
                        </div>
                        <div class="absolute top-1 right-1 ${statusColor} text-white text-xs px-1.5 py-0.5 rounded font-bold" title="${displayStatus}">
                            ${statusText}
                        </div>
                    </div>
                    <div class="p-2">
                        <div class="text-xs text-zinc-400 truncate flex items-center gap-2">
                            <span>${display}</span>
                            <span class="text-[10px] ${statusColor} text-white px-1 rounded">${displayStatus}</span>
                        </div>
                        <div class="text-[10px] text-zinc-600 truncate" title="${path}">${filename}</div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    selectDisplay(name) {
        this.selectedDisplay = name;
        this.renderDisplaysList();
        this.renderDisplaySettings(name);
    }

    addDisplayConfig(name) {
        this.config.displays[name] = { path: '' };
        this.selectedDisplay = name;
        this.render();
        this.triggerAutosave();
    }

    addDisplay() {
        const name = prompt('Enter display name (e.g., DP-1, default, any):');
        if (name && name.trim()) {
            this.addDisplayConfig(name.trim());
        }
    }

    renderDisplaySettings(name) {
        const container = document.getElementById('display-settings');
        const titleEl = document.getElementById('display-title');
        if (!container) return;

        titleEl.textContent = name;
        const settings = this.config.displays[name] || {};


        const path = settings.path || '';
        const hasExtension = /\.[a-zA-Z0-9]{2,5}$/.test(path);
        const isFolder = path === '' || path.endsWith('/') || !hasExtension;
        const disabledClass = 'opacity-50 cursor-not-allowed';

        container.innerHTML = `
            <div class="space-y-4">
                <!-- Path -->
                <div class="space-y-2">
                    <label class="text-sm text-zinc-400">Wallpaper Path</label>
                    <div class="flex gap-2">
                        <input type="text" id="setting-path" value="${settings.path || ''}" 
                            placeholder="/path/to/wallpaper.jpg or /path/to/folder"
                            class="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none font-mono"
                            onchange="wpaperdEditor.updateSetting('${name}', 'path', this.value); wpaperdEditor.renderDisplaySettings('${name}')">
                        <button onclick="wpaperdEditor.browsePath('${name}')" 
                            class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700">
                            📁
                        </button>
                    </div>
                    <p class="text-xs text-zinc-600">Image file or directory containing wallpapers</p>
                </div>

                <!-- Duration (folder only) -->
                <div class="space-y-2 ${!isFolder ? disabledClass : ''}">
                    <label class="text-sm text-zinc-400">Duration ${!isFolder ? '<span class="text-xs">(folders only)</span>' : ''}</label>
                    <input type="text" id="setting-duration" value="${settings.duration || ''}" 
                        placeholder="30m, 1h, 10s"
                        ${!isFolder ? 'disabled' : ''}
                        class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none ${!isFolder ? 'text-zinc-600' : ''}"
                        onchange="wpaperdEditor.updateSetting('${name}', 'duration', this.value || null)">
                    <p class="text-xs text-zinc-600">How long to display each wallpaper</p>
                </div>

                <!-- Sorting (folder only) -->
                <div class="space-y-2 ${!isFolder ? disabledClass : ''}">
                    <label class="text-sm text-zinc-400">Sorting ${!isFolder ? '<span class="text-xs">(folders only)</span>' : ''}</label>
                    <select id="setting-sorting"
                        ${!isFolder ? 'disabled' : ''}
                        class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none ${!isFolder ? 'text-zinc-600' : ''}"
                        onchange="wpaperdEditor.updateSetting('${name}', 'sorting', this.value || null)">
                        <option value="" ${!settings.sorting ? 'selected' : ''}>Default (random)</option>
                        <option value="random" ${settings.sorting === 'random' ? 'selected' : ''}>Random</option>
                        <option value="ascending" ${settings.sorting === 'ascending' ? 'selected' : ''}>Ascending</option>
                        <option value="descending" ${settings.sorting === 'descending' ? 'selected' : ''}>Descending</option>
                    </select>
                </div>

                <!-- Mode -->
                <div class="space-y-2">
                    <label class="text-sm text-zinc-400">Display Mode</label>
                    <select id="setting-mode"
                        class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                        onchange="wpaperdEditor.updateSetting('${name}', 'mode', this.value || null)">
                        <option value="" ${!settings.mode ? 'selected' : ''}>Default</option>
                        <option value="fit" ${settings.mode === 'fit' ? 'selected' : ''}>Fit</option>
                        <option value="fit-border-color" ${settings.mode === 'fit-border-color' ? 'selected' : ''}>Fit (Border Color)</option>
                        <option value="center" ${settings.mode === 'center' ? 'selected' : ''}>Center</option>
                        <option value="stretch" ${settings.mode === 'stretch' ? 'selected' : ''}>Stretch</option>
                        <option value="tile" ${settings.mode === 'tile' ? 'selected' : ''}>Tile</option>
                    </select>
                </div>

                <!-- Transition Time -->
                <div class="space-y-2">
                    <label class="text-sm text-zinc-400">Transition Time (ms)</label>
                    <input type="number" id="setting-transition_time" value="${settings.transition_time || ''}" 
                        placeholder="300"
                        class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                        onchange="wpaperdEditor.updateSetting('${name}', 'transition_time', this.value ? parseInt(this.value) : null)">
                </div>

                <!-- Offset -->
                <div class="space-y-2">
                    <label class="text-sm text-zinc-400">Offset</label>
                    <input type="number" id="setting-offset" value="${settings.offset ?? ''}" 
                        placeholder="0.5" step="0.1" min="0" max="1"
                        class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                        onchange="wpaperdEditor.updateSetting('${name}', 'offset', this.value ? parseFloat(this.value) : null)">
                    <p class="text-xs text-zinc-600">Image offset (0.0-1.0). Default: 0.5 (0.0 for tile mode)</p>
                </div>

                <!-- Group (for random sorting) -->
                <div class="space-y-2 ${!isFolder ? disabledClass : ''}">
                    <label class="text-sm text-zinc-400">Group ${!isFolder ? '<span class="text-xs">(folders only)</span>' : ''}</label>
                    <input type="number" id="setting-group" value="${settings.group ?? ''}" 
                        placeholder="1"
                        ${!isFolder ? 'disabled' : ''}
                        class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none ${!isFolder ? 'text-zinc-600' : ''}"
                        onchange="wpaperdEditor.updateSetting('${name}', 'group', this.value ? parseInt(this.value) : null)">
                    <p class="text-xs text-zinc-600">Assign displays to same group to share wallpaper</p>
                </div>

                <!-- Queue Size (for random sorting) -->
                <div class="space-y-2 ${!isFolder ? disabledClass : ''}">
                    <label class="text-sm text-zinc-400">Queue Size ${!isFolder ? '<span class="text-xs">(folders only)</span>' : ''}</label>
                    <input type="number" id="setting-queue_size" value="${settings.queue_size ?? ''}" 
                        placeholder="10"
                        ${!isFolder ? 'disabled' : ''}
                        class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none ${!isFolder ? 'text-zinc-600' : ''}"
                        onchange="wpaperdEditor.updateSetting('${name}', 'queue_size', this.value ? parseInt(this.value) : null)">
                    <p class="text-xs text-zinc-600">History size for prev/next navigation (default: 10)</p>
                </div>

                <!-- Exec Script -->
                <div class="space-y-2">
                    <label class="text-sm text-zinc-400">Exec Script</label>
                    <input type="text" id="setting-exec" value="${settings.exec || ''}" 
                        placeholder="/path/to/script.sh"
                        class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none font-mono"
                        onchange="wpaperdEditor.updateSetting('${name}', 'exec', this.value || null)">
                    <p class="text-xs text-zinc-600">Script called on wallpaper change with (display, path) args</p>
                </div>

                <!-- Toggles -->
                <div class="space-y-3 pt-2">
                    <div class="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg ${!isFolder ? disabledClass : ''}">
                        <div>
                            <div class="text-sm text-zinc-300">Recursive ${!isFolder ? '<span class="text-xs text-zinc-500">(folders only)</span>' : ''}</div>
                            <div class="text-xs text-zinc-600">Scan subdirectories</div>
                        </div>
                        <label class="relative inline-flex items-center ${!isFolder ? 'pointer-events-none' : 'cursor-pointer'}">
                            <input type="checkbox" id="setting-recursive" class="sr-only peer" 
                                ${settings.recursive !== false ? 'checked' : ''}
                                ${!isFolder ? 'disabled' : ''}
                                onchange="wpaperdEditor.updateSetting('${name}', 'recursive', this.checked)">
                            <div class="w-11 h-6 bg-zinc-700 peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                        </label>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div>
                            <div class="text-sm text-zinc-300">Initial Transition</div>
                            <div class="text-xs text-zinc-600">Animate on startup</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="setting-initial_transition" class="sr-only peer"
                                ${settings.initial_transition !== false ? 'checked' : ''}
                                onchange="wpaperdEditor.updateSetting('${name}', 'initial_transition', this.checked)">
                            <div class="w-11 h-6 bg-zinc-700 peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                        </label>
                    </div>
                </div>

                <!-- Delete Button -->
                ${name !== 'default' && name !== 'any' ? `
                <div class="pt-4 border-t border-zinc-800">
                    <button onclick="wpaperdEditor.deleteDisplay('${name}')"
                        class="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm">
                        Delete Display Config
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }

    updateSetting(display, key, value) {
        if (!this.config.displays[display]) {
            this.config.displays[display] = {};
        }
        if (value === null || value === '' || value === undefined) {
            delete this.config.displays[display][key];
        } else {
            this.config.displays[display][key] = value;
        }
        this.triggerAutosave();
    }

    deleteDisplay(name) {
        if (confirm(`Delete config for "${name}"?`)) {
            delete this.config.displays[name];
            this.selectedDisplay = null;
            this.render();
            this.triggerAutosave();
        }
    }

    browsePath(display) {
        ImagePicker.open({
            multiselect: false,
            allowFolderSelect: true,
            onSelect: (items) => {
                if (items.length > 0) {
                    const item = items[0];
                    const path = item.type === 'folder' ? item.name : item.path;
                    const finalPath = item.path || item.name;
                    this.updateSetting(display, 'path', finalPath);
                    const input = document.getElementById('setting-path');
                    if (input) input.value = finalPath;
                    this.renderDisplaySettings(display);
                }
            }
        });
    }


    triggerAutosave() {
        if (this.isAutosaveEnabled()) {
            if (this.saveTimeout) clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(async () => {
                await this.save(true);
                if (window._presetManagers?.['wpaperd']) {
                    window._presetManagers['wpaperd'].updateActivePreset(true);
                }
            }, 500);
        }
    }

    isAutosaveEnabled() {
        return typeof ArchBoard !== 'undefined' ? ArchBoard.settings.autosaveEnabled : false;
    }

    async save(silent = false) {
        try {
            const res = await fetch('/wpaperd/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });

            if (res.ok) {
                if (!silent) showToast('Wpaperd config saved!', 'success');
            } else {
                const data = await res.json();
                showToast(`Save failed: ${data.detail || 'Unknown error'}`, 'error');
            }
        } catch (e) {
            console.error("Save failed", e);
            showToast('Save failed', 'error');
        }
    }

    async control(action) {
        try {
            const res = await fetch('/wpaperd/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            if (res.ok) {
                showToast(`Wallpaper: ${action}`, 'success');
                setTimeout(async () => {
                    await Promise.all([this.loadCurrent(), this.loadStatus()]);
                    this.renderCurrentPreview();
                }, 500);
            } else {
                showToast(`Control failed`, 'error');
            }
        } catch (e) {
            console.error("Control failed", e);
            showToast('Control failed', 'error');
        }
    }

    async restart() {
        try {
            const res = await fetch('/wpaperd/restart', { method: 'POST' });
            if (res.ok) {
                showToast('Wpaperd restarted', 'success');
                setTimeout(() => this.loadCurrent().then(() => this.renderCurrentPreview()), 1000);
            } else {
                showToast('Failed to restart wpaperd', 'error');
            }
        } catch (e) {
            console.error("Restart failed", e);
            showToast('Failed to restart wpaperd', 'error');
        }
    }
}
