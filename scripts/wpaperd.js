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
        const reload = async () => {
            await this.loadCurrent();
            await this.loadStatus();
            this.renderCurrentPreview();
            setTimeout(reload, 1000)
        }
        setTimeout(reload, 1000);
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
            const statusColor = displayStatus.includes('running') ? 'bg-green-500' :
                displayStatus.includes('paused') ? 'bg-yellow-500' : 'bg-zinc-500';
            const statusText = displayStatus.includes('running') ? '▶' :
                displayStatus.includes('paused') ? '⏸' : '?';

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

        container.innerHTML = '';

        const children = [];

        // Path
        children.push(UIManager.createActionInput(
            "Wallpaper Path",
            "Image file or directory containing wallpapers",
            settings.path || '',
            "/path/to/wallpaper.jpg or /path/to/folder",
            "📁",
            () => this.browsePath(name),
            (val) => {
                this.updateSetting(name, 'path', val);
                // Trigger re-render to update isFolder states? 
                // Currently renderDisplaySettings is called on change in the old code.
                setTimeout(() => this.renderDisplaySettings(name), 10);
            }
        ));

        // Duration
        const durEl = UIManager.createInput(
            "Duration " + (!isFolder ? '<span class="text-xs text-zinc-500">(folders only)</span>' : ''),
            "How long to display each wallpaper",
            settings.duration || '',
            "30m, 1h, 10s",
            (val) => this.updateSetting(name, 'duration', val || null)
        );
        if (!isFolder) {
            durEl.querySelector('input').disabled = true;
            durEl.querySelector('input').classList.add('opacity-50', 'cursor-not-allowed');
            durEl.classList.add('opacity-75');
        }
        children.push(durEl);

        // Sorting
        const sortOpts = [
            { label: 'Default (random)', value: '' },
            { label: 'Random', value: 'random' },
            { label: 'Ascending', value: 'ascending' },
            { label: 'Descending', value: 'descending' }
        ];
        const sortEl = UIManager.createSelect(
            "Sorting " + (!isFolder ? '<span class="text-xs text-zinc-500">(folders only)</span>' : ''),
            null,
            settings.sorting || '',
            sortOpts,
            (val) => this.updateSetting(name, 'sorting', val || null)
        );
        if (!isFolder) {
            sortEl.querySelector('select').disabled = true;
            sortEl.querySelector('select').classList.add('opacity-50', 'cursor-not-allowed');
            sortEl.classList.add('opacity-75');
        }
        children.push(sortEl);

        // Mode
        const modeOpts = [
            { label: 'Default', value: '' },
            { label: 'Fit', value: 'fit' },
            { label: 'Fit (Border Color)', value: 'fit-border-color' },
            { label: 'Center', value: 'center' },
            { label: 'Stretch', value: 'stretch' },
            { label: 'Tile', value: 'tile' }
        ];
        children.push(UIManager.createSelect(
            "Display Mode",
            null,
            settings.mode || '',
            modeOpts,
            (val) => this.updateSetting(name, 'mode', val || null)
        ));

        // Transition Time
        children.push(UIManager.createInput(
            "Transition Time (ms)",
            null,
            settings.transition_time || '',
            "300",
            (val) => this.updateSetting(name, 'transition_time', val ? parseInt(val) : null),
            null,
            "number"
        ));

        // Offset
        children.push(UIManager.createInput(
            "Offset",
            "Image offset (0.0-1.0). Default: 0.5",
            settings.offset ?? '',
            "0.5",
            (val) => this.updateSetting(name, 'offset', val ? parseFloat(val) : null),
            null,
            "number" // TODO: Add step/min/max support to createInput or manual attr set (just not gon get this done as it does not break anything)
        ));
        // Manual attribute setting for Offset until UIManager supports it
        const offInput = children[children.length - 1].querySelector('input');
        if (offInput) {
            offInput.step = "0.1";
            offInput.min = "0";
            offInput.max = "1";
        }

        // Group
        const groupEl = UIManager.createInput(
            "Group " + (!isFolder ? '<span class="text-xs text-zinc-500">(folders only)</span>' : ''),
            "Assign displays to same group to share wallpaper",
            settings.group ?? '',
            "1",
            (val) => this.updateSetting(name, 'group', val ? parseInt(val) : null),
            null,
            "number"
        );
        if (!isFolder) {
            groupEl.querySelector('input').disabled = true;
            groupEl.classList.add('opacity-75');
        }
        children.push(groupEl);

        // Queue Size
        const queueEl = UIManager.createInput(
            "Queue Size " + (!isFolder ? '<span class="text-xs text-zinc-500">(folders only)</span>' : ''),
            "History size for prev/next navigation",
            settings.queue_size ?? '',
            "10",
            (val) => this.updateSetting(name, 'queue_size', val ? parseInt(val) : null),
            null,
            "number"
        );
        if (!isFolder) {
            queueEl.querySelector('input').disabled = true;
            queueEl.classList.add('opacity-75');
        }
        children.push(queueEl);

        // Exec Script
        children.push(UIManager.createInput(
            "Exec Script",
            "Script called on wallpaper change",
            settings.exec || '',
            "/path/to/script.sh",
            (val) => this.updateSetting(name, 'exec', val || null)
        ));

        // Recursive Toggle
        const recEl = UIManager.createToggle(
            "Recursive " + (!isFolder ? '<span class="text-xs text-zinc-500">(folders only)</span>' : ''),
            "Scan subdirectories",
            settings.recursive !== false,
            (val) => this.updateSetting(name, 'recursive', val)
        );
        if (!isFolder) {
            recEl.querySelector('input').disabled = true;
            recEl.classList.add('opacity-75');
        }
        children.push(recEl);

        // Initial Transition Toggle
        children.push(UIManager.createToggle(
            "Initial Transition",
            "Animate on startup",
            settings.initial_transition !== false,
            (val) => this.updateSetting(name, 'initial_transition', val)
        ));

        // Delete Button
        if (name !== 'default' && name !== 'any') {
            const btnContainer = document.createElement('div');
            btnContainer.className = "pt-4 border-t border-zinc-800 flex justify-end";
            const delBtn = document.createElement('button');
            delBtn.className = "px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors border border-red-500/20";
            delBtn.textContent = "Delete Display Config";
            delBtn.onclick = () => this.deleteDisplay(name);
            btnContainer.appendChild(delBtn);
            children.push(btnContainer);
        }

        // Render Section
        const section = UIManager.createSection(null, null, children);
        container.appendChild(section);
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
                    // this.renderCurrentPreview();
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
