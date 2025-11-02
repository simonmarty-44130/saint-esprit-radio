// Block Manager - gère les blocs de contenu
class BlockManager {
    constructor() {
        this.blocks = [];
        this.currentBlockId = null;
        this.listeners = new Map();
        
        // Cache for block calculations
        this.durationCache = new Map();
        
        // OPTIMISATION: Cache TTL pour les blocks
        this.blockCache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.cacheStats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
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

    // Block operations
    setBlocks(blocks) {
        // Migrer les anciens blocks pour utiliser les titres automatiques
        this.blocks = blocks.map(block => {
            // S'assurer que items est un tableau
            if (!block.items) {
                block.items = [];
            }
            
            // Si le block a une heure et une date, générer le titre automatique
            if (block.hitTime || block.scheduledDate) {
                block.title = this.generateAutoTitle(block.hitTime, block.scheduledDate);
            } else if (!block.title || block.title === 'Nouveau Journal') {
                // Si pas de titre ou ancien titre par défaut, mettre "Journal"
                block.title = 'Journal';
            }
            
            // Logger pour debug
            if (block.items.length > 0) {
                console.log(`Block "${block.title}" a ${block.items.length} items`);
                console.log('  Détail des items:', block.items.map(item => ({
                    type: item.type,
                    id: item.id,
                    order: item.order
                })));
                
                // Détecter les doublons
                const uniqueItems = [];
                const duplicates = [];
                block.items.forEach(item => {
                    const key = `${item.type}-${item.id}`;
                    if (uniqueItems.some(u => `${u.type}-${u.id}` === key)) {
                        duplicates.push(item);
                        console.warn(`  ⚠️ DOUBLON DÉTECTÉ: ${item.type} ${item.id}`);
                    } else {
                        uniqueItems.push(item);
                    }
                });
                
                // Si doublons, les supprimer
                if (duplicates.length > 0) {
                    console.log(`  🧹 Suppression de ${duplicates.length} doublons`);
                    block.items = uniqueItems;
                }
            }
            
            return block;
        });
        this.emit('blocks-changed', this.blocks);
    }

    getBlocks() {
        return this.blocks;
    }

    getBlock(blockId) {
        // OPTIMISATION: Vérifier le cache en premier
        const cached = this.getCachedBlock(blockId);
        if (cached) {
            this.cacheStats.hits++;
            return cached;
        }
        
        this.cacheStats.misses++;
        const block = this.blocks.find(b => b.id === blockId);
        
        if (block) {
            this.setCachedBlock(blockId, block);
        }
        
        return block;
    }
    
    /**
     * Récupérer un block depuis le cache avec TTL
     */
    getCachedBlock(blockId) {
        const cached = this.blockCache.get(blockId);
        if (!cached) return null;
        
        // Vérifier le TTL
        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.blockCache.delete(blockId);
            this.cacheStats.evictions++;
            console.log(`🗑️ Cache evicted for block ${blockId} (TTL expired)`);
            return null;
        }
        
        return cached.data;
    }
    
    /**
     * Mettre un block en cache
     */
    setCachedBlock(blockId, data) {
        this.blockCache.set(blockId, {
            data: { ...data }, // Copie pour éviter les mutations
            timestamp: Date.now()
        });
    }
    
    /**
     * Invalider le cache pour un block spécifique
     */
    invalidateCache(blockId = null) {
        if (blockId) {
            this.blockCache.delete(blockId);
            console.log(`🔄 Cache invalidated for block ${blockId}`);
        } else {
            this.blockCache.clear();
            console.log('🔄 All block cache cleared');
        }
    }
    
    /**
     * Obtenir les statistiques du cache
     */
    getCacheStats() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0;
        
