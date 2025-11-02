/**
 * QuickCustomizer - Interface de personnalisation rapide
 * Permet de personnaliser un template récurrent en 2-3 minutes
 */

class QuickCustomizer {
    constructor(recurrenceManager) {
        this.recurrenceManager = recurrenceManager;
        this.currentTemplate = null;
        this.customValues = {};
        this.modalElement = null;
    }

    /**
     * Afficher modal de personnalisation
     */
    showCustomizationModal(templateId) {
        const template = this.recurrenceManager.loadRecurrent(templateId);
        if (!template) {
            alert('Template non trouvé');
            return;
        }
        
        this.currentTemplate = template;
        this.customValues = {};
        
        // Pré-remplir avec valeurs par défaut
        this.prefillDefaultValues();
        
        const modal = this.createModal(template);
        this.showModal(modal);
        
        // Focus sur premier champ
        setTimeout(() => {
            const firstInput = this.modalElement.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    /**
     * Créer le contenu du modal
     */
    createModal(template) {
        const today = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const form = template.customizationForm;
        
        return `
            <div class="quick-customizer-modal">
                <div class="modal-header">
                    <h3>⚡ Personnalisation Rapide - ${template.name}</h3>
                    <button class="modal-close" onclick="quickCustomizer.closeModal()">×</button>
                </div>
                
                <div class="modal-subheader">
                    <p>📅 ${today}</p>
                    <p class="time-info">⏰ ${template.startTime} → ${template.endTime}</p>
                </div>
                
                <div class="customization-form">
                    ${this.renderVariableGroups(form)}
                </div>
                
                <div class="modal-footer">
                    <div class="quick-actions">
                        <button class="btn-autofill" onclick="quickCustomizer.autofillToday()">
                            🤖 Auto-remplir aujourd'hui
                        </button>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn-secondary" onclick="quickCustomizer.preview()">
                            👁️ Preview
                        </button>
                        <button class="btn-primary" onclick="quickCustomizer.applyCustomization()">
                            ✅ Appliquer
                        </button>
                        <button class="btn-export" onclick="quickCustomizer.exportDirectly()">
                            📦 Export Direct
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render des groupes de variables
     */
    renderVariableGroups(form) {
        const grouped = this.groupVariablesByType(form.variables);
        
        return Object.entries(grouped).map(([type, variables]) => {
            const typeLabels = {
                date: '📅 Date & Temps',
                weather: '🌤️ Météo',
                news: '📰 Actualités',
                region: '📍 Localisation',
                custom: '✏️ Personnalisé'
            };
            
            return `
                <div class="variable-section">
                    <h4>${typeLabels[type] || type}</h4>
                    ${variables.map(variable => this.renderVariableInput(variable)).join('')}
                </div>
            `;
        }).join('');
    }

    /**
     * Grouper variables par type
     */
    groupVariablesByType(variables) {
        const grouped = {};
        
        variables.forEach(variable => {
            const type = variable.type || 'custom';
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(variable);
        });
        
        return grouped;
    }

    /**
     * Render d'un input de variable
     */
    renderVariableInput(variable) {
        const contexts = variable.items.map(item => 
            `<span class="context-hint">${item.timeCode} - ${item.originalTitle}</span>`
        ).join('');
        
        return `
            <div class="variable-group">
                <label for="var_${variable.name}">${variable.label}:</label>
                <div class="variable-input-wrapper">
                    <input type="text" 
                           id="var_${variable.name}"
                           data-variable="${variable.name}" 
                           placeholder="${this.getPlaceholder(variable)}"
                           value="${this.customValues[variable.name] || ''}"
                           class="variable-input">
                    ${this.renderQuickButtons(variable)}
                </div>
                <div class="variable-contexts">
                    ${contexts}
                </div>
            </div>
        `;
    }

    /**
     * Obtenir placeholder pour variable
     */
    getPlaceholder(variable) {
        const placeholders = {
            date: "Ex: 25 juillet 2025",
            temperature: "Ex: 22°C",
            weather: "Ex: Ensoleillé",
            region: "Ex: Île-de-France",
            animateur: "Ex: Jean Dupont",
            invité: "Ex: Marie Martin"
        };
        
        return placeholders[variable.name] || `Saisir ${variable.label.toLowerCase()}...`;
    }

    /**
     * Render boutons rapides
     */
    renderQuickButtons(variable) {
        const quickValues = this.getQuickValues(variable);
        if (!quickValues || quickValues.length === 0) return '';
        
        return `
            <div class="quick-values">
                ${quickValues.map(value => `
                    <button class="quick-value-btn" 
                            onclick="quickCustomizer.setQuickValue('${variable.name}', '${value}')">
                        ${value}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Obtenir valeurs rapides pour variable
     */
    getQuickValues(variable) {
        const quickValues = {
            weather: ['Ensoleillé', 'Nuageux', 'Pluie', 'Orage'],
            temperature: ['15°C', '20°C', '25°C', '30°C'],
            region: ['Île-de-France', 'Bretagne', 'PACA', 'Occitanie']
        };
        
        return quickValues[variable.name] || [];
    }

    /**
     * Pré-remplir valeurs par défaut
     */
    prefillDefaultValues() {
        const now = new Date();
        
        // Date du jour
        this.customValues.date = now.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        // Jour de la semaine
        this.customValues.jour = now.toLocaleDateString('fr-FR', { weekday: 'long' });
        
        // Heure actuelle
        this.customValues.heure = now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Auto-remplir pour aujourd'hui
     */
    autofillToday() {
        // Remplir date
        const dateInput = this.modalElement.querySelector('[data-variable="date"]');
        if (dateInput) {
            dateInput.value = this.customValues.date;
            this.updateCustomValue('date', this.customValues.date);
        }
        
        // Suggestions météo basées sur la saison
        const month = new Date().getMonth();
        let weatherSuggestion = 'Ensoleillé';
        let tempSuggestion = '20°C';
        
        if (month >= 11 || month <= 2) { // Hiver
            weatherSuggestion = 'Nuageux';
            tempSuggestion = '5°C';
        } else if (month >= 3 && month <= 5) { // Printemps
            weatherSuggestion = 'Variable';
            tempSuggestion = '15°C';
        } else if (month >= 6 && month <= 8) { // Été
            weatherSuggestion = 'Ensoleillé';
            tempSuggestion = '25°C';
        } else { // Automne
            weatherSuggestion = 'Pluie';
            tempSuggestion = '12°C';
        }
        
        const weatherInput = this.modalElement.querySelector('[data-variable="weather"]');
        if (weatherInput && !weatherInput.value) {
            weatherInput.value = weatherSuggestion;
            this.updateCustomValue('weather', weatherSuggestion);
        }
        
        const tempInput = this.modalElement.querySelector('[data-variable="temperature"]');
        if (tempInput && !tempInput.value) {
            tempInput.value = tempSuggestion;
            this.updateCustomValue('temperature', tempSuggestion);
        }
    }

    /**
     * Définir valeur rapide
     */
    setQuickValue(variableName, value) {
        const input = this.modalElement.querySelector(`[data-variable="${variableName}"]`);
        if (input) {
            input.value = value;
            this.updateCustomValue(variableName, value);
        }
    }

    /**
     * Mettre à jour valeur personnalisée
     */
    updateCustomValue(variableName, value) {
        this.customValues[variableName] = value;
    }

    /**
     * Preview de la personnalisation
     */
    preview() {
        // Collecter toutes les valeurs
        this.collectAllValues();
        
        const customized = this.recurrenceManager.applyCustomization(
            this.currentTemplate.id, 
            this.customValues
        );
        
        if (!customized) {
            alert('Erreur lors de la personnalisation');
            return;
        }
        
        // Afficher preview dans un nouveau modal
        const previewContent = `
            <div class="preview-modal">
                <h3>👁️ Preview - ${customized.name}</h3>
                <div class="preview-timeline">
                    ${customized.items.map(item => `
                        <div class="preview-item">
                            <span class="preview-time">${item.timeCode}</span>
                            <span class="preview-title">${item.title}</span>
                            ${item.audioFileName ? 
                                `<span class="preview-audio">🎵 ${item.audioFileName}</span>` : 
                                ''
                            }
                            <span class="preview-duration">${item.durationDisplay}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-close-preview" onclick="quickCustomizer.closePreview()">
                    Fermer
                </button>
            </div>
        `;
        
        this.showPreviewModal(previewContent);
    }

    /**
     * Collecter toutes les valeurs du formulaire
     */
    collectAllValues() {
        const inputs = this.modalElement.querySelectorAll('.variable-input');
        inputs.forEach(input => {
            const varName = input.dataset.variable;
            const value = input.value.trim();
            if (value) {
                this.customValues[varName] = value;
            }
        });
    }

    /**
     * Appliquer la personnalisation
     */
    applyCustomization() {
        this.collectAllValues();
        
        const customized = this.recurrenceManager.applyCustomization(
            this.currentTemplate.id,
            this.customValues
        );
        
        if (!customized) {
            alert('Erreur lors de la personnalisation');
            return;
        }
        
        // Charger dans TimelineBuilder
        if (window.timelineBuilder) {
            window.timelineBuilder.loadTimeline(customized);
            this.closeModal();
            
            // Notifier l'utilisateur
            this.showNotification('✅ Template personnalisé avec succès!');
        } else {
            alert('TimelineBuilder non disponible');
        }
    }

    /**
     * Export direct
     */
    async exportDirectly() {
        this.collectAllValues();
        
        const customized = this.recurrenceManager.applyCustomization(
            this.currentTemplate.id,
            this.customValues
        );
        
        if (!customized) {
            alert('Erreur lors de la personnalisation');
            return;
        }
        
        // Exporter directement
        if (window.exportManager) {
            await window.exportManager.exportComplete(customized);
            this.showNotification('📦 Export terminé!');
        } else {
            alert('Module d\'export non disponible');
        }
    }

    /**
     * Afficher modal
     */
    showModal(content) {
        // Créer overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeModal();
        };
        
        // Créer modal
        const modal = document.createElement('div');
        modal.className = 'modal-container';
        modal.innerHTML = content;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        this.modalElement = modal;
        
        // Attacher event listeners
        this.attachModalListeners();
        
        // Animation d'entrée
        requestAnimationFrame(() => {
            overlay.classList.add('modal-visible');
        });
    }

    /**
     * Attacher listeners du modal
     */
    attachModalListeners() {
        // Inputs
        const inputs = this.modalElement.querySelectorAll('.variable-input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.updateCustomValue(e.target.dataset.variable, e.target.value);
            });
            
            // Enter pour passer au suivant
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const nextInput = this.getNextInput(input);
                    if (nextInput) {
                        nextInput.focus();
                    } else {
                        this.applyCustomization();
                    }
                }
            });
        });
    }

