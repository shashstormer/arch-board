/**
 * FontManager: "Nuclear Option"
 * Loads ALL system fonts to ensure every icon and style works.
 */
class FontManager {
    constructor() {
        this.pinnedFonts = new Set();
        this.init();
    }

    async init() {
        console.log("FontManager: Initializing Global Font Loader...");
        await this.loadPinnedFonts();

        try {
            const res = await fetch('/fonts/list');

            if (!res.ok) {
                console.error(`FontManager: Server returned ${res.status} ${res.statusText}`);
                return;
            }

            const fonts = await res.json();

            if (!Array.isArray(fonts)) {
                if (fonts.error) console.error("FontManager Error:", fonts.error);
                return;
            }
            console.log(`FontManager: Found ${fonts.length} font files.`);
            this.injectFonts(fonts);

            // Force load pinned fonts after we know they are available (or at least registered)
            this.forceLoadPinned();

        } catch (e) {
            console.error("FontManager: Failed to load fonts", e);
        }
    }

    async loadPinnedFonts() {
        try {
            // Migrating from local storage if server is empty? 
            // For now, let's just prefer server.
            const res = await fetch('/fonts/pinned');
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list)) {
                    list.forEach(f => this.pinnedFonts.add(f));
                    console.log(`FontManager: Loaded ${list.length} pinned fonts from server.`);
                }
            } else {
                // Fallback to local storage if API fails (or first run/offline?)
                // Actually better to just log error to avoid split brain
                console.warn("FontManager: Failed to load pinned fonts from server");
            }
        } catch (e) {
            console.error("Failed to load pinned fonts", e);
        }
    }

    async savePinnedFonts() {
        try {
            const list = Array.from(this.pinnedFonts);
            await fetch('/fonts/pinned', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fonts: list })
            });
            // localStorage.setItem('archboard_pinned_fonts', JSON.stringify(list)); // Backup?
        } catch (e) {
            console.error("FontManager: Failed to save pinned fonts", e);
        }
    }

    isPinned(family) {
        return this.pinnedFonts.has(family);
    }

    togglePin(family) {
        if (this.pinnedFonts.has(family)) {
            this.pinnedFonts.delete(family);
            // Optional: remove force-load element? Not strictly necessary as it doesn't hurt.
        } else {
            this.pinnedFonts.add(family);
            this.forceLoad(family);
        }
        this.savePinnedFonts(); // Fire and forget update
        return this.pinnedFonts.has(family);
    }

    forceLoadPinned() {
        this.pinnedFonts.forEach(family => this.forceLoad(family));
    }

    forceLoad(family) {
        // Create an invisible element using this font to force the browser to download it
        const id = `force-font-${family.replace(/[^a-zA-Z0-9]/g, '-')}`;
        if (document.getElementById(id)) return; // Already forcing

        const span = document.createElement('span');
        span.id = id;
        span.style.fontFamily = `"${family}"`;
        span.style.opacity = '0';
        span.style.position = 'absolute';
        span.style.pointerEvents = 'none';
        span.textContent = 'force load';
        document.body.appendChild(span);
        console.log(`FontManager: Force loading "${family}"`);
    }

    injectFonts(fonts) {
        let css = "";

        fonts.forEach(font => {
            // Encode path for URL safety
            const fontPath = encodeURIComponent(font.path);

            font.families.forEach(family => {
                // Generate @font-face for each family provided by the file
                // We leave font-weight/style as normal/auto to let browser handle basic mapping
                css += `
                        @font-face {
                            font-family: "${family}";
                            src: url("/fonts/serve?path=${fontPath}");
                            font-display: swap; 
                        }
                    `;
            });
        });

        const styleEl = document.createElement('style');
        styleEl.id = "global-font-manager";
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        console.log("FontManager: All fonts injected via @font-face.");
    }
}

// Auto-start
window.fontManager = new FontManager();
