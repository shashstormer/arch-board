class HyprlockEditor {
    constructor() {
        this.config = null;
        this.widgets = [];
        this.selectedId = null;
        this.canvas = document.getElementById('editor-canvas');
        this.scale = 0.5;
        this.dragState = { active: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };

        this.presets = [];
        this.activePreset = null;
        this.saveTimeout = null;

        this.init();
    }

    async init() {
        this.setupDragAndDrop();
        this.setupCanvasInteractions();
        this.setupCanvasControls();
        await this.loadConfig();
        this.render();

        window._presetManagers['hyprlock'] = new PresetManagerUI('hyprlock', {
            containerId: 'preset-container',
            onActivate: async () => {
                await this.loadConfig();
                this.render();
            },
            onSave: async () => await this.saveConfig()
        });

        setTimeout(() => this.fitToContainer(), 100);
    }

    setupCanvasControls() {
        const zoomSlider = document.getElementById('zoom-slider');
        if (zoomSlider) {
            zoomSlider.value = this.scale * 100;
            zoomSlider.oninput = (e) => {
                this.setZoom(parseInt(e.target.value) / 100);
            };
        }

        this.updateZoomDisplay();
    }

    setCanvasSize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.render();
    }

    setZoom(scale) {
        this.scale = Math.max(0.1, Math.min(1.5, scale));
        this.canvas.style.transform = `scale(${this.scale})`;
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        const display = document.getElementById('zoom-display');
        if (display) {
            display.textContent = `${Math.round(this.scale * 100)}%`;
        }
        const slider = document.getElementById('zoom-slider');
        if (slider) {
            slider.value = this.scale * 100;
        }
    }

    fitToContainer() {
        const container = document.getElementById('canvas-container');
        if (!container || !this.canvas) return;

        const padding = 10;
        const containerWidth = container.clientWidth - padding;
        const containerHeight = container.clientHeight - padding;

        const canvasWidth = parseInt(this.canvas.style.width) || 1920;
        const canvasHeight = parseInt(this.canvas.style.height) || 1080;

        const scaleX = containerWidth / canvasWidth;
        const scaleY = containerHeight / canvasHeight;

        const fitScale = Math.min(scaleX, scaleY, 1.5);

        this.setZoom(fitScale - 0.03);
    }

    resetZoom() {
        this.fitToContainer();
    }

    async loadConfig() {
        try {
            const res = await fetch('/hyprlock/config');
            this.config = await res.json();

            this.flattenConfig();
        } catch (e) {
            console.error('Failed to load config', e);
        }
    }

    flattenConfig() {
        this.widgets = [];
        let idCounter = 0;

        const add = (list, type) => {
            if (!list) return;
            list.forEach(item => {
                this.widgets.push({
                    id: `w-${idCounter++}`,
                    type,
                    data: { ...item }
                });
            });
        };

        add(this.config.backgrounds, 'background');
        add(this.config.input_fields, 'input-field');
        add(this.config.labels, 'label');
        add(this.config.images, 'image');
        add(this.config.shapes, 'shape');
    }

    async saveConfig() {
        const newConfig = {
            general: this.config.general || {},
            auth: this.config.auth || {},
            animations: this.config.animations || {},
            backgrounds: [],
            input_fields: [],
            labels: [],
            images: [],
            shapes: []
        };

        this.widgets.forEach(w => {
            const typeMap = {
                'background': 'backgrounds',
                'input-field': 'input_fields',
                'label': 'labels',
                'image': 'images',
                'shape': 'shapes'
            };
            if (typeMap[w.type]) {
                newConfig[typeMap[w.type]].push(w.data);
            }
        });

        try {
            const res = await fetch('/hyprlock/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });

            if (res.ok) {
                showToast('Configuration saved!', 'success');
            } else {
                showToast('Failed to save configuration', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error saving configuration', 'error');
        }
    }

    triggerAutosave() {
        if (this.isAutosaveEnabled()) {
            if (this.saveTimeout) clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(async () => {
                await this.saveConfig();
                if (window._presetManagers['hyprlock']) {
                    window._presetManagers['hyprlock'].updateActivePreset(true);
                }
            }, 500);
        }
    }

    isAutosaveEnabled() {
        return typeof ArchBoard !== 'undefined' ? ArchBoard.settings.autosaveEnabled : false;
    }


    render() {
        const layer = document.getElementById('canvas-widgets-layer');
        const bgLayer = document.getElementById('canvas-background-layer');
        layer.innerHTML = '';
        bgLayer.innerHTML = '';

        const sortedWidgets = [...this.widgets].sort((a, b) => {
            const zA = a.data.zindex ?? (a.type === 'background' ? -1 : 0);
            const zB = b.data.zindex ?? (b.type === 'background' ? -1 : 0);
            return zA - zB;
        });

        sortedWidgets.forEach(widget => {
            const el = this.createWidgetElement(widget);
            widget.element = el;

            el.onmousedown = (e) => this.handleMouseDown(e, widget);

            if (widget.id === this.selectedId) {
                el.classList.add('widget-selected');

                const handles = ['tl', 'tr', 'bl', 'br'];
                handles.forEach(pos => {
                    const h = document.createElement('div');
                    h.className = `h-handle h-handle-${pos}`;
                    h.onmousedown = (e) => this.onHandleDown(e, widget, pos);
                    el.appendChild(h);
                });

                const rotLine = document.createElement('div');
                rotLine.className = 'h-rotator-line';
                el.appendChild(rotLine);

                const rotKnob = document.createElement('div');
                rotKnob.className = 'h-rotator-knob';
                rotKnob.onmousedown = (e) => this.onRotateDown(e, widget);
                el.appendChild(rotKnob);
            }

            if (widget.type === 'background') {
                bgLayer.appendChild(el);
            } else {
                layer.appendChild(el);
            }
        });

        this.updateSelectionAttributes();
    }

    createWidgetElement(widget) {
        const el = document.createElement('div');
        el.id = widget.id;
        el.className = 'absolute transition-shadow hover:ring-1 hover:ring-teal-500/50 cursor-pointer select-none pointer-events-auto';

        const zindex = widget.data.zindex ?? (widget.type === 'background' ? -1 : 0);
        el.style.zIndex = zindex + 10;

        const [posX, posY] = this.parseVec2(widget.data.position || "0, 0");
        const centerX = 1920 / 2;
        const centerY = 1080 / 2;

        const halign = widget.data.halign || 'center';
        const valign = widget.data.valign || 'center';

        let baseX = centerX;
        let baseY = centerY;

        if (halign === 'left') baseX = 0;
        if (halign === 'right') baseX = 1920;
        if (valign === 'top') baseY = 0;
        if (valign === 'bottom') baseY = 1080;

        const cssY = -posY;

        el.style.left = `${baseX + posX}px`;
        el.style.top = `${baseY + cssY}px`;

        let translateX = '0%';
        let translateY = '0%';

        if (halign === 'center') translateX = '-50%';
        if (halign === 'right') translateX = '-100%';

        if (valign === 'center') translateY = '-50%';
        if (valign === 'bottom') translateY = '-100%';

        el.style.transform = `translate(${translateX}, ${translateY})`;

        this.renderWidgetContent(el, widget);

        return el;
    }

    renderWidgetContent(el, widget) {
        const d = widget.data;

        if (widget.type === 'label') {
            let text = d.text || "Label";

            if (text.startsWith('cmd[')) {
                const cmdMatch = text.match(/cmd\[.*?\](.*)/);
                if (cmdMatch) {
                    let cmdText = cmdMatch[1].trim();
                    const echoMatch = cmdText.match(/echo\s+["'](.*)["']/);
                    if (echoMatch) {
                        text = echoMatch[1];
                        text = text.replace(/\\"/g, '"');
                        text = text.replace(/\\'/g, "'");
                    } else {
                        text = cmdText;
                    }
                }
            }

            text = text.replace(/\$USER/g, 'shash');

            text = text.replace(/\$\(date\s*\+?"([^"]+)"\)/g, (match, fmt) => {
                const now = new Date();
                let result = fmt;
                result = result.replace('%A', now.toLocaleDateString('en-US', { weekday: 'long' }));
                result = result.replace('%d', String(now.getDate()).padStart(2, '0'));
                result = result.replace('%m', String(now.getMonth() + 1).padStart(2, '0'));
                result = result.replace('%Y', now.getFullYear());
                result = result.replace('%-I', now.getHours() % 12 || 12);
                result = result.replace('%I', String(now.getHours() % 12 || 12).padStart(2, '0'));
                result = result.replace('%M', String(now.getMinutes()).padStart(2, '0'));
                result = result.replace('%p', now.getHours() >= 12 ? 'PM' : 'AM');
                return result;
            });

            text = text.replace(/\$TIME12/g, new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
            text = text.replace(/\$TIME/g, new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));

            text = text.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');

            el.innerText = text;

            el.style.color = this.parseColor(d.color);
            el.style.fontSize = `${d.font_size || 16}pt`;
            FontUtils.applyFontStyle(el, d.font_family);
            const existingTransform = el.style.transform || '';
            if (d.rotate) el.style.transform = existingTransform + ` rotate(${-d.rotate}deg)`;
            el.style.whiteSpace = 'nowrap';
            if (d.shadow_passes > 0 && d.shadow_size > 0) {
                el.style.textShadow = `2px 2px ${d.shadow_size}px ${this.parseColor(d.shadow_color || 'black')}`;
            }

        } else if (widget.type === 'input-field') {
            const [w, h] = this.parseVec2(d.size || "200, 50");
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            el.style.backgroundColor = this.parseColor(d.inner_color);
            el.style.border = `${d.outline_thickness || 0}px solid ${this.parseColor(d.outer_color)}`;
            el.style.borderRadius = d.rounding === -1 ? `${h / 2}px` : `${d.rounding}px`;

            el.classList.add('flex', 'items-center', 'justify-center', 'text-sm');
            if (d.placeholder_text) {
                const temp = document.createElement('div');
                temp.innerHTML = d.placeholder_text;
                el.innerText = temp.innerText || 'Input Password...';
            } else {
                el.innerText = 'Input Password...';
            }
            el.style.color = this.parseColor(d.font_color);
            FontUtils.applyFontStyle(el, d.font_family);

        } else if (widget.type === 'shape') {
            const [w, h] = this.parseVec2(d.size || "100, 100");
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            el.style.backgroundColor = this.parseColor(d.color);

            if (d.rounding === -1) el.style.borderRadius = `${Math.min(w, h) / 2}px`;
            else if (d.rounding) el.style.borderRadius = `${d.rounding}px`;

            if (d.rotate) el.style.transform += ` rotate(${-d.rotate}deg)`;

        } else if (widget.type === 'image') {
            const targetSize = parseInt(d.size) || 150;
            el.style.overflow = 'visible';

            const inner = document.createElement('div');
            inner.style.width = '100%';
            inner.style.height = '100%';
            inner.style.position = 'absolute';
            inner.style.top = '0';
            inner.style.left = '0';
            inner.style.overflow = 'hidden';

            if (d.border_size) {
                inner.style.border = `${d.border_size}px solid ${this.parseColor(d.border_color)}`;
                inner.style.boxSizing = 'border-box';
            }

            const img = document.createElement('img');

            let imgUrl = '/assets/placeholder.png';
            if (d.path) {
                if (d.path.includes('.archboard/images/')) {
                    const filename = d.path.split('/').pop();
                    const id = filename.split('.')[0];
                    imgUrl = `/images/raw/${id}`;
                } else {
                    imgUrl = `/hyprlock/images/preview?path=${encodeURIComponent(d.path)}`;
                }
            }
            img.src = imgUrl;

            img.onload = () => {
                const naturalW = img.naturalWidth;
                const naturalH = img.naturalHeight;
                const lesserSide = Math.min(naturalW, naturalH);
                const scale = targetSize / lesserSide;

                const displayW = Math.round(naturalW * scale);
                const displayH = Math.round(naturalH * scale);

                el.style.width = `${displayW}px`;
                el.style.height = `${displayH}px`;

                if (d.rounding === -1) {
                    const lesserDisplaySide = Math.min(displayW, displayH);
                    inner.style.borderRadius = `${lesserDisplaySide / 2}px`;
                } else if (d.rounding !== undefined && d.rounding !== 0) {
                    inner.style.borderRadius = `${d.rounding}px`;
                }

                img.style.width = '100%';
                img.style.height = '100%';
            };

            el.style.width = `${targetSize}px`;
            el.style.height = `${targetSize}px`;

            inner.style.borderRadius = `${targetSize / 2}px`;

            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.display = 'block';

            if (d.rotate) {
                const existingTransform = el.style.transform || '';
                el.style.transform = existingTransform + ` rotate(${-d.rotate}deg)`;
            }

            inner.appendChild(img);
            el.appendChild(inner);

        } else if (widget.type === 'background') {
            el.classList.add('inset-0', 'w-full', 'h-full', 'bg-black');
            el.style.position = 'absolute';
            el.style.cursor = 'pointer';

            if (d.path && d.path !== 'screenshot') {
                let url = '';
                if (d.path.includes('.archboard/images/')) {
                    const id = d.path.split('/').pop().split('.')[0];
                    url = `/images/raw/${id}`;
                } else {
                    url = `/hyprlock/images/preview?path=${encodeURIComponent(d.path)}`;
                }
                el.style.backgroundImage = `url('${url}')`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            }
            el.style.backgroundColor = this.parseColor(d.color);
            if (d.blur_passes > 0) el.style.filter = `blur(${d.blur_passes * (d.blur_size || 1)}px)`;
        }
    }

    parseVec2(str) {
        if (!str) return [0, 0];
        const parts = str.split(',').map(s => parseFloat(s.trim()));
        return [parts[0] || 0, parts[1] || 0];
    }

    parseColor(str) {
        if (!str) return 'transparent';
        if (str.startsWith('$')) {
            if (str === '$foreground') return '#ffffff';
            if (str === '$background') return '#000000';
            return '#aaaaaa';
        }
        if (str.startsWith('0x')) {
            return '#' + str.substring(2);
        }
        return str;
    }

    handleMouseDown(e, widget) {
        e.stopPropagation();
        this.selectedId = widget.id;
        this.render();
        this.renderPropertiesPanel(widget);

        if (widget.type === 'background') return;

        this.dragState.active = true;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;

        const [x, y] = this.parseVec2(widget.data.position || "0, 0");
        this.dragState.initialX = x;
        this.dragState.initialY = y;

        const onMove = (em) => {
            if (!this.dragState.active) return;
            const dx = (em.clientX - this.dragState.startX) / this.scale;
            const dy = (em.clientY - this.dragState.startY) / this.scale;

            const newX = Math.round(this.dragState.initialX + dx);
            const newY = Math.round(this.dragState.initialY - dy);

            widget.data.position = `${newX}, ${newY}`;
            this.render();
        };

        const onUp = () => {
            this.dragState.active = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this.renderPropertiesPanel(widget);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    setupDragAndDrop() {
        const toolboxItems = document.querySelectorAll('.draggable-widget');
        toolboxItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('type', item.dataset.type);
            });
        });

        this.canvas.addEventListener('dragover', (e) => e.preventDefault());
        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('type');
            if (type) this.addWidget(type);
        });
    }

    addWidget(type) {
        const defaults = {
            'label': {
                monitor: '',
                text: 'Sample Text',
                text_align: 'center',
                color: 'rgba(254, 254, 254, 1.0)',
                font_size: 16,
                font_family: 'Sans',
                rotate: 0,
                shadow_passes: 0,
                shadow_size: 3,
                shadow_color: 'rgb(0,0,0)',
                shadow_boost: 1.2,
                zindex: 0
            },
            'input-field': {
                monitor: '',
                size: '400, 90',
                outline_thickness: 4,
                dots_size: 0.25,
                dots_spacing: 0.15,
                dots_center: true,
                dots_rounding: -1,
                outer_color: 'rgba(17, 17, 17, 1.0)',
                inner_color: 'rgba(200, 200, 200, 1.0)',
                font_color: 'rgba(10, 10, 10, 1.0)',
                font_family: 'Noto Sans',
                fade_on_empty: true,
                fade_timeout: 2000,
                placeholder_text: '<i>Input Password...</i>',
                hide_input: false,
                rounding: -1,
                check_color: 'rgba(204, 136, 34, 1.0)',
                fail_color: 'rgba(204, 34, 34, 1.0)',
                fail_text: '<i>$FAIL <b>($ATTEMPTS)</b></i>',
                shadow_passes: 0,
                shadow_size: 3,
                shadow_color: 'rgb(0,0,0)',
                shadow_boost: 1.2,
                zindex: 0
            },
            'shape': {
                monitor: '',
                size: '100, 100',
                color: 'rgba(17, 17, 17, 1.0)',
                rounding: -1,
                rotate: 0,
                border_size: 0,
                border_color: 'rgba(0, 207, 230, 1.0)',
                xray: false,
                shadow_passes: 0,
                shadow_size: 3,
                shadow_color: 'rgb(0,0,0)',
                shadow_boost: 1.2,
                zindex: 0
            },
            'image': {
                monitor: '',
                path: '',
                size: 150,
                rounding: -1,
                border_size: 4,
                border_color: 'rgba(221, 221, 221, 1.0)',
                rotate: 0,
                reload_time: -1,
                reload_cmd: '',
                shadow_passes: 0,
                shadow_size: 3,
                shadow_color: 'rgb(0,0,0)',
                shadow_boost: 1.2,
                zindex: 0
            },
            'background': {
                monitor: '',
                path: '',
                color: 'rgba(17, 17, 17, 1.0)',
                blur_passes: 0,
                blur_size: 7,
                noise: 0.0117,
                contrast: 0.8916,
                brightness: 0.8172,
                vibrancy: 0.1696,
                vibrancy_darkness: 0.05,
                reload_time: -1,
                reload_cmd: '',
                crossfade_time: -1.0,
                zindex: -1
            }
        };

        this.widgets.push({
            id: `w-${Date.now()}`,
            type,
            data: {
                ...defaults[type],
                position: '0, 0',
                halign: 'center',
                valign: 'center'
            }
        });
        this.render();
    }

    setupCanvasInteractions() {
        const container = this.canvas.closest('.overflow-auto');

        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let scrollStartX = 0;
        let scrollStartY = 0;

        this.canvas.onclick = (e) => {
            const clickedLayerOrCanvas =
                e.target === this.canvas ||
                e.target.id === 'canvas-background-layer' ||
                e.target.id === 'canvas-widgets-layer';

            const clickedWidget = e.target.closest('[id^="w-"]');

            if (clickedLayerOrCanvas && !clickedWidget) {
                this.selectedId = null;
                this.render();
                this.renderPropertiesPanel(null);
            }
        };

        if (container) {
            container.onmousedown = (e) => {
                const isOnWidget = e.target.closest('.absolute.transition-shadow');
                if (isOnWidget) return;

                isPanning = true;
                panStartX = e.clientX;
                panStartY = e.clientY;
                scrollStartX = container.scrollLeft;
                scrollStartY = container.scrollTop;
                container.style.cursor = 'grabbing';
                e.preventDefault();
            };

            container.onmousemove = (e) => {
                if (!isPanning) return;
                const dx = e.clientX - panStartX;
                const dy = e.clientY - panStartY;
                container.scrollLeft = scrollStartX - dx;
                container.scrollTop = scrollStartY - dy;
            };

            container.onmouseup = () => {
                isPanning = false;
                container.style.cursor = 'default';
            };

            container.onmouseleave = () => {
                isPanning = false;
                container.style.cursor = 'default';
            };

            container.style.cursor = 'grab';

            container.addEventListener('wheel', (e) => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    this.setZoom(this.scale + delta);
                }
            });
        }
    }

    onHandleDown(e, widget, pos) {
        e.stopPropagation();
        e.preventDefault();
        this.isResizing = true;
        this.activeWidget = widget;
        this.resizeHandle = pos;
        this.startMouseX = e.clientX;
        this.startMouseY = e.clientY;

        this.initialData = { ...widget.data };

        if (widget.type === 'label') {
            this.initialFontSize = parseFloat(widget.data.font_size) || 16;
        } else if (widget.type === 'image') {
            this.initialSize = parseInt(widget.data.size) || 150;
        } else {
            const [w, h] = this.parseVec2(widget.data.size);
            this.initialVecSize = { w, h };
        }

        window.addEventListener('mousemove', this.handleInteractMove);
        window.addEventListener('mouseup', this.handleInteractUp);
    }

    onRotateDown(e, widget) {
        e.stopPropagation();
        e.preventDefault();
        this.isRotating = true;
        this.activeWidget = widget;

        const rect = widget.element.getBoundingClientRect();
        this.centerX = rect.left + rect.width / 2;
        this.centerY = rect.top + rect.height / 2;
        this.initialRotate = parseFloat(widget.data.rotate) || 0;

        this.startAngle = Math.atan2(e.clientY - this.centerY, e.clientX - this.centerX);

        window.addEventListener('mousemove', this.handleInteractMove);
        window.addEventListener('mouseup', this.handleInteractUp);
    }

    handleInteractMove = (e) => {
        if (!this.activeWidget) return;

        const scale = this.scale || 1;

        if (this.isResizing) {
            const dx = (e.clientX - this.startMouseX) / scale;
            const dy = (e.clientY - this.startMouseY) / scale;

            this.applyResize(dx, dy);
        }

        if (this.isRotating) {
            const currentAngle = Math.atan2(e.clientY - this.centerY, e.clientX - this.centerX);
            const deltaRad = currentAngle - this.startAngle;
            const deltaDeg = deltaRad * (180 / Math.PI);

            let newRotate = this.initialRotate - deltaDeg;

            if (e.shiftKey) {
                newRotate = Math.round(newRotate / 15) * 15;
            }

            this.updateWidget(this.activeWidget.id, 'rotate', Math.round(newRotate));
        }
    }

    handleInteractUp = () => {
        this.isResizing = false;
        this.isRotating = false;
        this.activeWidget = null;
        window.removeEventListener('mousemove', this.handleInteractMove);
        window.removeEventListener('mouseup', this.handleInteractUp);
    }

    applyResize(dx, dy) {
        const w = this.activeWidget;
        let dWidth = 0;
        let dHeight = 0;

        if (this.resizeHandle.includes('r')) dWidth = dx;
        else if (this.resizeHandle.includes('l')) dWidth = -dx;

        if (this.resizeHandle.includes('b')) dHeight = dy;
        else if (this.resizeHandle.includes('t')) dHeight = -dy;

        if (w.type === 'image') {
            const change = Math.abs(dWidth) > Math.abs(dHeight) ? dWidth : dHeight;
            let newSize = this.initialSize + change;
            if (newSize < 10) newSize = 10;
            this.updateWidget(w.id, 'size', Math.round(newSize));
        }
        else if (w.type === 'label') {
            let newSize = this.initialFontSize + dHeight;
            if (newSize < 6) newSize = 6;
            this.updateWidget(w.id, 'font_size', Math.round(newSize));
        }
        else {
            let newW = this.initialVecSize.w + dWidth;
            let newH = this.initialVecSize.h + dHeight;

            if (newW < 10) newW = 10;
            if (newH < 10) newH = 10;

            this.updateWidget(w.id, 'size', `${Math.round(newW)}, ${Math.round(newH)}`);
        }
    }

    updateSelectionAttributes() {
        this.widgets.forEach(w => {
            if (this.selectedId === w.id) {
                w.element.classList.add('ring-2', 'ring-teal-500', 'z-50');
            } else {
                w.element.classList.remove('ring-2', 'ring-teal-500', 'z-50');
            }
        });
    }

    renderPropertiesPanel(widget) {
        const panel = document.getElementById('properties-panel');
        if (!widget) {
            panel.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-zinc-500 gap-2 opacity-60"><span class="text-4xl">👆</span><p class="text-sm">Select a widget to edit</p></div>`;
            return;
        }

        panel.innerHTML = '';

        const header = document.createElement('div');
        header.className = "flex items-center justify-between pb-4 mb-2 border-b border-zinc-800";
        header.innerHTML = `
             <span class="text-xs font-bold text-teal-500 uppercase">${widget.type}</span>
        `;
        const delBtn = document.createElement('button');
        delBtn.className = "text-xs text-red-500 hover:text-red-400";
        delBtn.textContent = "Delete";
        delBtn.onclick = () => this.deleteWidget(widget.id);
        header.appendChild(delBtn);
        panel.appendChild(header);

        const propertyGroups = this.getPropertyGroups(widget.type);

        propertyGroups.forEach(group => {
            const children = [];
            group.fields.forEach(key => {
                const value = widget.data[key] ?? this.getDefaultValue(widget.type, key);
                const component = this.renderField(key, value, widget);
                if (component) children.push(component);
            });

            if (children.length > 0) {
                panel.appendChild(UIManager.createSection(group.name, null, children));
            }
        });
    }

    getPropertyGroups(type) {
        const common = [
            { name: 'Position', fields: ['position', 'halign', 'valign', 'zindex'] }
        ];

        const shadow = { name: 'Shadow', fields: ['shadow_passes', 'shadow_size', 'shadow_color', 'shadow_boost'] };

        switch (type) {
            case 'background':
                return [
                    { name: 'Appearance', fields: ['path', 'color'] },
                    { name: 'Blur', fields: ['blur_passes', 'blur_size', 'noise', 'contrast', 'brightness', 'vibrancy', 'vibrancy_darkness'] },
                    { name: 'Options', fields: ['reload_time', 'reload_cmd', 'crossfade_time', 'zindex'] }
                ];
            case 'image':
                return [
                    { name: 'Source', fields: ['path', 'size'] },
                    { name: 'Style', fields: ['rounding', 'border_size', 'border_color', 'rotate'] },
                    ...common, shadow
                ];
            case 'shape':
                return [
                    { name: 'Appearance', fields: ['size', 'color', 'rounding', 'rotate'] },
                    { name: 'Border', fields: ['border_size', 'border_color', 'xray'] },
                    ...common, shadow
                ];
            case 'input-field':
                return [
                    { name: 'Size & Shape', fields: ['size', 'outline_thickness', 'rounding'] },
                    { name: 'Colors', fields: ['outer_color', 'inner_color', 'font_color', 'check_color', 'fail_color'] },
                    { name: 'Dots', fields: ['dots_size', 'dots_spacing', 'dots_center', 'dots_rounding'] },
                    { name: 'Text', fields: ['font_family', 'placeholder_text', 'fail_text'] },
                    { name: 'Behavior', fields: ['fade_on_empty', 'fade_timeout', 'hide_input'] },
                    ...common, shadow
                ];
            case 'label':
                return [
                    { name: 'Content', fields: ['text', 'text_align'] },
                    { name: 'Style', fields: ['color', 'font_size', 'font_family', 'rotate'] },
                    ...common, shadow
                ];
            default:
                return [{ name: 'Properties', fields: Object.keys(this.widgets.find(w => w.type === type)?.data || {}) }];
        }
    }

    getDefaultValue(type, key) {
        const defaults = {
            'zindex': type === 'background' ? -1 : 0,
            'halign': 'center',
            'valign': 'center',
            'position': '0, 0',
            'rounding': -1,
            'shadow_passes': 0,
            'shadow_size': 3,
            'shadow_color': 'rgb(0,0,0)',
            'shadow_boost': 1.2,
            'blur_passes': 0,
            'blur_size': 7,
            'rotate': 0,
            'border_size': 0,
            'size': type === 'image' ? 150 : '100, 100',
        };
        return defaults[key] ?? '';
    }

    renderField(key, value, widget) {
        const val = value ?? '';
        const label = key.replace(/_/g, ' ');

        const update = (v) => this.updateWidget(widget.id, key, v);

        if (key.includes('color')) {
            return UIManager.createStackColorPicker(label, null, val,
                (hex) => this.handleColorChange(widget.id, key, hex),
                (text) => this.updateWidget(widget.id, key, text)
            );
        }
        else if (key === 'path') {
            return UIManager.createStackActionInput(label, null, val, "Path to image...", "📁",
                () => this.openImagePicker(widget.id),
                update
            );
        }
        else if (key === 'font_family') {
            return UIManager.createStackActionInput(label, null, val, "Font Family", "🔤",
                () => this.openFontPicker(widget.id),
                update
            );
        }
        else if (['text', 'placeholder_text', 'fail_text'].includes(key)) {
            return UIManager.createStackTextArea(label, null, val, "...", update);
        }
        else if (['halign', 'valign', 'text_align'].includes(key)) {
            let options = [];
            if (key === 'halign') options = ['left', 'center', 'right', 'none'];
            else if (key === 'valign') options = ['top', 'center', 'bottom', 'none'];
            else if (key === 'text_align') options = ['left', 'center', 'right'];

            return UIManager.createStackSelect(label, null, val,
                options.map(o => ({ value: o, label: o })),
                update
            );
        }
        else if (['fade_on_empty', 'hide_input', 'dots_center', 'xray'].includes(key)) {
            return UIManager.createToggle(label, null, val === true, update);
        }
        else if (['zindex', 'rotate', 'font_size', 'border_size', 'outline_thickness', 'blur_passes', 'blur_size',
            'shadow_passes', 'shadow_size', 'shadow_boost', 'rounding', 'dots_rounding', 'fade_timeout',
            'contrast', 'brightness', 'vibrancy', 'vibrancy_darkness', 'noise', 'reload_time', 'crossfade_time',
            'dots_size', 'dots_spacing'].includes(key)) {
            return UIManager.createStackInput(label, null, val, "0", (v) => update(parseFloat(v) || 0), null, 'number');
        }
        else {
            return UIManager.createStackInput(label, null, val, "...", update);
        }
    }

    updateWidget(id, key, value) {
        const w = this.widgets.find(x => x.id === id);
        if (w) {
            if (typeof value === 'string' && !isNaN(value) && value.trim() !== '' &&
                !key.includes('color') && !key.includes('text') && !key.includes('position') && !key.includes('path')) {
                value = Number(value);
            }
            w.data[key] = value;
            this.render();
            this.renderPropertiesPanel(w);
            this.triggerAutosave();
        }
    }

    deleteWidget(id) {
        this.widgets = this.widgets.filter(w => w.id !== id);
        this.selectedId = null;
        this.render();
        this.renderPropertiesPanel(null);
        showToast('Widget deleted', 'info');
        this.triggerAutosave();
    }

    openImagePicker(widgetId) {
        ImagePicker.open({
            multiselect: false,
            onSelect: (items) => {
                if (items.length > 0) {
                    this.updateWidget(widgetId, 'path', items[0].path);
                    const w = this.widgets.find(x => x.id === widgetId);
                    this.renderPropertiesPanel(w);
                }
            }
        });
    }

    openFontPicker(widgetId) {
        const widget = this.widgets.find(x => x.id === widgetId);
        const currentFont = widget ? (widget.data.font_family || '') : '';

        FontPicker.open({
            currentValue: currentFont,
            onSelect: (fontFamily) => {
                this.updateWidget(widgetId, 'font_family', fontFamily);
                const w = this.widgets.find(x => x.id === widgetId);
                this.renderPropertiesPanel(w);
                showToast(`Font set to "${fontFamily}"`);
            }
        });
    }

    rgbToHex(str) {
        return ColorUtils.toHex(str);
    }

    handleColorChange(widgetId, key, hexValue) {
        const widget = this.widgets.find(w => w.id === widgetId);
        if (!widget) return;

        const originalValue = widget.data[key];
        const newValue = ColorUtils.formatUpdate(originalValue, hexValue);

        this.updateWidget(widgetId, key, newValue);
    }

    async loadPresets() {
        try {
            const response = await fetch('/presets/hyprlock');
            const data = await response.json();
            this.presets = data.presets || [];
            this.activePreset = data.active_preset;
        } catch (error) {
            console.error('Failed to load presets:', error);
            this.presets = [];
            this.activePreset = null;
        }
    }

    renderPresetSelector() {
    }

    async updateActivePreset(silent = false) {
        if (window._presetManagers['hyprlock']) {
            await window._presetManagers['hyprlock'].updateActivePreset(silent);
        }
    }

    toggleFullScreen() {
        const container = document.getElementById('canvas-container');
        const exitBtn = document.getElementById('exit-fullscreen-btn');
        const isFullScreen = document.body.classList.contains('hyprlock-fullscreen');

        if (!isFullScreen) {
            document.body.classList.add('hyprlock-fullscreen');

            const screenW = window.screen.width;
            const screenH = window.screen.height;
            const scaleX = screenW / 1920;
            const scaleY = screenH / 1080;
            const fitScale = Math.min(scaleX, scaleY);

            this.prevScale = this.scale;
            this.setZoom(fitScale);

            if (container.requestFullscreen) container.requestFullscreen();
            else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();

            if (exitBtn) exitBtn.classList.remove('hidden');

            const onExit = () => this.toggleFullScreen();
            exitBtn.onclick = onExit;

            const onFullScreenChange = () => {
                const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
                if (!fsElement && document.body.classList.contains('hyprlock-fullscreen')) {
                    this.toggleFullScreen();
                    document.removeEventListener('fullscreenchange', onFullScreenChange);
                    document.removeEventListener('webkitfullscreenchange', onFullScreenChange);
                }
            };
            document.addEventListener('fullscreenchange', onFullScreenChange);
            document.addEventListener('webkitfullscreenchange', onFullScreenChange);

        } else {
            document.body.classList.remove('hyprlock-fullscreen');

            if (this.prevScale) {
                this.setZoom(this.prevScale);
            }

            if (document.fullscreenElement || document.webkitFullscreenElement) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }

            if (exitBtn) exitBtn.classList.add('hidden');
        }

        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    }
}

window.hyprlockEditor = new HyprlockEditor();
