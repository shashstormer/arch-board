// ArchBoard Shared Utilities
// Common functionality used across all tool pages

// =============================================================================
// SETTINGS STATE (persisted in localStorage)
// =============================================================================

const ArchBoard = {
    // localStorage key mapping
    _storageKeys: {
        toastsEnabled: 'archboard_toasts',
        autosaveEnabled: 'archboard_autosave'
    },

    // Settings with defaults
    settings: {
        toastsEnabled: localStorage.getItem('archboard_toasts') !== 'false',
        autosaveEnabled: localStorage.getItem('archboard_autosave') === 'true'
    },

    // Update a setting
    setSetting(key, value) {
        this.settings[key] = value;
        const storageKey = this._storageKeys[key] || `archboard_${key}`;
        localStorage.setItem(storageKey, value.toString());
    },

    // Get a setting
    getSetting(key) {
        return this.settings[key];
    }
};

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

function showToast(message, type = 'info') {
    // Skip if toasts are disabled
    if (!ArchBoard.settings.toastsEnabled) return;

    let container = document.getElementById('toast-container');

    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => toast.remove(), 3000);
}

// Force show toast even if disabled (for settings confirmation)
function forceShowToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// =============================================================================
// MODAL SYSTEM
// =============================================================================

function openGlobalModal(content) {
    let overlay = document.getElementById('global-modal-overlay');

    // Create modal overlay if it doesn't exist
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.onclick = closeGlobalModal;

        const modalContent = document.createElement('div');
        modalContent.id = 'global-modal-content';
        modalContent.className = 'modal-content';
        modalContent.onclick = (e) => e.stopPropagation();

        overlay.appendChild(modalContent);
        document.body.appendChild(overlay);
    }

    const modalContent = document.getElementById('global-modal-content');
    modalContent.innerHTML = content;
    overlay.classList.add('active');
}

function closeGlobalModal() {
    const overlay = document.getElementById('global-modal-overlay');
    if (overlay) overlay.classList.remove('active');
}

// =============================================================================
// GLOBAL SETTINGS MODAL
// =============================================================================

function toggleToasts(enabled) {
    ArchBoard.setSetting('toastsEnabled', enabled);
    forceShowToast(`Toasts ${enabled ? 'enabled' : 'disabled'}`);
}

function toggleGlobalAutosave(enabled) {
    ArchBoard.setSetting('autosaveEnabled', enabled);
    forceShowToast(`Autosave ${enabled ? 'enabled' : 'disabled'}`);

    // Also update any tool-specific autosave state
    if (typeof autosaveEnabled !== 'undefined') {
        autosaveEnabled = enabled;
    }

    // Update toggle in hyprland header if it exists
    const toggle = document.getElementById('autosave-toggle');
    if (toggle) toggle.checked = enabled;
}

function showGlobalSettingsModal() {
    openGlobalModal(`
        <div class="modal-header">
            <h3>⚙️ Settings</h3>
            <button class="modal-close" onclick="closeGlobalModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="settings-list">
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-label">Show Notifications</div>
                        <div class="setting-desc">Display toast messages for save, sync, and other actions</div>
                    </div>
                    <label class="toggle">
                        <input type="checkbox" ${ArchBoard.settings.toastsEnabled ? 'checked' : ''} onchange="toggleToasts(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-label">Autosave</div>
                        <div class="setting-desc">Automatically save changes as you edit</div>
                    </div>
                    <label class="toggle">
                        <input type="checkbox" ${ArchBoard.settings.autosaveEnabled ? 'checked' : ''} onchange="toggleGlobalAutosave(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeGlobalModal()">Close</button>
        </div>
    `);
}

// Initialize global settings button
document.addEventListener('DOMContentLoaded', () => {
    // Find the settings button in header and wire it up
    const settingsButtons = document.querySelectorAll('button[title="Settings"]');
    settingsButtons.forEach(btn => {
        btn.onclick = showGlobalSettingsModal;
    });
});
