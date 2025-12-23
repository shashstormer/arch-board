
// DOM Elements
let elements = {};

function initElements() {
    elements = {
        // Lists
        listLeft: document.getElementById('list-left'),
        listCenter: document.getElementById('list-center'),
        listRight: document.getElementById('list-right'),
        listAvailable: document.getElementById('list-available'),
        searchInput: document.getElementById('search-modules'),

        // Editor
        emptyState: document.getElementById('empty-state'),
        editorContainer: document.getElementById('editor-container'),
        moduleTitle: document.getElementById('module-title'),
        saveBtn: document.getElementById('save-btn'),
        statusMsg: document.getElementById('status-msg'),

        // Config View
        moduleConfig: document.getElementById('module-config'),

        // Style View
        styleColor: document.getElementById('style-color'),
        styleColorPicker: document.getElementById('style-color-picker'),
        styleBg: document.getElementById('style-bg'),
        styleBgPicker: document.getElementById('style-bg-picker'),
        styleFontSize: document.getElementById('style-font-size'),
        stylePadding: document.getElementById('style-padding'),
        styleCustom: document.getElementById('module-custom-css'),

        // Tabs
        tabConfig: document.getElementById('tab-config'),
        tabStyle: document.getElementById('tab-style'),
        viewConfig: document.getElementById('view-config'),
        viewStyle: document.getElementById('view-style'),

        // Settings
        settingLayer: document.getElementById('setting-layer'),
        settingPosition: document.getElementById('setting-position'),
    };
}

// State
let fullConfig = {};
let cssContent = "";
let currentModule = null;
let currentView = 'config'; // 'config' | 'style'

// Initial Load
let initRetries = 0;
async function init() {
    initElements();

    // Check key elements
    if (!elements.listLeft) {
        initRetries++;
        if (initRetries > 20) {
            console.error("Failed to find DOM elements after 20 retries. Missing:",
                Object.keys(elements).filter(k => !elements[k])
            );
            return;
        }
        console.warn(`DOM elements not found, retrying (${initRetries}/20)...`);
        setTimeout(init, 200);
        return;
    }

    await Promise.all([fetchConfig(), fetchStyle()]);
    setupEventListeners();
    renderLayout();
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Fetchers
async function fetchConfig() {
    try {
        const res = await fetch('/waybar/config');
        fullConfig = await res.json();
        // Handle array configs (multibar) - take first for now
        if (Array.isArray(fullConfig)) fullConfig = fullConfig[0];

        // Update general settings inputs
        if (elements.settingLayer) elements.settingLayer.value = fullConfig.layer || 'top';
        if (elements.settingPosition) elements.settingPosition.value = fullConfig.position || 'top';

    } catch (e) {
        console.error("Config load failed", e);
        showStatus('Failed to load config', 'text-red-500');
    }
}

async function fetchStyle() {
    try {
        const res = await fetch('/waybar/style');
        const data = await res.json();
        cssContent = data.content || "";
    } catch (e) {
        console.error("Style load failed", e);
    }
}

// Layout Rendering
function renderLayout() {
    const query = elements.searchInput.value.toLowerCase();

    const modulesLeft = fullConfig['modules-left'] || [];
    const modulesCenter = fullConfig['modules-center'] || [];
    const modulesRight = fullConfig['modules-right'] || [];

    // Collect all defined modules
    const allDefined = new Set([
        ...modulesLeft, ...modulesCenter, ...modulesRight,
        ...Object.keys(fullConfig).filter(k =>
            typeof fullConfig[k] === 'object' &&
            !['modules-left', 'modules-center', 'modules-right'].includes(k) &&
            !['layer', 'position', 'height', 'width', 'spacing', 'margin'].includes(k)
        )
    ]);

    // Available = All Defined - (Left + Center + Right)
    // Actually, "Available" should lists modules that are NOT in the bar but are defined.
    // Also we might want to show "Custom" modules that are not yet defined? (Maybe later)

    const usedModules = new Set([...modulesLeft, ...modulesCenter, ...modulesRight]);
    const availableModules = Array.from(allDefined).filter(m => !usedModules.has(m));

    renderList(elements.listLeft, modulesLeft, 'modules-left', query);
    renderList(elements.listCenter, modulesCenter, 'modules-center', query);
    renderList(elements.listRight, modulesRight, 'modules-right', query);
    renderList(elements.listAvailable, availableModules, 'available', query);
}

function renderList(container, modules, listName, query) {
    container.innerHTML = '';

    modules.filter(m => m.toLowerCase().includes(query)).forEach(m => {
        const el = document.createElement('div');
        // 'group' is not needed for standard CSS hover
        el.className = `module-item ${currentModule === m ? 'active' : ''}`;

        const isEnabled = listName !== 'available';

        el.innerHTML = `
            <div class="module-content" onclick="selectModule('${m}')">
                <div class="module-icon-small">
                    ${getModuleIcon(m)}
                </div>
                <span class="module-name">${m}</span>
            </div>

            <div class="module-actions">
                ${isEnabled ? `
                    <button class="btn-icon-sm remove" title="Move to Available" onclick="moveModule('${m}', '${listName}', 'available')">
                        ✕
                    </button>
                ` : `
                    <button class="btn-icon-sm add" title="Add to Right" onclick="moveModule('${m}', 'available', 'modules-right')">
                        +
                    </button>
                `}
            </div>
        `;
        container.appendChild(el);
    });
}

function getModuleIcon(name) {
    if (name.includes('clock')) return '🕒';
    if (name.includes('battery')) return '🔋';
    if (name.includes('cpu')) return '💻';
    if (name.includes('memory')) return '🧠';
    if (name.includes('disk')) return '💾';
    if (name.includes('network')) return '📡';
    if (name.includes('sound') || name.includes('audio') || name.includes('pulse')) return '🔊';
    if (name.includes('tray')) return '📥';
    if (name.includes('workspaces')) return '🗂️';
    if (name.includes('window')) return '🪟';
    if (name.includes('launcher')) return '🚀';
    return '📦';
}

// Logic
async function moveModule(name, fromList, toList) {
    if (fromList === toList) return;

    // Remove from 'fromList'
    if (fromList !== 'available') {
        const arr = fullConfig[fromList];
        const idx = arr.indexOf(name);
        if (idx !== -1) arr.splice(idx, 1);
        await updateConfigValue(fromList, arr); // Optimize: batch updates?
    }

    // Add to 'toList'
    if (toList !== 'available') {
        if (!fullConfig[toList]) fullConfig[toList] = [];
        fullConfig[toList].push(name);
        await updateConfigValue(toList, fullConfig[toList]);
    }

    renderLayout();
}

async function updateGeneralSettings(key, value) {
    fullConfig[key] = value;
    await updateConfigValue(key, value);
}

async function updateConfigValue(key, value) {
    try {
        await fetch('/waybar/config/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module: key, value: value })
        });
        showStatus('Saved', 'text-green-400');
    } catch (e) {
        showStatus('Save failed', 'text-red-500');
    }
}

