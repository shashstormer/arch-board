// Main application script
let production = prod || false;

// Dev mode settings panel
if (!production) {
    console.log('Dev mode enabled');

    // Create dev toolbar
    document.addEventListener('DOMContentLoaded', () => {
        createDevToolbar();
        initAutoReload();
    });
}

function createDevToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'dev-toolbar';
    toolbar.innerHTML = `
        <div class="dev-toolbar">
            <span class="dev-label">DEV</span>
            <label class="dev-toggle">
                <input type="checkbox" id="auto-reload-toggle" ${getLocalSettings('auto_reload', 'true') === 'true' ? 'checked' : ''}>
                <span>Auto-reload</span>
            </label>
        </div>
    `;
    document.body.appendChild(toolbar);

    // Handle toggle change
    const toggle = document.getElementById('auto-reload-toggle');
    toggle.addEventListener('change', (e) => {
        setLocalSettings('auto_reload', e.target.checked.toString());
        console.log('Auto-reload:', e.target.checked);
    });
}

function initAutoReload() {
    const autoReload = getLocalSettings('auto_reload', 'true') === 'true';
    if (autoReload) {
        setTimeout(() => {
            if (autoReload) {
                location.reload();
            }
        }, 60000); // Reload every 60 seconds in dev mode
    }
}
