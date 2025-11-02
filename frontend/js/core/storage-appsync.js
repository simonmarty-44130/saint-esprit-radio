/**
 * Storage AppSync - Version moderne avec GraphQL + Subscriptions temps réel
 * Utilise Amplify Gen 2 avec DynamoDB backend
 */

// Import dynamique d'Amplify (sera chargé depuis le CDN)
class StorageAppSync {
    constructor() {
        this.client = null;
        this.subscriptions = [];
        this.currentUser = null;
        this.cache = {
            news: [],
            animations: [],
            blocks: [],
            conductors: [],
            templates: [],
            audio: []
        };
        this.listeners = new Map();
        this.initialized = false;
    }

    /**
     * Initialiser Amplify et le client GraphQL
     */
    async init() {
        try {
            console.log('🔧 Initializing AppSync Storage...');

            // Charger Amplify depuis window (déjà chargé via CDN)
            if (!window.amplify || !window.amplifyUtils) {
                throw new Error('Amplify not loaded. Make sure CDN scripts are loaded.');
            }

            const { Amplify } = window.amplify;
            const { generateClient } = window.amplifyUtils;

            // Charger la configuration
            const config = await fetch('/amplify_outputs.json').then(r => r.json());
            Amplify.configure(config);

            // Créer le client GraphQL
            this.client = generateClient();

            // Récupérer l'utilisateur connecté
            const { fetchAuthSession } = window.amplifyAuth;
            const session = await fetchAuthSession();
            this.currentUser = session.tokens?.idToken?.payload?.sub || 'unknown';

            console.log(`✅ AppSync initialized for user: ${this.currentUser}`);

            // Charger les données initiales
            await this.loadAllData();

            // Démarrer les subscriptions temps réel
            this.setupSubscriptions();

            this.initialized = true;
            return true;

        } catch (error) {
            console.error('❌ AppSync init failed:', error);
            console.error('  Error details:', error.message);
            throw error;
        }
    }

    /**
     * Charger toutes les données depuis DynamoDB
     */
    async loadAllData() {
        console.log('📥 Loading all data from DynamoDB...');

        try {
            await Promise.all([
                this.loadNews(),
                this.loadAnimations(),
                this.loadBlocks(),
                this.loadConductors()
            ]);

            console.log(`✅ Data loaded: ${this.cache.news.length} news, ${this.cache.animations.length} animations`);
        } catch (error) {
            console.error('❌ Error loading data:', error);
        }
    }

    /**
     * Charger les news
     */
    async loadNews() {
        try {
            const result = await this.client.graphql({
                query: `query ListNews {
                    listNews {
                        items {
                            id
                            title
                            content
                            author
                            status
                            category
                            priority
                            duration
                            audioUrl
                            tags
                            assignedBlocks
                            metadata
                            publishedAt
                            createdAt
                            updatedAt
                            lastModifiedBy
                        }
                    }
                }`
            });

            this.cache.news = result.data.listNews.items || [];
            this.notifyListeners('news-loaded', this.cache.news);
            return this.cache.news;
        } catch (error) {
            console.error('❌ Error loading news:', error);
            return [];
        }
    }

    /**
     * Charger les animations
     */
    async loadAnimations() {
        try {
            const result = await this.client.graphql({
                query: `query ListAnimations {
                    listAnimations {
                        items {
                            id
                            title
                            content
                            author
                            type
                            duration
                            audioUrl
                            category
                            tags
                            createdAt
                            updatedAt
                        }
                    }
                }`
            });

            this.cache.animations = result.data.listAnimations.items || [];
            return this.cache.animations;
        } catch (error) {
            console.error('❌ Error loading animations:', error);
            return [];
        }
    }

    /**
     * Charger les blocks
     */
    async loadBlocks() {
        try {
            const result = await this.client.graphql({
                query: `query ListBlocks {
                    listBlocks {
                        items {
                            id
                            name
                            type
                            content
                            items
                            duration
                            scheduledTime
                            author
                            status
                            createdAt
                            updatedAt
                        }
                    }
                }`
            });

            this.cache.blocks = result.data.listBlocks.items || [];
            return this.cache.blocks;
        } catch (error) {
            console.error('❌ Error loading blocks:', error);
            return [];
        }
    }

