/**
 * Storage DynamoDB pour Saint-Esprit
 * Remplace le storage S3/JSON par DynamoDB
 */

class StorageDynamoDB {
    constructor() {
        this.db = new DynamoDBClient();
        this.userId = null;
        this.initialized = false;
        this.credentials = null;
        this.s3 = null; // Client S3 pour compatibilité
        this._cacheBustTimestamp = 0;
        this.cacheManager = null;
        
        this.bucket = 'amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke';

        // Cache local pour optimisation
        this.cache = {
            news: [],
            animations: [],
            blocks: [],
            conductors: [],
            journals: []
        };
        
        // Filtre actuel (null = tout afficher)
        this.currentFilter = {
            userId: null, // null = tous les utilisateurs
            showOnlyMine: false
        };
    }

    async init() {
        try {
            console.log('🚀 Initializing DynamoDB Storage...');
            
            // Attendre que l'auth soit prête
            if (window.authManager && window.authManager.isAuthenticated()) {
                this.userId = window.authManager.getUserId();
            }
            
            // Récupérer les credentials AWS depuis Cognito
            // Les credentials sont déjà configurés par cognito-auth.js
            if (!AWS.config.credentials) {
                console.warn('⚠️ AWS credentials not yet configured, waiting for auth...');
                // Attendre un peu que cognito-auth configure les credentials
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (AWS.config.credentials) {
                // Si les credentials existent mais ne sont pas encore chargés
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
                        // Continuer sans credentials, ils seront configurés plus tard
                    }
                }
                this.credentials = AWS.config.credentials;
                console.log('✅ AWS credentials configured');
                
                // Initialiser le client S3 pour compatibilité
                this.s3 = new AWS.S3({
                    region: 'eu-west-3',
                    credentials: this.credentials
                });
            } else {
                console.warn('⚠️ Running without AWS credentials (will use Cognito Identity Pool)');
            }
            
            // Initialiser le client DynamoDB
            await this.db.init();
            
            // Charger les données initiales (TOUT le monde)
            await this.loadAllData();
            
            // Notifier l'app que les données sont chargées
            if (window.app && window.app.onDatabaseUpdate) {
                if (this.cache.news) window.app.onDatabaseUpdate('news', this.cache.news);
                if (this.cache.animations) window.app.onDatabaseUpdate('animations', this.cache.animations);
                if (this.cache.blocks) window.app.onDatabaseUpdate('blocks', this.cache.blocks);
                if (this.cache.conductors) window.app.onDatabaseUpdate('conductors', this.cache.conductors);
            }
            
            this.initialized = true;
            console.log('✅ DynamoDB Storage initialized');
            
            return true;
        } catch (error) {
            console.error('❌ Storage init failed:', error);
            throw error;
        }
    }

    /**
     * Charger toutes les données depuis DynamoDB
     */
    async loadAllData() {
        try {
            console.log('📥 Loading all data from DynamoDB...');
            
            // Charger TOUT le contenu de TOUS les utilisateurs
            // OPTIMISATION: Utiliser Query pour blocks si possible
            const [news, animations, blocks, conductors, journals] = await Promise.all([
                this.db.getAll('news'),
                this.db.getAll('animations'),
                this.loadOptimizedBlocks(), // Méthode optimisée pour blocks
                this.db.getAll('conductors'),
                this.db.getAll('journals')
            ]);

            const filteredNews = news;

            // Convertir les durées "M:SS" en secondes
            filteredNews.forEach(item => {
                if (item.duration && typeof item.duration === 'string' && item.duration.includes(':')) {
                    const [mins, secs] = item.duration.split(':').map(Number);
                    item.duration = (mins * 60) + secs;
                }
            });

            // Corriger toutes les URLs audio pour utiliser S3 direct
            const fixer = window.audioUrlFixer || new (window.AudioUrlFixer || class {
                fixItemsArray(items) { return items; }
            })();

            // Mettre en cache avec URLs corrigées
            this.cache.news = fixer.fixItemsArray(filteredNews);
            this.cache.animations = fixer.fixItemsArray(animations);
            this.cache.blocks = fixer.fixItemsArray(blocks);
            this.cache.conductors = fixer.fixItemsArray(conductors);
            this.cache.journals = journals; // Les journaux n'ont pas d'URLs audio

            console.log(`✅ Loaded: ${filteredNews.length} news, ${animations.length} animations, ${blocks.length} blocks, ${conductors.length} conductors, ${journals.length} journals`);
            
            // Détail des conducteurs si plusieurs
            if (conductors.length > 1) {
                console.warn('⚠️ Attention: Plusieurs conducteurs trouvés dans la base:', conductors.map(c => ({
                    id: c.id,
                    createdAt: c.createdAt,
                    segments: c.segments ? c.segments.length : 0,
                    userId: c.userId
                })));
            }
            
            return {
                news: this.cache.news,
                animations: this.cache.animations,
                blocks: this.cache.blocks,
                conductors: this.cache.conductors,
                journals: this.cache.journals
            };
        } catch (error) {
            console.error('❌ Error loading data:', error);
            return {
                news: [],
                animations: [],
                blocks: [],
                conductors: [],
                journals: []
            };
        }
    }

    /**
     * Méthode load() pour compatibilité avec l'interface Storage
     * Retourne les données du cache (déjà chargées par init)
     */
    async load() {
        // Si les données ne sont pas encore chargées, les charger
        if (!this.initialized ||
            (!this.cache.news && !this.cache.animations && !this.cache.blocks && !this.cache.conductors && !this.cache.journals)) {
            console.log('📥 Cache vide, rechargement depuis DynamoDB...');
            await this.loadAllData();
        }

        // Retourner les données du cache
        return {
            news: this.cache.news || [],
            animations: this.cache.animations || [],
            blocks: this.cache.blocks || [],
            conductors: this.cache.conductors || [],
            journals: this.cache.journals || [],
            settings: {} // Settings non implémenté pour l'instant
        };
    }

    /**
     * Charger les blocks de manière optimisée avec Query au lieu de Scan
     */
    async loadOptimizedBlocks() {
        try {
            // Si on a un userId, utiliser Query avec l'index GSI
            if (this.userId) {
                console.log('🚀 Using optimized Query for blocks (userId:', this.userId, ')');
                return await this.db.getBlocksByUser(this.userId);
            }
            // Sinon, fallback sur getAll (mais essayer de limiter)
            console.log('⚠️ Fallback to getAll for blocks (no userId)');
            return await this.db.getAll('blocks');
        } catch (error) {
            console.error('Error loading optimized blocks:', error);
            // Fallback sur la méthode standard
            return await this.db.getAll('blocks');
        }
    }

    /**
     * Récupérer les données avec filtre optionnel
     */
    async load(filter = null) {
        if (!this.initialized) await this.init();

        // Si pas de filtre, retourner tout
        if (!filter || (!filter.userId && !filter.showOnlyMine)) {
            return {
                news: this.cache.news,
                animations: this.cache.animations,
                blocks: this.cache.blocks,
                conductors: this.cache.conductors,
                journals: this.cache.journals
            };
        }

        // Appliquer le filtre
        const userId = filter.showOnlyMine ? this.userId : filter.userId;

        if (userId) {
            return {
                news: this.cache.news.filter(item => item.userId === userId),
                animations: this.cache.animations.filter(item => item.userId === userId),
                blocks: this.cache.blocks.filter(item => item.userId === userId),
                conductors: this.cache.conductors.filter(item => item.userId === userId),
                journals: this.cache.journals.filter(item => item.userId === userId)
            };
        }

        return {
            news: this.cache.news,
            animations: this.cache.animations,
            blocks: this.cache.blocks,
            conductors: this.cache.conductors,
            journals: this.cache.journals
        };
    }

    /**
     * Définir le cache manager
     */
    setCacheManager(cacheManager) {
        this.cacheManager = cacheManager;
    }

    /**
     * Sauvegarder un item
     */
    async saveItem(type, item) {
        if (!this.initialized) await this.init();
        
        try {
            // Corriger les URLs audio AVANT de sauvegarder
            let itemToSave = { ...item };
            if (window.audioUrlFixer && itemToSave.sounds) {
                itemToSave = window.audioUrlFixer.fixItem(itemToSave);
            }
            
            let savedItem;
            
            // Si l'item existe (a un id et createdAt), faire un update
            if (itemToSave.id && itemToSave.createdAt !== undefined) {
                // Retirer les champs qui ne doivent pas être dans les updates
                const { id, createdAt, updatedAt, ...updates } = itemToSave;
                savedItem = await this.db.update(type, itemToSave.id, itemToSave.createdAt, updates);
            } else {
                // Sinon créer un nouveau
                savedItem = await this.db.create(type, itemToSave);
            }
            
            // Mettre à jour le cache
            await this.refreshCache(type);
            
            // APRÈS la sauvegarde, recharger IMMÉDIATEMENT
            await this.loadAllData();
            
            // Notifier le cache manager si présent
            if (this.cacheManager) {
                console.log('🔄 Notification cache manager après sauvegarde');
                this.cacheManager.notifyAllManagers();
            } else {
                // Fallback : notification directe
                if (window.app && window.app.onDatabaseUpdate) {
                    window.app.onDatabaseUpdate(type, this.cache[type]);
                }
            }
            
            console.log('✅ Sauvegarde terminée avec reload automatique');
            
            return savedItem;
        } catch (error) {
            console.error(`❌ Error saving ${type}:`, error);
            throw error;
        }
    }

    /**
     * Supprimer un item
     */
    async deleteItem(type, id, createdAt) {
        if (!this.initialized) await this.init();
        
        try {
            const success = await this.db.delete(type, id, createdAt);
            
            if (success) {
                // Mettre à jour le cache
                await this.refreshCache(type);
                
                // Notifier
                if (window.app && typeof window.app.onDatabaseUpdate === 'function') {
                    window.app.onDatabaseUpdate(type, this.cache[type]);
                }
            }
            
            return success;
        } catch (error) {
            console.error(`❌ Error deleting ${type}:`, error);
            return false;
        }
    }

    /**
     * Rafraîchir le cache pour un type donné
     */
    async refreshCache(type) {
        try {
            let data = await this.db.getAll(type);

            console.log(`🔄 Cache refreshed for ${type}: ${data.length} items`);

            this.cache[type] = data;
        } catch (error) {
            console.error(`❌ Error refreshing cache for ${type}:`, error);
        }
    }

    /**
     * Sauvegarder en batch (pour compatibilité)
     */
    async save(data) {
        if (!this.initialized) await this.init();
        
        try {
            const promises = [];
            
            // Nettoyer les données audio base64 avant sauvegarde
            const cleanData = (items) => {
                return items.map(item => {
                    const cleaned = { ...item };
                    // Supprimer les données audio base64 volumineuses
                    if (cleaned.audioData && cleaned.audioData.length > 10000) {
                        delete cleaned.audioData;
                    }
                    // Nettoyer les sons avec base64
                    if (cleaned.sounds && Array.isArray(cleaned.sounds)) {
                        cleaned.sounds = cleaned.sounds.map(sound => {
                            if (sound.data && sound.data.startsWith('data:audio') && sound.data.length > 10000) {
                                // Garder seulement l'URL S3 si elle existe
                                return { ...sound, data: sound.url || '' };
                            }
                            return sound;
                        });
                    }
                    return cleaned;
                });
            };
            
            // Sauvegarder chaque type si présent
            if (data.news && data.news.length > 0) {
                promises.push(this.db.batchWrite('news', cleanData(data.news)));
            }
            if (data.animations && data.animations.length > 0) {
                promises.push(this.db.batchWrite('animations', cleanData(data.animations)));
            }
            // Pour les blocks, gérer aussi les suppressions
            if (data.blocks !== undefined) {
                if (data.blocks.length > 0) {
                    promises.push(this.db.batchWrite('blocks', cleanData(data.blocks)));
                }
                // Supprimer les blocks qui ne sont plus dans la liste
                const currentBlockIds = new Set(data.blocks.map(b => b.id));
                const existingBlocks = this.cache.blocks || [];
                const blocksToDelete = existingBlocks.filter(b => !currentBlockIds.has(b.id));
                for (const block of blocksToDelete) {
                    promises.push(this.deleteItem('blocks', block.id, block.createdAt));
                }
            }
            // Pour les conducteurs, on ne garde qu'UN SEUL conducteur actif
            if (data.conductors !== undefined) {
                console.log('🔄 Gestion des conducteurs:', {
                    nouveauxConducteurs: data.conductors ? data.conductors.length : 0,
                    existants: this.cache.conductors ? this.cache.conductors.length : 0
                });
                
                // D'abord supprimer tous les anciens conducteurs
                const existingConductors = this.cache.conductors || [];
                if (existingConductors.length > 0) {
                    console.log('🗑️ Suppression des anciens conducteurs:', existingConductors.map(c => ({
                        id: c.id,
                        segments: c.segments ? c.segments.length : 0
                    })));
                }
                for (const conductor of existingConductors) {
                    promises.push(this.deleteItem('conductors', conductor.id, conductor.createdAt));
                }
                
                // Puis sauvegarder le nouveau conducteur si présent
                if (data.conductors && data.conductors.length > 0) {
                    console.log('💾 Sauvegarde du nouveau conducteur:', {
                        id: data.conductors[0].id,
                        segments: data.conductors[0].segments ? data.conductors[0].segments.length : 0
                    });
                    if (data.conductors[0].segments && data.conductors[0].segments.length > 0) {
                        console.log('📄 Détail des segments à sauvegarder:', data.conductors[0].segments.map(s => ({
                            id: s.id,
                            type: s.type,
                            title: s.title,
                            parentId: s.parentId
                        })));
                    }
                    // Nettoyer aussi les conducteurs pour éviter les problèmes de taille
                    const cleanConductors = data.conductors.map(conductor => {
                    const cleaned = { ...conductor };
                    // Supprimer le contenu des segments si présent
                    if (cleaned.segments && Array.isArray(cleaned.segments)) {
                        cleaned.segments = cleaned.segments.map(segment => {
                            const cleanSegment = { ...segment };
                            // Supprimer le contenu volumineux
                            delete cleanSegment.content;
                            delete cleanSegment.audioData;
                            if (cleanSegment.sounds && Array.isArray(cleanSegment.sounds)) {
                                delete cleanSegment.sounds;
                            }
                            return cleanSegment;
                        });
                    }
                    return cleaned;
                });
                    promises.push(this.db.batchWrite('conductors', cleanConductors));
                }
            }
            
            await Promise.all(promises);
            
            // Rafraîchir tout le cache
            await this.loadAllData();
            
            // Notifier l'app pour rafraîchir l'affichage
            if (window.app && window.app.onDatabaseUpdate) {
                if (this.cache.news) window.app.onDatabaseUpdate('news', this.cache.news);
                if (this.cache.animations) window.app.onDatabaseUpdate('animations', this.cache.animations);
                if (this.cache.blocks) window.app.onDatabaseUpdate('blocks', this.cache.blocks);
                if (this.cache.conductors) window.app.onDatabaseUpdate('conductors', this.cache.conductors);
            }
            
            console.log('✅ Batch save complete');
            return true;
        } catch (error) {
            console.error('❌ Error in batch save:', error);
            return false;
        }
    }

    /**
     * Définir le filtre actuel
     */
    setFilter(filter) {
        this.currentFilter = filter;
        console.log('🔍 Filter updated:', filter);
        
        // Notifier l'app pour re-render
        if (window.app) {
            this.load(filter).then(data => {
                if (data.news) window.app.onDatabaseUpdate('news', data.news);
                if (data.animations) window.app.onDatabaseUpdate('animations', data.animations);
                if (data.blocks) window.app.onDatabaseUpdate('blocks', data.blocks);
                if (data.conductors) window.app.onDatabaseUpdate('conductors', data.conductors);
            });
        }
    }

    /**
     * Migration depuis l'ancien système JSON
     */
    async migrateFromOldStorage() {
        try {
            console.log('🔄 Starting migration from old storage...');
            
            // Essayer de charger les anciennes données
            const oldStorage = new Storage(); // Ancien storage S3
            await oldStorage.init();
            const oldData = await oldStorage.load();
            
            if (oldData) {
                // Migrer chaque type
                if (oldData.news && oldData.news.length > 0) {
                    console.log(`Migrating ${oldData.news.length} news...`);
                    await this.db.migrateFromJSON('news', oldData.news);
                }
                
                if (oldData.animations && oldData.animations.length > 0) {
                    console.log(`Migrating ${oldData.animations.length} animations...`);
                    await this.db.migrateFromJSON('animations', oldData.animations);
                }
                
                if (oldData.blocks && oldData.blocks.length > 0) {
                    console.log(`Migrating ${oldData.blocks.length} blocks...`);
                    await this.db.migrateFromJSON('blocks', oldData.blocks);
                }
                
                if (oldData.conductors && oldData.conductors.length > 0) {
                    console.log(`Migrating ${oldData.conductors.length} conductors...`);
                    await this.db.migrateFromJSON('conductors', oldData.conductors);
                }
                
                console.log('✅ Migration complete!');
                
                // Rafraîchir le cache
                await this.loadAllData();
            }
        } catch (error) {
            console.error('❌ Migration failed:', error);
        }
    }

    /**
     * Méthodes de compatibilité avec l'ancien storage
     */
    
    async saveAudioFile(audioFileId, audioData) {
        // Upload direct vers S3 pour les fichiers audio
        try {
            // Utiliser les credentials globaux ou ceux de l'instance
            const s3 = new AWS.S3({
                region: 'eu-west-3',
                credentials: this.credentials || AWS.config.credentials
            });
            
            const key = `audio/${this.userId}/${audioFileId}`;
            
            // Déterminer le source du fichier
            let fileSource;
            if (audioData.data instanceof File || audioData.data instanceof Blob) {
                fileSource = audioData.data;
            } else if (audioData.blob) {
                fileSource = audioData.blob;
            } else if (audioData instanceof Blob || audioData instanceof File) {
                fileSource = audioData;
            } else {
                throw new Error('Format audio non supporté');
            }
            
            // Convertir File/Blob en ArrayBuffer pour AWS SDK
            // Utiliser FileReader pour compatibilité maximale
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(fileSource);
            });
            const body = new Uint8Array(arrayBuffer);
            
            const params = {
                Bucket: 'saint-esprit-audio',
                Key: key,
                Body: body,
                ContentType: audioData.type || fileSource.type || 'audio/mp3'
            };
            
            const result = await s3.upload(params).promise();
            console.log('✅ Audio uploaded to S3:', result.Location);
            
            return {
                url: result.Location,
                key: key,
                bucket: 'saint-esprit-audio'
            };
        } catch (error) {
            console.error('❌ Error uploading audio to S3:', error);
            throw error;
        }
    }
    
    async getAudioFile(audioFileId) {
        // Récupération depuis S3
        try {
            const s3 = new AWS.S3({
                region: 'eu-west-3',
                credentials: this.credentials || AWS.config.credentials
            });
            
            const key = `audio/${this.userId}/${audioFileId}`;
            const url = `https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/${key}`;
            
            return {
                url: url,
                data: url,  // Pour compatibilité avec l'ancien code
                key: key,
                bucket: 'saint-esprit-audio'
            };
        } catch (error) {
            console.error('❌ Error getting audio from S3:', error);
            throw error;
        }
    }
    
    async deleteAudioFile(audioFileId) {
        try {
            const s3 = new AWS.S3({
                region: 'eu-west-3',
                credentials: this.credentials || AWS.config.credentials
            });
            
            const key = `audio/${this.userId}/${audioFileId}`;
            
            await s3.deleteObject({
                Bucket: 'saint-esprit-audio',
                Key: key
            }).promise();
            
            console.log('✅ Audio deleted from S3:', key);
            return true;
        } catch (error) {
            console.error('❌ Error deleting audio from S3:', error);
            throw error;
        }
    }
    
    getCurrentUser() {
        return {
            userId: this.userId,
            name: window.authManager?.getCurrentUserFullName() || 'Unknown'
        };
    }
    
    /**
     * Récupérer tous les fichiers audio (pour AudioEditor)
     */
    async getAllAudioFiles() {
        try {
            const s3 = new AWS.S3({
                region: 'eu-west-3',
                credentials: this.credentials || AWS.config.credentials
            });
            
            // Lister les fichiers audio de l'utilisateur
            const params = {
                Bucket: 'saint-esprit-audio',
                Prefix: `audio/${this.userId}/`
            };
            
            const data = await s3.listObjectsV2(params).promise();
            
            if (!data.Contents) return [];
            
            return data.Contents.map(item => ({
                key: item.Key,
                name: item.Key.split('/').pop(),
                size: item.Size,
                lastModified: item.LastModified,
                url: `https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/${item.Key}`
            }));
        } catch (error) {
            console.error('❌ Error listing audio files:', error);
            return [];
        }
    }

    /**
     * Récupérer les statistiques
     */
    getStats() {
        return {
            totalNews: this.cache.news.length,
            totalAnimations: this.cache.animations.length,
            totalBlocks: this.cache.blocks.length,
            totalConductors: this.cache.conductors.length,
            myNews: this.cache.news.filter(n => n.userId === this.userId).length,
            myAnimations: this.cache.animations.filter(a => a.userId === this.userId).length,
            activeUsers: [...new Set([
                ...this.cache.news.map(n => n.userId),
                ...this.cache.animations.map(a => a.userId)
            ])].length
        };
    }

    /**
     * Créer une sauvegarde (non nécessaire avec DynamoDB)
     */
    async createBackup() {
        // Pas de backup nécessaire, DynamoDB gère la persistance
        console.log('✅ DynamoDB assure la persistance automatique');
        return true;
    }
    
    /**
     * Méthodes S3 pour compatibilité
     */
    getObject(params) {
        if (!this.s3) {
            this.s3 = new AWS.S3({
                region: 'eu-west-3',
                credentials: this.credentials || AWS.config.credentials
            });
        }
        // Retourner l'objet AWS S3 qui a la méthode .promise()
        return this.s3.getObject(params);
    }

    listObjectsV2(params) {
        if (!this.s3) {
            this.s3 = new AWS.S3({
                region: 'eu-west-3',
                credentials: this.credentials || AWS.config.credentials
            });
        }
        // Retourner l'objet AWS S3 qui a la méthode .promise()
        return this.s3.listObjectsV2(params);
    }

    putObject(params) {
        if (!this.s3) {
            this.s3 = new AWS.S3({
                region: 'eu-west-3',
                credentials: this.credentials || AWS.config.credentials
            });
        }
        // Retourner l'objet AWS S3 qui a la méthode .promise()
        return this.s3.putObject(params);
    }

    deleteObject(params) {
        if (!this.s3) {
            this.s3 = new AWS.S3({
                region: 'eu-west-3',
                credentials: this.credentials || AWS.config.credentials
            });
        }
        // Retourner l'objet AWS S3 qui a la méthode .promise()
        return this.s3.deleteObject(params);
    }

    /**
     * JOURNAUX - Méthodes spécifiques
     */

    async getAllJournals() {
        if (!this.initialized) await this.init();
        return this.cache.journals || [];
    }

    async saveJournal(journal) {
        if (!this.initialized) await this.init();

        try {
            console.log('💾 Saving journal:', journal);

            // Si le journal existe déjà (a un createdAt), faire un update
            if (journal.createdAt !== undefined) {
                const { id, createdAt, updatedAt, ...updates } = journal;
                await this.db.update('journals', journal.id, journal.createdAt, updates);
            } else {
                // Sinon créer un nouveau
                await this.db.create('journals', journal);
            }

            // Rafraîchir le cache
            await this.refreshCache('journals');

            console.log('✅ Journal saved successfully');
            return journal;
        } catch (error) {
            console.error('❌ Error saving journal:', error);
            throw error;
        }
    }

    async deleteJournal(journalId) {
        if (!this.initialized) await this.init();

        try {
            // Trouver le journal pour obtenir createdAt
            const journal = this.cache.journals.find(j => j.id === journalId);
            if (!journal) {
                console.error('Journal not found:', journalId);
                return false;
            }

            console.log('🗑️ Deleting journal:', journalId);
            const success = await this.db.delete('journals', journalId, journal.createdAt);

            if (success) {
                // Rafraîchir le cache
                await this.refreshCache('journals');
                console.log('✅ Journal deleted successfully');
            }

            return success;
        } catch (error) {
            console.error('❌ Error deleting journal:', error);
            return false;
        }
    }

    /**
     * CONDUCTEURS - Méthodes spécifiques (compatibilité)
     */

    async getAllConductors() {
        if (!this.initialized) await this.init();
        return this.cache.conductors || [];
    }

    async saveConductor(conductor) {
        if (!this.initialized) await this.init();

        try {
            console.log('💾 Saving conductor:', conductor);

            // Si le conducteur existe déjà (a un createdAt), faire un update
            if (conductor.createdAt !== undefined) {
                const { id, createdAt, updatedAt, ...updates } = conductor;
                await this.db.update('conductors', conductor.id, conductor.createdAt, updates);
            } else {
                // Sinon créer un nouveau
                await this.db.create('conductors', conductor);
            }

            // Rafraîchir le cache
            await this.refreshCache('conductors');

            console.log('✅ Conductor saved successfully');
            return conductor;
        } catch (error) {
            console.error('❌ Error saving conductor:', error);
            throw error;
        }
    }

    async deleteConductor(conductorId) {
        if (!this.initialized) await this.init();

        try {
            // Trouver le conducteur pour obtenir createdAt
            const conductor = this.cache.conductors.find(c => c.id === conductorId);
            if (!conductor) {
                console.error('Conductor not found:', conductorId);
                return false;
            }

            console.log('🗑️ Deleting conductor:', conductorId);
            const success = await this.db.delete('conductors', conductorId, conductor.createdAt);

            if (success) {
                // Rafraîchir le cache
                await this.refreshCache('conductors');
                console.log('✅ Conductor deleted successfully');
            }

            return success;
        } catch (error) {
            console.error('❌ Error deleting conductor:', error);
            return false;
        }
    }
}

// Export global
window.StorageDynamoDB = StorageDynamoDB;
// Alias pour la compatibilité avec l'ancien code
window.Storage = StorageDynamoDB;