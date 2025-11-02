// Unified Content Manager for News and Animation
class ContentManager {
    constructor(type) {
        this.type = type; // 'news' or 'animation'
        this.database = [];
        this.currentId = null;
        this.prefix = type === 'animation' ? 'animation-' : 'news-';
        this.listeners = new Map();
        
        // Virtual list for performance
        this.virtualList = null;
        
        // Cache for DOM elements
        this.domCache = new Map();
        
        // Debounced functions
        this.debouncedCalculateDuration = Utils.debounce(
            () => this.calculateDuration(), 
            Constants.DEBOUNCE_DELAY
        );
        
        // Écouter l'événement auth-ready pour mettre à jour l'auteur si besoin
        window.addEventListener('auth-ready', (event) => {
            console.log('[ContentManager] Auth ready event reçu:', event.detail);
            // Si on a un item en cours d'édition avec auteur "Reporter", le mettre à jour
            if (this.currentId) {
                const item = this.getCurrentItem();
                if (item && item.author === 'Reporter' && window.authManager) {
                    const newAuthor = window.authManager.getCurrentUserFullName?.() || 
                                    window.authManager.user?.name ||
                                    window.authManager.user?.email?.split('@')[0] || 
                                    'Reporter';
                    if (newAuthor && newAuthor !== 'Anonyme' && newAuthor !== 'Reporter') {
                        item.author = newAuthor;
                        this.populateForm(item);
                        console.log('[ContentManager] Auteur mis à jour après auth:', newAuthor);
                    }
                }
            }
        });
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
        this.render(); // Rafraîchir l'affichage quand la database change
    }
    
    // Alias pour compatibilité avec onDatabaseUpdate
    refreshList() {
        this.render();
    }

    getDatabase() {
        return this.database;
    }

    getCurrentItem() {
        return this.database.find(item => item.id === this.currentId);
    }

