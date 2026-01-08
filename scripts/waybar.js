
// DOM Elements
let elements = {};

function initElements() {
    elements = {
        // Zones
        zoneLeft: document.getElementById('zone-left'),
        zoneCenter: document.getElementById('zone-center'),
        zoneRight: document.getElementById('zone-right'),
        visualBar: document.getElementById('visual-bar'),

        // Library
        moduleLibrary: document.getElementById('module-library'),
        searchInput: document.getElementById('search-modules'),

        // Editor
        emptyState: document.getElementById('empty-state'),
        settingsScrollArea: document.getElementById('settings-scroll-area'),
        moduleTitle: document.getElementById('module-title'),
        moduleTypeDisplay: document.getElementById('module-type-display'),
        selectedIcon: document.getElementById('selected-icon'),
        saveBtn: document.getElementById('save-btn'),
        statusMsg: document.getElementById('status-msg'),

        // Config Form
        viewSimple: document.getElementById('view-simple'),
        viewJson: document.getElementById('view-json'),
        viewStyle: document.getElementById('view-style'),
        moduleConfig: document.getElementById('module-config'),

        // Style Editor
        styleColor: document.getElementById('style-color'),
        styleColorPicker: document.getElementById('style-color-picker'),
        styleBg: document.getElementById('style-bg'),
        styleBgPicker: document.getElementById('style-bg-picker'),
        styleFontSize: document.getElementById('style-font-size'),
        stylePadding: document.getElementById('style-padding'),
        styleRadius: document.getElementById('style-radius'),
        styleMargin: document.getElementById('style-margin'),
        styleCustom: document.getElementById('module-custom-css'),

        // Tabs
        tabSimple: document.getElementById('tab-simple'),
        tabJson: document.getElementById('tab-json'),
        tabStyle: document.getElementById('tab-style'),
        tabScript: document.getElementById('tab-script'),

        // Script Editor
        viewScript: document.getElementById('view-script'),
        scriptSelector: document.getElementById('script-selector'),
        scriptFilename: document.getElementById('script-filename'),
        scriptEditor: document.getElementById('script-editor'),
        scriptConsole: document.getElementById('script-console'),
        btnNewScript: document.getElementById('new-script-btn'),
        btnRunScript: document.getElementById('run-script-btn'),
        btnSaveScript: document.getElementById('save-script-btn'),

        // General
        settingLayer: document.getElementById('setting-layer'),
        settingPosition: document.getElementById('setting-position'),
    };
}

// State
let fullConfig = {};
let schemas = {};
let cssContent = "";
let currentModule = null;
let currentView = 'simple';
let dragSource = null;
let draggedItem = null;
let dropPlaceholder = null;

// --- Font Bridge ---
// --- Font Bridge (Deprecated in favor of Global Font Manager) ---
// const FontBridge = { ... }; 


// Initial Load
let initRetries = 0;
async function init() {
    console.log("Waybar Editor: Init started");
    initElements();

    if (!elements.zoneLeft) {
        initRetries++;
        if (initRetries > 20) {
            console.error("Failed to find DOM elements after 20 retries.");
            return;
        }
        setTimeout(init, 200);
        return;
    }

    // Initialize FontBridge first (background fetch)
    // Initialize FontBridge first (background fetch) - DEPRECATED
    // FontBridge.init();

    await Promise.all([fetchConfig(), fetchSchema(), fetchStyle()]);
    setupEventListeners();
    setupZoneToggles();
    setupScriptEditor();
    startLivePreview();
    renderLayout();
    renderLibrary();

    // Initialize Presets
    if (window.PresetManagerUI) {
        window._presetManagers['waybar'] = new PresetManagerUI('waybar', {
            containerId: 'preset-container',
            onActivate: async () => {
                await fetchConfig();
                renderLayout();
                showStatus('Preset activated', 'bg-teal-500/20 text-teal-400 border-teal-500/50');
            },
            onSave: async () => { /* internally handled */ }
        });
    }
}

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
        if (Array.isArray(fullConfig)) fullConfig = fullConfig[0];
        if (!fullConfig['modules-left']) fullConfig['modules-left'] = [];
        if (!fullConfig['modules-center']) fullConfig['modules-center'] = [];
        if (!fullConfig['modules-right']) fullConfig['modules-right'] = [];
    } catch (e) {
        console.error("Config load failed", e);
        showStatus('Failed to load config', 'bg-red-500 text-white');
    }
}

async function fetchSchema() {
    try {
        const res = await fetch('/waybar/schema');
        schemas = await res.json();
    } catch (e) {
        console.error("Schema load failed", e);
    }
}

async function fetchStyle() {
    try {
        const res = await fetch('/waybar/style');
        const data = await res.json();
        cssContent = data.content || "";
        // System fonts are now handled globally by font_manager.js
    } catch (e) {
        console.error("Style load failed", e);
    }
}

// Rendering
function renderLayout() {
    renderZone(elements.zoneLeft, fullConfig['modules-left'], 'modules-left');
    renderZone(elements.zoneCenter, fullConfig['modules-center'], 'modules-center');
    renderZone(elements.zoneRight, fullConfig['modules-right'], 'modules-right');
}

