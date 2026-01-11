class PresetManagerUI {
    constructor(toolName, options = {}) {
        this.toolName = toolName;
        this.containerId = options.containerId || 'preset-controls';
        this.onActivate = options.onActivate || (() => { });
        this.onSave = options.onSave || null; // Async function that ensures config is saved first

        this.presets = [];
        this.activePreset = null;

        this.init();
    }

    async init() {
        await this.loadPresets();
        this.render();
    }

    async loadPresets() {
        try {
            const res = await fetch(`/presets/${this.toolName}`);
            const data = await res.json();
            this.presets = data.presets;
            this.activePreset = data.active_preset;
        } catch (e) {
            console.error(`Failed to load presets for ${this.toolName}`, e);
            showToast('Failed to load presets', 'error');
        }
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return; // Silent fail if container doesn't exist yet

        const activePresetObj = this.presets.find(p => p.id === this.activePreset);
        const displayName = activePresetObj ? activePresetObj.name : 'Default';

        container.innerHTML = `
            <div class="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1 pr-3 shadow-sm">
                <span class="text-xs text-zinc-500 pl-2">Preset:</span>
                <button class="flex items-center gap-2 text-sm text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    onclick="window._presetManagers['${this.toolName}'].showManageModal()">
                    <span class="truncate max-w-[150px] font-medium">${displayName}</span>
                    <span class="text-xs text-zinc-500">▼</span>
                </button>
                
                <div class="w-px h-4 bg-zinc-800 mx-1"></div>

                <button class="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                    onclick="window._presetManagers['${this.toolName}'].showSaveModal()" title="Save as New Preset">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                </button>

                ${this.activePreset ? `
                    <button class="p-1.5 text-teal-500 hover:text-teal-400 hover:bg-zinc-800 rounded transition-colors"
                        onclick="window._presetManagers['${this.toolName}'].updateActivePreset()" title="Update Active Preset">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    </button>
                ` : ''}
            </div>
        `;
    }

    // --- Actions ---

    async updateActivePreset(silent = false) {
        if (!this.activePreset) return;

        try {
            // Hook: ensure parent app saves its config first
            if (this.onSave) await this.onSave();

            const response = await fetch(`/presets/${this.toolName}/${this.activePreset}/update-content`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Update failed');

            if (!silent) showToast('Preset updated!', 'success');
        } catch (e) {
            console.error(e);
            if (!silent) showToast('Failed to update preset', 'error');
        }
    }

    async saveNewPreset(name, description) {
        try {
            if (this.onSave) await this.onSave();

            const response = await fetch(`/presets/${this.toolName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (!response.ok) throw new Error('Failed to create preset');

            const preset = await response.json();
            this.presets.push(preset);
            this.activePreset = preset.id;
            this.render();

            showToast(`Preset "${name}" saved!`, 'success');
            return true;
        } catch (e) {
            showToast('Failed to save preset', 'error');
            return false;
        }
    }

    async activatePreset(presetId) {
        try {
            const response = await fetch(`/presets/${this.toolName}/${presetId}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backup_current: true })
            });

            if (!response.ok) throw new Error('Activation failed');

            this.activePreset = presetId;
            this.render(); // Update UI immediately

            // Hook: notify parent app to reload
            if (this.onActivate) await this.onActivate();

            const preset = this.presets.find(p => p.id === presetId);
            showToast(`Preset "${preset?.name || presetId}" activated!`, 'success');
        } catch (e) {
            showToast('Failed to activate preset', 'error');
        }
    }

    async deletePreset(presetId) {
        if (!confirm('Delete this preset? This cannot be undone.')) return;

        try {
            const response = await fetch(`/presets/${this.toolName}/${presetId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');

            this.presets = this.presets.filter(p => p.id !== presetId);
            if (this.activePreset === presetId) {
                this.activePreset = null;
                // Deactivate on server too
                await fetch(`/presets/${this.toolName}/deactivate`, { method: 'POST' });
            }

            this.render();
            this.showManageModal(); // Refresh modal list
            showToast('Preset deleted', 'success');
        } catch (e) {
            showToast('Failed to delete preset', 'error');
        }
    }

    // --- Modals ---

    showSaveModal() {
        // Reuse global openModal if available
        const instance = `window._presetManagers['${this.toolName}']`;
        openModal(`
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-zinc-100">Save New Preset</h2>
                <button onclick="closeModal()" class="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Preset Name</label>
                    <input type="text" id="pm-preset-name" placeholder="My Theme"
                        class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Description (optional)</label>
                    <textarea id="pm-preset-desc" placeholder="Description..."
                        class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 outline-none h-20 resize-none"></textarea>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <button onclick="closeModal()" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg">Cancel</button>
                    <button onclick="const n = document.getElementById('pm-preset-name').value; const d = document.getElementById('pm-preset-desc').value; ${instance}.saveNewPreset(n, d).then(ok => { if(ok) closeModal(); })" 
                        class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg">Save Preset</button>
                </div>
            </div>
        `);
    }

    showManageModal() {
        const instance = `window._presetManagers['${this.toolName}']`;
        const presetRows = this.presets.map(p => `
            <div class="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg ${p.id === this.activePreset ? 'ring-1 ring-teal-500 bg-teal-900/10' : ''} hover:bg-zinc-800 transition-colors group">
                <div class="cursor-pointer flex-1" onclick="${instance}.activatePreset('${p.id}'); closeModal();">
                    <div class="font-medium text-zinc-200 flex items-center gap-2">
                        ${p.name}
                        ${p.id === this.activePreset ? '<span class="text-[10px] bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Active</span>' : ''}
                    </div>
                    <div class="text-xs text-zinc-500">${p.description || 'No description'}</div>
                </div>
                <div class="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="${instance}.showEditModal('${p.id}')" 
                        class="p-1.5 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 rounded transition-colors" title="Edit Preset">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="${instance}.deletePreset('${p.id}')" 
                        class="p-1.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 rounded transition-colors" title="Delete Preset">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');

        openModal(`
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-zinc-100">Presets</h2>
                <button onclick="closeModal()" class="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div class="space-y-2 max-h-[60vh] overflow-y-auto p-1">
                ${presetRows || '<div class="py-8 text-center text-zinc-500 flex flex-col items-center gap-2"><span class="text-2xl">📭</span><p>No presets saved yet</p></div>'}
            </div>
            <div class="flex justify-between items-center mt-6 pt-4 border-t border-zinc-800">
                <button onclick="${instance}.showSaveModal()" class="text-sm text-teal-500 hover:text-teal-400 font-medium">+ Create New</button>
                <button onclick="closeModal()" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg">Close</button>
            </div>
        `);
    }

    showEditModal(presetId) {
        const instance = `window._presetManagers['${this.toolName}']`;
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) return;

        openModal(`
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-zinc-100">Edit Preset</h2>
                <button onclick="${instance}.showManageModal()" class="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Preset Name</label>
                    <input type="text" id="pm-edit-name" value="${preset.name}"
                        class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Description</label>
                    <textarea id="pm-edit-desc"
                        class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 outline-none h-20 resize-none">${preset.description || ''}</textarea>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <button onclick="${instance}.showManageModal()" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg">Cancel</button>
                    <button onclick="const n = document.getElementById('pm-edit-name').value; const d = document.getElementById('pm-edit-desc').value; ${instance}.saveEditedPreset('${presetId}', n, d)" 
                        class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg">Save Changes</button>
                </div>
            </div>
        `);
    }

    async saveEditedPreset(presetId, name, description) {
        try {
            const response = await fetch(`/presets/${this.toolName}/${presetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (!response.ok) throw new Error('Failed to update preset');

            const updated = await response.json();

            // Update local state
            const index = this.presets.findIndex(p => p.id === presetId);
            if (index !== -1) {
                this.presets[index] = updated;
            }

            this.render();
            showToast('Preset updated', 'success');
            this.showManageModal(); // Return to list
            return true;
        } catch (e) {
            console.error(e);
            showToast('Failed to update preset', 'error');
            return false;
        }
    }
}


window._presetManagers = window._presetManagers || {};
window.PresetManagerUI = PresetManagerUI;
