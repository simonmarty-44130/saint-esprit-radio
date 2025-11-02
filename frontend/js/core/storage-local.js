/**
 * Storage AWS pour Saint-Esprit
 * Remplace le storage IndexedDB/localStorage par S3
 * Interface compatible avec le code existant
 */
class Storage {
    constructor() {
        // Configuration AWS
        // ⚠️ NE JAMAIS mettre de credentials en dur !
        // Utiliser Amplify/Cognito à la place
        this.config = {
            accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID', // À remplacer par Cognito Identity Pool
            secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY', // À remplacer par Cognito Identity Pool
            region: 'eu-west-3',
            bucket: 'saint-esprit-audio'
        };
        
        // Initialiser AWS SDK
        AWS.config.update(this.config);
        this.s3 = new AWS.S3();
        
        // État local
        this.userId = this.getCurrentUser();
        this.data = null;
        this.lastSyncCheck = 0;
        
        console.log(`🔧 AWS Storage initialized for user: ${this.userId}`);
    }

    // ===== INTERFACE COMPATIBLE AVEC L'EXISTANT =====
    
    /**
     * Initialisation (interface compatible)
     */
    async init() {
        try {
            // Test connexion S3
            await this.s3.headBucket({ Bucket: this.config.bucket }).promise();
            console.log('✅ S3 connection established');
            
            // Charger données utilisateur
            this.data = await this.loadUserDataFromS3();
            
            // Migration des données locales si nécessaire
            await this.migrateLocalData();
            
            return true;
        } catch (error) {
            console.error('❌ Storage init failed:', error);
            throw error;
        }
    }

    /**
     * Sauvegarder toutes les données (interface compatible)
     * Remplace l'ancien système localStorage/IndexedDB
     */
    async save(data) {
        try {
            const dataToSave = {
                ...data,
                userId: this.userId,
                lastModified: Date.now(),
                version: (data.version || 0) + 1,
                lastSavedBy: this.userId
            };

            console.log(`💾 Saving data to S3, version: ${dataToSave.version}`);

            // Sauvegarder sur S3
            await this.s3.putObject({
                Bucket: this.config.bucket,
                Key: `users/${this.userId}/data.json`,
                Body: JSON.stringify(dataToSave, null, 2),
                ContentType: 'application/json',
                Metadata: {
                    'user-id': this.userId,
                    'saved-at': Date.now().toString()
                }
            }).promise();

            // Mettre à jour état de sync
            await this.updateSyncState(dataToSave.version);
            
            this.data = dataToSave;
            console.log('✅ Data saved to S3');
            
            return dataToSave;
        } catch (error) {
            console.error('❌ Error saving to S3:', error);
            throw error;
        }
    }

    /**
     * Charger toutes les données (interface compatible)
     */
    async load() {
        if (this.data) {
            return this.data;
        }
        
        this.data = await this.loadUserDataFromS3();
        return this.data;
    }