function renderZone(container, modules, listName) {
    container.innerHTML = '';
    container.dataset.listName = listName;

    modules.forEach((mod, index) => {
        const el = document.createElement('div');
        el.className = `
            relative group flex items-center gap-1.5 px-2 py-0.5 rounded border 
            transition-all duration-200 cursor-grab active:cursor-grabbing select-none h-6
            ${currentModule === mod
                ? 'bg-teal-500/20 border-teal-500/50 text-teal-300 shadow-[0_0_10px_-2px_rgba(20,184,166,0.3)]'
                : 'bg-zinc-800/80 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600'}
        `;

        el.draggable = true;
        el.dataset.module = mod;
        el.dataset.index = index;
        el.dataset.list = listName;

        const icon = document.createElement('span');
        icon.className = 'text-xs leading-none';
        icon.textContent = getModuleIcon(mod);

        const label = document.createElement('span');
        label.className = 'text-[10px] font-medium max-w-[80px] truncate leading-none';
        label.textContent = formatModuleName(mod);

        const controls = document.createElement('div');
        controls.className = 'absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity scale-90 hover:scale-110 z-10';
        controls.innerHTML = `
            <button class="bg-red-500/90 hover:bg-red-500 text-white p-0.5 rounded-full shadow-lg" onmousedown="event.stopPropagation(); removeModule('${mod}', '${listName}')">
                <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        `;

        el.appendChild(icon);
        el.appendChild(label);
        el.appendChild(controls);

        el.addEventListener('mousedown', (e) => {
            // select on mousedown to feel more responsive?
            // actually click is better for preventing drag selection
        });

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            selectModule(mod);
        });

        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragend', handleDragEnd);

        container.appendChild(el);
    });

    if (modules.length === 0) {
        container.innerHTML = `<div class="w-full h-full flex items-center justify-center text-zinc-700 text-[10px] uppercase font-bold tracking-widest pointer-events-none select-none">Empty</div>`;
    }
}

function renderLibrary() {
    const query = elements.searchInput.value.toLowerCase();
    const container = elements.moduleLibrary;
    container.innerHTML = '';

    const usedModules = new Set([
        ...(fullConfig['modules-left'] || []),
        ...(fullConfig['modules-center'] || []),
        ...(fullConfig['modules-right'] || [])
    ]);

    const allKeys = new Set([
        ...Object.keys(schemas),
        ...Object.keys(fullConfig).filter(k =>
            !['modules-left', 'modules-center', 'modules-right', 'layer', 'position', 'height', 'width', 'spacing', 'margin'].includes(k) &&
            typeof fullConfig[k] === 'object'
        )
    ]);

    const items = Array.from(allKeys).filter(k =>
        k.toLowerCase().includes(query) && !usedModules.has(k)
    ).sort();

    items.forEach(mod => {
        const el = document.createElement('div');
        el.className = 'flex items-center gap-3 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 cursor-grab active:cursor-grabbing group transition-all';
        el.draggable = true;
        el.dataset.module = mod;
        el.dataset.source = 'library';

        const icon = getModuleIcon(mod);
        const name = formatModuleName(mod);
        const desc = schemas[mod]?.description || (mod.startsWith('custom/') ? 'Custom Script' : 'Standard Module');

        el.innerHTML = `
            <div class="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300 flex items-center justify-center text-xl transition-colors shrink-0">
                ${icon}
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-zinc-300 group-hover:text-white truncate transition-colors">${name}</div>
                <div class="text-[10px] text-zinc-600 group-hover:text-zinc-500 truncate transition-colors">${desc}</div>
            </div>
            <div class="opacity-0 group-hover:opacity-100 text-zinc-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            </div>
        `;

        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragend', handleDragEnd);
        el.addEventListener('dblclick', () => addModuleAtIndex(mod, 'modules-right', fullConfig['modules-right'].length));

        container.appendChild(el);
    });
}

// --- Drag & Drop Interaction Engine ---

function handleDragStart(e) {
    dragSource = this.dataset.source === 'library' ? 'library' : 'bar';
    draggedItem = {
        module: this.dataset.module,
        list: this.dataset.list, // only for bar
        index: parseInt(this.dataset.index) // only for bar
    };

    // Set data for broad compatibility
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(draggedItem));

    this.classList.add('opacity-40', 'scale-95', 'ring-2', 'ring-teal-500/50');

    // Create placeholder element
    dropPlaceholder = document.createElement('div');
    dropPlaceholder.className = 'w-10 h-8 rounded-lg border-2 border-dashed border-teal-500/50 bg-teal-500/10 transition-all duration-200 mx-1';
}

function handleDragEnd(e) {
    this.classList.remove('opacity-40', 'scale-95', 'ring-2', 'ring-teal-500/50');
    dragSource = null;
    draggedItem = null;

    if (dropPlaceholder && dropPlaceholder.parentNode) parentNode = dropPlaceholder.parentNode.removeChild(dropPlaceholder);
    dropPlaceholder = null;

    // Clear zone indicators
    [elements.zoneLeft, elements.zoneCenter, elements.zoneRight].forEach(el => {
        el.classList.remove('ring-2', 'ring-teal-500/50', 'bg-teal-500/5');
    });
}