        return {
            ...this.cacheStats,
            hitRate: `${hitRate}%`,
            cacheSize: this.blockCache.size
        };
    }
    
    getBlockById(blockId) {
        return this.blocks.find(b => b.id === parseInt(blockId));
    }

    create() {
        const today = new Date().toISOString().split('T')[0];
        const newBlock = {
            id: Date.now(),
            title: 'Journal', // Titre temporaire, sera mis à jour automatiquement
            author: '',
            plannedDuration: '5:00',
            hitTime: '',
            color: '#00B4D8',
            description: '',
            items: [],
            collapsed: false,
            scheduledDate: today,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.blocks.push(newBlock);
        this.currentBlockId = newBlock.id;
        
        this.emit('block-created', newBlock);
        this.emit('blocks-changed', this.blocks);
        this.render();
        this.load(newBlock.id);
        
        return newBlock;
    }
    
    // Génère automatiquement le titre du journal
    generateAutoTitle(hitTime, scheduledDate) {
        if (!hitTime || !scheduledDate) {
            return 'Journal';
        }
        
        // Formater la date en français
        const date = new Date(scheduledDate + 'T00:00:00');
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const formattedDate = date.toLocaleDateString('fr-FR', options);
        
        return `Journal de ${hitTime} du ${formattedDate}`;
    }
    
    // Met à jour le titre automatiquement
    updateAutoTitle() {
        const block = this.getBlock(this.currentBlockId);
        if (!block) return;
        
        const hitTime = safeGetValue('block-hit-time');
        const scheduledDate = safeGetValue('block-scheduled-date');
        
        const autoTitle = this.generateAutoTitle(hitTime, scheduledDate);
        
        // Mettre à jour l'affichage
        const titleInput = safeGetElement('block-title');
        if (titleInput) {
            titleInput.value = autoTitle;
        }
        
        // Sauvegarder dans le block
        block.title = autoTitle;
        block.hitTime = hitTime;
        block.scheduledDate = scheduledDate;
        
        // Mettre à jour la liste
        this.render();
        
        // Vérifier si duplication nécessaire pour news multi-journaux
        this.checkNewsMultiJournalDuplication();
    }
    
    // Vérifie et duplique les news assignées à plusieurs journaux
    checkNewsMultiJournalDuplication() {
        // Désactivé - on permet maintenant les news dans plusieurs journaux
        // et on propose la création de variantes manuellement
        return;
    }
    
    // Duplique une news pour différentes heures
    duplicateNewsForDifferentTimes(originalNews, times) {
        if (!window.app?.newsManager) return;
        
        // Pour chaque heure sauf la première (qui garde l'original)
        times.slice(1).forEach(time => {
            // Vérifier si une variante existe déjà
            const variantExists = window.app.newsManager.getDatabase().some(news => 
                news.originalId === originalNews.id && news.variantTime === time
            );
            
            if (!variantExists) {
                // Créer une copie de la news
                const newsVariant = {
                    ...originalNews,
                    id: Date.now() + Math.random(),
                    title: `${originalNews.title} (${time})`,
                    originalId: originalNews.id,
                    variantTime: time,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Ajouter la variante à la base de données
                window.app.newsManager.getDatabase().push(newsVariant);
                
                // Notification
                showNotification(`News dupliquée pour ${time}`, 'info');
            }
        });
        
        // Rafraîchir l'affichage
        window.app.newsManager.render();
    }

    load(blockId) {
        const block = this.blocks.find(b => b.id === blockId || b.id === String(blockId) || String(b.id) === String(blockId));
        if (!block) return;

        this.currentBlockId = blockId;
        
        // Update form fields
        this.populateForm(block);
        
        // Update UI
        this.updateActiveState(blockId);
        this.renderBlockItems();
        this.calculateBlockDuration();
        
        // Show editor
        this.showEditor();
        
        // Ré-attacher les event listeners pour la mise à jour automatique du titre
        this.attachTitleListeners();
        
        this.emit('block-loaded', block);
    }
    
    // Attache les event listeners pour la mise à jour automatique du titre
    attachTitleListeners() {
        const hitTimeInput = safeGetElement('block-hit-time');
        const scheduledDateInput = safeGetElement('block-scheduled-date');
        
        if (hitTimeInput && !hitTimeInput.hasAttribute('data-listener-attached')) {
            hitTimeInput.setAttribute('data-listener-attached', 'true');
            hitTimeInput.addEventListener('input', () => {
                this.updateAutoTitle();
            });
        }
        
        if (scheduledDateInput && !scheduledDateInput.hasAttribute('data-listener-attached')) {
            scheduledDateInput.setAttribute('data-listener-attached', 'true');
            scheduledDateInput.addEventListener('input', () => {
                this.updateAutoTitle();
            });
        }
    }

    save() {
        const block = this.getBlock(this.currentBlockId);
        if (!block) return;
        
        // Invalider le cache pour ce block car il va être modifié
        this.invalidateCache(this.currentBlockId);

        // Update block from form
        const hitTime = safeGetValue('block-hit-time');
        const scheduledDate = safeGetValue('block-scheduled-date');
        
        // Générer le titre automatiquement
        block.title = this.generateAutoTitle(hitTime, scheduledDate);
        block.author = safeGetValue('block-author') || '';
        block.plannedDuration = validateDuration(safeGetValue('block-planned-duration'));
        block.hitTime = hitTime;
        block.color = safeGetValue('block-color');
        block.description = safeGetValue('block-description');
        
        // S'assurer que scheduledDate est toujours dans le bon format
        if (scheduledDate) {
            block.scheduledDate = scheduledDate;
        } else if (!block.scheduledDate) {
            // Si pas de date, mettre la date du jour par défaut
            block.scheduledDate = new Date().toISOString().split('T')[0];
        }
        block.updatedAt = new Date().toISOString();
        
        // Update conductor if block exists there
        if (window.app?.conductorManager) {
            const segment = window.app.conductorManager.findSegmentByBlockId(block.id);
            if (segment) {
                segment.title = block.title;
                segment.duration = block.plannedDuration;
                segment.blockColor = block.color;
                window.app.conductorManager.render();
            }
        }
        
        // Update the list
        this.render();
        
        // Make sure editor stays visible
        this.showEditor();
        
        // Update active state in the list
        this.updateActiveState(this.currentBlockId);
        
        // Reload the form with updated values to keep the display
        this.populateForm(block);
        
        // Re-render block items to ensure they are displayed
        this.renderBlockItems();
        
        // Recalculate duration to update all displays
        this.calculateBlockDuration();
        
        this.emit('block-saved', block);
        this.emit('blocks-changed', this.blocks);
        showNotification('Journal enregistré !', 'success');
    }

    delete() {
        if (!this.currentBlockId || !confirm('Supprimer ce journal ?')) return;

        const block = this.getBlock(this.currentBlockId);
        
        // Remove from blocks
        this.blocks = this.blocks.filter(b => b.id !== this.currentBlockId);
        
        // Remove from conductor
        if (window.app?.conductorManager) {
            window.app.conductorManager.removeSegmentByBlockId(this.currentBlockId);
        }
        
        // Update UI
        this.currentBlockId = null;
        this.clearEditor();
        this.render();
        
        this.emit('block-deleted', block);
        this.emit('blocks-changed', this.blocks);
        showNotification('Journal supprimé', 'warning');
    }

    // Add item to block
    addItem(blockId, itemType, itemId) {
        const block = this.getBlock(blockId);
        if (!block) return;
        
        // Invalider le cache car on va modifier le block
        this.invalidateCache(blockId);

        // Convertir l'itemId en string pour cohérence
        const itemIdStr = String(itemId);
        
        console.log(`🔧 addItem appelé: blockId=${blockId}, type=${itemType}, itemId=${itemIdStr}`);
        console.log(`  Items actuels dans le block:`, block.items);

        // Vérifier si l'item est déjà dans ce block
        const alreadyInBlock = block.items.some(item => 
            item.type === itemType && String(item.id) === itemIdStr
        );
        
        if (alreadyInBlock) {
            console.log(`  ⚠️ Item déjà présent dans le block, ignoré`);
            showNotification('Cet élément est déjà dans ce journal', 'warning');
            return;
        }

        // Vérifier si l'item est déjà dans un autre block
        const otherBlocks = this.blocks.filter(b => b.id !== blockId);
        const usedInBlocks = otherBlocks.filter(b => 
            b.items.some(item => item.type === itemType && String(item.id) === itemIdStr)
        );

        // Si utilisé ailleurs, proposer de créer une variante
        if (usedInBlocks.length > 0 && itemType === 'news') {
            const blockNames = usedInBlocks.map(b => this.generateAutoTitle(b.hitTime, b.scheduledDate)).join(', ');
            
            if (confirm(`Cette news est déjà utilisée dans : ${blockNames}\n\nVoulez-vous créer une variante pour ce journal ?\n\nOK = Créer une variante\nAnnuler = Utiliser la même news`)) {
                // Créer une variante
                this.createNewsVariant(itemIdStr, blockId);
                return;
            }
        }

        // Add to block (permet maintenant la même news dans plusieurs journaux)
        block.items.push({
            type: itemType,
            id: itemIdStr,
            order: block.items.length
        });
        
        console.log(`  ✅ Item ajouté avec succès, nouveaux items:`, block.items);
        
        // Update the item's assignedBlocks array
        if (itemType === 'news' && window.app?.newsManager) {
            const news = window.app.newsManager.database.find(n => n.id === itemId);
            if (news) {
                if (!news.assignedBlocks) {
                    news.assignedBlocks = [];
                }
                if (!news.assignedBlocks.includes(String(blockId))) {
                    news.assignedBlocks.push(String(blockId));
                }
                window.app.newsManager.setDatabase(window.app.newsManager.database);
            }
        } else if (itemType === 'animation' && window.app?.animationManager) {
            const animation = window.app.animationManager.database.find(a => a.id === itemId);
            if (animation) {
                if (!animation.assignedBlocks) {
                    animation.assignedBlocks = [];
                }
                if (!animation.assignedBlocks.includes(String(blockId))) {
                    animation.assignedBlocks.push(String(blockId));
                }
                window.app.animationManager.setDatabase(window.app.animationManager.database);
            }
        }

        block.updatedAt = new Date().toISOString();
        
        // Recalculate duration
        this.calculateBlockDuration();
        
        // Update UI
        if (blockId === this.currentBlockId) {
            // Preserve form values before updating
            const currentTitle = safeGetValue('block-title');
            const currentDescription = safeGetValue('block-description');
            this.renderBlockItems();
            // Restore form values if they were cleared
            if (currentTitle) {
                safeSetValue('block-title', currentTitle || block.title);
            }
            if (currentDescription !== undefined) {
                safeSetValue('block-description', currentDescription || block.description || '');
            }
        }
        
        // Save and show notification
        this.save();
        showNotification(`✅ ${itemType === 'news' ? 'News' : 'Animation'} ajoutée au journal`, 'success');
        
        // Refresh modal content if open
        const modal = safeGetElement('block-assign-modal');
        if (modal && modal.classList.contains('active')) {
            this.updateAssignModalContent();
        }
        
        // Update conductor if block is there
        if (window.app?.conductorManager) {
            const segment = window.app.conductorManager.findSegmentByBlockId(blockId);
            if (segment) {
                window.app.conductorManager.render();
            }
        }
        
        // Mettre à jour le conducteur si le block y est présent
        this.updateConductorBlock(blockId);
        
        this.emit('block-items-changed', block);
        this.emit('blocks-changed', this.blocks);
        showNotification(`${itemType === 'news' ? 'News' : 'Animation'} ajoutée au journal`, 'success');
    }

    // Nouvelle méthode pour mettre à jour le conducteur
    updateConductorBlock(blockId) {
        if (!window.app?.conductorManager) return;
        
        const blockSegment = window.app.conductorManager.segments.find(s => s.blockId === blockId);
        if (!blockSegment) return;
        
        const block = this.getBlock(blockId);
        if (!block) return;
        
        // Supprimer les anciens enfants
        window.app.conductorManager.segments = window.app.conductorManager.segments.filter(
            s => s.parentId !== blockSegment.id
        );
        
        // Ajouter les nouveaux enfants
        block.items.forEach(item => {
            if (item.type === 'news') {
                const news = window.app.newsManager.getDatabase().find(n => n.id === item.id);
                if (news) {
                    const calculatedDuration = window.app.newsManager.calculateItemDuration(news);
                    window.app.conductorManager.addSegment({
                        type: 'news',
                        newsId: news.id,
                        title: news.title,
                        duration: news.duration,
                        actualDuration: calculatedDuration,
                        content: news.content,
                        author: news.author
                    }, blockSegment.id);
                }
            } else if (item.type === 'animation') {
                const animation = window.app.animationManager.getDatabase().find(a => a.id === item.id);
                if (animation) {
                    const calculatedDuration = window.app.animationManager.calculateItemDuration(animation);
                    window.app.conductorManager.addSegment({
                        type: 'animation',
                        animationId: animation.id,
                        title: animation.title,
                        duration: animation.duration,
                        actualDuration: calculatedDuration,
                        content: animation.content,
                        author: animation.author
                    }, blockSegment.id);
                }
            }
        });
    }

    removeItem(blockId, itemType, itemId) {
        const block = this.getBlock(blockId);
        if (!block) return;
        
        // Invalider le cache car on va modifier le block
        this.invalidateCache(blockId);

        block.items = block.items.filter(item => 
            !(item.type === itemType && item.id === itemId)
        );

        // Update assignedBlocks array
        if (itemType === 'news' && window.app?.newsManager) {
            const news = window.app.newsManager.database.find(n => n.id === itemId);
            if (news && news.assignedBlocks) {
                news.assignedBlocks = news.assignedBlocks.filter(id => id !== String(blockId));
                // Si plus aucun block assigné, nettoyer les propriétés
                if (news.assignedBlocks.length === 0) {
                    delete news.assignedBlocks;
                    delete news.blockId;
                }
                window.app.newsManager.setDatabase(window.app.newsManager.database);
            }
        } else if (itemType === 'animation' && window.app?.animationManager) {
            const animation = window.app.animationManager.database.find(a => a.id === itemId);
            if (animation && animation.assignedBlocks) {
                animation.assignedBlocks = animation.assignedBlocks.filter(id => id !== String(blockId));
                // Si plus aucun block assigné, nettoyer les propriétés
                if (animation.assignedBlocks.length === 0) {
                    delete animation.assignedBlocks;
                    delete animation.blockId;
                }
                window.app.animationManager.setDatabase(window.app.animationManager.database);
            }
        }

        // Reorder
        block.items.forEach((item, index) => {
            item.order = index;
        });

        block.updatedAt = new Date().toISOString();
        
        // Recalculate duration
        this.calculateBlockDuration();
        
        // Update UI
        if (blockId === this.currentBlockId) {
            this.renderBlockItems();
        }
        
        // Mettre à jour le conducteur
        this.updateConductorBlock(blockId);
        
        this.emit('block-items-changed', block);
        this.emit('blocks-changed', this.blocks);
    }

    // UI operations
    render() {
        const container = safeGetElement('blocks-list');
        if (!container) return;

        if (this.blocks.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No blocks created yet</p>';
            return;
        }

        container.innerHTML = this.blocks.map(block => {
            const actualDuration = this.calculateBlockDurationSync(block);
            const itemCount = block.items.length;
            // Générer le titre automatique pour l'affichage
            const displayTitle = this.generateAutoTitle(block.hitTime, block.scheduledDate);
            
            return `
                <div class="block-item ${block.id === this.currentBlockId ? 'active' : ''}" 
                     data-block-id="${block.id}" 
                     onclick="app.blockManager.load('${block.id}')"
                     style="border-left-color: ${block.color};">
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="width: 16px; height: 16px; background-color: ${block.color}; 
                                             border-radius: 3px; display: inline-block;"></span>
                                ${sanitizeHTML(displayTitle)}
                            </h3>
                            <div class="meta">
                                ${block.author ? `<strong>${sanitizeHTML(block.author)}</strong> • ` : ''}
                                Prévu : ${block.plannedDuration} • Réel : ${actualDuration} • 
                                ${itemCount} élément${itemCount !== 1 ? 's' : ''}
                                ${block.hitTime ? ` • Diffusion : ${block.hitTime}` : ''}
                                ${block.scheduledDate ? ` • Date : ${new Date(block.scheduledDate).toLocaleDateString('fr-FR')}` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    populateForm(block) {
        // D'abord remplir les champs
        safeSetValue('block-author', block.author || '');
        safeSetValue('block-planned-duration', block.plannedDuration || '5:00');
        safeSetValue('block-hit-time', block.hitTime || '');
        safeSetValue('block-color', block.color);
        safeSetValue('block-description', block.description || '');
        safeSetValue('block-scheduled-date', block.scheduledDate || new Date().toISOString().split('T')[0]);
        
        // Ensuite générer et afficher le titre automatique
        const autoTitle = this.generateAutoTitle(block.hitTime || '', block.scheduledDate || new Date().toISOString().split('T')[0]);
        safeSetValue('block-title', autoTitle);
        
        const actualDurationEl = safeGetElement('block-actual-duration');
        if (actualDurationEl) {
            actualDurationEl.textContent = this.calculateBlockDurationSync(block);
        }
        
        // Add event listener for planned duration field if not already added
        const plannedDurationInput = safeGetElement('block-planned-duration');
        if (plannedDurationInput && !plannedDurationInput.hasAttribute('data-listener-added')) {
            plannedDurationInput.setAttribute('data-listener-added', 'true');
            plannedDurationInput.addEventListener('input', () => {
                this.calculateBlockDuration();
            });
        }
        
        // Add event listener for description field to recalculate duration on text change
        const descriptionInput = safeGetElement('block-description');
        if (descriptionInput && !descriptionInput.hasAttribute('data-listener-added')) {
            descriptionInput.setAttribute('data-listener-added', 'true');
            descriptionInput.addEventListener('input', Utils.debounce(() => {
                this.calculateBlockDuration();
            }, 300));
        }
        
        // Trigger full duration calculation to update all displays
        this.calculateBlockDuration();
    }

    showEditor() {
        const welcomeEl = safeGetElement('blocks-welcome');
        const editorEl = safeGetElement('blocks-editor');
        if (welcomeEl) welcomeEl.classList.add('hidden');
        if (editorEl) editorEl.classList.remove('hidden');
    }

    clearEditor() {
        const welcomeEl = safeGetElement('blocks-welcome');
        const editorEl = safeGetElement('blocks-editor');
        if (welcomeEl) welcomeEl.classList.remove('hidden');
        if (editorEl) editorEl.classList.add('hidden');
    }

    updateActiveState(blockId) {
        document.querySelectorAll('.block-item').forEach(el => {
            el.classList.toggle('active', el.dataset.blockId == blockId);
        });
    }

    // Calculate block duration
    calculateBlockDuration() {
        const block = this.getBlock(this.currentBlockId);
        if (!block) return;
        
        // Get current description from input field for real-time calculation
        const currentDescription = safeGetValue('block-description');
        if (currentDescription !== undefined) {
            block.description = currentDescription;
        }

        const actualDuration = this.calculateBlockDurationSync(block);
        
        // Update actual duration display
        const actualDurationEl = safeGetElement('block-actual-duration');
        if (actualDurationEl) {
            actualDurationEl.textContent = actualDuration;
        }
        
        // Update total duration display
        const totalDurationEl = safeGetElement('block-total-duration');
        if (totalDurationEl) {
            totalDurationEl.textContent = actualDuration;
        }
        
        // Update planned display - get current value from input field
        const plannedDisplayEl = safeGetElement('block-planned-display');
        const plannedInputEl = safeGetElement('block-planned-duration');
        if (plannedDisplayEl) {
            const currentPlannedValue = plannedInputEl ? plannedInputEl.value : block.plannedDuration;
            plannedDisplayEl.textContent = currentPlannedValue || block.plannedDuration || '0:00';
        }
        
        // Update actual display
        const actualDisplayEl = safeGetElement('block-actual-display');
        if (actualDisplayEl) {
            actualDisplayEl.textContent = actualDuration;
        }
        
        // Calculate and update difference using current input value
        const currentPlannedDuration = plannedInputEl ? plannedInputEl.value : block.plannedDuration;
        const plannedSeconds = Utils.parseDuration(currentPlannedDuration || block.plannedDuration || '0:00');
        const actualSeconds = Utils.parseDuration(actualDuration);
        const differenceSeconds = actualSeconds - plannedSeconds;
        
        const differenceDisplayEl = safeGetElement('block-difference-display');
        if (differenceDisplayEl) {
            const absDiff = Math.abs(differenceSeconds);
            const diffMinutes = Math.floor(absDiff / 60);
            const diffSeconds = absDiff % 60;
            const prefix = differenceSeconds > 0 ? '+' : '-';
            differenceDisplayEl.textContent = `${prefix}${diffMinutes}:${diffSeconds.toString().padStart(2, '0')}`;
            differenceDisplayEl.style.color = differenceSeconds > 0 ? '#00ff00' : '#ff6b6b';
        }
    }

    calculateBlockDurationSync(block) {
        // Vérifier le cache de durée d'abord
        const cacheKey = `${block.id}-${block.updatedAt || ''}`;
        if (this.durationCache.has(cacheKey)) {
            return this.durationCache.get(cacheKey);
        }
        
        let totalSeconds = 0;
        
        // Calculate duration of assigned items
        if (block.items && block.items.length > 0) {
            block.items.forEach(item => {
                let duration = '0:00';
                
                if (item.type === 'news') {
                    const news = window.app?.newsManager?.getDatabase()?.find(n => n.id === item.id);
                    if (news) {
                        duration = window.app.newsManager.calculateItemDuration(news);
                    }
                } else if (item.type === 'animation') {
                    const animation = window.app?.animationManager?.getDatabase()?.find(a => a.id === item.id);
                    if (animation) {
                        duration = window.app.animationManager.calculateItemDuration(animation);
                    }
                }
                
                totalSeconds += Utils.parseDuration(duration);
            });
        }
        
        // Add duration from block description/summary if present
        const descriptionText = block.description || safeGetValue('block-description') || '';
        if (descriptionText.trim()) {
            // Calculate reading time (assuming ~180 words per minute for French)
            const words = descriptionText.trim().split(/\s+/).length;
            const readingSeconds = Math.ceil((words / 180) * 60);
            totalSeconds += readingSeconds;
            
            // Update word count display if element exists
            const wordCountEl = safeGetElement('block-description-word-count');
            if (wordCountEl) {
                wordCountEl.textContent = `(${words} mot${words !== 1 ? 's' : ''})`;
            }
        } else {
            // Reset word count if no text
            const wordCountEl = safeGetElement('block-description-word-count');
            if (wordCountEl) {
                wordCountEl.textContent = '(0 mots)';
            }
        }

        const duration = formatDurationFromSeconds(totalSeconds);
        
        // Mettre en cache le résultat
        this.durationCache.set(cacheKey, duration);
        
        // Limiter la taille du cache de durée
        if (this.durationCache.size > 100) {
            const firstKey = this.durationCache.keys().next().value;
            this.durationCache.delete(firstKey);
        }
        
        return duration;
    }

    // Nettoyer les items fantômes (qui n'existent plus dans la base)
    cleanGhostItems(block) {
        if (!block || !block.items) return;
        
        const newsDb = window.app?.newsManager?.getDatabase() || [];
        const animationDb = window.app?.animationManager?.getDatabase() || [];
        
        // Filtrer les items qui existent toujours
        const cleanedItems = block.items.filter(item => {
            if (item.type === 'news') {
                const exists = newsDb.some(n => String(n.id) === String(item.id));
                if (!exists) {
                    console.log(`🧹 Suppression de news fantôme: ${item.id}`);
                }
                return exists;
            } else if (item.type === 'animation') {
                const exists = animationDb.some(a => String(a.id) === String(item.id));
                if (!exists) {
                    console.log(`🧹 Suppression d'animation fantôme: ${item.id}`);
                }
                return exists;
            }
            return false; // Type inconnu
        });
        
        if (cleanedItems.length !== block.items.length) {
            const removed = block.items.length - cleanedItems.length;
            block.items = cleanedItems;
            console.log(`✅ Nettoyé ${removed} item(s) fantôme(s)`);
            // Sauvegarder après nettoyage
            this.save();
        }
    }
    
    // Render block items
    renderBlockItems() {
        const block = this.getBlock(this.currentBlockId);
        const container = safeGetElement('block-assigned-items');
        const listContainer = safeGetElement('block-items-list');
        
        if (!block) return;
        
        // Nettoyer les items fantômes avant le rendu
        this.cleanGhostItems(block);

        // Use the container specified in the HTML editor
        const targetContainer = container || listContainer;
        if (!targetContainer) return;

        if (!block.items || block.items.length === 0) {
            targetContainer.innerHTML = '<p style="color: #999; text-align: center;">Aucun élément assigné</p>';
            return;
        }

        const newsDb = window.app?.newsManager?.getDatabase() || [];
        const animationDb = window.app?.animationManager?.getDatabase() || [];

        targetContainer.innerHTML = block.items
            .sort((a, b) => a.order - b.order)
            .map(item => {
                let title = 'Inconnu';
                let duration = '0:00';
                let author = '';
                let icon = '';
                
                if (item.type === 'news') {
                    const news = newsDb.find(n => String(n.id) === String(item.id));
                    if (news) {
                        title = news.title;
                        duration = window.app.newsManager.calculateItemDuration(news);
                        author = news.author;
                        icon = '📰';
                    } else {
                        console.warn(`⚠️ News not found with id: ${item.id}`);
                    }
                } else if (item.type === 'animation') {
                    const animation = animationDb.find(a => String(a.id) === String(item.id));
                    if (animation) {
                        title = animation.title;
                        duration = window.app.animationManager.calculateItemDuration(animation);
                        author = animation.author;
                        icon = '🎙️';
                    } else {
                        console.warn(`⚠️ Animation not found with id: ${item.id}`);
                    }
                }
                
                return `
                    <div class="assigned-item">
                        <div class="assigned-item-info">
                            <span class="assigned-item-type ${item.type}">${item.type}</span>
                            <span>${sanitizeHTML(title)}</span>
                            <span class="assigned-item-duration">${duration}</span>
                        </div>
                        <button class="assigned-item-remove" onclick="app.blockManager.removeItem('${block.id}', '${item.type}', '${item.id}')" title="Retirer">
                            ✕
                        </button>
                    </div>
                `;
            }).join('');
    }

    // Get available items not in any block
    getAvailableItems() {
        const newsDb = window.app?.newsManager?.getDatabase() || [];
        const animationDb = window.app?.animationManager?.getDatabase() || [];
        
        // Get all items already in blocks
        const usedItems = new Set();
        this.blocks.forEach(block => {
            block.items.forEach(item => {
                usedItems.add(`${item.type}-${item.id}`);
            });
        });
        
        const availableNews = newsDb.filter(news => !usedItems.has(`news-${news.id}`));
        const availableAnimations = animationDb.filter(animation => !usedItems.has(`animation-${animation.id}`));
        
        return { news: availableNews, animations: availableAnimations };
    }

    // Open assignment modal
    openAssignModal() {
        if (window.app) {
            window.app.openAddItemToBlockModal();
        }
    }
    
    // Update modal content with available items
    updateAssignModalContent() {
        if (!this.currentBlockId) return;
        
        const available = this.getAvailableItems();
        const newsContainer = safeGetElement('block-assign-news');
        const animationsContainer = safeGetElement('block-assign-animations');
        
        if (newsContainer) {
            if (available.news.length === 0) {
                newsContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;">Aucune news non assignée</p>';
            } else {
                newsContainer.innerHTML = available.news.map(news => `
                    <div class="assign-item" onclick="app.blockManager.addItem(${this.currentBlockId}, 'news', ${news.id})" 
                         style="padding: 12px; margin: 8px 0; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
                         onmouseover="this.style.background='#3a3a3a'; this.style.borderColor='#00ff9f';" 
                         onmouseout="this.style.background='#2a2a2a'; this.style.borderColor='#444';">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${sanitizeHTML(news.title)}</strong>
                                <span style="color: #999; margin-left: 0.5rem;">${news.duration}</span>
                            </div>
                            <button style="background: #00ff9f; color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                                + Ajouter
                            </button>
                        </div>
                        <span style="color: #666; font-size: 0.875rem;">${sanitizeHTML(news.author)}</span>
                    </div>
                `).join('');
            }
        }
        
        if (animationsContainer) {
            if (available.animations.length === 0) {
                animationsContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;">Aucune animation non assignée</p>';
            } else {
                animationsContainer.innerHTML = available.animations.map(animation => `
                    <div class="assign-item" onclick="app.blockManager.addItem(${this.currentBlockId}, 'animation', ${animation.id})" 
                         style="padding: 12px; margin: 8px 0; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
                         onmouseover="this.style.background='#3a3a3a'; this.style.borderColor='#00b4d8';" 
                         onmouseout="this.style.background='#2a2a2a'; this.style.borderColor='#444';">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${sanitizeHTML(animation.title)}</strong>
                                <span style="color: #999; margin-left: 0.5rem;">${animation.duration}</span>
                            </div>
                            <button style="background: #00b4d8; color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                                + Ajouter
                            </button>
                        </div>
                        <span style="color: #666; font-size: 0.875rem;">${sanitizeHTML(animation.author)}</span>
                    </div>
                `).join('');
            }
        }
    }

    // Export blocks for conductor
    exportToConductor(blockId = null) {
        const block = this.getBlock(blockId || this.currentBlockId);
        if (!block) {
            console.warn('⚠️ Bloc non trouvé pour export:', blockId);
            return;
        }

        console.log('📤 Export du bloc vers conducteur:', {
            id: block.id,
            title: block.title,
            items: block.items ? block.items.length : 0
        });

        // Générer le titre automatique si nécessaire
        const blockTitle = block.title || this.generateAutoTitle(block.hitTime, block.scheduledDate);

        const segment = {
            type: 'block',
            blockId: block.id,
            title: blockTitle,
            duration: block.plannedDuration,
            actualDuration: this.calculateBlockDurationSync(block),
            blockColor: block.color,
            children: []
        };

        // Add children
        const newsDb = window.app?.newsManager?.getDatabase() || [];
        const animationDb = window.app?.animationManager?.getDatabase() || [];
        
        console.log(`📄 Ajout de ${block.items.length} éléments au bloc`);
        
        block.items.forEach((item, index) => {
            if (item.type === 'news') {
                const news = newsDb.find(n => n.id === item.id);
                if (news) {
                    console.log(`  ↳ News ${index + 1}: "${news.title}"`);
                    segment.children.push({
                        type: 'news',
                        newsId: news.id,
                        title: news.title,
                        duration: news.duration,
                        actualDuration: window.app.newsManager.calculateItemDuration(news),
                        content: news.content,
                        author: news.author
                    });
                }
            } else if (item.type === 'animation') {
                const animation = animationDb.find(a => a.id === item.id);
                if (animation) {
                    console.log(`  ↳ Animation ${index + 1}: "${animation.title}"`);
                    segment.children.push({
                        type: 'animation',
                        animationId: animation.id,
                        title: animation.title,
                        duration: animation.duration,
                        actualDuration: window.app.animationManager.calculateItemDuration(animation),
                        content: animation.content,
                        author: animation.author
                    });
                }
            }
        });

        return segment;
    }

    /**
     * OPTIMISATION: Assigner plusieurs items en batch
     */
    async batchAssignItems(blockId, items) {
        const block = this.getBlock(blockId);
        if (!block || !items || items.length === 0) return;
        
        console.log(`🚀 Batch assigning ${items.length} items to block ${blockId}`);
        const startTime = Date.now();
        
        // Invalider le cache une seule fois
        this.invalidateCache(blockId);
        
        // Préparer les items à ajouter
        const newItems = [];
        const existingIds = new Set(block.items.map(item => `${item.type}-${item.id}`));
        
        for (const item of items) {
            const itemKey = `${item.type}-${item.id}`;
            if (!existingIds.has(itemKey)) {
                newItems.push({
                    type: item.type,
                    id: String(item.id),
                    order: block.items.length + newItems.length
                });
                existingIds.add(itemKey);
            }
        }
        
        if (newItems.length === 0) {
            console.log('⚠️ Aucun nouvel item à ajouter (tous déjà présents)');
            return;
        }
        
        // Ajouter tous les nouveaux items d'un coup
        block.items.push(...newItems);
        block.updatedAt = new Date().toISOString();
        
        // Mettre à jour les assignedBlocks pour news/animations en batch
        const newsToUpdate = newItems.filter(item => item.type === 'news');
        const animationsToUpdate = newItems.filter(item => item.type === 'animation');
        
        if (newsToUpdate.length > 0 && window.app?.newsManager) {
            const newsDb = window.app.newsManager.database;
            for (const item of newsToUpdate) {
                const news = newsDb.find(n => String(n.id) === String(item.id));
                if (news) {
                    if (!news.assignedBlocks) news.assignedBlocks = [];
                    if (!news.assignedBlocks.includes(String(blockId))) {
                        news.assignedBlocks.push(String(blockId));
                    }
                }
            }
            window.app.newsManager.setDatabase(newsDb);
        }
        
        if (animationsToUpdate.length > 0 && window.app?.animationManager) {
            const animDb = window.app.animationManager.database;
            for (const item of animationsToUpdate) {
                const anim = animDb.find(a => String(a.id) === String(item.id));
                if (anim) {
                    if (!anim.assignedBlocks) anim.assignedBlocks = [];
                    if (!anim.assignedBlocks.includes(String(blockId))) {
                        anim.assignedBlocks.push(String(blockId));
                    }
                }
            }
            window.app.animationManager.setDatabase(animDb);
        }
        
        // Sauvegarder une seule fois
        this.save();
        
        // Mettre à jour le conducteur si nécessaire
        this.updateConductorBlock(blockId);
        
        // Émettre les événements
        this.emit('block-items-changed', block);
        this.emit('blocks-changed', this.blocks);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Batch assign completed in ${duration}ms (${newItems.length} items added)`);
        
        // Tracking métrique
        if (window.BlockMetrics) {
            window.BlockMetrics.track('batchAssign', duration);
        }
        
        showNotification(`${newItems.length} éléments ajoutés au journal`, 'success');
    }
    
    /**
     * OPTIMISATION: Supprimer plusieurs items en batch
     */
    async batchRemoveItems(blockId, itemsToRemove) {
        const block = this.getBlock(blockId);
        if (!block || !itemsToRemove || itemsToRemove.length === 0) return;
        
        console.log(`🚀 Batch removing ${itemsToRemove.length} items from block ${blockId}`);
        const startTime = Date.now();
        
        // Invalider le cache une seule fois
        this.invalidateCache(blockId);
        
        // Créer un Set pour une suppression rapide
        const toRemove = new Set(itemsToRemove.map(item => `${item.type}-${item.id}`));
        
        // Filtrer les items
        const originalLength = block.items.length;
        block.items = block.items.filter(item => 
            !toRemove.has(`${item.type}-${item.id}`)
        );
        
        const removedCount = originalLength - block.items.length;
        
        if (removedCount === 0) {
            console.log('⚠️ Aucun item supprimé (non trouvés)');
            return;
        }
        
        // Réordonner les items restants
        block.items.forEach((item, index) => {
            item.order = index;
        });
        
        block.updatedAt = new Date().toISOString();
        
        // Mettre à jour les assignedBlocks en batch
        const newsToUpdate = itemsToRemove.filter(item => item.type === 'news');
        const animationsToUpdate = itemsToRemove.filter(item => item.type === 'animation');
        
        if (newsToUpdate.length > 0 && window.app?.newsManager) {
            const newsDb = window.app.newsManager.database;
            for (const item of newsToUpdate) {
                const news = newsDb.find(n => String(n.id) === String(item.id));
                if (news && news.assignedBlocks) {
                    news.assignedBlocks = news.assignedBlocks.filter(id => id !== String(blockId));
                    if (news.assignedBlocks.length === 0) {
                        delete news.assignedBlocks;
                        delete news.blockId;
                    }
                }
            }
            window.app.newsManager.setDatabase(newsDb);
        }
        
        if (animationsToUpdate.length > 0 && window.app?.animationManager) {
            const animDb = window.app.animationManager.database;
            for (const item of animationsToUpdate) {
                const anim = animDb.find(a => String(a.id) === String(item.id));
                if (anim && anim.assignedBlocks) {
                    anim.assignedBlocks = anim.assignedBlocks.filter(id => id !== String(blockId));
                    if (anim.assignedBlocks.length === 0) {
                        delete anim.assignedBlocks;
                        delete anim.blockId;
                    }
                }
            }
            window.app.animationManager.setDatabase(animDb);
        }
        
        // Recalculer la durée
        this.calculateBlockDuration();
        
        // Sauvegarder une seule fois
        this.save();
        
        // Mettre à jour le conducteur
        this.updateConductorBlock(blockId);
        
        // Émettre les événements
        this.emit('block-items-changed', block);
        this.emit('blocks-changed', this.blocks);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Batch remove completed in ${duration}ms (${removedCount} items removed)`);
        
        // Tracking métrique
        if (window.BlockMetrics) {
            window.BlockMetrics.track('batchRemove', duration);
        }
        
        showNotification(`${removedCount} éléments retirés du journal`, 'warning');
    }

    // Créer une variante d'une news
    async createNewsVariant(originalNewsId, targetBlockId) {
        if (!window.app?.newsManager) return;
        
        const originalNews = window.app.newsManager.database.find(n => n.id === originalNewsId);
        if (!originalNews) {
            showNotification('News originale non trouvée', 'error');
            return;
        }

        // Créer une copie de la news
        const variant = {
            ...originalNews,
            id: 'news-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            title: originalNews.title + ' (Variante)',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            originalNewsId: originalNewsId,
            isVariant: true
        };

        // Si la news a des sons, les copier aussi
        if (originalNews.sounds && originalNews.sounds.length > 0) {
            variant.sounds = originalNews.sounds.map(sound => ({
                ...sound,
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            }));
        }

        // Ajouter la variante à la base de données
        const newsDb = window.app.newsManager.database;
        newsDb.push(variant);
        window.app.newsManager.setDatabase(newsDb);

        // Ajouter la variante au journal
        this.addItem(targetBlockId, 'news', variant.id);

        // Sauvegarder
        if (window.app.autoSave) {
            window.app.autoSave();
        }

        showNotification('Variante créée et ajoutée au journal', 'success');
        
        // Ouvrir la news pour édition
        setTimeout(() => {
            window.app.newsManager.loadNews(variant.id);
        }, 100);
    }
}

// Export global
window.BlockManager = BlockManager;