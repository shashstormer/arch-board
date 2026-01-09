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

        container.innerHTML = this.config.listeners.map((listener, idx) => this.renderListenerCard(listener, idx)).join('');
    }

    renderListenerCard(listener, idx) {
        const timeoutReadable = this.formatTimeout(listener.timeout);

        return `
            <div class="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 space-y-3 group relative">
                <!-- Delete Button -->
                <button onclick="hypridleEditor.deleteListener(${idx})" 
                    class="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100">
                    🗑️
                </button>
                
                <!-- Timeout -->
                <div class="flex items-center gap-4">
                    <div class="flex-1">
                        <label class="text-xs text-zinc-500">Timeout (seconds)</label>
                        <div class="flex items-center gap-2">
                            <input type="number" value="${listener.timeout}" min="1" step="1"
                                class="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:border-teal-500 outline-none"
                                onchange="hypridleEditor.updateListener(${idx}, 'timeout', parseInt(this.value) || 60)">
                            <span class="text-sm text-zinc-400">${timeoutReadable}</span>
                        </div>
                    </div>
                </div>
                
                <!-- On Timeout -->
                <div>
                    <label class="text-xs text-zinc-500">On Timeout</label>
                    <input type="text" value="${this.escapeHtml(listener.on_timeout || '')}" placeholder="Command to run when idle..."
                        class="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:border-teal-500 outline-none font-mono"
                        onchange="hypridleEditor.updateListener(${idx}, 'on_timeout', this.value)">
                </div>
                
                <!-- On Resume -->
                <div>
                    <label class="text-xs text-zinc-500">On Resume</label>
                    <input type="text" value="${this.escapeHtml(listener.on_resume || '')}" placeholder="Command to run when activity resumes..."
                        class="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:border-teal-500 outline-none font-mono"
                        onchange="hypridleEditor.updateListener(${idx}, 'on_resume', this.value)">
                </div>
            </div>
        `;
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

    escapeHtml(str) {
        return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    updateGeneral(key, value) {
        this.config.general[key] = value;
    }

    updateListener(idx, key, value) {
        if (this.config.listeners[idx]) {
            this.config.listeners[idx][key] = value;
            // Re-render to update timeout display
            if (key === 'timeout') {
                this.renderListeners();
            }
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
    }

    deleteListener(idx) {
        this.config.listeners.splice(idx, 1);
        this.renderListeners();
        showToast('Listener removed');
    }

    async save() {
        try {
            const res = await fetch('/hypridle/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });

            if (res.ok) {
                showToast('Hypridle config saved!', 'success');
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
