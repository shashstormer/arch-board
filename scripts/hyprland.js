// Hyprland Config Editor JavaScript

let schema = [];
let config = {};
let monitors = [];
let binds = [];
let windowrules = [];
let execCommands = [];
let envVars = [];
let gestures = [];
let presets = [];
let activePreset = null;
let pendingChanges = {};
let activeTab = localStorage.getItem('hyprland_active_tab') || 'general';
let autosaveEnabled = localStorage.getItem('hyprland_autosave') === 'true';
let toastsEnabled = localStorage.getItem('hyprland_toasts') !== 'false'; // Default to true

// Special tabs that don't come from schema
const SPECIAL_TABS = [
    { id: 'monitors', title: 'Monitors', icon: '🖥️' },
    { id: 'binds', title: 'Keybinds', icon: '⌨️' },
    { id: 'gestures', title: 'Gestures', icon: '👆' },
    { id: 'windowrules', title: 'Window Rules', icon: '🪟' },
    { id: 'exec', title: 'Startup', icon: '🚀' },
    { id: 'env', title: 'Environment', icon: '🌍' }
];

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Load autosave toggle state
    const autosaveToggle = document.getElementById('autosave-toggle');
    if (autosaveToggle) {
        autosaveToggle.checked = autosaveEnabled;
    }

    await Promise.all([
        loadSchema(),
        loadConfig(),
        loadMonitors(),
        loadBinds(),
        loadWindowRules(),
        loadExec(),
        loadEnv(),
        loadGestures(),
        loadPresets()
    ]);
    renderTabs();
    renderTabContent(activeTab);
    renderPresetSelector();
});

function toggleAutosave(enabled) {
    autosaveEnabled = enabled;
    localStorage.setItem('hyprland_autosave', enabled ? 'true' : 'false');
    showToast(enabled ? 'Autosave enabled' : 'Autosave disabled', 'info');
}

async function loadSchema() {
    try {
        const response = await fetch('/hyprland/schema');
        const data = await response.json();
        schema = data.schema;
    } catch (error) {
        console.error('Failed to load schema:', error);
        showToast('Failed to load schema', 'error');
    }
}

async function loadConfig() {
    try {
        const response = await fetch('/hyprland/config');
        const data = await response.json();
        config = data.config;
    } catch (error) {
        console.error('Failed to load config:', error);
        showToast('Failed to load config', 'error');
    }
}

async function loadMonitors() {
    try {
        const response = await fetch('/hyprland/monitors');
        const data = await response.json();
        monitors = data.monitors;
    } catch (error) {
        console.error('Failed to load monitors:', error);
    }
}

async function loadBinds() {
    try {
        const response = await fetch('/hyprland/binds');
        const data = await response.json();
        binds = data.binds;
    } catch (error) {
        console.error('Failed to load binds:', error);
    }
}

async function loadWindowRules() {
    try {
        const response = await fetch('/hyprland/windowrules');
        const data = await response.json();
        windowrules = data.windowrules;
    } catch (error) {
        console.error('Failed to load window rules:', error);
    }
}

async function loadExec() {
    try {
        const response = await fetch('/hyprland/exec');
        const data = await response.json();
        execCommands = data.exec;
    } catch (error) {
        console.error('Failed to load exec commands:', error);
    }
}

async function loadEnv() {
    try {
        const response = await fetch('/hyprland/env');
        const data = await response.json();
        envVars = data.env;
    } catch (error) {
        console.error('Failed to load env vars:', error);
    }
}

async function loadGestures() {
    try {
        const response = await fetch('/hyprland/gestures');
        const data = await response.json();
        gestures = data.gestures || [];
    } catch (error) {
        console.error('Failed to load gestures:', error);
    }
}

// =============================================================================
// TAB RENDERING
// =============================================================================

function renderTabs() {
    const nav = document.getElementById('tab-nav');

    // Schema tabs
    const schemaTabs = schema.map(tab => `
        <button class="tab-btn ${tab.id === activeTab ? 'active' : ''}" 
                data-tab="${tab.id}" 
                onclick="switchTab('${tab.id}')">
            <span class="tab-icon">${tab.icon}</span>
            <span class="tab-label">${tab.title}</span>
        </button>
    `).join('');

    // Special tabs
    const specialTabs = SPECIAL_TABS.map(tab => `
        <button class="tab-btn ${tab.id === activeTab ? 'active' : ''}" 
                data-tab="${tab.id}" 
                onclick="switchTab('${tab.id}')">
            <span class="tab-icon">${tab.icon}</span>
            <span class="tab-label">${tab.title}</span>
        </button>
    `).join('');

    nav.innerHTML = schemaTabs + specialTabs;
}

function switchTab(tabId) {
    activeTab = tabId;
    localStorage.setItem('hyprland_active_tab', tabId);

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    renderTabContent(tabId);
}

function renderTabContent(tabId) {
    const content = document.getElementById('tab-content');

    // Handle special tabs
    switch (tabId) {
        case 'monitors':
            content.innerHTML = renderMonitorsTab();
            return;
        case 'binds':
            content.innerHTML = renderBindsTab();
            return;
        case 'gestures':
            content.innerHTML = renderGesturesTab();
            return;
        case 'windowrules':
            content.innerHTML = renderWindowRulesTab();
            return;
        case 'exec':
            content.innerHTML = renderExecTab();
            return;
        case 'env':
            content.innerHTML = renderEnvTab();
            return;
    }

    // Handle schema tabs
    const tab = schema.find(t => t.id === tabId);
    if (!tab) return;
    content.innerHTML = tab.sections.map(section => renderSection(section)).join('');
}

// =============================================================================
// SPECIAL TAB RENDERERS
// =============================================================================