    /**
     * Obtenir input suivant
     */
    getNextInput(currentInput) {
        const inputs = Array.from(this.modalElement.querySelectorAll('.variable-input'));
        const currentIndex = inputs.indexOf(currentInput);
        return inputs[currentIndex + 1] || null;
    }

    /**
     * Afficher modal preview
     */
    showPreviewModal(content) {
        const previewOverlay = document.createElement('div');
        previewOverlay.className = 'preview-overlay';
        previewOverlay.innerHTML = content;
        document.body.appendChild(previewOverlay);
        
        requestAnimationFrame(() => {
            previewOverlay.classList.add('visible');
        });
    }

    /**
     * Fermer preview
     */
    closePreview() {
        const preview = document.querySelector('.preview-overlay');
        if (preview) {
            preview.classList.remove('visible');
            setTimeout(() => preview.remove(), 300);
        }
    }

    /**
     * Fermer modal
     */
    closeModal() {
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            overlay.classList.remove('modal-visible');
            setTimeout(() => {
                overlay.remove();
                this.modalElement = null;
                this.currentTemplate = null;
                this.customValues = {};
            }, 300);
        }
    }

    /**
     * Afficher notification
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        requestAnimationFrame(() => {
            notification.classList.add('visible');
        });
        
        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Export global
window.QuickCustomizer = QuickCustomizer;

// Initialiser globalement
if (!window.quickCustomizer && window.recurrenceManager) {
    console.log('Creating QuickCustomizer instance...');
    window.quickCustomizer = new QuickCustomizer(window.recurrenceManager);
}