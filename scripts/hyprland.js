let schema = [];
let config = {};
let monitors = [];
let binds = [];
let windowrules = [];
let layerrules = [];
let execCommands = [];
let envVars = [];
let gestures = [];

let pendingChanges = {};
let migrationStatus = null;

const urlParams = new URLSearchParams(window.location.search);
let activeTab = urlParams.get('tab') || localStorage.getItem('hyprland_active_tab') || 'general';


function checkHighlight() {
    const selector = urlParams.get('highlight');
    if (selector) {

        setTimeout(() => {


            try {
                const el = document.querySelector(selector);
                if (el) {
                    el.scrollIntoView({behavior: 'smooth', block: 'center'});

                    const highlightClasses = ['ring-2', 'ring-teal-500', 'bg-teal-500/20', 'transition-all', 'duration-1000'];
                    el.classList.add(...highlightClasses);

                    setTimeout(() => el.classList.remove(...highlightClasses), 3000);
                }
            } catch (e) {
                console.warn('Invalid highlight selector:', selector);
            }
        }, 100);
    }
}


const SPECIAL_TABS = [
    {id: 'monitors', title: 'Monitors', icon: '🖥️'},
    {id: 'binds', title: 'Keybinds', icon: '⌨️'},
    {id: 'gestures', title: 'Gestures', icon: '👆'},
    {id: 'windowrules', title: 'Window Rules', icon: '🪟'},
    {id: 'layerrules', title: 'Layer Rules', icon: '📐'},
    {id: 'exec', title: 'Startup', icon: '🚀'},
    {id: 'env', title: 'Environment', icon: '🌍'}
];


document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadSchema(),
        loadConfig(),
        loadMonitors(),
        loadBinds(),
        loadWindowRules(),
        loadLayerRules(),
        loadExec(),
        loadEnv(),
        loadGestures(),

        checkMigrationStatus()
    ]);
    renderTabs();
    renderTabContent(activeTab);

    if (window.PresetManagerUI) {
        window._presetManagers['hyprland'] = new PresetManagerUI('hyprland', {
            containerId: 'preset-container',
            onActivate: async () => {
                await Promise.all([
                    loadConfig(),
                    loadMonitors(),
                    loadBinds(),
                    loadWindowRules(),
                    loadLayerRules(),
                    loadExec(),
                    loadEnv(),
                    loadGestures()
                ]);
                renderTabContent(activeTab);
                showToast('Preset activated and config reloaded', 'success');
            },
            onSave: async () => {
                await saveConfig();
            }
        });
    }


    if (migrationStatus && migrationStatus.needs_migration &&
        migrationStatus.version && migrationStatus.version.supports_new_window_rules) {
        showMigrationModal();
    }
});


function isAutosaveEnabled() {
    return typeof ArchBoard !== 'undefined' ? ArchBoard.settings.autosaveEnabled : false;
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

let openWindows = [];
let selectedWindowIndex = -1;

function updateRuleMatch(index) {
    const container = document.getElementById('match-generator-ui');

    if (index === "") {
        container.classList.add('hidden');
        document.getElementById('rule-match').value = "";
        selectedWindowIndex = -1;
        return;
    }

    selectedWindowIndex = parseInt(index);
    container.classList.remove('hidden');
    generateMatchString();
}

function generateMatchString() {
    if (selectedWindowIndex === -1 || !openWindows[selectedWindowIndex]) return;

    const win = openWindows[selectedWindowIndex];
    const checkedProps = Array.from(document.querySelectorAll('input[name="match-prop"]:checked'));


    if (checkedProps.length === 0) {

        document.getElementById('rule-match').value = "";
        return;
    }

    const mode = document.querySelector('input[name="match-mode"]:checked').value;
    const matchParts = [];

    checkedProps.forEach(checkbox => {
        const prop = checkbox.value;
        let val = win[prop] || "";


        val = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let regexVal = "";
        if (mode === 'exact') {
            regexVal = `^(${val})$`;
        } else if (mode === 'contains') {
            regexVal = `.*${val}.*`;
        } else if (mode === 'starts') {
            regexVal = `^${val}.*`;
        } else {
            regexVal = val;
        }
        let key = prop;
        if (prop === 'initialClass') key = 'initialclass';
        else if (prop === 'initialTitle') key = 'initialtitle';
        matchParts.push(`match:${key} ${regexVal}`);
    });

    document.getElementById('rule-match').value = matchParts.join(', ');
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

async function loadLayerRules() {
    try {
        const response = await fetch('/hyprland/layerrules');
        const data = await response.json();
        layerrules = data.layerrules || [];
    } catch (error) {
        console.error('Failed to load layer rules:', error);
    }
}

async function checkMigrationStatus() {
    try {
        const response = await fetch('/hyprland/migration/status');
        migrationStatus = await response.json();
    } catch (error) {
        console.error('Failed to check migration status:', error);
        migrationStatus = null;
    }
}

function showMigrationModal() {
    const versionStr = migrationStatus.version?.version || 'v0.53.0+';
    openModal(`
        <div class="text-center mb-4">
            <span class="text-4xl">🔄</span>
        </div>
        <h3 class="text-xl font-bold text-zinc-100 mb-4 text-center">Hyprland Upgrade Detected</h3>
        <p class="text-zinc-400 mb-4 text-center">
            You are running Hyprland <strong class="text-teal-400">${versionStr}</strong>. 
            Your config uses legacy window/layer rule syntax.
        </p>
        <div class="bg-zinc-800/50 rounded-lg p-4 mb-4">
            <h4 class="text-sm font-semibold text-zinc-300 mb-2">Changes detected:</h4>
            <pre class="text-xs text-zinc-500 whitespace-pre-wrap">${migrationStatus.summary || 'Legacy rules found'}</pre>
        </div>
        <p class="text-zinc-500 text-sm mb-6 text-center">
            Would you like to migrate to the new window rule syntax? A backup will be created.
        </p>
        <div class="flex justify-center gap-3">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">
                Skip (Keep Legacy)
            </button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="runMigration()">
                Migrate Config
            </button>
        </div>
    `);
}

async function runMigration() {
    try {
        const response = await fetch('/hyprland/migration/migrate', {method: 'POST'});
        const result = await response.json();

        if (result.success && result.migrated) {
            closeModal();
            showToast(`Migrated ${result.migrated_rules} rules. Backup: ${result.backup_path}`, 'success');

            await Promise.all([loadWindowRules(), loadLayerRules(), loadConfig()]);
            renderTabContent(activeTab);
        } else if (result.success && !result.migrated) {
            closeModal();
            showToast('Config already using new syntax', 'info');
        } else {
            showToast('Migration failed', 'error');
        }
    } catch (error) {
        console.error('Migration failed:', error);
        showToast('Migration failed', 'error');
    }
}


function renderTabs() {
    const nav = document.getElementById('tab-nav');


    const schemaTabs = schema.map(tab => `
        <button class="flex items-center gap-2 px-4 py-2.5 bg-transparent border-none rounded-lg text-zinc-400 text-sm cursor-pointer whitespace-nowrap hover:bg-zinc-800 hover:text-zinc-300 transition-all duration-200 ${tab.id === activeTab ? 'bg-zinc-800 text-teal-500 shadow-sm' : ''}" 
                data-tab="${tab.id}" 
                onclick="switchTab('${tab.id}')">
            <span class="text-base">${tab.icon}</span>
            <span>${tab.title}</span>
        </button>
    `).join('');


    const specialTabs = SPECIAL_TABS.map(tab => `
        <button class="flex items-center gap-2 px-4 py-2.5 bg-transparent border-none rounded-lg text-zinc-400 text-sm cursor-pointer whitespace-nowrap hover:bg-zinc-800 hover:text-zinc-300 transition-all duration-200 ${tab.id === activeTab ? 'bg-zinc-800 text-teal-500 shadow-sm' : ''}" 
                data-tab="${tab.id}" 
                onclick="switchTab('${tab.id}')">
            <span class="text-base">${tab.icon}</span>
            <span>${tab.title}</span>
        </button>
    `).join('');

    nav.innerHTML = schemaTabs + specialTabs;
}

function switchTab(tabId) {
    activeTab = tabId;
    localStorage.setItem('hyprland_active_tab', tabId);


    document.querySelectorAll('[data-tab]').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        if (isActive) {
            btn.classList.add('bg-zinc-800', 'text-teal-500', 'shadow-sm');
        } else {
            btn.classList.remove('bg-zinc-800', 'text-teal-500', 'shadow-sm');
        }
    });

    renderTabContent(tabId);
}