// Selection & Editor
function selectModule(name) {
    currentModule = name;
    elements.moduleTitle.textContent = name;

    elements.emptyState.classList.add('hidden');
    elements.editorContainer.classList.remove('hidden');

    // Config View
    const modConfig = fullConfig[name] || {};
    elements.moduleConfig.value = JSON.stringify(modConfig, null, 4);

    // Style View (Parse simple properties if possible)
    // We try to find #name in cssContent
    // This is simple regex parsing for UI population, backend is source of truth for updates
    const selector = `#${name} `;
    const blockMatch = new RegExp(`${selector} \\s *\\{ ([^}]*) \\}`, 'm').exec(cssContent);
    // Reset inputs
    elements.styleColor.value = ''; elements.styleColorPicker.value = '#ffffff';
    elements.styleBg.value = ''; elements.styleBgPicker.value = '#000000';
    elements.styleFontSize.value = '';
    elements.stylePadding.value = '';

    if (blockMatch) {
        const content = blockMatch[1];
        // Simple prop extraction
        const getProp = (p) => {
            const m = new RegExp(`${p} \\s *: \\s * ([^;] +); `).exec(content);
            return m ? m[1].trim() : '';
        };

        const color = getProp('color');
        if (color) { elements.styleColor.value = color; elements.styleColorPicker.value = color.startsWith('#') ? color : '#ffffff'; }

        const bg = getProp('background') || getProp('background-color');
        if (bg) { elements.styleBg.value = bg; elements.styleBgPicker.value = bg.startsWith('#') ? bg : '#000000'; }

        elements.styleFontSize.value = getProp('font-size');
        elements.stylePadding.value = getProp('padding');
    }

    renderLayout(); // re-render to highlight active
}

