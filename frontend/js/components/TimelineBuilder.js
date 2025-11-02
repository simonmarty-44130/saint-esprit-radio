/**
 * TimelineBuilder - Interface principale de construction de timeline
 * Module pour créer des playlists matinales avec horaires précis
 */

class TimelineBuilder {
    constructor() {
        this.startTime = null;
        this.endTime = null;
        this.items = [];
        this.currentPosition = 0; // Position temporelle en secondes
        this.isRecurrent = false;
        this.templateName = '';
        this.audioManager = window.app?.audioManager || null;
        this.autoSaveTimer = null;
        this.lastSavedData = null;
        
        // Bind methods
        this.handleFileDrop = this.handleFileDrop.bind(this);
        this.handleItemEdit = this.handleItemEdit.bind(this);
        
        // Charger le dernier template au démarrage
        this.loadLastTemplate();
    }

    /**
     * Initialiser timeline avec plage horaire
     */
    initTimeline(startTime, endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.items = [];
        this.currentPosition = this.timeToSeconds(startTime);
        
        // Ajouter première ligne vide
        this.addEmptyLine();
        this.render();
    }

    /**
     * Convertir time string en secondes
     */
    timeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * Convertir secondes en time string
     */
    secondsToTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Convertir durée en secondes vers format mm:ss
     */
    secondsToDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Obtenir durée d'un fichier audio
     */
    async getAudioDuration(file) {
        return new Promise((resolve) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);
            
            audio.addEventListener('loadedmetadata', () => {
                URL.revokeObjectURL(url);
                resolve(Math.floor(audio.duration));
            });
            
            audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
                resolve(0);
            });
            
            audio.src = url;
        });
    }

    /**
     * Détecter si un titre contient des variables
     */
    detectIfVariable(title) {
        const patterns = {
            date: /\b(aujourd'hui|date|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i,
            weather: /\b(météo|temps|température|°C|ensoleillé|pluie)\b/i,
            news: /\b(flash|info|actualité|breaking)\b/i,
            time: /\b(heure|horaire|top)\b/i
        };
        
        return Object.keys(patterns).some(key => patterns[key].test(title));
    }

    /**
     * Ajouter élément et auto-calculer ligne suivante
     */
    async addItem(title, audioFile = null, index = null) {
        const duration = audioFile ? await this.getAudioDuration(audioFile) : 0;
        
        const item = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timeCode: this.secondsToTime(this.currentPosition),
            title: title,
            audioFile: audioFile,
            audioFileName: audioFile ? audioFile.name : null,
            duration: duration,
            durationDisplay: duration ? this.secondsToDuration(duration) : '--',
            type: audioFile ? 'audio' : 'live',
            isVariable: this.detectIfVariable(title)
        };
        
        if (index !== null && index < this.items.length) {
            // Insérer à un index spécifique
            this.items.splice(index, 0, item);
            this.recalculateTimecodes();
        } else {
            // Ajouter à la fin
            this.items.push(item);
            this.currentPosition += duration;
            
            // Auto-créer ligne suivante si pas de dépassement
            if (this.currentPosition < this.timeToSeconds(this.endTime)) {
                this.addEmptyLine();
            }
        }
        
        this.render();
        return item;
    }

    /**
     * Ajouter ligne vide
     */
    addEmptyLine() {
        const emptyItem = {
            id: `empty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timeCode: this.secondsToTime(this.currentPosition),
            title: '',
            audioFile: null,
            audioFileName: null,
            duration: 0,
            durationDisplay: '--',
            type: 'empty',
            isVariable: false
        };
        
        this.items.push(emptyItem);
    }

    /**
     * Ajouter un block
     */
    addBlock(block, index = null) {
        // Convertir la durée planifiée du block en secondes
        const [minutes, seconds] = block.plannedDuration.split(':').map(Number);
        const duration = minutes * 60 + seconds;
        
        const item = {
            id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timeCode: this.secondsToTime(this.currentPosition),
            title: `📁 ${block.title}`,
            audioFile: null,
            audioFileName: null,
            duration: duration,
            durationDisplay: block.plannedDuration,
            type: 'block',
            blockId: block.id,
            blockData: block,
            isVariable: false
        };
        
        if (index !== null && index < this.items.length) {
            this.items.splice(index, 0, item);
            this.recalculateTimecodes();
        } else {
            this.items.push(item);
            this.currentPosition += duration;
            
            if (this.currentPosition < this.timeToSeconds(this.endTime)) {
                this.addEmptyLine();
            }
        }
        
        this.render();
        return item;
    }

    /**
     * Recalculer tous les timecodes
     */
    recalculateTimecodes() {
        let position = this.timeToSeconds(this.startTime);
        
        this.items.forEach(item => {
            item.timeCode = this.secondsToTime(position);
            position += item.duration;
        });
        
        this.currentPosition = position;
    }

    /**
     * Supprimer un élément
     */
    removeItem(itemId) {
        const index = this.items.findIndex(item => item.id === itemId);
        if (index > -1) {
            this.items.splice(index, 1);
            this.recalculateTimecodes();
            this.render();
            this.triggerAutoSave();
        }
    }

    /**
     * Gérer le drop de fichier
     */
    async handleFileDrop(event, itemId) {
        event.preventDefault();
        event.stopPropagation();
        
        const files = event.dataTransfer?.files || event.target?.files;
        if (!files || files.length === 0) return;
        
        const file = files[0];
        if (!file.type.startsWith('audio/')) {
            alert('Veuillez déposer un fichier audio');
            return;
        }
        
        const itemIndex = this.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;
        
        const item = this.items[itemIndex];
        const duration = await this.getAudioDuration(file);
        
        // Mettre à jour l'item
        item.audioFile = file;
        item.audioFileName = file.name;
        item.duration = duration;
        item.durationDisplay = this.secondsToDuration(duration);
        item.type = 'audio';
        
        // Si c'était une ligne vide, ajouter le titre du fichier
        if (!item.title) {
            item.title = file.name.replace(/\\.[^/.]+$/, ''); // Retirer l'extension
        }
        
        this.recalculateTimecodes();
        
        // Ajouter ligne vide si c'était la dernière
        if (itemIndex === this.items.length - 1 && 
            this.currentPosition < this.timeToSeconds(this.endTime)) {
            this.addEmptyLine();
        }
        
        this.render();
        this.triggerAutoSave();
    }

    /**
     * Gérer l'édition d'un item
     */
    handleItemEdit(itemId, field, value) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;
        
        if (field === 'title') {
            item.title = value;
            item.isVariable = this.detectIfVariable(value);
            
            // Si ligne vide devient non-vide et c'est la dernière
            if (item.type === 'empty' && value && value.trim() !== '') {
                item.type = 'live';
                const isLast = this.items[this.items.length - 1].id === itemId;
                if (isLast && this.currentPosition < this.timeToSeconds(this.endTime)) {
                    this.addEmptyLine();
                }
            }
            // Si on efface tout le texte d'un item non-empty, le repasser en empty
            else if (item.type === 'live' && (!value || value.trim() === '')) {
                item.type = 'empty';
            }
        }
        
        // Sauvegarder la position du curseur
        const activeElement = document.activeElement;
        const cursorPosition = activeElement.selectionStart;
        
        this.render();
        this.triggerAutoSave();
        
        // Restaurer le focus et la position du curseur
        setTimeout(() => {
            const newInput = document.querySelector(`input[data-item-id="${itemId}"]`);
            if (newInput && field === 'title') {
                newInput.focus();
                newInput.setSelectionRange(cursorPosition, cursorPosition);
            }
        }, 0);
    }

    /**
     * Obtenir les données de la timeline
     */
    getTimelineData() {
        const totalDuration = this.currentPosition - this.timeToSeconds(this.startTime);
        
        return {
            name: this.templateName || `Timeline_${new Date().toISOString().split('T')[0]}`,
            startTime: this.startTime,
            endTime: this.endTime,
            totalDuration: totalDuration,
            totalDurationDisplay: this.secondsToDuration(totalDuration),
            isRecurrent: this.isRecurrent,
            items: this.items.filter(item => item.type !== 'empty').map(item => ({
                ...item,
                audioFile: item.audioFile // Garder le File object pour l'export
            }))
        };
    }

    /**
     * Charger une timeline existante
     */
    loadTimeline(timelineData) {
        this.startTime = timelineData.startTime;
        this.endTime = timelineData.endTime;
        this.isRecurrent = timelineData.isRecurrent || false;
        this.templateName = timelineData.name || '';
        this.items = timelineData.items || [];
        
        this.recalculateTimecodes();
        
        // Ajouter ligne vide si nécessaire
        if (this.currentPosition < this.timeToSeconds(this.endTime)) {
            this.addEmptyLine();
        }
        
        this.render();
    }

    /**
     * Render de l'interface
     */
    render() {
        const container = document.getElementById('timeline-builder-container');
        if (!container) {
            console.error('timeline-builder-container not found!');
            return;
        }
        
        const totalDuration = this.startTime ? this.currentPosition - this.timeToSeconds(this.startTime) : 0;
        const remainingTime = this.endTime ? this.timeToSeconds(this.endTime) - this.currentPosition : 0;
        
        container.innerHTML = `
            <div class="timeline-builder">
                <div class="timeline-header">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                        <h3 style="margin: 0;">🎵 Template Builder</h3>
                        <input type="text" 
                               id="template-name-header" 
                               value="${this.templateName || ''}" 
                               placeholder="Nom du template..."
                               style="flex: 1; max-width: 300px; padding: 8px 12px; 
                                      background: var(--bg-light); color: white; 
                                      border: 1px solid var(--border); border-radius: 4px;"
                               oninput="timelineBuilder.updateTemplateName(this.value)">
                        <span id="save-status" style="color: #4ade80; font-size: 0.9rem; display: none;">
                            ✅ Sauvegardé
                        </span>
                    </div>
                    <div class="timeline-controls">
                        <label>
                            Plage horaire: De 
                            <input type="time" value="${this.startTime || '06:00'}" 
                                   id="timeline-start" step="1">
                        </label>
                        <label>
                            à 
                            <input type="time" value="${this.endTime || '07:00'}" 
                                   id="timeline-end" step="1">
                        </label>
                        <button class="btn-primary" onclick="timelineBuilder.initFromInputs()">
                            Démarrer
                        </button>
                        <button class="btn-secondary" onclick="timelineBuilder.clearTemplate()" style="margin-left: 10px;">
                            🗑️ Nouveau
                        </button>
                    </div>
                </div>
                
                ${this.startTime && this.endTime ? `
                    <div class="timeline-info">
                        <span>Durée totale: ${this.secondsToDuration(totalDuration)}</span>
                        <span>Temps restant: ${this.secondsToDuration(Math.max(0, remainingTime))}</span>
                        <button class="btn-add-block" onclick="timelineBuilder.showBlockSelector()" style="margin-left: auto;">
                            📁 Ajouter un Block
                        </button>
                        <button class="btn-add-ad" onclick="timelineBuilder.openAdPlaceholderModal()" style="margin-left: 10px; background: #808080; color: white;">
                            📺 Ajouter Publicité
                        </button>
                    </div>
                    
                    <div class="timeline-table">
                        <div class="timeline-table-header">
                            <div class="col-time">⏰ Horaire</div>
                            <div class="col-title">📝 Élément</div>
                            <div class="col-audio">🎵 Audio</div>
                            <div class="col-duration">⏱️ Durée</div>
                            <div class="col-actions">Actions</div>
                        </div>
                        
                        <div class="timeline-items">
                            ${this.items.map(item => this.renderItem(item)).join('')}
                        </div>
                    </div>
                    
                    <div class="timeline-footer">
                        <label class="checkbox-label">
                            <input type="checkbox" id="is-recurrent" 
                                   ${this.isRecurrent ? 'checked' : ''}>
                            ☑️ Marquer comme récurrent
                        </label>
                        
                        ${this.isRecurrent ? `
                            <input type="text" id="template-name" 
                                   placeholder="Nom du template" 
                                   value="${this.templateName}"
                                   class="template-name-input">
                        ` : ''}
                        
                        <div class="timeline-actions">
                            <button class="btn-save" onclick="timelineBuilder.save()">
                                💾 Sauvegarder
                            </button>
                            <button class="btn-load" onclick="timelineBuilder.showLoadModal()">
                                📋 Charger
                            </button>
                            <button class="btn-export" onclick="timelineBuilder.export()">
                                📦 Export
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Attacher les event listeners
        this.attachEventListeners();
    }

    /**
     * Render d'un item
     */
    renderItem(item) {
        const isActive = item.type === 'empty';
        const hasAudio = item.type === 'audio';
        const isBlock = item.type === 'block';
        const isAdPlaceholder = item.type === 'ad_placeholder';
        
        // Style spécial pour les blocks et AD placeholders
        let itemClass = isActive ? 'active' : '';
        itemClass += item.isVariable ? ' has-variable' : '';
        itemClass += isBlock ? ' is-block' : '';
        itemClass += isAdPlaceholder ? ' is-ad-placeholder' : '';
        
        return `
            <div class="timeline-item ${itemClass}" 
                 data-item-id="${item.id}"
                 ${isAdPlaceholder ? 'style="background: repeating-linear-gradient(45deg, rgba(128,128,128,0.05), rgba(128,128,128,0.05) 10px, transparent 10px, transparent 20px); border: 1px dashed #808080;"' : ''}>
                <div class="col-time">${item.timeCode}</div>
                <div class="col-title">
                    ${isBlock ? 
                        `<div class="block-title" style="padding: 0.5rem; background-color: ${item.blockData.color}20; border: 1px solid ${item.blockData.color}; border-radius: 4px;">
                            ${item.title}
                        </div>` :
                        isAdPlaceholder ?
                        `<div class="ad-title" style="padding: 0.5rem; color: #999; font-style: italic;">
                            ${item.title}
                            ${item.notes ? `<small style="display: block; color: #666; margin-top: 0.25rem;">${item.notes}</small>` : ''}
                        </div>` :
                        `<input type="text" 
                               value="${item.title}" 
                               placeholder="${isActive ? 'Nouvel élément' : ''}"
                               class="item-title-input"
                               data-item-id="${item.id}"
                               oninput="window.timelineBuilder.handleItemEdit('${item.id}', 'title', this.value)">`
                    }
                </div>
                <div class="col-audio">
                    ${isBlock ? 
                        `<div class="block-info" style="text-align: center; color: var(--text-muted);">
                            <small>Block avec ${item.blockData.items?.length || 0} éléments</small>
                        </div>` :
                        isAdPlaceholder ?
                        `<div class="ad-info" style="text-align: center; color: #808080;">
                            <small>📺 Open Radio - ${item.adType || 'commercial'}</small>
                        </div>` :
                        `<div class="audio-drop-zone ${hasAudio ? 'has-file' : ''}" 
                             data-item-id="${item.id}">
                            ${hasAudio ? 
                                `<span class="audio-file-name">${item.audioFileName}</span>` : 
                                `<span class="drop-hint">Drop file</span>`
                            }
                            <input type="file" accept="audio/*" class="hidden-file-input" 
                                   data-item-id="${item.id}">
                        </div>`
                    }
                </div>
                <div class="col-duration">${item.durationDisplay}</div>
                <div class="col-actions">
                    ${!isActive ? `
                        <button class="btn-remove" onclick="timelineBuilder.removeItem('${item.id}')">
                            ❌
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Attacher les event listeners
     */
    attachEventListeners() {
        // Checkbox récurrent
        const recurrentCheckbox = document.getElementById('is-recurrent');
        if (recurrentCheckbox) {
            recurrentCheckbox.addEventListener('change', (e) => {
                this.isRecurrent = e.target.checked;
                this.render();
            });
        }
        
        // Nom du template
        const templateNameInput = document.getElementById('template-name');
        if (templateNameInput) {
            templateNameInput.addEventListener('input', (e) => {
                this.templateName = e.target.value;
            });
        }
        
        // Les inputs de titre utilisent maintenant oninput directement dans le HTML
        
        // Drop zones
        document.querySelectorAll('.audio-drop-zone').forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('dragover');
            });
            
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('dragover');
            });
            
            zone.addEventListener('drop', (e) => {
                zone.classList.remove('dragover');
                this.handleFileDrop(e, zone.dataset.itemId);
            });
            
            zone.addEventListener('click', () => {
                const fileInput = zone.querySelector('.hidden-file-input');
                if (fileInput) fileInput.click();
            });
        });
        
        // File inputs
        document.querySelectorAll('.hidden-file-input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.handleFileDrop(e, input.dataset.itemId);
            });
        });
    }

    /**
     * Initialiser depuis les inputs
     */
    initFromInputs() {
        const startInput = document.getElementById('timeline-start');
        const endInput = document.getElementById('timeline-end');
        
        if (startInput && endInput) {
            const startTime = startInput.value || '06:00';
            const endTime = endInput.value || '07:00';
            
            if (this.timeToSeconds(endTime) <= this.timeToSeconds(startTime)) {
                alert('L\'heure de fin doit être après l\'heure de début');
                return;
            }
            
            this.initTimeline(startTime, endTime);
        }
    }

    /**
     * Sauvegarder la timeline
     */
    async save() {
        const data = this.getTimelineData();
        
        if (this.isRecurrent && !this.templateName) {
            alert('Veuillez donner un nom au template récurrent');
            return;
        }
        
        // Utiliser le RecurrenceManager si disponible
        if (this.isRecurrent && window.recurrenceManager) {
            const template = await window.recurrenceManager.saveAsRecurrent(data, this.templateName);
            console.log('Template récurrent sauvegardé:', template);
            alert(`Template "${this.templateName}" sauvegardé avec succès!`);
        } else {
            // Sauvegarde simple en localStorage
            const key = `timeline_${data.name}`;
            localStorage.setItem(key, JSON.stringify(data));
            alert('Timeline sauvegardée!');
        }
    }

    /**
     * Exporter la timeline
     */
    async export() {
        const data = this.getTimelineData();
        
        if (window.exportManager) {
            await window.exportManager.exportComplete(data);
        } else {
            console.error('ExportManager non disponible');
            alert('Module d\'export non disponible');
        }
    }

    /**
     * Afficher modal de chargement
     */
    showLoadModal() {
        // TODO: Implémenter modal de sélection de timeline
        console.log('Load modal à implémenter');
    }

    /**
     * Afficher le sélecteur de blocks
     */
    showBlockSelector() {
        // Récupérer les blocks depuis le BlockManager
        const blockManager = window.app?.blockManager;
        if (!blockManager) {
            alert('Block Manager non disponible');
            return;
        }

        const blocks = blockManager.getBlocks();
        
        // Créer le modal
        const modalHTML = `
            <div id="block-selector-modal" class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Sélectionner un Block</h3>
                        <button class="icon-btn" onclick="timelineBuilder.closeBlockSelector()">✕</button>
                    </div>
                    <div class="modal-body">
                        ${blocks.length > 0 ? `
                            <div class="block-list">
                                ${blocks.map(block => `
                                    <div class="block-option" onclick="timelineBuilder.selectBlock(${block.id})" 
                                         style="padding: 1rem; margin: 0.5rem 0; background: var(--bg-light); 
                                                border-radius: 8px; cursor: pointer; border: 2px solid transparent;
                                                transition: all 0.2s;">
                                        <div style="display: flex; align-items: center; gap: 1rem;">
                                            <div style="width: 20px; height: 20px; background: ${block.color}; 
                                                        border-radius: 4px;"></div>
                                            <div>
                                                <h4 style="margin: 0;">${block.title}</h4>
                                                <small style="color: var(--text-muted);">
                                                    Durée: ${block.plannedDuration} | 
                                                    ${block.items.length} éléments
                                                </small>
                                            </div>
                                        </div>
                                        ${block.description ? 
                                            `<p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; 
                                                       color: var(--text-secondary);">${block.description}</p>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <p style="text-align: center; color: var(--text-muted);">
                                Aucun block disponible. Créez d'abord des blocks dans la section Blocks.
                            </p>
                        `}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="timelineBuilder.closeBlockSelector()">Annuler</button>
                        ${blocks.length === 0 ? `
                            <button class="btn btn-primary" onclick="window.app.switchTab('blocks')">
                                Aller aux Blocks
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Ajouter le modal au DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Ajouter les styles CSS pour le hover
        const style = document.createElement('style');
        style.textContent = `
            .block-option:hover {
                border-color: var(--primary) !important;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Ouvrir le modal AD Placeholder pour Template Builder
     */
    openAdPlaceholderModal() {
        const modalHTML = `
            <div class="modal-overlay" id="ad-placeholder-modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Ajouter un Placeholder Publicitaire</h3>
                        <button class="close-btn" onclick="timelineBuilder.closeAdPlaceholderModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="ad-title">Titre</label>
                            <input type="text" id="ad-title" value="Publicité - Bloc Commercial" required>
                        </div>
                        <div class="form-group">
                            <label for="ad-duration">Durée</label>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" id="ad-duration" value="3:00" placeholder="MM:SS" required>
                                <span style="color: #666; align-self: center;">ou</span>
                                <input type="number" id="ad-duration-seconds" min="10" max="600" placeholder="Secondes">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="ad-type">Type de publicité</label>
                            <select id="ad-type">
                                <option value="commercial">Commercial</option>
                                <option value="sponsoring">Sponsoring</option>
                                <option value="promo">Promo</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="ad-notes">Notes (optionnel)</label>
                            <textarea id="ad-notes" rows="3" placeholder="Instructions pour Action de Grace..."></textarea>
                        </div>
                        <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin-top: 15px;">
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">
                                <strong>📺 External Audio Provider:</strong> Open Radio<br>
                                <small>L'audio sera géré par Action de Grace lors de la diffusion.</small>
                            </p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="timelineBuilder.closeAdPlaceholderModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="timelineBuilder.saveAdPlaceholder()">Ajouter Placeholder</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup duration sync
        const durationInput = document.getElementById('ad-duration');
        const secondsInput = document.getElementById('ad-duration-seconds');
        
        durationInput.addEventListener('input', () => {
            const parts = durationInput.value.split(':');
            if (parts.length === 2) {
                const minutes = parseInt(parts[0]) || 0;
                const seconds = parseInt(parts[1]) || 0;
                secondsInput.value = minutes * 60 + seconds;
            }
        });
        
        secondsInput.addEventListener('input', () => {
            const totalSeconds = parseInt(secondsInput.value) || 0;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            durationInput.value = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        });
    }

    /**
     * Fermer le modal AD Placeholder
     */
    closeAdPlaceholderModal() {
        const modal = document.getElementById('ad-placeholder-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Sauvegarder AD Placeholder dans la timeline
     */
    saveAdPlaceholder() {
        const title = document.getElementById('ad-title').value.trim();
        const durationStr = document.getElementById('ad-duration').value;
        const adType = document.getElementById('ad-type').value;
        const notes = document.getElementById('ad-notes').value.trim();
        
        if (!title || !durationStr) {
            alert('Le titre et la durée sont obligatoires');
            return;
        }
        
        // Parser la durée
        const parts = durationStr.split(':');
        let duration = 0;
        if (parts.length === 2) {
            duration = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
        }
        
        if (duration <= 0) {
            alert('Durée invalide');
            return;
        }
        
        // Créer l'item AD Placeholder
        const item = {
            id: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timeCode: this.secondsToTime(this.currentPosition),
            title: `📺 ${title} [Open Radio]`,
            audioFile: null,
            audioFileName: null,
            duration: duration,
            durationDisplay: durationStr,
            type: 'ad_placeholder',
            adType: adType,
            notes: notes,
            externalProvider: 'Open Radio',
            isGhost: true,
            hasAudio: false,
            isVariable: false
        };
        
        // Ajouter à la timeline
        this.items.push(item);
        this.currentPosition += duration;
        
        // Ajouter ligne vide si nécessaire
        if (this.currentPosition < this.timeToSeconds(this.endTime)) {
            this.addEmptyLine();
        }
        
        this.closeAdPlaceholderModal();
        this.render();
        
        // Déclencher la sauvegarde automatique
        this.triggerAutoSave();
        
        // Notification
        if (window.showNotification) {
            window.showNotification('Placeholder publicitaire ajouté', 'success');
        }
    }

    /**
     * Mettre à jour le nom du template
     */
    updateTemplateName(name) {
        this.templateName = name;
        
        // Déclencher la sauvegarde automatique
        this.triggerAutoSave();
    }
    
    /**
     * Déclencher la sauvegarde automatique
     */
    triggerAutoSave() {
        // Annuler le timer précédent
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        // Sauvegarder après 1 seconde d'inactivité
        this.autoSaveTimer = setTimeout(() => {
            this.autoSave();
        }, 1000);
    }
    
    /**
     * Sauvegarde automatique
     */
    autoSave() {
        if (!this.startTime || !this.endTime) {
            return; // Ne pas sauvegarder si la timeline n'est pas initialisée
        }
        
        const data = this.getTimelineData();
        
        // Sauvegarder dans localStorage
        localStorage.setItem('timelineBuilder_current', JSON.stringify(data));
        localStorage.setItem('timelineBuilder_lastTemplateName', this.templateName);
        
        // Afficher l'indicateur de sauvegarde
        const saveStatus = document.getElementById('save-status');
        if (saveStatus) {
            saveStatus.style.display = 'inline';
            setTimeout(() => {
                saveStatus.style.display = 'none';
            }, 2000);
        }
        
        this.lastSavedData = JSON.stringify(data);
    }
    
    /**
     * Charger le dernier template
     */
    loadLastTemplate() {
        try {
            // Récupérer le dernier template sauvegardé
            const savedData = localStorage.getItem('timelineBuilder_current');
            const lastTemplateName = localStorage.getItem('timelineBuilder_lastTemplateName');
            
            if (lastTemplateName) {
                this.templateName = lastTemplateName;
            }
            
            if (savedData) {
                const data = JSON.parse(savedData);
                this.loadTimeline(data);
                console.log('Template chargé automatiquement:', this.templateName);
            }
        } catch (error) {
            console.error('Erreur lors du chargement automatique:', error);
        }
    }
    
    /**
     * Effacer le template et recommencer
     */
    clearTemplate() {
        if (confirm('Êtes-vous sûr de vouloir effacer le template actuel ?')) {
            // Réinitialiser tout
            this.startTime = null;
            this.endTime = null;
            this.items = [];
            this.currentPosition = 0;
            this.isRecurrent = false;
            this.templateName = '';
            
            // Effacer le localStorage
            localStorage.removeItem('timelineBuilder_current');
            localStorage.removeItem('timelineBuilder_lastTemplateName');
            
            // Re-render
            this.render();
            
            if (window.showNotification) {
                window.showNotification('Template effacé', 'info');
            }
        }
    }

    /**
     * Fermer le sélecteur de blocks
     */
    closeBlockSelector() {
        const modal = document.getElementById('block-selector-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Sélectionner un block
     */
    selectBlock(blockId) {
        const blockManager = window.app?.blockManager;
        if (!blockManager) return;

        const block = blockManager.getBlocks().find(b => b.id === blockId);
        if (block) {
            this.addBlock(block);
            this.closeBlockSelector();
        }
    }
}

// Export global
window.TimelineBuilder = TimelineBuilder;

// Initialiser globalement
(function() {
    if (!window.timelineBuilder) {
        window.timelineBuilder = new TimelineBuilder();
    }
})();