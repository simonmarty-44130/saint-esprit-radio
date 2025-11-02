// Conductor Manager - gère le rundown/conducteur
class ConductorManager {
    constructor() {
        this.segments = [];
        this.listeners = new Map();
        this.currentSegmentIndex = -1;
        this.expandedBlocks = new Set(); // Track which blocks are expanded
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

    // Segment management
    setSegments(segments) {
        // S'assurer que chaque segment a une actualDuration et initialiser les propriétés hiérarchiques
        this.segments = segments.map(seg => ({
            ...seg,
            actualDuration: seg.actualDuration || seg.duration,
            parentId: seg.parentId || null,
            isExpanded: seg.isExpanded !== false // Default to expanded
        }));
        // Initialiser les blocs expandés
        this.segments.forEach(seg => {
            if (seg.type === 'block' && seg.isExpanded) {
                this.expandedBlocks.add(seg.id);
            }
        });
        this.emit('segments-changed', this.segments);
    }

    getSegments() {
        return this.segments;
    }

    clearAll() {
        // Vider tous les segments
        this.segments = [];
        this.expandedBlocks.clear();
        this.currentSegmentIndex = -1;
        
        // Rafraîchir l'affichage
        this.render();
        
        // Émettre l'événement de changement
        this.emit('change', this.segments);
    }

    addSegment(segment, parentId = null, silent = false) {
        console.log('📥 Ajout segment au conducteur:', {
            type: segment.type,
            title: segment.title,
            parentId: parentId,
            hasChildren: segment.children ? segment.children.length : 0,
            silent: silent
        });
        
        const newSegment = {
            id: Date.now(),
            locked: false,
            mosReady: false,
            actualDuration: segment.actualDuration || segment.duration,
            parentId: parentId,
            isExpanded: true,
            ...segment
        };
        
        // Mettre à jour lastUsed pour les éléments news/animation
        if (newSegment.newsId && window.app?.newsManager) {
            const newsItem = window.app.newsManager.getDatabase().find(n => n.id === newSegment.newsId);
            if (newsItem) {
                newsItem.lastUsed = new Date().toISOString();
                // Ne pas sauvegarder ici, laisser segments-changed le faire
            }
        } else if (newSegment.animationId && window.app?.animationManager) {
            const animationItem = window.app.animationManager.getDatabase().find(a => a.id === newSegment.animationId);
            if (animationItem) {
                animationItem.lastUsed = new Date().toISOString();
                // Ne pas sauvegarder ici, laisser segments-changed le faire
            }
        }
        
        // Si c'est un sous-élément, l'insérer après le parent
        if (parentId) {
            const parentIndex = this.segments.findIndex(s => s.id === parentId);
            if (parentIndex !== -1) {
                // Trouver la fin du bloc (après tous ses enfants)
                let insertIndex = parentIndex + 1;
                while (insertIndex < this.segments.length && 
                       this.segments[insertIndex].parentId === parentId) {
                    insertIndex++;
                }
                this.segments.splice(insertIndex, 0, newSegment);
            } else {
                this.segments.push(newSegment);
            }
        } else {
            this.segments.push(newSegment);
        }
        
        // Si c'est un bloc, l'ajouter aux blocs expandés et ajouter ses enfants
        if (newSegment.type === 'block') {
            this.expandedBlocks.add(newSegment.id);
            
            // Ajouter les enfants du bloc s'ils existent
            if (segment.children && segment.children.length > 0) {
                console.log(`📁 Ajout de ${segment.children.length} enfants pour le bloc "${newSegment.title}"`);
                segment.children.forEach((child, index) => {
                    // Ne pas ajouter les enfants avec un titre undefined
                    if (child.title && child.title !== 'undefined') {
                        console.log(`  ↳ Enfant ${index + 1}: "${child.title}"`);
                        // Ajouter l'enfant SANS émettre l'événement (on le fera à la fin)
                        const childSegment = {
                            id: Date.now() + index,
                            locked: false,
                            mosReady: false,
                            actualDuration: child.actualDuration || child.duration,
                            parentId: newSegment.id,
                            isExpanded: true,
                            ...child
                        };
                        
                        // Insérer directement après le parent
                        const parentIndex = this.segments.indexOf(newSegment);
                        this.segments.splice(parentIndex + 1 + index, 0, childSegment);
                    } else {
                        console.warn(`  ⚠️ Ignoré enfant ${index + 1} sans titre valide:`, child);
                    }
                });
            }
        }
        
        this.render();
        
        // Ne pas émettre l'événement si silent est true
        if (!silent) {
            this.emit('segments-changed', this.segments);
        }
        
        return newSegment;
    }

    removeSegment(segmentId) {
        this.segments = this.segments.filter(s => s.id !== segmentId);
        this.render();
        this.emit('segments-changed', this.segments);
    }

    findSegmentByItemId(itemId, idField) {
        return this.segments.find(seg => seg[idField] === itemId);
    }

    removeSegmentByItemId(itemId, idField) {
        this.segments = this.segments.filter(seg => seg[idField] !== itemId);
        this.render();
        this.emit('segments-changed', this.segments);
    }

    findSegmentByBlockId(blockId) {
        return this.segments.find(seg => seg.blockId === blockId);
    }

    removeSegmentByBlockId(blockId) {
        this.segments = this.segments.filter(seg => seg.blockId !== blockId);
        this.render();
        this.emit('segments-changed', this.segments);
    }

    updateSegment(segmentId, updates) {
        const segment = this.segments.find(s => s.id === segmentId);
        if (segment) {
            Object.assign(segment, updates);
            this.render();
            this.emit('segments-changed', this.segments);
        }
    }

    toggleLock(segmentId) {
        const segment = this.segments.find(s => s.id === segmentId);
        if (segment) {
            segment.locked = !segment.locked;
            this.render();
            this.emit('segments-changed', this.segments);
            showNotification(segment.locked ? 'Segment locked' : 'Segment unlocked', 'info');
        }
    }

    toggleExpand(blockId) {
        const block = this.segments.find(s => s.id === blockId && s.type === 'block');
        if (block) {
            block.isExpanded = !block.isExpanded;
            if (block.isExpanded) {
                this.expandedBlocks.add(blockId);
            } else {
                this.expandedBlocks.delete(blockId);
            }
            this.render();
            this.emit('segments-changed', this.segments);
        }
    }

    // Calculer la durée totale d'un bloc (somme des enfants)
    calculateBlockDuration(blockId) {
        let totalSeconds = 0;
        const children = this.segments.filter(s => s.parentId === blockId);
        
        children.forEach(child => {
            const duration = Utils.parseDuration(child.actualDuration || child.duration || '0:00');
            totalSeconds += duration;
        });
        
        return formatDurationFromSeconds(totalSeconds);
    }

    // Vérifier si un segment doit être visible
    isSegmentVisible(segment) {
        if (!segment.parentId) return true; // Top-level segments are always visible
        
        const parent = this.segments.find(s => s.id === segment.parentId);
        return parent && parent.isExpanded && this.expandedBlocks.has(parent.id);
    }

    // Rendering
    render() {
        const tbody = safeGetElement('rundown-body');
        if (!tbody) return;
        
        let html = '';
        let cumulativeTime = 0;
        let visibleIndex = 0;
        
        // Get show start time from input or use default
        const baseTime = new Date();
        const showStartInput = safeGetElement('show-start-time');
        if (showStartInput && showStartInput.value) {
            const [hours, minutes] = showStartInput.value.split(':').map(Number);
            baseTime.setHours(hours, minutes, 0, 0);
        } else {
            baseTime.setHours(Constants.SHOW_START_TIME.hours, Constants.SHOW_START_TIME.minutes, 0, 0);
        }
        
        this.segments.forEach((segment, index) => {
            // Vérifier si le segment doit être visible
            const isVisible = this.isSegmentVisible(segment);
            
            if (isVisible) {
                visibleIndex++;
            }
            
            const format = Constants.FORMAT_TYPES[segment.type] || Constants.FORMAT_TYPES['custom'];
            const hitTime = new Date(baseTime.getTime() + cumulativeTime * 1000);
            
            // Pour les blocs, calculer la durée totale des enfants
            let plannedDuration, actualDuration;
            if (segment.type === 'block') {
                const blockDuration = this.calculateBlockDuration(segment.id);
                plannedDuration = Utils.parseDuration(segment.duration || blockDuration);
                actualDuration = Utils.parseDuration(blockDuration);
                segment.actualDuration = blockDuration; // Mettre à jour la durée réelle
            } else {
                plannedDuration = Utils.parseDuration(segment.duration || '0:00');
                actualDuration = Utils.parseDuration(segment.actualDuration || segment.duration || '0:00');
            }
            
            // Calcul de la variance
            const variance = actualDuration - plannedDuration;
            const varianceFormatted = variance === 0 ? '' : 
                (variance > 0 ? '+' : '') + formatDurationFromSeconds(Math.abs(variance));
            const varianceClass = variance > 0 ? 'overtime' : variance < 0 ? 'undertime' : '';
            
            // Calcul du backtime
            const showEndTime = baseTime.getTime() + Constants.SHOW_DURATION * 1000;
            const segmentEndTime = baseTime.getTime() + (cumulativeTime + actualDuration) * 1000;
            const backtimeSeconds = Math.floor((showEndTime - segmentEndTime) / 1000);
            const backtimeFormatted = backtimeSeconds >= 0 ? 
                formatDurationFromSeconds(backtimeSeconds) : 
                '-' + formatDurationFromSeconds(Math.abs(backtimeSeconds));
            
            // Déterminer l'indentation et le bouton expand/collapse
            const indent = segment.parentId ? 'padding-left: 30px;' : '';
            const expandBtn = segment.type === 'block' ? 
                `<button class="expand-btn" onclick="app.conductorManager.toggleExpand(${segment.id})" style="margin-right: 5px;">
                    ${segment.isExpanded ? '▼' : '▶'}
                </button>` : '';
            
            // N'ajouter au HTML que si le segment est visible
            if (isVisible) {
                // Style spécial pour les placeholders publicitaires
                const isAdPlaceholder = segment.type === 'ad_placeholder';
                const rowClass = isAdPlaceholder ? 'row-ad-placeholder' : `row-${segment.type}`;
                const nameStyle = isAdPlaceholder ? 
                    `cursor: pointer; ${indent}` : 
                    `cursor: pointer; ${indent}`;
                const titleContent = isAdPlaceholder ? 
                    `📺 ${sanitizeHTML(segment.title)} <span style="font-size: 0.75rem; color: #999; margin-left: 0.5rem;">[Open Radio]</span>` :
                    `${expandBtn}${sanitizeHTML(segment.title)}${segment.type === 'block' ? `<span style="font-size: 0.75rem; color: #999; margin-left: 0.5rem;">(${segment.actualDuration || '0:00'})</span>` : ''}`;
                
                html += `
                <tr class="${rowClass} ${segment.parentId ? 'child-segment' : ''}" 
                    data-segment-id="${segment.id}"
                    data-segment-type="${segment.type}"
                    data-segment-index="${index}"
                    draggable="true"
                    ondragstart="app.conductorManager.handleDragStart(event, ${index})"
                    ondragover="app.conductorManager.handleDragOver(event)"
                    ondrop="app.conductorManager.handleDrop(event, ${index})"
                    ${segment.type === 'block' ? `oncontextmenu="app.showBlockContextMenu(event, ${segment.id}); return false;"` : ''}>
                    <td class="col-pg" style="text-align: center;">${visibleIndex}</td>
                    <td class="col-move" style="text-align: center; cursor: move;">
                        <span style="color: #666;">⋮⋮</span>
                    </td>
                    <td class="col-lock" style="text-align: center; cursor: pointer;" onclick="app.conductorManager.toggleLock(${segment.id})" title="Click to ${segment.locked ? 'unlock' : 'lock'}">${segment.locked ? '🔒' : '🔓'}</td>
                    <td class="col-format" style="text-align: center; background-color: ${format.color}20; color: ${format.color};">
                        ${format.icon || format.code}
                    </td>
                    <td class="col-name" style="${nameStyle}" onclick="app.conductorManager.editSegment(${segment.id})">
                        ${titleContent}
                    </td>
                    <td class="col-duration" style="text-align: center;">${segment.duration}</td>
                    <td class="col-duration" style="text-align: center;">${segment.actualDuration || segment.duration}</td>
                    <td class="col-variance ${varianceClass}" style="text-align: center;">${varianceFormatted}</td>
                    <td class="col-cm-dur" style="text-align: center;">${segment.cmDuration || ''}</td>
                    <td class="col-hit-time" style="text-align: center;">${Utils.formatTime(hitTime)}</td>
                    <td class="col-backtime" style="text-align: center;">${backtimeFormatted}</td>
                    <td class="col-mos" style="text-align: center;">
                        <button class="delete-btn" onclick="app.conductorManager.deleteSegment(${segment.id})" 
                                title="Delete" ${segment.locked ? 'disabled' : ''}>
                            ❌
                        </button>
                    </td>
                </tr>
            `;
            }
            
            cumulativeTime += actualDuration;
        });
        
        tbody.innerHTML = html || '<tr><td colspan="12" style="text-align: center; color: #999;">No segments in rundown</td></tr>';
        
        // Update show duration
        this.updateShowTimers(cumulativeTime);
    }

    selectSegment(index) {
        this.currentSegmentIndex = index;
        
        // Update visual selection
        document.querySelectorAll('#rundown-body tr').forEach((row, i) => {
            row.classList.toggle('selected', i === index);
        });
        
        this.emit('segment-selected', this.segments[index]);
    }

    updateShowTimers(totalSeconds) {
        const showDurationEl = safeGetElement('show-duration');
        const showBacktimeEl = safeGetElement('show-backtime');
        const showVarianceEl = safeGetElement('show-variance');
        
        if (showDurationEl) {
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            showDurationEl.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Backtime (temps restant par rapport à une émission d'1 heure)
        if (showBacktimeEl) {
            const backtimeSeconds = Constants.SHOW_DURATION - totalSeconds;
            const absSeconds = Math.abs(backtimeSeconds);
            const hours = Math.floor(absSeconds / 3600);
            const minutes = Math.floor((absSeconds % 3600) / 60);
            const seconds = absSeconds % 60;
            const prefix = backtimeSeconds < 0 ? '-' : '';
            showBacktimeEl.textContent = 
                `${prefix}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Variance (over/under)
        if (showVarianceEl) {
            const variance = totalSeconds - Constants.SHOW_DURATION;
            const absVariance = Math.abs(variance);
            const minutes = Math.floor(absVariance / 60);
            const seconds = absVariance % 60;
            const prefix = variance > 0 ? '+' : '-';
            showVarianceEl.textContent = 
                `${prefix}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            showVarianceEl.classList.toggle('overtime', variance > 0);
        }
    }

    // Reorder segments
    moveSegment(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        const segment = this.segments.splice(fromIndex, 1)[0];
        this.segments.splice(toIndex, 0, segment);
        
        this.render();
        this.emit('segments-changed', this.segments);
    }

    moveSegmentUp(index) {
        if (index > 0 && !this.segments[index].locked && !this.segments[index - 1].locked) {
            this.moveSegment(index, index - 1);
        }
    }

    moveSegmentDown(index) {
        if (index < this.segments.length - 1 && !this.segments[index].locked && !this.segments[index + 1].locked) {
            this.moveSegment(index, index + 1);
        }
    }

    editSegment(segmentId) {
        const segment = this.segments.find(s => s.id === segmentId);
        if (!segment) return;
        
        if (segment.newsId) {
            // Open news editor
            window.app.switchTab('news');
            window.app.newsManager.load(segment.newsId);
        } else if (segment.animationId) {
            // Open animation editor
            window.app.switchTab('animation');
            window.app.animationManager.load(segment.animationId);
        } else if (segment.type === 'ad_placeholder') {
            // Open ad placeholder editor modal
            this.openAdPlaceholderModal(segment);
        }
    }

    openAdPlaceholderModal(segment = null) {
        const isEdit = segment !== null;
        const modalHTML = `
            <div class="modal-overlay" id="ad-placeholder-modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Edit Ad Placeholder' : 'Add Ad Placeholder'}</h3>
                        <button class="close-btn" onclick="app.conductorManager.closeAdPlaceholderModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="ad-title">Title</label>
                            <input type="text" id="ad-title" value="${isEdit ? sanitizeHTML(segment.title) : 'Publicité - Bloc Commercial'}" required>
                        </div>
                        <div class="form-group">
                            <label for="ad-scheduled-time">Scheduled Time (optional)</label>
                            <input type="time" id="ad-scheduled-time" step="1" value="${isEdit && segment.scheduledTime ? segment.scheduledTime : ''}">
                        </div>
                        <div class="form-group">
                            <label for="ad-duration">Duration</label>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" id="ad-duration" value="${isEdit ? segment.duration : '3:00'}" placeholder="MM:SS" required>
                                <span style="color: #666; align-self: center;">or</span>
                                <input type="number" id="ad-duration-seconds" min="10" max="600" placeholder="Seconds">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="ad-type">Ad Type</label>
                            <select id="ad-type">
                                <option value="commercial" ${isEdit && segment.adType === 'commercial' ? 'selected' : ''}>Commercial</option>
                                <option value="sponsoring" ${isEdit && segment.adType === 'sponsoring' ? 'selected' : ''}>Sponsoring</option>
                                <option value="promo" ${isEdit && segment.adType === 'promo' ? 'selected' : ''}>Promo</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="ad-notes">Notes (optional)</label>
                            <textarea id="ad-notes" rows="3" placeholder="Instructions for Action de Grace...">${isEdit && segment.notes ? sanitizeHTML(segment.notes) : ''}</textarea>
                        </div>
                        <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin-top: 15px;">
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">
                                <strong>📺 External Audio Provider:</strong> Open Radio<br>
                                <small>The audio will be handled by Action de Grace during broadcast.</small>
                            </p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.conductorManager.closeAdPlaceholderModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.conductorManager.saveAdPlaceholder(${isEdit ? segment.id : 'null'})">${isEdit ? 'Update' : 'Add'} Placeholder</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup duration sync
        const durationInput = document.getElementById('ad-duration');
        const secondsInput = document.getElementById('ad-duration-seconds');
        
        durationInput.addEventListener('input', () => {
            const duration = Utils.parseDuration(durationInput.value);
            if (duration > 0) {
                secondsInput.value = duration;
            }
        });
        
        secondsInput.addEventListener('input', () => {
            const seconds = parseInt(secondsInput.value);
            if (seconds > 0) {
                durationInput.value = formatDurationFromSeconds(seconds);
            }
        });
    }

    closeAdPlaceholderModal() {
        const modal = document.getElementById('ad-placeholder-modal');
        if (modal) {
            modal.remove();
        }
    }

    saveAdPlaceholder(segmentId = null) {
        const title = document.getElementById('ad-title').value.trim();
        const scheduledTime = document.getElementById('ad-scheduled-time').value;
        const duration = document.getElementById('ad-duration').value;
        const adType = document.getElementById('ad-type').value;
        const notes = document.getElementById('ad-notes').value.trim();
        
        if (!title || !duration) {
            showNotification('Title and duration are required', 'error');
            return;
        }
        
        const placeholderData = {
            type: 'ad_placeholder',
            title: title,
            scheduledTime: scheduledTime || null,
            duration: duration,
            actualDuration: duration,
            adType: adType,
            notes: notes,
            externalProvider: 'Open Radio',
            isGhost: true,
            hasAudio: false
        };
        
        if (segmentId) {
            // Update existing
            this.updateSegment(segmentId, placeholderData);
        } else {
            // Add new
            this.addSegment(placeholderData);
        }
        
        this.closeAdPlaceholderModal();
        showNotification(segmentId ? 'Ad placeholder updated' : 'Ad placeholder added', 'success');
    }

    // Ajouter les méthodes de drag & drop
    handleDragStart(event, index) {
        const segment = this.segments[index];
        if (segment.locked) {
            event.preventDefault();
            return;
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', index);
        event.target.style.opacity = '0.5';
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    handleDrop(event, targetIndex) {
        event.preventDefault();
        const sourceIndex = parseInt(event.dataTransfer.getData('text/plain'));
        
        // Reset opacity
        const rows = document.querySelectorAll('#rundown-body tr');
        rows.forEach(row => row.style.opacity = '1');
        
        if (sourceIndex !== targetIndex) {
            this.moveSegment(sourceIndex, targetIndex);
        }
    }

    // Ajouter méthode de suppression
    deleteSegment(segmentId) {
        const segment = this.segments.find(s => s.id === segmentId);
        if (!segment || segment.locked) return;
        
        const segmentTitle = segment.title || 'cet élément';
        console.log(`🗑️ Demande de suppression du segment: "${segmentTitle}" (type: ${segment.type})`);
        
        if (confirm(`Retirer "${segmentTitle}" du conducteur ?\n\n(L'élément restera disponible pour une utilisation future)`)) {
            // Si c'est un block, supprimer aussi les enfants du conducteur
            if (segment.type === 'block') {
                const childrenToRemove = this.segments.filter(s => s.parentId === segmentId);
                console.log(`📁 Suppression de ${childrenToRemove.length} enfants du bloc`);
                // Retirer les enfants du conducteur SEULEMENT
                this.segments = this.segments.filter(s => s.parentId !== segmentId);
            }
            
            // Retirer du conducteur SEULEMENT (pas de la base de données)
            console.log(`❌ Retrait du segment ${segmentId} du conducteur`);
            this.removeSegment(segmentId);
            
            // Message clair que c'est juste retiré du conducteur
            showNotification(`"${segmentTitle}" retiré du conducteur (toujours disponible dans la liste)`, 'info');
        } else {
            console.log('❎ Suppression annulée par l\'utilisateur');
        }
    }

    // Templates
    loadTemplate(templateName) {
        const template = Constants.TEMPLATES[templateName];
        if (!template) return false;
        
        // Créer un mapping des titres de blocs vers leurs nouveaux IDs
        const blockIdMap = new Map();
        
        // Première passe : créer tous les segments et mapper les blocs
        this.segments = template.map((seg, index) => {
            const newSegment = {
                ...seg,
                id: Date.now() + index,
                locked: false,
                mosReady: false,
                actualDuration: seg.duration,
                parentId: null // Réinitialiser
            };
            
            // Si c'est un bloc, l'ajouter au mapping
            if (seg.type === 'block') {
                blockIdMap.set(seg.title, newSegment.id);
                this.expandedBlocks.add(newSegment.id);
            }
            
            return newSegment;
        });
        
        // Deuxième passe : assigner les parentId basés sur le mapping
        this.segments.forEach(segment => {
            // Si le segment du template avait un parentId (qui est un titre de bloc)
            const templateSeg = template.find(t => 
                (t.title === segment.title && t.type === segment.type));
            if (templateSeg && templateSeg.parentId && typeof templateSeg.parentId === 'string') {
                const parentBlockId = blockIdMap.get(templateSeg.parentId);
                if (parentBlockId) {
                    segment.parentId = parentBlockId;
                }
            }
        });
        
        this.render();
        this.emit('segments-changed', this.segments);
        return true;
    }

    // Export for printing
    generatePrintData() {
        return this.segments.map((segment, index) => {
            const format = Constants.FORMAT_TYPES[segment.type] || Constants.FORMAT_TYPES['custom'];
            return {
                position: index + 1,
                format: format.label,
                title: segment.title,
                duration: segment.duration,
                author: segment.author || '-',
                status: segment.status || '-',
                notes: segment.notes || '-'
            };
        });
    }

    // Export for Action de Grace
    exportForActionDeGrace() {
        const baseTime = new Date();
        const showStartInput = safeGetElement('show-start-time');
        if (showStartInput && showStartInput.value) {
            const [hours, minutes] = showStartInput.value.split(':').map(Number);
            baseTime.setHours(hours, minutes, 0, 0);
        } else {
            baseTime.setHours(Constants.SHOW_START_TIME.hours, Constants.SHOW_START_TIME.minutes, 0, 0);
        }
        
        let cumulativeTime = 0;
        const rundown = this.segments.map(segment => {
            const hitTime = new Date(baseTime.getTime() + cumulativeTime * 1000);
            const duration = Utils.parseDuration(segment.actualDuration || segment.duration || '0:00');
            
            const exportData = {
                id: segment.id,
                type: segment.type,
                title: segment.title,
                hitTime: Utils.formatTime(hitTime),
                duration: duration,
                durationFormatted: segment.actualDuration || segment.duration,
                hasAudio: segment.type !== 'ad_placeholder' && segment.type !== 'block',
                isGhost: segment.type === 'ad_placeholder',
                locked: segment.locked || false
            };
            
            // Add specific fields for ad placeholders
            if (segment.type === 'ad_placeholder') {
                exportData.externalProvider = segment.externalProvider || 'Open Radio';
                exportData.adType = segment.adType || 'commercial';
                exportData.scheduledTime = segment.scheduledTime || null;
                exportData.notes = segment.notes || '';
            }
            
            // Add news/animation IDs if available
            if (segment.newsId) exportData.newsId = segment.newsId;
            if (segment.animationId) exportData.animationId = segment.animationId;
            if (segment.blockId) exportData.blockId = segment.blockId;
            
            cumulativeTime += duration;
            
            return exportData;
        });
        
        return {
            showDate: new Date().toISOString(),
            showStartTime: Utils.formatTime(baseTime),
            showDuration: cumulativeTime,
            rundown: rundown
        };
    }
}

// Export global
window.ConductorManager = ConductorManager;