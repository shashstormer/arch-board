
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
        moduleTypeDisplay: document.getElementById('module-type-display'),
        saveBtn: document.getElementById('save-btn'),
        statusMsg: document.getElementById('status-msg'),

        // Config View
        moduleConfig: document.getElementById('module-config'),

        // Form View
        formContainer: document.getElementById('view-simple'),

        // Style View
        styleColor: document.getElementById('style-color'),
        styleColorPicker: document.getElementById('style-color-picker'),
        styleBg: document.getElementById('style-bg'),
        styleBgPicker: document.getElementById('style-bg-picker'),
        styleFontSize: document.getElementById('style-font-size'),
        stylePadding: document.getElementById('style-padding'),
        styleCustom: document.getElementById('module-custom-css'),

        // Tabs
        tabSimple: document.getElementById('tab-simple'),
        tabJson: document.getElementById('tab-json'),
        tabStyle: document.getElementById('tab-style'),

        viewSimple: document.getElementById('view-simple'),
        viewJson: document.getElementById('view-json'),
        viewStyle: document.getElementById('view-style'),

        // Settings
        settingLayer: document.getElementById('setting-layer'),
        settingPosition: document.getElementById('setting-position'),
    };
}

// State
let fullConfig = {};
let schemas = {}; // Loaded schemas
let cssContent = "";
let currentModule = null;
let currentView = 'simple'; // 'simple' | 'json' | 'style'

// Initial Load
let initRetries = 0;
async function init() {
    console.log("Waybar Editor: Init started");
    initElements();

    if (!elements.listLeft) {
        initRetries++;
        if (initRetries > 20) {
            console.error("Failed to find DOM elements after 20 retries.");
            return;
        }
        setTimeout(init, 200);
        return;
    }

    await Promise.all([fetchConfig(), fetchSchema(), fetchStyle()]);
    setupEventListeners();
    renderLayout();
    console.log("Waybar Editor: Init complete");
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
        console.log("Waybar Editor: Config loaded", Object.keys(fullConfig));

        if (elements.settingLayer) elements.settingLayer.value = fullConfig.layer || 'top';
        if (elements.settingPosition) elements.settingPosition.value = fullConfig.position || 'top';

    } catch (e) {
        console.error("Config load failed", e);
        showStatus('Failed to load config', 'text-red-500');
    }
}

async function fetchSchema() {
    try {
        const res = await fetch('/waybar/schema');
        schemas = await res.json();
        console.log("Waybar Editor: Schema loaded", Object.keys(schemas));
    } catch (e) {
        console.error("Schema load failed", e);
    }
}

async function fetchStyle() {
    try {
        const res = await fetch('/waybar/style');
        const data = await res.json();
        cssContent = data.content || "";
        console.log("Waybar Editor: Style loaded");
    } catch (e) {
        console.error("Style load failed", e);
    }
}

// Layout Rendering
function renderLayout() {
    console.log("Waybar Editor: Rendering layout");
    const query = elements.searchInput.value.toLowerCase();

    const modulesLeft = fullConfig['modules-left'] || [];
    const modulesCenter = fullConfig['modules-center'] || [];
    const modulesRight = fullConfig['modules-right'] || [];

    const allDefined = new Set([
        ...modulesLeft, ...modulesCenter, ...modulesRight,
        ...Object.keys(fullConfig).filter(k =>
            typeof fullConfig[k] === 'object' &&
            !['modules-left', 'modules-center', 'modules-right'].includes(k) &&
            !['layer', 'position', 'height', 'width', 'spacing', 'margin'].includes(k)
        )
    ]);

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
        el.className = `module-item ${currentModule === m ? 'active' : ''}`;
        const isEnabled = listName !== 'available';

        // We use onclick attributes. Ensure selectModule is global.
        el.innerHTML = `
            <div class="module-content" onclick="selectModule('${m}')">
                <div class="module-icon-small">${getModuleIcon(m)}</div>
                <span class="module-name">${m}</span>
            </div>
            <div class="module-actions">
                ${isEnabled ? `
                    <button class="btn-icon-sm remove" title="Move to Available" onclick="moveModule('${m}', '${listName}', 'available')">✕</button>
                ` : `
                    <button class="btn-icon-sm add" title="Add to Right" onclick="moveModule('${m}', 'available', 'modules-right')">+</button>
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
    if (name.includes('network')) return '📡';
    if (name.includes('sound') || name.includes('audio') || name.includes('pulse')) return '🔊';
    if (name.includes('tray')) return '📥';
    if (name.includes('workspaces')) return '🗂️';
    if (name.includes('window')) return '🪟';
    if (name.includes('launcher')) return '🚀';
    if (name.includes('temperature')) return '🌡️';
    if (name.includes('backlight')) return '☀';
    return '📦';
}