function renderTabContent(tabId) {
    const content = document.getElementById('tab-content');

    let html = '';
    switch (tabId) {
        case 'monitors':
            html = renderMonitorsTab();
            break;
        case 'binds':
            html = renderBindsTab();
            break;
        case 'gestures':
            html = renderGesturesTab();
            break;
        case 'windowrules':
            html = renderWindowRulesTab();
            break;
        case 'layerrules':
            html = renderLayerRulesTab();
            break;
        case 'exec':
            html = renderExecTab();
            break;
        case 'env':
            html = renderEnvTab();
            break;
        default:
            const tab = schema.find(t => t.id === tabId);
            if (tab) {
                html = tab.sections.map(section => renderSection(section)).join('');
            }
    }

    content.innerHTML = html;
    checkHighlight();
}


function renderMonitorsTab() {
    return `
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4 search-container">
            <div class="px-5 py-3.5 bg-zinc-800/30 border-b border-zinc-800 flex justify-between items-center">
                <h3 class="text-sm font-semibold text-zinc-200 uppercase tracking-wider m-0">Monitor Configuration</h3>
            </div>
            <div class="p-2">
                ${monitors.length === 0 ? '<p class="text-center text-zinc-500 p-8">No monitors configured</p>' :
        monitors.map((m, i) => `
                    <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-4 mb-3">
                        <div class="font-semibold text-teal-500 text-base mb-2">${m.name}</div>
                        <div class="flex gap-4 text-sm text-zinc-400 mb-2">
                            <span class="text-zinc-200">${m.resolution || 'disabled'}</span>
                            ${m.position ? `<span>@ ${m.position}</span>` : ''}
                            ${m.scale ? `<span>×${m.scale}</span>` : ''}
                        </div>
                        <code class="block text-xs text-zinc-500 bg-zinc-900 p-2 rounded overflow-x-auto">${m.raw}</code>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderBindsTab() {
    const listHtml = UI.renderTable({
        headers: ['Type', 'Mods', 'Key', 'Dispatcher', 'Params', 'Actions'],
        data: binds,
        emptyMessage: 'No keybinds configured',
        rowRenderer: (b) => `
            <td class="p-3 text-zinc-200"><code class="font-mono text-xs">${b.type}</code></td>
            <td class="p-3 text-zinc-200">${b.mods || '-'}</td>
            <td class="p-3 text-zinc-200"><code class="font-mono text-xs">${b.key}</code></td>
            <td class="p-3 text-zinc-200"><strong>${b.dispatcher}</strong></td>
            <td class="p-3 text-zinc-500 max-w-[200px] truncate">${b.params || '-'}</td>
            <td class="p-3 w-24 text-right">
                <div class="flex justify-end gap-2">
                    <button class="p-1 text-zinc-500 hover:text-teal-500 transition-colors" onclick="showEditBindModal('${b.type}', '${b.mods || ''}', '${b.key}', '${b.dispatcher}', '${UI.escapeParam(b.params || '')}', '${UI.escapeParam(b.raw)}')">✏️</button>
                    <button class="p-1 text-zinc-500 hover:text-red-500 transition-colors" onclick="confirmDeleteBind('${UI.escapeParam(b.raw)}')">🗑️</button>
                </div>
            </td>
        `
    });

    return `
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4 search-container">
            ${UI.renderSectionHeader('Keybinds', {label: 'Add Keybind', onclick: 'showAddBindModal()'}, binds.length)}
            ${listHtml}
        </div>
    `;
}

function renderGesturesTab() {
    return `
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4 search-container">
            <div class="px-5 py-3.5 bg-zinc-800/30 border-b border-zinc-800 flex justify-between items-center">
                <h3 class="text-sm font-semibold text-zinc-200 uppercase tracking-wider m-0">Gesture Bindings (${gestures.length})</h3>
                <button class="flex items-center gap-2 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-md text-sm transition-colors" onclick="showAddGestureModal()">+ Add Gesture</button>
            </div>
            <div class="p-0">
                ${gestures.length === 0 ? '<p class="text-center text-zinc-500 p-8">No gesture bindings configured. Add a gesture like "3, horizontal, workspace" to enable touchpad swiping.</p>' : `
                <table class="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr>
                            <th class="text-zinc-500 font-medium text-xs uppercase tracking-wider p-3 border-b border-zinc-800">Fingers</th>
                            <th class="text-zinc-500 font-medium text-xs uppercase tracking-wider p-3 border-b border-zinc-800">Direction</th>
                            <th class="text-zinc-500 font-medium text-xs uppercase tracking-wider p-3 border-b border-zinc-800">Mod/Scale</th>
                            <th class="text-zinc-500 font-medium text-xs uppercase tracking-wider p-3 border-b border-zinc-800">Action</th>
                            <th class="text-zinc-500 font-medium text-xs uppercase tracking-wider p-3 border-b border-zinc-800">Params</th>
                            <th class="text-zinc-500 font-medium text-xs uppercase tracking-wider p-3 border-b border-zinc-800">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gestures.map(g => {
        const actionDisplay = g.action === 'dispatcher' ? `dispatcher: ${g.dispatcher}` : g.action;
        const modScale = [g.mod ? `mod: ${g.mod}` : '', g.scale ? `scale: ${g.scale}` : ''].filter(x => x).join(', ') || '-';
        return `
                            <tr class="hover:bg-zinc-800/40 border-b border-zinc-800">
                                <td class="p-3 text-zinc-200"><code class="font-mono text-xs">${g.fingers}</code></td>
                                <td class="p-3 text-zinc-200">${g.direction}</td>
                                <td class="p-3 text-zinc-200">${modScale}</td>
                                <td class="p-3 text-zinc-200"><strong>${actionDisplay}</strong></td>
                                <td class="p-3 text-zinc-500 max-w-[200px] truncate">${g.params || '-'}</td>
                                <td class="p-3 flex gap-2">
                                    <button class="p-1 text-zinc-500 hover:text-teal-500 transition-colors" onclick="showEditGestureModal('${g.fingers}', '${g.direction}', '${g.action}', '${UI.escapeParam(g.params || '')}', '${UI.escapeParam(g.raw)}', '${UI.escapeParam(g.dispatcher || '')}', '${UI.escapeParam(g.mod || '')}', '${UI.escapeParam(g.scale || '')}')">✏️</button>
                                    <button class="p-1 text-zinc-500 hover:text-red-500 transition-colors" onclick="confirmDeleteGesture('${UI.escapeParam(g.raw)}')">🗑️</button>
                                </td>
                            </tr>
                        `
    }).join('')}
                    </tbody>
                </table>`}
            </div>
        </div>
    `;
}

function renderWindowRulesTab() {
    const listHtml = UI.renderTable({
        headers: ['Type', 'Effect', 'Match', 'Actions'],
        data: windowrules,
        emptyMessage: 'No window rules configured',
        rowRenderer: (r) => `
            <td class="p-3 w-24">
                <code class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-teal-500 font-mono">${r.type}</code>
            </td>
            <td class="p-3">
                <span class="text-zinc-200 font-medium text-sm">${r.effect}</span>
            </td>
            <td class="p-3 text-zinc-500 text-xs font-mono">
                ${r.match}
            </td>
            <td class="p-3 w-24 text-right">
                <div class="flex justify-end gap-2">
                    <button class="p-1 text-zinc-500 hover:text-teal-500 transition-colors" onclick="showEditRuleModal('${r.type}', '${r.effect}', '${UI.escapeParam(r.match)}', '${UI.escapeParam(r.raw)}')">✏️</button>
                    <button class="p-1 text-zinc-500 hover:text-red-500 transition-colors" onclick="confirmDeleteRule('${UI.escapeParam(r.raw)}')">🗑️</button>
                </div>
            </td>
        `
    });

    return `
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4 search-container">
            ${UI.renderSectionHeader('Window Rules', {
        label: 'Add Rule',
        onclick: 'showAddRuleModal()'
    }, windowrules.length)}
            ${listHtml}
        </div>
    `;
}

