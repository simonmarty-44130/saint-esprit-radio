/**
 * EmissionEditor Module
 * Interface simplifiée pour créer et éditer des émissions (mode bénévole)
 * Extension du système existant - AUCUNE modification de l'architecture
 */

class EmissionEditor {
    constructor(app) {
        this.app = app;
        this.contentManager = app.newsManager; // Réutiliser le ContentManager existant
        this.storage = app.storage;
        this.currentEmission = null;
        this.initialized = false;
        this.wordsPerMinute = 140; // Vitesse de lecture moyenne pour calcul temps
        this.autoSaveTimer = null;
    }

    async init() {
        if (this.initialized) return;
        
        console.log('🎙️ Initialisation du module EmissionEditor...');
        
        // Créer l'interface si en mode bénévole
        if (this.app.userRole === 'volunteer') {
            this.renderEmissionPanel();
            this.setupEventListeners();
        }
        
        this.initialized = true;
        console.log('✅ EmissionEditor initialisé');
    }

    renderEmissionPanel() {
        // Créer le panneau des émissions dans le dashboard
        const dashboardSection = document.getElementById('dashboard-section');
        if (!dashboardSection) return;

        // Créer le conteneur pour les émissions
        let emissionPanel = document.getElementById('emission-panel');
        if (!emissionPanel) {
            emissionPanel = document.createElement('div');
            emissionPanel.id = 'emission-panel';
            emissionPanel.className = 'emission-creator-panel';
            dashboardSection.appendChild(emissionPanel);
        }

        emissionPanel.innerHTML = this.generateEmissionPanelHTML();
        
        // Charger la liste des émissions
        this.loadEmissionsList();
    }

    generateEmissionPanelHTML() {
        return `
            <h3>🎙️ Mes Émissions</h3>
            
            <div class="emission-toolbar">
                <button class="btn-create-emission" onclick="app.emissionEditor.showCreateForm()">
                    Nouvelle Émission
                </button>
                <button class="btn btn-secondary" onclick="app.emissionEditor.loadEmissionsList()">
                    🔄 Rafraîchir
                </button>
            </div>
            
            <div id="emissions-list" class="emissions-list">
                <!-- Liste des émissions chargée dynamiquement -->
            </div>
            
            <div id="emission-form-container" style="display: none;">
                <!-- Formulaire de création/édition -->
            </div>
        `;
    }

