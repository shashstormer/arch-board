class ImagePicker {
    constructor() {
        this.options = {
            multiselect: false,
            allowFolderSelect: false,
            onSelect: null
        };
        this.isOpen = false;

        this.currentFolderId = null;
        this.items = [];
        this.breadcrumbs = [];
        this.selected = new Set();
        this.clipboard = null;

        this.close = this.close.bind(this);
        this.handleUpload = this.handleUpload.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.onDragOver = this.onDragOver.bind(this);
    }

    mount(containerId, config = {}, options = {}) {
        this.isMounted = true;
        this.config = {
            containerId: containerId,
            breadcrumbsId: config.breadcrumbsId || 'ip-breadcrumbs',
            contentId: config.contentId || 'ip-content',
            statusId: config.statusId || 'ip-status',
            ctxMenuId: config.ctxMenuId || 'ip-context-menu'
        };
        this.options = { ...this.options, ...options };

        this.fetchItems();
    }

    static open(options = {}) {
        if (!window._imagePicker) {
            window._imagePicker = new ImagePicker();
        }
        window._imagePicker.show(options);
    }

    show(options) {
        if (this.isMounted) return;

        this.options = { ...this.options, ...options };
        this.isOpen = true;
        this.selected.clear();
        this.currentFolderId = null;

        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.classList.remove('max-w-md', 'p-6', 'w-full');
            modalContent.classList.add('max-w-5xl', 'w-[900px]', 'p-0', 'overflow-hidden');
        }

        openModal(this.getModalContent());
        this.config = {
            breadcrumbsId: 'ip-breadcrumbs',
            contentId: 'ip-content',
            statusId: 'ip-status'
        };
        this.fetchItems();
    }

    close() {
        if (this.isMounted) return;
        this.isOpen = false;
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.className = 'bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl transform scale-95 transition-transform duration-200 [&.active]:scale-100';
        }
        closeModal();
    }

    async fetchItems() {
        try {
            const url = this.currentFolderId
                ? `/images/fs/list?parent_id=${this.currentFolderId}`
                : `/images/fs/list`;

            const res = await fetch(url);
            const data = await res.json();
            this.items = data.items || [];
            this.breadcrumbs = data.breadcrumbs || [];
            this.renderContent();
            this.renderBreadcrumbs();
        } catch (e) {
            console.error("Failed to load items", e);
        }
    }

    getModalContent() {
        return `
            <div id="ip-modal-container" class="w-full h-[650px] flex flex-col animate-in fade-in zoom-in duration-200 select-none">
                <!-- Header / Toolbar -->
                <div class="px-4 py-3 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center gap-4">
                    <h3 class="text-lg font-semibold text-white shrink-0">Files</h3>
                    
                    <!-- Breadcrumbs -->
                    <div id="ip-breadcrumbs" class="flex-1 flex items-center overflow-hidden text-sm text-zinc-400 gap-1 px-2">
                        <!-- Populated via JS -->
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2">
                        <button onclick="window._imagePicker.createFolderPrompt()" class="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="New Folder">
                            📁+
                        </button>
                        <button onclick="document.getElementById('ip-folder-input').click()" class="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Upload Folder">
                            <span class="text-xs">📂+</span>
                        </button>
                        <input type="file" id="ip-folder-input" class="hidden" webkitdirectory directory multiple onchange="window._imagePicker.handleUpload(this.files)">

                        <button onclick="document.getElementById('ip-upload-input').click()" class="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Upload Files">
                            ☁️
                        </button>
                        <input type="file" id="ip-upload-input" class="hidden" multiple accept="image/*" onchange="window._imagePicker.handleUpload(this.files)">
                        
                        <button class="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white ml-2" onclick="window._imagePicker.close()">✕</button>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="flex-1 flex overflow-hidden">
                    <!-- File Grid -->
                    <div id="ip-content" 
                         class="flex-1 overflow-y-auto p-4 bg-zinc-950/50"
                         ondragover="window._imagePicker.onDragOver(event)"
                         ondrop="window._imagePicker.handleDrop(event)">
                         <!-- Content -->
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center">
                    <div class="text-sm text-zinc-500">
                        <span id="ip-status">Ready</span>
                    </div>
                    <div class="flex gap-3">
                        <button class="px-4 py-2 text-zinc-400 hover:text-white" onclick="window._imagePicker.close()">Cancel</button>
                        <button class="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium shadow-lg shadow-teal-900/20" onclick="window._imagePicker.confirm()">
                            Select
                        </button>
                    </div>
                </div>
                
                <!-- Context Menu (Hidden) -->
                <div id="ip-context-menu" class="fixed hidden bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 w-48 py-1">
                    <button class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white" onclick="window._imagePicker.ctxRename()">Rename</button>
                    <button class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300" onclick="window._imagePicker.ctxDelete()">Delete</button>
                </div>
            </div>
        `;
    }

    renderBreadcrumbs() {
        const container = document.getElementById(this.config?.breadcrumbsId || 'ip-breadcrumbs');
        if (!container) return;

        const instanceName = this.isMounted ? 'window._library' : 'window._imagePicker';

        let html = `<button class="hover:text-white hover:underline px-1 py-1 rounded transition-colors" 
            onclick="${instanceName}.navigateTo(null)"
            ondragover="event.preventDefault(); this.classList.add('bg-teal-500/30')"
            ondragleave="this.classList.remove('bg-teal-500/30')"
            ondrop="event.preventDefault(); this.classList.remove('bg-teal-500/30'); ${instanceName}.onBreadcrumbDrop(event, null)">Root</button>`;

        this.breadcrumbs.forEach(crumb => {
            html += `<span class="text-zinc-600">/</span>`;
            html += `<button class="hover:text-white hover:underline px-1 py-1 rounded truncate max-w-[150px] transition-colors" 
                onclick="${instanceName}.navigateTo('${crumb.id}')"
                ondragover="event.preventDefault(); this.classList.add('bg-teal-500/30')"
                ondragleave="this.classList.remove('bg-teal-500/30')"
                ondrop="event.preventDefault(); this.classList.remove('bg-teal-500/30'); ${instanceName}.onBreadcrumbDrop(event, '${crumb.id}')">${crumb.name}</button>`;
        });

        container.innerHTML = html;
        container.scrollLeft = container.scrollWidth;
    }

    renderContent() {
        const targetId = this.config?.contentId || 'ip-content';
        const container = document.getElementById(targetId);
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                    <div class="text-5xl mb-4">📂</div>
                    <p>Folder is empty</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                ${this.items.map(item => this.renderCard(item)).join('')}
            </div>
        `;
    }

    renderCard(item) {
        const isSelected = this.selected.has(item.id);
        const isFolder = item.type === 'folder';
        const instanceName = this.isMounted ? 'window._library' : 'window._imagePicker';

        let iconOrImg = '';
        let metaInfo = '';

        if (isFolder) {
            iconOrImg = `<div class="w-full h-full flex items-center justify-center bg-zinc-800 text-5xl">📁</div>`;
            metaInfo = `<span class="text-[10px] text-zinc-500">Folder</span>`;
        } else {
            iconOrImg = `<img src="/images/raw/${item.id}" class="w-full h-full object-cover pointer-events-none" draggable="false">`;

            // Format size
            let sizeStr = '';
            if (item.size) {
                if (item.size < 1024) sizeStr = item.size + ' B';
                else if (item.size < 1024 * 1024) sizeStr = (item.size / 1024).toFixed(1) + ' KB';
                else sizeStr = (item.size / (1024 * 1024)).toFixed(1) + ' MB';
            }

            const dims = (item.width && item.height) ? `${item.width}x${item.height}` : '';
            metaInfo = `<div class="flex flex-col text-[10px] text-zinc-500 leading-tight">
                            <span>${dims}</span>
                            <span>${sizeStr}</span>
                        </div>`;
        }

        return `
            <div class="group relative h-48 w-full bg-zinc-900/50 rounded-lg border ${isSelected ? 'border-teal-500 ring-1 ring-teal-500/50' : 'border-zinc-800 hover:border-zinc-600'} flex flex-col overflow-hidden transition-all cursor-pointer"
                 onclick="${instanceName}.toggleSelect('${item.id}', ${isFolder})"
                 ondblclick="${isFolder ? `${instanceName}.navigateTo('${item.id}')` : `${instanceName}.confirm('${item.id}')`}"
                 oncontextmenu="${instanceName}.showCtxMenu(event, '${item.id}')"
                 draggable="true"
                 ondragstart="${instanceName}.onItemDragStart(event, '${item.id}')"
                 ondragover="${isFolder ? `${instanceName}.onItemDragOver(event)` : ''}"
                 ondrop="${isFolder ? `${instanceName}.onItemDrop(event, '${item.id}')` : ''}"
            >
                <div class="flex-1 overflow-hidden relative">
                    ${iconOrImg}
                </div>
                <div class="h-10 flex items-center justify-between px-2 bg-zinc-900 border-t border-zinc-800">
                    <span class="text-xs text-zinc-300 truncate font-medium group-hover:text-white max-w-[50%]" title="${item.name}">${item.name}</span>
                    <div class="text-right shrink-0">
                        ${metaInfo}
                    </div>
                </div>
            </div>
        `;
    }

    navigateTo(folderId) {
        this.currentFolderId = folderId;
        this.fetchItems();
    }

    toggleSelect(id, isFolder) {
        if (this.options.multiselect) {
            if (this.selected.has(id)) {
                this.selected.delete(id);
            } else {
                this.selected.add(id);
            }
        } else {
            this.selected.clear();
            this.selected.add(id);
        }
        this.renderContent();

        const count = this.selected.size;
        const statusEl = document.getElementById(this.config?.statusId || 'ip-status');
        if (statusEl) statusEl.innerText = count > 0 ? `${count} selected` : 'Ready';

        this.closeCtxMenu();
    }

    confirm(forceId) {
        let targets = [];
        if (forceId) targets = [this.items.find(i => i.id === forceId)];
        else targets = this.items.filter(i => this.selected.has(i.id));

        let valid = targets;
        if (!this.options.allowFolderSelect) {
            valid = targets.filter(t => t.type === 'file');
        }

        if (valid.length === 0) return;

        if (this.options.onSelect) {
            this.options.onSelect(valid);
        }
        this.close();
    }

    async createFolderPrompt() {
        const name = prompt("Enter folder name:", "New Folder");
        if (!name) return;

        try {
            const res = await fetch('/images/fs/folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, parent_id: this.currentFolderId })
            });
            if (res.ok) {
                this.fetchItems();
            } else {
                alert("Failed to create folder");
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleUpload(files) {
        if (!files || files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach(f => {
            formData.append('files', f);
            if (f.webkitRelativePath) {
                formData.append('paths', f.webkitRelativePath);
            } else {
                formData.append('paths', f.name);
            }
        });

        if (this.currentFolderId) {
            formData.append('parent_id', this.currentFolderId);
        }

        const statusEl = document.getElementById(this.config?.statusId || 'ip-status');
        if (statusEl) statusEl.innerText = "Uploading...";

        try {
            const res = await fetch('/images/upload', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                this.fetchItems();
                if (statusEl) statusEl.innerText = "Upload Complete";
            } else {
                alert("Upload failed");
            }
        } catch (e) {
            console.error(e);
            alert("Upload error");
        }
    }

    onItemDragStart(e, id) {
        e.dataTransfer.setData('curr_id', id);
        e.dataTransfer.effectAllowed = 'move';
        this.draggedId = id;
    }

    onItemDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('bg-teal-500/20');
    }

    async onItemDrop(e, targetFolderId) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('bg-teal-500/20');

        const sourceId = e.dataTransfer.getData('curr_id');
        if (!sourceId || sourceId === targetFolderId) return;

        await this.moveItem(sourceId, targetFolderId);
    }

    onDragOver(e) {
        e.preventDefault();
    }

    async handleDrop(e) {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            this.handleUpload(e.dataTransfer.files);
            return;
        }

    }


    async onBreadcrumbDrop(e, targetFolderId) {
        const sourceId = e.dataTransfer.getData('curr_id');
        if (!sourceId) return;
        if (sourceId === targetFolderId) return;
        await this.moveItem(sourceId, targetFolderId);
    }

    async moveItem(itemId, targetParentId) {
        try {
            const res = await fetch(`/images/fs/${itemId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_parent_id: targetParentId })
            });
            if (res.ok) {
                this.fetchItems();
            } else {
                alert("Move failed");
            }
        } catch (e) {
            console.error(e);
        }
    }


    showCtxMenu(e, id) {
        e.preventDefault();
        e.stopPropagation();
        this.ctxId = id;
        this.selected.clear();
        this.selected.add(id);
        this.renderContent();

        const menuId = this.config?.ctxMenuId || 'ip-context-menu';
        const menu = document.getElementById(menuId);
        if (!menu) return;

        menu.classList.remove('hidden');
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        const close = () => {
            this.closeCtxMenu();
            document.removeEventListener('click', close);
        };
        document.addEventListener('click', close);
    }

    closeCtxMenu() {
        const menuId = this.config?.ctxMenuId || 'ip-context-menu';
        const menu = document.getElementById(menuId);
        if (menu) menu.classList.add('hidden');
        this.ctxId = null;
    }

    async ctxRename() {
        if (!this.ctxId) return;
        const item = this.items.find(i => i.id === this.ctxId);
        const newName = prompt("Rename to:", item.name);
        if (!newName || newName === item.name) return;

        try {
            const res = await fetch(`/images/fs/${this.ctxId}/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            if (res.ok) this.fetchItems();
        } catch (e) { console.error(e); }
    }

    async ctxDelete() {
        if (!this.ctxId) return;
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
            const res = await fetch(`/images/fs/${this.ctxId}`, {
                method: 'DELETE'
            });
            if (res.ok) this.fetchItems();
        } catch (e) { console.error(e); }
    }
}