// Helper to determine drop position
function getDragAfterElement(container, x) {
    // Select all draggable children that are NOT the one being dragged
    const draggableElements = [...container.querySelectorAll('[draggable]:not(.opacity-40)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // Calculate horizontal center of the child
        const center = box.left + box.width / 2;
        // Distance from cursor to the element's center
        // If x < center, offset is negative (cursor is to the left)
        const offset = x - center;

        // We want the element where our cursor is just to the left of its center?
        // Actually standard algorithm: closest negative offset (nearest element we are to the left of)
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function setupEventListeners() {
    elements.searchInput.addEventListener('input', renderLibrary);
    elements.saveBtn.addEventListener('click', saveCurrentModule);

    elements.tabSimple.addEventListener('click', () => switchTab('simple'));
    elements.tabJson.addEventListener('click', () => switchTab('json'));
    elements.tabStyle.addEventListener('click', () => switchTab('style'));

    if (elements.settingLayer) elements.settingLayer.addEventListener('change', (e) => updateGeneralSettings('layer', e.target.value));

    const debounce = (fn, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    };
    const styleHandler = (prop) => debounce((e) => updateStyle(prop, e.target.value), 500);

    ['styleColor', 'styleBg', 'styleFontSize', 'stylePadding', 'styleRadius', 'styleMargin'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const prop = id.replace('style-', '').replace(/([A-Z])/g, "-$1").toLowerCase();
        let cssProp = prop;
        if (id === 'styleBg') cssProp = 'background';
        if (id === 'styleRadius') cssProp = 'border-radius';
        el.addEventListener('input', styleHandler(cssProp));
    });

    elements.styleColorPicker.addEventListener('input', (e) => {
        elements.styleColor.value = e.target.value;
        updateStyle('color', e.target.value);
    });
    elements.styleBgPicker.addEventListener('input', (e) => {
        elements.styleBg.value = e.target.value;
        updateStyle('background', e.target.value);
    });

    elements.styleCustom.addEventListener('input', debounce((e) => {
        updateStyle('custom', e.target.value);
    }, 800));

    // Zone Listeners for Reordering
    [elements.zoneLeft, elements.zoneCenter, elements.zoneRight].forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            zone.classList.add('ring-2', 'ring-teal-500/50', 'bg-teal-500/5');

            const afterElement = getDragAfterElement(zone, e.clientX);

            // Note: insertBefore(node, null) is equivalent to appendChild(node)
            if (afterElement) {
                zone.insertBefore(dropPlaceholder, afterElement);
            } else {
                zone.appendChild(dropPlaceholder);
            }
        });

        zone.addEventListener('dragleave', (e) => {
            // Check if we actually left the zone (e.relatedTarget) or just entered a child
            const rect = zone.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
                zone.classList.remove('ring-2', 'ring-teal-500/50', 'bg-teal-500/5');
                // Don't remove placeholder immediately, causes flicker. Wait for drop or drag end.
            }
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('ring-2', 'ring-teal-500/50', 'bg-teal-500/5');

            if (!draggedItem) return;

            const targetList = zone.dataset.listName;

            // Find index of placeholder among children (ignoring "Empty" text/divs if any)
            const children = [...zone.children].filter(c => c === dropPlaceholder || c.dataset.module);
            let dropIndex = children.indexOf(dropPlaceholder);

            if (dropIndex === -1) dropIndex = children.length;

            // Clean up visual placeholder
            if (dropPlaceholder && dropPlaceholder.parentNode) dropPlaceholder.parentNode.removeChild(dropPlaceholder);

            if (dragSource === 'library') {
                await addModuleAtIndex(draggedItem.module, targetList, dropIndex);
            } else if (dragSource === 'bar') {
                await moveModule(draggedItem.module, draggedItem.list, targetList, dropIndex);
            }
        });
    });
}

// --- Logic ---

async function addModuleAtIndex(name, toList, index) {
    if (!fullConfig[toList]) fullConfig[toList] = [];
    fullConfig[toList].splice(index, 0, name);
    await updateConfigValue(toList, fullConfig[toList]);
    renderLayout();
    renderLibrary();
    selectModule(name);
}

// Ensure `window.removeModule` is accessible for the inline onclick handler
window.removeModule = async function (name, fromList) {
    // Proxy to internal implementation or just reimplement
    const list = fullConfig[fromList];
    const idx = list.indexOf(name);
    if (idx > -1) {
        list.splice(idx, 1);
        await updateConfigValue(fromList, list);
        if (currentModule === name) {
            currentModule = null;
            elements.emptyState.classList.remove('hidden');
            [elements.viewSimple, elements.viewJson, elements.viewStyle].forEach(v => v.classList.add('hidden'));
        }
        renderLayout();
        renderLibrary();
    }
}

