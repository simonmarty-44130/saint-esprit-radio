// Unified Content Manager for News and Animation
class ContentManager {
    constructor(type) {
        this.type = type; // 'news' or 'animation'
        this.database = [];
        this.currentId = null;
        this.prefix = type === 'animation' ? 'animation-' : '';
        this.listeners = new Map();
        
        // Virtual list for performance
        this.virtualList = null;
        
        // Cache for DOM elements
        this.domCache = new Map();
        
        // Lock management
        this.lockHeartbeatInterval = null;
        this.currentLockId = null;
        
        // Debounced functions
        this.debouncedCalculateDuration = Utils.debounce(
            () => this.calculateDuration(), 
            Constants.DEBOUNCE_DELAY
        );
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }

    // Database operations
    setDatabase(database) {
        this.database = database;
        this.emit('database-changed', this.database);
    }

    getDatabase() {
        return this.database;
    }

    getCurrentItem() {
        return this.database.find(item => item.id === this.currentId);
    }

    create(templateItem = null) {
        const newItem = this.createNewItem();
        
        // If creating from a template (recurring item)
        if (templateItem) {
            // Copy most fields from template
            newItem.title = templateItem.title + ' (Copy)';
            newItem.content = templateItem.content;
            newItem.duration = templateItem.duration;
            newItem.author = templateItem.author;
            newItem.category = templateItem.category;
            newItem.type = templateItem.type;
            newItem.notes = templateItem.notes;
            newItem.urgent = templateItem.urgent || false;
            newItem.ready = templateItem.ready || false;
            newItem.recurring = templateItem.recurring || false;
            
            // Set templateId to track recurring items
            if (templateItem.recurring) {
                newItem.templateId = templateItem.templateId || templateItem.id;
            }
        }
        
        this.database.push(newItem);
        this.currentId = newItem.id;
        
        this.emit('item-created', newItem);
        this.render();
        
        // Re-initialize editor HTML to include block selector with updated blocks
        if (window.app) {
            window.app.initializeEditorHTML();
        }
        
        this.load(newItem.id);
        
        // Show editor
        this.showEditor();
        
        // Attacher les event listeners après avoir montré l'éditeur
        this.attachEventListeners();
        
        return newItem;
    }

