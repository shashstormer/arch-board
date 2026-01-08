/**
 * FontPicker: Reusable modal for selecting fonts with autocomplete.
 * Supports infinite scroll for browsing all fonts.
 */
class FontPicker {
    constructor() {
        this.fonts = [];
        this.searchQuery = '';
        this.displayCount = 50;
        this.batchSize = 50;
        this.searchTimeout = null;
        this.onSelect = null;
        this.isLoading = false;
    }

    static open(options = {}) {
        if (!window._fontPicker) {
            window._fontPicker = new FontPicker();
        }
        window._fontPicker.show(options);
    }

    async show(options) {
        this.onSelect = options.onSelect || null;
        this.currentValue = options.currentValue || '';
        this.searchQuery = '';
        this.displayCount = 50;

        // Get fonts from FontManager if available
        if (window.fontManager && window.fontManager.fonts) {
            this.fonts = window.fontManager.fonts;
        } else {
            // Fallback: fetch directly
            try {
                const res = await fetch('/fonts/list');
                const data = await res.json();
                if (Array.isArray(data)) {
                    const families = new Set();
                    data.forEach(f => f.families.forEach(fam => families.add(fam)));
                    this.fonts = Array.from(families).sort();
                }
            } catch (e) {
                console.error("FontPicker: Failed to load fonts", e);
                this.fonts = [];
            }
        }

        // Adjust modal styling
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.classList.remove('max-w-md', 'p-6', 'w-full');
            modalContent.classList.add('max-w-3xl', 'w-[700px]', 'p-0', 'overflow-hidden');
        }

        openModal(this.getModalContent());

        // Setup scroll listener and focus search
        setTimeout(() => {
            const grid = document.getElementById('fp-grid');
            if (grid) {
                grid.addEventListener('scroll', () => this.handleScroll(grid));
            }

            const input = document.getElementById('fp-search');
            if (input) {
                input.focus();
                if (this.currentValue) {
                    input.value = this.currentValue;
                    this.handleSearch(this.currentValue);
                }
            }
        }, 100);
    }

    close() {
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.className = 'bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl transform scale-95 transition-transform duration-200 [&.active]:scale-100';
        }
        closeModal();
    }

    getFilteredFonts() {
        if (!this.searchQuery) {
            return this.fonts;
        }
        const q = this.searchQuery.toLowerCase();
        return this.fonts.filter(f => f.toLowerCase().includes(q));
    }

    getModalContent() {
        const filtered = this.getFilteredFonts();
        return `
            <div class="w-full h-[500px] flex flex-col animate-in fade-in zoom-in duration-200 select-none">
                <!-- Header -->
                <div class="px-4 py-3 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center gap-4">
                    <h3 class="text-lg font-semibold text-white shrink-0">Select Font</h3>
                    
                    <!-- Search -->
                    <div class="flex-1 relative">
                        <input type="text" id="fp-search" placeholder="Search fonts..."
                            class="w-full bg-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-2 border border-zinc-700 focus:outline-none focus:border-teal-500 transition-colors"
                            oninput="window._fontPicker.handleSearch(this.value)">
                    </div>
                    
                    <button class="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" onclick="window._fontPicker.close()">✕</button>
                </div>

                <!-- Font Grid -->
                <div id="fp-grid" class="flex-1 overflow-y-auto p-4 bg-zinc-950/50 grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
                    ${this.renderGrid()}
                </div>

                <!-- Footer -->
                <div id="fp-footer" class="px-4 py-3 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center">
                    <span class="text-sm text-zinc-500">${filtered.length} fonts${this.searchQuery ? ' matching' : ' available'}</span>
                    <button class="px-4 py-2 text-zinc-400 hover:text-white" onclick="window._fontPicker.close()">Cancel</button>
                </div>
            </div>
        `;
    }

    renderGrid() {
        const filtered = this.getFilteredFonts();
        const shown = filtered.slice(0, this.displayCount);

        if (shown.length === 0) {
            return `<div class="col-span-full text-zinc-500 text-center py-10">No fonts found</div>`;
        }

        let html = shown.map(family => `
            <div onclick="window._fontPicker.select('${family.replace(/'/g, "\\'")}')"
                class="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 hover:border-teal-500/50 hover:bg-zinc-800 cursor-pointer transition-all flex flex-col gap-1 group">
                <div class="text-xs text-zinc-500 font-mono truncate group-hover:text-teal-400 transition-colors" title="${family}">${family}</div>
                <div class="text-lg text-zinc-200 truncate" style="font-family: '${family}', sans-serif;">
                    The quick brown fox
                </div>
            </div>
        `).join('');

        // Show loader if more available
        if (shown.length < filtered.length) {
            html += `
                <div id="fp-loader" class="col-span-full flex justify-center py-4">
                    <span class="text-zinc-500 text-sm">Scroll for more... (${shown.length}/${filtered.length})</span>
                </div>
            `;
        }

        return html;
    }

    handleScroll(grid) {
        if (this.isLoading) return;

        const filtered = this.getFilteredFonts();
        if (this.displayCount >= filtered.length) return; // All loaded

        // Check if near bottom (within 100px)
        const scrollBottom = grid.scrollTop + grid.clientHeight;
        const threshold = grid.scrollHeight - 100;

        if (scrollBottom >= threshold) {
            this.loadMore();
        }
    }

    loadMore() {
        this.isLoading = true;
        this.displayCount += this.batchSize;

        const grid = document.getElementById('fp-grid');
        if (grid) {
            grid.innerHTML = this.renderGrid();
        }

        // Update footer count
        const footer = document.getElementById('fp-footer');
        if (footer) {
            const filtered = this.getFilteredFonts();
            footer.querySelector('span').textContent = `${filtered.length} fonts${this.searchQuery ? ' matching' : ' available'}`;
        }

        this.isLoading = false;
    }

    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.searchQuery = query.toLowerCase();
            this.displayCount = 50; // Reset on new search

            const grid = document.getElementById('fp-grid');
            if (grid) {
                grid.innerHTML = this.renderGrid();
                grid.scrollTop = 0; // Scroll to top on new search
            }

            // Update footer
            const footer = document.getElementById('fp-footer');
            if (footer) {
                const filtered = this.getFilteredFonts();
                footer.querySelector('span').textContent = `${filtered.length} fonts${this.searchQuery ? ' matching' : ' available'}`;
            }
        }, 150);
    }

    select(family) {
        if (this.onSelect) {
            this.onSelect(family);
        }
        this.close();
    }
}

// Expose globally
window.FontPicker = FontPicker;