function renderMonitorsTab() {
    return `
        <div class="config-section">
            <div class="section-header">
                <h3>Monitor Configuration</h3>
            </div>
            <div class="section-content monitors-list">
                ${monitors.length === 0 ? '<p class="empty-state">No monitors configured</p>' :
            monitors.map((m, i) => `
                    <div class="monitor-item">
                        <div class="monitor-name">${m.name}</div>
                        <div class="monitor-details">
                            <span class="monitor-res">${m.resolution || 'disabled'}</span>
                            ${m.position ? `<span class="monitor-pos">@ ${m.position}</span>` : ''}
                            ${m.scale ? `<span class="monitor-scale">×${m.scale}</span>` : ''}
                        </div>
                        <code class="monitor-raw">${m.raw}</code>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderBindsTab() {
    // Group binds by type
    const grouped = {};
    binds.forEach(b => {
        if (!grouped[b.type]) grouped[b.type] = [];
        grouped[b.type].push(b);
    });

    return `
        <div class="config-section">
            <div class="section-header">
                <h3>Keybinds (${binds.length})</h3>
                <button class="btn-add" onclick="showAddBindModal()">+ Add Keybind</button>
            </div>
            <div class="section-content binds-list">
                <table class="binds-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Mods</th>
                            <th>Key</th>
                            <th>Dispatcher</th>
                            <th>Params</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${binds.map(b => `
                            <tr>
                                <td><code>${b.type}</code></td>
                                <td>${b.mods || '-'}</td>
                                <td><code>${b.key}</code></td>
                                <td><strong>${b.dispatcher}</strong></td>
                                <td class="bind-params">${b.params || '-'}</td>
                                <td>
                                    <button class="action-btn edit" onclick="showEditBindModal('${b.type}', '${b.mods || ''}', '${b.key}', '${b.dispatcher}', '${(b.params || '').replace(/'/g, "\\'")}', '${b.raw.replace(/'/g, "\\'")}')">✏️</button>
                                    <button class="action-btn delete" onclick="confirmDeleteBind('${b.raw.replace(/'/g, "\\'")}')">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderGesturesTab() {
    return `
        <div class="config-section">
            <div class="section-header">
                <h3>Gesture Bindings (${gestures.length})</h3>
                <button class="btn-add" onclick="showAddGestureModal()">+ Add Gesture</button>
            </div>
            <div class="section-content binds-list">
                ${gestures.length === 0 ? '<p class="empty-state">No gesture bindings configured. Add a gesture like "3, horizontal, workspace" to enable touchpad swiping.</p>' : `
                <table class="binds-table">
                    <thead>
                        <tr>
                            <th>Fingers</th>
                            <th>Direction</th>
                            <th>Mod/Scale</th>
                            <th>Action</th>
                            <th>Params</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gestures.map(g => {
        const actionDisplay = g.action === 'dispatcher' ? `dispatcher: ${g.dispatcher}` : g.action;
        const modScale = [g.mod ? `mod: ${g.mod}` : '', g.scale ? `scale: ${g.scale}` : ''].filter(x => x).join(', ') || '-';
        return `
                            <tr>
                                <td><code>${g.fingers}</code></td>
                                <td>${g.direction}</td>
                                <td>${modScale}</td>
                                <td><strong>${actionDisplay}</strong></td>
                                <td class="bind-params">${g.params || '-'}</td>
                                <td>
                                    <button class="action-btn edit" onclick="showEditGestureModal('${g.fingers}', '${g.direction}', '${g.action}', '${(g.params || '').replace(/'/g, "\\'")}', '${g.raw.replace(/'/g, "\\'")}', '${(g.dispatcher || '').replace(/'/g, "\\'")}', '${(g.mod || '').replace(/'/g, "\\'")}', '${(g.scale || '').replace(/'/g, "\\'")}')">✏️</button>
                                    <button class="action-btn delete" onclick="confirmDeleteGesture('${g.raw.replace(/'/g, "\\'")}')">🗑️</button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>`}
            </div>
        </div>
    `;
}

function renderWindowRulesTab() {
    return `
        <div class="config-section">
            <div class="section-header">
                <h3>Window Rules (${windowrules.length})</h3>
                <button class="btn-add" onclick="showAddRuleModal()">+ Add Rule</button>
            </div>
            <div class="section-content rules-list">
            ${windowrules.length === 0 ? '<p class="empty-state">No window rules configured</p>' :
            windowrules.map(r => `
                    <div class="rule-item">
                        <code class="rule-type">${r.type}</code>
                        <span class="rule-effect">${r.effect}</span>
                        <span class="rule-match">${r.match}</span>
                        <div class="item-actions">
                            <button class="action-btn edit" onclick="showEditRuleModal('${r.type}', '${r.effect}', '${r.match.replace(/'/g, "\\'")}', '${r.raw.replace(/'/g, "\\'")}')">✏️</button>
                            <button class="action-btn delete" onclick="confirmDeleteRule('${r.raw.replace(/'/g, "\\'")}')">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderExecTab() {
    const execOnce = execCommands.filter(c => c.type === 'exec-once');
    const exec = execCommands.filter(c => c.type === 'exec');

    return `
        <div class="config-section">
            <div class="section-header">
                <h3>Startup Commands</h3>
                <button class="btn-add" onclick="showAddExecModal()">+ Add Command</button>
            </div>
            <div class="section-content exec-list">
                <h4 class="env-category-title">exec-once (Run at startup)</h4>
                ${execOnce.length === 0 ? '<p class="empty-state">No startup commands</p>' :
            execOnce.map(c => `
                    <div class="exec-item">
                        <code>${c.command}</code>
                        <div class="item-actions">
                            <button class="action-btn edit" onclick="showEditExecModal('${c.type}', '${c.command.replace(/'/g, "\\'")}')">✏️</button>
                            <button class="action-btn delete" onclick="confirmDeleteExec('${c.type}', '${c.command.replace(/'/g, "\\'")}')">🗑️</button>
                        </div>
                    </div>
                `).join('')}
                
                ${exec.length > 0 ? `
                <h4 class="env-category-title" style="margin-top: 1rem;">exec (Run at startup and reload)</h4>
                ${exec.map(c => `
                    <div class="exec-item">
                        <code>${c.command}</code>
                        <div class="item-actions">
                            <button class="action-btn edit" onclick="showEditExecModal('${c.type}', '${c.command.replace(/'/g, "\\'")}')">✏️</button>
                            <button class="action-btn delete" onclick="confirmDeleteExec('${c.type}', '${c.command.replace(/'/g, "\\'")}')">🗑️</button>
                        </div>
                    </div>
                `).join('')}` : ''}
            </div>
        </div>
    `;
}

function renderEnvTab() {
    // Group env vars by prefix/category
    const categories = {
        'GTK/GDK': [],
        'QT': [],
        'XDG': [],
        'XCURSOR': [],
        'NVIDIA': [],
        'AQ (Aquamarine)': [],
        'HYPRLAND': [],
        'Other': []
    };

    envVars.forEach(env => {
        const name = env.name.toUpperCase();
        if (name.startsWith('GTK') || name.startsWith('GDK')) {
            categories['GTK/GDK'].push(env);
        } else if (name.startsWith('QT')) {
            categories['QT'].push(env);
        } else if (name.startsWith('XDG')) {
            categories['XDG'].push(env);
        } else if (name.startsWith('XCURSOR')) {
            categories['XCURSOR'].push(env);
        } else if (name.includes('NVIDIA') || name.startsWith('__GL') || name === 'GBM_BACKEND' || name === 'LIBVA_DRIVER_NAME') {
            categories['NVIDIA'].push(env);
        } else if (name.startsWith('AQ_')) {
            categories['AQ (Aquamarine)'].push(env);
        } else if (name.startsWith('HYPRLAND')) {
            categories['HYPRLAND'].push(env);
        } else {
            categories['Other'].push(env);
        }
    });

    let html = `
        <div class="config-section">
            <div class="section-header">
                <h3>Environment Variables (${envVars.length})</h3>
                <button class="btn-add" onclick="showAddEnvModal()">+ Add Variable</button>
            </div>
            <div class="section-content env-list">
                ${envVars.length === 0 ? '<p class="empty-state">No environment variables configured</p>' : ''}
    `;

    // Render each category that has vars
    for (const [category, vars] of Object.entries(categories)) {
        if (vars.length > 0) {
            html += `
                <div class="env-category">
                    <h4 class="env-category-title">${category}</h4>
                    ${vars.map(env => `
                        <div class="env-item">
                            <span class="env-name">${env.name}</span>
                            <span class="env-value">${env.value}</span>
                            <div class="item-actions">
                                <button class="action-btn edit" onclick="showEditEnvModal('${env.name}', '${env.value.replace(/'/g, "\\'")}')">✏️</button>
                                <button class="action-btn delete" onclick="confirmDeleteEnv('${env.name}')">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

// =============================================================================
// SECTION RENDERING
// =============================================================================

function renderSection(section) {
    return `
        <div class="config-section">
            <div class="section-header">
                <h3>${section.title}</h3>
            </div>
            <div class="section-content">
                ${section.options.map(opt => renderOption(section.name, opt)).join('')}
            </div>
        </div>
    `;
}

function renderOption(sectionName, option) {
    const path = `${sectionName}:${option.name}`;
    const configValue = config[path];
    const value = configValue !== undefined ? configValue : option.default;
    const hasChange = path in pendingChanges;

    return `
        <div class="config-option ${hasChange ? 'changed' : ''}" data-path="${path}">
            <div class="option-info">
                <label class="option-label">${formatLabel(option.name)}</label>
                <span class="option-desc">${option.description}</span>
            </div>
            <div class="option-control">
                ${renderControl(path, option, value)}
            </div>
        </div>
    `;
}

function formatLabel(name) {
    return name
        .replace(/_/g, ' ')
        .replace(/\./g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// =============================================================================
// CONTROL RENDERING
// =============================================================================

function renderControl(path, option, value) {
    switch (option.type) {
        case 'bool':
            return renderToggle(path, value);
        case 'int':
        case 'float':
            if (option.min !== null && option.max !== null) {
                return renderSlider(path, option, value);
            }
            return renderNumberInput(path, option, value);
        case 'color':
        case 'gradient':
            return renderColorInput(path, value);
        case 'enum':
            return renderSelect(path, option, value);
        case 'vec2':
            return renderVec2Input(path, value);
        case 'string':
        default:
            return renderTextInput(path, value);
    }
}

function renderToggle(path, value) {
    const checked = value === true || value === 'true' || value === 'yes' || value === '1';
    return `
        <label class="toggle">
            <input type="checkbox" ${checked ? 'checked' : ''} 
                   onchange="updateValue('${path}', this.checked)">
            <span class="toggle-slider"></span>
        </label>
    `;
}

function renderSlider(path, option, value) {
    const parsed = parseFloat(value);
    const numValue = isNaN(parsed) ? option.default : parsed;
    const step = option.step || (option.type === 'float' ? 0.1 : 1);
    return `
        <div class="slider-control">
            <input type="range" 
                   min="${option.min}" max="${option.max}" step="${step}"
                   value="${numValue}"
                   oninput="updateSlider('${path}', this.value, this.parentElement)">
            <span class="slider-value">${numValue}</span>
        </div>
    `;
}

function renderNumberInput(path, option, value) {
    return `
        <input type="number" class="input-number" value="${value}"
               ${option.min !== null ? `min="${option.min}"` : ''}
               ${option.max !== null ? `max="${option.max}"` : ''}
               ${option.step ? `step="${option.step}"` : ''}
               onchange="updateValue('${path}', this.value)">
    `;
}

function renderColorInput(path, value) {
    // Convert hyprland color format to hex
    const hexColor = hyprColorToHex(value);
    return `
        <div class="color-control">
            <input type="color" value="${hexColor}" 
                   onchange="updateColor('${path}', this.value)">
            <input type="text" class="color-text" value="${value}"
                   onchange="updateValue('${path}', this.value)">
        </div>
    `;
}

function renderSelect(path, option, value) {
    return `
        <select class="input-select" onchange="updateValue('${path}', this.value)">
            ${option.choices.map(choice => `
                <option value="${choice}" ${value === choice ? 'selected' : ''}>
                    ${choice || '(none)'}
                </option>
            `).join('')}
        </select>
    `;
}

function renderVec2Input(path, value) {
    const parts = String(value).split(' ');
    const x = parts[0] || '0';
    const y = parts[1] || '0';
    return `
        <div class="vec2-control">
            <input type="number" class="input-number" value="${x}" placeholder="X"
                   onchange="updateVec2('${path}', this.value, null)">
            <input type="number" class="input-number" value="${y}" placeholder="Y"
                   onchange="updateVec2('${path}', null, this.value)">
        </div>
    `;
}

function renderTextInput(path, value) {
    return `
        <input type="text" class="input-text" value="${value}"
               onchange="updateValue('${path}', this.value)">
    `;
}

// =============================================================================
// VALUE UPDATES
// =============================================================================

function updateValue(path, value) {
    pendingChanges[path] = value;
    config[path] = value;
    markChanged(path);
    updateSaveButton();

    // Autosave with debounce
    if (autosaveEnabled) {
        debouncedSave();
    }
}

// Debounced save for autosave (500ms delay)
let saveTimeout = null;
function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await saveConfig();
        // If there's an active preset, also sync to it
        if (activePreset) {
            await syncToActivePreset();
        }
    }, 500);
}

function updateSlider(path, value, container) {
    const display = container.querySelector('.slider-value');
    if (display) display.textContent = value;
    updateValue(path, value);
}

function updateColor(path, hexValue) {
    // Convert hex to hyprland format
    const hyprColor = hexToHyprColor(hexValue);
    updateValue(path, hyprColor);

    // Update text input
    const option = document.querySelector(`[data-path="${path}"] .color-text`);
    if (option) option.value = hyprColor;
}

function updateVec2(path, x, y) {
    const current = String(config[path] || '0 0').split(' ');
    const newX = x !== null ? x : current[0];
    const newY = y !== null ? y : current[1];
    updateValue(path, `${newX} ${newY}`);
}

function markChanged(path) {
    const el = document.querySelector(`[data-path="${path}"]`);
    if (el) el.classList.add('changed');
}

function updateSaveButton() {
    const btn = document.getElementById('btn-save');
    const count = Object.keys(pendingChanges).length;
    if (count > 0) {
        btn.classList.add('has-changes');
        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save (${count})
        `;
    } else {
        btn.classList.remove('has-changes');
        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
        `;
    }

    // Also update preset selector to show change count
    renderPresetSelector();
}

// =============================================================================
// SAVE & RELOAD
// =============================================================================

async function saveConfig() {
    if (Object.keys(pendingChanges).length === 0) {
        showToast('No changes to save', 'info');
        return;
    }

    try {
        const response = await fetch('/hyprland/config/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: pendingChanges })
        });

        if (!response.ok) throw new Error('Failed to save');

        // Clear pending changes
        pendingChanges = {};
        document.querySelectorAll('.config-option.changed').forEach(el => {
            el.classList.remove('changed');
        });
        updateSaveButton();

        showToast('Configuration saved!', 'success');
    } catch (error) {
        console.error('Save failed:', error);
        showToast('Failed to save configuration', 'error');
    }
}

async function reloadHyprland() {
    try {
        const response = await fetch('/hyprland/reload', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            showToast('Hyprland reloaded!', 'success');
        } else {
            showToast('Reload failed', 'error');
        }
    } catch (error) {
        console.error('Reload failed:', error);
        showToast('Failed to reload Hyprland', 'error');
    }
}

// =============================================================================
// COLOR UTILITIES
// =============================================================================

function hyprColorToHex(color) {
    // Handle Hyprland formats:
    // - 0xAARRGGBB or 0xRRGGBB
    // - rgba(RRGGBBAA) - hex inside rgba!
    // - Gradients: rgba(33ccffee) rgba(8f00ffee) 45deg
    // - #RRGGBB

    if (!color || typeof color !== 'string') return '#ffffff';

    const colorStr = String(color).trim();
    if (!colorStr) return '#ffffff';

    // For gradients, just take the first color
    // e.g., "rgba(33ccffee) rgba(8f00ffee) 45deg" -> extract first rgba

    // 0xAARRGGBB format
    if (colorStr.startsWith('0x')) {
        const hex = colorStr.slice(2);
        if (hex.length === 8) {
            // AARRGGBB -> #RRGGBB (skip alpha)
            return '#' + hex.slice(2);
        }
        return '#' + hex.padStart(6, '0');
    }

    // Already hex with #
    if (colorStr.startsWith('#')) {
        return colorStr.slice(0, 7); // Take just 6 chars after #
    }

    // Hyprland rgba(RRGGBBAA) format - hex inside parentheses, NOT decimal RGB!
    const hyprRgbaMatch = colorStr.match(/rgba?\s*\(\s*([0-9a-fA-F]{6,8})\s*\)/);
    if (hyprRgbaMatch) {
        const hex = hyprRgbaMatch[1];
        // RRGGBBAA -> #RRGGBB (first 6 chars, skip alpha if present)
        return '#' + hex.slice(0, 6);
    }

    // Standard CSS rgba(r,g,b,a) with decimal values
    const cssRgbaMatch = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (cssRgbaMatch) {
        const r = Math.min(255, parseInt(cssRgbaMatch[1])).toString(16).padStart(2, '0');
        const g = Math.min(255, parseInt(cssRgbaMatch[2])).toString(16).padStart(2, '0');
        const b = Math.min(255, parseInt(cssRgbaMatch[3])).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    // Handle bare hex without prefix (e.g., "33ccff" or "33ccffee")
    const bareHexMatch = colorStr.match(/^([0-9a-fA-F]{6,8})/);
    if (bareHexMatch) {
        const hex = bareHexMatch[1];
        return '#' + hex.slice(0, 6);
    }

    return '#ffffff';
}

function hexToHyprColor(hex) {
    // #RRGGBB -> 0xffRRGGBB
    const rgb = hex.slice(1);
    return `0xff${rgb}`;
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

function showToast(message, type = 'info') {
    // Skip if toasts are disabled
    if (!toastsEnabled) return;

    const container = document.getElementById('toast-container');
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

// =============================================================================
// MODAL SYSTEM
// =============================================================================

function openModal(content) {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = content;
    overlay.classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// =============================================================================
// SETTINGS
// =============================================================================

function toggleToasts(enabled) {
    toastsEnabled = enabled;
    localStorage.setItem('hyprland_toasts', enabled ? 'true' : 'false');
    // Show one toast to confirm (even if disabling, show this one)
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.innerHTML = `<span>Toasts ${enabled ? 'enabled' : 'disabled'}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function showSettingsModal() {
    openModal(`
        <div class="modal-header">
            <h3>⚙️ Editor Settings</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="settings-list">
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-label">Show Toast Notifications</div>
                        <div class="setting-desc">Display popup messages for save, sync, and other actions</div>
                    </div>
                    <label class="toggle">
                        <input type="checkbox" ${toastsEnabled ? 'checked' : ''} onchange="toggleToasts(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-label">Autosave</div>
                        <div class="setting-desc">Automatically save changes as you edit</div>
                    </div>
                    <label class="toggle">
                        <input type="checkbox" ${autosaveEnabled ? 'checked' : ''} onchange="toggleAutosave(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Close</button>
        </div>
    `);
}

function confirmDialog(title, message, onConfirm) {
    openModal(`
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p>${message}</p>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-danger" onclick="(${onConfirm})(); closeModal();">Delete</button>
        </div>
    `);
}

// =============================================================================
// ENV VAR CRUD
// =============================================================================

function showAddEnvModal() {
    openModal(`
        <div class="modal-header">
            <h3>Add Environment Variable</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Variable Name</label>
                <input type="text" id="env-name" class="form-input" placeholder="e.g., GTK_THEME">
            </div>
            <div class="form-group">
                <label class="form-label">Value</label>
                <input type="text" id="env-value" class="form-input" placeholder="e.g., Nord">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="addEnvVar()">Add</button>
        </div>
    `);
}

async function addEnvVar() {
    const name = document.getElementById('env-name').value.trim();
    const value = document.getElementById('env-value').value.trim();
    if (!name) return showToast('Name is required', 'error');

    try {
        await fetch('/hyprland/env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', name, value })
        });
        closeModal();
        await loadEnv();
        renderTabContent('env');
        showToast('Environment variable added', 'success');
    } catch (e) {
        showToast('Failed to add', 'error');
    }
}