function renderLayerRulesTab() {
    const listHtml = UI.renderTable({
        headers: ['Type', 'Effect', 'Namespace', 'Actions'],
        data: layerrules,
        emptyMessage: 'No layer rules configured. Layer rules affect surfaces like waybar, rofi, notifications, etc.',
        rowRenderer: (r) => `
            <td class="p-3 w-24">
                <code class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-purple-500 font-mono">layerrule</code>
            </td>
            <td class="p-3">
                <span class="text-zinc-200 font-medium text-sm">${r.effect}</span>
            </td>
            <td class="p-3">
                <span class="text-zinc-500 text-xs">→ ${r.namespace}</span>
            </td>
            <td class="p-3 w-24 text-right">
                <div class="flex justify-end gap-2">
                    <button class="p-1 text-zinc-500 hover:text-teal-500 transition-colors" onclick="showEditLayerRuleModal('${UI.escapeParam(r.effect)}', '${UI.escapeParam(r.namespace)}', '${UI.escapeParam(r.raw)}')">✏️</button>
                    <button class="p-1 text-zinc-500 hover:text-red-500 transition-colors" onclick="confirmDeleteLayerRule('${UI.escapeParam(r.raw)}')">🗑️</button>
                </div>
            </td>
        `
    });

    return `
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4 search-container">
            ${UI.renderSectionHeader('Layer Rules', {
        label: 'Add Layer Rule',
        onclick: 'showAddLayerRuleModal()'
    }, layerrules.length)}
            ${listHtml}
        </div>
        <div class="bg-zinc-800/30 rounded-lg p-4 text-sm text-zinc-500">
            <strong class="text-zinc-400">💡 Common Layer Rules:</strong>
            <ul class="mt-2 space-y-1">
                <li><code class="text-teal-500">blur</code> - Apply blur effect to layer surface</li>
                <li><code class="text-teal-500">ignorezero</code> - Ignore fully transparent pixels</li>
                <li><code class="text-teal-500">ignorealpha 0.5</code> - Ignore pixels with alpha below threshold</li>
                <li><code class="text-teal-500">animation slide</code> - Set animation style (slide, popin, fade)</li>
                <li><code class="text-teal-500">noanim</code> - Disable animations</li>
            </ul>
        </div>
    `;
}


function renderExecTab() {
    const listHtml = UI.renderTable({
        headers: ['Type', 'Command', 'Actions'],
        data: execCommands,
        emptyMessage: 'No startup commands configured',
        rowRenderer: (c) => `
            <td class="p-3 w-32">
                <code class="bg-zinc-800 px-2 py-0.5 rounded text-xs ${c.type === 'exec-once' ? 'text-purple-500' : 'text-blue-500'} font-mono">${c.type}</code>
            </td>
            <td class="p-3">
                <code class="text-zinc-300 text-sm font-mono break-all">${c.command}</code>
            </td>
            <td class="p-3 w-24 text-right">
                <div class="flex justify-end gap-2">
                    <button class="p-1 text-zinc-500 hover:text-teal-500 transition-colors" onclick="showEditExecModal('${c.type}', '${UI.escapeParam(c.command)}')">✏️</button>
                    <button class="p-1 text-zinc-500 hover:text-red-500 transition-colors" onclick="confirmDeleteExec('${c.type}', '${UI.escapeParam(c.command)}')">🗑️</button>
                </div>
            </td>
        `
    });

    return `
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4 search-container">
            ${UI.renderSectionHeader('Startup Commands', {
        label: 'Add Command',
        onclick: 'showAddExecModal()'
    }, execCommands.length)}
            ${listHtml}
        </div>
    `;
}

function renderEnvTab() {

    function getCategory(name) {
        name = name.toUpperCase();
        if (name.startsWith('GTK') || name.startsWith('GDK')) return 'GTK/GDK';
        if (name.startsWith('QT')) return 'QT';
        if (name.startsWith('XDG')) return 'XDG';
        if (name.startsWith('XCURSOR')) return 'XCURSOR';
        if (name.includes('NVIDIA') || name.startsWith('__GL') || name === 'GBM_BACKEND' || name === 'LIBVA_DRIVER_NAME') return 'NVIDIA';
        if (name.startsWith('AQ_')) return 'AQ (Aquamarine)';
        if (name.startsWith('HYPRLAND')) return 'HYPRLAND';
        return 'Other';
    }

    const listHtml = UI.renderTable({
        headers: ['Category', 'Variable', 'Value', 'Actions'],
        data: envVars,
        emptyMessage: 'No environment variables configured',
        rowRenderer: (env) => {
            const category = getCategory(env.name);
            return `
            <td class="p-3 w-32">
                 <span class="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-700/10">${category}</span>
            </td>
            <td class="p-3">
                <code class="text-teal-500 text-sm font-mono font-medium">${env.name}</code>
            </td>
            <td class="p-3">
                <code class="text-zinc-400 text-sm font-mono break-all">${env.value}</code>
            </td>
            <td class="p-3 w-24 text-right">
                <div class="flex justify-end gap-2">
                    <button class="p-1 text-zinc-500 hover:text-teal-500 transition-colors" onclick="showEditEnvModal('${env.name}', '${UI.escapeParam(env.value)}')">✏️</button>
                    <button class="p-1 text-zinc-500 hover:text-red-500 transition-colors" onclick="confirmDeleteEnv('${env.name}')">🗑️</button>
                </div>
            </td>
            `;
        }
    });

    return `
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4 search-container">
            ${UI.renderSectionHeader('Environment Variables', {
        label: 'Add Variable',
        onclick: 'showAddEnvModal()'
    }, envVars.length)}
            ${listHtml}
        </div>
    `;
}


function renderSection(section) {
    return `
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4 search-container">
            ${UI.renderSectionHeader(section.title, null)}
            <div class="p-2">
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
        <div class="searchable-item flex justify-between items-center px-4 py-3.5 hover:bg-zinc-800/40 transition-colors rounded-lg mb-1 ${hasChange ? 'bg-teal-500/5 border-l-2 border-teal-500' : ''}" data-path="${path}">
            <div class="flex-1 min-w-0 mr-4">
                <label class="block text-sm font-medium text-zinc-200 mb-0.5">${formatLabel(option.name)}</label>
                <span class="block text-xs text-zinc-500 truncate max-w-md">${option.description}</span>
            </div>
            <div class="flex-shrink-0">
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
        <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="sr-only peer" ${checked ? 'checked' : ''}
                onchange="updateValue('${path}', this.checked)">
                <div class="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
            </label>
    `;
}

function renderSlider(path, option, value) {
    const parsed = parseFloat(value);
    const numValue = isNaN(parsed) ? option.default : parsed;
    const step = option.step || (option.type === 'float' ? 0.1 : 1);
    return `
        <div class="flex items-center gap-3 min-w-[180px]">
            <input type="range" class="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                min="${option.min}" max="${option.max}" step="${step}"
                value="${numValue}"
                oninput="updateSlider('${path}', this.value, this.parentElement)">
                <span class="slider-value min-w-[40px] text-right text-sm font-medium text-zinc-200">${numValue}</span>
            </div>
    `;
}

function renderNumberInput(path, option, value) {
    return `
        <input type="number" class="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm text-center focus:outline-none focus:border-teal-500 transition-colors" value="${value}"
               ${option.min !== null ? `min="${option.min}"` : ''}
               ${option.max !== null ? `max="${option.max}"` : ''}
               ${option.step ? `step="${option.step}"` : ''}
               onchange="updateValue('${path}', this.value)">
    `;
}

