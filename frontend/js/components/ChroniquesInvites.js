class ChroniquesInvites {
    constructor() {
        this.chroniques = [];
        this.benevolesChroniques = [];
        this.benevolesEmissions = [];
        this.currentUser = null;
        this.tableName = 'saint-esprit-chroniques';
        this.bucketName = 'saint-esprit-audio';
        this.isAdmin = false;
        this.currentTab = 'permanentes'; // 'permanentes' ou 'benevoles'
        this.appSyncClient = null;
    }

    async init() {
        // Attendre que Amplify soit configuré
        if (!window.appSyncStorage) {
            console.warn('AppSync non chargé, attente...');
            setTimeout(() => this.init(), 500);
            return;
        }

        this.appSyncClient = window.appSyncStorage.client;
        this.currentUser = await this.getCurrentUser();
        this.isAdmin = this.currentUser && (this.currentUser.isAdmin || this.currentUser.sub);

        await Promise.all([
            this.loadChroniques(),
            this.loadBenevolesData()
        ]);

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
            // Charger chroniques permanentes (ancien système)
            // Cette partie reste pour les chroniques récurrentes stockées dans DynamoDB legacy
            this.chroniques = [];
            console.log('Chroniques permanentes chargées (legacy désactivé)');
        } catch (error) {
            console.error('Erreur chargement chroniques:', error);
            this.chroniques = [];
        }
    }

    async loadBenevolesData() {
        try {
            if (!this.appSyncClient) {
                console.warn('AppSync client non disponible');
                return;
            }

            // Charger les chroniques des bénévoles
            const chroniquesResult = await this.appSyncClient.graphql({
                query: `query ListChroniques {
                    listChroniques {
                        items {
                            id
                            title
                            author
                            type
                            audioUrl
                            s3Key
                            duration
                            dateDiffusion
                            lancement
                            desannonce
                            status
                            submittedAt
                            reviewedAt
                            reviewedBy
                            reviewNotes
                        }
                    }
                }`
            });

            this.benevolesChroniques = chroniquesResult.data?.listChroniques?.items || [];

            // Charger les émissions des bénévoles
            const emissionsResult = await this.appSyncClient.graphql({
                query: `query ListEmissions {
                    listEmissions {
                        items {
                            id
                            title
                            content
                            author
                            guests
                            musics
                            wordCount
                            readingTime
                            musicTime
                            totalTime
                            status
                            submittedAt
                            reviewedAt
                            reviewedBy
                            reviewNotes
                        }
                    }
                }`
            });

            this.benevolesEmissions = emissionsResult.data?.listEmissions?.items || [];

            console.log(`${this.benevolesChroniques.length} chroniques bénévoles et ${this.benevolesEmissions.length} émissions chargées`);
        } catch (error) {
            console.error('Erreur chargement données bénévoles:', error);
            this.benevolesChroniques = [];
            this.benevolesEmissions = [];
        }
    }

    render() {
        const container = document.getElementById('chroniques-invites-content');
        if (!container) return;

        const totalBenevoles = this.benevolesChroniques.length + this.benevolesEmissions.length;
        const pendingCount = [...this.benevolesChroniques, ...this.benevolesEmissions]
            .filter(item => item.status === 'submitted').length;

        container.innerHTML = `
            <div class="chroniques-modern-header">
                <div class="header-top">
                    <h1><i class="fas fa-microphone-alt"></i> Chroniques & Émissions</h1>
                </div>

                <div class="tabs-navigation">
                    <button class="tab-btn ${this.currentTab === 'benevoles' ? 'active' : ''}"
                            onclick="window.chroniquesInvites.switchTab('benevoles')">
                        <i class="fas fa-users"></i>
                        <span>Soumissions Bénévoles</span>
                        ${totalBenevoles > 0 ? `<span class="badge">${totalBenevoles}</span>` : ''}
                        ${pendingCount > 0 ? `<span class="badge-new">${pendingCount} nouvelle${pendingCount > 1 ? 's' : ''}</span>` : ''}
                    </button>
                    <button class="tab-btn ${this.currentTab === 'permanentes' ? 'active' : ''}"
                            onclick="window.chroniquesInvites.switchTab('permanentes')">
                        <i class="fas fa-database"></i>
                        <span>Chroniques Permanentes</span>
                        ${this.chroniques.length > 0 ? `<span class="badge">${this.chroniques.length}</span>` : ''}
                    </button>
                </div>
            </div>

            <div id="benevoles-tab" class="tab-content ${this.currentTab === 'benevoles' ? 'active' : ''}">
                ${this.renderBenevolesTab()}
            </div>

            <div id="permanentes-tab" class="tab-content ${this.currentTab === 'permanentes' ? 'active' : ''}">
                ${this.renderPermanentesTab()}
            </div>
        `;
    }

    renderBenevolesTab() {
        if (this.benevolesChroniques.length === 0 && this.benevolesEmissions.length === 0) {
            return `
                <div class="empty-state-modern">
                    <div class="empty-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <h3>Aucune soumission</h3>
                    <p>Les bénévoles n'ont pas encore envoyé de chroniques ou d'émissions</p>
                </div>
            `;
        }

        return `
            <div class="benevoles-sections">
                ${this.benevolesChroniques.length > 0 ? `
                    <div class="section-group">
                        <h2 class="section-title">
                            <i class="fas fa-headphones"></i> Chroniques Audio
                            <span class="count">${this.benevolesChroniques.length}</span>
                        </h2>
                        <div class="cards-grid">
                            ${this.benevolesChroniques.map(c => this.renderChroniqueCard(c)).join('')}
                        </div>
                    </div>
                ` : ''}

                ${this.benevolesEmissions.length > 0 ? `
                    <div class="section-group">
                        <h2 class="section-title">
                            <i class="fas fa-file-alt"></i> Émissions Écrites
                            <span class="count">${this.benevolesEmissions.length}</span>
                        </h2>
                        <div class="cards-grid">
                            ${this.benevolesEmissions.map(e => this.renderEmissionCard(e)).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderPermanentesTab() {
        return `
            <div class="info-card">
                <i class="fas fa-info-circle"></i>
                <p>Les chroniques permanentes seront ajoutées prochainement</p>
            </div>
        `;
    }

    renderChroniqueCard(chronique) {
        const statusInfo = this.getStatusInfo(chronique.status);
        const dateDiff = chronique.dateDiffusion ? new Date(chronique.dateDiffusion).toLocaleDateString('fr-FR') : 'Non spécifié';
        const dateSubmit = chronique.submittedAt ? new Date(chronique.submittedAt).toLocaleString('fr-FR') : '';

        return `
            <div class="content-card chronique-card">
                <div class="card-header">
                    <div class="card-title-row">
                        <h3>${chronique.title || 'Sans titre'}</h3>
                        <span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>
                    </div>
                    <div class="card-meta">
                        <span class="meta-item"><i class="fas fa-user"></i> ${chronique.author}</span>
                        <span class="meta-item"><i class="fas fa-tag"></i> ${this.getTypeLabel(chronique.type)}</span>
                    </div>
                </div>

                <div class="card-body">
                    ${chronique.lancement ? `
                        <div class="info-block">
                            <strong>Lancement:</strong>
                            <p>${chronique.lancement}</p>
                        </div>
                    ` : ''}

                    ${chronique.desannonce ? `
                        <div class="info-block">
                            <strong>Désannonce:</strong>
                            <p>${chronique.desannonce}</p>
                        </div>
                    ` : ''}

                    <div class="card-stats">
                        <div class="stat-item">
                            <i class="fas fa-clock"></i>
                            <span>${this.formatDuration(chronique.duration || 0)}</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-calendar"></i>
                            <span>${dateDiff}</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-paper-plane"></i>
                            <span>${dateSubmit}</span>
                        </div>
                    </div>
                </div>

                <div class="card-actions">
                    ${chronique.audioUrl ? `
                        <button class="btn-action" onclick="window.chroniquesInvites.playAudio('${chronique.audioUrl}', '${chronique.title}')">
                            <i class="fas fa-play"></i> Écouter
                        </button>
                    ` : ''}
                    ${this.isAdmin && chronique.status === 'submitted' ? `
                        <button class="btn-action primary" onclick="window.chroniquesInvites.approveChronique('${chronique.id}')">
                            <i class="fas fa-check"></i> Approuver
                        </button>
                        <button class="btn-action warning" onclick="window.chroniquesInvites.rejectChronique('${chronique.id}')">
                            <i class="fas fa-times"></i> Refuser
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderEmissionCard(emission) {
        const statusInfo = this.getStatusInfo(emission.status);
        const dateSubmit = emission.submittedAt ? new Date(emission.submittedAt).toLocaleString('fr-FR') : '';
        const musics = emission.musics ? JSON.parse(emission.musics) : [];

        return `
            <div class="content-card emission-card">
                <div class="card-header">
                    <div class="card-title-row">
                        <h3>${emission.title || 'Sans titre'}</h3>
                        <span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>
                    </div>
                    <div class="card-meta">
                        <span class="meta-item"><i class="fas fa-user"></i> ${emission.author}</span>
                        ${emission.guests ? `<span class="meta-item"><i class="fas fa-user-friends"></i> ${emission.guests}</span>` : ''}
                    </div>
                </div>

                <div class="card-body">
                    <div class="content-preview">
                        ${emission.content ? emission.content.substring(0, 200) + (emission.content.length > 200 ? '...' : '') : ''}
                    </div>

                    ${musics.length > 0 ? `
                        <div class="info-block">
                            <strong>Musiques (${musics.length}):</strong>
                            <ul class="music-list">
                                ${musics.slice(0, 3).map(m => `<li>${m.title} - ${m.artist}</li>`).join('')}
                                ${musics.length > 3 ? `<li><em>+${musics.length - 3} autre(s)</em></li>` : ''}
                            </ul>
                        </div>
                    ` : ''}

                    <div class="card-stats">
                        <div class="stat-item">
                            <i class="fas fa-file-word"></i>
                            <span>${emission.wordCount || 0} mots</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-clock"></i>
                            <span>${this.formatDuration(emission.totalTime || 0)}</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-paper-plane"></i>
                            <span>${dateSubmit}</span>
                        </div>
                    </div>
                </div>

                <div class="card-actions">
                    <button class="btn-action" onclick="window.chroniquesInvites.viewEmission('${emission.id}')">
                        <i class="fas fa-eye"></i> Lire
                    </button>
                    ${this.isAdmin && emission.status === 'submitted' ? `
                        <button class="btn-action primary" onclick="window.chroniquesInvites.approveEmission('${emission.id}')">
                            <i class="fas fa-check"></i> Approuver
                        </button>
                        <button class="btn-action warning" onclick="window.chroniquesInvites.rejectEmission('${emission.id}')">
                            <i class="fas fa-times"></i> Refuser
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    getStatusInfo(status) {
        const statuses = {
            'submitted': { label: 'En attente', class: 'status-pending' },
            'reviewed': { label: 'En révision', class: 'status-reviewing' },
            'approved': { label: 'Approuvé', class: 'status-approved' },
            'rejected': { label: 'Refusé', class: 'status-rejected' },
            'scheduled': { label: 'Programmé', class: 'status-scheduled' },
            'aired': { label: 'Diffusé', class: 'status-aired' }
        };
        return statuses[status] || { label: status || 'Inconnu', class: 'status-default' };
    }

    switchTab(tab) {
        this.currentTab = tab;
        this.render();
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

    async playAudio(audioUrl, title) {
        if (!audioUrl) {
            this.showNotification('Aucun audio disponible', 'warning');
            return;
        }

        // Utiliser le player audio global si disponible
        if (window.audioManager) {
            window.audioManager.loadAndPlay(audioUrl, title);
        } else {
            // Fallback: ouvrir dans un nouvel onglet
            window.open(audioUrl, '_blank');
        }
    }

    async approveChronique(id) {
        try {
            await this.appSyncClient.graphql({
                query: `mutation UpdateChronique($input: UpdateChroniqueInput!) {
                    updateChronique(input: $input) {
                        id
                        status
                    }
                }`,
                variables: {
                    input: {
                        id,
                        status: 'approved',
                        reviewedAt: new Date().toISOString(),
                        reviewedBy: this.currentUser.username
                    }
                }
            });

            this.showNotification('Chronique approuvée', 'success');
            await this.loadBenevolesData();
            this.render();
        } catch (error) {
            console.error('Erreur approbation:', error);
            this.showNotification('Erreur lors de l\'approbation', 'error');
        }
    }

    async rejectChronique(id) {
        const notes = prompt('Raison du refus (optionnel):');

        try {
            await this.appSyncClient.graphql({
                query: `mutation UpdateChronique($input: UpdateChroniqueInput!) {
                    updateChronique(input: $input) {
                        id
                        status
                    }
                }`,
                variables: {
                    input: {
                        id,
                        status: 'rejected',
                        reviewedAt: new Date().toISOString(),
                        reviewedBy: this.currentUser.username,
                        reviewNotes: notes || 'Refusé'
                    }
                }
            });

            this.showNotification('Chronique refusée', 'success');
            await this.loadBenevolesData();
            this.render();
        } catch (error) {
            console.error('Erreur refus:', error);
            this.showNotification('Erreur lors du refus', 'error');
        }
    }

    async approveEmission(id) {
        try {
            await this.appSyncClient.graphql({
                query: `mutation UpdateEmission($input: UpdateEmissionInput!) {
                    updateEmission(input: $input) {
                        id
                        status
                    }
                }`,
                variables: {
                    input: {
                        id,
                        status: 'approved',
                        reviewedAt: new Date().toISOString(),
                        reviewedBy: this.currentUser.username
                    }
                }
            });

            this.showNotification('Émission approuvée', 'success');
            await this.loadBenevolesData();
            this.render();
        } catch (error) {
            console.error('Erreur approbation:', error);
            this.showNotification('Erreur lors de l\'approbation', 'error');
        }
    }

    async rejectEmission(id) {
        const notes = prompt('Raison du refus (optionnel):');

        try {
            await this.appSyncClient.graphql({
                query: `mutation UpdateEmission($input: UpdateEmissionInput!) {
                    updateEmission(input: $input) {
                        id
                        status
                    }
                }`,
                variables: {
                    input: {
                        id,
                        status: 'rejected',
                        reviewedAt: new Date().toISOString(),
                        reviewedBy: this.currentUser.username,
                        reviewNotes: notes || 'Refusé'
                    }
                }
            });

            this.showNotification('Émission refusée', 'success');
            await this.loadBenevolesData();
            this.render();
        } catch (error) {
            console.error('Erreur refus:', error);
            this.showNotification('Erreur lors du refus', 'error');
        }
    }

    viewEmission(id) {
        const emission = this.benevolesEmissions.find(e => e.id === id);
        if (!emission) return;

        // Créer une modal pour afficher le contenu complet
        const modal = document.createElement('div');
        modal.className = 'emission-modal';
        modal.innerHTML = `
            <div class="emission-modal-content">
                <button class="modal-close" onclick="this.closest('.emission-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
                <h2>${emission.title}</h2>
                <div class="emission-meta">
                    <span><strong>Auteur:</strong> ${emission.author}</span>
                    ${emission.guests ? `<span><strong>Invités:</strong> ${emission.guests}</span>` : ''}
                </div>
                <div class="emission-full-content">
                    ${emission.content}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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