function showEditEnvModal(name, value) {
    openModal(`
        <div class="modal-header">
            <h3>Edit Environment Variable</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Variable Name</label>
                <input type="text" id="env-name" class="form-input" value="${name}">
            </div>
            <div class="form-group">
                <label class="form-label">Value</label>
                <input type="text" id="env-value" class="form-input" value="${value}">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="updateEnvVar('${name}')">Save</button>
        </div>
    `);
}

async function updateEnvVar(oldName) {
    const name = document.getElementById('env-name').value.trim();
    const value = document.getElementById('env-value').value.trim();

    try {
        await fetch('/hyprland/env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', name, value, old_name: oldName })
        });
        closeModal();
        await loadEnv();
        renderTabContent('env');
        showToast('Environment variable updated', 'success');
    } catch (e) {
        showToast('Failed to update', 'error');
    }
}

async function deleteEnvVar(name) {
    try {
        await fetch('/hyprland/env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', name, value: '' })
        });
        await loadEnv();
        renderTabContent('env');
        showToast('Environment variable deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteEnv(name) {
    confirmDialog('Delete Environment Variable',
        `Are you sure you want to delete "${name}"?`,
        `function() { deleteEnvVar('${name}') }`);
}

// =============================================================================
// EXEC COMMANDS CRUD
// =============================================================================

