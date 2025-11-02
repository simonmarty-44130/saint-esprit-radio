/**
 * StudiosCalendar Module
 * Gestion des calendriers des studios pour les bénévoles
 * Extension du système existant - AUCUNE modification de l'architecture
 */

class StudiosCalendar {
    constructor(app) {
        this.app = app;
        this.storage = app.storage; // RÉUTILISER le storage S3 existant
        this.studiosConfig = null;
        this.configKey = 'calendars/studios-config.json';
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        console.log('📅 Initialisation du module StudiosCalendar...');
        
        await this.loadStudiosConfig();
        this.renderCalendarsPanel();
        this.setupEventListeners();
        
        this.initialized = true;
        console.log('✅ StudiosCalendar initialisé');
    }

    async loadStudiosConfig() {
        try {
            // Utiliser le storage S3 existant pour charger la config
            const response = await this.storage.s3.getObject({
                Bucket: this.storage.config.bucket,
                Key: this.configKey
            }).promise();
            
            this.studiosConfig = JSON.parse(response.Body.toString());
            console.log('📅 Configuration studios chargée:', this.studiosConfig);
            
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                console.log('📝 Création de la configuration studios par défaut');
                this.studiosConfig = this.getDefaultStudiosConfig();
                await this.saveStudiosConfig();
            } else {
                console.error('❌ Erreur chargement config studios:', error);
                this.studiosConfig = this.getDefaultStudiosConfig();
            }
        }
    }

    async saveStudiosConfig() {
        try {
            await this.storage.s3.putObject({
                Bucket: this.storage.config.bucket,
                Key: this.configKey,
                Body: JSON.stringify(this.studiosConfig, null, 2),
                ContentType: 'application/json'
            }).promise();
            
            console.log('✅ Configuration studios sauvegardée');
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde config studios:', error);
            return false;
        }
    }

    getDefaultStudiosConfig() {
        return {
            studios: {
                "studio_production": {
                    name: "Studio Production",
                    calendarUrl: "https://calendar.google.com/calendar/embed?src=planningp1%40radio-fidelite.com&ctz=Europe%2FParis",
                    embedUrl: "https://calendar.google.com/calendar/embed?src=planningp1%40radio-fidelite.com&ctz=Europe%2FParis&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&height=400",
                    isActive: true,
                    color: "#4CAF50"
                },
                "grand_studio": {
                    name: "Grand Studio",
                    calendarUrl: "https://calendar.google.com/calendar/embed?src=planningdiff%40radio-fidelite.com&ctz=Europe%2FParis",
                    embedUrl: "https://calendar.google.com/calendar/embed?src=planningdiff%40radio-fidelite.com&ctz=Europe%2FParis&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&height=400",
                    isActive: true,
                    color: "#2196F3"
                }
            },
            lastUpdated: Date.now(),
            createdBy: this.app.storage.userId
        };
    }

    renderCalendarsPanel() {
        // Vérifier qu'on est bien en mode bénévole
        if (this.app.userRole !== 'volunteer') return;

        // Créer le panneau si pas déjà existant
        let panel = document.getElementById('studios-calendar-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'studios-calendar-panel';
            panel.className = 'studios-calendar-panel';
            
            // Insérer après le dashboard ou dans la section active
            const dashboardSection = document.getElementById('dashboard-section');
            if (dashboardSection) {
                dashboardSection.appendChild(panel);
            }
        }

        // Générer le contenu HTML
        panel.innerHTML = this.generateCalendarsPanelHTML();
    }

    generateCalendarsPanelHTML() {
        let html = `
            <h3>Calendriers des Studios</h3>
            <div class="studios-list">
        `;

        for (const [studioId, studio] of Object.entries(this.studiosConfig.studios)) {
            if (!studio.isActive) continue;

            html += `
                <div class="studio-calendar-item" data-studio-id="${studioId}">
                    <div class="studio-header">
                        <h4 style="color: ${studio.color}">
                            <span class="studio-icon">📻</span>
                            ${studio.name}
                        </h4>
                    </div>
                    <div class="studio-calendar-embed" id="calendar-${studioId}" style="display: block; margin-top: 10px;">
                        <iframe src="${studio.embedUrl}" 
                                style="border: 0; border-radius: 8px;" 
                                width="100%" 
                                height="600" 
                                frameborder="0" 
                                scrolling="no">
                        </iframe>
                    </div>
                    <div class="studio-actions">
                        <a href="${studio.calendarUrl}" 
                           target="_blank" 
                           class="calendar-link">
                            🔗 Ouvrir dans Google Calendar
                        </a>
                    </div>
                </div>
            `;
        }

        html += `
            </div>
        `;

        // Ajouter bouton de configuration pour les journalistes
        if (this.app.userRole === 'journalist') {
            html += `
                <div class="studios-admin-panel">
                    <button class="btn btn-secondary" onclick="app.studiosCalendar.openConfigModal()">
                        ⚙️ Configurer les studios
                    </button>
                </div>
            `;
        }

        return html;
    }

    setupEventListeners() {
        // Délégation d'événements pour les boutons toggle
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-toggle-calendar') || 
                e.target.closest('.btn-toggle-calendar')) {
                const button = e.target.closest('.btn-toggle-calendar');
                const studioId = button.dataset.studio;
                this.toggleCalendarView(studioId);
            }
        });
    }

    toggleCalendarView(studioId) {
        const calendarDiv = document.getElementById(`calendar-${studioId}`);
        const button = document.querySelector(`[data-studio="${studioId}"] .toggle-icon`);
        
        if (calendarDiv) {
            const isVisible = calendarDiv.style.display !== 'none';
            calendarDiv.style.display = isVisible ? 'none' : 'block';
            
            if (button) {
                button.textContent = isVisible ? '▼' : '▲';
            }
            
            // Animation smooth
            if (!isVisible) {
                calendarDiv.style.opacity = '0';
                setTimeout(() => {
                    calendarDiv.style.transition = 'opacity 0.3s ease';
                    calendarDiv.style.opacity = '1';
                }, 10);
            }
        }
    }

    openConfigModal() {
        // Configuration pour les journalistes uniquement
        if (this.app.userRole !== 'journalist') {
            showNotification('Accès réservé aux journalistes', 'warning');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚙️ Configuration des Studios</h3>
                    <button class="icon-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    ${this.generateConfigFormHTML()}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Annuler
                    </button>
                    <button class="btn btn-primary" onclick="app.studiosCalendar.saveConfigFromModal()">
                        💾 Enregistrer
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    generateConfigFormHTML() {
        let html = '<div class="studios-config-form">';
        
        for (const [studioId, studio] of Object.entries(this.studiosConfig.studios)) {
            html += `
                <div class="studio-config-item">
                    <h4>${studio.name}</h4>
                    <div class="form-group">
                        <label>Nom du studio</label>
                        <input type="text" 
                               id="studio-name-${studioId}" 
                               value="${studio.name}" 
                               class="form-control">
                    </div>
                    <div class="form-group">
                        <label>URL du calendrier</label>
                        <input type="url" 
                               id="studio-url-${studioId}" 
                               value="${studio.calendarUrl}" 
                               class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Couleur</label>
                        <input type="color" 
                               id="studio-color-${studioId}" 
                               value="${studio.color}" 
                               class="form-control">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" 
                                   id="studio-active-${studioId}" 
                                   ${studio.isActive ? 'checked' : ''}>
                            Studio actif
                        </label>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    async saveConfigFromModal() {
        // Récupérer les valeurs du formulaire
        for (const studioId in this.studiosConfig.studios) {
            const nameInput = document.getElementById(`studio-name-${studioId}`);
            const urlInput = document.getElementById(`studio-url-${studioId}`);
            const colorInput = document.getElementById(`studio-color-${studioId}`);
            const activeInput = document.getElementById(`studio-active-${studioId}`);
            
            if (nameInput) {
                this.studiosConfig.studios[studioId].name = nameInput.value;
            }
            if (urlInput) {
                this.studiosConfig.studios[studioId].calendarUrl = urlInput.value;
                // Générer l'URL embed à partir de l'URL du calendrier
                this.studiosConfig.studios[studioId].embedUrl = this.generateEmbedUrl(urlInput.value);
            }
            if (colorInput) {
                this.studiosConfig.studios[studioId].color = colorInput.value;
            }
            if (activeInput) {
                this.studiosConfig.studios[studioId].isActive = activeInput.checked;
            }
        }
        
        this.studiosConfig.lastUpdated = Date.now();
        this.studiosConfig.updatedBy = this.app.storage.userId;
        
        // Sauvegarder sur S3
        const saved = await this.saveStudiosConfig();
        
        if (saved) {
            showNotification('Configuration des studios sauvegardée', 'success');
            
            // Fermer la modal
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            // Rafraîchir l'affichage
            this.renderCalendarsPanel();
        } else {
            showNotification('Erreur lors de la sauvegarde', 'error');
        }
    }

    generateEmbedUrl(calendarUrl) {
        // Transformer l'URL standard en URL embed
        if (calendarUrl.includes('calendar.google.com')) {
            const baseUrl = calendarUrl.replace('/calendar/u/0/', '/calendar/');
            return `${baseUrl}&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&height=400`;
        }
        return calendarUrl;
    }

    // Méthode pour ajouter un nouveau studio (pour futures évolutions)
    async addStudio(studioData) {
        const studioId = `studio_${Date.now()}`;
        this.studiosConfig.studios[studioId] = {
            name: studioData.name || 'Nouveau Studio',
            calendarUrl: studioData.calendarUrl || '',
            embedUrl: this.generateEmbedUrl(studioData.calendarUrl || ''),
            isActive: true,
            color: studioData.color || '#9C27B0'
        };
        
        await this.saveStudiosConfig();
        this.renderCalendarsPanel();
    }

    // Méthode pour supprimer un studio
    async removeStudio(studioId) {
        if (confirm(`Supprimer le studio ${this.studiosConfig.studios[studioId].name} ?`)) {
            delete this.studiosConfig.studios[studioId];
            await this.saveStudiosConfig();
            this.renderCalendarsPanel();
        }
    }
}

// Export en global pour être accessible depuis app.js
window.StudiosCalendar = StudiosCalendar;