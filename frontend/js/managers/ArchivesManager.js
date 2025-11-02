/**
 * Gestionnaire des archives de news
 * Permet la recherche, consultation et duplication de news archivées
 */

class ArchivesManager {
    constructor() {
        this.currentResults = [];
        this.currentPage = 1;
        this.resultsPerPage = 20;
        this.totalResults = 0;
        this.searchQuery = '';
        this.filters = {
            category: '',
            period: '',
            author: ''
        };
        this.client = null;
    }

    /**
     * Initialiser le gestionnaire d'archives
     */
    async init() {
        try {
            // Initialiser le client Amplify via le wrapper global
            if (window.amplifyData) {
                this.client = window.amplifyData.client;
                console.log('✅ Client Amplify récupéré depuis window.amplifyData');
            } else if (window.app && window.app.storage && window.app.storage.amplifyData) {
                this.client = window.app.storage.amplifyData.client;
                console.log('✅ Client Amplify récupéré depuis app.storage');
            } else {
                // Ne pas afficher d'avertissement au démarrage - Amplify peut être chargé plus tard
                // console.warn('⚠️ Client Amplify non disponible - fonctionnalités d\'archivage limitées');
                this.client = null;
            }
            
            console.log('📚 Archives Manager initialized');
            
            // Lancer l'archivage automatique périodique
            this.startAutoArchiving();
            
        } catch (error) {
            console.error('❌ Erreur initialisation Archives Manager:', error);
        }
    }

    /**
     * Rechercher dans les archives
     */
    async search() {
        try {
            // Récupérer les valeurs de recherche
            const searchInput = document.getElementById('archives-search-input');
            const categoryFilter = document.getElementById('archives-category-filter');
            const periodFilter = document.getElementById('archives-period-filter');
            
            this.searchQuery = searchInput?.value || '';
            this.filters.category = categoryFilter?.value || '';
            this.filters.period = periodFilter?.value || '';
            
            // Afficher un loader
            this.showLoader();
            
            // Effectuer la recherche depuis DynamoDB
            let results = [];
            
            // Récupérer les news archivées depuis notre système
            if (window.app && window.app.storage) {
                const allData = await window.app.storage.load();
                const allNews = allData.news || [];
                
                // Filtrer pour ne garder que les news archivées
                results = allNews.filter(news => news.status === 'archived');
                
                // Appliquer les filtres de recherche
                results = results.filter(item => {
                    // Filtrer par mots-clés
                    if (this.searchQuery) {
                        const query = this.searchQuery.toLowerCase();
                        const searchableText = `${item.title} ${item.content} ${item.author}`.toLowerCase();
                        if (!searchableText.includes(query)) {
                            return false;
                        }
                    }
                    
                    // Filtrer par catégorie
                    if (this.filters.category && item.category !== this.filters.category) {
                        return false;
                    }
                    
                    // Filtrer par période
                    if (this.filters.period) {
                        const daysAgo = parseInt(this.filters.period);
                        const itemDate = new Date(item.archivedAt);
                        const cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
                        if (itemDate < cutoffDate) {
                            return false;
                        }
                    }
                    
                    return true;
                });
            } else {
                // Fallback : recherche locale pour test
                results = this.getMockArchives().filter(item => {
                    // Filtrer par mots-clés
                    if (this.searchQuery) {
                        const query = this.searchQuery.toLowerCase();
                        const searchableText = `${item.title} ${item.content} ${item.author}`.toLowerCase();
                        if (!searchableText.includes(query)) {
                            return false;
                        }
                    }
                    
                    // Filtrer par catégorie
                    if (this.filters.category && item.category !== this.filters.category) {
                        return false;
                    }
                    
                    // Filtrer par période
                    if (this.filters.period) {
                        const daysAgo = parseInt(this.filters.period);
                        const itemDate = new Date(item.archivedAt);
                        const cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
                        if (itemDate < cutoffDate) {
                            return false;
                        }
                    }
                    
                    return true;
                });
            }
            
            this.totalResults = results.length;
            this.currentResults = results;
            this.displayResults();
            this.updateStats();
            
        } catch (error) {
            console.error('❌ Erreur recherche archives:', error);
            this.showError('Erreur lors de la recherche');
        }
    }

    /**
     * Construire les paramètres de requête
     */
    buildQueryParams() {
        const params = {};
        
        // Recherche par mots-clés dans le contenu indexable
        if (this.searchQuery) {
            params.searchableContent = { contains: this.searchQuery.toLowerCase() };
        }
        
        // Filtre par catégorie
        if (this.filters.category) {
            params.category = { eq: this.filters.category };
        }
        
        // Filtre par période
        if (this.filters.period) {
            const daysAgo = parseInt(this.filters.period);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
            params.archivedAt = { gt: cutoffDate.toISOString() };
        }
        
        return params;
    }