function showAddExecModal() {
    openModal(`
        <div class="modal-header">
            <h3>Add Startup Command</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Type</label>
                <select id="exec-type" class="form-select">
                    <option value="exec-once">exec-once (Run at startup)</option>
                    <option value="exec">exec (Run at startup and reload)</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Command</label>
                <input type="text" id="exec-command" class="form-input" placeholder="e.g., waybar">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="addExecCommand()">Add</button>
        </div>
    `);
}

async function addExecCommand() {
    const type = document.getElementById('exec-type').value;
    const command = document.getElementById('exec-command').value.trim();
    if (!command) return showToast('Command is required', 'error');

    try {
        await fetch('/hyprland/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', type, command })
        });
        closeModal();
        await loadExec();
        renderTabContent('exec');
        showToast('Command added', 'success');
    } catch (e) {
        showToast('Failed to add', 'error');
    }
}

async function deleteExecCommand(type, command) {
    try {
        await fetch('/hyprland/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', type, command })
        });
        await loadExec();
        renderTabContent('exec');
        showToast('Command deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteExec(type, command) {
    const escapedCmd = command.replace(/'/g, "\\'");
    confirmDialog('Delete Command',
        `Are you sure you want to delete this command?`,
        `function() { deleteExecCommand('${type}', '${escapedCmd}') }`);
}

function showEditExecModal(type, command) {
    const escapedCmd = command.replace(/"/g, '&quot;');
    openModal(`
        <div class="modal-header">
            <h3>Edit Startup Command</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Type</label>
                <select id="exec-type" class="form-select">
                    <option value="exec-once" ${type === 'exec-once' ? 'selected' : ''}>exec-once (Run at startup)</option>
                    <option value="exec" ${type === 'exec' ? 'selected' : ''}>exec (Run at startup and reload)</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Command</label>
                <input type="text" id="exec-command" class="form-input" value="${escapedCmd}">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="updateExecCommand('${type}', '${command.replace(/'/g, "\\'")}')">Save</button>
        </div>
    `);
}

async function updateExecCommand(oldType, oldCommand) {
    const type = document.getElementById('exec-type').value;
    const command = document.getElementById('exec-command').value.trim();
    if (!command) return showToast('Command is required', 'error');

    try {
        await fetch('/hyprland/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', type, command, old_command: oldCommand })
        });
        closeModal();
        await loadExec();
        renderTabContent('exec');
        showToast('Command updated', 'success');
    } catch (e) {
        showToast('Failed to update', 'error');
    }
}

// =============================================================================
// WINDOW RULES CRUD
// =============================================================================

let openWindows = [];

async function loadOpenWindows() {
    try {
        const response = await fetch('/hyprland/windows');
        const data = await response.json();
        openWindows = data.windows || [];
    } catch (e) {
        openWindows = [];
    }
}

function showAddRuleModal() {
    loadOpenWindows().then(() => {
        const windowOptions = openWindows.map(w =>
            `<option value="${w.class}">${w.class} - ${w.title.substring(0, 40)}</option>`
        ).join('');

        openModal(`
            <div class="modal-header">
                <h3>Add Window Rule</h3>
                <button class="modal-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="rule-type" value="windowrule">
                <div class="form-group">
                    <label class="form-label">Effect</label>
                    <select id="rule-effect" class="form-select">
                        <option value="float">float</option>
                        <option value="tile">tile</option>
                        <option value="fullscreen">fullscreen</option>
                        <option value="maximize">maximize</option>
                        <option value="nofocus">nofocus</option>
                        <option value="pin">pin</option>
                        <option value="opacity 0.9">opacity 0.9</option>
                        <option value="noborder">noborder</option>
                        <option value="noshadow">noshadow</option>
                        <option value="noblur">noblur</option>
                        <option value="center">center</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Match Window (select from open)</label>
                    <select id="rule-window-select" class="form-select" onchange="document.getElementById('rule-match').value = this.value ? 'class:' + this.value : ''">
                        <option value="">-- Choose window --</option>
                        ${windowOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Or enter match manually</label>
                    <input type="text" id="rule-match" class="form-input" placeholder="e.g., class:firefox">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button class="btn-add" onclick="addWindowRule()">Add</button>
            </div>
        `);
    });
}

async function addWindowRule() {
    const type = document.getElementById('rule-type').value;
    const effect = document.getElementById('rule-effect').value;
    const match = document.getElementById('rule-match').value.trim();
    if (!match) return showToast('Match criteria is required', 'error');

    try {
        await fetch('/hyprland/windowrules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', type, effect, match })
        });
        closeModal();
        await loadWindowRules();
        renderTabContent('windowrules');
        showToast('Window rule added', 'success');
    } catch (e) {
        showToast('Failed to add', 'error');
    }
}

async function deleteWindowRule(raw) {
    try {
        await fetch('/hyprland/windowrules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', type: '', effect: '', match: '', old_raw: raw })
        });
        await loadWindowRules();
        renderTabContent('windowrules');
        showToast('Window rule deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteRule(raw) {
    const escapedRaw = raw.replace(/'/g, "\\'");
    confirmDialog('Delete Window Rule',
        `Are you sure you want to delete this rule?`,
        `function() { deleteWindowRule('${escapedRaw}') }`);
}

function showEditRuleModal(type, effect, match, raw) {
    const escapedMatch = match.replace(/"/g, '&quot;');
    const escapedRaw = raw.replace(/'/g, "\\'");

    openModal(`
        <div class="modal-header">
            <h3>Edit Window Rule</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="rule-type" value="windowrule">
            <div class="form-group">
                <label class="form-label">Effect</label>
                <input type="text" id="rule-effect" class="form-input" value="${effect}">
            </div>
            <div class="form-group">
                <label class="form-label">Match</label>
                <input type="text" id="rule-match" class="form-input" value="${escapedMatch}">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="updateWindowRule('${escapedRaw}')">Save</button>
        </div>
    `);
}

async function updateWindowRule(oldRaw) {
    const type = document.getElementById('rule-type').value;
    const effect = document.getElementById('rule-effect').value.trim();
    const match = document.getElementById('rule-match').value.trim();
    if (!effect || !match) return showToast('Effect and match are required', 'error');

    try {
        await fetch('/hyprland/windowrules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', type, effect, match, old_raw: oldRaw })
        });
        closeModal();
        await loadWindowRules();
        renderTabContent('windowrules');
        showToast('Window rule updated', 'success');
    } catch (e) {
        showToast('Failed to update', 'error');
    }
}

// =============================================================================
// KEYBINDS CRUD
// =============================================================================