async function moveModule(name, fromList, toList, toIndex) {
    const fromArr = fullConfig[fromList];
    const toArr = fullConfig[toList];

    let fromIndex = fromArr.indexOf(name);
    if (fromIndex === -1 && fromList === toList) {
        // Fallback for reorder logic where item might be temporarily removed? No.
        // If moving same item in same list, index is vital
        // But fromIndex should be correct since we haven't modified data yet
        return;
    }

    // Remove from source
    fromArr.splice(fromIndex, 1);

    // Adjust target index if in same list and we moved existing item from *before* target
    if (fromList === toList) {
        if (fromIndex < toIndex) {
            toIndex--;
        }
    }

    // Insert into target
    fullConfig[toList].splice(toIndex, 0, name);

    await Promise.all([
        (fromList !== toList) ? updateConfigValue(fromList, fromArr) : Promise.resolve(),
        updateConfigValue(toList, fullConfig[toList])
    ]);

    renderLayout();
}

async function updateConfigValue(key, value) {
    try {
        await fetch('/waybar/config/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module: key, value: value })
        });
    } catch (e) {
        showStatus('Save failed', 'bg-red-500 text-white');
    }
}

async function updateGeneralSettings(key, value) {
    fullConfig[key] = value;
    await updateConfigValue(key, value);
}

// --- Selection & Editing ---

function selectModule(name) {
    currentModule = name;

    elements.emptyState.classList.add('hidden');
    [elements.viewSimple, elements.viewJson, elements.viewStyle].forEach(v => v.classList.add('hidden'));

    if (currentView === 'json') elements.viewJson.classList.remove('hidden');
    else if (currentView === 'style') elements.viewStyle.classList.remove('hidden');
    else elements.viewSimple.classList.remove('hidden');

    elements.moduleTitle.textContent = formatModuleName(name);
    elements.selectedIcon.innerHTML = getModuleIcon(name);

    const modConfig = fullConfig[name] || {};
    elements.moduleConfig.value = JSON.stringify(modConfig, null, 4);

    let type = name.startsWith("custom/") ? "custom" : name.split('/')[0];
    let schema = schemas[type] || schemas[name];

    if (!schema) {
        if (name.includes('weather')) schema = schemas['custom/weather'];
        else if (type === 'custom') schema = schemas['custom'];
    }

    // Show/Hide Script Tab
    if (type === 'custom') {
        elements.tabScript.classList.remove('hidden');
    } else {
        elements.tabScript.classList.add('hidden');
    }

    if (schema) {
        elements.moduleTypeDisplay.textContent = schema.title || type;
        renderForm(schema, modConfig);
    } else {
        elements.moduleTypeDisplay.textContent = 'Generic Module';
        elements.viewSimple.innerHTML = '<div class="p-8 text-center text-zinc-500 text-sm">No specific settings available. Use JSON or Style editor.</div>';
    }

    populateStyleEditor(name);
    renderLayout();
}

function switchTab(view) {
    currentView = view;
    // Update active tab styles
    const tabs = {
        'simple': elements.tabSimple,
        'json': elements.tabJson,
        'style': elements.tabStyle,
        'script': elements.tabScript
    };

    Object.keys(tabs).forEach(k => {
        const t = tabs[k];
        if (k === view) {
            t.className = "pb-3 text-xs font-medium text-teal-500 border-b-2 border-teal-500 transition-colors";
            if (k === 'simple' && !elements.emptyState.classList.contains('hidden')) return;
            if (k === 'simple') elements.viewSimple.classList.remove('hidden');
            if (k === 'json') elements.viewJson.classList.remove('hidden');
            if (k === 'style') elements.viewStyle.classList.remove('hidden');
            if (k === 'script') {
                elements.viewScript.classList.remove('hidden');
                refreshScriptList(); // Reload list when tab opened
            }
        } else {
            t.className = "pb-3 text-xs font-medium text-zinc-500 border-b-2 border-transparent hover:text-zinc-300 transition-colors";
            if (k === 'simple') elements.viewSimple.classList.add('hidden');
            if (k === 'json') elements.viewJson.classList.add('hidden');
            if (k === 'style') elements.viewStyle.classList.add('hidden');
            if (k === 'script') elements.viewScript.classList.add('hidden');
        }
    });
}

// --- Forms ---