function renderColorInput(path, value) {
    const hexColor = hyprColorToHex(value);
    return `
        <div class="flex items-center gap-2">
            <input type="color" value="${hexColor}" class="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                onchange="updateColor('${path}', this.value)">
                <input type="text" class="w-28 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-xs font-mono focus:outline-none focus:border-teal-500" value="${value}"
                    onchange="updateValue('${path}', this.value)">
                </div>
                `;
}

function renderSelect(path, option, value) {
    return `
                <select class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors cursor-pointer" onchange="updateValue('${path}', this.value)">
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
                <div class="flex gap-2">
                    <input type="number" class="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm text-center focus:outline-none focus:border-teal-500" value="${x}" placeholder="X"
                        onchange="updateVec2('${path}', this.value, null)">
                        <input type="number" class="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm text-center focus:outline-none focus:border-teal-500" value="${y}" placeholder="Y"
                            onchange="updateVec2('${path}', null, this.value)">
                        </div>
                        `;
}

function renderTextInput(path, value) {
    return `
                        <input type="text" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${value}"
                            onchange="updateValue('${path}', this.value)">
                            `;
}


function updateValue(path, value) {
    pendingChanges[path] = value;
    config[path] = value;
    markChanged(path);
    updateSaveButton();


    if (isAutosaveEnabled()) {
        debouncedSave();
    }
}


let saveTimeout = null;

function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await saveConfig();

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

    const currentValue = config[path];


    const newColorValue = ColorUtils.formatUpdate(currentValue, hexValue);

    updateValue(path, newColorValue);


    const option = document.querySelector(`[data-path="${path}"] .color-text`);
    if (option) option.value = newColorValue;
}

function updateVec2(path, x, y) {
    const current = String(config[path] || '0 0').split(' ');
    const newX = x !== null ? x : current[0];
    const newY = y !== null ? y : current[1];
    updateValue(path, `${newX} ${newY}`);
}

function markChanged(path) {
    const el = document.querySelector(`[data-path="${path}"]`);
    if (el) {
        el.classList.add('bg-teal-500/5', 'border-l-2', 'border-teal-500');
    }
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


    renderPresetSelector();
}


async function saveConfig() {
    if (Object.keys(pendingChanges).length === 0) {
        showToast('No changes to save', 'info');
        return;
    }

    try {
        const response = await fetch('/hyprland/config/bulk', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({updates: pendingChanges})
        });

        if (!response.ok) throw new Error('Failed to save');


        pendingChanges = {};
        document.querySelectorAll('[data-path]').forEach(el => {
            el.classList.remove('bg-teal-500/5', 'border-l-2', 'border-teal-500');
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
        const response = await fetch('/hyprland/reload', {method: 'POST'});
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


function hyprColorToHex(color) {
    return ColorUtils.toHex(color);
}


function openModal(content) {
    const pageOverlay = document.getElementById('modal-overlay');
    if (pageOverlay) {
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = content;
        pageOverlay.classList.add('active');
    } else {
        openGlobalModal(content);
    }
}

function closeModal() {
    const pageOverlay = document.getElementById('modal-overlay');
    if (pageOverlay) {
        pageOverlay.classList.remove('active');
    } else {
        closeGlobalModal();
    }
}


function showAddEnvModal() {
    openModal(`
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">Add Environment Variable</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Variable Name</label>
                <input type="text" id="env-name" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., GTK_THEME">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Value</label>
                <input type="text" id="env-value" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., Nord">
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="addEnvVar()">Add</button>
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'add', name, value})
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
    const escapedValue = UI.escapeParam(value);

    openModal(`
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">Edit Environment Variable</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Variable Name</label>
                <input type="text" id="env-name" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${name}">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Value</label>
                <input type="text" id="env-value" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${value}">
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="updateEnvVar('${name}')">Save</button>
        </div>
    `);
}

async function updateEnvVar(oldName) {
    const name = document.getElementById('env-name').value.trim();
    const value = document.getElementById('env-value').value.trim();

    try {
        await fetch('/hyprland/env', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'update', name, value, old_name: oldName})
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'delete', name, value: ''})
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
        `function() { deleteEnvVar('${UI.escapeParam(name)}') }`);
}


function showAddExecModal() {
    openModal(`
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">Add Startup Command</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="mb-4">
                <label class="block text-zinc-400 text-sm mb-1">Type</label>
                <select id="exec-type" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
                    <option value="exec-once">exec-once (Startup)</option>
                    <option value="exec">exec (Always)</option>
                </select>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Command</label>
                <input type="text" id="exec-command" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., waybar">
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="addExecCommand()">Add</button>
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'add', type, command})
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'delete', type, command})
        });
        await loadExec();
        renderTabContent('exec');
        showToast('Command deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteExec(type, command) {
    const escapedCmd = UI.escapeParam(command);
    confirmDialog('Delete Command',
        `Are you sure you want to delete this command?`,
        `function() {deleteExecCommand('${type}', '${escapedCmd}')}`);
}