let capturedMods = [];
let capturedKey = '';

// Dispatcher definitions with descriptions and param hints
const DISPATCHERS = {
    // Commands
    exec: { desc: "Execute shell command", param: "command (e.g., kitty, firefox)", category: "Commands" },
    execr: { desc: "Execute raw shell command", param: "command", category: "Commands" },
    pass: { desc: "Pass key to window", param: "window", category: "Commands" },
    sendshortcut: { desc: "Send keys to window", param: "mod, key[, window]", category: "Commands" },
    global: { desc: "Execute Global Shortcut", param: "name", category: "Commands" },

    // Window Actions
    killactive: { desc: "Close active window", param: "none", category: "Window Actions" },
    forcekillactive: { desc: "Force kill active window", param: "none", category: "Window Actions" },
    closewindow: { desc: "Close specified window", param: "window", category: "Window Actions" },
    togglefloating: { desc: "Toggle floating state", param: "empty/window", category: "Window Actions" },
    setfloating: { desc: "Set floating", param: "empty/window", category: "Window Actions" },
    settiled: { desc: "Set tiled", param: "empty/window", category: "Window Actions" },
    fullscreen: { desc: "Toggle fullscreen", param: "0=full, 1=maximize", category: "Window Actions" },
    pin: { desc: "Pin window to all workspaces", param: "empty/window", category: "Window Actions" },
    centerwindow: { desc: "Center floating window", param: "none/1", category: "Window Actions" },

    // Focus & Movement
    movefocus: { desc: "Move focus direction", param: "l/r/u/d", category: "Focus & Movement" },
    movewindow: { desc: "Move window direction/monitor", param: "l/r/u/d or mon:NAME", category: "Focus & Movement" },
    swapwindow: { desc: "Swap with window in direction", param: "l/r/u/d or window", category: "Focus & Movement" },
    focuswindow: { desc: "Focus specific window", param: "window (class:, title:, etc)", category: "Focus & Movement" },
    focusmonitor: { desc: "Focus a monitor", param: "monitor (l/r/+1/-1/name)", category: "Focus & Movement" },
    cyclenext: { desc: "Focus next/prev window", param: "none/prev/tiled/floating", category: "Focus & Movement" },
    swapnext: { desc: "Swap with next window", param: "none/prev", category: "Focus & Movement" },
    bringactivetotop: { desc: "Bring window to top", param: "none", category: "Focus & Movement" },
    alterzorder: { desc: "Change window stack order", param: "top/bottom[,window]", category: "Focus & Movement" },

    // Workspaces
    workspace: { desc: "Switch workspace", param: "ID/+1/-1/name:X/special", category: "Workspaces" },
    movetoworkspace: { desc: "Move window to workspace", param: "workspace[,window]", category: "Workspaces" },
    movetoworkspacesilent: { desc: "Move without switching", param: "workspace[,window]", category: "Workspaces" },
    togglespecialworkspace: { desc: "Toggle scratchpad", param: "none/name", category: "Workspaces" },
    focusworkspaceoncurrentmonitor: { desc: "Focus workspace on current", param: "workspace", category: "Workspaces" },
    movecurrentworkspacetomonitor: { desc: "Move workspace to monitor", param: "monitor", category: "Workspaces" },
    swapactiveworkspaces: { desc: "Swap workspaces between monitors", param: "monitor1 monitor2", category: "Workspaces" },

    // Resize & Position
    resizeactive: { desc: "Resize active window", param: "X Y (e.g., 10 -10, 20%)", category: "Resize" },
    moveactive: { desc: "Move active window", param: "X Y", category: "Resize" },
    resizewindowpixel: { desc: "Resize specific window", param: "X Y,window", category: "Resize" },
    movewindowpixel: { desc: "Move specific window", param: "X Y,window", category: "Resize" },
    splitratio: { desc: "Change split ratio", param: "+0.1/-0.1/exact 0.5", category: "Resize" },

    // Groups
    togglegroup: { desc: "Toggle window group", param: "none", category: "Groups" },
    changegroupactive: { desc: "Switch in group", param: "b/f or index", category: "Groups" },
    lockgroups: { desc: "Lock all groups", param: "lock/unlock/toggle", category: "Groups" },
    lockactivegroup: { desc: "Lock current group", param: "lock/unlock/toggle", category: "Groups" },
    moveintogroup: { desc: "Move into group", param: "l/r/u/d", category: "Groups" },
    moveoutofgroup: { desc: "Move out of group", param: "empty/window", category: "Groups" },

    // System
    exit: { desc: "Exit Hyprland", param: "none", category: "System" },
    dpms: { desc: "Toggle DPMS", param: "on/off/toggle", category: "System" },
    forcerendererreload: { desc: "Reload renderer", param: "none", category: "System" },
    submap: { desc: "Switch submap", param: "reset/name", category: "System" },

    // Layout (Dwindle/Master)
    togglesplit: { desc: "Toggle split orientation", param: "none", category: "Layout" },
    pseudo: { desc: "Toggle pseudo-tiling", param: "none", category: "Layout" },
    layoutmsg: { desc: "Send layout message", param: "message", category: "Layout" },
};

function getDispatcherOptions() {
    const categories = {};
    for (const [name, info] of Object.entries(DISPATCHERS)) {
        if (!categories[info.category]) categories[info.category] = [];
        categories[info.category].push({ name, desc: info.desc });
    }

    let html = '';
    for (const [cat, items] of Object.entries(categories)) {
        html += `<optgroup label="${cat}">`;
        html += items.map(d => `<option value="${d.name}">${d.name} - ${d.desc}</option>`).join('');
        html += '</optgroup>';
    }
    return html;
}

function updateParamHint() {
    const dispatcher = document.getElementById('bind-dispatcher').value;
    const hint = document.getElementById('param-hint');
    const info = DISPATCHERS[dispatcher];
    if (hint && info) {
        hint.textContent = `Parameter: ${info.param}`;
    }
}

function showAddBindModal() {
    capturedMods = [];
    capturedKey = '';

    openModal(`
        <div class="modal-header">
            <h3>Add Keybind</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Press your key combination</label>
                <div id="key-capture-box" class="key-capture-box" tabindex="0" onkeydown="captureKey(event)">
                    <div class="key-capture-display" id="key-display">Click here and press keys</div>
                    <div class="key-capture-hint">Hold modifiers (SUPER, ALT, CTRL, SHIFT) and press a key</div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Bind Type</label>
                <select id="bind-type" class="form-select">
                    <option value="bind">bind - Normal keybind</option>
                    <option value="binde">binde - Repeat while held</option>
                    <option value="bindm">bindm - Mouse bind</option>
                    <option value="bindl">bindl - Works when locked</option>
                    <option value="bindr">bindr - On key release</option>
                    <option value="bindel">bindel - Repeat + locked</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Dispatcher (Action)</label>
                <select id="bind-dispatcher" class="form-select" onchange="updateParamHint()">
                    ${getDispatcherOptions()}
                </select>
                <small id="param-hint" class="form-hint">Parameter: command (e.g., kitty, firefox)</small>
            </div>
            <div class="form-group">
                <label class="form-label">Parameters</label>
                <input type="text" id="bind-params" class="form-input" placeholder="Enter parameters based on dispatcher">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="addBind()">Add</button>
        </div>
    `);

    setTimeout(() => document.getElementById('key-capture-box').focus(), 100);
}

function captureKey(event) {
    event.preventDefault();

    const mods = [];
    if (event.metaKey || event.key === 'Super' || event.key === 'Meta') mods.push('SUPER');
    if (event.altKey) mods.push('ALT');
    if (event.ctrlKey) mods.push('CTRL');
    if (event.shiftKey) mods.push('SHIFT');

    let key = event.key.toUpperCase();

    // Filter out modifier keys themselves
    if (['CONTROL', 'ALT', 'SHIFT', 'META', 'SUPER'].includes(key)) {
        capturedMods = mods;
        document.getElementById('key-display').textContent = mods.join(' + ') + ' + ...';
        return;
    }

    // Map special keys
    const keyMap = {
        ' ': 'SPACE',
        'ARROWUP': 'UP',
        'ARROWDOWN': 'DOWN',
        'ARROWLEFT': 'LEFT',
        'ARROWRIGHT': 'RIGHT',
        'ENTER': 'RETURN',
        'ESCAPE': 'ESCAPE'
    };
    key = keyMap[key] || key;

    capturedMods = mods;
    capturedKey = key;

    const display = mods.length > 0 ? mods.join(' + ') + ' + ' + key : key;
    document.getElementById('key-display').textContent = display;
    document.getElementById('key-capture-box').classList.add('capturing');
}