    /**
     * Afficher les résultats
     */
    displayResults() {
        const resultsContainer = document.getElementById('archives-results');
        if (!resultsContainer) return;
        
        if (this.currentResults.length === 0) {
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #666;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                    <p style="font-size: 1.1rem;">Aucun résultat trouvé</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Essayez avec d'autres mots-clés ou filtres</p>
                </div>
            `;
            return;
        }
        
        // Générer les cartes de résultats
        const html = this.currentResults.map(item => this.renderArchiveCard(item)).join('');
        resultsContainer.innerHTML = html;
        
        // Afficher la pagination si nécessaire
        if (this.totalResults > this.resultsPerPage) {
            this.displayPagination();
        }
    }

    /**
     * Rendre une carte d'archive
     */
    renderArchiveCard(item) {
        const publishedDate = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('fr-FR') : '';
        const archivedDate = new Date(item.archivedAt).toLocaleDateString('fr-FR');
        const duration = this.formatDuration(item.duration || 0);
        
        return `
            <div class="archive-card" style="background: #222; border: 1px solid #333; border-radius: 8px; padding: 1.5rem; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <h3 style="color: white; margin: 0 0 0.5rem 0; font-size: 1.2rem;">
                            ${item.title || 'Sans titre'}
                        </h3>
                        <div style="display: flex; gap: 1rem; color: #888; font-size: 0.85rem;">
                            <span>📝 ${item.author || 'Auteur inconnu'}</span>
                            <span>📅 Publié: ${publishedDate}</span>
                            <span>📚 Archivé: ${archivedDate}</span>
                            <span>⏱️ ${duration}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        ${item.category ? `<span style="background: #444; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">${item.category}</span>` : ''}
                    </div>
                </div>
                
                <div style="color: #ccc; margin-bottom: 1rem; line-height: 1.5;">
                    ${this.truncateText(item.content, 200)}
                </div>
                
                ${item.tags && item.tags.length > 0 ? `
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        ${item.tags.map(tag => `
                            <span style="background: rgba(102, 126, 234, 0.2); color: #667eea; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                                #${tag}
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button 
                        class="btn btn-secondary" 
                        onclick="window.archivesManager.viewDetails('${item.id}')"
                        style="padding: 0.5rem 1rem; background: #444; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9rem;"
                    >
                        👁️ Voir détails
                    </button>
                    <button 
                        class="btn btn-primary" 
                        onclick="window.archivesManager.duplicateToNews('${item.id}')"
                        style="padding: 0.5rem 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9rem;"
                    >
                        📄 Dupliquer comme News
                    </button>
                    ${item.audioUrl ? `
                        <button 
                            class="btn btn-secondary" 
                            onclick="window.archivesManager.playAudio('${item.audioUrl}')"
                            style="padding: 0.5rem 1rem; background: #444; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9rem;"
                        >
                            🔊 Écouter
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Dupliquer une archive comme nouvelle news
     */
    async duplicateToNews(archiveId) {
        try {
            const archive = this.currentResults.find(item => item.id === archiveId);
            if (!archive) {
                console.error('Archive non trouvée');
                return;
            }
            
            // Créer une nouvelle news basée sur l'archive
            const newNews = {
                id: Date.now().toString(),
                title: archive.title + ' (Copie)',
                content: archive.content,
                author: window.app?.getCurrentUser?.() || archive.author || 'Reporter',
                category: archive.category,
                duration: archive.duration,
                audioUrl: archive.audioUrl,
                imageUrl: archive.imageUrl,
                tags: archive.tags,
                status: 'draft',
                scheduledDate: null, // Réinitialiser la date programmée
                archivedAt: null, // Retirer le statut d'archive
                createdAt: Date.now(),
                updatedAt: new Date().toISOString()
            };
            
            // Ajouter la news via notre système DynamoDB
            if (window.app && window.app.newsManager) {
                // Ajouter à la base de données
                window.app.newsDatabase.push(newNews);
                if (window.app.allNewsDatabase) {
                    window.app.allNewsDatabase.push(newNews);
                }
                window.app.newsManager.setDatabase(window.app.newsDatabase);
                
                // Sauvegarder dans DynamoDB
                if (window.app.storage && window.app.storage.saveItem) {
                    await window.app.storage.saveItem('news', newNews);
                }
                
                // Basculer vers l'onglet News
                if (window.app.showSection) {
                    window.app.showSection('news');
                } else if (window.app.switchTab) {
                    window.app.switchTab('news');
                }
                
                // Charger la news dupliquée dans l'éditeur
                window.app.newsManager.load(newNews.id);
                
                // Afficher une notification
                this.showNotification('✅ News dupliquée avec succès depuis les archives !');
            }
            
        } catch (error) {
            console.error('❌ Erreur duplication news:', error);
            this.showError('Erreur lors de la duplication');
        }
    }

    /**
     * Voir les détails d'une archive
     */
    viewDetails(archiveId) {
        const archive = this.currentResults.find(item => item.id === archiveId);
        if (!archive) return;
        
        // TODO: Créer un modal pour afficher les détails complets
        console.log('Détails archive:', archive);
        alert(`Détails de l'archive:\n\nTitre: ${archive.title}\nAuteur: ${archive.author}\nCatégorie: ${archive.category}\n\nContenu:\n${archive.content}`);
    }

    /**
     * Effacer la recherche
     */
    clearSearch() {
        const searchInput = document.getElementById('archives-search-input');
        const categoryFilter = document.getElementById('archives-category-filter');
        const periodFilter = document.getElementById('archives-period-filter');
        
        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = '';
        if (periodFilter) periodFilter.value = '';
        
        this.searchQuery = '';
        this.filters = { category: '', period: '', author: '' };
        this.currentResults = [];
        
        // Réinitialiser l'affichage
        const resultsContainer = document.getElementById('archives-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #666;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                    <p style="font-size: 1.1rem;">Effectuez une recherche pour afficher les archives</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Les news sont automatiquement archivées 24h après leur date d'expiration</p>
                </div>
            `;
        }
        
        // Masquer les stats
        const statsContainer = document.getElementById('archives-stats');
        if (statsContainer) {
            statsContainer.innerHTML = '';
        }
    }

    /**
     * Mettre à jour les statistiques
     */
    updateStats() {
        const statsContainer = document.getElementById('archives-stats');
        if (!statsContainer) return;
        
        let statsText = `📊 ${this.totalResults} résultat${this.totalResults > 1 ? 's' : ''} trouvé${this.totalResults > 1 ? 's' : ''}`;
        
        if (this.searchQuery) {
            statsText += ` pour "${this.searchQuery}"`;
        }
        
        if (this.filters.category) {
            statsText += ` dans la catégorie ${this.filters.category}`;
        }
        
        if (this.filters.period) {
            const periodText = {
                '7': 'des 7 derniers jours',
                '30': 'des 30 derniers jours',
                '90': 'des 3 derniers mois',
                '365': 'de la dernière année'
            };
            statsText += ` ${periodText[this.filters.period]}`;
        }
        
        statsContainer.innerHTML = statsText;
    }

    /**
     * Archivage automatique des news expirées
     */
    async startAutoArchiving() {
        // Exécuter immédiatement
        await this.archiveExpiredNews();
        
        // Puis toutes les heures
        setInterval(() => {
            this.archiveExpiredNews();
        }, 3600000); // 1 heure
    }

    /**
     * Archiver les news expirées
     */
    async archiveExpiredNews() {
        try {
            console.log('🔄 Vérification des news à archiver...');
            
            if (!this.client) return;
            
            // Récupérer toutes les news publiées
            const response = await this.client.models.News.list({
                filter: {
                    status: { eq: 'published' }
                }
            });
            
            const now = new Date();
            const archiveCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h après expiration
            
            for (const news of response.data) {
                if (news.expiresAt) {
                    const expiryDate = new Date(news.expiresAt);
                    const archiveDate = new Date(expiryDate.getTime() + 24 * 60 * 60 * 1000);
                    
                    if (now > archiveDate) {
                        // Archiver cette news
                        await this.archiveNews(news);
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Erreur archivage automatique:', error);
        }
    }

    /**
     * Vérifier et récupérer le client Amplify si nécessaire
     */
    ensureAmplifyClient() {
        if (!this.client) {
            // Essayer de récupérer le client
            if (window.amplifyData && window.amplifyData.client) {
                this.client = window.amplifyData.client;
                console.log('✅ Client Amplify récupéré tardivement depuis window.amplifyData');
            } else if (window.app && window.app.storage && window.app.storage.amplifyData) {
                this.client = window.app.storage.amplifyData.client;
                console.log('✅ Client Amplify récupéré tardivement depuis app.storage');
            }
        }
        return this.client;
    }

    /**
     * Archiver une news spécifique
     */
    async archiveNews(news) {
        try {
            // Vérifier que le client Amplify est disponible
            if (!this.ensureAmplifyClient()) {
                console.error('❌ Client Amplify non disponible - archivage impossible');
                throw new Error('Client Amplify non disponible');
            }
            // Créer l'entrée d'archive
            const searchableContent = `${news.title} ${news.content} ${news.author} ${(news.tags || []).join(' ')}`.toLowerCase();
            const archivedAt = new Date();
            
            await this.client.models.NewsArchive.create({
                originalId: news.id,
                title: news.title,
                content: news.content,
                author: news.author,
                category: news.category,
                priority: news.priority,
                duration: news.duration,
                audioUrl: news.audioUrl,
                imageUrl: news.imageUrl,
                tags: news.tags,
                assignedBlocks: news.assignedBlocks,
                metadata: news.metadata,
                publishedAt: news.publishedAt,
                expiredAt: news.expiresAt,
                archivedAt: archivedAt.toISOString(),
                searchableContent: searchableContent,
                yearMonth: `${archivedAt.getFullYear()}-${String(archivedAt.getMonth() + 1).padStart(2, '0')}`
            });
            
            // Mettre à jour le statut de la news originale
            await this.client.models.News.update({
                id: news.id,
                status: 'archived',
                archivedAt: archivedAt.toISOString()
            });
            
            console.log(`✅ News archivée: ${news.title}`);
            
        } catch (error) {
            console.error('❌ Erreur archivage news:', error);
        }
    }

    /**
     * Afficher un loader
     */
    showLoader() {
        const resultsContainer = document.getElementById('archives-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #666;">
                    <div style="font-size: 3rem; margin-bottom: 1rem; animation: spin 1s linear infinite;">⏳</div>
                    <p style="font-size: 1.1rem;">Recherche en cours...</p>
                </div>
            `;
        }
    }

    /**
     * Afficher une notification
     */
    showNotification(message) {
        // Utiliser le système de notification existant si disponible
        if (window.app?.showNotification) {
            window.app.showNotification(message);
        } else {
            // Notification simple
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }

    /**
     * Afficher une erreur
     */
    showError(message) {
        const resultsContainer = document.getElementById('archives-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #f44336;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <p style="font-size: 1.1rem;">${message}</p>
                </div>
            `;
        }
    }

    /**
     * Utilitaires
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Données mock pour test
     */
    getMockArchives() {
        return [
            {
                id: '1',
                title: 'Élections municipales : résultats définitifs',
                content: 'Les résultats définitifs des élections municipales ont été publiés ce matin. Le nouveau maire prendra ses fonctions le mois prochain...',
                author: 'Jean Dupont',
                category: 'actualite',
                duration: 120,
                tags: ['elections', 'politique', 'local'],
                publishedAt: '2024-01-15T10:00:00Z',
                archivedAt: '2024-01-17T10:00:00Z'
            },
            {
                id: '2',
                title: 'Festival de musique : programmation complète',
                content: 'La programmation complète du festival de musique a été dévoilée. Plus de 50 artistes se produiront sur 3 jours...',
                author: 'Marie Martin',
                category: 'culture',
                duration: 180,
                tags: ['festival', 'musique', 'culture'],
                publishedAt: '2024-01-10T14:00:00Z',
                archivedAt: '2024-01-12T14:00:00Z'
            },
            {
                id: '3',
                title: 'Match de football : victoire locale',
                content: 'L\'équipe locale a remporté le match 3-1 face à leurs rivaux historiques. Une victoire importante pour le maintien...',
                author: 'Pierre Bernard',
                category: 'sport',
                duration: 90,
                tags: ['football', 'sport', 'victoire'],
                publishedAt: '2024-01-08T20:00:00Z',
                archivedAt: '2024-01-10T20:00:00Z'
            }
        ];
    }

    /**
     * Afficher la pagination
     */
    displayPagination() {
        const paginationContainer = document.getElementById('archives-pagination');
        if (!paginationContainer) return;
        
        const totalPages = Math.ceil(this.totalResults / this.resultsPerPage);
        
        let html = '<div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">';
        
        // Bouton précédent
        if (this.currentPage > 1) {
            html += `<button onclick="window.archivesManager.goToPage(${this.currentPage - 1})" style="padding: 0.5rem 1rem; background: #444; border: none; border-radius: 4px; color: white; cursor: pointer;">← Précédent</button>`;
        }
        
        // Numéros de page
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                html += `<span style="padding: 0.5rem 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 4px; color: white;">${i}</span>`;
            } else {
                html += `<button onclick="window.archivesManager.goToPage(${i})" style="padding: 0.5rem 1rem; background: #444; border: none; border-radius: 4px; color: white; cursor: pointer;">${i}</button>`;
            }
        }
        
        // Bouton suivant
        if (this.currentPage < totalPages) {
            html += `<button onclick="window.archivesManager.goToPage(${this.currentPage + 1})" style="padding: 0.5rem 1rem; background: #444; border: none; border-radius: 4px; color: white; cursor: pointer;">Suivant →</button>`;
        }
        
        html += '</div>';
        
        paginationContainer.innerHTML = html;
        paginationContainer.style.display = 'block';
    }

    /**
     * Aller à une page spécifique
     */
    goToPage(page) {
        this.currentPage = page;
        this.search();
    }
}

// Créer une instance globale
window.archivesManager = new ArchivesManager();