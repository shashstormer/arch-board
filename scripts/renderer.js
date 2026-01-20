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
    static renderTable({ headers, data, rowRenderer, emptyMessage = 'No items found' }) {
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

class UIManager {
    static createContainer(className = "flex flex-col gap-3") {
        const el = document.createElement('div');
        el.className = className;
        return el;
    }

    static createSection(title, description, children = [], headerElement = null) {
        // Main Card Container
        const container = document.createElement('div');
        container.className = "bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6 last:mb-0";

        // Header using standard UI style (if title exists)
        if (title) {
            const header = document.createElement('div');
            header.className = "px-5 py-3.5 bg-zinc-800/30 border-b border-zinc-800 flex justify-between items-center";
            header.innerHTML = `
                <div>
                    <h3 class="text-sm font-semibold text-zinc-200 uppercase tracking-wider m-0">${title}</h3>
                    ${description ? `<p class="text-zinc-500 text-xs mt-0.5 normal-case tracking-normal">${description}</p>` : ''}
                </div>
            `;
            if (headerElement) header.appendChild(headerElement);
            container.appendChild(header);
        }

        // Content Container (List of items)
        const content = document.createElement('div');
        // divide-y for subtle substitution of borders between items
        content.className = "divide-y divide-zinc-800/50";
        children.forEach(child => {
            if (child) content.appendChild(child);
        });
        container.appendChild(content);

        return container;
    }

    static createToggle(label, description, checked, onChange, id = null) {
        const wrapper = document.createElement('div');
        // Clean list-item style: no border/bg by default, just padding and hover
        wrapper.className = "flex justify-between items-center px-5 py-4 hover:bg-zinc-800/30 transition-colors";

        const info = document.createElement('div');
        info.className = "flex-1 mr-4";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 mb-1">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500">${description}</div>` : ''}
        `;

        const labelEl = document.createElement('label');
        labelEl.className = "relative inline-flex items-center cursor-pointer";

        const input = document.createElement('input');
        input.type = "checkbox";
        input.className = "sr-only peer";
        input.checked = checked;
        if (id) {
            input.id = id;
            input.name = id;
        }

        if (onChange) {
            input.addEventListener('change', (e) => onChange(e.target.checked));
        }

        const slider = document.createElement('div');
        slider.className = "w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500";

        labelEl.appendChild(input);
        labelEl.appendChild(slider);

        wrapper.appendChild(info);
        wrapper.appendChild(labelEl);

        return wrapper;
    }

    static createSlider(label, description, value, min, max, step = 1, onChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex justify-between items-center px-5 py-4 hover:bg-zinc-800/30 transition-colors";

        const info = document.createElement('div');
        info.className = "flex-1 mr-4 min-w-0";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 mb-1 truncate">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate">${description}</div>` : ''}
        `;

        const controlContainer = document.createElement('div');
        controlContainer.className = "flex items-center gap-3 min-w-[200px] flex-shrink-0";

        const input = document.createElement('input');
        input.type = "range";
        input.className = "flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform";
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = value;
        if (id) {
            input.id = id;
            input.name = id;
        }

        const display = document.createElement('span');
        display.className = "min-w-[40px] text-right text-sm font-medium text-zinc-200";
        display.textContent = value;

        input.addEventListener('input', (e) => {
            display.textContent = e.target.value;
        });

        if (onChange) {
            input.addEventListener('change', (e) => onChange(e.target.value));
        }

        controlContainer.appendChild(input);
        controlContainer.appendChild(display);

        wrapper.appendChild(info);
        wrapper.appendChild(controlContainer);

        return wrapper;
    }

    static createSelect(label, description, value, options, onChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-4"; // Horizontal

        const info = document.createElement('div');
        info.className = "flex-1 min-w-0 mr-4";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-sm">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate mt-0.5">${description}</div>` : ''}
        `;

        const select = document.createElement('select');
        select.className = "w-64 bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block p-2.5";
        if (id) {
            select.id = id;
            select.name = id;
        }

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value == value) option.selected = true;
            select.appendChild(option);
        });

        if (onChange) {
            select.addEventListener('change', (e) => onChange(e.target.value));
        }

        wrapper.appendChild(info);
        wrapper.appendChild(select);

        return wrapper;
    }
    static createInput(label, description, value, placeholder = "", onChange, id = null, type = "text") {
        const wrapper = document.createElement('div');
        wrapper.className = "flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-4"; // Horizontal Row

        const info = document.createElement('div');
        info.className = "flex-1 min-w-0 mr-4";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-sm">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate mt-0.5">${description}</div>` : ''}
        `;

        const input = document.createElement('input');
        input.type = type;
        // w-64 for standard inputs, text-right usually looks cleaner in horizontal settings
        input.className = "w-64 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-600";
        if (type === 'number' || type === 'range') input.classList.add('text-right');

        input.value = (value !== undefined && value !== null) ? value : "";
        input.placeholder = placeholder;
        if (id) {
            input.id = id;
            input.name = id;
        }

        if (onChange) {
            input.addEventListener('change', (e) => onChange(e.target.value));
            if (type === 'range') {
                input.addEventListener('input', (e) => onChange(e.target.value));
            }
        }

        wrapper.appendChild(info);
        wrapper.appendChild(input);

        return wrapper;
    }

    static createTextArea(label, description, value, placeholder = "", onChange, id = null, rows = 3) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex items-start justify-between px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-4"; // Horizontal but aligned top

        const info = document.createElement('div');
        info.className = "flex-1 min-w-0 mr-4 pt-2"; // Align with input top
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-sm">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate mt-0.5">${description}</div>` : ''}
        `;

        const textarea = document.createElement('textarea');
        textarea.className = "w-64 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-600 font-mono";
        textarea.value = (value !== undefined && value !== null) ? value : "";
        textarea.placeholder = placeholder;
        textarea.rows = rows;
        if (id) {
            textarea.id = id;
            textarea.name = id;
        }

        if (onChange) {
            textarea.addEventListener('change', (e) => onChange(e.target.value));
        }

        wrapper.appendChild(info);
        wrapper.appendChild(textarea);

        return wrapper;
    }
    static createActionInput(label, description, value, placeholder = "", buttonIcon, onButtonClick, onChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-4"; // Horizontal

        const info = document.createElement('div');
        info.className = "flex-1 min-w-0 mr-4";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-sm">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate mt-0.5">${description}</div>` : ''}
        `;

        const controls = document.createElement('div');
        controls.className = "flex items-center gap-2";

        const input = document.createElement('input');
        input.type = "text";
        input.className = "w-48 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-600";
        input.value = (value !== undefined && value !== null) ? value : "";
        input.placeholder = placeholder;
        if (id) { input.id = id; input.name = id; }
        if (onChange) input.addEventListener('change', (e) => onChange(e.target.value));

        const btn = document.createElement('button');
        btn.className = "px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors";
        btn.innerHTML = buttonIcon;
        btn.onclick = (e) => { e.preventDefault(); if (onButtonClick) onButtonClick(e); };

        controls.appendChild(input);
        controls.appendChild(btn);

        wrapper.appendChild(info);
        wrapper.appendChild(controls);

        return wrapper;
    }
    static createColorPicker(label, description, value, onChange, onTextChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-4"; // Horizontal

        const info = document.createElement('div');
        info.className = "flex-1 min-w-0 mr-4";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-sm">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate mt-0.5">${description}</div>` : ''}
        `;

        const controls = document.createElement('div');
        controls.className = "flex items-center gap-2";

        const utils = (window.UI && window.UI.ColorUtils) || window.ColorUtils;
        const hexColor = utils ? utils.toHex(value) : value;

        const colorInput = document.createElement('input');
        colorInput.type = "color";
        colorInput.value = hexColor;
        colorInput.className = "w-8 h-8 rounded border-none cursor-pointer bg-transparent";
        if (id) { colorInput.id = id + '_picker'; colorInput.name = id + '_picker'; }
        if (onChange) colorInput.addEventListener('change', (e) => onChange(e.target.value));

        const textInput = document.createElement('input');
        textInput.type = "text";
        textInput.className = "w-24 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs font-mono focus:outline-none focus:border-teal-500 color-text";
        textInput.value = value;
        if (id) { textInput.id = id; textInput.name = id; }
        if (onTextChange) textInput.addEventListener('change', (e) => onTextChange(e.target.value));

        controls.appendChild(colorInput);
        controls.appendChild(textInput);

        wrapper.appendChild(info);
        wrapper.appendChild(controls);

        return wrapper;
    }

    static createVec2Input(label, description, value, onXChange, onYChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-4"; // Horizontal

        const info = document.createElement('div');
        info.className = "flex-1 min-w-0 mr-4";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-sm">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate mt-0.5">${description}</div>` : ''}
        `;

        const parts = String(value).split(' ');
        const xVal = parts[0] || '0';
        const yVal = parts[1] || '0';

        const inputs = document.createElement('div');
        inputs.className = "flex gap-2";

        const xInput = document.createElement('input');
        xInput.type = "number";
        xInput.className = "w-20 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-sm text-center focus:outline-none focus:border-teal-500";
        xInput.value = xVal;
        xInput.placeholder = "X";
        if (id) { xInput.id = id + '_x'; xInput.name = id + '_x'; }
        if (onXChange) xInput.addEventListener('change', (e) => onXChange(e.target.value));

        const yInput = document.createElement('input');
        yInput.type = "number";
        yInput.className = "w-20 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-sm text-center focus:outline-none focus:border-teal-500";
        yInput.value = yVal;
        yInput.placeholder = "Y";
        if (id) { yInput.id = id + '_y'; yInput.name = id + '_y'; }
        if (onYChange) yInput.addEventListener('change', (e) => onYChange(e.target.value));

        inputs.appendChild(xInput);
        inputs.appendChild(yInput);

        wrapper.appendChild(info);
        wrapper.appendChild(inputs);

        return wrapper;
    }
    // Vertical Stack Variants (for Properties Panel)
    static createStackInput(label, value, placeholder, onChange, type = "text", id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col items-start px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-2";
        const info = document.createElement('div');
        info.className = "w-full min-w-0";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-xs uppercase tracking-wider mb-0.5">${label}</div>
        `;
        const input = document.createElement('input');
        input.type = type;
        input.className = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-600";
        input.value = (value !== undefined && value !== null) ? value : "";
        input.placeholder = placeholder;
        if (id) { input.id = id; input.name = id; }
        if (onChange) {
            input.addEventListener('change', (e) => onChange(e.target.value));
            if (type === 'range') input.addEventListener('input', (e) => onChange(e.target.value));
        }
        wrapper.appendChild(info);
        wrapper.appendChild(input);
        return wrapper;
    }

    static createStackTextArea(label, description, value, placeholder = "", onChange, id = null, rows = 3) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col items-start px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-2";
        const info = document.createElement('div');
        info.className = "w-full min-w-0";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-xs uppercase tracking-wider mb-0.5">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate">${description}</div>` : ''}
        `;
        const textarea = document.createElement('textarea');
        textarea.className = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-600 font-mono";
        textarea.value = (value !== undefined && value !== null) ? value : "";
        textarea.placeholder = placeholder;
        textarea.rows = rows;
        if (id) { textarea.id = id; textarea.name = id; }
        if (onChange) textarea.addEventListener('change', (e) => onChange(e.target.value));
        wrapper.appendChild(info);
        wrapper.appendChild(textarea);
        return wrapper;
    }

    static createStackSelect(label, description, value, options, onChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col items-start px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-2";
        const info = document.createElement('div');
        info.className = "w-full min-w-0";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-xs uppercase tracking-wider mb-0.5">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate">${description}</div>` : ''}
        `;
        const select = document.createElement('select');
        select.className = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors";
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value == value) option.selected = true;
            select.appendChild(option);
        });
        if (id) { select.id = id; select.name = id; }
        if (onChange) select.addEventListener('change', (e) => onChange(e.target.value));
        wrapper.appendChild(info);
        wrapper.appendChild(select);
        return wrapper;
    }

    static createStackActionInput(label, description, value, placeholder = "", buttonIcon, onButtonClick, onChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col items-start px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-2";
        const info = document.createElement('div');
        info.className = "w-full min-w-0";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-xs uppercase tracking-wider mb-0.5">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate">${description}</div>` : ''}
        `;
        const controls = document.createElement('div');
        controls.className = "w-full flex items-center gap-2";
        const input = document.createElement('input');
        input.type = "text";
        input.className = "flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder-zinc-600";
        input.value = (value !== undefined && value !== null) ? value : "";
        input.placeholder = placeholder;
        if (id) { input.id = id; input.name = id; }
        if (onChange) input.addEventListener('change', (e) => onChange(e.target.value));
        const btn = document.createElement('button');
        btn.className = "px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors";
        btn.innerHTML = buttonIcon;
        btn.onclick = (e) => { e.preventDefault(); if (onButtonClick) onButtonClick(e); };
        controls.appendChild(input);
        controls.appendChild(btn);
        wrapper.appendChild(info);
        wrapper.appendChild(controls);
        return wrapper;
    }

    static createStackColorPicker(label, description, value, onChange, onTextChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col items-start px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-2";
        const info = document.createElement('div');
        info.className = "w-full min-w-0";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-xs uppercase tracking-wider mb-0.5">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate">${description}</div>` : ''}
        `;
        const controls = document.createElement('div');
        controls.className = "w-full flex items-center gap-2";
        const utils = (window.UI && window.UI.ColorUtils) || window.ColorUtils;
        const hexColor = utils ? utils.toHex(value) : value;
        const colorInput = document.createElement('input');
        colorInput.type = "color";
        colorInput.value = hexColor;
        colorInput.className = "w-8 h-8 rounded border-none cursor-pointer bg-transparent";
        if (id) { colorInput.id = id + '_picker'; colorInput.name = id + '_picker'; }
        if (onChange) colorInput.addEventListener('change', (e) => onChange(e.target.value));
        const textInput = document.createElement('input');
        textInput.type = "text";
        textInput.className = "flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-xs font-mono focus:outline-none focus:border-teal-500 color-text";
        textInput.value = value;
        if (id) { textInput.id = id; textInput.name = id; }
        if (onTextChange) textInput.addEventListener('change', (e) => onTextChange(e.target.value));
        controls.appendChild(colorInput);
        controls.appendChild(textInput);
        wrapper.appendChild(info);
        wrapper.appendChild(controls);
        return wrapper;
    }

    static createStackVec2Input(label, description, value, onXChange, onYChange, id = null) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col items-start px-5 py-3 hover:bg-zinc-800/30 transition-colors gap-2";
        const info = document.createElement('div');
        info.className = "w-full min-w-0";
        info.innerHTML = `
            <div class="font-medium text-zinc-200 text-xs uppercase tracking-wider mb-0.5">${label}</div>
            ${description ? `<div class="text-xs text-zinc-500 truncate">${description}</div>` : ''}
        `;
        const parts = String(value).split(' ');
        const xVal = parts[0] || '0';
        const yVal = parts[1] || '0';
        const inputs = document.createElement('div');
        inputs.className = "w-full flex gap-2";
        const xInput = document.createElement('input');
        xInput.type = "number";
        xInput.className = "flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-sm text-center focus:outline-none focus:border-teal-500";
        xInput.value = xVal;
        xInput.placeholder = "X";
        if (id) { xInput.id = id + '_x'; xInput.name = id + '_x'; }
        if (onXChange) xInput.addEventListener('change', (e) => onXChange(e.target.value));
        const yInput = document.createElement('input');
        yInput.type = "number";
        yInput.className = "flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-sm text-center focus:outline-none focus:border-teal-500";
        yInput.value = yVal;
        yInput.placeholder = "Y";
        if (id) { yInput.id = id + '_y'; yInput.name = id + '_y'; }
        if (onYChange) yInput.addEventListener('change', (e) => onYChange(e.target.value));
        inputs.appendChild(xInput);
        inputs.appendChild(yInput);
        wrapper.appendChild(info);
        wrapper.appendChild(inputs);
        return wrapper;
    }

}

window.UIManager = UIManager;

if (!window.UI) window.UI = {};
if (typeof window.ColorUtils !== 'undefined') {
    window.UI.ColorUtils = window.ColorUtils;
}
