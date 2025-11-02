/**
 * Client DynamoDB Optimisé pour Saint-Esprit
 * Version haute performance avec pagination native et cache intelligent
 */

class DynamoDBOptimized {
    constructor() {
        this.region = window.AWSConfig?.region || 'eu-west-3';
        this.initialized = false;
        this.client = null;
        
        // Tables DynamoDB
        this.tables = window.AWSConfig?.tables || {
            news: 'saint-esprit-news',
            animations: 'saint-esprit-animations',
            blocks: 'saint-esprit-blocks',
            conductors: 'saint-esprit-conductors',
            audio: 'saint-esprit-audio',
            habillage: 'saint-esprit-habillage'
        };
        
        // Cache intelligent avec TTL
        this.cache = new SmartCache(5 * 60 * 1000); // 5 minutes TTL
        
        // Métriques de performance
        this.metrics = {
            scanCount: 0,
            queryCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalRCU: 0
        };
    }
    
    /**
     * Initialiser le client optimisé
     */
    async init() {
        try {
            console.log('🚀 Initializing Optimized DynamoDB Client...');
            
            // Vérifier l'authentification
            if (!window.authManager?.isAuthenticated()) {
                throw new Error('User not authenticated');
            }
            
            // Configurer AWS SDK avec les credentials Cognito
            const idToken = window.authManager.getIdToken();
            
            AWS.config.update({
                region: this.region,
                credentials: new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: window.AWSConfig.identityPoolId,
                    Logins: {
                        [`cognito-idp.${this.region}.amazonaws.com/${window.AWSConfig.userPoolId}`]: idToken
                    }
                })
            });
            
            // Créer le client DynamoDB DocumentClient
            this.client = new AWS.DynamoDB.DocumentClient({
                maxRetries: 3,
                retryDelayOptions: {
                    base: 200 // Délai de base pour les retry
                }
            });
            
            this.initialized = true;
            console.log('✅ Optimized DynamoDB client initialized');
            