function showEditExecModal(type, command) {
    const escapedCmd = UI.escapeParam(command);
    openModal(`
                            <div class="flex items-center justify-between mb-6">
                                <h3 class="text-xl font-bold text-white">Edit Startup Command</h3>
                                <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
                            </div>
                            <div class="mb-6">
                                <div class="w-1/3">
                                    <label class="block text-zinc-400 text-xs mb-1">Type</label>
                                    <select id="exec-type" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
                                        <option value="exec-once" ${type === 'exec-once' ? 'selected' : ''}>exec-once</option>
                                        <option value="exec" ${type === 'exec' ? 'selected' : ''}>exec</option>
                                    </select>
                                </div>
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-zinc-400 mb-1.5">Command</label>
                                    <input type="text" id="exec-command" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${escapedCmd}">
                                </div>
                            </div>
                            <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
                                <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
                                <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="updateExecCommand('${type}', '${command.replace(/'/g, "\\'")}')">Save</button>
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'update', type, command, old_command: oldCommand})
        });
        closeModal();
        await loadExec();
        renderTabContent('exec');
        showToast('Command updated', 'success');
    } catch (e) {
        showToast('Failed to update', 'error');
    }
}


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
        const windowOptions = openWindows.map((w, index) =>
            `<option value="${index}">${w.class} - ${w.title ? w.title.substring(0, 30) : 'No Title'}</option>`
        ).join('');

        openModal(`
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-bold text-white">Add Window Rule</h3>
                <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
            </div>
            <div class="mb-6">
                <input type="hidden" id="rule-type" value="windowrule">
                <div class="mb-4">
                    <label class="block text-zinc-400 text-sm mb-1">Effect</label>
                <label class="block text-zinc-400 text-sm mb-1">Effect</label>
                <div class="space-y-2">
                    <!-- Manual Input -->
                    <input type="text" id="rule-effect-input" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., float, center, opacity 0.9">
                    
                    <!-- Presets -->
                    <div class="relative">
                        <select id="rule-effect-preset" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors appearance-none text-zinc-400" onchange="document.getElementById('rule-effect-input').value = this.value; this.value = '';">
                            <option value="">Select a preset to fill above...</option>
                            <!-- Common effects -->
                            <optgroup label="Window State">
                                <option value="float">Float</option>
                                <option value="tile">Tile</option>
                                <option value="fullscreen">Fullscreen</option>
                                <option value="maximize">Maximize</option>
                                <option value="nofocus">No Focus</option>
                                <option value="pin">Pin</option>
                                <option value="center">Center</option>
                            </optgroup>
                            <optgroup label="Appearance">
                                <option value="opacity 0.9">Opacity 0.9</option>
                                <option value="noborder">No Border</option>
                                <option value="noshadow">No Shadow</option>
                                <option value="noblur">No Blur</option>
                            </optgroup>
                            <optgroup label="Workspace">
                                <option value="workspace 1">Workspace 1</option>
                                <option value="workspace special">Special Workspace</option>
                            </optgroup>
                            <optgroup label="Size/Position">
                                <option value="size 80% 80%">Size 80% 80%</option>
                                <option value="size 1000 600">Size 1000x600</option>
                                <option value="exactsize 800 400">Exact Size 800x400</option>
                                <option value="min_size 200 200">Min Size 200x200</option>
                                <option value="max_size 1200 800">Max Size 1200x800</option>
                                <option value="move 100 50">Move 100x50</option>
                                <option value="move 0 0">Move to Top-Left</option>
                            </optgroup>
                            <optgroup label="Other">
                                <option value="noinitialfocus">No Initial Focus</option>
                                <option value="noanim">No Animation</option>
                                <option value="windowdance">Window Dance</option>
                                <option value="noopaque">No Opaque</option>
                                <option value="forceinput">Force Input</option>
                                <option value="animation slide">Animation Slide</option>
                                <option value="animation popin">Animation Pop-in</option>
                                <option value="animation fade">Animation Fade</option>
                            </optgroup>
                        </select>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-zinc-400 text-sm mb-1">Select Open Window</label>
                <div class="relative">
                <div class="mb-4">
                    <label class="block text-zinc-400 text-sm mb-1">Select Open Window</label>
                    <div class="relative">
                        <select id="rule-window-select" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors appearance-none" onchange="updateRuleMatch(this.value)">
                            <option value="">-- Select a window to auto-fill --</option>
                            ${windowOptions}
                        </select>
                    </div>
                </div>

                <!-- Match Generator UI -->
                <div id="match-generator-ui" class="hidden mb-4 p-4 bg-zinc-900/50 rounded-md border border-zinc-700/50">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-xs text-zinc-500 mb-2 uppercase font-bold tracking-wider">Match Property</div>
                            <div class="space-y-2" id="match-props-container">
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" name="match-prop" value="class" checked onchange="generateMatchString()" class="text-teal-500 rounded border-zinc-600 bg-zinc-800 focus:ring-teal-500">
                                    <span class="text-sm text-zinc-300">Class</span>
                                </label>
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" name="match-prop" value="title" onchange="generateMatchString()" class="text-teal-500 rounded border-zinc-600 bg-zinc-800 focus:ring-teal-500">
                                    <span class="text-sm text-zinc-300">Title</span>
                                </label>
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" name="match-prop" value="initialClass" onchange="generateMatchString()" class="text-teal-500 rounded border-zinc-600 bg-zinc-800 focus:ring-teal-500">
                                    <span class="text-sm text-zinc-300">Initial Class</span>
                                </label>
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" name="match-prop" value="initialTitle" onchange="generateMatchString()" class="text-teal-500 rounded border-zinc-600 bg-zinc-800 focus:ring-teal-500">
                                    <span class="text-sm text-zinc-300">Initial Title</span>
                                </label>
                            </div>
                            </div>
                        </div>
                        <div>
                            <div class="text-xs text-zinc-500 mb-2 uppercase font-bold tracking-wider">Precision</div>
                            <div class="space-y-2">
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="match-mode" value="exact" checked onclick="generateMatchString()" class="text-teal-500 focus:ring-teal-500 bg-zinc-800 border-zinc-600">
                                    <span class="text-sm text-zinc-300">Exact Match (^...$)</span>
                                </label>
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="match-mode" value="starts" onclick="generateMatchString()" class="text-teal-500 focus:ring-teal-500 bg-zinc-800 border-zinc-600">
                                    <span class="text-sm text-zinc-300">Starts With (^...)</span>
                                </label>
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="match-mode" value="contains" onclick="generateMatchString()" class="text-teal-500 focus:ring-teal-500 bg-zinc-800 border-zinc-600">
                                    <span class="text-sm text-zinc-300">Contains (.*...*)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-zinc-400 mb-1.5">Or enter match manually</label>
                    <input type="text" id="rule-match" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., class:firefox">
                </div>
            </div>
            <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
                <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
                <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="addWindowRule()">Add</button>
            </div>
        `);
    });
}

async function addWindowRule() {
    const type = document.getElementById('rule-type').value;
    const effect = document.getElementById('rule-effect-input').value.trim();
    const match = document.getElementById('rule-match').value.trim();
    if (!match) return showToast('Match criteria is required', 'error');

    try {
        await fetch('/hyprland/windowrules', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'add', type, effect, match})
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'delete', type: '', effect: '', match: '', old_raw: raw})
        });
        await loadWindowRules();
        renderTabContent('windowrules');
        showToast('Window rule deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteRule(raw) {
    const escapedRaw = UI.escapeParam(raw);
    confirmDialog('Delete Window Rule',
        `Are you sure you want to delete this rule?`,
        `function() {deleteWindowRule('${escapedRaw}')}`);
}

function showEditRuleModal(type, effect, match, raw) {
    const escapedMatch = UI.escapeParam(match);
    const escapedRaw = UI.escapeParam(raw);

    openModal(`
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xl font-bold text-white">Edit Window Rule</h3>
                            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
                        </div>
                        <div class="mb-6">
                            <input type="hidden" id="rule-type" value="windowrule">
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-zinc-400 mb-1.5">Effect</label>
                                    <input type="text" id="rule-effect" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${effect}">
                                </div>
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-zinc-400 mb-1.5">Match</label>
                                    <input type="text" id="rule-match" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${escapedMatch}">
                                </div>
                        </div>
                        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
                            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
                            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="updateWindowRule('${escapedRaw}')">Save</button>
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'update', type, effect, match, old_raw: oldRaw})
        });
        closeModal();
        await loadWindowRules();
        renderTabContent('windowrules');
        showToast('Window rule updated', 'success');
    } catch (e) {
        showToast('Failed to update', 'error');
    }
}


function showAddLayerRuleModal() {
    openModal(`
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">Add Layer Rule</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Effect</label>
                <div class="space-y-2">
                    <input type="text" id="layerrule-effect-input" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., blur, ignorezero, ignore_alpha 0.5">
                    <select id="layerrule-effect-preset" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors appearance-none text-zinc-400" onchange="document.getElementById('layerrule-effect-input').value = this.value; this.value = '';">
                        <option value="" disabled selected>Select a preset...</option>
                        <option value="blur">Blur (Standard)</option>
                        <option value="ignorezero">Ignore Zero (Transparent Pixels)</option>
                        <option value="ignore_alpha 0.5">Ignore Alpha 0.5 (Semi-transparent)</option>
                        <option value="noanim">No Animation</option>
                        <option value="animation slide">Animation: Slide</option>
                        <option value="animation popin">Animation: Popin</option>
                        <option value="animation fade">Animation: Fade</option>
                        <option value="dimaround">Dim Around</option>
                        <option value="stay_focused">Stay Focused</option>
                    </select>
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Namespace (Layer Surface)</label>
                <input type="text" id="layerrule-namespace" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., waybar, rofi, swaync">
                <small class="text-zinc-500 mt-1 block">Common namespaces: waybar, rofi, wofi, swaync, gtk-layer-shell</small>
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="addLayerRule()">Add</button>
        </div>
    `);
}

async function addLayerRule() {
    const effect = document.getElementById('layerrule-effect-input').value.trim();
    const namespace = document.getElementById('layerrule-namespace').value.trim();

    if (!namespace) {
        return showToast('Please enter a namespace', 'error');
    }

    try {
        await fetch('/hyprland/layerrules', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'add',
                effect,
                namespace
            })
        });
        closeModal();
        await loadLayerRules();
        renderTabContent('layerrules');
        showToast('Layer rule added', 'success');
    } catch (e) {
        showToast('Failed to add', 'error');
    }
}

function showEditLayerRuleModal(effect, namespace, raw) {
    const escapedEffect = UI.escapeParam(effect);
    const escapedNamespace = UI.escapeParam(namespace);
    const escapedRaw = UI.escapeParam(raw);

    openModal(`
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">Edit Layer Rule</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Effect</label>
                <div class="space-y-2">
                    <input type="text" id="layerrule-effect-input" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${escapedEffect}">
                    <select id="layerrule-effect-preset" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors appearance-none text-zinc-400" onchange="document.getElementById('layerrule-effect-input').value = this.value; this.value = '';">
                        <option value="" disabled selected>Or choose a preset...</option>
                        <option value="blur">Blur (Standard)</option>
                        <option value="ignorezero">Ignore Zero</option>
                        <option value="ignore_alpha 0.5">Ignore Alpha 0.5</option>
                        <option value="noanim">No Animation</option>
                        <option value="stay_focused">Stay Focused</option>
                    </select>
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Namespace</label>
                <input type="text" id="layerrule-namespace" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${escapedNamespace}">
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="updateLayerRule('${escapedRaw}')">Save</button>
        </div>
    `);
}