function renderForm(schema, config) {
    const container = elements.viewSimple;
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

    schema.options.forEach(opt => {
        const wrapper = document.createElement('div');
        wrapper.className = 'bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2 relative group focus-within:border-teal-500/50 transition-colors';
        if (opt.type === 'json') wrapper.className += ' md:col-span-2';

        const label = document.createElement('label');
        label.className = 'text-[10px] uppercase font-bold text-zinc-500 tracking-wider';
        label.textContent = opt.description || opt.name;
        wrapper.appendChild(label);

        const val = config[opt.name] !== undefined ? config[opt.name] : (opt.default !== undefined ? opt.default : "");

        let input;

        if (opt.type === 'bool') {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between';

            const toggleLabel = document.createElement('span');
            toggleLabel.className = 'text-sm text-zinc-300';
            toggleLabel.textContent = val ? 'Enabled' : 'Disabled';

            const toggleContainer = document.createElement('label');
            toggleContainer.className = 'relative inline-flex items-center cursor-pointer';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'sr-only peer';
            chk.checked = val === true;
            chk.onchange = (e) => {
                updateFormValue(opt.name, e.target.checked);
                toggleLabel.textContent = e.target.checked ? 'Enabled' : 'Disabled';
            };

            const slider = document.createElement('div');
            slider.className = "w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500";

            toggleContainer.appendChild(chk);
            toggleContainer.appendChild(slider);
            row.appendChild(toggleLabel);
            row.appendChild(toggleContainer);
            wrapper.appendChild(row);
        }
        else if (opt.type === 'int' || opt.type === 'float') {
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'w-full bg-transparent text-sm text-zinc-200 focus:outline-none font-mono placeholder-zinc-700';
            if (opt.type === 'float') input.step = opt.step || "0.1";
            input.value = val;
            input.placeholder = "0";
            input.oninput = (e) => updateFormValue(opt.name, opt.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value));
            wrapper.appendChild(input);
        }
        else if (opt.type === 'enum' && opt.choices) {
            input = document.createElement('select');
            input.className = 'w-full bg-transparent text-sm text-zinc-200 focus:outline-none cursor-pointer';
            opt.choices.forEach(c => {
                const o = document.createElement('option');
                o.value = c;
                o.textContent = c;
                o.className = "bg-zinc-800";
                if (c == val) o.selected = true;
                input.appendChild(o);
            });
            input.onchange = (e) => updateFormValue(opt.name, e.target.value);
            wrapper.appendChild(input);
        }
        else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'w-full bg-transparent text-sm text-zinc-200 focus:outline-none font-mono placeholder-zinc-700';
            input.value = val;
            input.placeholder = "...";
            input.oninput = (e) => updateFormValue(opt.name, e.target.value);
            wrapper.appendChild(input);
        }

        grid.appendChild(wrapper);
    });

    container.appendChild(grid);
}

function updateFormValue(key, value) {
    if (!currentModule) return;
    if (!fullConfig[currentModule]) fullConfig[currentModule] = {};
    fullConfig[currentModule][key] = value;
    elements.moduleConfig.value = JSON.stringify(fullConfig[currentModule], null, 4);
}

// --- Styles ---

function populateStyleEditor(name) {
    const selector = `#${name}`;
    let content = "";
    const regex = new RegExp(`${selector.replace(/\//g, '\\/')}\\s*\\{([^}]*)\\}`, 'm');
    const match = regex.exec(cssContent);

    if (match) {
        content = match[1];
        const getVal = (prop) => {
            const pMatch = new RegExp(`${prop}\\s*:\\s*([^;]+);`).exec(content);
            return pMatch ? pMatch[1].trim() : '';
        };

        const color = getVal('color');
        if (color) {
            elements.styleColor.value = color;
            if (color.startsWith('#')) elements.styleColorPicker.value = color;
        } else {
            elements.styleColor.value = '';
        }

        const bg = getVal('background') || getVal('background-color');
        if (bg) {
            elements.styleBg.value = bg;
            if (bg.startsWith('#')) elements.styleBgPicker.value = bg;
        } else {
            elements.styleBg.value = '';
        }

        elements.styleFontSize.value = getVal('font-size');
        elements.stylePadding.value = getVal('padding');
        elements.styleRadius.value = getVal('border-radius');
        elements.styleMargin.value = getVal('margin');
    } else {
        elements.styleColor.value = ''; elements.styleColorPicker.value = '#ffffff';
        elements.styleBg.value = ''; elements.styleBgPicker.value = '#000000';
        elements.styleFontSize.value = '';
        elements.stylePadding.value = '';
        elements.styleRadius.value = '';
        elements.styleMargin.value = '';
    }
}

async function updateStyle(prop, value) {
    if (!currentModule) return;
    let cssId = '#' + currentModule;
    if (currentModule.includes('/')) {
        const parts = currentModule.split('/');
        if (parts[0] === 'custom') cssId = '#custom-' + parts[1];
        else cssId = '#' + parts[1];
    }
    if (currentModule == "hyprland/workspaces") cssId = "#workspaces";
    if (currentModule == "hyprland/window") cssId = "#window";

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
        showStatus('Style updated', 'bg-green-500/20 text-green-400 border-green-500/50');
    } catch (e) {
        console.error(e);
    }
}

async function saveCurrentModule() {
    if (currentView === 'json' && currentModule) {
        try {
            const newC = JSON.parse(elements.moduleConfig.value);
            fullConfig[currentModule] = newC;
            await updateConfigValue(currentModule, newC);
        } catch (e) {
            showStatus('Invalid JSON', 'bg-red-500 text-white');
            return;
        }
    }
    showStatus('Config saved', 'bg-teal-500/20 text-teal-400 border-teal-500/50');
}

// --- Utils ---

function getModuleIcon(name) {
    if (name.includes('clock')) return '🕒';
    if (name.includes('battery')) return '🔋';
    if (name.includes('cpu')) return '💻';
    if (name.includes('memory')) return '🧠';
    if (name.includes('network')) return '📡';
    if (name.includes('sound') || name.includes('audio') || name.includes('pulse')) return '🔊';
    if (name.includes('disk') || name.includes('filesystem')) return '💾';
    if (name.includes('tray')) return '📥';
    if (name.includes('workspaces')) return '◆';
    if (name.includes('window')) return '🪟';
    if (name.includes('launcher')) return '🚀';
    if (name.includes('power')) return '⚡';
    if (name.includes('updat')) return '⬇️';
    if (name.includes('temp')) return '🌡️';
    if (name.includes('backlight')) return '☀';
    if (name.includes('weather')) return '☁️';
    if (name.includes('idle')) return '☕';
    return '📦';
}