    /**
     * Charger données depuis S3
     */
    async loadUserDataFromS3() {
        try {
            const response = await this.s3.getObject({
                Bucket: this.config.bucket,
                Key: `users/${this.userId}/data.json`
            }).promise();
            
            const data = JSON.parse(response.Body.toString());
            console.log(`📥 Data loaded from S3, version: ${data.version}`);
            return data;
            
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                console.log('📄 No existing data, creating new user');
                return this.createEmptyUserData();
            }
            throw error;
        }
    }

    /**
     * Créer structure vide pour nouveau utilisateur
     */
    createEmptyUserData() {
        return {
            userId: this.userId,
            news: [],
            animations: [],
            blocks: [],
            conductor: [],
            settings: {
                theme: 'dark',
                autoSave: true,
                syncInterval: 10000
            },
            templates: {},
            version: 1,
            createdAt: Date.now(),
            lastModified: Date.now()
        };
    }

    // ===== GESTION AUDIO (interface compatible avec audio-storage.js) =====
    
    /**
     * Sauvegarder fichier audio (interface compatible)
     */
    async saveAudioFile(audioFileId, audioData) {
        try {
            const key = `audio/${this.userId}/${audioFileId}.mp3`;
            
            // Convert data URL to blob si nécessaire
            let audioBlob;
            if (typeof audioData.data === 'string' && audioData.data.startsWith('data:')) {
                audioBlob = this.dataURLtoBlob(audioData.data);
            } else {
                audioBlob = audioData.data;
            }

            // Upload vers S3
            const uploadResult = await this.s3.upload({
                Bucket: this.config.bucket,
                Key: key,
                Body: audioBlob,
                ContentType: audioData.type || 'audio/mp3',
                Metadata: {
                    'audio-id': audioFileId,
                    'uploaded-by': this.userId,
                    'original-name': audioData.name || 'audio.mp3',
                    'duration': audioData.duration || '0:00'
                }
            }).promise();

            console.log(`🎵 Audio saved to S3: ${key}`);
            
            // Retourner metadata compatible
            return {
                id: audioFileId,
                key: key,
                url: uploadResult.Location,
                name: audioData.name,
                type: audioData.type,
                duration: audioData.duration,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Error saving audio to S3:', error);
            throw error;
        }
    }

    /**
     * Récupérer fichier audio (interface compatible)
     */
    async getAudioFile(audioFileId) {
        try {
            const key = `audio/${this.userId}/${audioFileId}.mp3`;
            
            // Récupérer metadata
            const headResponse = await this.s3.headObject({
                Bucket: this.config.bucket,
                Key: key
            }).promise();

            // Construire URL direct
            const url = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
            
            // Retourner format compatible avec l'existant
            return {
                id: audioFileId,
                data: url, // URL au lieu de data URI
                name: headResponse.Metadata['original-name'] || 'audio.mp3',
                type: headResponse.ContentType || 'audio/mp3',
                duration: headResponse.Metadata['duration'] || '0:00',
                timestamp: parseInt(headResponse.Metadata['uploaded-at'] || Date.now())
            };
            
        } catch (error) {
            if (error.code === 'NotFound') {
                return null;
            }
            console.error('❌ Error getting audio from S3:', error);
            throw error;
        }
    }

    /**
     * Supprimer fichier audio (interface compatible)
     */
    async deleteAudioFile(audioFileId) {
        try {
            const key = `audio/${this.userId}/${audioFileId}.mp3`;
            
            await this.s3.deleteObject({
                Bucket: this.config.bucket,
                Key: key
            }).promise();
            
            console.log(`🗑️ Audio deleted from S3: ${key}`);
        } catch (error) {
            console.error('❌ Error deleting audio from S3:', error);
            throw error;
        }
    }

    /**
     * Lister tous les IDs audio (interface compatible)
     */
    async getAllAudioIds() {
        try {
            const response = await this.s3.listObjects({
                Bucket: this.config.bucket,
                Prefix: `audio/${this.userId}/`
            }).promise();
            
            const audioIds = response.Contents.map(obj => {
                const filename = obj.Key.split('/').pop();
                return filename.replace('.mp3', '');
            });
            
            return audioIds;
        } catch (error) {
            console.error('❌ Error listing audio files:', error);
            return [];
        }
    }

    // ===== SYNCHRONISATION MULTI-UTILISATEURS =====
    
    /**
     * Mettre à jour état de synchronisation
     */
    async updateSyncState(userVersion) {
        try {
            const syncState = await this.getSyncState();
            
            syncState.users = syncState.users || {};
            syncState.users[this.userId] = {
                lastModified: Date.now(),
                version: userVersion,
                status: 'active'
            };
            syncState.lastUpdate = Date.now();

            await this.s3.putObject({
                Bucket: this.config.bucket,
                Key: 'sync/global-state.json',
                Body: JSON.stringify(syncState, null, 2),
                ContentType: 'application/json'
            }).promise();

            console.log(`📡 Sync state updated for ${this.userId}`);
        } catch (error) {
            console.error('❌ Error updating sync state:', error);
        }
    }

    /**
     * Récupérer état de synchronisation
     */
    async getSyncState() {
        try {
            const response = await this.s3.getObject({
                Bucket: this.config.bucket,
                Key: 'sync/global-state.json'
            }).promise();
            
            return JSON.parse(response.Body.toString());
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                return {
                    users: {},
                    lastUpdate: Date.now(),
                    created: Date.now()
                };
            }
            throw error;
        }
    }

    /**
     * Détecter changements d'autres utilisateurs
     */
    async detectChanges() {
        const syncState = await this.getSyncState();
        const changes = [];

        for (const [userId, userInfo] of Object.entries(syncState.users || {})) {
            if (userId !== this.userId && userInfo.lastModified > this.lastSyncCheck) {
                changes.push({
                    userId,
                    lastModified: userInfo.lastModified,
                    version: userInfo.version
                });
            }
        }

        this.lastSyncCheck = Date.now();
        return changes;
    }

    /**
     * Charger données d'un autre utilisateur
     */
    async loadOtherUserData(targetUserId) {
        try {
            const response = await this.s3.getObject({
                Bucket: this.config.bucket,
                Key: `users/${targetUserId}/data.json`
            }).promise();
            
            return JSON.parse(response.Body.toString());
        } catch (error) {
            console.error(`❌ Error loading data for ${targetUserId}:`, error);
            return null;
        }
    }

    // ===== MIGRATION ET BACKUP =====
    
    /**
     * Migrer données depuis localStorage/IndexedDB
     */
    async migrateLocalData() {
        try {
            // Vérifier s'il y a des données à migrer
            const localData = localStorage.getItem('saintEsprit_data');
            if (!localData) return;

            console.log('🔄 Migrating local data to S3...');
            
            const parsedData = JSON.parse(localData);
            
            // Sauvegarder vers S3
            await this.save(parsedData);
            
            // Nettoyer localStorage après migration réussie
            localStorage.removeItem('saintEsprit_data');
            console.log('✅ Local data migrated to S3');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
        }
    }

    /**
     * Export complet (interface compatible)
     */
    async exportData() {
        const data = await this.load();
        const exportData = {
            ...data,
            exportDate: new Date().toISOString(),
            exportedBy: this.userId,
            exportVersion: '2.0-aws'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saint-esprit-export-${this.userId}-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('📥 Data exported');
    }

    // ===== UTILITAIRES =====
    
    getCurrentUser() {
        let userId = localStorage.getItem('saint-esprit-user');
        if (!userId) {
            userId = prompt('👤 Votre nom d\'utilisateur (ex: clara, thomas):') || 'user1';
            localStorage.setItem('saint-esprit-user', userId);
        }
        return userId.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    // ===== MÉTHODES COMPATIBLES AVEC L'EXISTANT =====
    
    async createBackup() {
        const data = await this.load();
        const backup = {
            id: Date.now(),
            data: data,
            timestamp: new Date().toISOString(),
            userId: this.userId
        };

        // Sauvegarder backup sur S3
        await this.s3.putObject({
            Bucket: this.config.bucket,
            Key: `backups/${this.userId}/${backup.id}.json`,
            Body: JSON.stringify(backup, null, 2),
            ContentType: 'application/json'
        }).promise();

        console.log('💾 Backup created:', backup.id);
        return backup;
    }

    async clearAll() {
        console.log('🧹 Clearing all data...');
        
        // Supprimer données utilisateur
        await this.s3.deleteObject({
            Bucket: this.config.bucket,
            Key: `users/${this.userId}/data.json`
        }).promise();

        // Supprimer audios
        const audioFiles = await this.getAllAudioIds();
        for (const audioId of audioFiles) {
            await this.deleteAudioFile(audioId);
        }

        this.data = null;
        console.log('✅ All data cleared');
    }
}

// Fonctions globales pour compatibilité avec audio-storage.js
async function initializeAudioStorage() {
    // Déjà géré par Storage.init()
    console.log('🎵 Audio storage already initialized with AWS S3');
}

async function saveAudioFile(audioFileId, audioData) {
    return await window.app.storage.saveAudioFile(audioFileId, audioData);
}

async function getAudioFile(audioFileId) {
    return await window.app.storage.getAudioFile(audioFileId);
}

async function deleteAudioFile(audioFileId) {
    return await window.app.storage.deleteAudioFile(audioFileId);
}

// Export pour compatibilité
window.Storage = Storage;