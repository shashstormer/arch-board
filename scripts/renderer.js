/**
 * UI Renderer & Search Utility
 * Provides a consistent API for generating UI elements and handling search/filtering.
 */

class UI {

    /**
     * Render a standard table with columns and actions
     * @param {Object} options
     * @param {string[]} options.headers - Column headers
     * @param {Array} options.data - Data rows
     * @param {Function} options.rowRenderer - Function(item) => html string for row cells <table> content
     * @param {string} options.emptyMessage - Message to show if data is empty
     * @returns {string} HTML string
     */
    static renderTable({headers, data, rowRenderer, emptyMessage = 'No items found'}) {
        if (!data || data.length === 0) {
            return `<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">${emptyMessage}</div>`;
        }

        const headerHtml = headers.map(h =>
            `<th class="text-zinc-500 font-medium text-xs uppercase tracking-wider p-3 border-b border-zinc-800 text-left">${h}</th>`
        ).join('');

        const rowsHtml = data.map(item =>
            `<tr class="hover:bg-zinc-800/40 border-b border-zinc-800 last:border-0 transition-colors">${rowRenderer(item)}</tr>`
        ).join('');

        return `
            <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden search-container">
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr>${headerHtml}</tr>
                        </thead>
                        <tbody class="searchable-list">
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render a section header with title and optional add button
     */
    static renderSectionHeader(title, addButtonFn_or_HTML, count = null) {
        const countBadge = count !== null ? `<span class="text-zinc-500 ml-2 text-xs">(${count})</span>` : '';

        let buttonHtml = '';
        if (typeof addButtonFn_or_HTML === 'string') {
            // If string passed, treat as label for button
            buttonHtml = `<button class="flex items-center gap-2 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-md text-sm transition-colors" onclick="${addButtonFn_or_HTML}"> + Add </button>`;
        } else if (addButtonFn_or_HTML) {
            // If object passed (label, onclick)
            buttonHtml = `<button class="flex items-center gap-2 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-md text-sm transition-colors" onclick="${addButtonFn_or_HTML.onclick}"> + ${addButtonFn_or_HTML.label} </button>`;
        }

        return `
            <div class="px-5 py-3.5 bg-zinc-800/30 border-b border-zinc-800 flex justify-between items-center">
                <h3 class="text-sm font-semibold text-zinc-200 uppercase tracking-wider m-0">${title} ${countBadge}</h3>
                <div class="flex gap-4 items-center">
                    <div class="relative">
                        <input type="text" 
                               placeholder="Search ${title.toLowerCase()}..." 
                               onkeyup="UI.filterSection(this)"
                               class="w-48 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-teal-500 transition-width focus:w-64">
                    </div>
                    ${buttonHtml}
                </div>
            </div>
        `;
    }

    /**
     * Global filter function attached to section search inputs
     */
    static filterSection(input) {
        const query = input.value.toLowerCase();
        // Find the parent container (the section)
        const container = input.closest('.search-container');
        if (!container) return;

        // Try to filter table rows
        const rows = container.querySelectorAll('tbody tr');
        if (rows.length > 0) {
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
            return;
        }

        // Try to filter divs (like in monitors or window rules list)
        // We assume items are direct children of a specific container or marked with a class
        // Let's look for common list item patterns
        const listItems = container.querySelectorAll('.searchable-item, .bg-zinc-800.border.border-zinc-700, .border-b.border-zinc-800');

        listItems.forEach(item => {
            // Skip the header itself if matched
            if (item.contains(input)) return;

            const text = item.innerText.toLowerCase();
            item.style.display = text.includes(query) ? '' : 'none';
        });
    }

    /**
     * Standard modal content generator
     */
    static renderModalHeader(title) {
        return `
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-bold text-white">${title}</h3>
                <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeModal()">×</button>
            </div>
        `;
    }

    static renderModalFooter(primaryAction, cancelAction = 'closeModal()', primaryLabel = 'Save', cancelLabel = 'Cancel') {
        return `
            <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800/50">
                <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" onclick="${cancelAction}">${cancelLabel}</button>
                <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors" onclick="${primaryAction}">${primaryLabel}</button>
            </div>
        `;
    }

    static escapeParam(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '\\n');
    }
}

window.UI = UI;