    /**
     * Charger les conducteurs
     */
    async loadConductors() {
        try {
            const result = await this.client.graphql({
                query: `query ListConductors {
                    listConductors {
                        items {
                            id
                            date
                            name
                            segments
                            totalDuration
                            status
                            author
                            createdAt
                            updatedAt
                        }
                    }
                }`
            });

            this.cache.conductors = result.data.listConductors.items || [];
            return this.cache.conductors;
        } catch (error) {
            console.error('❌ Error loading conductors:', error);
            return [];
        }
    }

    // ===== MUTATIONS (CREATE/UPDATE/DELETE) =====

    /**
     * Créer une news
     */
    async createNews(news) {
        try {
            const input = {
                title: news.title,
                content: news.content || '',
                author: news.author || this.currentUser,
                status: news.status || 'draft',
                category: news.category,
                priority: news.priority || 0,
                duration: news.duration,
                audioUrl: news.audioUrl,
                tags: news.tags || [],
                assignedBlocks: news.assignedBlocks || [],
                metadata: news.metadata ? JSON.stringify(news.metadata) : null,
                lastModifiedBy: this.currentUser
            };

            const result = await this.client.graphql({
                query: `mutation CreateNews($input: CreateNewsInput!) {
                    createNews(input: $input) {
                        id
                        title
                        content
                        author
                        status
                        createdAt
                        updatedAt
                    }
                }`,
                variables: { input }
            });

            console.log('✅ News created:', result.data.createNews.title);
            return result.data.createNews;
        } catch (error) {
            console.error('❌ Error creating news:', error);
            throw error;
        }
    }

    /**
     * Mettre à jour une news
     */
    async updateNews(id, updates) {
        try {
            const input = {
                id,
                ...updates,
                lastModifiedBy: this.currentUser
            };

            const result = await this.client.graphql({
                query: `mutation UpdateNews($input: UpdateNewsInput!) {
                    updateNews(input: $input) {
                        id
                        title
                        content
                        updatedAt
                    }
                }`,
                variables: { input }
            });

            console.log('✅ News updated:', result.data.updateNews.title);
            return result.data.updateNews;
        } catch (error) {
            console.error('❌ Error updating news:', error);
            throw error;
        }
    }

    /**
     * Supprimer une news
     */
    async deleteNews(id) {
        try {
            await this.client.graphql({
                query: `mutation DeleteNews($input: DeleteNewsInput!) {
                    deleteNews(input: $input) {
                        id
                    }
                }`,
                variables: { input: { id } }
            });

            console.log('✅ News deleted:', id);
        } catch (error) {
            console.error('❌ Error deleting news:', error);
            throw error;
        }
    }

    // ===== SUBSCRIPTIONS TEMPS RÉEL =====

    setupSubscriptions() {
        console.log('📡 Setting up real-time subscriptions...');

        try {
            // Subscription pour nouvelles news
            const newsSub = this.client.graphql({
                query: `subscription OnCreateNews {
                    onCreateNews {
                        id
                        title
                        content
                        author
                        status
                        createdAt
                        lastModifiedBy
                    }
                }`
            }).subscribe({
                next: ({ data }) => {
                    console.log('🔔 New news created:', data.onCreateNews.title);
                    this.handleNewsCreated(data.onCreateNews);
                },
                error: (error) => console.warn('⚠️ Subscription error:', error)
            });

            // Subscription pour news supprimées
            const deleteNewsSub = this.client.graphql({
                query: `subscription OnDeleteNews {
                    onDeleteNews {
                        id
                    }
                }`
            }).subscribe({
                next: ({ data }) => {
                    console.log('🗑️ News deleted:', data.onDeleteNews.id);
                    this.handleNewsDeleted(data.onDeleteNews);
                },
                error: (error) => console.warn('⚠️ Subscription error:', error)
            });

            // Subscription pour news modifiées
            const updateNewsSub = this.client.graphql({
                query: `subscription OnUpdateNews {
                    onUpdateNews {
                        id
                        title
                        content
                        updatedAt
                        lastModifiedBy
                    }
                }`
            }).subscribe({
                next: ({ data }) => {
                    console.log('✏️ News updated:', data.onUpdateNews.title);
                    this.handleNewsUpdated(data.onUpdateNews);
                },
                error: (error) => console.warn('⚠️ Subscription error:', error)
            });

            this.subscriptions.push(newsSub, deleteNewsSub, updateNewsSub);
            console.log('✅ Subscriptions active');

        } catch (error) {
            console.warn('⚠️ Could not setup subscriptions:', error);
        }
    }

