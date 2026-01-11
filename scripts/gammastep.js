let config = {};
let isRunning = false;

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    await loadStatus();
    setInterval(loadStatus, 5000);
});

async function loadConfig() {
    try {
        const response = await fetch('/gammastep/config');
        config = await response.json();
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
    setValue('temp-day', config.temp_day);
    setValue('temp-day-slider', config.temp_day);
    setValue('temp-night', config.temp_night);
    setValue('temp-night-slider', config.temp_night);
    setValue('fade', config.fade === '1');
    setValue('provider', config.location_provider);
    setValue('lat', config.lat);
    setValue('lon', config.lon);

    toggleLocationInputs(config.location_provider === 'manual');
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

async function saveConfig() {
    const newConfig = {
        temp_day: parseInt(getValue('temp-day')),
        temp_night: parseInt(getValue('temp-night')),
        fade: document.getElementById('fade').checked ? '1' : '0',
        location_provider: getValue('provider'),
        lat: parseFloat(getValue('lat')),
        lon: parseFloat(getValue('lon'))
    };

    try {
        const response = await fetch('/gammastep/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
        });

        if (response.ok) {
            showToast('Configuration saved', 'success');
            config = newConfig;
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

function getValue(id) {
    return document.getElementById(id).value;
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el.type === 'checkbox') {
        el.checked = value;
    } else {
        el.value = value;
    }
}

function handleProviderChange(select) {
    toggleLocationInputs(select.value === 'manual');
}

function toggleLocationInputs(show) {
    const container = document.getElementById('manual-location-group');
    if (show) {
        container.classList.remove('opacity-50', 'pointer-events-none');
    } else {
        container.classList.add('opacity-50', 'pointer-events-none');
    }
}