async function addBind() {
    if (!capturedKey) return showToast('Please capture a key combination', 'error');

    const type = document.getElementById('bind-type').value;
    const mods = capturedMods.join('');
    const dispatcher = document.getElementById('bind-dispatcher').value;
    const params = document.getElementById('bind-params').value.trim();

    try {
        await fetch('/hyprland/binds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'add',
                type,
                mods,
                key: capturedKey,
                dispatcher,
                params
            })
        });
        closeModal();
        await loadBinds();
        renderTabContent('binds');
        showToast('Keybind added', 'success');
    } catch (e) {
        showToast('Failed to add', 'error');
    }
}

async function deleteBind(raw) {
    try {
        await fetch('/hyprland/binds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', type: '', mods: '', key: '', dispatcher: '', old_raw: raw })
        });
        await loadBinds();
        renderTabContent('binds');
        showToast('Keybind deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteBind(raw) {
    const escapedRaw = raw.replace(/'/g, "\\'");
    confirmDialog('Delete Keybind',
        `Are you sure you want to delete this keybind?`,
        `function() { deleteBind('${escapedRaw}') }`);
}

function getDispatcherOptionsWithSelected(selected) {
    const categories = {};
    for (const [name, info] of Object.entries(DISPATCHERS)) {
        if (!categories[info.category]) categories[info.category] = [];
        categories[info.category].push({ name, desc: info.desc });
    }

    let html = '';
    for (const [cat, items] of Object.entries(categories)) {
        html += `<optgroup label="${cat}">`;
        html += items.map(d => `<option value="${d.name}" ${d.name === selected ? 'selected' : ''}>${d.name} - ${d.desc}</option>`).join('');
        html += '</optgroup>';
    }
    return html;
}

function showEditBindModal(type, mods, key, dispatcher, params, raw) {
    const escapedRaw = raw.replace(/'/g, "\\'");
    const escapedParams = (params || '').replace(/"/g, '&quot;');

    // Pre-set captured values for display
    capturedMods = mods ? mods.match(/(SUPER|ALT|CTRL|SHIFT)/g) || [] : [];
    capturedKey = key;

    const modsDisplay = capturedMods.length > 0 ? capturedMods.join(' + ') + ' + ' + key : key;
    const paramHint = DISPATCHERS[dispatcher]?.param || 'parameters';

    openModal(`
        <div class="modal-header">
            <h3>Edit Keybind</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Press your key combination</label>
                <div id="key-capture-box" class="key-capture-box capturing" tabindex="0" onkeydown="captureKey(event)">
                    <div class="key-capture-display" id="key-display">${modsDisplay}</div>
                    <div class="key-capture-hint">Click and press new keys to change</div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Bind Type</label>
                <select id="bind-type" class="form-select">
                    <option value="bind" ${type === 'bind' ? 'selected' : ''}>bind - Normal keybind</option>
                    <option value="binde" ${type === 'binde' ? 'selected' : ''}>binde - Repeat while held</option>
                    <option value="bindm" ${type === 'bindm' ? 'selected' : ''}>bindm - Mouse bind</option>
                    <option value="bindl" ${type === 'bindl' ? 'selected' : ''}>bindl - Works when locked</option>
                    <option value="bindr" ${type === 'bindr' ? 'selected' : ''}>bindr - On key release</option>
                    <option value="bindel" ${type === 'bindel' ? 'selected' : ''}>bindel - Repeat + locked</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Dispatcher (Action)</label>
                <select id="bind-dispatcher" class="form-select" onchange="updateParamHint()">
                    ${getDispatcherOptionsWithSelected(dispatcher)}
                </select>
                <small id="param-hint" class="form-hint">Parameter: ${paramHint}</small>
            </div>
            <div class="form-group">
                <label class="form-label">Parameters</label>
                <input type="text" id="bind-params" class="form-input" value="${escapedParams}">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="updateBind('${escapedRaw}')">Save</button>
        </div>
    `);

    setTimeout(() => document.getElementById('key-capture-box').focus(), 100);
}

async function updateBind(oldRaw) {
    if (!capturedKey) return showToast('Key is required', 'error');

    const type = document.getElementById('bind-type').value;
    const mods = capturedMods.join('');
    const dispatcher = document.getElementById('bind-dispatcher').value;
    const params = document.getElementById('bind-params').value.trim();

    try {
        await fetch('/hyprland/binds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update',
                type,
                mods,
                key: capturedKey,
                dispatcher,
                params,
                old_raw: oldRaw
            })
        });
        closeModal();
        await loadBinds();
        renderTabContent('binds');
        showToast('Keybind updated', 'success');
    } catch (e) {
        showToast('Failed to update', 'error');
    }
}

// =============================================================================
// GESTURE CRUD
// =============================================================================

// Get gesture action options for select dropdown
function getGestureActionOptions(selected = '') {
    const actions = [
        { value: 'workspace', desc: 'Workspace swipe gesture' },
        { value: 'move', desc: 'Move active window' },
        { value: 'resize', desc: 'Resize active window' },
        { value: 'special', desc: 'Toggle special workspace' },
        { value: 'close', desc: 'Close active window' },
        { value: 'fullscreen', desc: 'Fullscreen (none or maximize)' },
        { value: 'float', desc: 'Float window (toggle/float/tile)' },
        { value: 'dispatcher', desc: 'Run a dispatcher' },
        { value: 'unset', desc: 'Unset a gesture' }
    ];
    return actions.map(a =>
        `<option value="${a.value}" ${a.value === selected ? 'selected' : ''}>${a.value} - ${a.desc}</option>`
    ).join('');
}

function toggleGestureDispatcher() {
    const action = document.getElementById('gesture-action').value;
    const dispatcherGroup = document.getElementById('gesture-dispatcher-group');
    const paramsGroup = document.getElementById('gesture-params-group');
    const paramsLabel = document.getElementById('gesture-params-label');

    if (action === 'dispatcher') {
        dispatcherGroup.style.display = 'block';
        paramsLabel.textContent = 'Dispatcher Parameters';
        updateGestureParamHint();
    } else {
        dispatcherGroup.style.display = 'none';
        // Update params label based on action
        const hints = {
            'workspace': 'Parameters (none needed)',
            'move': 'Parameters (none needed)',
            'resize': 'Parameters (none needed)',
            'special': 'Special workspace name (e.g., mySpecialWorkspace)',
            'close': 'Parameters (none needed)',
            'fullscreen': 'Parameters (none or "maximize")',
            'float': 'Parameters (none, "float", or "tile")',
            'unset': 'Parameters (none needed)'
        };
        paramsLabel.textContent = hints[action] || 'Parameters';
    }
}

function updateGestureParamHint() {
    const dispatcher = document.getElementById('gesture-dispatcher')?.value;
    const hint = document.getElementById('gesture-param-hint');
    const info = DISPATCHERS[dispatcher];
    if (hint && info) {
        hint.textContent = `Parameter: ${info.param}`;
    }
}

function showAddGestureModal() {
    openModal(`
        <div class="modal-header">
            <h3>Add Gesture</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Number of Fingers</label>
                <select id="gesture-fingers" class="form-select">
                    <option value="3">3 fingers</option>
                    <option value="4">4 fingers</option>
                    <option value="5">5 fingers</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Direction</label>
                <select id="gesture-direction" class="form-select">
                    <option value="swipe">swipe (any swipe)</option>
                    <option value="horizontal">horizontal</option>
                    <option value="vertical">vertical</option>
                    <option value="left">left</option>
                    <option value="right">right</option>
                    <option value="up">up</option>
                    <option value="down">down</option>
                    <option value="pinch">pinch (any pinch)</option>
                    <option value="pinchin">pinchin</option>
                    <option value="pinchout">pinchout</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Modifier (optional)</label>
                <select id="gesture-mod" class="form-select">
                    <option value="">None</option>
                    <option value="SUPER">SUPER</option>
                    <option value="ALT">ALT</option>
                    <option value="CTRL">CTRL</option>
                    <option value="SHIFT">SHIFT</option>
                    <option value="SUPER_ALT">SUPER + ALT</option>
                    <option value="SUPER_CTRL">SUPER + CTRL</option>
                    <option value="SUPER_SHIFT">SUPER + SHIFT</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Scale (optional, e.g., 1.5)</label>
                <input type="text" id="gesture-scale" class="form-input" placeholder="Leave empty for default">
            </div>
            <div class="form-group">
                <label class="form-label">Action</label>
                <select id="gesture-action" class="form-select" onchange="toggleGestureDispatcher()">
                    ${getGestureActionOptions()}
                </select>
            </div>
            <div class="form-group" id="gesture-dispatcher-group" style="display: none;">
                <label class="form-label">Dispatcher</label>
                <select id="gesture-dispatcher" class="form-select" onchange="updateGestureParamHint()">
                    ${getDispatcherOptions()}
                </select>
                <small id="gesture-param-hint" class="form-hint">Parameter: command (e.g., kitty, firefox)</small>
            </div>
            <div class="form-group" id="gesture-params-group">
                <label class="form-label" id="gesture-params-label">Parameters (none needed)</label>
                <input type="text" id="gesture-params" class="form-input" placeholder="e.g., special workspace name">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="addGesture()">Add</button>
        </div>
    `);
}

