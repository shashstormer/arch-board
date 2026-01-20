let config = {};
let isRunning = false;
let isUnified = false;

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    await loadStatus();

    setInterval(loadStatus, 5000);

    if (window.PresetManagerUI) {
        window._presetManagers['gammastep'] = new PresetManagerUI('gammastep', {
            containerId: 'preset-container',
            onActivate: async () => {
                await loadConfig();
                showToast('Preset activated', 'success');
            },
            onSave: async () => {
                await saveConfig(true);
            }
        });
    }
    attachAutosaveListeners();
});

async function loadConfig() {
    try {
        const response = await fetch('/gammastep/config');
        config = await response.json();
        isUnified = (config.temp_day === config.temp_night);
        renderConfig();
    } catch (e) {
        showToast('Failed to load config', 'error');
        console.error(e);
    }
}

async function loadStatus() {
    try {
        const response = await fetch('/gammastep/status');
        const data = await response.json();
        isRunning = data.running;
        updateStatusUI();
    } catch (e) {
        console.error("Status check failed", e);
    }
}

function renderConfig() {
    const container = document.getElementById('gammastep-settings-content');
    if (!container) return;
    container.innerHTML = '';

    const settingsGrid = document.createElement('div');
    settingsGrid.className = "grid grid-cols-1 md:grid-cols-2 gap-8";

    const tempColumn = document.createElement('div');
    tempColumn.className = "space-y-6";

    tempColumn.appendChild(UIManager.createToggle("Unified Day & Night", "Use the same temperature all day", isUnified, (v) => {
        isUnified = v;
        if (isUnified) config.temp_night = config.temp_day;
        renderConfig();
        debouncedSave();
    }));

    if (isUnified) {
        tempColumn.appendChild(UIManager.createSlider("Screen Temperature", "Kelvin (K)", config.temp_day || 6500, 1000, 6500, 100, (v) => {
            config.temp_day = parseInt(v);
            config.temp_night = parseInt(v);
            debouncedSave();
        }, 'temp-unified'));
    } else {
        tempColumn.appendChild(UIManager.createSlider("Day Temperature", "Kelvin (K)", config.temp_day || 6500, 1000, 6500, 100, (v) => {
            config.temp_day = parseInt(v);
            debouncedSave();
        }, 'temp-day'));

        tempColumn.appendChild(UIManager.createSlider("Night Temperature", "Kelvin (K)", config.temp_night || 4500, 1000, 6500, 100, (v) => {
            config.temp_night = parseInt(v);
            debouncedSave();
        }, 'temp-night'));
    }

    tempColumn.appendChild(UIManager.createToggle("Smooth Transition", "Fade between temperature changes", config.fade === '1', (v) => {
        config.fade = v ? '1' : '0';
        debouncedSave();
    }, 'fade'));

    const locColumn = document.createElement('div');
    locColumn.className = "space-y-6";

    const providers = [
        { value: 'manual', label: 'Manual Coordinates' },
        { value: 'geoclue2', label: 'Automatic (GeoClue2)' }
    ];

    locColumn.appendChild(UIManager.createSelect("Location Provider", "Method to determine position", config.location_provider, providers, (v) => {
        config.location_provider = v;
        renderConfig();
        debouncedSave();
    }, 'provider'));

    if (config.location_provider === 'manual') {
        const manualGroup = document.createElement('div');
        manualGroup.className = "space-y-4 pt-2 border-t border-zinc-800/50";

        manualGroup.appendChild(UIManager.createInput("Latitude", "Positive for North", config.lat, "e.g. 48.1", (v) => {
            config.lat = parseFloat(v) || 0;
            debouncedSave();
        }, 'lat', 'number'));

        manualGroup.appendChild(UIManager.createInput("Longitude", "Positive for East", config.lon, "e.g. 11.6", (v) => {
            config.lon = parseFloat(v) || 0;
            debouncedSave();
        }, 'lon', 'number'));

        locColumn.appendChild(manualGroup);
    }

    settingsGrid.appendChild(tempColumn);
    settingsGrid.appendChild(locColumn);
    container.appendChild(settingsGrid);
}

function updateStatusUI() {
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');
    const toggleBtn = document.getElementById('btn-toggle');
    const toggleText = document.getElementById('toggle-text');

    if (isRunning) {
        statusText.textContent = 'Active';
        statusText.className = 'text-teal-400 font-medium';
        statusIcon.className = 'w-3 h-3 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]';

        toggleBtn.className = 'px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition-all';
        toggleText.textContent = 'Turn Off';
    } else {
        statusText.textContent = 'Inactive';
        statusText.className = 'text-zinc-500 font-medium';
        statusIcon.className = 'w-3 h-3 rounded-full bg-zinc-700';

        toggleBtn.className = 'px-6 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 border border-teal-500/20 rounded-lg transition-all';
        toggleText.textContent = 'Turn On';
    }
}

async function saveConfig(silent = false) {
    try {
        const response = await fetch('/gammastep/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (response.ok) {
            if (!silent) showToast('Configuration saved', 'success');
            loadStatus();
        } else {
            showToast('Failed to save', 'error');
        }
    } catch (e) {
        showToast('Error saving config', 'error');
    }
}

async function toggleGammastep() {
    try {
        const response = await fetch('/gammastep/toggle', { method: 'POST' });
        const result = await response.json();
        isRunning = result.running;
        updateStatusUI();
        showToast(result.message, isRunning ? 'success' : 'info');
    } catch (e) {
        showToast('Failed to toggle service', 'error');
    }
}

let saveTimeout = null;
function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await saveConfig(true);
    }, 500);
}

function attachAutosaveListeners() {
}