function formatModuleName(name) {
    if (name.startsWith('custom/')) return name.replace('custom/', '');
    if (name.includes('/')) return name.split('/')[1];
    return name;
}

function showStatus(msg, cls) {
    const el = elements.statusMsg;
    el.textContent = msg;
    el.className = `fixed bottom-6 right-6 px-4 py-2 border rounded-lg shadow-2xl transition-all duration-300 z-50 text-sm font-medium ${cls}`;
    el.style.opacity = '1';
    setTimeout(() => {
        el.style.opacity = '0';
    }, 3000);
}

// --- Zone Toggles & Smart Drop ---
function setupZoneToggles() {
    const buttons = document.querySelectorAll('#zone-toggles button');

    buttons.forEach(btn => {
        const zoneName = btn.dataset.zone; // components-left etc
        const targetId = btn.dataset.target; // zone-left
        const targetZone = document.getElementById(targetId);

        if (!targetZone) return;

        // 1. Toggle Visibility
        btn.onclick = () => {
            const isHidden = targetZone.classList.toggle('hidden');

            if (isHidden) {
                btn.classList.remove('text-teal-400', 'border-teal-500/30', 'bg-zinc-800');
                btn.classList.add('text-zinc-600', 'border-zinc-800', 'line-through', 'opacity-50');
            } else {
                btn.classList.add('text-teal-400', 'border-teal-500/30');
                btn.classList.remove('text-zinc-600', 'border-zinc-800', 'line-through', 'opacity-50');
            }
        };

        // 2. Smart Drop (Append to Zone)
        btn.ondragover = (e) => {
            e.preventDefault();
            btn.classList.add('bg-teal-500/20', 'border-teal-500');
        };

        btn.ondragleave = () => {
            btn.classList.remove('bg-teal-500/20', 'border-teal-500');
        };

        btn.ondrop = async (e) => {
            e.preventDefault();
            btn.classList.remove('bg-teal-500/20', 'border-teal-500');

            const moduleName = e.dataTransfer.getData('module');
            if (!moduleName) return;

            // Add to end of list
            if (!fullConfig[zoneName]) fullConfig[zoneName] = [];
            fullConfig[zoneName].push(moduleName);

            // Visual feedback
            targetZone.classList.remove('hidden'); // Ensure visible
            // Update button state
            btn.classList.add('text-teal-400', 'border-teal-500/30');
            btn.classList.remove('text-zinc-600', 'border-zinc-800', 'line-through', 'opacity-50');

            renderLayout();
            await saveConfig();
        };
    });
}


// --- Advanced Waybar Simulator ---

class Simulator {
    constructor() {
        this.cache = {};
        this.batchQueue = {};
    }

