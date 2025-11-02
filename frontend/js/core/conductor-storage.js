/**
 * Conductor Storage - Gestion des conducteurs multiples sur AWS S3
 */
class ConductorStorage {
    constructor(storage) {
        this.storage = storage;
        this.currentConductorId = null;
        this.conductorsList = [];
    }

    /**
     * Charger la liste des conducteurs disponibles
     */
    async loadConductorsList() {
        try {
            const userId = this.storage.userId;
            
            // Charger les conducteurs de l'utilisateur
            const userConductors = await this.listUserConductors(userId);
            
            // Charger les conducteurs partagés
            const sharedConductors = await this.listSharedConductors();
            
            this.conductorsList = [
                ...userConductors.map(c => ({ ...c, owner: userId, type: 'personal' })),
                ...sharedConductors.map(c => ({ ...c, type: 'shared' }))
            ];
            
            return this.conductorsList;
        } catch (error) {
            console.error('❌ Error loading conductors list:', error);
            return [];
        }
    }

    /**
     * Lister les conducteurs d'un utilisateur
     */
    async listUserConductors(userId) {
        try {
            // En mode HTTP, on ne peut pas lister les objets S3
            if (!this.storage.s3 || !this.storage.s3.listObjects) {
                console.log('📋 Mode HTTP - listing des conducteurs non disponible');
                return [];
            }
            
            const response = await this.storage.s3.listObjects({
                Bucket: this.storage.config.bucket,
                Prefix: `conductors/${userId}/`
            }).promise();
            
            const conductors = [];
            for (const obj of response.Contents || []) {
                const key = obj.Key;
                if (key.endsWith('.json')) {
                    const metadata = await this.getConductorMetadata(key);
                    if (metadata) {
                        conductors.push({
                            id: key.replace(`conductors/${userId}/`, '').replace('.json', ''),
                            key: key,
                            name: metadata.name,
                            lastModified: obj.LastModified,
                            size: obj.Size
                        });
                    }
                }
            }
            
            return conductors.sort((a, b) => b.lastModified - a.lastModified);
        } catch (error) {
            console.error(`❌ Error listing user conductors:`, error);
            return [];
        }
    }

    /**
     * Lister les conducteurs partagés
     */
    async listSharedConductors() {
        try {
            // En mode HTTP, on ne peut pas lister les objets S3
            if (!this.storage.s3 || !this.storage.s3.listObjects) {
                console.log('📋 Mode HTTP - listing des conducteurs partagés non disponible');
                return [];
            }
            
            const response = await this.storage.s3.listObjects({
                Bucket: this.storage.config.bucket,
                Prefix: 'conductors/shared/'
            }).promise();
            
            const conductors = [];
            for (const obj of response.Contents || []) {
                const key = obj.Key;
                if (key.endsWith('.json')) {
                    const metadata = await this.getConductorMetadata(key);
                    if (metadata) {
                        conductors.push({
                            id: key.replace('conductors/shared/', '').replace('.json', ''),
                            key: key,
                            name: metadata.name,
                            owner: metadata.owner || 'shared',
                            lastModified: obj.LastModified,
                            size: obj.Size
                        });
                    }
                }
            }
            
            return conductors;
        } catch (error) {
            console.error('❌ Error listing shared conductors:', error);
            return [];
        }
    }

    /**
     * Obtenir les métadonnées d'un conducteur
     */
    async getConductorMetadata(key) {
        try {
            const response = await this.storage.s3.getObject({
                Bucket: this.storage.config.bucket,
                Key: key
            }).promise();
            
            const conductor = JSON.parse(response.Body.toString());
            return {
                name: conductor.name,
                owner: conductor.owner,
                collaborators: conductor.collaborators || [],
                isPublic: conductor.isPublic || false
            };
        } catch (error) {
            console.error(`❌ Error getting conductor metadata:`, error);
            return null;
        }
    }

    /**
     * Créer un nouveau conducteur
     */
    async createConductor(name, template = null, isPublic = false) {
        try {
            const conductorId = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
            const userId = this.storage.userId;
            
            const conductor = {
                id: conductorId,
                name: name,
                owner: userId,
                collaborators: [],
                isPublic: isPublic,
                createdAt: Date.now(),
                lastModified: Date.now(),
                segments: template ? this.getTemplateSegments(template) : []
            };
            
            const key = isPublic ? 
                `conductors/shared/${conductorId}.json` : 
                `conductors/${userId}/${conductorId}.json`;
            
            await this.storage.s3.putObject({
                Bucket: this.storage.config.bucket,
                Key: key,
                Body: JSON.stringify(conductor, null, 2),
                ContentType: 'application/json',
                Metadata: {
                    'owner': userId,
                    'created-at': Date.now().toString()
                }
            }).promise();
            
            console.log(`📁 Conductor created: ${name}`);
            
            // Recharger la liste
            await this.loadConductorsList();
            
            return { success: true, conductorId, key };
            
        } catch (error) {
            console.error('❌ Error creating conductor:', error);
            return { success: false, error };
        }
    }