    async loadEmissionsList() {
        // Vérifier si la méthode existe, sinon utiliser un filtre direct
        let emissions = [];
        if (this.contentManager.getEmissions) {
            emissions = this.contentManager.getEmissions();
        } else if (this.contentManager.database) {
            emissions = this.contentManager.database.filter(item => item.type === 'emission');
        }
        
        const listContainer = document.getElementById('emissions-list');
        
        if (!listContainer) return;
        
        if (emissions.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>Aucune émission créée</p>
                    <p class="text-secondary">Cliquez sur "Nouvelle Émission" pour commencer</p>
                </div>
            `;
            return;
        }
        
        // Trier par date décroissante
        emissions.sort((a, b) => b.createdAt - a.createdAt);
        
        listContainer.innerHTML = emissions.map(emission => `
            <div class="emission-item" data-emission-id="${emission.id}">
                <div class="emission-item-header">
                    <h4>${emission.title}</h4>
                    <span class="emission-status status-${emission.status}">${emission.status}</span>
                </div>
                <div class="emission-item-meta">
                    <span>📅 ${emission.emissionData.date}</span>
                    <span>⏰ ${emission.emissionData.timeSlot}</span>
                    <span>📻 ${emission.emissionData.studio}</span>
                    <span>⏱️ ${emission.duration}</span>
                </div>
                <div class="emission-item-actions">
                    <button class="btn btn-small" onclick="app.emissionEditor.editEmission(${emission.id})">
                        ✏️ Éditer
                    </button>
                    <button class="btn btn-small" onclick="app.emissionEditor.selectAndExportEmail(${emission.id})" title="Envoyer par email">
                        📧
                    </button>
                    <button class="btn btn-small" onclick="app.emissionEditor.selectAndExportDownload(${emission.id})" title="Télécharger">
                        💾
                    </button>
                    <button class="btn btn-small" onclick="app.emissionEditor.selectAndExportPrint(${emission.id})" title="Imprimer">
                        🖨️
                    </button>
                    <button class="btn btn-small btn-danger" onclick="app.emissionEditor.deleteEmission(${emission.id})">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    showCreateForm() {
        const formContainer = document.getElementById('emission-form-container');
        if (!formContainer) return;
        
        formContainer.style.display = 'block';
        formContainer.innerHTML = this.generateEmissionFormHTML();
        
        // Masquer la liste
        const listContainer = document.getElementById('emissions-list');
        if (listContainer) listContainer.style.display = 'none';
        
        // Focus sur le premier champ
        setTimeout(() => {
            const titleInput = document.getElementById('emission-title');
            if (titleInput) titleInput.focus();
        }, 100);
    }

    generateEmissionFormHTML(emission = null) {
        const isEdit = emission !== null;
        const today = new Date().toISOString().split('T')[0];
        
        return `
            <div class="emission-form">
                <h3>${isEdit ? '✏️ Éditer' : '➕ Nouvelle'} Émission</h3>
                
                <div class="emission-form-group">
                    <label for="emission-title">Titre de l'émission</label>
                    <input type="text" 
                           id="emission-title" 
                           value="${emission?.title || ''}" 
                           placeholder="Ex: Après-midi Musical"
                           class="form-control">
                </div>
                
                <div class="emission-form-row">
                    <div class="emission-form-group">
                        <label for="emission-date">Date</label>
                        <input type="date" 
                               id="emission-date" 
                               value="${emission?.emissionData?.date || today}"
                               class="form-control">
                    </div>
                    
                    <div class="emission-form-group">
                        <label for="emission-time">Heure</label>
                        <select id="emission-time" class="form-control">
                            ${this.generateTimeOptions(emission?.emissionData?.timeSlot)}
                        </select>
                    </div>
                </div>
                
                <div class="emission-form-group">
                    <label for="emission-studio">Studio</label>
                    <select id="emission-studio" class="form-control">
                        <option value="Grand Studio" ${emission?.emissionData?.studio === 'Grand Studio' ? 'selected' : ''}>
                            Grand Studio (Diffusion)
                        </option>
                        <option value="Studio Production" ${emission?.emissionData?.studio === 'Studio Production' ? 'selected' : ''}>
                            Studio Production
                        </option>
                    </select>
                </div>
                
                <div class="emission-form-group">
                    <label for="emission-description">
                        📝 Contenu de votre émission
                        <span style="font-size: 0.9em; color: #666; margin-left: 10px;">
                            (Vitesse de lecture : 140 mots/minute)
                        </span>
                    </label>
                    <textarea id="emission-description" 
                              placeholder="Écrivez ici le texte complet de votre émission. Le temps de lecture sera calculé automatiquement..."
                              rows="15"
                              class="form-control"
                              style="font-size: 16px; line-height: 1.6; font-family: 'Georgia', serif; background: #f9f9f9; border: 2px solid #4CAF50; padding: 15px;"
                              oninput="app.emissionEditor.updateReadingTimeDisplay()">${emission?.content || ''}</textarea>
                    <div id="reading-time-display" style="margin-top: 10px;"></div>
                </div>
                
                ${isEdit ? this.generateMusicSection(emission) : ''}
                
                <div class="emission-form-group">
                    <label for="emission-notes">Notes pour l'animateur</label>
                    <textarea id="emission-notes" 
                              placeholder="Notes, rappels, informations importantes..."
                              rows="3"
                              class="form-control">${emission?.emissionData?.notes || ''}</textarea>
                </div>
                
                <div class="emission-form-actions" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <button class="btn btn-secondary" onclick="app.emissionEditor.cancelForm()">
                            Annuler
                        </button>
                        <button class="btn btn-success" onclick="app.emissionEditor.saveEmission(${emission?.id || 'null'})">
                            💾 ${isEdit ? 'Mettre à jour' : 'Créer l\'émission'}
                        </button>
                    </div>
                    ${isEdit ? `
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-info" onclick="app.emissionEditor.exportEmail()" title="Envoyer par email">
                                📧 Email
                            </button>
                            <button class="btn btn-info" onclick="app.emissionEditor.exportDownload()" title="Télécharger">
                                💾 Télécharger
                            </button>
                            <button class="btn btn-info" onclick="app.emissionEditor.exportPrint()" title="Imprimer">
                                🖨️ Imprimer
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    generateTimeOptions(selectedTime = '14:00') {
        const times = [];
        for (let hour = 6; hour <= 22; hour++) {
            for (let min = 0; min < 60; min += 30) {
                const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                const selected = time === selectedTime ? 'selected' : '';
                times.push(`<option value="${time}" ${selected}>${time}</option>`);
            }
        }
        return times.join('');
    }

    generateMusicSection(emission) {
        const musics = emission?.emissionData?.musics || [];
        
        return `
            <div class="emission-music-section">
                <h4>🎵 Playlist (${musics.length} titres)</h4>
                <div class="emission-music-list" id="emission-music-list">
                    ${musics.length > 0 ? musics.map((music, index) => `
                        <div class="emission-music-item">
                            <div class="music-info">
                                <span class="music-icon">🎵</span>
                                <span class="music-title">${music.title}</span>
                                <span class="music-duration">${music.duration || '0:00'}</span>
                            </div>
                            <button class="btn-remove" onclick="app.emissionEditor.removeMusic(${index})">
                                ✕
                            </button>
                        </div>
                    `).join('') : '<p class="empty-state">Aucune musique ajoutée</p>'}
                </div>
                <button class="btn btn-primary" onclick="app.emissionEditor.showMusicSelector()">
                    ➕ Ajouter une musique
                </button>
            </div>
        `;
    }

    async saveEmission(emissionId = null) {
        // Récupérer les valeurs du formulaire
        const title = document.getElementById('emission-title')?.value?.trim();
        const date = document.getElementById('emission-date')?.value;
        const timeSlot = document.getElementById('emission-time')?.value;
        const studio = document.getElementById('emission-studio')?.value;
        const description = document.getElementById('emission-description')?.value?.trim();
        const notes = document.getElementById('emission-notes')?.value?.trim();
        
        if (!title) {
            showNotification('Le titre est obligatoire', 'error');
            return;
        }
        
        const emissionData = {
            title,
            date,
            timeSlot,
            studio,
            description,
            notes
        };
        
        let result;
        if (emissionId) {
            // Mise à jour
            result = await this.contentManager.updateEmission(emissionId, {
                title,
                content: description,
                emissionData: {
                    date,
                    timeSlot,
                    studio,
                    notes
                }
            });
        } else {
            // Création
            result = await this.contentManager.createEmission(emissionData);
        }
        
        if (result) {
            this.cancelForm();
            await this.loadEmissionsList();
        }
    }

    async editEmission(emissionId) {
        const emission = this.contentManager.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        
        if (!emission) {
            showNotification('Émission introuvable', 'error');
            return;
        }
        
        this.currentEmission = emission;
        
        const formContainer = document.getElementById('emission-form-container');
        if (!formContainer) return;
        
        formContainer.style.display = 'block';
        formContainer.innerHTML = this.generateEmissionFormHTML(emission);
        
        // Masquer la liste
        const listContainer = document.getElementById('emissions-list');
        if (listContainer) listContainer.style.display = 'none';
    }

    async deleteEmission(emissionId) {
        if (!confirm('Supprimer cette émission ?')) return;
        
        const index = this.contentManager.database.findIndex(item => 
            item.type === 'emission' && item.id === emissionId
        );
        
        if (index !== -1) {
            this.contentManager.database.splice(index, 1);
            await this.contentManager.setDatabase(this.contentManager.database);
            showNotification('Émission supprimée', 'success');
            await this.loadEmissionsList();
        }
    }

    async exportEmission(emissionId) {
        const result = await this.contentManager.exportEmissionForBroadcast(emissionId);
        if (result) {
            showNotification('Émission exportée avec succès', 'success');
        }
    }

    cancelForm() {
        const formContainer = document.getElementById('emission-form-container');
        if (formContainer) {
            formContainer.style.display = 'none';
            formContainer.innerHTML = '';
        }
        
        const listContainer = document.getElementById('emissions-list');
        if (listContainer) {
            listContainer.style.display = 'block';
        }
        
        this.currentEmission = null;
    }

    showMusicSelector() {
        // Interface simplifiée pour sélectionner des musiques
        // Cette fonctionnalité pourrait être étendue pour intégrer avec AudioManager
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🎵 Ajouter une musique</h3>
                    <button class="icon-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Titre</label>
                        <input type="text" id="music-title" class="form-control" placeholder="Titre de la musique">
                    </div>
                    <div class="form-group">
                        <label>Artiste</label>
                        <input type="text" id="music-artist" class="form-control" placeholder="Nom de l'artiste">
                    </div>
                    <div class="form-group">
                        <label>Durée</label>
                        <input type="text" id="music-duration" class="form-control" placeholder="3:45" pattern="[0-9]{1,2}:[0-9]{2}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Annuler
                    </button>
                    <button class="btn btn-primary" onclick="app.emissionEditor.addMusicFromModal()">
                        Ajouter
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus sur le premier champ
        setTimeout(() => {
            const titleInput = document.getElementById('music-title');
            if (titleInput) titleInput.focus();
        }, 100);
    }

    async addMusicFromModal() {
        const title = document.getElementById('music-title')?.value?.trim();
        const artist = document.getElementById('music-artist')?.value?.trim();
        const duration = document.getElementById('music-duration')?.value?.trim();
        
        if (!title) {
            showNotification('Le titre est obligatoire', 'error');
            return;
        }
        
        const musicData = {
            title,
            artist,
            duration: duration || '3:00'
        };
        
        if (this.currentEmission) {
            await this.contentManager.addMusicToEmission(this.currentEmission.id, musicData);
            
            // Rafraîchir l'affichage
            this.editEmission(this.currentEmission.id);
        }
        
        // Fermer la modal
        const modal = document.querySelector('.modal.active');
        if (modal) modal.remove();
    }

    async removeMusic(musicIndex) {
        if (!this.currentEmission) return;
        
        await this.contentManager.removeMusicFromEmission(this.currentEmission.id, musicIndex);
        
        // Rafraîchir l'affichage
        this.editEmission(this.currentEmission.id);
    }

    setupEventListeners() {
        // Gestion des raccourcis clavier
        document.addEventListener('keydown', (e) => {
            if (this.app.userRole !== 'volunteer') return;
            
            // Ctrl/Cmd + E pour nouvelle émission
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.showCreateForm();
            }
            
            // Escape pour fermer le formulaire
            if (e.key === 'Escape') {
                const formContainer = document.getElementById('emission-form-container');
                if (formContainer && formContainer.style.display !== 'none') {
                    this.cancelForm();
                }
            }
        });
    }
    
    // ========== NOUVELLES MÉTHODES : CALCUL TEMPS & EXPORTS ==========
    
    /**
     * Calculer le temps de lecture du texte
     * @param {string} text - Le texte de l'émission
     * @returns {object} - Temps en minutes, secondes et total
     */
    calculateReadingTime(text) {
        if (!text) return { minutes: 0, seconds: 0, totalSeconds: 0, words: 0 };
        
        // Compter les mots (séparer par espaces et filtrer les vides)
        const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        
        // Calculer le temps en secondes (140 mots/minute)
        const totalSeconds = Math.ceil((words / this.wordsPerMinute) * 60);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return {
            minutes,
            seconds,
            totalSeconds,
            words,
            formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`
        };
    }
    
    /**
     * Mettre à jour l'affichage du temps de lecture en temps réel
     */
    updateReadingTimeDisplay() {
        const descriptionEl = document.getElementById('emission-description');
        if (!descriptionEl) return;
        
        const timeInfo = this.calculateReadingTime(descriptionEl.value);
        
        // Ajouter ou mettre à jour l'affichage du temps
        let timeDisplay = document.getElementById('reading-time-display');
        if (!timeDisplay) {
            timeDisplay = document.createElement('div');
            timeDisplay.id = 'reading-time-display';
            timeDisplay.style.cssText = `
                margin-top: 5px;
                font-size: 12px;
                color: #666;
            `;
            descriptionEl.parentElement.appendChild(timeDisplay);
        }
        
        // Calculer le temps total avec les musiques
        const musicsDuration = this.getTotalMusicDuration();
        const totalSeconds = timeInfo.totalSeconds + musicsDuration;
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalSecs = totalSeconds % 60;
        
        // Choisir la couleur selon le temps total
        let color = '#4CAF50'; // Vert par défaut
        if (totalMinutes >= 28) {
            color = '#f44336'; // Rouge si >= 28 min
        } else if (totalMinutes >= 25) {
            color = '#ff9800'; // Orange si >= 25 min
        }
        
        timeDisplay.innerHTML = `
            📝 <strong>${timeInfo.words} mots</strong> • 
            ⏱️ Temps de lecture: <strong>${timeInfo.formatted}</strong> • 
            🎵 Musiques: <strong>${this.formatTime(musicsDuration)}</strong> • 
            <span style="color: ${color}; font-weight: bold;">
                Total: ${totalMinutes}:${totalSecs.toString().padStart(2, '0')}
            </span>
            ${totalMinutes >= 28 ? ' ⚠️ Dépassement 28 min!' : ''}
        `;
    }
    
    /**
     * Obtenir la durée totale des musiques
     */
    getTotalMusicDuration() {
        if (!this.currentEmission || !this.currentEmission.emissionData?.musics) return 0;
        
        return this.currentEmission.emissionData.musics.reduce((total, music) => {
            if (music.duration) {
                const parts = music.duration.split(':');
                const minutes = parseInt(parts[0]) || 0;
                const seconds = parseInt(parts[1]) || 0;
                return total + (minutes * 60 + seconds);
            }
            return total;
        }, 0);
    }
    
    /**
     * Formater les secondes en MM:SS
     */
    formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Méthodes pour sélectionner et exporter depuis la liste
     */
    selectAndExportEmail(emissionId) {
        this.currentEmission = this.contentManager.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        if (this.currentEmission) {
            this.exportEmail();
        }
    }
    
    selectAndExportDownload(emissionId) {
        this.currentEmission = this.contentManager.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        if (this.currentEmission) {
            this.exportDownload();
        }
    }
    
    selectAndExportPrint(emissionId) {
        this.currentEmission = this.contentManager.database.find(item => 
            item.type === 'emission' && item.id === emissionId
        );
        if (this.currentEmission) {
            this.exportPrint();
        }
    }
    
    /**
     * Export par email
     */
    exportEmail() {
        if (!this.currentEmission) {
            showNotification('Aucune émission à exporter', 'error');
            return;
        }
        
        const emission = this.currentEmission;
        const readingTime = this.calculateReadingTime(emission.content);
        const musicsDuration = this.getTotalMusicDuration();
        const totalSeconds = readingTime.totalSeconds + musicsDuration;
        
        const subject = `Émission: ${emission.title}`;
        
        const musicsText = emission.emissionData?.musics?.map(m => 
            `  - ${m.title} par ${m.artist || 'Artiste inconnu'} (${m.duration || '0:00'})`
        ).join('\n') || '  Aucune musique';
        
        const body = `ÉMISSION RADIO
================================

Titre: ${emission.title}
Auteur: ${emission.author}
Date: ${emission.emissionData?.date || new Date().toISOString().split('T')[0]}
Créneau: ${emission.emissionData?.timeSlot || 'Non défini'}
Studio: ${emission.emissionData?.studio || 'Non défini'}

DURÉES
--------------------------------
Texte: ${readingTime.formatted} (${readingTime.words} mots)
Musiques: ${this.formatTime(musicsDuration)}
TOTAL: ${this.formatTime(totalSeconds)}

PLAYLIST
--------------------------------
${musicsText}

CONTENU
================================
${emission.content || 'Aucun contenu'}

NOTES
--------------------------------
${emission.emissionData?.notes || 'Aucune note'}

================================
Généré par Saint-Esprit AWS
${new Date().toLocaleString('fr-FR')}`;
        
        // Ouvrir le client mail avec le contenu pré-rempli
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_self');
    }
    
    /**
     * Export en téléchargement (fichier texte)
     */
    exportDownload() {
        if (!this.currentEmission) {
            showNotification('Aucune émission à exporter', 'error');
            return;
        }
        
        const emission = this.currentEmission;
        const readingTime = this.calculateReadingTime(emission.content);
        const musicsDuration = this.getTotalMusicDuration();
        const totalSeconds = readingTime.totalSeconds + musicsDuration;
        
        const musicsText = emission.emissionData?.musics?.map(m => 
            `  - ${m.title} par ${m.artist || 'Artiste inconnu'} (${m.duration || '0:00'})`
        ).join('\n') || '  Aucune musique';
        
        const content = `ÉMISSION RADIO
================================

Titre: ${emission.title}
Auteur: ${emission.author}
Date: ${emission.emissionData?.date || new Date().toISOString().split('T')[0]}
Créneau: ${emission.emissionData?.timeSlot || 'Non défini'}
Studio: ${emission.emissionData?.studio || 'Non défini'}

DURÉES
--------------------------------
Texte: ${readingTime.formatted} (${readingTime.words} mots)
Musiques: ${this.formatTime(musicsDuration)}
TOTAL: ${this.formatTime(totalSeconds)}

PLAYLIST
--------------------------------
${musicsText}

CONTENU
================================
${emission.content || 'Aucun contenu'}

NOTES
--------------------------------
${emission.emissionData?.notes || 'Aucune note'}

================================
Généré par Saint-Esprit AWS
${new Date().toLocaleString('fr-FR')}`;
        
        // Créer le blob et télécharger
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emission_${emission.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Émission téléchargée', 'success');
    }
    
    /**
     * Export pour impression
     */
    exportPrint() {
        if (!this.currentEmission) {
            showNotification('Aucune émission à imprimer', 'error');
            return;
        }
        
        const emission = this.currentEmission;
        const readingTime = this.calculateReadingTime(emission.content);
        const musicsDuration = this.getTotalMusicDuration();
        const totalSeconds = readingTime.totalSeconds + musicsDuration;
        
        const musicsHtml = emission.emissionData?.musics?.map(m => 
            `<li>${m.title} par ${m.artist || 'Artiste inconnu'} (${m.duration || '0:00'})</li>`
        ).join('') || '<li>Aucune musique</li>';
        
        // Créer une fenêtre d'impression
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>${emission.title}</title>
                <style>
                    @page { margin: 2cm; }
                    body { 
                        font-family: 'Georgia', serif; 
                        line-height: 1.6;
                        max-width: 800px;
                        margin: 0 auto;
                        color: #333;
                    }
                    h1 { 
                        color: #4CAF50; 
                        border-bottom: 3px solid #4CAF50;
                        padding-bottom: 10px;
                    }
                    h2 { 
                        color: #333;
                        margin-top: 30px;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 5px;
                    }
                    .meta {
                        background: #f5f5f5;
                        padding: 15px;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                    .meta-row {
                        display: flex;
                        justify-content: space-between;
                        margin: 5px 0;
                    }
                    .durations {
                        background: #e8f5e9;
                        padding: 15px;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                    .content {
                        margin: 30px 0;
                        white-space: pre-wrap;
                    }
                    .playlist {
                        background: #fff3e0;
                        padding: 15px;
                        border-radius: 5px;
                    }
                    ul { margin: 10px 0; }
                    .footer {
                        margin-top: 50px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        text-align: center;
                        color: #666;
                        font-size: 12px;
                    }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>📻 ${emission.title}</h1>
                
                <div class="meta">
                    <div class="meta-row">
                        <strong>Auteur:</strong> ${emission.author}
                    </div>
                    <div class="meta-row">
                        <strong>Date:</strong> ${emission.emissionData?.date || new Date().toISOString().split('T')[0]}
                    </div>
                    <div class="meta-row">
                        <strong>Créneau:</strong> ${emission.emissionData?.timeSlot || 'Non défini'}
                    </div>
                    <div class="meta-row">
                        <strong>Studio:</strong> ${emission.emissionData?.studio || 'Non défini'}
                    </div>
                </div>
                
                <div class="durations">
                    <h3>⏱️ Durées</h3>
                    <div>📝 Texte: <strong>${readingTime.formatted}</strong> (${readingTime.words} mots)</div>
                    <div>🎵 Musiques: <strong>${this.formatTime(musicsDuration)}</strong></div>
                    <div style="font-size: 1.2em; margin-top: 10px;">
                        Total: <strong>${this.formatTime(totalSeconds)}</strong>
                        ${totalSeconds > 28*60 ? '<span style="color: red;"> ⚠️ Dépassement!</span>' : ''}
                    </div>
                </div>
                
                ${emission.emissionData?.musics?.length > 0 ? `
                    <div class="playlist">
                        <h2>🎵 Playlist</h2>
                        <ul>${musicsHtml}</ul>
                    </div>
                ` : ''}
                
                <h2>📝 Contenu</h2>
                <div class="content">${emission.content || 'Aucun contenu'}</div>
                
                ${emission.emissionData?.notes ? `
                    <h2>📌 Notes</h2>
                    <div class="content">${emission.emissionData.notes}</div>
                ` : ''}
                
                <div class="footer">
                    Saint-Esprit AWS - Émission générée le ${new Date().toLocaleString('fr-FR')}
                </div>
                
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `);
        
        printWindow.document.close();
    }
}

// Export en global pour être accessible depuis app.js
window.EmissionEditor = EmissionEditor;