/**
 * Client DynamoDB pour Saint-Esprit
 * Utilise AWS SDK v3 pour accéder directement à DynamoDB
 */

class DynamoDBClient {
    constructor() {
        this.region = window.AWSConfig?.region || 'eu-west-3';
        this.initialized = false;
        this.credentials = null;
        
        // Tables DynamoDB depuis la config
        this.tables = window.AWSConfig?.tables || {
            news: 'saint-esprit-news',
            animations: 'saint-esprit-animations',
            blocks: 'saint-esprit-blocks',
            conductors: 'saint-esprit-conductors',
            journals: 'saint-esprit-journals',
            audio: 'saint-esprit-audio',
            habillage: 'saint-esprit-habillage'
        };
    }

    /**
     * Initialiser le client avec les credentials Cognito
     */
    async init() {
        try {
            // Récupérer les credentials depuis Cognito
            if (!window.authManager || !window.authManager.isAuthenticated()) {
                throw new Error('User not authenticated');
            }

            // Utiliser les credentials Cognito pour accéder à DynamoDB
            const idToken = window.authManager.getIdToken();
            
            // Configuration AWS SDK
            AWS.config.update({
                region: this.region,
                credentials: new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: window.AWSConfig.identityPoolId,
                    Logins: {
                        [`cognito-idp.${this.region}.amazonaws.com/${window.AWSConfig.userPoolId}`]: idToken
                    }
                })
            });

            // Créer le client DynamoDB
            this.client = new AWS.DynamoDB.DocumentClient();
            this.initialized = true;
            
            console.log('✅ DynamoDB client initialized');
            
