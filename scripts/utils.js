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
        container.className = 'fixed bottom-6 right-6 flex flex-col gap-2 z-[9999] pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const typeClasses = {
        'info': 'border-blue-500 bg-blue-500/10 text-blue-200',
        'success': 'border-teal-500 bg-teal-500/10 text-teal-200',
        'error': 'border-red-500 bg-red-500/10 text-red-200'
    };

    toast.className = `flex items-center justify-between gap-4 px-4 py-3 bg-zinc-900 border rounded-lg text-sm shadow-xl min-w-[300px] pointer-events-auto transition-all duration-300 animate-in slide-in-from-right-full ${typeClasses[type] || typeClasses['info']}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="hover:text-white transition-colors">×</button>
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
        container.className = 'fixed bottom-6 right-6 flex flex-col gap-2 z-[10000] pointers-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const typeClasses = {
        'info': 'border-blue-500 bg-blue-500/10 text-blue-200',
        'success': 'border-teal-500 bg-teal-500/10 text-teal-200',
        'error': 'border-red-500 bg-red-500/10 text-red-200'
    };
    toast.className = `flex items-center justify-between gap-4 px-4 py-3 bg-zinc-900 border rounded-lg text-sm shadow-xl min-w-[300px] pointer-events-auto transition-all duration-300 animate-in slide-in-from-right-full ${typeClasses[type] || typeClasses['info']}`;
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
        overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200 [&.active]:opacity-100 [&.active]:pointer-events-auto';
        overlay.onclick = closeGlobalModal;

        const modalContent = document.createElement('div');
        modalContent.id = 'global-modal-content';
        modalContent.className = 'bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl transform scale-95 transition-transform duration-200 [&.active]:scale-100';
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

// Shorter aliases for convenience - these check for page-specific modal first
function openModal(content) {
    // Check for page-specific modal overlay first (styled consistently with page)
    const pageOverlay = document.getElementById('modal-overlay');
    if (pageOverlay) {
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.innerHTML = content;
            pageOverlay.classList.add('active');
            return;
        }
    }
    // Fall back to global modal
    openGlobalModal(content);
}

function closeModal() {
    // Check for page-specific modal overlay first
    const pageOverlay = document.getElementById('modal-overlay');
    if (pageOverlay && pageOverlay.classList.contains('active')) {
        pageOverlay.classList.remove('active');
        return;
    }
    // Fall back to global modal
    closeGlobalModal();
}

// Confirm dialog helper - shows a confirmation dialog with customizable action
function confirmDialog(title, message, onConfirmFn, confirmText = 'Confirm', isDangerous = true) {
    const buttonClass = isDangerous
        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50'
        : 'bg-teal-600 hover:bg-teal-500 text-white';

    openModal(`
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">${title}</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <p class="text-zinc-300">${message}</p>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
            <button class="px-4 py-2 ${buttonClass} rounded-lg transition-colors" 
                onclick="(${onConfirmFn})(); closeModal();">${confirmText}</button>
        </div>
    `);
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
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">⚙️ Settings</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeGlobalModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="flex flex-col gap-3">
                <div class="flex justify-between items-center p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div class="flex-1 mr-4">
                        <div class="font-medium text-zinc-200 mb-1">Show Notifications</div>
                        <div class="text-xs text-zinc-500">Display toast messages for save, sync, and other actions</div>
                    </div>
                    
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" ${ArchBoard.settings.toastsEnabled ? 'checked' : ''} onchange="toggleToasts(this.checked)">
                        <div class="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                </div>
                <div class="flex justify-between items-center p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div class="flex-1 mr-4">
                        <div class="font-medium text-zinc-200 mb-1">Autosave</div>
                        <div class="text-xs text-zinc-500">Automatically save changes as you edit</div>
                    </div>
                    
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" ${ArchBoard.settings.autosaveEnabled ? 'checked' : ''} onchange="toggleGlobalAutosave(this.checked)">
                        <div class="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                </div>
            </div>
        </div>
        <div class="flex justify-end pt-4 border-t border-zinc-700/50">
            <button class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors" onclick="closeGlobalModal()">Close</button>
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

// =============================================================================
// COLOR UTILITIES
// =============================================================================

const ColorUtils = {
    // Converts various color formats to #RRGGBB for <input type="color">
    toHex(color) {
        if (!color || typeof color !== 'string') return '#ffffff';
        const str = String(color).trim();
        if (!str) return '#ffffff';

        // 1. Handle Hex: #RRGGBB, #RGB, #RRGGBBAA
        if (str.startsWith('#')) {
            if (str.length === 4) { // #RGB -> #RRGGBB
                return '#' + str[1] + str[1] + str[2] + str[2] + str[3] + str[3];
            }
            if (str.length === 9) { // #RRGGBBAA -> #RRGGBB (discard alpha for picker)
                return str.substring(0, 7);
            }
            return str.substring(0, 7); // Ensure 7 chars
        }

        // 2. Handle Hyprland 0x format: 0xAARRGGBB or 0xRRGGBB
        if (str.startsWith('0x')) {
            // Remove 0x
            let hex = str.substring(2);
            if (hex.length === 8) { // AARRGGBB -> RRGGBB
                return '#' + hex.substring(2);
            }
            return '#' + hex;
        }

        // 3. Handle rgba(r, g, b, a) or rgb(r, g, b)
        const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }

        // 4. Handle Hyprland rgba(hex) format: rgba(33ccffee)
        // This is weird but Hyprland supports it. It's basically rgba(RRGGBBAA)
        const rgbaHexMatch = str.match(/rgba\(([0-9a-fA-F]{8})\)/);
        if (rgbaHexMatch) {
            // Extract RRGGBB from RRGGBBAA (first 6 chars)
            return '#' + rgbaHexMatch[1].substring(0, 6);
        }

        // Default
        return '#ffffff';
    },

    // Updates a color value with a new hex color, preserving the original format
    formatUpdate(originalValue, newHexValue) {
        console.log("Got " + originalValue + " and " + newHexValue);
        if (!originalValue) return newHexValue;
        const str = String(originalValue).trim();

        // Remove # from new value
        const newHex = newHexValue.startsWith('#') ? newHexValue.substring(1) : newHexValue;
        const r = parseInt(newHex.substring(0, 2), 16);
        const g = parseInt(newHex.substring(2, 4), 16);
        const b = parseInt(newHex.substring(4, 6), 16);

        // 1. Preserve rgba(r, g, b, a)
        if (str.startsWith('rgba(') && str.includes(',')) {
            const alphaMatch = str.match(/rgba?\(.*,\s*([\d\.]+)\)/);
            const alpha = alphaMatch ? alphaMatch[1] : '1.0';
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        // 2. Preserve rgb(r, g, b)
        if (str.startsWith('rgb(')) {
            return `rgb(${r}, ${g}, ${b})`;
        }

        // 3. Preserve 0x format (0xAARRGGBB)
        if (str.startsWith('0x')) {
            // Need the original alpha
            // If original was 8 chars (AARRGGBB)
            if (str.length === 10) { // 0x + 8 chars
                const originalAlpha = str.substring(2, 4);
                return `0x${originalAlpha}${newHex}`;
            }
            // If original was 6 chars (RRGGBB)
            return `0x${newHex}`;
        }

        // 4. Preserve Hyprland rgba(hex) format: rgba(33ccffee)
        // Check if starts with rgba( and does NOT contain comma (decimal format)
        if (str.startsWith('rgba(') && !str.includes(',')) {
            const hexMatch = str.match(/([0-9a-fA-F]{8})/);
            if (hexMatch) {
                const originalHex = hexMatch[1];
                const originalAlpha = originalHex.substring(6, 8);
                return `rgba(${newHex}${originalAlpha})`;
            }
        }
        return newHexValue;
    }
};

// Expose globally
window.ColorUtils = ColorUtils;

// =============================================================================
// FONT UTILITIES
// =============================================================================

const FontUtils = {
    /**
     * Parse a font string like "Caveat Bold" into family, weight, and style.
     * Applies the parsed values to an element.
     */
    applyFontStyle(el, fontString) {
        if (!fontString) {
            el.style.fontFamily = 'Sans';
            return;
        }

        let family = fontString;
        let weight = 'normal';
        let style = 'normal';

        const lower = fontString.toLowerCase();

        // Weights
        if (lower.includes('thin')) weight = '100';
        else if (lower.includes('extralight')) weight = '200';
        else if (lower.includes('light')) weight = '300';
        else if (lower.includes('medium')) weight = '500';
        else if (lower.includes('semibold')) weight = '600';
        else if (lower.includes('extrabold') || lower.includes('heavy')) weight = '800';
        else if (lower.includes('black')) weight = '900';
        else if (lower.includes('bold')) weight = '700';

        // Styles
        if (lower.includes('italic')) style = 'italic';
        else if (lower.includes('oblique')) style = 'oblique';

        // Strip keywords to get family name
        const remove = [
            'extralight', 'light', 'thin', 'medium', 'semibold', 'extrabold', 'heavy', 'black', 'bold',
            'italic', 'oblique', 'regular'
        ];

        const regex = new RegExp(`\\b(${remove.join('|')})\\b`, 'gi');
        family = fontString.replace(regex, '').replace(/\s+/g, ' ').trim();

        if (!family) family = 'Sans';

        el.style.fontFamily = `"${family}", Sans`;
        el.style.fontWeight = weight;
        el.style.fontStyle = style;
    }
};

// Expose globally
window.FontUtils = FontUtils;