async function addGesture() {
    const fingers = document.getElementById('gesture-fingers').value;
    const direction = document.getElementById('gesture-direction').value;
    const gestureAction = document.getElementById('gesture-action').value;
    const mod = document.getElementById('gesture-mod').value;
    const scale = document.getElementById('gesture-scale').value.trim();
    const isDispatcher = gestureAction === 'dispatcher';

    let params;
    let dispatcher = '';

    if (isDispatcher) {
        dispatcher = document.getElementById('gesture-dispatcher').value;
        params = document.getElementById('gesture-params').value.trim();
    } else {
        params = document.getElementById('gesture-params').value.trim();
    }

    try {
        await fetch('/hyprland/gestures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'add',
                fingers: parseInt(fingers),
                direction,
                gesture_action: gestureAction,
                dispatcher,
                params,
                mod,
                scale
            })
        });
        closeModal();
        await loadGestures();
        renderTabContent('gestures');
        showToast('Gesture added', 'success');
    } catch (e) {
        showToast('Failed to add', 'error');
    }
}

function showEditGestureModal(fingers, direction, gestureAction, params, raw, dispatcher = '', mod = '', scale = '') {
    const escapedRaw = raw.replace(/'/g, "\\'");
    const escapedParams = (params || '').replace(/"/g, '&quot;');
    const isDispatcher = gestureAction === 'dispatcher';

    openModal(`
        <div class="modal-header">
            <h3>Edit Gesture</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Number of Fingers</label>
                <select id="gesture-fingers" class="form-select">
                    <option value="3" ${fingers == '3' ? 'selected' : ''}>3 fingers</option>
                    <option value="4" ${fingers == '4' ? 'selected' : ''}>4 fingers</option>
                    <option value="5" ${fingers == '5' ? 'selected' : ''}>5 fingers</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Direction</label>
                <select id="gesture-direction" class="form-select">
                    <option value="swipe" ${direction === 'swipe' ? 'selected' : ''}>swipe (any swipe)</option>
                    <option value="horizontal" ${direction === 'horizontal' ? 'selected' : ''}>horizontal</option>
                    <option value="vertical" ${direction === 'vertical' ? 'selected' : ''}>vertical</option>
                    <option value="left" ${direction === 'left' ? 'selected' : ''}>left</option>
                    <option value="right" ${direction === 'right' ? 'selected' : ''}>right</option>
                    <option value="up" ${direction === 'up' ? 'selected' : ''}>up</option>
                    <option value="down" ${direction === 'down' ? 'selected' : ''}>down</option>
                    <option value="pinch" ${direction === 'pinch' ? 'selected' : ''}>pinch (any pinch)</option>
                    <option value="pinchin" ${direction === 'pinchin' ? 'selected' : ''}>pinchin</option>
                    <option value="pinchout" ${direction === 'pinchout' ? 'selected' : ''}>pinchout</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Modifier (optional)</label>
                <select id="gesture-mod" class="form-select">
                    <option value="" ${!mod ? 'selected' : ''}>None</option>
                    <option value="SUPER" ${mod === 'SUPER' ? 'selected' : ''}>SUPER</option>
                    <option value="ALT" ${mod === 'ALT' ? 'selected' : ''}>ALT</option>
                    <option value="CTRL" ${mod === 'CTRL' ? 'selected' : ''}>CTRL</option>
                    <option value="SHIFT" ${mod === 'SHIFT' ? 'selected' : ''}>SHIFT</option>
                    <option value="SUPER_ALT" ${mod === 'SUPER_ALT' ? 'selected' : ''}>SUPER + ALT</option>
                    <option value="SUPER_CTRL" ${mod === 'SUPER_CTRL' ? 'selected' : ''}>SUPER + CTRL</option>
                    <option value="SUPER_SHIFT" ${mod === 'SUPER_SHIFT' ? 'selected' : ''}>SUPER + SHIFT</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Scale (optional, e.g., 1.5)</label>
                <input type="text" id="gesture-scale" class="form-input" value="${scale}" placeholder="Leave empty for default">
            </div>
            <div class="form-group">
                <label class="form-label">Action</label>
                <select id="gesture-action" class="form-select" onchange="toggleGestureDispatcher()">
                    ${getGestureActionOptions(gestureAction)}
                </select>
            </div>
            <div class="form-group" id="gesture-dispatcher-group" style="display: ${isDispatcher ? 'block' : 'none'};">
                <label class="form-label">Dispatcher</label>
                <select id="gesture-dispatcher" class="form-select" onchange="updateGestureParamHint()">
                    ${getDispatcherOptionsWithSelected(dispatcher)}
                </select>
                <small id="gesture-param-hint" class="form-hint">Parameter: ${DISPATCHERS[dispatcher]?.param || 'parameters'}</small>
            </div>
            <div class="form-group" id="gesture-params-group">
                <label class="form-label" id="gesture-params-label">${isDispatcher ? 'Dispatcher Parameters' : 'Parameters'}</label>
                <input type="text" id="gesture-params" class="form-input" value="${escapedParams}">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="updateGesture('${escapedRaw}')">Save</button>
        </div>
    `);
}

async function updateGesture(oldRaw) {
    const fingers = document.getElementById('gesture-fingers').value;
    const direction = document.getElementById('gesture-direction').value;
    const gestureAction = document.getElementById('gesture-action').value;
    const mod = document.getElementById('gesture-mod').value;
    const scale = document.getElementById('gesture-scale').value.trim();
    const isDispatcher = gestureAction === 'dispatcher';

    let params;
    let dispatcher = '';

    if (isDispatcher) {
        dispatcher = document.getElementById('gesture-dispatcher').value;
        params = document.getElementById('gesture-params').value.trim();
    } else {
        params = document.getElementById('gesture-params').value.trim();
    }

    try {
        await fetch('/hyprland/gestures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update',
                fingers: parseInt(fingers),
                direction,
                gesture_action: gestureAction,
                dispatcher,
                params,
                mod,
                scale,
                old_raw: oldRaw
            })
        });
        closeModal();
        await loadGestures();
        renderTabContent('gestures');
        showToast('Gesture updated', 'success');
    } catch (e) {
        showToast('Failed to update', 'error');
    }
}

