/**
 * Storage DynamoDB Optimisé pour Saint-Esprit
 * Version compatible avec le système de migration
 */

class StorageDynamoDBOptimized {
    constructor() {
        // Utiliser le client DynamoDB optimisé
        this.db = new DynamoDBOptimized();
        this.userId = null;
        this.initialized = false;
        this.credentials = null;
        this.s3 = null;
        this._cacheBustTimestamp = 0;
        
        // Bucket principal pour compatibilité
        this.bucket = 'amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke';
        
        // Cache optimisé avec TTL
        this.cache = {
            news: [],
            animations: [],
            blocks: [],
            conductors: [],
            habillage: []
        };
        
        // Filtre actuel
        this.currentFilter = {
            userId: null,
            showOnlyMine: false
        };
        
        // Métriques de performance
        this.metrics = {
            loadTime: 0,
            cacheHits: 0,
            totalRequests: 0
        };
    }

    async init() {
        const startTime = performance.now();
        
        try {
            console.log('🚀 Initializing Optimized DynamoDB Storage...');
            
            // Récupérer l'userId si authentifié
            if (window.authManager && window.authManager.isAuthenticated()) {
                this.userId = window.authManager.getUserId();
            }
            
            // Configurer AWS credentials
            if (!AWS.config.credentials) {
                console.warn('⚠️ AWS credentials not yet configured, waiting for auth...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (AWS.config.credentials) {
                if (!AWS.config.credentials.accessKeyId) {
                    try {
                        await new Promise((resolve, reject) => {
                            AWS.config.credentials.get((err) => {
                                if (err) {
                                    console.error('Error getting credentials:', err);
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    } catch (error) {
                        console.error('Failed to get AWS credentials:', error);
                    }
                }
                this.credentials = AWS.config.credentials;
                console.log('✅ AWS credentials configured');
                
                // Initialiser le client S3 pour compatibilité
                this.s3 = new AWS.S3({
                    region: 'eu-west-3',
                    credentials: this.credentials
                });
            }
            
            // Initialiser le client DynamoDB optimisé
            await this.db.init();
            
            // Charger uniquement les données essentielles avec pagination
            await this.loadEssentialData();
            
            this.initialized = true;
            this.metrics.loadTime = performance.now() - startTime;
            
            console.log(`✅ Optimized Storage initialized in ${this.metrics.loadTime.toFixed(2)}ms`);
            
            return true;
        } catch (error) {
            console.error('❌ Optimized Storage init failed:', error);
            throw error;
        }
    }

    /**
     * Charger les données essentielles avec pagination
     */
    async loadEssentialData() {
        try {
            console.log('📥 Loading essential data with pagination...');
            
            // Charger seulement les 20 derniers items actifs de chaque type
            const [news, animations, blocks] = await Promise.all([
                this.db.getPaginated('news', { limit: 20, status: 'active' }),
                this.db.getPaginated('animations', { limit: 20 }),
                this.db.getPaginated('blocks', { limit: 10 })
            ]);
            
            // Mettre en cache
            this.cache.news = news.Items || [];
            this.cache.animations = animations.Items || [];
            this.cache.blocks = blocks.Items || [];
            
            // Notifier l'app avec les données optimisées
            if (window.app && window.app.onDatabaseUpdate) {
                if (this.cache.news.length) {
                    window.app.onDatabaseUpdate('news', this.cache.news);
                }
                if (this.cache.animations.length) {
                    window.app.onDatabaseUpdate('animations', this.cache.animations);
                }
                if (this.cache.blocks.length) {
                    window.app.onDatabaseUpdate('blocks', this.cache.blocks);
                }
            }
            
            console.log(`✅ Loaded essential data: ${this.cache.news.length} news, ${this.cache.animations.length} animations`);
            
        } catch (error) {
            console.error('❌ Error loading essential data:', error);
            // Continuer avec cache vide plutôt que de crasher
            this.cache = {
                news: [],
                animations: [],
                blocks: [],
                conductors: [],
                habillage: []
            };
        }
    }

    /**
     * Charger plus de données à la demande
     */
    async loadMore(type, lastKey) {
        this.metrics.totalRequests++;
        
        try {
            const result = await this.db.getPaginated(type, {
                limit: 20,
                lastKey: lastKey
            });
            
            // Ajouter au cache existant
            if (result.Items && result.Items.length > 0) {
                this.cache[type] = [...this.cache[type], ...result.Items];
                
                // Notifier l'app
                if (window.app && window.app.onDatabaseUpdate) {
                    window.app.onDatabaseUpdate(type, this.cache[type]);
                }
            }
            
            return result;
        } catch (error) {
            console.error(`Error loading more ${type}:`, error);
            throw error;
        }
    }

    /**
     * Sauvegarder un item (optimisé)
     */
    async save(type, item) {
        try {
            const savedItem = await this.db.upsert(type, item);
            
            // Mettre à jour le cache local immédiatement
            const index = this.cache[type]?.findIndex(i => i.id === savedItem.id);
            if (index >= 0) {
                this.cache[type][index] = savedItem;
            } else if (this.cache[type]) {
                this.cache[type].unshift(savedItem);
            }
            
            // Notifier l'app
            if (window.app && window.app.onDatabaseUpdate) {
                window.app.onDatabaseUpdate(type, this.cache[type]);
            }
            
            return savedItem;
        } catch (error) {
            console.error(`Error saving ${type}:`, error);
            throw error;
        }
    }

    /**
     * Supprimer un item (optimisé)
     */
    async deleteItem(type, id, createdAt) {
        try {
            await this.db.delete(type, id, createdAt);
            
            // Retirer du cache local
            if (this.cache[type]) {
                this.cache[type] = this.cache[type].filter(i => i.id !== id);
                
                // Notifier l'app
                if (window.app && window.app.onDatabaseUpdate) {
                    window.app.onDatabaseUpdate(type, this.cache[type]);
                }
            }
            
            return true;
        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
            return false;
        }
    }

    /**
     * Récupérer depuis le cache (avec fallback API)
     */
    async get(type, id) {
        // Chercher d'abord dans le cache
        const cached = this.cache[type]?.find(item => item.id === id);
        if (cached) {
            this.metrics.cacheHits++;
            return cached;
        }
        
        // Si pas en cache, récupérer depuis l'API
        this.metrics.totalRequests++;
        try {
            const result = await this.db.getItem(type, id);
            return result;
        } catch (error) {
            console.error(`Error getting ${type} ${id}:`, error);
            return null;
        }
    }

    /**
     * Recherche optimisée
     */
    async search(type, query, options = {}) {
        // Recherche d'abord dans le cache local
        if (this.cache[type] && !options.forceRefresh) {
            const lowerQuery = query.toLowerCase();
            const results = this.cache[type].filter(item => {
                const searchable = `${item.title} ${item.content} ${item.author}`.toLowerCase();
                return searchable.includes(lowerQuery);
            });
            
            if (results.length > 0) {
                this.metrics.cacheHits++;
                return results;
            }
        }
        
        // Si pas de résultats en cache, chercher via API
        this.metrics.totalRequests++;
        return await this.db.search(type, query, options);
    }

    /**
     * Rafraîchir le cache pour un type
     */
    async refreshCache(type) {
        try {
            const result = await this.db.getPaginated(type, {
                limit: 50,
                status: 'active'
            });
            
            this.cache[type] = result.Items || [];
            
            // Notifier l'app
            if (window.app && window.app.onDatabaseUpdate) {
                window.app.onDatabaseUpdate(type, this.cache[type]);
            }
            
            return this.cache[type];
        } catch (error) {
            console.error(`Error refreshing cache for ${type}:`, error);
            return this.cache[type] || [];
        }
    }

    /**
     * Compatibilité avec l'ancien système
     */
    async load() {
        // Méthode de compatibilité - retourne le cache actuel
        return {
            news: this.cache.news || [],
            animations: this.cache.animations || [],
            blocks: this.cache.blocks || [],
            conductors: this.cache.conductors || [],
            habillage: this.cache.habillage || []
        };
    }

    /**
     * Sauvegarder toutes les données (compatibilité)
     */
    async saveAll(data) {
        // Sauvegarder chaque type séparément
        const promises = [];
        
        for (const [type, items] of Object.entries(data)) {
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item && item.id) {
                        promises.push(this.save(type, item));
                    }
                }
            }
        }
        
        await Promise.all(promises);
        return true;
    }

    /**
     * Obtenir les métriques de performance
     */
    getMetrics() {
        const hitRate = this.metrics.cacheHits / 
            (this.metrics.totalRequests + this.metrics.cacheHits) * 100 || 0;
        
        return {
            ...this.metrics,
            cacheHitRate: `${hitRate.toFixed(1)}%`,
            dbMetrics: this.db?.getMetrics(),
            cacheSize: {
                news: this.cache.news?.length || 0,
                animations: this.cache.animations?.length || 0,
                blocks: this.cache.blocks?.length || 0
            }
        };
    }

    /**
     * Gestion des fichiers audio (compatibilité)
     */
    async uploadAudioFile(file, folder = 'audio') {
        if (!this.s3) {
            throw new Error('S3 client not initialized');
        }
        
        const key = `${folder}/${Date.now()}-${file.name}`;
        const params = {
            Bucket: this.bucket,
            Key: key,
            Body: file,
            ContentType: file.type || 'audio/mpeg'
        };
        
        try {
            await this.s3.upload(params).promise();
            return {
                id: key,
                url: `https://${this.bucket}.s3.eu-west-3.amazonaws.com/${key}`,
                name: file.name,
                size: file.size
            };
        } catch (error) {
            console.error('Error uploading audio:', error);
            throw error;
        }
    }

    async deleteAudioFile(fileId) {
        if (!this.s3 || !fileId) return false;
        
        try {
            await this.s3.deleteObject({
                Bucket: this.bucket,
                Key: fileId
            }).promise();
            return true;
        } catch (error) {
            console.error('Error deleting audio:', error);
            return false;
        }
    }

    /**
     * Méthodes utilitaires
     */
    setUserId(userId) {
        this.userId = userId;
        this.currentFilter.userId = userId;
    }

    setFilter(showOnlyMine) {
        this.currentFilter.showOnlyMine = showOnlyMine;
        if (showOnlyMine) {
            this.currentFilter.userId = this.userId;
        } else {
            this.currentFilter.userId = null;
        }
    }

    clearCache() {
        this.cache = {
            news: [],
            animations: [],
            blocks: [],
            conductors: [],
            habillage: []
        };
        console.log('🗑️ Cache cleared');
    }
}

// Export global
window.StorageDynamoDBOptimized = StorageDynamoDBOptimized;