async function updateLayerRule(oldRaw) {
    const effect = document.getElementById('layerrule-effect-input').value.trim();
    const namespace = document.getElementById('layerrule-namespace').value.trim();

    try {
        await fetch('/hyprland/layerrules', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'update',
                effect,
                namespace,
                old_raw: oldRaw
            })
        });
        closeModal();
        await loadLayerRules();
        renderTabContent('layerrules');
        showToast('Layer rule updated', 'success');
    } catch (e) {
        showToast('Failed to update', 'error');
    }
}

async function deleteLayerRule(raw) {
    try {
        await fetch('/hyprland/layerrules', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'delete',
                effect: '',
                namespace: '',
                old_raw: raw
            })
        });
        await loadLayerRules();
        renderTabContent('layerrules');
        showToast('Layer rule deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteLayerRule(raw) {
    const escapedRaw = UI.escapeParam(raw);
    confirmDialog('Delete Layer Rule',
        'Are you sure you want to delete this layer rule?',
        `function() {deleteLayerRule('${escapedRaw}')}`);
}


let capturedMods = [];
let capturedKey = '';


const DISPATCHERS = {

    exec: {desc: "Execute shell command", param: "command (e.g., kitty, firefox)", category: "Commands"},
    execr: {desc: "Execute raw shell command", param: "command", category: "Commands"},
    pass: {desc: "Pass key to window", param: "window", category: "Commands"},
    sendshortcut: {desc: "Send keys to window", param: "mod, key[, window]", category: "Commands"},
    global: {desc: "Execute Global Shortcut", param: "name", category: "Commands"},


    killactive: {desc: "Close active window", param: "none", category: "Window Actions"},
    forcekillactive: {desc: "Force kill active window", param: "none", category: "Window Actions"},
    closewindow: {desc: "Close specified window", param: "window", category: "Window Actions"},
    togglefloating: {desc: "Toggle floating state", param: "empty/window", category: "Window Actions"},
    setfloating: {desc: "Set floating", param: "empty/window", category: "Window Actions"},
    settiled: {desc: "Set tiled", param: "empty/window", category: "Window Actions"},
    fullscreen: {desc: "Toggle fullscreen", param: "0=full, 1=maximize", category: "Window Actions"},
    pin: {desc: "Pin window to all workspaces", param: "empty/window", category: "Window Actions"},
    centerwindow: {desc: "Center floating window", param: "none/1", category: "Window Actions"},


    movefocus: {desc: "Move focus direction", param: "l/r/u/d", category: "Focus & Movement"},
    movewindow: {desc: "Move window direction/monitor", param: "l/r/u/d or mon:NAME", category: "Focus & Movement"},
    swapwindow: {desc: "Swap with window in direction", param: "l/r/u/d or window", category: "Focus & Movement"},
    focuswindow: {desc: "Focus specific window", param: "window (class:, title:, etc)", category: "Focus & Movement"},
    focusmonitor: {desc: "Focus a monitor", param: "monitor (l/r/+1/-1/name)", category: "Focus & Movement"},
    cyclenext: {desc: "Focus next/prev window", param: "none/prev/tiled/floating", category: "Focus & Movement"},
    swapnext: {desc: "Swap with next window", param: "none/prev", category: "Focus & Movement"},
    bringactivetotop: {desc: "Bring window to top", param: "none", category: "Focus & Movement"},
    alterzorder: {desc: "Change window stack order", param: "top/bottom[,window]", category: "Focus & Movement"},


    workspace: {desc: "Switch workspace", param: "ID/+1/-1/name:X/special", category: "Workspaces"},
    movetoworkspace: {desc: "Move window to workspace", param: "workspace[,window]", category: "Workspaces"},
    movetoworkspacesilent: {desc: "Move without switching", param: "workspace[,window]", category: "Workspaces"},
    togglespecialworkspace: {desc: "Toggle scratchpad", param: "none/name", category: "Workspaces"},
    focusworkspaceoncurrentmonitor: {desc: "Focus workspace on current", param: "workspace", category: "Workspaces"},
    movecurrentworkspacetomonitor: {desc: "Move workspace to monitor", param: "monitor", category: "Workspaces"},
    swapactiveworkspaces: {
        desc: "Swap workspaces between monitors",
        param: "monitor1 monitor2",
        category: "Workspaces"
    },


    resizeactive: {desc: "Resize active window", param: "X Y (e.g., 10 -10, 20%)", category: "Resize"},
    moveactive: {desc: "Move active window", param: "X Y", category: "Resize"},
    resizewindowpixel: {desc: "Resize specific window", param: "X Y,window", category: "Resize"},
    movewindowpixel: {desc: "Move specific window", param: "X Y,window", category: "Resize"},
    splitratio: {desc: "Change split ratio", param: "+0.1/-0.1/exact 0.5", category: "Resize"},


    togglegroup: {desc: "Toggle window group", param: "none", category: "Groups"},
    changegroupactive: {desc: "Switch in group", param: "b/f or index", category: "Groups"},
    lockgroups: {desc: "Lock all groups", param: "lock/unlock/toggle", category: "Groups"},
    lockactivegroup: {desc: "Lock current group", param: "lock/unlock/toggle", category: "Groups"},
    moveintogroup: {desc: "Move into group", param: "l/r/u/d", category: "Groups"},
    moveoutofgroup: {desc: "Move out of group", param: "empty/window", category: "Groups"},


    exit: {desc: "Exit Hyprland", param: "none", category: "System"},
    dpms: {desc: "Toggle DPMS", param: "on/off/toggle", category: "System"},
    forcerendererreload: {desc: "Reload renderer", param: "none", category: "System"},
    submap: {desc: "Switch submap", param: "reset/name", category: "System"},


    togglesplit: {desc: "Toggle split orientation", param: "none", category: "Layout"},
    pseudo: {desc: "Toggle pseudo-tiling", param: "none", category: "Layout"},
    layoutmsg: {desc: "Send layout message", param: "message", category: "Layout"},
};

function getDispatcherOptions() {
    const categories = {};
    for (const [name, info] of Object.entries(DISPATCHERS)) {
        if (!categories[info.category]) categories[info.category] = [];
        categories[info.category].push({name, desc: info.desc});
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
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-bold text-white">Add Keybind</h3>
                        <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
                    </div>
                    <div class="mb-6">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Press your key combination</label>
                            <div id="key-capture-box" class="w-full h-32 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-zinc-800 transition-all focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" tabindex="0" onkeydown="captureKey(event)">
                                <div class="text-xl font-mono text-zinc-200 mb-2 font-bold" id="key-display">Click here and press keys</div>
                                <div class="text-sm text-zinc-500">Hold modifiers (SUPER, ALT, CTRL, SHIFT) and press a key</div>
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Bind Type</label>
                            <select id="bind-type" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
                                <option value="bind">bind - Normal keybind</option>
                                <option value="binde">binde - Repeat while held</option>
                                <option value="bindm">bindm - Mouse bind</option>
                                <option value="bindl">bindl - Works when locked</option>
                                <option value="bindr">bindr - On key release</option>
                                <option value="bindel">bindel - Repeat + locked</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Dispatcher (Action)</label>
                            <select id="bind-dispatcher" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" onchange="updateParamHint()">
                                ${getDispatcherOptions()}
                            </select>
                            <small id="param-hint" class="block mt-1 text-xs text-zinc-500">Parameter: command (e.g., kitty, firefox)</small>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Parameters</label>
                            <input type="text" id="bind-params" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="Enter parameters based on dispatcher">
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
                        <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
                        <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="addBind()">Add</button>
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


    if (['CONTROL', 'ALT', 'SHIFT', 'META', 'SUPER'].includes(key)) {
        capturedMods = mods;
        document.getElementById('key-display').textContent = mods.join(' + ') + ' + ...';
        return;
    }


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
    document.getElementById('key-capture-box').classList.add('ring-2', 'ring-teal-500', 'border-teal-500', 'bg-zinc-800');
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
            headers: {'Content-Type': 'application/json'},
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'delete', type: '', mods: '', key: '', dispatcher: '', old_raw: raw})
        });
        await loadBinds();
        renderTabContent('binds');
        showToast('Keybind deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteBind(raw) {
    const escapedRaw = UI.escapeParam(raw);
    confirmDialog('Delete Keybind',
        `Are you sure you want to delete this keybind?`,
        `function() {deleteBind('${escapedRaw}')}`);
}