async function deleteGesture(raw) {
    try {
        await fetch('/hyprland/gestures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', fingers: 0, direction: '', gesture_action: '', old_raw: raw })
        });
        await loadGestures();
        renderTabContent('gestures');
        showToast('Gesture deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteGesture(raw) {
    const escapedRaw = raw.replace(/'/g, "\\'");
    confirmDialog('Delete Gesture',
        `Are you sure you want to delete this gesture?`,
        `function() { deleteGesture('${escapedRaw}') }`);
}

// =============================================================================
// PRESETS
// =============================================================================

async function loadPresets() {
    try {
        const response = await fetch('/presets/hyprland');
        const data = await response.json();
        presets = data.presets || [];
        activePreset = data.active_preset;
    } catch (error) {
        console.error('Failed to load presets:', error);
        presets = [];
        activePreset = null;
    }
}

function renderPresetSelector() {
    // Find or create preset container in the page
    let container = document.getElementById('preset-selector-container');

    // If no container exists, try to add it to the header area
    if (!container) {
        const header = document.querySelector('.page-header') || document.querySelector('.config-header');
        if (header) {
            container = document.createElement('div');
            container.id = 'preset-selector-container';
            container.className = 'preset-selector-container';
            header.appendChild(container);
        } else {
            // Create before tab navigation as fallback
            const tabNav = document.getElementById('tab-nav');
            if (tabNav) {
                container = document.createElement('div');
                container.id = 'preset-selector-container';
                container.className = 'preset-selector-container';
                tabNav.parentElement.insertBefore(container, tabNav);
            } else {
                return; // No suitable location found
            }
        }
    }

    const activePresetData = presets.find(p => p.id === activePreset);
    const changeCount = Object.keys(pendingChanges).length;
    const hasChanges = changeCount > 0;

    container.innerHTML = `
        <div class="preset-selector">
            <div class="preset-current">
                <span class="preset-label">Preset:</span>
                <select id="preset-dropdown" onchange="handlePresetChange(this.value)">
                    <option value="">-- No Preset --</option>
                    ${presets.map(p => `
                        <option value="${p.id}" ${p.id === activePreset ? 'selected' : ''}>
                            ${p.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="preset-actions">
                ${activePreset ? `
                    <button class="btn-preset ${hasChanges ? 'has-changes' : ''}" onclick="saveAndSyncPreset()" title="Save and sync to preset">
                        💾 Save${hasChanges ? ` (${changeCount})` : ''}
                    </button>
                ` : ''}
                <button class="btn-preset" onclick="showSavePresetModal()" title="Save current config as new preset">
                    � Save As
                </button>
                <button class="btn-preset" onclick="showManagePresetsModal()" title="Manage presets">
                    ⚙️
                </button>
            </div>
        </div>
    `;
}

async function handlePresetChange(presetId) {
    if (!presetId) {
        // Deactivate current preset
        try {
            await fetch('/presets/hyprland/deactivate', { method: 'POST' });
            activePreset = null;
            showToast('Preset deactivated', 'info');
        } catch (e) {
            showToast('Failed to deactivate preset', 'error');
        }
        return;
    }

    // Check for unsaved changes
    if (Object.keys(pendingChanges).length > 0) {
        confirmDialog(
            'Unsaved Changes',
            'You have unsaved changes. Switching presets will discard them. Continue?',
            `function() { activatePreset('${presetId}') }`
        );
        // Reset dropdown to current if user cancels
        document.getElementById('preset-dropdown').value = activePreset || '';
        return;
    }

    await activatePreset(presetId);
}

async function activatePreset(presetId) {
    try {
        const response = await fetch(`/presets/hyprland/${presetId}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backup_current: true })
        });

        if (!response.ok) {
            throw new Error('Activation failed');
        }

        const result = await response.json();
        activePreset = presetId;

        // Reload config to reflect changes
        await loadConfig();
        renderTabContent(activeTab);
        renderPresetSelector();

        const preset = presets.find(p => p.id === presetId);
        showToast(`Preset "${preset?.name || presetId}" activated!`, 'success');

        if (result.reload?.reloaded) {
            showToast('Hyprland reloaded', 'success');
        }
    } catch (e) {
        showToast('Failed to activate preset', 'error');
        document.getElementById('preset-dropdown').value = activePreset || '';
    }
}

function showSavePresetModal() {
    openModal(`
        <div class="modal-header">
            <h3>💾 Save as Preset</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p class="modal-description">Save your current configuration as a reusable preset.</p>
            <div class="form-group">
                <label class="form-label">Preset Name</label>
                <input type="text" id="preset-name" class="form-input" placeholder="e.g., Battery Save" required>
            </div>
            <div class="form-group">
                <label class="form-label">Description (optional)</label>
                <textarea id="preset-description" class="form-input" placeholder="e.g., Low power mode with no animations"></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-add" onclick="saveNewPreset()">Save Preset</button>
        </div>
    `);
}

// Save config and sync to active preset
async function saveAndSyncPreset() {
    // First save the config to file
    if (Object.keys(pendingChanges).length > 0) {
        await saveConfig();
    }

    // Then sync to the active preset
    await syncToActivePreset();

    // Refresh the UI
    renderPresetSelector();
}

// Sync current config to the active preset
async function syncToActivePreset() {
    if (!activePreset) return;

    try {
        const response = await fetch(`/presets/hyprland/${activePreset}/update-content`, {
            method: 'POST'
        });

        if (response.ok) {
            const preset = presets.find(p => p.id === activePreset);
            showToast(`Synced to "${preset?.name}"`, 'success');
        }
    } catch (e) {
        console.error('Failed to sync preset:', e);
    }
}

async function saveNewPreset() {
    const name = document.getElementById('preset-name').value.trim();
    const description = document.getElementById('preset-description').value.trim();

    if (!name) {
        showToast('Please enter a preset name', 'error');
        return;
    }

    // First save any pending changes
    if (Object.keys(pendingChanges).length > 0) {
        await saveConfig();
    }

    try {
        const response = await fetch('/presets/hyprland', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });

        if (!response.ok) {
            throw new Error('Failed to create preset');
        }

        const preset = await response.json();
        presets.push(preset);

        closeModal();
        renderPresetSelector();
        showToast(`Preset "${name}" created!`, 'success');
    } catch (e) {
        showToast('Failed to create preset', 'error');
    }
}

function showManagePresetsModal() {
    openModal(`
        <div class="modal-header">
            <h3>⚙️ Manage Presets</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            ${presets.length === 0 ?
            '<p class="empty-state">No presets saved yet. Click "Save As" to create your first preset.</p>' :
            `<div class="presets-list">
                ${presets.map(p => `
                    <div class="preset-item ${p.id === activePreset ? 'active' : ''}">
                        <div class="preset-info">
                            <div class="preset-name">
                                ${p.name}
                                ${p.id === activePreset ? '<span class="preset-badge">Active</span>' : ''}
                            </div>
                            <div class="preset-desc">${p.description || 'No description'}</div>
                            <div class="preset-meta">Created: ${new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="preset-actions">
                            ${p.id !== activePreset ? `
                                <button class="action-btn" onclick="activatePresetFromModal('${p.id}')" title="Activate">▶️</button>
                            ` : ''}
                            <button class="action-btn" onclick="showEditPresetModal('${p.id}', '${p.name.replace(/'/g, "\\'")}', '${(p.description || '').replace(/'/g, "\\'")}')" title="Edit">✏️</button>
                            <button class="action-btn" onclick="updatePresetContent('${p.id}')" title="Update with current config">🔄</button>
                            <button class="action-btn delete" onclick="confirmDeletePreset('${p.id}', '${p.name.replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>`
        }
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Close</button>
        </div>
    `);
}

async function activatePresetFromModal(presetId) {
    await activatePreset(presetId);
    showManagePresetsModal(); // Refresh modal
}

function showEditPresetModal(id, name, description) {
    openModal(`
        <div class="modal-header">
            <h3>✏️ Edit Preset</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Preset Name</label>
                <input type="text" id="edit-preset-name" class="form-input" value="${name}">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="edit-preset-description" class="form-input">${description}</textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="showManagePresetsModal()">Back</button>
            <button class="btn-add" onclick="updatePreset('${id}')">Save Changes</button>
        </div>
    `);
}

async function updatePreset(presetId) {
    const name = document.getElementById('edit-preset-name').value.trim();
    const description = document.getElementById('edit-preset-description').value.trim();

    if (!name) {
        showToast('Preset name is required', 'error');
        return;
    }

    try {
        const response = await fetch(`/presets/hyprland/${presetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });

        if (!response.ok) throw new Error('Update failed');

        // Update local state
        const idx = presets.findIndex(p => p.id === presetId);
        if (idx >= 0) {
            presets[idx].name = name;
            presets[idx].description = description;
        }

        showManagePresetsModal();
        renderPresetSelector();
        showToast('Preset updated', 'success');
    } catch (e) {
        showToast('Failed to update preset', 'error');
    }
}

async function updatePresetContent(presetId) {
    // First save pending changes
    if (Object.keys(pendingChanges).length > 0) {
        await saveConfig();
    }

    try {
        const response = await fetch(`/presets/hyprland/${presetId}/update-content`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Update failed');

        const preset = presets.find(p => p.id === presetId);
        showToast(`Preset "${preset?.name}" updated with current config`, 'success');
    } catch (e) {
        showToast('Failed to update preset content', 'error');
    }
}

function confirmDeletePreset(presetId, name) {
    confirmDialog(
        'Delete Preset',
        `Are you sure you want to delete the preset "${name}"? This cannot be undone.`,
        `function() { deletePreset('${presetId}') }`
    );
}

async function deletePreset(presetId) {
    try {
        const response = await fetch(`/presets/hyprland/${presetId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Delete failed');

        // Update local state
        presets = presets.filter(p => p.id !== presetId);
        if (activePreset === presetId) {
            activePreset = null;
        }

        showManagePresetsModal();
        renderPresetSelector();
        showToast('Preset deleted', 'success');
    } catch (e) {
        showToast('Failed to delete preset', 'error');
    }
}