            // Charger uniquement les données essentielles au démarrage
            await this.loadEssentialData();
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize optimized client:', error);
            throw error;
        }
    }
    
    /**
     * Charger uniquement les données essentielles (dernières news actives)
     */
    async loadEssentialData() {
        try {
            // Charger seulement les 20 dernières news actives
            const recentNews = await this.getPaginated('news', {
                limit: 20,
                status: 'active'
            });
            
            // Mettre en cache
            this.cache.set('news:recent', recentNews.Items);
            
            // Notifier l'application
            if (window.app?.onDatabaseUpdate) {
                window.app.onDatabaseUpdate('news', recentNews.Items);
            }
            
            console.log(`✅ Loaded ${recentNews.Items.length} essential news items`);
        } catch (error) {
            console.error('❌ Error loading essential data:', error);
        }
    }
    
    /**
     * Récupération paginée optimisée
     */
    async getPaginated(tableName, options = {}) {
        if (!this.initialized) await this.init();
        
        const {
            limit = 20,
            lastKey = null,
            userId = null,
            status = null,
            category = null,
            useCache = true
        } = options;
        
        // Vérifier le cache en premier
        if (useCache) {
            const cacheKey = `${tableName}:${JSON.stringify(options)}`;
            const cachedData = this.cache.get(cacheKey);
            if (cachedData) {
                this.metrics.cacheHits++;
                console.log('📦 Cache hit for:', cacheKey);
                return cachedData;
            }
            this.metrics.cacheMisses++;
        }
        
        // Vérifier que tableName existe
        if (!this.tables[tableName]) {
            console.error(`❌ Table ${tableName} not found in config`);
            return {
                Items: [],
                LastEvaluatedKey: null,
                Count: 0,
                hasMore: false
            };
        }
        
        const params = {
            TableName: this.tables[tableName],
            Limit: limit,
            ScanIndexForward: false // Plus récent en premier
        };
        
        if (lastKey) {
            params.ExclusiveStartKey = lastKey;
        }
        
        let result;
        
        // Stratégie 1: Query par userId (utilise GSI)
        if (userId) {
            params.IndexName = 'userId-createdAt-index';
            params.KeyConditionExpression = 'userId = :uid';
            params.ExpressionAttributeValues = { ':uid': userId };
            
            if (status) {
                params.FilterExpression = '#status = :status';
                params.ExpressionAttributeNames = { '#status': 'status' };
                params.ExpressionAttributeValues['status'] = status;
            }
            
            console.log('🔍 Query by userId:', userId);
            result = await this.client.query(params).promise();
            this.metrics.queryCount++;
        }
        // Stratégie 2: Si status demandé mais pas d'index, utiliser Scan avec filtre
        else if (status) {
            // L'index status-createdAt n'existe pas, utiliser Scan avec FilterExpression
            params.FilterExpression = '#status = :status';
            params.ExpressionAttributeNames = { '#status': 'status' };
            params.ExpressionAttributeValues = { ':status': status };
            
            console.log('📊 Scan with status filter:', status);
            result = await this.client.scan(params).promise();
            this.metrics.scanCount++;
        }
        // Stratégie 3: Scan paginé (dernier recours)
        else {
            // Construire les filtres si nécessaire
            if (category) {
                params.FilterExpression = 'category = :cat';
                params.ExpressionAttributeValues = { ':cat': category };
            }
            
            console.log('📊 Paginated scan with limit:', limit);
            result = await this.client.scan(params).promise();
            this.metrics.scanCount++;
        }
        
        // Estimer les RCU consommées
        this.metrics.totalRCU += result.ConsumedCapacity?.ReadCapacityUnits || 0;
        
        // Formater la réponse
        const response = {
            Items: result.Items || [],
            LastEvaluatedKey: result.LastEvaluatedKey || null,
            Count: result.Count || 0,
            hasMore: !!result.LastEvaluatedKey
        };
        
        // Mettre en cache si demandé
        if (useCache) {
            const cacheKey = `${tableName}:${JSON.stringify(options)}`;
            this.cache.set(cacheKey, response);
        }
        
        console.log(`✅ Retrieved ${response.Count} items from ${tableName}`);
        return response;
    }
    
    /**
     * Créer ou mettre à jour un item avec optimisations
     */
    async upsert(tableName, item) {
        if (!this.initialized) await this.init();
        
        // Préparer l'item
        const now = Date.now();
        const preparedItem = {
            ...item,
            id: item.id?.toString() || this.generateId(),
            createdAt: item.createdAt || now,
            updatedAt: now,
            userId: item.userId || window.authManager?.getUserId() || 'unknown',
            author: item.author || window.authManager?.getCurrentUserFullName() || 'Unknown',
            status: item.status || 'draft'
        };
        
        // Optimisation: Update conditionnel pour éviter les écrasements
        const params = {
            TableName: this.tables[tableName],
            Item: preparedItem,
            ConditionExpression: 'attribute_not_exists(id) OR updatedAt < :now',
            ExpressionAttributeValues: {
                ':now': now
            },
            ReturnConsumedCapacity: 'TOTAL'
        };
        
        try {
            const result = await this.client.put(params).promise();
            
            // Invalider le cache pour cette table
            this.cache.invalidate(tableName);
            
            console.log(`✅ Upserted item in ${tableName}:`, preparedItem.id);
            console.log(`📊 WCU consumed:`, result.ConsumedCapacity?.WriteCapacityUnits);
            
            return preparedItem;
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                console.warn('⚠️ Item was modified by another user, retry needed');
            }
            throw error;
        }
    }
    
    /**
     * Suppression optimisée
     */
    async delete(tableName, id, createdAt) {
        if (!this.initialized) await this.init();
        
        const params = {
            TableName: this.tables[tableName],
            Key: {
                id: id.toString(),
                createdAt: Number(createdAt)
            },
            ReturnConsumedCapacity: 'TOTAL'
        };
        
        try {
            const result = await this.client.delete(params).promise();
            
            // Invalider le cache
            this.cache.invalidate(tableName);
            
            console.log(`✅ Deleted item from ${tableName}:`, id);
            console.log(`📊 WCU consumed:`, result.ConsumedCapacity?.WriteCapacityUnits);
            
            return true;
        } catch (error) {
            console.error(`❌ Error deleting from ${tableName}:`, error);
            throw error;
        }
    }
    
    /**
     * Batch get pour récupérer plusieurs items d'un coup
     */
    async batchGet(tableName, keys) {
        if (!this.initialized) await this.init();
        
        // Diviser en chunks de 100 (limite DynamoDB)
        const chunks = [];
        for (let i = 0; i < keys.length; i += 100) {
            chunks.push(keys.slice(i, i + 100));
        }
        
        const allItems = [];
        
        for (const chunk of chunks) {
            const params = {
                RequestItems: {
                    [this.tables[tableName]]: {
                        Keys: chunk.map(key => ({
                            id: key.id.toString(),
                            createdAt: Number(key.createdAt)
                        }))
                    }
                },
                ReturnConsumedCapacity: 'TOTAL'
            };
            
            const result = await this.client.batchGet(params).promise();
            const items = result.Responses?.[this.tables[tableName]] || [];
            allItems.push(...items);
            
            this.metrics.totalRCU += result.ConsumedCapacity?.[0]?.ReadCapacityUnits || 0;
        }
        
        console.log(`✅ Batch retrieved ${allItems.length} items from ${tableName}`);
        return allItems;
    }
    
    /**
     * Générer un ID unique
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Obtenir les métriques de performance
     */
    getMetrics() {
        const hitRate = this.metrics.cacheHits / 
            (this.metrics.cacheHits + this.metrics.cacheMisses) * 100 || 0;
        
        return {
            ...this.metrics,
            cacheHitRate: `${hitRate.toFixed(1)}%`,
            estimatedCost: {
                read: `$${(this.metrics.totalRCU * 0.00013).toFixed(4)}`,
                scansVsQueries: `${this.metrics.scanCount} scans vs ${this.metrics.queryCount} queries`
            }
        };
    }
}

/**
 * Cache intelligent avec TTL et gestion mémoire
 */
class SmartCache {
    constructor(ttl = 300000, maxSize = 100) {
        this.cache = new Map();
        this.ttl = ttl;
        this.maxSize = maxSize;
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }
    
    set(key, data) {
        // Éviction LRU si cache plein
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.stats.evictions++;
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            hits: 0,
            size: JSON.stringify(data).length
        });
    }
    
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        
        // Vérifier TTL
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        
        // Mettre à jour les statistiques
        entry.hits++;
        entry.lastAccess = Date.now();
        this.stats.hits++;
        
        // Déplacer en fin (LRU)
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        return entry.data;
    }
    
    invalidate(pattern) {
        let invalidated = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                invalidated++;
            }
        }
        console.log(`🗑️ Invalidated ${invalidated} cache entries matching: ${pattern}`);
    }
    
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`🗑️ Cleared ${size} cache entries`);
    }
    
    getStats() {
        const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100 || 0;
        let totalSize = 0;
        
        for (const entry of this.cache.values()) {
            totalSize += entry.size;
        }
        
        return {
            ...this.stats,
            hitRate: `${hitRate.toFixed(1)}%`,
            entries: this.cache.size,
            sizeKB: (totalSize / 1024).toFixed(2)
        };
    }
}

// Exporter globalement
window.DynamoDBOptimized = DynamoDBOptimized;
window.SmartCache = SmartCache;