function getDispatcherOptionsWithSelected(selected) {
    const categories = {};
    for (const [name, info] of Object.entries(DISPATCHERS)) {
        if (!categories[info.category]) categories[info.category] = [];
        categories[info.category].push({name, desc: info.desc});
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
    const escapedRaw = UI.escapeParam(raw);
    const escapedParams = UI.escapeParam(params || '');


    capturedMods = mods ? mods.match(/(SUPER|ALT|CTRL|SHIFT)/g) || [] : [];
    capturedKey = key;

    const modsDisplay = capturedMods.length > 0 ? capturedMods.join(' + ') + ' + ' + key : key;
    const paramHint = DISPATCHERS[dispatcher]?.param || 'parameters';

    openModal(`
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-white">Edit Keybind</h3>
                    <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
                </div>
                <div class="mb-6">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-zinc-400 mb-1.5">Press your key combination</label>
                        <div id="key-capture-box" class="w-full h-32 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-zinc-800 transition-all focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" tabindex="0" onkeydown="captureKey(event)">
                            <div class="text-xl font-mono text-zinc-200 mb-2 font-bold" id="key-display">${modsDisplay}</div>
                            <div class="text-sm text-zinc-500">Click and press new keys to change</div>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-zinc-400 mb-1.5">Bind Type</label>
                        <select id="bind-type" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
                            <option value="bind" ${type === 'bind' ? 'selected' : ''}>bind - Normal keybind</option>
                            <option value="binde" ${type === 'binde' ? 'selected' : ''}>binde - Repeat while held</option>
                            <option value="bindm" ${type === 'bindm' ? 'selected' : ''}>bindm - Mouse bind</option>
                            <option value="bindl" ${type === 'bindl' ? 'selected' : ''}>bindl - Works when locked</option>
                            <option value="bindr" ${type === 'bindr' ? 'selected' : ''}>bindr - On key release</option>
                            <option value="bindel" ${type === 'bindel' ? 'selected' : ''}>bindel - Repeat + locked</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-zinc-400 mb-1.5">Dispatcher (Action)</label>
                        <select id="bind-dispatcher" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" onchange="updateParamHint()">
                            ${getDispatcherOptionsWithSelected(dispatcher)}
                        </select>
                        <small id="param-hint" class="block mt-1 text-xs text-zinc-500">Parameter: ${paramHint}</small>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-zinc-400 mb-1.5">Parameters</label>
                        <input type="text" id="bind-params" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${escapedParams}">
                    </div>
                </div>
                <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
                    <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
                    <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="updateBind('${escapedRaw}')">Save</button>
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
            headers: {'Content-Type': 'application/json'},
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


function getGestureActionOptions(selected = '') {
    const actions = [
        {value: 'workspace', desc: 'Workspace swipe gesture'},
        {value: 'move', desc: 'Move active window'},
        {value: 'resize', desc: 'Resize active window'},
        {value: 'special', desc: 'Toggle special workspace'},
        {value: 'close', desc: 'Close active window'},
        {value: 'fullscreen', desc: 'Fullscreen (none or maximize)'},
        {value: 'float', desc: 'Float window (toggle/float/tile)'},
        {value: 'dispatcher', desc: 'Run a dispatcher'},
        {value: 'unset', desc: 'Unset a gesture'}
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
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">Add Gesture</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="mb-4">
                <label class="block text-zinc-400 text-sm mb-1">Fingers</label>
                <select id="gesture-fingers" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
                    <option value="3">3 Fingers</option>
                    <option value="4">4 Fingers</option>
                    <option value="5">5 fingers</option>
                </select>
            </div>
            <div class="mb-4">
                <label class="block text-zinc-400 text-sm mb-1">Direction</label>
                <select id="gesture-direction" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
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
            <div class="mb-4">
                <label class="block text-zinc-400 text-sm mb-1">Modifier (Optional)</label>
                <select id="gesture-mod" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
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
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Scale (optional, e.g., 1.5)</label>
                <input type="text" id="gesture-scale" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="Leave empty for default">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Action</label>
                <select id="gesture-action" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" onchange="toggleGestureDispatcher()">
                    ${getGestureActionOptions()}
                </select>
            </div>
            <div class="mb-4" id="gesture-dispatcher-group" style="display: none;">
                <label class="block text-zinc-400 text-sm mb-1">Dispatcher</label>
                <select id="gesture-dispatcher" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" onchange="updateGestureParamHint()">
                    ${getDispatcherOptions()}
                </select>
                <small id="gesture-param-hint" class="form-hint">Parameter: command (e.g., kitty, firefox)</small>
            </div>
            <div class="mb-4" id="gesture-params-group">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5" id="gesture-params-label">Parameters (none needed)</label>
                <input type="text" id="gesture-params" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., special workspace name">
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="addGesture()">Add</button>
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
            headers: {'Content-Type': 'application/json'},
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
    const escapedRaw = UI.escapeParam(raw);
    const escapedParams = UI.escapeParam(params || '');
    const isDispatcher = gestureAction === 'dispatcher';

    openModal(`
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-white">Edit Gesture</h3>
                    <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
                </div>
                <div class="mb-6">
                    <div class="w-1/2 pr-2">
                    <label class="block text-zinc-400 text-xs mb-1">Fingers</label>
                    <select id="gesture-fingers" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
                        <option value="3" ${data.fingers === '3' ? 'selected' : ''}>3 fingers</option>
                        <option value="4" ${data.fingers === '4' ? 'selected' : ''}>4 fingers</option>
                        <option value="5" ${data.fingers === '5' ? 'selected' : ''}>5 fingers</option>
                    </select>
                </div>
                <div class="w-1/2 pl-2">
                    <label class="block text-zinc-400 text-xs mb-1">Direction</label>
                    <select id="gesture-direction" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
                        <option value="swipe" ${data.direction === 'swipe' ? 'selected' : ''}>swipe</option>
                        <option value="u" ${data.direction === 'u' ? 'selected' : ''}>Up (u)</option>
                        <option value="d" ${data.direction === 'd' ? 'selected' : ''}>Down (d)</option>
                        <option value="l" ${data.direction === 'l' ? 'selected' : ''}>Left (l)</option>
                        <option value="r" ${data.direction === 'r' ? 'selected' : ''}>Right (r)</option>
                    </select>
                </div>
                    <div class="w-full mt-3">
                    <label class="block text-zinc-400 text-xs mb-1">Modifier (Optional)</label>
                    <select id="gesture-mod" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">
                        <option value="" ${data.mod === '' ? 'selected' : ''}>None</option>
                        <option value="SUPER" ${data.mod === 'SUPER' ? 'selected' : ''}>SUPER</option>
                        <option value="ALT" ${data.mod === 'ALT' ? 'selected' : ''}>ALT</option>
                        <option value="CTRL" ${data.mod === 'CTRL' ? 'selected' : ''}>CTRL</option>
                        <option value="SHIFT" ${data.mod === 'SHIFT' ? 'selected' : ''}>SHIFT</option>
                    </select>
                </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-zinc-400 mb-1.5">Scale (optional, e.g., 1.5)</label>
                        <input type="text" id="gesture-scale" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${scale}" placeholder="Leave empty for default">
                    </div>
                    <div class="w-full mt-3">
                    <label class="block text-zinc-400 text-xs mb-1">Action Type</label>
                    <select id="gesture-action" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" onchange="toggleGestureDispatcher()">
                        <option value="dispatch" ${isDispatch ? 'selected' : ''}>Dispatch</option>
                        <option value="exec" ${isExec ? 'selected' : ''}>Exec</option>
                    </select>
                </div>
                
                <div class="w-full mt-3" id="gesture-dispatcher-group">
                    <label class="block text-zinc-400 text-xs mb-1">Dispatcher</label>
                    <select id="gesture-dispatcher" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" onchange="updateGestureParamHint()">
                        ${getDispatcherOptions(currentDispatcher)}
                    </select>
                        <small id="gesture-param-hint" class="form-hint">Parameter: ${DISPATCHERS[dispatcher]?.param || 'parameters'}</small>
                    </div>
                    <div class="mb-4" id="gesture-params-group">
                        <label class="block text-sm font-medium text-zinc-400 mb-1.5" id="gesture-params-label">${isDispatcher ? 'Dispatcher Parameters' : 'Parameters'}</label>
                        <input type="text" id="gesture-params" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${escapedParams}">
                    </div>
                </div>
                <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
                    <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
                    <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="updateGesture('${escapedRaw}')">Save</button>
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
            headers: {'Content-Type': 'application/json'},
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'delete', fingers: 0, direction: '', gesture_action: '', old_raw: raw})
        });
        await loadGestures();
        renderTabContent('gestures');
        showToast('Gesture deleted', 'success');
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function confirmDeleteGesture(raw) {
    const escapedRaw = UI.escapeParam(raw);
    confirmDialog('Delete Gesture',
        `Are you sure you want to delete this gesture?`,
        `function() {deleteGesture('${escapedRaw}')}`);
}


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

    let container = document.getElementById('preset-selector-container');


    if (!container) {
        const header = document.querySelector('.page-header') || document.querySelector('.config-header');
        if (header) {
            container = document.createElement('div');
            container.id = 'preset-selector-container';
            container.className = 'flex justify-between items-center mb-4';
            header.appendChild(container);
        } else {

            const tabNav = document.getElementById('tab-nav');
            if (tabNav) {
                container = document.createElement('div');
                container.id = 'preset-selector-container';
                container.className = 'flex justify-between items-center mb-4';
                tabNav.parentElement.insertBefore(container, tabNav);
            } else {
                return;
            }
        }
    }

    const activePresetData = presets.find(p => p.id === activePreset);
    const changeCount = Object.keys(pendingChanges).length;
    const hasChanges = changeCount > 0;

    container.innerHTML = `
                <div class="flex items-center gap-3 p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider pl-2">Preset:</span>
                        <select id="preset-dropdown" onchange="handlePresetChange(this.value)" class="bg-zinc-800 border-none text-zinc-200 text-sm rounded-md px-2 py-1 focus:ring-1 focus:ring-teal-500 cursor-pointer outline-none hover:bg-zinc-700 transition-colors">
                            <option value="">-- No Preset --</option>
                            ${presets.map(p => `
                        <option value="${p.id}" ${p.id === activePreset ? 'selected' : ''}>
                            ${p.name}
                        </option>
                    `).join('')}
                        </select>
                    </div>
                    <div class="flex items-center gap-1">
                        ${activePreset ? `
                    <button class="px-3 py-1.5 ${hasChanges ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'} text-sm rounded-md transition-all flex items-center gap-2" onclick="saveAndSyncPreset()" title="Save and sync to preset">
                        💾 Save${hasChanges ? ` (${changeCount})` : ''}
                    </button>
                ` : ''}
                        <button class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors flex items-center gap-2" onclick="showSavePresetModal()" title="Save current config as new preset">
                            💾 Save As
                        </button>
                        <button class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors flex items-center gap-2" onclick="showManagePresetsModal()" title="Manage presets">
                            ⚙️
                        </button>
                    </div>
                </div>
                `;
}

