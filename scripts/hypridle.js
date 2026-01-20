/**
 * HypridleEditor: Editor for Hypridle idle management configuration.
 */
class HypridleEditor {
    constructor() {
        this.config = {
            general: {
                lock_cmd: '',
                unlock_cmd: '',
                before_sleep_cmd: '',
                after_sleep_cmd: '',
                ignore_dbus_inhibit: false
            },
            listeners: []
        };
        this.saveTimeout = null;
        this.init();
    }

    async init() {
        try {
            const res = await fetch('/hypridle/config');
            if (res.ok) {
                this.config = await res.json();
            }
        } catch (e) {
            console.error("Failed to load hypridle config", e);
        }
        this.render();

        setTimeout(() => {
            if (window.PresetManagerUI) {
                window._presetManagers = window._presetManagers || {};
                window._presetManagers['hypridle'] = new PresetManagerUI('hypridle', {
                    containerId: 'preset-container',
                    onActivate: async () => {
                        await this.loadConfig();
                        this.render();
                    },
                    onSave: async () => await this.save()
                });
            } else {
                console.warn("HypridleEditor: PresetManagerUI not available");
            }
        }, 50);
    }

    async loadConfig() {
        try {
            const res = await fetch('/hypridle/config');
            if (res.ok) {
                this.config = await res.json();
            }
        } catch (e) {
            console.error("Failed to load hypridle config", e);
        }
    }

    async reload() {
        try {
            const res = await fetch('/hypridle/restart', { method: 'POST' });
            if (res.ok) {
                showToast('Hypridle restarted', 'success');
            } else {
                showToast('Failed to restart hypridle', 'error');
            }
        } catch (e) {
            console.error("Restart failed", e);
            showToast('Failed to restart hypridle', 'error');
        }
    }

    render() {
        this.renderGeneral();
        this.renderListeners();
    }

    renderGeneral() {
        const fields = ['lock_cmd', 'unlock_cmd', 'before_sleep_cmd', 'after_sleep_cmd'];
        fields.forEach(field => {
            const input = document.getElementById(`gen-${field}`);
            if (input) {
                input.value = this.config.general[field] || '';
            }
        });

        const inhibitCheckbox = document.getElementById('gen-ignore_dbus_inhibit');
        if (inhibitCheckbox) {
            inhibitCheckbox.checked = this.config.general.ignore_dbus_inhibit || false;
        }
    }

    renderListeners() {
        const container = document.getElementById('listeners-list');
        if (!container) return;
        container.innerHTML = '';

        if (!this.config.listeners || this.config.listeners.length === 0) {
            container.innerHTML = `
                <div class="text-zinc-500 text-center py-10">
                    <div class="text-4xl mb-2">⏰</div>
                    <p>No listeners configured.</p>
                    <p class="text-xs mt-1">Click "Add Listener" to create one.</p>
                </div>
            `;
            return;
        }

        const grid = document.createElement('div');
        grid.className = "flex flex-col gap-4";

        this.config.listeners.forEach((listener, idx) => {
            const card = document.createElement('div');
            card.className = "bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-700 transition-colors relative";

            const timeoutReadable = this.formatTimeout(listener.timeout);

            card.innerHTML = `
                <div class="px-4 py-3 bg-zinc-800/30 border-b border-zinc-800 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                         <div class="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-teal-400 font-bold text-xs border border-zinc-700">
                            ${idx + 1}
                         </div>
                         <div class="flex flex-col">
                            <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Listener</span>
                            <span class="text-xs text-teal-500 font-mono">${timeoutReadable}</span>
                         </div>
                    </div>
                    <button onclick="hypridleEditor.deleteListener(${idx})" class="text-zinc-500 hover:text-red-400 transition-colors p-1">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>

                <div class="p-4 space-y-4">
                    <div class="space-y-1">
                        <label class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Timeout (Seconds)</label>
                        <input type="number" 
                               value="${listener.timeout}" 
                               min="1"
                               class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-700 font-mono"
                               onchange="hypridleEditor.updateListener(${idx}, 'timeout', parseInt(this.value) || 60)">
                    </div>

                    </div>

                    <div class="space-y-1">
                         <label class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">On Timeout</label>
                         <textarea class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-700 font-mono resize-y"
                                   rows="3"
                                   placeholder="e.g. hyprlock"
                                   onchange="hypridleEditor.updateListener(${idx}, 'on_timeout', this.value)">${listener.on_timeout || ''}</textarea>
                    </div>

                    </div>

                    <div class="space-y-1">
                         <label class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">On Resume</label>
                         <textarea class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-700 font-mono resize-y"
                                   rows="3"
                                   placeholder="e.g. killall hyprlock"
                                   onchange="hypridleEditor.updateListener(${idx}, 'on_resume', this.value)">${listener.on_resume || ''}</textarea>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        container.appendChild(grid);
    }



    formatTimeout(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }



    updateGeneral(key, value) {
        this.config.general[key] = value;
        this.triggerAutosave();
    }

    updateListener(idx, key, value) {
        if (this.config.listeners[idx]) {
            this.config.listeners[idx][key] = value;
            if (key === 'timeout') {
                this.renderListeners();
            }
            this.triggerAutosave();
        }
    }

    addListener() {
        const newListener = {
            id: `listener_${Date.now()}`,
            timeout: 300,
            on_timeout: '',
            on_resume: ''
        };
        this.config.listeners.push(newListener);
        this.renderListeners();
        showToast('Listener added');
        this.triggerAutosave();
    }

    deleteListener(idx) {
        this.config.listeners.splice(idx, 1);
        this.renderListeners();
        showToast('Listener removed');
        this.triggerAutosave();
    }

    triggerAutosave() {
        if (this.isAutosaveEnabled()) {
            if (this.saveTimeout) clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(async () => {
                await this.save(true);
                if (window._presetManagers && window._presetManagers['hypridle']) {
                    window._presetManagers['hypridle'].updateActivePreset(true);
                }
            }, 500);
        }
    }

    isAutosaveEnabled() {
        return typeof ArchBoard !== 'undefined' ? ArchBoard.settings.autosaveEnabled : false;
    }

    async save(silent = false) {
        try {
            const res = await fetch('/hypridle/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });

            if (res.ok) {
                if (!silent) showToast('Hypridle config saved!', 'success');
            } else {
                const data = await res.json();
                showToast(`Save failed: ${data.detail || 'Unknown error'}`, 'error');
            }
        } catch (e) {
            console.error("Save failed", e);
            showToast('Save failed', 'error');
        }
    }
}