    // ===== HANDLERS POUR SUBSCRIPTIONS =====

    handleNewsCreated(news) {
        // Ne pas ajouter si c'est nous qui l'avons créée
        if (news.lastModifiedBy === this.currentUser) {
            return;
        }

        this.cache.news.push(news);
        this.notifyListeners('news-created', news);
        this.showNotification(`📰 Nouvelle news créée par ${news.author}: "${news.title}"`);
    }

    handleNewsDeleted(news) {
        this.cache.news = this.cache.news.filter(n => n.id !== news.id);
        this.notifyListeners('news-deleted', news);
        this.showNotification(`🗑️ News supprimée: ID ${news.id}`);
    }

    handleNewsUpdated(news) {
        const index = this.cache.news.findIndex(n => n.id === news.id);
        if (index !== -1) {
            this.cache.news[index] = { ...this.cache.news[index], ...news };
        }
        this.notifyListeners('news-updated', news);

        if (news.lastModifiedBy !== this.currentUser) {
            this.showNotification(`✏️ News modifiée: "${news.title}"`);
        }
    }

    // ===== SYSTÈME DE LISTENERS =====

    addEventListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    removeEventListener(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('❌ Listener error:', error);
                }
            });
        }
    }

    showNotification(message) {
        console.log('🔔', message);
        // Utiliser le système de notifications de l'app si disponible
        if (window.app && window.app.showNotification) {
            window.app.showNotification(message);
        }
    }

    // ===== INTERFACE COMPATIBLE AVEC L'ANCIEN SYSTÈME =====

    /**
     * Obtenir toutes les données (compatible)
     */
    async getAllData() {
        return {
            news: this.cache.news,
            animations: this.cache.animations,
            blocks: this.cache.blocks,
            conductors: this.cache.conductors,
            templates: this.cache.templates
        };
    }

    /**
     * Obtenir les news (compatible)
     */
    getNews() {
        return this.cache.news;
    }

    /**
     * Obtenir les animations (compatible)
     */
    getAnimations() {
        return this.cache.animations;
    }

    /**
     * Obtenir les blocks (compatible)
     */
    getBlocks() {
        return this.cache.blocks;
    }

    /**
     * Obtenir les conducteurs (compatible)
     */
    getConductors() {
        return this.cache.conductors;
    }

    /**
     * Sauvegarder toutes les données (legacy - à éviter)
     */
    async saveAllData(data) {
        console.warn('⚠️ saveAllData() is deprecated, use createNews(), updateNews(), etc.');
        // Pour compatibilité, on ne fait rien
        return true;
    }

    /**
     * Statistiques
     */
    getStats() {
        return {
            totalNews: this.cache.news.length,
            totalAnimations: this.cache.animations.length,
            totalBlocks: this.cache.blocks.length,
            totalConductors: this.cache.conductors.length,
            userId: this.currentUser,
            activeSubscriptions: this.subscriptions.length
        };
    }

    /**
     * Nettoyer les subscriptions
     */
    cleanup() {
        this.subscriptions.forEach(sub => {
            try {
                sub.unsubscribe();
            } catch (e) {
                console.warn('Error unsubscribing:', e);
            }
        });
        this.subscriptions = [];
        console.log('✅ Subscriptions cleaned up');
    }
}

// Export global
window.StorageAppSync = StorageAppSync;