    async create(templateItem = null) {
        // Attendre que l'auth soit prête si on vient de charger la page
        await this.waitForAuth();
        
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
        
        // Re-initialize editor HTML FIRST to create the form fields
        if (window.app) {
            window.app.initializeEditorHTML();
        }
        
        // Show editor to make form visible
        this.showEditor();
        
        // NOW populate the form with the new item data (including author)
        // Use a small delay to ensure DOM is ready
        setTimeout(() => {
            console.log('[ContentManager] AVANT populateForm - newItem.author:', newItem.author);
            console.log('[ContentManager] Champ auteur existe?', !!document.getElementById(`${this.prefix}author`));
            
            this.populateForm(newItem);
            
            const authorField = document.getElementById(`${this.prefix}author`);
            console.log('[ContentManager] APRÈS populateForm - valeur du champ:', authorField?.value);
            console.log('[ContentManager] Form populated with author:', newItem.author);
        }, 50);
        
        // Update UI
        this.updateActiveState(newItem.id);
        this.renderPackages();
        this.renderSounds();
        this.calculateDuration();
        
        // Attacher les event listeners après avoir montré l'éditeur
        this.attachEventListeners();
        
        this.emit('item-loaded', newItem);
        
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

    load(itemId) {
        console.log(`📖 [ContentManager] Loading ${this.type} with ID:`, itemId, typeof itemId);
        // Convertir en string car les IDs dans la database sont des strings
        const itemIdStr = String(itemId);
        // Chercher avec les deux types (string et number)
        const item = this.database.find(i => String(i.id) === itemIdStr);
        if (!item) {
            console.error(`❌ [ContentManager] Item not found in database:`, itemId);
            console.log('Available items:', this.database.map(i => ({ id: i.id, type: typeof i.id })));
            return;
        }

        console.log(`✅ [ContentManager] Found item:`, item.title);
        this.currentId = itemId;
        
        // Update form fields
        console.log('📝 [ContentManager] Populating form...');
        this.populateForm(item);
        
        // Update UI
        console.log('🎨 [ContentManager] Updating UI...');
        this.updateActiveState(itemId);
        this.renderPackages();
        this.renderSounds();
        this.calculateDuration();
        
        // Show editor
        console.log('📺 [ContentManager] Showing editor...');
        this.showEditor();
        
        // Attacher les event listeners APRÈS avoir montré l'éditeur
        this.attachEventListeners();
        
        // Mettre à jour les cases à cocher des blocks après un court délai
        // pour s'assurer que le DOM est prêt
        setTimeout(() => {
            this.updateBlockCheckboxes(item);
        }, 200);
        
        this.emit('item-loaded', item);
        console.log('✅ [ContentManager] Load complete!');
    }

    // Mettre à jour les cases à cocher des blocks
    updateBlockCheckboxes(item) {
        if (!window.app?.blockManager) return;
        
        const blocks = window.app.blockManager.getBlocks();
        const prefix = this.type === 'animation' ? 'animation-' : 'news-';
        
        console.log(`🔲 [ContentManager] Mise à jour des checkboxes pour ${item.title}`);
        
        // D'abord, attendre un peu plus pour être sûr que le DOM est prêt
        const checkboxContainer = document.getElementById(`${prefix}block-selector-list`);
        if (!checkboxContainer) {
            console.warn(`⚠️ Container de checkboxes non trouvé : ${prefix}block-selector-list`);
            // Essayer de régénérer le selector si nécessaire
            this.regenerateBlockSelector();
            return;
        }
        
        // Décocher toutes les checkboxes d'abord
        const allCheckboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]');
        console.log(`📦 Nombre total de checkboxes trouvées : ${allCheckboxes.length}`);
        allCheckboxes.forEach(cb => cb.checked = false);
        
        // Trouver et cocher les blocks où cet item est assigné
        const assignedBlocks = blocks.filter(block => 
            block.items && block.items.some(blockItem => 
                blockItem.type === this.type && (blockItem.id === item.id || blockItem.id === String(item.id))
            )
        );
        
        console.log(`📌 Blocks assignés trouvés : ${assignedBlocks.length}`);
        
        let checkedCount = 0;
        assignedBlocks.forEach(block => {
            const checkbox = document.getElementById(`${prefix}block-${block.id}`);
            if (checkbox) {
                checkbox.checked = true;
                checkedCount++;
                console.log(`✅ Coché : ${window.app.blockManager.generateAutoTitle(block.hitTime, block.scheduledDate)}`);
            } else {
                console.warn(`⚠️ Checkbox non trouvée : ${prefix}block-${block.id}`);
            }
        });
        
        // Mettre à jour le compteur - IMPORTANT : forcer la mise à jour même si 0
        const countElement = document.getElementById(`${prefix}selected-blocks-count`);
        if (countElement) {
            countElement.textContent = String(checkedCount);
            countElement.style.background = checkedCount > 0 ? '#00ff9f' : '#444';
            countElement.style.color = checkedCount > 0 ? '#000' : '#fff';
            console.log(`🔢 Compteur mis à jour : ${checkedCount}`);
        } else {
            console.warn(`⚠️ Élément compteur non trouvé : ${prefix}selected-blocks-count`);
        }
        
        console.log(`📊 Total blocks cochés : ${checkedCount}/${assignedBlocks.length}`);
    }
    