            // Créer les tables si elles n'existent pas (dev only)
            await this.ensureTablesExist();
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize DynamoDB client:', error);
            throw error;
        }
    }

    /**
     * Vérifier et créer les tables si nécessaire
     */
    async ensureTablesExist() {
        const dynamodb = new AWS.DynamoDB();
        
        for (const [key, tableName] of Object.entries(this.tables)) {
            try {
                await dynamodb.describeTable({ TableName: tableName }).promise();
                console.log(`✅ Table ${tableName} exists`);
            } catch (error) {
                if (error.code === 'ResourceNotFoundException') {
                    console.log(`📦 Creating table ${tableName}...`);
                    await this.createTable(tableName, key);
                }
            }
        }
    }

    /**
     * Récupérer les blocks d'un utilisateur avec Query optimisé
     */
    async getBlocksByUser(userId) {
        if (!this.initialized) await this.init();
        
        try {
            const params = {
                TableName: this.tables.blocks,
                IndexName: 'userId-scheduledDate-index',
                KeyConditionExpression: 'userId = :userId',
                ScanIndexForward: false, // Plus récents en premier
                ExpressionAttributeValues: {
                    ':userId': userId
                }
            };
            
            console.log('🚀 Query blocks with index:', params);
            const result = await this.client.query(params).promise();
            
            console.log(`✅ Found ${result.Items.length} blocks for user ${userId}`);
            return result.Items || [];
        } catch (error) {
            // Si l'index n'existe pas encore, fallback sur scan avec filtre
            if (error.code === 'ValidationException' && error.message.includes('index')) {
                console.warn('⚠️ Index not found, falling back to scan with filter');
                return this.getBlocksByUserScan(userId);
            }
            throw error;
        }
    }
    
    /**
     * Fallback: Récupérer les blocks avec Scan (moins optimal)
     */
    async getBlocksByUserScan(userId) {
        try {
            const params = {
                TableName: this.tables.blocks,
                FilterExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': userId
                }
            };
            
            const result = await this.client.scan(params).promise();
            return result.Items || [];
        } catch (error) {
            console.error('Error scanning blocks:', error);
            return [];
        }
    }
    
    /**
     * Récupérer les blocks par date avec Query optimisé
     */
    async getBlocksByDate(scheduledDate) {
        if (!this.initialized) await this.init();
        
        try {
            const params = {
                TableName: this.tables.blocks,
                IndexName: 'scheduledDate-createdAt-index',
                KeyConditionExpression: 'scheduledDate = :date',
                ScanIndexForward: false,
                ExpressionAttributeValues: {
                    ':date': scheduledDate
                }
            };
            
            const result = await this.client.query(params).promise();
            return result.Items || [];
        } catch (error) {
            // Fallback sur scan si l'index n'existe pas
            console.warn('Date index not available, using scan');
            const params = {
                TableName: this.tables.blocks,
                FilterExpression: 'scheduledDate = :date',
                ExpressionAttributeValues: {
                    ':date': scheduledDate
                }
            };
            
            const result = await this.client.scan(params).promise();
            return result.Items || [];
        }
    }

    /**
     * Créer une table DynamoDB
     */
    async createTable(tableName, type) {
        const dynamodb = new AWS.DynamoDB();
        
        const params = {
            TableName: tableName,
            KeySchema: [
                { AttributeName: 'id', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' }
            ],
            AttributeDefinitions: [
                { AttributeName: 'id', AttributeType: 'S' },
                { AttributeName: 'createdAt', AttributeType: 'N' },
                { AttributeName: 'userId', AttributeType: 'S' },
                { AttributeName: 'status', AttributeType: 'S' }
            ],
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'userId-createdAt-index',
                    KeySchema: [
                        { AttributeName: 'userId', KeyType: 'HASH' },
                        { AttributeName: 'createdAt', KeyType: 'RANGE' }
                    ],
                    Projection: { ProjectionType: 'ALL' },
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                },
                {
                    IndexName: 'status-createdAt-index',
                    KeySchema: [
                        { AttributeName: 'status', KeyType: 'HASH' },
                        { AttributeName: 'createdAt', KeyType: 'RANGE' }
                    ],
                    Projection: { ProjectionType: 'ALL' },
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 10,
                WriteCapacityUnits: 10
            }
        };

        try {
            await dynamodb.createTable(params).promise();
            console.log(`✅ Table ${tableName} created successfully`);
            
            // Attendre que la table soit active
            await dynamodb.waitFor('tableExists', { TableName: tableName }).promise();
        } catch (error) {
            console.error(`❌ Error creating table ${tableName}:`, error);
        }
    }

    /**
     * CRUD Operations
     */
    
    // CREATE
    async create(tableName, item) {
        if (!this.initialized) await this.init();
        
        // Gérer createdAt correctement
        let createdAt = item.createdAt;
        if (!createdAt) {
            createdAt = Date.now();
        } else if (typeof createdAt === 'string') {
            createdAt = new Date(createdAt).getTime() || Date.now();
        } else if (typeof createdAt !== 'number') {
            createdAt = Date.now();
        }
        
        const params = {
            TableName: this.tables[tableName],
            Item: {
                ...item,
                id: item.id ? item.id.toString() : this.generateId(),
                createdAt: createdAt,
                updatedAt: Date.now(),
                userId: item.userId || window.authManager?.getUserId() || 'unknown',
                author: item.author || window.authManager?.getCurrentUserFullName() || 'Unknown'
            }
        };

        try {
            await this.client.put(params).promise();
            console.log(`✅ Created item in ${tableName}:`, params.Item.id);
            return params.Item;
        } catch (error) {
            console.error(`❌ Error creating item in ${tableName}:`, error);
            throw error;
        }
    }

    // READ - Get all items (with optional filter)
    async getAll(tableName, filter = {}) {
        if (!this.initialized) await this.init();
        
        try {
            let params = {
                TableName: this.tables[tableName]
            };

            // Si filtre par userId, utiliser l'index
            if (filter.userId) {
                params = {
                    ...params,
                    IndexName: 'userId-createdAt-index',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': filter.userId
                    },
                    ScanIndexForward: false // Plus récent en premier
                };
                
                const result = await this.client.query(params).promise();
                return result.Items || [];
            } 
            // Si filtre par status
            else if (filter.status) {
                params = {
                    ...params,
                    IndexName: 'status-createdAt-index',
                    KeyConditionExpression: '#status = :status',
                    ExpressionAttributeNames: {
                        '#status': 'status'
                    },
                    ExpressionAttributeValues: {
                        ':status': filter.status
                    },
                    ScanIndexForward: false
                };
                
                const result = await this.client.query(params).promise();
                return result.Items || [];
            }
            // Sinon, scan complet (récupérer TOUT)
            else {
                const result = await this.client.scan(params).promise();
                const items = result.Items || [];
                
                // Trier par date de création (plus récent en premier)
                items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                
                return items;
            }
        } catch (error) {
            console.error(`❌ Error getting items from ${tableName}:`, error);
            return [];
        }
    }

    // READ - Get single item
    async get(tableName, id, createdAt) {
        if (!this.initialized) await this.init();
        
        const params = {
            TableName: this.tables[tableName],
            Key: {
                id: id,
                createdAt: createdAt
            }
        };

        try {
            const result = await this.client.get(params).promise();
            return result.Item;
        } catch (error) {
            console.error(`❌ Error getting item from ${tableName}:`, error);
            return null;
        }
    }

    // UPDATE
    async update(tableName, id, createdAt, updates) {
        if (!this.initialized) await this.init();
        
        // S'assurer que createdAt est un nombre
        let createdAtNum = createdAt;
        if (typeof createdAt === 'string') {
            createdAtNum = new Date(createdAt).getTime() || Date.now();
        } else if (typeof createdAt !== 'number') {
            createdAtNum = Date.now();
        }
        
        // Construire l'expression de mise à jour
        const updateExpression = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        
        Object.keys(updates).forEach((key, index) => {
            // Exclure id, createdAt et updatedAt (on le gérera séparément)
            if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
                const attrName = `#attr${index}`;
                const attrValue = `:val${index}`;
                
                updateExpression.push(`${attrName} = ${attrValue}`);
                expressionAttributeNames[attrName] = key;
                expressionAttributeValues[attrValue] = updates[key];
            }
        });
        
        // Ajouter updatedAt (toujours utiliser l'heure actuelle, pas celle fournie)
        updateExpression.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = Date.now();
        
        const params = {
            TableName: this.tables[tableName],
            Key: {
                id: id.toString(),
                createdAt: createdAtNum
            },
            UpdateExpression: 'SET ' + updateExpression.join(', '),
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };

        try {
            const result = await this.client.update(params).promise();
            console.log(`✅ Updated item in ${tableName}:`, id);
            return result.Attributes;
        } catch (error) {
            console.error(`❌ Error updating item in ${tableName}:`, error);
            throw error;
        }
    }

    // DELETE
    async delete(tableName, id, createdAt) {
        if (!this.initialized) await this.init();
        
        const params = {
            TableName: this.tables[tableName],
            Key: {
                id: id,
                createdAt: createdAt
            }
        };

        try {
            await this.client.delete(params).promise();
            console.log(`✅ Deleted item from ${tableName}:`, id);
            return true;
        } catch (error) {
            console.error(`❌ Error deleting item from ${tableName}:`, error);
            return false;
        }
    }

    // BATCH WRITE (pour importer plusieurs items)
    async batchWrite(tableName, items) {
        if (!this.initialized) await this.init();
        
        if (!items || items.length === 0) {
            console.log(`⚠️ No items to write to ${tableName}`);
            return;
        }
        
        // DynamoDB limite à 25 items par batch
        const chunks = [];
        for (let i = 0; i < items.length; i += 25) {
            chunks.push(items.slice(i, i + 25));
        }

        for (const chunk of chunks) {
            const params = {
                RequestItems: {
                    [this.tables[tableName]]: chunk.map(item => {
                        // S'assurer que createdAt est bien un nombre
                        let createdAt = item.createdAt;
                        if (!createdAt) {
                            createdAt = Date.now();
                        } else if (typeof createdAt === 'string') {
                            // Si c'est une date string, la convertir en timestamp
                            createdAt = new Date(createdAt).getTime() || Date.now();
                        } else if (typeof createdAt !== 'number') {
                            createdAt = Date.now();
                        }
                        
                        // S'assurer que l'ID existe
                        const id = item.id ? item.id.toString() : this.generateId();
                        
                        return {
                            PutRequest: {
                                Item: {
                                    ...item,
                                    id: id,
                                    createdAt: createdAt,
                                    updatedAt: Date.now(),
                                    userId: item.userId || window.authManager?.getUserId() || 'unknown',
                                    author: item.author || window.authManager?.getCurrentUserFullName() || 'Unknown'
                                }
                            }
                        };
                    })
                }
            };

            try {
                await this.client.batchWrite(params).promise();
                console.log(`✅ Batch wrote ${chunk.length} items to ${tableName}`);
            } catch (error) {
                console.error(`❌ Error batch writing to ${tableName}:`, error);
                console.error('Failed chunk:', chunk.map(item => ({ id: item.id, createdAt: item.createdAt })));
            }
        }
    }

    /**
     * Utilitaires
     */
    generateId() {
        return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Migration des données JSON existantes vers DynamoDB
     */
    async migrateFromJSON(tableName, jsonData) {
        console.log(`🔄 Migrating ${jsonData.length} items to ${tableName}...`);
        
        if (jsonData && jsonData.length > 0) {
            await this.batchWrite(tableName, jsonData);
            console.log(`✅ Migration complete for ${tableName}`);
        }
    }
}

// Export global
window.DynamoDBClient = DynamoDBClient;