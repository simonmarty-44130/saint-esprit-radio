/**
 * Audio Storage Wrapper - Redirige vers AWS S3
 * Remplace l'ancien système IndexedDB par AWS tout en gardant la compatibilité
 */

class AudioStorage {
    constructor() {
        this.dbName = 'SaintEspritAudio'; // Pour compatibilité
        this.version = 1;
        this.db = null;
        this.storage = null; // Référence au Storage AWS
    }

    async init() {
        // Utiliser le storage AWS au lieu d'IndexedDB
        if (window.app && window.app.storage) {
            this.storage = window.app.storage;
        } else if (window.Storage) {
            this.storage = new Storage();
            await this.storage.init();
        }
        
        console.log('🎵 AudioStorage initialized with AWS S3 backend');
        return true;
    }

    async saveAudio(audioFileId, audioData) {
        if (!this.storage) {
            await this.init();
        }
        
        try {
            // Rediriger vers Storage AWS
            const result = await this.storage.saveAudioFile(audioFileId, audioData);
            console.log(`✅ Audio saved to S3: ${audioFileId}`);
            return result;
        } catch (error) {
            console.error('❌ Error saving audio:', error);
            throw error;
        }
    }

    async getAudio(audioFileId) {
        if (!this.storage) {
            await this.init();
        }
        
        try {
            // Rediriger vers Storage AWS
            const audioData = await this.storage.getAudioFile(audioFileId);
            return audioData;
        } catch (error) {
            console.error('❌ Error getting audio:', error);
            return null;
        }
    }

    async deleteAudio(audioFileId) {
        if (!this.storage) {
            await this.init();
        }
        
        try {
            await this.storage.deleteAudioFile(audioFileId);
            console.log(`✅ Audio deleted from S3: ${audioFileId}`);
        } catch (error) {
            console.error('❌ Error deleting audio:', error);
            throw error;
        }
    }

    async getAllAudioIds() {
        if (!this.storage) {
            await this.init();
        }
        
        try {
            return await this.storage.getAllAudioIds();
        } catch (error) {
            console.error('❌ Error listing audio:', error);
            return [];
        }
    }

    // Méthode de compatibilité pour l'ancien code
    async clearAll() {
        console.log('🧹 Clearing all audio (AWS S3)');
        const audioIds = await this.getAllAudioIds();
        for (const id of audioIds) {
            await this.deleteAudio(id);
        }
    }
}

// Instance globale pour compatibilité
window.audioStorage = new AudioStorage();

// Fonctions globales pour compatibilité avec l'ancien code
async function initializeAudioStorage() {
    if (!window.audioStorage.storage) {
        await window.audioStorage.init();
    }
    return window.audioStorage;
}

async function saveAudioFile(audioFileId, audioData) {
    return await window.audioStorage.saveAudio(audioFileId, audioData);
}

async function getAudioFile(audioFileId) {
    return await window.audioStorage.getAudio(audioFileId);
}

async function deleteAudioFile(audioFileId) {
    return await window.audioStorage.deleteAudio(audioFileId);
}

async function getAllAudioIds() {
    return await window.audioStorage.getAllAudioIds();
}

// Export pour compatibilité
window.AudioStorage = AudioStorage;