    // Régénérer le sélecteur de blocks si nécessaire
    regenerateBlockSelector() {
        const prefix = this.type === 'animation' ? 'animation-' : 'news-';
        const selectorDropdown = document.getElementById(`${prefix}block-selector-dropdown`);
        
        if (!selectorDropdown || !window.app?.blockManager) {
            console.warn('⚠️ Cannot regenerate block selector - missing dependencies');
            return;
        }
        
        const blocks = window.app.blockManager.getBlocks();
        
        // Vérifier si on a des blocks maintenant
        if (blocks.length > 0) {
            // Créer le HTML pour le selector
            let html = `<div id="${prefix}block-selector-list">`;
            blocks.forEach(block => {
                const autoTitle = window.app.blockManager.generateAutoTitle(block.hitTime, block.scheduledDate);
                html += `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 4px; cursor: pointer;">
                        <input type="checkbox" id="${prefix}block-${block.id}" value="${block.id}" 
                               onchange="app.onBlockCheckboxChange('${prefix}')"
                               style="cursor: pointer;">
                        <span style="width: 12px; height: 12px; background: ${block.color}; border-radius: 2px;"></span>
                        <span style="flex: 1;">${autoTitle}</span>
                    </label>
                `;
            });
            html += '</div>';
            
            // Remplacer le contenu du dropdown
            selectorDropdown.innerHTML = html;
            
            // Rendre le bouton visible si nécessaire
            const selectorButton = document.querySelector(`#${prefix}block-selector button`);
            if (selectorButton) {
                selectorButton.parentElement.style.display = 'inline-block';
            }
            
            console.log(`✅ Block selector regenerated with ${blocks.length} blocks`);
            
            // Réessayer de mettre à jour les checkboxes
            const item = this.getCurrentItem();
            if (item) {
                setTimeout(() => this.updateBlockCheckboxes(item), 100);
            }
        }
    }
    
    // Nouvelle méthode pour attacher les event listeners
    attachEventListeners() {
        // Auto-save sur le titre
        const titleEl = safeGetElement(`${this.prefix}title`);
        if (titleEl) {
            if (!this.boundAutoSaveTitle) {
                this.boundAutoSaveTitle = () => {
                    const item = this.getCurrentItem();
                    if (item) {
                        const oldTitle = item.title;
                        item.title = titleEl.value;
                        console.log('💾 [ContentManager] Auto-save titre:', oldTitle, '->', item.title);
                        // Mettre à jour l'affichage de la liste immédiatement
                        this.render();
                    }
                };
            }
            titleEl.removeEventListener('input', this.boundAutoSaveTitle);
            titleEl.addEventListener('input', this.boundAutoSaveTitle);
        }
        
        // Calcul de durée sur le contenu
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
        
        // Auto-save sur l'auteur
        const authorEl = safeGetElement(`${this.prefix}author`);
        if (authorEl) {
            if (!this.boundAutoSaveAuthor) {
                this.boundAutoSaveAuthor = () => {
                    const item = this.getCurrentItem();
                    if (item) {
                        item.author = authorEl.value;
                        console.log('💾 [ContentManager] Auto-save auteur:', item.author);
                        this.render();
                    }
                };
            }
            authorEl.removeEventListener('input', this.boundAutoSaveAuthor);
            authorEl.addEventListener('input', this.boundAutoSaveAuthor);
        }
    }