    createFromTemplate(templateData) {
        // Create new item from template data
        const newItem = {
            id: Date.now(),
            ...templateData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.database.push(newItem);
        this.emit('item-created', newItem);
        this.emit('database-changed', this.database);
        
        return newItem;
    }

    async load(itemId) {
        const item = this.database.find(i => i.id === itemId);
        if (!item) return;

        this.currentId = itemId;
        
        // Update form fields
        this.populateForm(item);
        
        // Update UI
        this.updateActiveState(itemId);
        this.renderPackages();
        this.renderSounds();
        this.calculateDuration();
        
        // Show editor
        this.showEditor();
        
        // Attacher les event listeners APRÈS avoir montré l'éditeur
        this.attachEventListeners();
        
        // Signaler via AppSync qu'on édite cet élément (optionnel)
        if (window.realtimeSync) {
            window.realtimeSync.signalEditing(this.type, itemId);
        }
        
        this.emit('item-loaded', item);
    }

    // Nouvelle méthode pour attacher les event listeners
    attachEventListeners() {
        const contentEl = safeGetElement(`${this.prefix}content`);
        if (contentEl) {
            // Créer une fonction liée pour garder le contexte
            if (!this.boundCalculateDuration) {
                this.boundCalculateDuration = () => this.debouncedCalculateDuration();
            }
            
            // Supprimer l'ancien listener s'il existe
            contentEl.removeEventListener('input', this.boundCalculateDuration);
            
            // Ajouter le nouveau listener
            contentEl.addEventListener('input', this.boundCalculateDuration);
        }
    }

    async save() {
        const item = this.getCurrentItem();
        if (!item) return;

        const oldDuration = item.duration;
        
        // Update item from form
        this.updateItemFromForm(item);
        item.updatedAt = new Date().toISOString();
        
        // Handle multiple block assignments
        if (window.app?.blockManager) {
            const checkboxes = document.querySelectorAll(`#${this.prefix}block-selector-list input[type="checkbox"]:checked`);
            const selectedBlockIds = Array.from(checkboxes).map(cb => cb.value);
            
            // Update assigned blocks
            this.updateAssignedBlocks(selectedBlockIds);
        }
        
        // Update lastUsed if item is in conductor
        if (window.app?.conductorManager) {
            const idField = this.type === 'news' ? 'newsId' : 'animationId';
            const inConductor = window.app.conductorManager.findSegmentByItemId(item.id, idField);
            if (inConductor) {
                item.lastUsed = new Date().toISOString();
            }
        }
        
        // Update conductor if needed
        this.updateConductor(item, oldDuration);
        
        // Re-render
        this.render();
        
        this.emit('item-saved', item);
        showNotification(`${this.type === 'news' ? 'Story' : 'Animation'} saved!`, 'success');
    }

    async delete() {
        if (!this.currentId || !confirm(`Delete this ${this.type}?`)) return;

        const item = this.getCurrentItem();
        
        // Clean up audio files
        if (item?.sounds) {
            for (const sound of item.sounds) {
                if (sound.audioFileId && window.app?.storage) {
                    await window.app.storage.deleteAudioFile(sound.audioFileId);
                }
            }
        }
        
        // Remove from all blocks
        if (window.app?.blockManager) {
            const blocks = window.app.blockManager.getBlocks();
            blocks.forEach(block => {
                if (block.items.some(blockItem => blockItem.type === this.type && blockItem.id === this.currentId)) {
                    window.app.blockManager.removeItem(block.id, this.type, this.currentId);
                }
            });
        }
        
        // Remove from database
        this.database = this.database.filter(i => i.id !== this.currentId);
        
        // Update UI
        this.currentId = null;
        this.clearEditor();
        this.render();
        
        this.emit('item-deleted', item);
        showNotification(`${this.type === 'news' ? 'Story' : 'Animation'} deleted`, 'warning');
    }

    // Form operations
    populateForm(item) {
        console.log('PopulateForm called, this:', this, 'getAssignedBlocks:', typeof this.getAssignedBlocks);
        safeSetValue(`${this.prefix}title`, item.title);
        safeSetValue(`${this.prefix}content`, item.content);
        safeSetValue(`${this.prefix}duration`, item.duration);
        safeSetValue(`${this.prefix}author`, item.author);
        safeSetValue(`${this.prefix}status`, item.status || 'draft');
        safeSetValue(`${this.prefix}notes`, item.notes || '');
        
        // Set scheduled date
        if (item.scheduledDate) {
            safeSetValue(`${this.prefix}scheduled-date`, item.scheduledDate);
        }
        
        // Set tags
        const urgentEl = safeGetElement(`${this.prefix}tag-urgent`);
        if (urgentEl) urgentEl.checked = item.urgent === true;
        
        const readyEl = safeGetElement(`${this.prefix}tag-ready`);
        if (readyEl) readyEl.checked = item.ready === true;
        
        const recurringEl = safeGetElement(`${this.prefix}tag-recurring`);
        if (recurringEl) recurringEl.checked = item.recurring === true;
        
        // Show last used
        const lastUsedEl = safeGetElement(`${this.prefix}last-used`);
        if (lastUsedEl) {
            lastUsedEl.textContent = item.lastUsed ? 
                new Date(item.lastUsed).toLocaleString('fr-FR') : 'Never';
        }
        
        // Set assigned blocks checkboxes
        const assignedBlocks = this.getAssignedBlocks ? this.getAssignedBlocks() : [];
        const checkboxes = document.querySelectorAll(`#${this.prefix}block-selector-list input[type="checkbox"]`);
        checkboxes.forEach(checkbox => {
            checkbox.checked = assignedBlocks.includes(checkbox.value);
        });
        
        // Update the selected blocks text
        if (window.app && window.app.updateSelectedBlocks) {
            window.app.updateSelectedBlocks(this.prefix);
        }
        
        if (this.type === 'news') {
            safeSetValue('category', item.category);
        } else {
            safeSetValue('animation-type', item.type);
        }
        
        // Set assigned block
        if (window.app?.blockManager) {
            const blocks = window.app.blockManager.getBlocks();
            const assignedBlock = blocks.find(block => 
                block.items.some(blockItem => 
                    blockItem.type === this.type && blockItem.id === item.id
                )
            );
            
            if (assignedBlock) {
                safeSetValue(`${this.prefix}assigned-block`, assignedBlock.id);
            }
            
            // Update selector color
            if (window.app.updateBlockSelectorColor) {
                window.app.updateBlockSelectorColor(this.prefix);
            }
        }
    }

    updateItemFromForm(item) {
        item.title = safeGetValue(`${this.prefix}title`);
        item.content = safeGetValue(`${this.prefix}content`);
        item.duration = validateDuration(safeGetValue(`${this.prefix}duration`));
        item.author = safeGetValue(`${this.prefix}author`);
        item.status = safeGetValue(`${this.prefix}status`);
        item.notes = safeGetValue(`${this.prefix}notes`);
        
        // Update scheduled date
        item.scheduledDate = safeGetValue(`${this.prefix}scheduled-date`);
        
        // Update tags
        item.urgent = safeGetElement(`${this.prefix}tag-urgent`)?.checked || false;
        item.ready = safeGetElement(`${this.prefix}tag-ready`)?.checked || false;
        item.recurring = safeGetElement(`${this.prefix}tag-recurring`)?.checked || false;
        
        if (this.type === 'news') {
            item.category = safeGetValue('category');
        } else {
            item.type = safeGetValue('animation-type');
        }
    }

    // Text formatting
    formatText(command) {
        const textarea = safeGetElement(`${this.prefix}content`);
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        
        const formats = {
            'bold': `**${selectedText}**`,
            'italic': `*${selectedText}*`,
            'underline': `__${selectedText}__`
        };
        
        const formattedText = formats[command] || selectedText;
        textarea.value = textarea.value.substring(0, start) + formattedText + 
                        textarea.value.substring(end);
        textarea.focus();
        textarea.setSelectionRange(start + formattedText.length, 
                                  start + formattedText.length);
        
        this.debouncedCalculateDuration();
    }

    insertBullet() {
        const textarea = safeGetElement(`${this.prefix}content`);
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        textarea.value = textarea.value.substring(0, start) + '\n• ' + 
                        textarea.value.substring(start);
        textarea.focus();
        textarea.setSelectionRange(start + 3, start + 3);
        
        this.debouncedCalculateDuration();
    }

    insertTime() {
        const defaultDuration = this.type === 'news' ? '0:30' : '1:00';
        const duration = prompt('Enter duration (format MM:SS)', defaultDuration);
        if (duration) {
            const validatedDuration = validateDuration(duration);
            safeSetValue(`${this.prefix}duration`, validatedDuration);
            if (validatedDuration !== duration) {
                showNotification(`Duration adjusted to valid format: ${validatedDuration}`, 
                               'warning');
            }
        }
    }
    
    insertLancement() {
        const textarea = safeGetElement(`${this.prefix}content`);
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        
        // Si du texte est sélectionné, on l'encadre directement
        if (selectedText && selectedText.trim()) {
            const newText = `[LANCEMENT]\n${selectedText}\n[/LANCEMENT]`;
            textarea.value = before + newText + after;
            
            // Positionner le curseur après les balises
            textarea.selectionStart = textarea.selectionEnd = start + newText.length;
            
            showNotification('Lancement ajouté au texte sélectionné', 'success');
        } else {
            // Sinon on insère les balises avec un placeholder
            const placeholderText = "Texte du lancement ici...";
            const newText = `[LANCEMENT]\n${placeholderText}\n[/LANCEMENT]`;
            textarea.value = before + newText + after;
            
            // Sélectionner le placeholder pour faciliter le remplacement
            textarea.selectionStart = start + 12; // Après [LANCEMENT]\n
            textarea.selectionEnd = start + 12 + placeholderText.length;
            
            showNotification('Balises de lancement insérées', 'info');
        }
        
        textarea.focus();
        this.debouncedCalculateDuration();
    }
    
    insertDesannonce() {
        const textarea = safeGetElement(`${this.prefix}content`);
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        
        // Si du texte est sélectionné, on l'encadre directement
        if (selectedText && selectedText.trim()) {
            const newText = `[DESANNONCE]\n${selectedText}\n[/DESANNONCE]`;
            textarea.value = before + newText + after;
            
            // Positionner le curseur après les balises
            textarea.selectionStart = textarea.selectionEnd = start + newText.length;
            
            showNotification('Désannonce ajoutée au texte sélectionné', 'success');
        } else {
            // Sinon on insère les balises avec un placeholder
            const placeholderText = "Texte de la désannonce ici...";
            const newText = `[DESANNONCE]\n${placeholderText}\n[/DESANNONCE]`;
            textarea.value = before + newText + after;
            
            // Sélectionner le placeholder pour faciliter le remplacement
            textarea.selectionStart = start + 13; // Après [DESANNONCE]\n
            textarea.selectionEnd = start + 13 + placeholderText.length;
            
            showNotification('Balises de désannonce insérées', 'info');
        }
        
        textarea.focus();
        this.debouncedCalculateDuration();
    }





    // Sound management
    async addSound(soundData) {
        const item = this.getCurrentItem();
        if (!item) return;
        
        if (!item.sounds) item.sounds = [];
        
        // L'audio a déjà été sauvegardé dans AudioManager, utiliser l'ID existant
        const audioFileId = soundData.id || soundData.audioFileId || `audio_${Date.now()}`;
        
        // Ne pas re-sauvegarder si l'audio a déjà été uploadé
        if (soundData.audioFile && !soundData.id) {
            // Cas legacy: si on a un audioFile mais pas d'ID, sauvegarder
            if (window.app?.storage) {
                await window.app.storage.saveAudioFile(audioFileId, soundData.audioFile);
            }
        }
        
        const sound = {
            id: Date.now(),
            name: soundData.name,
            type: soundData.type || 'audio',
            duration: soundData.duration,
            description: soundData.description || '',
            audioFileId: audioFileId,
            fileName: soundData.fileName || soundData.name
        };
        
        item.sounds.push(sound);
        
        // Insert in content
        const textarea = safeGetElement(`${this.prefix}content`);
        if (textarea) {
            textarea.value += `\n[SOUND: ${sound.name} - ${sound.duration}]\n`;
        }
        
        this.calculateDuration();
        await this.save();
        this.renderSounds();
        
        this.emit('sound-added', sound);
        showNotification(`Sound "${sound.name}" added`, 'success');
    }

    async removeSound(soundId) {
        const item = this.getCurrentItem();
        if (!item?.sounds) return;
        
        const sound = item.sounds.find(s => s.id === soundId);
        if (sound?.audioFileId && window.app?.storage) {
            await window.app.storage.deleteAudioFile(sound.audioFileId);
        }
        
        item.sounds = item.sounds.filter(s => s.id !== soundId);
        this.calculateDuration();
        await this.save();
        this.renderSounds();
        
        this.emit('sound-removed', soundId);
        showNotification('Sound removed', 'warning');
    }

    // Duration calculation
    calculateDuration() {
        const content = safeGetValue(`${this.prefix}content`);
        const title = safeGetValue(`${this.prefix}title`);
        const item = this.getCurrentItem();
        
        if (!content && !title) return;
        
        // Use web worker if available
        if (window.durationWorker) {
            window.durationWorker.calculate(content, title, this.type)
                .then(result => this.updateDurationDisplay(result));
        } else {
            // Fallback to synchronous calculation
            const result = this.calculateDurationSync(content, title, item);
            this.updateDurationDisplay(result);
        }
    }

    // Calcule la durée totale d'un item (méthode publique)
    calculateItemDuration(item) {
        if (!item) return item.duration || '0:00';
        
        const result = this.calculateDurationSync(item.content || '', item.title || '', item);
        return formatDurationFromSeconds(result.totalSeconds);
    }
    
    // Calcule la durée pour OnAir (lancement + audio exporté + désannonce)
    calculateOnAirDuration(item) {
        if (!item) return item.duration || '0:00';
        
        // Si pas d'audio exporté, calcul normal
        if (!item.hasAudio || !item.audioData) {
            return this.calculateItemDuration(item);
        }
        
        const content = item.content || '';
        const title = item.title || '';
        
        // Extraire et calculer la durée du lancement
        let lancementSeconds = 0;
        const lancementMatch = content.match(/\[LANCEMENT\]([\s\S]*?)\[\/LANCEMENT\]/i);
        if (lancementMatch) {
            const lancementText = lancementMatch[1].trim();
            const lancementWords = lancementText.split(/\s+/).filter(word => word.length > 0).length;
            const wordsPerMinute = Constants.READING_SPEEDS[this.type];
            lancementSeconds = Math.round((lancementWords / wordsPerMinute) * 60);
        }
        
        // Extraire et calculer la durée de la désannonce
        let desannonceSeconds = 0;
        const desannonceMatch = content.match(/\[DESANNONCE\]([\s\S]*?)\[\/DESANNONCE\]/i);
        if (desannonceMatch) {
            const desannonceText = desannonceMatch[1].trim();
            const desannonceWords = desannonceText.split(/\s+/).filter(word => word.length > 0).length;
            const wordsPerMinute = Constants.READING_SPEEDS[this.type];
            desannonceSeconds = Math.round((desannonceWords / wordsPerMinute) * 60);
        }
        
        // Durée de l'audio exporté
        let audioSeconds = 0;
        if (item.actualDuration) {
            const [min, sec] = item.actualDuration.split(':').map(Number);
            audioSeconds = (min * 60) + (sec || 0);
        }
        
        // Total = lancement + audio + désannonce
        const totalSeconds = lancementSeconds + audioSeconds + desannonceSeconds;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    calculateDurationSync(content, title, item) {
        const fullText = (content || '') + ' ' + (title || '');
        
        // Pour la fiche news : on calcule le corps (sans lancement/désannonce) + sons individuels
        // Si audio exporté, il remplace le corps donc on ne compte que l'audio exporté + sons individuels
        
        let readingSeconds = 0;
        let soundsSeconds = 0;
        let wordCount = 0;
        
        if (item?.hasAudio && item?.actualDuration) {
            // Si audio exporté : on compte uniquement l'audio exporté comme durée principale
            const [min, sec] = item.actualDuration.split(':').map(Number);
            readingSeconds = (min * 60) + (sec || 0);
            wordCount = 0; // Pas de comptage de mots car c'est de l'audio
        } else {
            // Sinon : calcul normal du temps de lecture du corps (sans lancement/désannonce)
            const cleanContent = fullText
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/__(.*?)__/g, '$1')
                .replace(/\[SOUND:.*?\]/g, '')
                .replace(/\[LANCEMENT\][\s\S]*?\[\/LANCEMENT\]/gi, '')
                .replace(/\[DESANNONCE\][\s\S]*?\[\/DESANNONCE\]/gi, '');
            
            const words = cleanContent.trim().split(/\s+/).filter(word => word.length > 0);
            wordCount = words.length;
            const wordsPerMinute = Constants.READING_SPEEDS[this.type];
            readingSeconds = Math.round((wordCount / wordsPerMinute) * 60);
        }
        
        // Ajouter les sons individuels (s'il y en a)
        if (item?.sounds) {
            item.sounds.forEach(sound => {
                const [min, sec] = sound.duration.split(':').map(Number);
                soundsSeconds += (min * 60) + sec;
            });
        }
        
        const totalSeconds = readingSeconds + soundsSeconds;
        
        return {
            wordCount,
            readingSeconds,
            soundsSeconds,
            totalSeconds,
            minutes: Math.floor(totalSeconds / 60),
            seconds: totalSeconds % 60
        };
    }

    updateDurationDisplay(durationData) {
        const wordCountEl = safeGetElement(`${this.prefix}word-count`);
        const totalDurationEl = safeGetElement(`${this.prefix}total-duration-display`);
        
        if (wordCountEl) wordCountEl.textContent = durationData.wordCount;
        if (totalDurationEl) {
            totalDurationEl.textContent = 
                `${durationData.minutes}:${durationData.seconds.toString().padStart(2, '0')}`;
        }
        
        // Toujours mettre à jour les durées affichées
        this.updateDurationBreakdown(durationData);
        
        // Le div duration-breakdown reste caché (pour compatibilité)
        const breakdownEl = safeGetElement(`${this.prefix}duration-breakdown`);
        if (breakdownEl) {
            breakdownEl.style.display = 'none';
        }
    }

    updateDurationBreakdown(durationData) {
        const readingTimeEl = safeGetElement(`${this.prefix}reading-time`);
        const soundsTimeEl = safeGetElement(`${this.prefix}sounds-time`);
        const calculatedDurationEl = safeGetElement(`${this.prefix}calculated-duration`);
        
        if (readingTimeEl) {
            readingTimeEl.textContent = formatDurationFromSeconds(durationData.readingSeconds);
        }
        if (soundsTimeEl) {
            soundsTimeEl.textContent = formatDurationFromSeconds(durationData.soundsSeconds);
        }
        if (calculatedDurationEl) {
            calculatedDurationEl.textContent = formatDurationFromSeconds(durationData.totalSeconds);
        }
    }

    // UI operations
    render() {
        const container = safeGetElement(`${this.type}-list`);
        if (!container) return;
        
        // Use virtual list for performance
        if (this.database.length > 20) {
            if (!this.virtualList) {
                this.virtualList = new ContentVirtualList(
                    container, 
                    this.type, 
                    (id) => this.load(id)
                );
            }
            this.virtualList.setItems(this.database);
        } else {
            // Standard rendering for small lists
            this.renderStandardList(container);
        }
    }

    renderStandardList(container) {
        container.innerHTML = this.database.map(item => {
            const statusIcon = Constants.STATUS_ICONS[item.status] || Constants.STATUS_ICONS.draft;
            
            // Get assigned journals
            let journalInfo = '';
            if (item.assignedBlocks && item.assignedBlocks.length > 0 && window.app?.blockManager) {
                const blocks = window.app.blockManager.getBlocks();
                const assignedBlockNames = item.assignedBlocks
                    .map(blockId => {
                        const block = blocks.find(b => b.id === parseInt(blockId));
                        return block ? block.title : null;
                    })
                    .filter(name => name !== null);
                
                if (assignedBlockNames.length > 0) {
                    journalInfo = `📁 ${assignedBlockNames.join(', ')} • `;
                }
            }
            
            const meta = this.type === 'news' ? 
                `${journalInfo}${item.category} • ${item.duration} • ${sanitizeHTML(item.author)}` :
                `${journalInfo}${item.type} • ${item.duration} • ${sanitizeHTML(item.author)}`;
                
            // Add tag indicators
            const tagIndicators = [];
            if (item.urgent) tagIndicators.push('🚨');
            if (item.recurring) tagIndicators.push('🔄');
            if (item.scheduledDate) {
                const date = new Date(item.scheduledDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (date.toDateString() === today.toDateString()) {
                    tagIndicators.push('📅');
                }
            }
                
            return `
                <div class="${this.type}-item ${item.urgent ? 'urgent' : ''}" data-${this.type}-id="${item.id}" 
                     onclick="app.${this.type}Manager.load(${item.id})">
                    <div class="flex justify-between items-center">
                        <h3>${sanitizeHTML(item.title)} ${tagIndicators.join(' ')}</h3>
                        <span title="${item.status || 'draft'}">${statusIcon}</span>
                    </div>
                    <div class="meta">${meta}</div>
                </div>
            `;
        }).join('');
    }

    renderPackages() {
        // Implementation for packages rendering
        const item = this.getCurrentItem();
        const container = safeGetElement(`${this.prefix}packages-list`);
        if (!container) return;
        
        if (!item?.packages || item.packages.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center;">No packages</p>';
            return;
        }
        
        // Render packages list
    }

    renderSounds() {
        const item = this.getCurrentItem();
        const container = safeGetElement(`${this.prefix}sounds-list`);
        if (!container) return;
        
        let hasContent = false;
        let htmlContent = '';
        
        // Check for exported audio from multitrack
        if (item?.audioData && item?.hasAudio) {
            hasContent = true;
            const actualDuration = item.actualDuration || item.duration || '0:00';
            htmlContent += `
                <div class="sound-item" style="border: 1px solid #00ff9f; background: rgba(0, 255, 159, 0.1);">
                    <div class="sound-info">
                        <span class="sound-type export">🎚️ EXPORT MULTIPISTE</span>
                        <strong>${sanitizeHTML(item.title || 'Mix audio')}</strong>
                        <span style="color: #00B4D8;">• ${actualDuration}</span>
                        <span style="color: #666; font-size: 0.75rem;">• Exporté depuis l'éditeur multipiste</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="icon-btn" onclick="app.${this.type}Manager.playExportedAudio('${item.id}')" title="Play">▶️</button>
                        <button class="icon-btn" onclick="app.${this.type}Manager.downloadExportedAudio('${item.id}')" title="Download">💾</button>
                        <button class="icon-btn" onclick="app.${this.type}Manager.removeExportedAudio('${item.id}')" title="Remove">🗑️</button>
                    </div>
                </div>
            `;
        }
        
        // Check for individual sound elements
        if (item?.sounds && item.sounds.length > 0) {
            hasContent = true;
            htmlContent += item.sounds.map(sound => {
                const icon = Constants.SOUND_ICONS[sound.type] || Constants.SOUND_ICONS.autre;
                return `
                    <div class="sound-item">
                        <div class="sound-info">
                            <span class="sound-type ${sound.type}">${icon} ${sound.type.toUpperCase()}</span>
                            <strong>${sanitizeHTML(sound.name)}</strong>
                            <span style="color: #999;">• ${sound.duration}</span>
                            ${sound.fileName ? `<span style="color: #666; font-size: 0.75rem;">• ${sanitizeHTML(sound.fileName)}</span>` : ''}
                            ${sound.description ? `<p style="font-size: 0.875rem; margin-top: 0.25rem; color: #ccc;">${sanitizeHTML(sound.description)}</p>` : ''}
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            ${sound.audioFileId ? `<button class="icon-btn" onclick="app.audioManager.play('${sound.audioFileId}')" title="Play">▶️</button>` : ''}
                            <button class="icon-btn" onclick="app.${this.type}Manager.removeSound(${sound.id})">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        if (!hasContent) {
            container.innerHTML = '<p style="color: #999; text-align: center;">No sound elements</p>';
        } else {
            container.innerHTML = htmlContent;
        }
    }

    updateActiveState(itemId) {
        document.querySelectorAll(`.${this.type}-item`).forEach(el => {
            el.classList.remove('active');
        });
        const activeItem = document.querySelector(`[data-${this.type}-id="${itemId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    showEditor() {
        const welcomeEl = safeGetElement(`${this.type}-welcome`);
        const editorEl = safeGetElement(`${this.type}-editor`);
        if (welcomeEl) welcomeEl.classList.add('hidden');
        if (editorEl) editorEl.classList.remove('hidden');
    }

    clearEditor() {
        ['title', 'content', 'notes'].forEach(field => {
            safeSetValue(`${this.prefix}${field}`, '');
        });
        
        const welcomeEl = safeGetElement(`${this.type}-welcome`);
        const editorEl = safeGetElement(`${this.type}-editor`);
        if (welcomeEl) welcomeEl.classList.remove('hidden');
        if (editorEl) editorEl.classList.add('hidden');
    }

    updateConductor(item, oldDuration) {
        if (!window.app?.conductorManager) return;
        
        const idField = this.type === 'news' ? 'newsId' : 'animationId';
        const segment = window.app.conductorManager.findSegmentByItemId(this.currentId, idField);
        
        if (segment) {
            // Utiliser la méthode OnAir pour calculer la durée si c'est une news avec audio exporté
            const calculatedDuration = (this.type === 'news' && item.hasAudio) ?
                this.calculateOnAirDuration(item) :
                this.calculateItemDuration(item);
            
            segment.title = item.title;
            segment.duration = item.duration;
            segment.actualDuration = calculatedDuration;
            segment.content = item.content;
            segment.author = item.author;
            
            if (oldDuration !== item.duration || segment.actualDuration !== calculatedDuration) {
                showNotification(`Rundown updated! Planned: ${item.duration}, Actual: ${calculatedDuration}`, 
                               'success');
            }
            
            window.app.conductorManager.render();
        }
    }

    // Search functionality
    search(query) {
        const lowerQuery = query.toLowerCase();
        const filtered = this.database.filter(item => 
            item.title.toLowerCase().includes(lowerQuery) ||
            item.content.toLowerCase().includes(lowerQuery) ||
            item.author.toLowerCase().includes(lowerQuery)
        );
        
        // Render filtered results
        if (this.virtualList) {
            this.virtualList.setItems(filtered);
        } else {
            const container = safeGetElement(`${this.type}-list`);
            if (container) {
                this.renderStandardList(container);
            }
        }
    }

    // ===== LOCK MANAGEMENT METHODS =====
    
    /**
     * DEPRECATED: Le système de lock n'est plus nécessaire avec AWS AppSync
     * Conservé pour référence historique
     */
    /*
    async acquireLock(itemId) {
        if (!window.app?.storage) {
            return { success: true, lockId: null }; // Mode dégradé sans storage
        }
        
        const result = await window.app.storage.lockItem(this.type, itemId);
        if (!result.success && result.lockedBy) {
            // Formatage du nom d'utilisateur
            const lockedBy = result.lockedBy.charAt(0).toUpperCase() + result.lockedBy.slice(1);
            const timeAgo = this.getTimeAgo(result.lockedAt);
            
            return {
                success: false,
                lockedBy: lockedBy,
                timeAgo: timeAgo,
                lockedAt: result.lockedAt
            };
        }
        
        return result;
    }
    
    
    startLockHeartbeat(itemId) {
        // Nettoyer l'ancien interval s'il existe
        this.stopLockHeartbeat();
        
        // Refresh toutes les 2 minutes
        this.lockHeartbeatInterval = setInterval(() => {
            if (window.app?.storage) {
                window.app.storage.refreshLock(this.type, itemId);
                console.log(`💓 Refreshing lock for ${this.type}/${itemId}`);
            }
        }, 2 * 60 * 1000);
    }
    
    stopLockHeartbeat() {
        if (this.lockHeartbeatInterval) {
            clearInterval(this.lockHeartbeatInterval);
            this.lockHeartbeatInterval = null;
        }
    }
    
    async releaseLock() {
        if (this.currentId && window.app?.storage) {
            await window.app.storage.unlockItem(this.type, this.currentId);
            this.stopLockHeartbeat();
            this.currentLockId = null;
            this.removeUnlockButton();
        }
    }
    
    showLockDialog(lockInfo) {
        const itemType = this.type === 'news' ? 'news' : 'animation';
        const message = `🔒 Cette ${itemType} est en cours d'édition par ${lockInfo.lockedBy} (depuis ${lockInfo.timeAgo})`;
        
        showNotification(message, 'warning');
        
        // Optionnel : créer un dialogue plus élaboré
        if (confirm(message + '\n\nVoulez-vous demander à ' + lockInfo.lockedBy + ' de libérer l\'élément ?')) {
            this.requestUnlock(this.currentId, lockInfo.lockedBy);
        }
    }
    
    async requestUnlock(itemId, lockedBy) {
        // Pour l'instant, juste une notification
        showNotification(`📨 Demande envoyée à ${lockedBy}`, 'info');
        // TODO: Implémenter le système de demande via S3
    }
    
    addUnlockButton() {
        // Retirer l'ancien bouton s'il existe
        this.removeUnlockButton();
        
        // Trouver la barre d'outils
        const toolbar = document.querySelector(`.${this.type}-editor-controls`) || 
                       document.querySelector(`.${this.prefix}controls`);
        
        if (toolbar) {
            const unlockBtn = document.createElement('button');
            unlockBtn.id = `${this.prefix}unlock-btn`;
            unlockBtn.className = 'btn btn-warning';
            unlockBtn.innerHTML = '🔓 Libérer';
            unlockBtn.onclick = () => this.releaseLock();
            unlockBtn.style.marginLeft = '10px';
            
            toolbar.appendChild(unlockBtn);
        }
    }
    
    removeUnlockButton() {
        const btn = document.getElementById(`${this.prefix}unlock-btn`);
        if (btn) {
            btn.remove();
        }
    }
    */
    
    /**
     * Calculer le temps écoulé
     */
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'quelques secondes';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} heure${hours > 1 ? 's' : ''}`;
        const days = Math.floor(hours / 24);
        return `${days} jour${days > 1 ? 's' : ''}`;
    }
    
    // Helper methods
    createNewItem() {
        const defaults = Constants.DEFAULTS[this.type];
        
        // Utiliser l'utilisateur authentifié via Cognito comme auteur par défaut
        const authorName = window.authManager?.getAuthorName() || 
                          window.app?.storage?.userId || 
                          localStorage.getItem('saint-esprit-user') || 
                          'Reporter';
        
        // Le nom est déjà formaté par authManager.getAuthorName()
        const formattedUser = authorName;
        
        return {
            id: Date.now(),
            content: '',
            status: 'draft',
            notes: '',
            packages: [],
            sounds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            scheduledDate: null,
            templateId: null,
            lastUsed: null,
            urgent: false,
            ready: false,
            recurring: false,
            ...defaults,
            author: formattedUser // Override l'auteur par défaut avec l'utilisateur actuel
        };
    }
    
    // Get assigned blocks for current item
    getAssignedBlocks() {
        const item = this.getCurrentItem();
        if (!item) return [];
        
        // If item has assignedBlocks array, return it
        if (item.assignedBlocks) {
            return item.assignedBlocks;
        }
        
        // Otherwise check blocks for backward compatibility
        if (window.app?.blockManager) {
            const blocks = window.app.blockManager.getBlocks();
            const assignedBlockIds = [];
            
            blocks.forEach(block => {
                if (block.items && block.items.some(blockItem => 
                    blockItem.type === this.type && blockItem.id === item.id
                )) {
                    assignedBlockIds.push(block.id.toString());
                }
            });
            
            return assignedBlockIds;
        }
        
        return [];
    }
}

// Virtual list implementation
class ContentVirtualList {
    constructor(container, type, onItemClick) {
        this.container = container;
        this.type = type;
        this.onItemClick = onItemClick;
        this.itemHeight = Constants.VIRTUAL_LIST_ITEM_HEIGHT;
        this.items = [];
        this.visibleRange = { start: 0, end: 0 };
        this.scrollTop = 0;
        this.init();
    }

    init() {
        this.viewport = document.createElement('div');
        this.viewport.style.cssText = `
            height: 100%;
            overflow-y: auto;
            position: relative;
        `;
        
        this.content = document.createElement('div');
        this.content.style.position = 'relative';
        
        this.viewport.appendChild(this.content);
        this.container.innerHTML = '';
        this.container.appendChild(this.viewport);
        
        this.viewport.addEventListener('scroll', 
            Utils.throttle(() => this.handleScroll(), 100)
        );
    }

    setItems(items) {
        this.items = items;
        this.content.style.height = `${items.length * this.itemHeight}px`;
        this.render();
    }

    handleScroll() {
        this.scrollTop = this.viewport.scrollTop;
        this.render();
    }

    render() {
        const viewportHeight = this.viewport.clientHeight;
        const start = Math.floor(this.scrollTop / this.itemHeight);
        const end = Math.ceil((this.scrollTop + viewportHeight) / this.itemHeight);
        
        // Buffer for smooth scrolling
        this.visibleRange = {
            start: Math.max(0, start - Constants.VIRTUAL_LIST_BUFFER),
            end: Math.min(this.items.length, end + Constants.VIRTUAL_LIST_BUFFER)
        };
        
        // Clear content
        this.content.innerHTML = '';
        
        // Render only visible items
        for (let i = this.visibleRange.start; i < this.visibleRange.end; i++) {
            const item = this.items[i];
            if (!item) continue;
            
            const element = this.renderItem(item, i);
            element.style.position = 'absolute';
            element.style.top = `${i * this.itemHeight}px`;
            element.style.height = `${this.itemHeight}px`;
            element.style.width = '100%';
            
            this.content.appendChild(element);
        }
    }

    async renderItem(item, index) {
        const div = document.createElement('div');
        div.className = `${this.type}-item`;
        div.dataset[`${this.type}Id`] = item.id;
        
        // Vérifier si l'item est verrouillé
        let lockIndicator = '';
        if (window.app?.storage) {
            const lockInfo = await window.app.storage.getItemLock(this.type, item.id);
            if (lockInfo && lockInfo.lockedBy !== window.app?.storage?.userId) {
                div.classList.add('item-locked');
                const lockedBy = lockInfo.lockedBy.charAt(0).toUpperCase() + lockInfo.lockedBy.slice(1);
                lockIndicator = `<span class="lock-indicator">🔒 ${lockedBy}</span>`;
            }
        }
        
        const statusIcon = Constants.STATUS_ICONS[item.status] || Constants.STATUS_ICONS.draft;
        const meta = this.type === 'news' ? 
            `${item.category} • ${item.duration} • ${sanitizeHTML(item.author)}` :
            `${item.type} • ${item.duration} • ${sanitizeHTML(item.author)}`;
        
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <h3>${sanitizeHTML(item.title)} ${lockIndicator}</h3>
                <span title="${item.status || 'draft'}">${statusIcon}</span>
            </div>
            <div class="meta">${meta}</div>
        `;
        
        div.addEventListener('click', () => this.onItemClick(item.id));
        
        return div;
    }
    
    // Methods for handling exported audio from multitrack
    playExportedAudio(itemId) {
        const item = this.database.find(i => i.id === itemId);
        if (!item?.audioData) {
            showNotification('Aucun audio exporté trouvé', 'warning');
            return;
        }
        
        // Create or get audio player
        if (!this.audioPlayer) {
            this.audioPlayer = new Audio();
        }
        
        // Stop any current playback
        this.audioPlayer.pause();
        
        // Set the audio source and play
        this.audioPlayer.src = item.audioData;
        this.audioPlayer.play().catch(error => {
            console.error('Error playing audio:', error);
            showNotification('Erreur lors de la lecture', 'error');
        });
    }
    
    downloadExportedAudio(itemId) {
        const item = this.database.find(i => i.id === itemId);
        if (!item?.audioData) {
            showNotification('Aucun audio exporté trouvé', 'warning');
            return;
        }
        
        // Create download link
        const a = document.createElement('a');
        a.href = item.audioData;
        a.download = `${item.title || 'export'}_${new Date().toISOString().slice(0, 10)}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showNotification('Téléchargement de l\'audio...', 'success');
    }
    
    removeExportedAudio(itemId) {
        if (!confirm('Supprimer l\'audio exporté ?')) return;
        
        const item = this.database.find(i => i.id === itemId);
        if (item) {
            delete item.audioData;
            delete item.hasAudio;
            delete item.actualDuration;
            
            // Save changes
            this.setDatabase(this.database);
            
            // Re-render sounds list
            this.renderSounds();
            
            showNotification('Audio exporté supprimé', 'warning');
        }
    }
    
    // Handle multiple block assignments
    updateAssignedBlocks(blockIds) {
        const item = this.getCurrentItem();
        if (!item) return;
        
        // Store assigned blocks on the item
        item.assignedBlocks = blockIds || [];
        
        // Update block manager
        if (window.app?.blockManager) {
            const blocks = window.app.blockManager.getBlocks();
            
            // Remove item from all blocks first
            blocks.forEach(block => {
                if (block.items) {
                    block.items = block.items.filter(blockItem => 
                        !(blockItem.type === this.type && blockItem.id === item.id)
                    );
                }
            });
            
            // Add item to selected blocks
            blockIds.forEach(blockId => {
                window.app.blockManager.addItem(parseInt(blockId), this.type, item.id);
            });
            
            // Save block manager state
            window.app.blockManager.saveBlocks();
        }
        
        // Save the item
        this.setDatabase(this.database);
    }
    
    // ========================================
    // EXTENSION POUR MODE BÉNÉVOLE - PHASE 3
    // Gestion des émissions simplifiées
    // ========================================
    
    /**
     * Créer une nouvelle émission (mode bénévole)
     * Réutilise la structure existante avec adaptation
     */
    async createEmission(emissionData) {
        // Vérifier qu'on est en mode bénévole
        if (window.app?.userRole !== 'volunteer') {
            console.warn('createEmission réservé au mode bénévole');
            return null;
        }
        
        // Structure simplifiée pour émission
        const emission = {
            id: Date.now(),
            title: emissionData.title || 'Nouvelle Émission',
            type: 'emission', // Type spécial pour les émissions
            category: emissionData.studio || 'Grand Studio',
            duration: emissionData.duration || '30:00',
            author: window.app?.storage?.userId || 'Bénévole',
            status: 'draft',
            content: emissionData.description || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            
            // Données spécifiques aux émissions
            emissionData: {
                date: emissionData.date || new Date().toISOString().split('T')[0],
                timeSlot: emissionData.timeSlot || '14:00',
                studio: emissionData.studio || 'Grand Studio',
                musics: emissionData.musics || [], // Liste des musiques
                jingles: emissionData.jingles || [], // Jingles sélectionnés
                notes: emissionData.notes || ''
            }
        };
        
        // Ajouter à la base de données locale
        this.database.push(emission);
        await this.setDatabase(this.database);
        
        // Notifier l'interface
        if (window.showNotification) {
            window.showNotification(`Émission "${emission.title}" créée`, 'success');
        }
        
        return emission;
    }
    
    /**
     * Obtenir toutes les émissions
     */
    getEmissions() {
        return this.database.filter(item => item.type === 'emission');
    }
    
    /**
     * Charger une émission pour édition
     */
    loadEmission(emissionId) {
        const emission = this.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        
        if (emission) {
            this.currentId = emission.id;
            this.renderEmissionEditor(emission);
            return emission;
        }
        
        return null;
    }
    
    /**
     * Mettre à jour une émission
     */
    async updateEmission(emissionId, updates) {
        const emission = this.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        
        if (!emission) return null;
        
        // Mettre à jour les données
        Object.assign(emission, updates);
        emission.updatedAt = Date.now();
        
        if (updates.emissionData) {
            emission.emissionData = {
                ...emission.emissionData,
                ...updates.emissionData
            };
        }
        
        // Sauvegarder
        await this.setDatabase(this.database);
        
        if (window.showNotification) {
            window.showNotification('Émission mise à jour', 'success');
        }
        
        return emission;
    }
    
    /**
     * Ajouter une musique à une émission
     */
    async addMusicToEmission(emissionId, musicData) {
        const emission = this.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        
        if (!emission) return false;
        
        if (!emission.emissionData.musics) {
            emission.emissionData.musics = [];
        }
        
        // Ajouter la musique avec timestamp
        emission.emissionData.musics.push({
            ...musicData,
            addedAt: Date.now(),
            order: emission.emissionData.musics.length
        });
        
        // Recalculer la durée totale
        this.updateEmissionDuration(emission);
        
        await this.setDatabase(this.database);
        return true;
    }
    
    /**
     * Supprimer une musique d'une émission
     */
    async removeMusicFromEmission(emissionId, musicIndex) {
        const emission = this.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        
        if (!emission || !emission.emissionData.musics) return false;
        
        emission.emissionData.musics.splice(musicIndex, 1);
        
        // Réorganiser l'ordre
        emission.emissionData.musics.forEach((music, idx) => {
            music.order = idx;
        });
        
        // Recalculer la durée
        this.updateEmissionDuration(emission);
        
        await this.setDatabase(this.database);
        return true;
    }
    
    /**
     * Calculer la durée totale d'une émission
     */
    updateEmissionDuration(emission) {
        if (!emission.emissionData.musics) return;
        
        let totalSeconds = 0;
        
        emission.emissionData.musics.forEach(music => {
            if (music.duration) {
                const [min, sec] = music.duration.split(':').map(Number);
                totalSeconds += (min || 0) * 60 + (sec || 0);
            }
        });
        
        // Ajouter les jingles (environ 30 sec chacun)
        if (emission.emissionData.jingles) {
            totalSeconds += emission.emissionData.jingles.length * 30;
        }
        
        // Convertir en format MM:SS
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        emission.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Rendre l'éditeur d'émission simplifié
     */
    renderEmissionEditor(emission) {
        const editorContainer = document.getElementById(`${this.prefix}editor`);
        if (!editorContainer) return;
        
        // Template simplifié pour l'édition d'émission
        editorContainer.innerHTML = `
            <div class="emission-editor">
                <div class="emission-header">
                    <h2>🎙️ ${emission.title}</h2>
                    <div class="emission-meta">
                        ${emission.emissionData.date} • ${emission.emissionData.timeSlot} • ${emission.emissionData.studio}
                    </div>
                </div>
                
                <div class="emission-content">
                    <div class="emission-description">
                        <h3>Description</h3>
                        <textarea id="emission-description" placeholder="Description de l'émission...">${emission.content || ''}</textarea>
                    </div>
                    
                    <div class="emission-musics">
                        <h3>🎵 Playlist (${emission.emissionData.musics?.length || 0} titres)</h3>
                        <div id="emission-music-list">
                            ${this.renderMusicList(emission.emissionData.musics || [])}
                        </div>
                        <button class="btn btn-primary" onclick="app.contentManager.openMusicSelector(${emission.id})">
                            ➕ Ajouter une musique
                        </button>
                    </div>
                    
                    <div class="emission-notes">
                        <h3>Notes</h3>
                        <textarea id="emission-notes" placeholder="Notes pour l'animateur...">${emission.emissionData.notes || ''}</textarea>
                    </div>
                </div>
                
                <div class="emission-actions">
                    <button class="btn btn-secondary" onclick="app.contentManager.cancelEmissionEdit()">
                        Annuler
                    </button>
                    <button class="btn btn-success" onclick="app.contentManager.saveEmission(${emission.id})">
                        💾 Sauvegarder
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Rendre la liste des musiques
     */
    renderMusicList(musics) {
        if (!musics || musics.length === 0) {
            return '<p class="empty-state">Aucune musique ajoutée</p>';
        }
        
        return musics.map((music, index) => `
            <div class="music-item" data-index="${index}">
                <span class="music-order">${index + 1}</span>
                <span class="music-title">${music.title || 'Sans titre'}</span>
                <span class="music-artist">${music.artist || ''}</span>
                <span class="music-duration">${music.duration || '0:00'}</span>
                <button class="btn-remove" onclick="app.contentManager.removeMusicFromEmission(${this.currentId}, ${index})">
                    ✕
                </button>
            </div>
        `).join('');
    }
    
    /**
     * Exporter une émission pour diffusion
     */
    async exportEmissionForBroadcast(emissionId) {
        const emission = this.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        
        if (!emission) return null;
        
        // Format d'export simplifié pour OnAir
        const exportData = {
            type: 'emission',
            title: emission.title,
            date: emission.emissionData.date,
            timeSlot: emission.emissionData.timeSlot,
            studio: emission.emissionData.studio,
            duration: emission.duration,
            description: emission.content,
            playlist: emission.emissionData.musics || [],
            jingles: emission.emissionData.jingles || [],
            notes: emission.emissionData.notes,
            createdBy: emission.author,
            exportedAt: Date.now()
        };
        
        // Sauvegarder sur S3 dans un dossier spécial
        if (window.app?.storage) {
            const exportKey = `emissions/exports/${emission.emissionData.date}/${emissionId}.json`;
            await window.app.storage.saveToS3(exportKey, exportData);
            
            if (window.showNotification) {
                window.showNotification('Émission exportée pour diffusion', 'success');
            }
        }
        
        return exportData;
    }
}

// Export as global
window.ContentManager = ContentManager;