// Logic
async function moveModule(name, fromList, toList) {
    console.log("Waybar Editor: Moving module", name, fromList, toList);
    if (fromList === toList) return;
    if (fromList !== 'available') {
        const arr = fullConfig[fromList];
        const idx = arr.indexOf(name);
        if (idx !== -1) arr.splice(idx, 1);
        await updateConfigValue(fromList, arr);
    }
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
    console.log("Waybar Editor: selectModule called for", name);
    currentModule = name;

    if(!elements.moduleTitle) {
        console.error("Waybar Editor: moduleTitle element missing");
        return;
    }

    elements.moduleTitle.textContent = name;

    // Toggle containers
    console.log("Waybar Editor: Showing editor container");
    if(elements.emptyState) elements.emptyState.style.display = 'none';

    if(elements.editorContainer) {
        elements.editorContainer.classList.remove('hidden');
        elements.editorContainer.classList.add('active'); // CSS requires .active to show
    }

    const modConfig = fullConfig[name] || {};
    if(elements.moduleConfig) elements.moduleConfig.value = JSON.stringify(modConfig, null, 4);

    // Determine typehidden
    let type = name;
    if (name.startsWith("custom/")) type = "custom";
    else if (name.startsWith("hyprland/")) type = name; // Exact match for defined ones

    // Check schemas
    let schema = schemas[type];

    // Fallback: Check if name matches a key in schema directly (e.g. "clock")
    if (!schema && schemas[name]) schema = schemas[name];

    // Fallback for generic custom
    if (!schema && name.includes("/")) {
        // e.g. "custom/foo" -> try "custom"
        if(name.startsWith("custom/")) schema = schemas["custom"];
    }

    if (schema) {
        console.log("Waybar Editor: Schema found", schema.title);
        elements.moduleTypeDisplay.textContent = `Type: ${schema.title}`;
        renderForm(schema, modConfig);
        if(currentView === 'json' || currentView === 'style') {
             // Keep current view
        } else {
             switchTab('simple');
        }
    } else {
        console.log("Waybar Editor: No schema found for", name);
        elements.moduleTypeDisplay.textContent = `Type: Generic (JSON)`;
        elements.formContainer.innerHTML = '<div class="text-zinc-500 p-4 text-center">No visual settings available for this module. Use JSON editor.</div>';
        switchTab('json');
    }

    // Populate Style
    populateStyleEditor(name);

    renderLayout();
}

// Attach to window to ensure global access for inline onclick
window.selectModule = selectModule;
window.moveModule = moveModule;

function renderForm(schema, config) {
    const container = elements.formContainer;
    container.innerHTML = '';

    schema.options.forEach(opt => {
        const group = document.createElement('div');
        group.className = 'waybar-input-group mb-4';

        const label = document.createElement('label');
        label.className = 'waybar-label';
        label.textContent = opt.description || opt.name;
        group.appendChild(label);

        let input;
        const val = config[opt.name] !== undefined ? config[opt.name] : (opt.default !== undefined ? opt.default : "");

        if (opt.type === 'bool') {
            input = document.createElement('div');
            input.className = 'flex items-center mt-1';
            const toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.checked = val === true;
            toggle.className = 'w-4 h-4 text-cyan-500 rounded border-zinc-600 focus:ring-cyan-500 bg-zinc-700';
            toggle.onchange = (e) => updateFormValue(opt.name, e.target.checked);
            input.appendChild(toggle);
            const span = document.createElement('span');
            span.className = 'ml-2 text-sm text-zinc-400';
            span.textContent = opt.description; // or "Enabled"
            input.appendChild(span);
        }
        else if (opt.type === 'int' || opt.type === 'float') {
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'waybar-input w-full';
            if(opt.type === 'float') input.step = opt.step || "0.1";
            input.value = val;
            input.oninput = (e) => updateFormValue(opt.name, opt.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value));
        }
        else if (opt.type === 'enum' && opt.choices) {
            input = document.createElement('select');
            input.className = 'input-select w-full';
            opt.choices.forEach(c => {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c;
                if (c == val) option.selected = true;
                input.appendChild(option);
            });
            input.onchange = (e) => updateFormValue(opt.name, e.target.value);
        }
        else if (opt.type === 'json') {
             input = document.createElement('textarea');
             input.className = 'waybar-textarea small';
             input.value = typeof val === 'object' ? JSON.stringify(val) : val;
             input.onchange = (e) => {
                 try {
                     const j = JSON.parse(e.target.value);
                     updateFormValue(opt.name, j);
                     input.classList.remove('border-red-500');
                 } catch(err) {
                     input.classList.add('border-red-500');
                 }
             };
        }
        else {
            // String
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'waybar-input w-full';
            input.value = val;
            input.oninput = (e) => updateFormValue(opt.name, e.target.value);
        }

        if(opt.type !== 'bool') group.appendChild(input); // Bool appends its own container
        else group.appendChild(input);

        container.appendChild(group);
    });
}