    async save() {
        const item = this.getCurrentItem();
        if (!item) return;

        const oldDuration = item.duration;
        
        // Update item from form
        this.updateItemFromForm(item);
        item.updatedAt = new Date().toISOString();
        
        // Handle block assignment avec le nouveau système de checkboxes
        if (window.app?.blockManager) {
            const blocks = window.app.blockManager.getBlocks();
            const prefix = this.type === 'animation' ? 'animation-' : 'news-';
            
            // Obtenir les blocks sélectionnés via les checkboxes
            const selectedCheckboxes = document.querySelectorAll(`#${prefix}block-selector-list input[type="checkbox"]:checked`);
            const selectedBlockIds = Array.from(selectedCheckboxes).map(cb => cb.value); // Ne pas convertir en nombre !
            
            // Trouver tous les blocks où cet item est actuellement assigné
            const currentBlocks = blocks.filter(block => 
                block.items && block.items.some(blockItem => 
                    blockItem.type === this.type && blockItem.id === item.id
                )
            );
            
            // Retirer des blocks non sélectionnés
            currentBlocks.forEach(block => {
                if (!selectedBlockIds.some(id => id === block.id || id === String(block.id))) {
                    window.app.blockManager.removeItem(block.id, this.type, item.id);
                    console.log(`Retiré de ${block.title || 'Journal'}`);
                }
            });
            
            // Ajouter aux nouveaux blocks sélectionnés
            selectedBlockIds.forEach(blockId => {
                const isAlreadyAssigned = currentBlocks.some(block => 
                    block.id === blockId || String(block.id) === blockId
                );
                if (!isAlreadyAssigned) {
                    window.app.blockManager.addItem(blockId, this.type, item.id);
                    const block = blocks.find(b => b.id === blockId || String(b.id) === blockId);
                    console.log(`Ajouté à ${block ? window.app.blockManager.generateAutoTitle(block.hitTime, block.scheduledDate) : 'Journal'}`);
                }
            });
            
            // Mettre à jour les propriétés de l'item pour compatibilité
            if (selectedBlockIds.length > 0) {
                item.blockId = selectedBlockIds[0]; // Premier block sélectionné
                item.assignedBlocks = selectedBlockIds; // Tous les blocks
            } else {
                delete item.blockId;
                delete item.assignedBlocks;
            }
            
            // Forcer la sauvegarde automatique après assignation
            if (window.app?.autoSave) {
                console.log('Déclenchement autoSave après assignation blocks');
                window.app.autoSave();
            }
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
        
        // IMPORTANT: Supprimer vraiment de DynamoDB
        if (window.app?.storage && item) {
            try {
                console.log(`🗑️ Deleting ${this.type} from DynamoDB:`, item.id, item.createdAt);
                const success = await window.app.storage.deleteItem(this.type, item.id, item.createdAt);
                if (!success) {
                    console.error('❌ Failed to delete from DynamoDB');
                    showNotification('Erreur lors de la suppression dans la base de données', 'error');
                }
            } catch (error) {
                console.error('❌ Error deleting from DynamoDB:', error);
                showNotification('Erreur lors de la suppression', 'error');
            }
        }
        
        // Remove from local database
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
        console.log('[ContentManager] populateForm appelé avec item.author:', item.author);
        console.log('[ContentManager] prefix:', this.prefix);
        
        safeSetValue(`${this.prefix}title`, item.title);
        safeSetValue(`${this.prefix}content`, item.content);
        safeSetValue(`${this.prefix}duration`, item.duration);
        
        // Debug spécifique pour l'auteur
        const authorFieldId = `${this.prefix}author`;
        console.log('[ContentManager] Tentative de set author sur:', authorFieldId, 'avec valeur:', item.author);
        const result = safeSetValue(authorFieldId, item.author);
        console.log('[ContentManager] Résultat safeSetValue pour author:', result);
        
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
        
        if (this.type === 'news') {
            safeSetValue('category', item.category);
        } else {
            safeSetValue('animation-type', item.type);
        }
        
        // Set assigned blocks (checkboxes)
        if (window.app?.blockManager) {
            const blocks = window.app.blockManager.getBlocks();
            const prefix = this.type === 'animation' ? 'animation-' : 'news-';
            
            // Vérifier si le sélecteur existe, sinon le régénérer
            const checkboxContainer = document.getElementById(`${prefix}block-selector-list`);
            if (!checkboxContainer && blocks.length > 0) {
                console.log('🔄 Regenerating block selector as it is missing');
                this.regenerateBlockSelector();
                // Attendre un peu que le DOM soit mis à jour
                setTimeout(() => this.populateForm(item), 100);
                return;
            }
            
            // Décocher toutes les checkboxes d'abord
            const allCheckboxes = document.querySelectorAll(`#${prefix}block-selector-list input[type="checkbox"]`);
            allCheckboxes.forEach(cb => cb.checked = false);
            
            // Trouver et cocher les blocks où cet item est assigné
            const assignedBlocks = blocks.filter(block => 
                block.items && block.items.some(blockItem => 
                    blockItem.type === this.type && blockItem.id === item.id
                )
            );
            
            assignedBlocks.forEach(block => {
                const checkbox = document.getElementById(`${prefix}block-${block.id}`);
                if (checkbox) {
                    checkbox.checked = true;
                    console.log(`Coché : ${block.title}`);
                }
            });
            
            // Mettre à jour l'affichage du texte des blocks sélectionnés
            if (window.app.updateSelectedBlocks) {
                window.app.updateSelectedBlocks(prefix);
            }
            
            // Update selector color si nécessaire
            if (window.app.updateBlockSelectorColor) {
                window.app.updateBlockSelectorColor(prefix);
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
        
        // Si on a une scheduledDate, définir expiresAt (même date)
        if (item.scheduledDate) {
            item.expiresAt = item.scheduledDate + 'T23:59:59.999Z';
        } else {
            // Si pas de date, nettoyer les propriétés
            delete item.scheduledDate;
            delete item.expiresAt;
        }
        
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
        console.log('[ContentManager] addSound called with:', soundData);
        console.log('[ContentManager] VERSION: 1756113200 - NOUVELLE VERSION');
        
        const item = this.getCurrentItem();
        if (!item) {
            console.error('[ContentManager] Pas d\'item actuel');
            return;
        }
        
        if (!item.sounds) item.sounds = [];
        
        // L'audio est déjà uploadé dans AudioManager.handleFileUpload
        // soundData contient déjà l'audioFileId et l'URL
        // Pas besoin de re-sauvegarder l'audio
        
        const sound = {
            id: Date.now(),
            name: soundData.name,
            type: soundData.type,
            duration: soundData.duration,
            description: soundData.description,
            audioFileId: soundData.id || soundData.audioFileId,
            url: soundData.url,
            fileName: soundData.fileName
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
    
    // Jouer un son avec une URL directe (pour les Flash Info)
    playDirectUrl(url) {
        try {
            // Arrêter tout audio en cours
            if (window.currentPlayingAudio) {
                window.currentPlayingAudio.pause();
                window.currentPlayingAudio = null;
            }
            
            // Créer et jouer le nouvel audio
            const audio = new Audio(url);
            audio.play().then(() => {
                console.log(`[ContentManager] Playing direct URL: ${url}`);
                window.currentPlayingAudio = audio;
                
                // Arrêter l'audio quand il se termine
                audio.addEventListener('ended', () => {
                    window.currentPlayingAudio = null;
                });
            }).catch(error => {
                console.error('[ContentManager] Error playing audio:', error);
                showNotification('Erreur de lecture audio', 'error');
            });
        } catch (error) {
            console.error('[ContentManager] Error creating audio:', error);
            showNotification('Erreur de lecture audio', 'error');
        }
    }

    // Duration calculation
    calculateDuration() {
        console.log('⏱️ [ContentManager] calculateDuration appelé');
        console.log('⏱️ [ContentManager] Préfixe:', this.prefix);
        
        const content = safeGetValue(`${this.prefix}content`);
        const title = safeGetValue(`${this.prefix}title`);
        const item = this.getCurrentItem();
        
        console.log('⏱️ [ContentManager] Content trouvé:', !!content, 'longueur:', content?.length);
        console.log('⏱️ [ContentManager] Title trouvé:', !!title);
        
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
        console.log('📊 [ContentManager] updateDurationDisplay appelé avec:', durationData);
        console.log('📊 [ContentManager] Préfixe utilisé:', this.prefix);
        
        const wordCountEl = safeGetElement(`${this.prefix}word-count`);
        const readingTimeEl = safeGetElement(`${this.prefix}reading-time`);
        const soundsTimeEl = safeGetElement(`${this.prefix}sounds-time`);
        const calculatedDurationEl = safeGetElement(`${this.prefix}calculated-duration`);
        const totalDurationEl = safeGetElement(`${this.prefix}total-duration-display`);
        
        console.log('📊 [ContentManager] Éléments trouvés:');
        console.log('  - word-count:', !!wordCountEl);
        console.log('  - reading-time:', !!readingTimeEl);
        console.log('  - sounds-time:', !!soundsTimeEl);
        console.log('  - calculated-duration:', !!calculatedDurationEl);
        
        // Update word count
        if (wordCountEl) wordCountEl.textContent = durationData.wordCount;
        
        // Update reading time
        if (readingTimeEl) {
            readingTimeEl.textContent = formatDurationFromSeconds(durationData.readingSeconds);
        }
        
        // Update sounds time
        if (soundsTimeEl) {
            soundsTimeEl.textContent = formatDurationFromSeconds(durationData.soundsSeconds);
        }
        
        // Update calculated total duration
        if (calculatedDurationEl) {
            calculatedDurationEl.textContent = formatDurationFromSeconds(durationData.totalSeconds);
        }
        
        // Also update the hidden total-duration-display for compatibility
        if (totalDurationEl) {
            totalDurationEl.textContent = 
                `${durationData.minutes}:${durationData.seconds.toString().padStart(2, '0')}`;
        }
        
        // Update breakdown if sounds exist
        const breakdownEl = safeGetElement(`${this.prefix}duration-breakdown`);
        if (breakdownEl && durationData.soundsSeconds > 0) {
            breakdownEl.style.display = 'block';
            this.updateDurationBreakdown(durationData);
        } else if (breakdownEl) {
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
        
        // Utiliser filteredDatabase si une recherche est active
        const itemsToRender = this.filteredDatabase || this.database;
        
        // Use virtual list for performance
        if (itemsToRender.length > 20) {
            if (!this.virtualList) {
                this.virtualList = new ContentVirtualList(
                    container, 
                    this.type, 
                    (id) => this.load(id)
                );
            }
            this.virtualList.setItems(itemsToRender);
        } else {
            // Standard rendering for small lists
            this.renderStandardList(container, itemsToRender);
        }
    }

    renderStandardList(container, items = null) {
        const itemsToRender = items || this.database;
        container.innerHTML = itemsToRender.map(item => {
            const statusIcon = Constants.STATUS_ICONS[item.status] || Constants.STATUS_ICONS.draft;
            const meta = this.type === 'news' ? 
                `${item.category} • ${item.duration} • ${sanitizeHTML(item.author)}` :
                `${item.type} • ${item.duration} • ${sanitizeHTML(item.author)}`;
                
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
                     onclick="if(window.app && window.app.${this.type}Manager) window.app.${this.type}Manager.load(${item.id}); else console.error('Manager not ready');"
                     style="cursor: pointer;">
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
                <div class="sound-item" style="border: 1px solid #00B4D8; background: rgba(0, 180, 216, 0.1);">
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
                            ${sound.audioFileId ? 
                                `<button class="icon-btn" onclick="app.audioManager.play('${sound.audioFileId}')" title="Play">▶️</button>` : 
                                (sound.url ? 
                                    `<button class="icon-btn" onclick="app.${this.type}Manager.playDirectUrl('${sound.url}')" title="Play">▶️</button>` : 
                                    ''
                                )
                            }
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
        
        console.log(`🔍 [showEditor] Looking for elements:`, {
            welcomeId: `${this.type}-welcome`,
            editorId: `${this.type}-editor`,
            welcomeFound: !!welcomeEl,
            editorFound: !!editorEl
        });
        
        if (welcomeEl) {
            welcomeEl.classList.add('hidden');
            console.log('✅ Hidden welcome screen');
        } else {
            console.warn(`⚠️ Welcome element not found: ${this.type}-welcome`);
        }
        
        if (editorEl) {
            editorEl.classList.remove('hidden');
            console.log('✅ Shown editor');
        } else {
            console.error(`❌ Editor element not found: ${this.type}-editor`);
        }
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
        // Si pas de query, afficher tout
        if (!query || query.trim() === '') {
            this.filteredDatabase = null;
            this.render();
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        this.filteredDatabase = this.database.filter(item => 
            item.title.toLowerCase().includes(lowerQuery) ||
            (item.content && item.content.toLowerCase().includes(lowerQuery)) ||
            (item.author && item.author.toLowerCase().includes(lowerQuery))
        );
        
        // Render filtered results
        if (this.virtualList) {
            this.virtualList.setItems(this.filteredDatabase);
        } else {
            const container = safeGetElement(`${this.type}-list`);
            if (container) {
                container.innerHTML = this.filteredDatabase.map(item => {
                    const statusIcon = Constants.STATUS_ICONS[item.status] || Constants.STATUS_ICONS.draft;
                    const meta = this.type === 'news' ? 
                        `${item.category} • ${item.duration} • ${sanitizeHTML(item.author)}` :
                        `${item.type} • ${item.duration} • ${sanitizeHTML(item.author)}`;
                        
                    return `
                        <div class="${this.type}-item" data-${this.type}-id="${item.id}" 
                             onclick="if(window.app && window.app.${this.type}Manager) window.app.${this.type}Manager.load(${item.id}); else console.error('Manager not ready');"
                             style="cursor: pointer;">
                            <div class="flex justify-between items-center">
                                <h3>${sanitizeHTML(item.title)}</h3>
                                <span title="${item.status || 'draft'}">${statusIcon}</span>
                            </div>
                            <div class="meta">${meta}</div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    // Helper methods
    async waitForAuth(maxRetries = 5, delay = 500) {
        for (let i = 0; i < maxRetries; i++) {
            // Vérifier si authManager existe et a un utilisateur
            if (window.authManager && window.authManager.getCurrentUser()) {
                console.log('[ContentManager] AuthManager prêt après', i, 'tentatives');
                return true;
            }
            
            // Vérifier aussi localStorage au cas où
            const userData = localStorage.getItem('saint-esprit-user-data');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    if (user.fullName || user.name) {
                        console.log('[ContentManager] User data trouvé dans localStorage après', i, 'tentatives');
                        return true;
                    }
                } catch (e) {}
            }
            
            // Attendre avant de réessayer
            if (i < maxRetries - 1) {
                console.log('[ContentManager] Attente auth, tentative', i + 1, '/', maxRetries);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        console.warn('[ContentManager] Timeout attente auth après', maxRetries, 'tentatives');
        return false;
    }
    
    createNewItem() {
        const defaults = Constants.DEFAULTS[this.type];
        
        // Récupérer automatiquement le nom de l'utilisateur connecté
        let authorName = 'Reporter';
        
        // Méthode 1: Essayer authManager avec getCurrentUserFullName ou user.name
        if (window.authManager) {
            const authName = window.authManager.getCurrentUserFullName?.() || 
                           window.authManager.user?.name ||
                           window.authManager.user?.email?.split('@')[0] || 
                           'Reporter';
            if (authName && authName !== 'Anonyme') {
                authorName = authName;
                console.log('[ContentManager] Auteur via authManager:', authorName);
            }
        }
        
        // Méthode 2: Si toujours Reporter, essayer localStorage directement
        if (authorName === 'Reporter') {
            const userData = localStorage.getItem('saint-esprit-user-data');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    if (user.fullName || user.name) {
                        authorName = user.fullName || user.name;
                        console.log('[ContentManager] Auteur via localStorage user-data:', authorName);
                    }
                } catch (e) {
                    console.error('[ContentManager] Erreur parsing user-data:', e);
                }
            }
        }
        
        // Méthode 3: Fallback sur saint-esprit-user simple
        if (authorName === 'Reporter') {
            const simpleName = localStorage.getItem('saint-esprit-user');
            if (simpleName && simpleName !== 'Anonyme') {
                authorName = simpleName;
                console.log('[ContentManager] Auteur via localStorage saint-esprit-user:', authorName);
            }
        }
        
        console.log('[ContentManager] Auteur final:', authorName);
        
        return {
            ...defaults,  // Appliquer les defaults EN PREMIER
            id: Date.now(),
            content: '',
            author: authorName,  // Puis écraser avec notre auteur
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
            recurring: false
        };
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

    renderItem(item, index) {
        const div = document.createElement('div');
        div.className = `${this.type}-item`;
        div.dataset[`${this.type}Id`] = item.id;
        
        const statusIcon = Constants.STATUS_ICONS[item.status] || Constants.STATUS_ICONS.draft;
        const meta = this.type === 'news' ? 
            `${item.category} • ${item.duration} • ${sanitizeHTML(item.author)}` :
            `${item.type} • ${item.duration} • ${sanitizeHTML(item.author)}`;
        
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <h3>${sanitizeHTML(item.title)}</h3>
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
}

// Export as global
window.ContentManager = ContentManager;