async function handlePresetChange(presetId) {
    if (!presetId) {

        try {
            await fetch('/presets/hyprland/deactivate', {method: 'POST'});
            activePreset = null;
            showToast('Preset deactivated', 'info');
        } catch (e) {
            showToast('Failed to deactivate preset', 'error');
        }
        return;
    }


    if (Object.keys(pendingChanges).length > 0) {
        confirmDialog(
            'Unsaved Changes',
            'You have unsaved changes. Switching presets will discard them. Continue?',
            `function() { activatePreset('${presetId}') }`
        );

        document.getElementById('preset-dropdown').value = activePreset || '';
        return;
    }

    await activatePreset(presetId);
}

async function activatePreset(presetId) {
    try {
        const response = await fetch(`/presets/hyprland/${presetId}/activate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({backup_current: true})
        });

        if (!response.ok) {
            throw new Error('Activation failed');
        }

        const result = await response.json();
        activePreset = presetId;


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
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">💾 Save as Preset</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <p class="modal-description">Save your current configuration as a reusable preset.</p>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Preset Name</label>
                <input type="text" id="preset-name" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., Battery Save" required>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Description (optional)</label>
                <textarea id="preset-description" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., Low power mode with no animations"></textarea>
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Cancel</button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="saveNewPreset()">Save Preset</button>
        </div>
    `);
}


async function saveAndSyncPreset() {

    if (Object.keys(pendingChanges).length > 0) {
        await saveConfig();
    }


    await syncToActivePreset();


    renderPresetSelector();
}


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


    if (Object.keys(pendingChanges).length > 0) {
        await saveConfig();
    }

    try {
        const response = await fetch('/presets/hyprland', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, description})
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
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">⚙️ Manage Presets</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            ${presets.length === 0 ?
        '<p class="text-center py-8 text-zinc-500 italic">No presets saved yet. Click "Save As" to create your first preset.</p>' :
        `<div class="space-y-2">
                ${presets.map(p => `
                    <div class="flex items-center justify-between p-3 bg-zinc-900 border ${p.id === activePreset ? 'border-teal-500 bg-teal-500/5' : 'border-zinc-800 hover:border-zinc-700'} rounded-lg group transition-all">
                        <div class="flex-1 min-w-0 pr-4">
                            <div class="flex items-center gap-2 font-medium text-zinc-200">
                                ${p.name}
                                ${p.id === activePreset ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">Active</span>' : ''}
                            </div>
                            <div class="text-sm text-zinc-400 mt-0.5 truncate">${p.description || 'No description'}</div>
                            <div class="text-xs text-zinc-600 mt-1">Created: ${new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            ${p.id !== activePreset ? `
                                <button class="p-1.5 text-zinc-400 hover:text-teal-400 hover:bg-zinc-800 rounded transition-colors" onclick="activatePresetFromModal('${p.id}')" title="Activate">▶️</button>
                            ` : ''}
                            <button class="p-1.5 text-zinc-400 hover:text-teal-400 hover:bg-zinc-800 rounded transition-colors" onclick="showEditPresetModal('${p.id}', '${p.name.replace(/'/g, "\\'")}', '${(p.description || '').replace(/'/g, "\\'")}')" title="Edit">✏️</button>
                            <button class="p-1.5 text-zinc-400 hover:text-teal-400 hover:bg-zinc-800 rounded transition-colors" onclick="updatePresetContent('${p.id}')" title="Update with current config">🔄</button>
                            <button class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors" onclick="confirmDeletePreset('${p.id}', '${p.name.replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>`
    }
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="closeModal()">Close</button>
        </div>
    `);
}

async function activatePresetFromModal(presetId) {
    await activatePreset(presetId);
    showManagePresetsModal();
}

function showEditPresetModal(id, name, description) {
    openModal(`
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white">✏️ Edit Preset</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Preset Name</label>
                <input type="text" id="edit-preset-name" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors" value="${name}">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Description</label>
                <textarea id="edit-preset-description" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors">${description}</textarea>
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="showManagePresetsModal()">Back</button>
            <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="updatePreset('${id}')">Save Changes</button>
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, description})
        });

        if (!response.ok) throw new Error('Update failed');


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