function updateFormValue(key, value) {
    if (!currentModule) return;

    // Update local config object
    if (!fullConfig[currentModule]) fullConfig[currentModule] = {};
    fullConfig[currentModule][key] = value;

    // Sync JSON view
    elements.moduleConfig.value = JSON.stringify(fullConfig[currentModule], null, 4);
}

function populateStyleEditor(name) {
    const selector = `#${name} `;
    // Simple regex matching for now
    const blockMatch = new RegExp(`${selector.replace(/\//g, '\\/')}\\s*\\{([^}]*)\\}`, 'm').exec(cssContent);
    // Also try without # for custom classes if needed, but standard modules use #name

    // Reset
    elements.styleColor.value = ''; elements.styleColorPicker.value = '#ffffff';
    elements.styleBg.value = ''; elements.styleBgPicker.value = '#000000';
    elements.styleFontSize.value = '';
    elements.stylePadding.value = '';

    if (blockMatch) {
        const content = blockMatch[1];
        const getProp = (p) => {
            const m = new RegExp(`${p}\\s*:\\s*([^;]+);`).exec(content);
            return m ? m[1].trim() : '';
        };

        const color = getProp('color');
        if (color) { elements.styleColor.value = color; elements.styleColorPicker.value = color.startsWith('#') ? color : '#ffffff'; }

        const bg = getProp('background') || getProp('background-color');
        if (bg) { elements.styleBg.value = bg; elements.styleBgPicker.value = bg.startsWith('#') ? bg : '#000000'; }

        elements.styleFontSize.value = getProp('font-size');
        elements.stylePadding.value = getProp('padding');
    }
}

async function saveCurrentModule() {
    if (!currentModule) return;

    try {
        let newContent;
        // If we are in Simple view, the fullConfig[currentModule] is already updated by event listeners
        // If in JSON view, we need to parse textarea
        if (currentView === 'json') {
             newContent = JSON.parse(elements.moduleConfig.value);
             fullConfig[currentModule] = newContent;
        } else {
             newContent = fullConfig[currentModule];
        }

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
        elements.saveBtn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Save`;
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
    // Correction for specific hyprland modules if needed
    if(currentModule == "hyprland/workspaces") cssId = "#workspaces";
    if(currentModule == "hyprland/window") cssId = "#window";

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
    } catch (e) {
        showStatus('Style update failed', 'text-red-400');
    }
}

function switchTab(view) {
    currentView = view;

    // Reset classes
    [elements.tabSimple, elements.tabJson, elements.tabStyle].forEach(t => {
        t.className = 'px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors';
    });

    [elements.viewSimple, elements.viewJson, elements.viewStyle].forEach(v => v.classList.add('hidden'));

    // Activate
    const activeBtnClass = 'px-4 py-2 text-sm font-medium text-cyan-400 border-b-2 border-cyan-400 transition-colors';

    if (view === 'simple') {
        elements.tabSimple.className = activeBtnClass;
        elements.viewSimple.classList.remove('hidden');
    } else if (view === 'json') {
        elements.tabJson.className = activeBtnClass;
        elements.viewJson.classList.remove('hidden');
        // Ensure JSON is up to date
        if(currentModule) elements.moduleConfig.value = JSON.stringify(fullConfig[currentModule], null, 4);
    } else {
        elements.tabStyle.className = activeBtnClass;
        elements.viewStyle.classList.remove('hidden');
    }
}

function showStatus(msg, cls) {
    elements.statusMsg.textContent = msg;
    elements.statusMsg.className = 'mt-4 text-sm text-center ' + cls;
    elements.statusMsg.classList.remove('hidden');
    setTimeout(() => elements.statusMsg.classList.add('hidden'), 3000);
}

function setupEventListeners() {
    elements.searchInput.addEventListener('input', renderLayout);
    elements.saveBtn.addEventListener('click', saveCurrentModule);

    elements.tabSimple.addEventListener('click', () => switchTab('simple'));
    elements.tabJson.addEventListener('click', () => switchTab('json'));
    elements.tabStyle.addEventListener('click', () => switchTab('style'));

    elements.settingLayer.addEventListener('change', (e) => updateGeneralSettings('layer', e.target.value));
    elements.settingPosition.addEventListener('change', (e) => updateGeneralSettings('position', e.target.value));

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