async function saveCurrentModule() {
    if (!currentModule) return;

    if (currentView === 'config') {
        try {
            const newContent = JSON.parse(elements.moduleConfig.value);
            // Local update
            fullConfig[currentModule] = newContent;

            elements.saveBtn.textContent = 'Saving...';

            const res = await fetch('/waybar/config/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module: currentModule,
                    value: newContent
                })
            });

            if (res.ok) {
                showStatus('Config saved', 'text-green-400');
            } else {
                const err = await res.json();
                showStatus('Error: ' + err.error, 'text-red-400');
            }
        } catch (e) {
            showStatus('Invalid JSON', 'text-red-400');
        } finally {
            // Restore button state
            elements.saveBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                </svg>
                Save
            `;
        }
    } else {
        // Style Save handled by individual inputs? Or global save?
        // Let's make "Save" button save styles too if in style view?
        // Or make style inputs auto-save?
        // Let's make manual save for now to be safe.
        // Actually style inputs call updateStyleProperty immediately? 
        // Plan said "Style Editor".
        // Let's just implement individual property saves for robustness.
    }
}

async function updateStyle(prop, value) {
    if (!currentModule) return;
    const selector = `#${currentModule.replace('/', '-')} `; // custom/launcher -> #custom-launcher usually
    // Wait config uses "custom/launcher", Css uses "#custom-launcher"?
    // Waybar rule: "custom/name" -> "#custom-name"
    // "hyprland/workspaces" -> "#workspaces" (usually)
    // This mapping is tricky.
    // Let's assume ID = name for simple modules, and special handling for /

    let cssId = '#' + currentModule;
    if (currentModule.includes('/')) {
        const parts = currentModule.split('/');
        if (parts[0] === 'custom') cssId = '#custom-' + parts[1];
        else cssId = '#' + parts[1]; // e.g. hyprland/workspaces -> #workspaces
    }

    try {
        await fetch('/waybar/style/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selector: cssId,
                property: prop,
                value: value
            })
        });
        showStatus('Style updated', 'text-green-400');
        // Update local cssContent?
        // Ideally re-fetch or patch locally.
    } catch (e) {
        showStatus('Style update failed', 'text-red-400');
    }
}


function switchTab(view) {
    currentView = view;
    if (view === 'config') {
        elements.tabConfig.className = 'px-4 py-2 text-sm font-medium text-cyan-400 border-b-2 border-cyan-400 transition-colors';
        elements.tabStyle.className = 'px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors';
        elements.viewConfig.classList.remove('hidden');
        elements.viewStyle.classList.add('hidden');
    } else {
        elements.tabStyle.className = 'px-4 py-2 text-sm font-medium text-cyan-400 border-b-2 border-cyan-400 transition-colors';
        elements.tabConfig.className = 'px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors';
        elements.viewStyle.classList.remove('hidden');
        elements.viewConfig.classList.add('hidden');
    }
}

function showStatus(msg, cls) {
    elements.statusMsg.textContent = msg;
    elements.statusMsg.className = 'mt-4 text-sm text-center ' + cls;
    elements.statusMsg.classList.remove('hidden');
    setTimeout(() => elements.statusMsg.classList.add('hidden'), 3000);
}

// Setup Listeners
function setupEventListeners() {
    elements.searchInput.addEventListener('input', renderLayout);
    elements.saveBtn.addEventListener('click', saveCurrentModule);

    elements.tabConfig.addEventListener('click', () => switchTab('config'));
    elements.tabStyle.addEventListener('click', () => switchTab('style'));

    elements.settingLayer.addEventListener('change', (e) => updateGeneralSettings('layer', e.target.value));
    elements.settingPosition.addEventListener('change', (e) => updateGeneralSettings('position', e.target.value));

    // Style Inputs
    // Debounce?
    const debounce = (fn, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    };

    const styleHandler = (prop) => debounce((e) => updateStyle(prop, e.target.value), 500);

    elements.styleColor.addEventListener('input', styleHandler('color'));
    elements.styleColorPicker.addEventListener('input', (e) => {
        elements.styleColor.value = e.target.value;
        updateStyle('color', e.target.value);
    });

    elements.styleBg.addEventListener('input', styleHandler('background'));
    elements.styleBgPicker.addEventListener('input', (e) => {
        elements.styleBg.value = e.target.value;
        updateStyle('background', e.target.value);
    });

    elements.styleFontSize.addEventListener('input', styleHandler('font-size'));
    elements.stylePadding.addEventListener('input', styleHandler('padding'));
}

// Start handled by DOMContentLoaded check above