    // Main render function
    render(moduleName, config, stats, element) {
        if (moduleName.startsWith('custom/')) {
            // Queue for batch execution
            if (config.exec) {
                // Force exit after 2s to capture output from continuous scripts (like network monitors)
                // This prevents backend timeouts and ensures preview updates
                this.batchQueue[moduleName] = `timeout 2s ${config.exec}`;
            }
            // For custom modules without exec (static), we do nothing or render default text
            return;
        }

        const type = moduleName.split('/')[0];
        let classes = [moduleName];
        let matchedIcon = "";

        // Common Data Extraction
        let value = 0; // For icon resolution
        let state = ""; // For state-based icons

        // Data Mapping (Safe Access)
        try {
            if (type === 'battery') {
                value = stats.battery.percent;
                state = stats.battery.state.toLowerCase();
                if (state === 'charging' || state === 'plugged') {
                    classes.push('charging');
                    classes.push('plugged');
                } else if (value < 20) {
                    classes.push('critical');
                }
            } else if (type === 'pulseaudio') {
                value = stats.audio.volume;
                if (stats.audio.muted) {
                    classes.push('muted');
                    state = 'muted';
                }
            } else if (type === 'backlight') {
                value = stats.backlight.percent;
            } else if (type === 'network') {
                value = stats.network.signal;
                if (!stats.network.connected) {
                    classes.push('disconnected');
                    state = 'disconnected';
                } else {
                    classes.push(stats.network.ssid);
                    state = 'connected';
                }
            } else if (type === 'clock') {
                // value is handled by date interpolation
            } else if (type === 'cpu') {
                value = stats.cpu;
            } else if (type === 'memory') {
                value = stats.memory;
            } else if (type === 'disk') {
                value = stats.disk;
            } else if (type === 'bluetooth') {
                if (stats.bluetooth.on) {
                    state = stats.bluetooth.connected ? 'connected' : 'on';
                    classes.push(state);
                } else {
                    state = 'off';
                    classes.push('off');
                }
            }
        } catch (e) { console.error("Error mapping stats", e); }

        // Icon Resolution
        matchedIcon = this.resolveIcon(config, value, state);

        // Format Interpolation
        let format = config.format || "{icon}";
        if (state && config[`format-${state}`]) {
            format = config[`format-${state}`];
        } else if (config.format) {
            format = config.format;
        }

        // Variable Replacement
        let text = format;
        try {
            // Helper for global regex replacement with formatting support (ignores formatting for now, just replaces value)
            const replaceToken = (str, token, val) => {
                // Matches {token}, {token:02d}, {token:>3} etc.
                const regex = new RegExp(`{${token}(?::[^}]*)?}`, 'g');
                return str.replace(regex, val);
            };

            // Universal replacements (safety)
            const safePercent = (typeof value === 'number') ? value : 0;

            text = replaceToken(text, 'icon', matchedIcon);
            text = replaceToken(text, 'capacity', stats.battery.percent || 0);
            text = replaceToken(text, 'volume', stats.audio.volume || 0);
            text = replaceToken(text, 'percent', safePercent);
            text = replaceToken(text, 'usage', stats.cpu || 0);
            text = replaceToken(text, 'percentage', stats.memory || 0);
            text = replaceToken(text, 'ssid', stats.network.ssid || '');
            text = replaceToken(text, 'signalStrength', stats.network.signal || 0);
            text = replaceToken(text, 'temperatureC', stats.temperature || 0);
            text = replaceToken(text, 'used', stats.disk || 0);
            text = replaceToken(text, 'free', 100 - (stats.disk || 0));

            // Special Clock Handling
            if (type === 'clock') {
                // Simplistic date format replacement
                text = text.replace('{:%H:%M}', stats.time).replace('{:%H:%M:%S}', stats.time);
                if (text.includes('{:')) text = stats.time;
            }
        } catch (e) { }

        // Update DOM
        const iconSpan = element.querySelector('span:nth-child(1)');
        const labelSpan = element.querySelector('span:nth-child(2)');

        if (iconSpan) iconSpan.textContent = matchedIcon;

        // Remove matched icon from text to avoid duplication if format included it
        let cleanLabel = text;
        if (matchedIcon && text.includes(matchedIcon)) {
            // Be careful not to replace generic characters if icon is generic (e.g. "-")
            if (matchedIcon.length > 1) {
                cleanLabel = text.replace(matchedIcon, '').trim();
            }
        }
        if (labelSpan) labelSpan.textContent = cleanLabel;

        // Apply classes
        const staticClasses = element.className.split(' ').filter(c =>
            !['charging', 'plugged', 'critical', 'muted', 'disconnected', 'connected', 'on', 'off'].includes(c)
        );
        element.className = [...staticClasses, ...classes.filter(c => c !== moduleName)].join(' ');
    }

    resolveIcon(config, value, state) {
        if (!config['format-icons']) return "";

        const icons = config['format-icons'];

        if (Array.isArray(icons)) {
            const index = Math.min(Math.floor((value / 100) * icons.length), icons.length - 1);
            return icons[index] || "";
        }

        if (typeof icons === 'object') {
            if (state && icons[state]) return icons[state];
            if (icons.default) return icons.default;
        }

        return "";
    }
}

// Global Simulator Instance
const simulator = new Simulator();

let latestStats = {
    cpu: 0,
    memory: 0,
    battery: { percent: 100, state: 'Unknown' },
    disk: 0,
    time: "00:00",
    audio: { volume: 50, muted: false },
    network: { ssid: '', signal: 0, connected: false },
    backlight: { percent: 100 },
    bluetooth: { on: false, connected: false },
    temperature: 45 // Default stub
};

// Polling State
let isPreviewActive = false;
let livePreviewTimeout = null;

function startLivePreview() {
    if (isPreviewActive) return;
    isPreviewActive = true;

    // Initial loop start
    loopLivePreview();
}

async function loopLivePreview() {
    try {
        // 1. Fetch System Stats
        const res = await fetch('/waybar/stats');
        const data = await res.json();
        if (!data.error) {
            latestStats = { ...latestStats, ...data };
        }

        // 2. Update Modules (this involves batch exec which takes time)
        await processLiveUpdate();

    } catch (e) {
        console.error("Live preview tick failed", e);
    }

    // Schedule next tick only after this one completes
    if (livePreviewTimeout) clearTimeout(livePreviewTimeout);
    livePreviewTimeout = setTimeout(loopLivePreview, 4000);
}

async function processLiveUpdate() {
    // Collect batch queue
    simulator.batchQueue = {};

    // Find all rendered module pills
    const zones = [elements.zoneLeft, elements.zoneCenter, elements.zoneRight];

    zones.forEach(zone => {
        Array.from(zone.children).forEach(el => {
            const modName = el.dataset.module;
            if (!modName) return;

            const config = fullConfig[modName] || {};
            simulator.render(modName, config, latestStats, el);
        });
    });

    // Execute Batch for Custom Modules
    if (Object.keys(simulator.batchQueue).length > 0) {
        try {
            const res = await fetch('/waybar/exec_batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commands: simulator.batchQueue, timeout: 15 })
            });
            const results = await res.json();

            // Render Results
            zones.forEach(zone => {
                Array.from(zone.children).forEach(el => {
                    const modName = el.dataset.module;
                    if (results[modName]) {
                        renderCustomResult(el, results[modName]);
                    }
                });
            });

        } catch (e) { console.error("Batch exec failed", e); }
    }
}