    /**
     * Charger un conducteur
     */
    async loadConductor(conductorId) {
        try {
            // Trouver le conducteur dans la liste
            const conductorInfo = this.conductorsList.find(c => c.id === conductorId);
            if (!conductorInfo) {
                throw new Error('Conductor not found');
            }
            
            const response = await this.storage.s3.getObject({
                Bucket: this.storage.config.bucket,
                Key: conductorInfo.key
            }).promise();
            
            const conductor = JSON.parse(response.Body.toString());
            this.currentConductorId = conductorId;
            
            console.log(`📂 Conductor loaded: ${conductor.name}`);
            return conductor;
            
        } catch (error) {
            console.error('❌ Error loading conductor:', error);
            return null;
        }
    }

    /**
     * Sauvegarder le conducteur actuel
     */
    async saveConductor(conductorId, segments) {
        try {
            const conductorInfo = this.conductorsList.find(c => c.id === conductorId);
            if (!conductorInfo) {
                throw new Error('Conductor not found');
            }
            
            // Charger le conducteur existant pour garder les métadonnées
            const existing = await this.loadConductor(conductorId);
            if (!existing) {
                throw new Error('Cannot load existing conductor');
            }
            
            // Mettre à jour
            existing.segments = segments;
            existing.lastModified = Date.now();
            
            await this.storage.s3.putObject({
                Bucket: this.storage.config.bucket,
                Key: conductorInfo.key,
                Body: JSON.stringify(existing, null, 2),
                ContentType: 'application/json'
            }).promise();
            
            console.log(`💾 Conductor saved: ${existing.name}`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error saving conductor:', error);
            return { success: false, error };
        }
    }

    /**
     * Dupliquer un conducteur
     */
    async duplicateConductor(sourceId, newName) {
        try {
            const source = await this.loadConductor(sourceId);
            if (!source) {
                throw new Error('Source conductor not found');
            }
            
            return await this.createConductor(
                newName || `${source.name} (Copie)`,
                null,
                false
            );
            
        } catch (error) {
            console.error('❌ Error duplicating conductor:', error);
            return { success: false, error };
        }
    }

    /**
     * Partager un conducteur
     */
    async shareConductor(conductorId) {
        try {
            const conductorInfo = this.conductorsList.find(c => c.id === conductorId);
            if (!conductorInfo || conductorInfo.type === 'shared') {
                throw new Error('Cannot share this conductor');
            }
            
            const conductor = await this.loadConductor(conductorId);
            if (!conductor) {
                throw new Error('Cannot load conductor');
            }
            
            // Créer une copie dans le dossier partagé
            conductor.isPublic = true;
            conductor.originalOwner = conductor.owner;
            
            const sharedKey = `conductors/shared/${conductorId}.json`;
            
            await this.storage.s3.putObject({
                Bucket: this.storage.config.bucket,
                Key: sharedKey,
                Body: JSON.stringify(conductor, null, 2),
                ContentType: 'application/json'
            }).promise();
            
            console.log(`👥 Conductor shared: ${conductor.name}`);
            
            // Recharger la liste
            await this.loadConductorsList();
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error sharing conductor:', error);
            return { success: false, error };
        }
    }

    /**
     * Supprimer un conducteur
     */
    async deleteConductor(conductorId) {
        try {
            const conductorInfo = this.conductorsList.find(c => c.id === conductorId);
            if (!conductorInfo) {
                throw new Error('Conductor not found');
            }
            
            // Vérifier les permissions
            if (conductorInfo.type === 'shared' && conductorInfo.owner !== this.storage.userId) {
                throw new Error('Cannot delete shared conductor owned by another user');
            }
            
            await this.storage.s3.deleteObject({
                Bucket: this.storage.config.bucket,
                Key: conductorInfo.key
            }).promise();
            
            console.log(`🗑️ Conductor deleted: ${conductorId}`);
            
            // Recharger la liste
            await this.loadConductorsList();
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error deleting conductor:', error);
            return { success: false, error };
        }
    }

    /**
     * Obtenir les segments de template
     */
    getTemplateSegments(template) {
        const templates = {
            news: [
                { type: 'jingle', title: 'Jingle Intro', duration: '0:05' },
                { type: 'news', title: 'Titres', duration: '0:30' },
                { type: 'news', title: 'Développement 1', duration: '1:00' },
                { type: 'news', title: 'Développement 2', duration: '1:00' },
                { type: 'jingle', title: 'Jingle Outro', duration: '0:05' }
            ],
            morning: [
                { type: 'jingle', title: 'Jingle Matinale', duration: '0:10' },
                { type: 'animation', title: 'Intro Animateur', duration: '0:30' },
                { type: 'news', title: 'Flash Info', duration: '2:00' },
                { type: 'animation', title: 'Chronique', duration: '3:00' },
                { type: 'pub', title: 'Publicité', duration: '2:00' },
                { type: 'animation', title: 'Météo', duration: '1:00' }
            ],
            hourly: [
                { type: 'jingle', title: 'Top Horaire', duration: '0:05' },
                { type: 'news', title: 'Flash Info', duration: '2:00' },
                { type: 'meteo', title: 'Météo', duration: '0:30' },
                { type: 'jingle', title: 'Jingle Fin', duration: '0:05' }
            ]
        };
        
        return templates[template] || [];
    }
}

// Export global
window.ConductorStorage = ConductorStorage;