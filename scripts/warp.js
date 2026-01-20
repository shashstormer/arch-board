class WarpEditor {
    constructor() {
        this.init();
    }

    async init() {
        this.render();
        await this.updateStatus();
        setInterval(() => this.updateStatus(), 10000);
    }

    render() {
        const container = document.getElementById('warp-content');
        if (!container) return;
        container.innerHTML = '';

        const toggle = UIManager.createToggle(
            "Cloudflare Warp",
            "Secure your connection",
            false,
            (checked) => this.toggleWarp(checked),
            "warp-toggle-input"
        );

        const wrapper = document.createElement('div');
        wrapper.className = "max-w-md mx-auto mt-4 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden";
        wrapper.appendChild(toggle);

        container.appendChild(wrapper);
    }

    async updateStatus() {
        const toggle = document.getElementById('warp-toggle-input');
        if (!toggle) return;

        try {
            toggle.disabled = true;
            const res = await fetch('/warp/enabled');
            if (res.ok) {
                const data = await res.json();
                toggle.checked = data.enabled;
            }
        } catch (e) {
            console.error("Warp status check failed", e);
        } finally {
            toggle.disabled = false;
        }
    }

    async toggleWarp(enabled) {
        const toggle = document.getElementById('warp-toggle-input');
        if (toggle) toggle.disabled = true;

        try {
            await fetch('/warp/update', {
                method: 'POST',
                body: JSON.stringify({ enabled }),
                headers: { 'Content-Type': 'application/json' }
            });
            await this.updateStatus();
        } catch (e) {
            console.error("Warp toggle failed", e);
            await this.updateStatus();
        }
    }
}

window.warpEditor = new WarpEditor();
