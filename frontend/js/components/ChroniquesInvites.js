class ChroniquesInvites {
    constructor() {
        this.chroniques = [];
        this.currentUser = null;
        this.tableName = 'saint-esprit-chroniques';
        this.bucketName = 'saint-esprit-audio';
        this.isAdmin = false;
    }

    async init() {
        // Attendre que AWS soit configuré
        if (!window.AWS) {
            console.warn('AWS SDK non chargé, attente...');
            setTimeout(() => this.init(), 500);
            return;
        }
        
        // S'assurer que la configuration AWS est appliquée
        if (!AWS.config.region) {
            AWS.config.update({ 
                region: 'eu-west-3',
                credentials: window.app?.storage?.credentials
            });
        }
        
        this.currentUser = await this.getCurrentUser();
        this.isAdmin = this.currentUser && (this.currentUser.isAdmin || this.currentUser.sub);
        
        await this.loadChroniques();
        this.render();
        this.setupEventListeners();
    }

    async getCurrentUser() {
        try {
            // Utiliser le authManager global de l'application
            if (window.authManager && window.authManager.currentUser) {
                const user = window.authManager.currentUser;
                return {
                    username: user.username || user.email,
                    email: user.email,
                    sub: user.sub,
                    isAdmin: user.isAdmin || false,
                    groups: user.groups || []
                };
            }
            
            // Fallback: récupérer depuis localStorage
            const userStr = localStorage.getItem('saint-esprit-user');
            if (userStr) {
                try {
                    // Essayer de parser comme JSON
                    const user = JSON.parse(userStr);
                    return {
                        username: user.username || user.email,
                        email: user.email,
                        sub: user.sub,
                        isAdmin: user.isAdmin || false,
                        groups: user.groups || []
                    };
                } catch (e) {
                    // Si ce n'est pas du JSON, c'est probablement juste le nom
                    const userName = userStr;
                    const userEmail = localStorage.getItem('saint-esprit-user-email');
                    const userFullName = localStorage.getItem('saint-esprit-user-fullname');
                    
                    return {
                        username: userName,
                        email: userEmail || '',
                        sub: localStorage.getItem('saint-esprit-user-sub') || '',
                        isAdmin: localStorage.getItem('saint-esprit-user-role') === 'admin',
                        groups: []
                    };
                }
            }
            
            // Dernier recours: utiliser les infos séparées dans localStorage
            const userName = localStorage.getItem('saint-esprit-user-name');
            const userEmail = localStorage.getItem('saint-esprit-user-email');
            if (userName || userEmail) {
                return {
                    username: userName || userEmail,
                    email: userEmail || '',
                    sub: localStorage.getItem('saint-esprit-user-sub') || '',
                    isAdmin: localStorage.getItem('saint-esprit-user-role') === 'admin',
                    groups: []
                };
            }
            
            return null;
        } catch (error) {
            console.error('Erreur authentification:', error);
            return null;
        }
    }

    async loadChroniques() {
        try {
            // Utiliser le storage manager de l'application
            if (window.app && window.app.storage) {
                // Utiliser directement DynamoDB via le storage
                const params = {
                    TableName: this.tableName
                };
                
                if (window.app.storage.docClient) {
                    const result = await window.app.storage.docClient.scan(params).promise();
                    this.chroniques = result.Items || [];
                } else {
                    // Fallback: appel direct à DynamoDB
                    const docClient = new AWS.DynamoDB.DocumentClient({ region: 'eu-west-3' });
                    const result = await docClient.scan(params).promise();
                    this.chroniques = result.Items || [];
                }
            } else {
                // Initialiser DynamoDB si nécessaire
                if (!window.AWS) {
                    console.error('AWS SDK non chargé');
                    this.chroniques = [];
                    return;
                }
                
                AWS.config.update({ region: 'eu-west-3' });
                const docClient = new AWS.DynamoDB.DocumentClient();
                const params = {
                    TableName: this.tableName
                };
                const result = await docClient.scan(params).promise();
                this.chroniques = result.Items || [];
            }
            
            // Trier par ordre alphabétique
            this.chroniques.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            
            console.log(`${this.chroniques.length} chroniques chargées`);
        } catch (error) {
            console.error('Erreur chargement chroniques:', error);
            this.chroniques = [];
        }
    }

    render() {
        const container = document.getElementById('chroniques-invites-content');
        if (!container) return;

        container.innerHTML = `
            <div class="chroniques-header">
                <h2><i class="fas fa-microphone"></i> Chroniques et Invités</h2>
                ${this.isAdmin ? `
                    <button class="btn btn-primary" onclick="window.chroniquesInvites.showAddForm()">
                        <i class="fas fa-plus"></i> Nouvelle chronique
                    </button>
                ` : ''}
            </div>

            <div class="chroniques-description">
                <p>Fiches permanentes des chroniques récurrentes. Les sons sont remplacés automatiquement à chaque mise à jour.</p>
            </div>

            <div id="chroniques-list" class="chroniques-grid">
                ${this.renderChroniques()}
            </div>

            <div id="chronique-form-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <span class="close" onclick="window.chroniquesInvites.hideForm()">&times;</span>
                    <h3 id="form-title">Nouvelle chronique</h3>
                    <form id="chronique-form">
                        <div class="form-group">
                            <label for="chronique-title">Titre de la chronique</label>
                            <input type="text" id="chronique-title" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="chronique-type">Type de source</label>
                            <select id="chronique-type" required>
                                <option value="manual">Manuel</option>
                                <option value="rss">Flux RSS</option>
                                <option value="ftp">Serveur FTP</option>
                            </select>
                        </div>
                        
                        <div class="form-group" id="source-url-group" style="display: none;">
                            <label for="chronique-source">URL de la source</label>
                            <input type="url" id="chronique-source" placeholder="https://...">
                        </div>
                        
                        <div class="form-group">
                            <label for="chronique-description">Description</label>
                            <textarea id="chronique-description" rows="3"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="chronique-audio">Fichier audio (MP3)</label>
                            <input type="file" id="chronique-audio" accept="audio/mp3,audio/mpeg">
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> Enregistrer
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="window.chroniquesInvites.hideForm()">
                                Annuler
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    renderChroniques() {
        if (this.chroniques.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-microphone-slash"></i>
                    <p>Aucune chronique disponible</p>
                </div>
            `;
        }

        return this.chroniques.map(chronique => {
            const freshness = this.getFreshness(chronique.lastUpdated);
            const freshnessClass = freshness.hours < 24 ? 'fresh' : (freshness.hours < 72 ? 'warning' : 'old');
            
            return `
                <div class="chronique-card" data-id="${chronique.id}">
                    <div class="chronique-header">
                        <h3>${chronique.title || 'Sans titre'}</h3>
                        <span class="chronique-type ${chronique.type || 'manual'}">
                            ${this.getTypeLabel(chronique.type)}
                        </span>
                    </div>
                    
                    <div class="chronique-body">
                        ${chronique.description ? `<p>${chronique.description}</p>` : ''}
                        
                        <div class="chronique-info">
                            <span class="duration">
                                <i class="fas fa-clock"></i> 
                                ${this.formatDuration(chronique.duration || 0)}
                            </span>
                            <span class="freshness ${freshnessClass}">
                                <i class="fas fa-sync-alt"></i>
                                ${freshness.label}
                            </span>
                        </div>
                    </div>
                    
                    <div class="chronique-actions">
                        <button class="btn btn-sm btn-secondary" onclick="window.chroniquesInvites.playAudio('${chronique.id}')">
                            <i class="fas fa-play"></i> Écouter
                        </button>
                        
                        ${window.conductorManager ? `
                            <button class="btn btn-sm btn-primary" onclick="window.chroniquesInvites.addToConductor('${chronique.id}')">
                                <i class="fas fa-plus"></i> Conducteur
                            </button>
                        ` : ''}
                        
                        ${this.isAdmin ? `
                            <button class="btn btn-sm btn-warning" onclick="window.chroniquesInvites.editChronique('${chronique.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    getTypeLabel(type) {
        const labels = {
            'manual': 'Manuel',
            'rss': 'RSS',
            'ftp': 'FTP'
        };
        return labels[type] || 'Manuel';
    }

    getFreshness(lastUpdated) {
        if (!lastUpdated) {
            return { hours: 999, label: 'Jamais mis à jour' };
        }

        const now = new Date();
        const updated = new Date(lastUpdated);
        const hours = Math.floor((now - updated) / (1000 * 60 * 60));

        if (hours < 1) {
            return { hours, label: 'À jour' };
        } else if (hours < 24) {
            return { hours, label: `Il y a ${hours}h` };
        } else {
            const days = Math.floor(hours / 24);
            return { hours, label: `Il y a ${days} jour${days > 1 ? 's' : ''}` };
        }
    }

    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    setupEventListeners() {
        const form = document.getElementById('chronique-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        const typeSelect = document.getElementById('chronique-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                const sourceGroup = document.getElementById('source-url-group');
                if (sourceGroup) {
                    sourceGroup.style.display = e.target.value !== 'manual' ? 'block' : 'none';
                }
            });
        }
    }

    showAddForm() {
        const modal = document.getElementById('chronique-form-modal');
        const title = document.getElementById('form-title');
        
        if (modal && title) {
            title.textContent = 'Nouvelle chronique';
            document.getElementById('chronique-form').reset();
            modal.style.display = 'block';
        }
    }

    hideForm() {
        const modal = document.getElementById('chronique-form-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('chronique-title').value;
        const type = document.getElementById('chronique-type').value;
        const sourceUrl = document.getElementById('chronique-source').value;
        const description = document.getElementById('chronique-description').value;
        const audioFile = document.getElementById('chronique-audio').files[0];

        if (!title) {
            alert('Le titre est obligatoire');
            return;
        }

        try {
            let audioUrl = null;
            let duration = 0;

            // Upload audio si fourni
            if (audioFile) {
                const uploadResult = await this.uploadAudio(audioFile);
                audioUrl = uploadResult.url;
                duration = uploadResult.duration;
            }

            // Créer l'objet chronique
            const chronique = {
                id: `chronique-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: title,
                type: type,
                sourceUrl: sourceUrl || null,
                description: description,
                audioUrl: audioUrl,
                duration: duration,
                lastUpdated: new Date().toISOString(),
                permanent: true,
                autoReplace: type !== 'manual',
                createdBy: this.currentUser.username,
                createdAt: new Date().toISOString()
            };

            // Sauvegarder dans DynamoDB
            await this.saveChronique(chronique);
            
            // Recharger et afficher
            await this.loadChroniques();
            this.render();
            this.hideForm();
            
            this.showNotification('Chronique créée avec succès', 'success');
        } catch (error) {
            console.error('Erreur création chronique:', error);
            this.showNotification('Erreur lors de la création', 'error');
        }
    }

    async uploadAudio(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const blob = new Blob([arrayBuffer], { type: file.type });
                    
                    // Créer un nom de fichier unique
                    const fileName = `chroniques/${Date.now()}-${file.name}`;
                    
                    // Upload vers S3
                    let s3Client;
                    if (window.app && window.app.storage && window.app.storage.s3) {
                        s3Client = window.app.storage.s3;
                    } else {
                        AWS.config.update({ region: 'eu-west-3' });
                        s3Client = new AWS.S3();
                    }
                    
                    const params = {
                        Bucket: this.bucketName,
                        Key: fileName,
                        Body: blob,
                        ContentType: file.type
                    };
                    
                    const result = await s3Client.upload(params).promise();
                    
                    // Calculer la durée avec l'API Web Audio
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const duration = Math.round(audioBuffer.duration);
                    
                    resolve({
                        url: result.Location,
                        duration: duration
                    });
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async saveChronique(chronique) {
        try {
            let docClient;
            
            if (window.app && window.app.storage && window.app.storage.docClient) {
                docClient = window.app.storage.docClient;
            } else {
                AWS.config.update({ region: 'eu-west-3' });
                docClient = new AWS.DynamoDB.DocumentClient();
            }
            
            const params = {
                TableName: this.tableName,
                Item: chronique
            };
            
            await docClient.put(params).promise();
        } catch (error) {
            console.error('Erreur sauvegarde chronique:', error);
            throw error;
        }
    }

    async playAudio(chroniqueId) {
        const chronique = this.chroniques.find(c => c.id === chroniqueId);
        if (!chronique || !chronique.audioUrl) {
            this.showNotification('Aucun audio disponible', 'warning');
            return;
        }

        // Utiliser le player audio global si disponible
        if (window.audioManager) {
            window.audioManager.loadAndPlay(chronique.audioUrl, chronique.title);
        } else {
            // Fallback: ouvrir dans un nouvel onglet
            window.open(chronique.audioUrl, '_blank');
        }
    }

    async addToConductor(chroniqueId) {
        const chronique = this.chroniques.find(c => c.id === chroniqueId);
        if (!chronique) return;

        if (!window.conductorManager) {
            this.showNotification('Le conducteur n\'est pas disponible', 'error');
            return;
        }

        const element = {
            id: `element-${Date.now()}`,
            type: 'chronique',
            title: chronique.title,
            duration: chronique.duration || 0,
            audioUrl: chronique.audioUrl,
            source: 'chroniques',
            sourceId: chronique.id
        };

        try {
            await window.conductorManager.addElement(element);
            this.showNotification('Ajouté au conducteur', 'success');
        } catch (error) {
            console.error('Erreur ajout conducteur:', error);
            this.showNotification('Erreur lors de l\'ajout', 'error');
        }
    }

    async editChronique(chroniqueId) {
        const chronique = this.chroniques.find(c => c.id === chroniqueId);
        if (!chronique) return;

        // Pré-remplir le formulaire
        document.getElementById('chronique-title').value = chronique.title || '';
        document.getElementById('chronique-type').value = chronique.type || 'manual';
        document.getElementById('chronique-source').value = chronique.sourceUrl || '';
        document.getElementById('chronique-description').value = chronique.description || '';
        
        // Afficher le formulaire
        const modal = document.getElementById('chronique-form-modal');
        const title = document.getElementById('form-title');
        
        if (modal && title) {
            title.textContent = 'Modifier la chronique';
            modal.style.display = 'block';
            
            // Stocker l'ID pour la mise à jour
            document.getElementById('chronique-form').dataset.editId = chroniqueId;
        }
    }

    showNotification(message, type = 'info') {
        // Utiliser le système de notification global si disponible
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                border-radius: 4px;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }
}

// Initialisation globale
window.chroniquesInvites = new ChroniquesInvites();