function renderCustomResult(element, result) {
    const iconSpan = element.querySelector('span:nth-child(1)');
    const labelSpan = element.querySelector('span:nth-child(2)');

    // Custom modules usually output JSON {text, alt, tooltip, class} or straight text
    if (typeof result === 'object') {
        if ((result.text || result.alt) && labelSpan) labelSpan.textContent = result.text || result.alt;

        // Handle Error/Timeout
        if (result.error && labelSpan) {
            labelSpan.textContent = result.error === "Timeout" ? "..." : "Err";
            return;
        }

        // If JSON has class, apply it (carefully)
        if (result.class) {
            const baseClasses = element.className.split(' ').filter(c => !['custom-active', 'warning', 'critical'].includes(c));
            // For safety, only allow alphanumeric classes
            const cleanClass = result.class.replace(/[^a-z0-9-_]/gi, '');
            if (cleanClass) element.className = [...baseClasses, cleanClass].join(' ');
        }
    } else if (typeof result === 'string' && labelSpan) {
        labelSpan.textContent = result;
    }
}

// --- Script Editor Logic ---

function setupScriptEditor() {
    // Event Listeners
    if (elements.scriptSelector) elements.scriptSelector.onchange = (e) => loadScript(e.target.value);

    if (elements.btnNewScript) elements.btnNewScript.onclick = () => {
        elements.scriptFilename.value = "new_script.sh";
        elements.scriptFilename.disabled = false;
        elements.scriptEditor.value = "#!/bin/bash\n\n# Your script here";
        elements.scriptFilename.focus();
    };

    if (elements.btnSaveScript) elements.btnSaveScript.onclick = saveScript;
    if (elements.btnRunScript) elements.btnRunScript.onclick = runScript;

    if (elements.tabScript) elements.tabScript.onclick = () => switchTab('script');
}

async function refreshScriptList() {
    try {
        const res = await fetch('/waybar/scripts');
        const scripts = await res.json();

        const current = elements.scriptSelector.value;
        elements.scriptSelector.innerHTML = '<option value="">Select a script...</option>';

        scripts.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            if (s === current) opt.selected = true;
            elements.scriptSelector.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to load scripts", e);
    }
}

async function loadScript(name) {
    if (!name) return;
    try {
        const res = await fetch(`/waybar/scripts/${name}`);
        const data = await res.json();

        elements.scriptFilename.value = data.name;
        elements.scriptFilename.disabled = true;
        elements.scriptEditor.value = data.content;
    } catch (e) {
        showStatus('Failed to load script', 'bg-red-500 text-white');
    }
}

async function saveScript() {
    const name = elements.scriptFilename.value.trim();
    const content = elements.scriptEditor.value;

    if (!name) {
        showStatus('Filename required', 'bg-red-500 text-white');
        return;
    }

    try {
        const res = await fetch('/waybar/scripts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, content })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showStatus('Script saved', 'bg-teal-500/20 text-teal-400 border-teal-500/50');
            elements.scriptFilename.disabled = true;
            refreshScriptList();
        } else {
            showStatus(data.error || 'Save failed', 'bg-red-500 text-white');
        }
    } catch (e) {
        showStatus('Save failed', 'bg-red-500 text-white');
    }
}

async function runScript() {
    const content = elements.scriptEditor.value;
    const name = elements.scriptFilename.value;

    if (!elements.scriptFilename.disabled) {
        await saveScript();
    }

    // Fixed: Use generic relative path execution (handled by shell mostly, or assume PATH)
    // If the file is in current dir (which backend handles as cwd=config_dir), ./name works if it's there.
    // If it's a script managed by us, it's in `scripts/`.

    const cmd = `scripts/${name}`; // Since we put them in scripts/ dir in backend logic
    addConsoleOutput(`> Executing ${cmd}...`, 'text-blue-400');

    try {
        const res = await fetch('/waybar/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd, timeout: 5 })
        });
        const data = await res.json();

        if (data.error && data.timeout) {
            addConsoleOutput(`[TIMEOUT] Execution took longer than 5s`, 'text-red-400');
            return;
        }

        if (data.stdout) addConsoleOutput(data.stdout, 'text-zinc-300');
        if (data.stderr) addConsoleOutput(data.stderr, 'text-red-400');

        addConsoleOutput(`> Exited with code ${data.returncode}`, 'text-zinc-500');

    } catch (e) {
        addConsoleOutput(`Error: ${e.message}`, 'text-red-500');
    }
}

function addConsoleOutput(text, colorClass = 'text-zinc-300') {
    const d = document.createElement('div');
    d.className = `font-mono whitespace-pre-wrap ${colorClass}`;
    d.textContent = text;
    elements.scriptConsole.appendChild(d);
    elements.scriptConsole.scrollTop = elements.scriptConsole.scrollHeight;
}
