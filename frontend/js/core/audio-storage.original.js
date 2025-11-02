// Audio Storage module - gère le stockage des fichiers audio
class AudioStorage {
    constructor() {
        this.dbName = 'SaintEspritAudio';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('audioFiles')) {
                    db.createObjectStore('audioFiles', { keyPath: 'id' });
                }
            };
        });
    }

    async saveAudio(audioFileId, audioData) {
        const transaction = this.db.transaction(['audioFiles'], 'readwrite');
        const store = transaction.objectStore('audioFiles');
        
        return new Promise((resolve, reject) => {
            const request = store.put({
                id: audioFileId,
                data: audioData.data,
                name: audioData.name,
                type: audioData.type,
                duration: audioData.duration,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAudio(audioFileId) {
        const transaction = this.db.transaction(['audioFiles'], 'readonly');
        const store = transaction.objectStore('audioFiles');
        
        return new Promise((resolve, reject) => {
            const request = store.get(audioFileId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteAudio(audioFileId) {
        const transaction = this.db.transaction(['audioFiles'], 'readwrite');
        const store = transaction.objectStore('audioFiles');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(audioFileId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllAudioIds() {
        const transaction = this.db.transaction(['audioFiles'], 'readonly');
        const store = transaction.objectStore('audioFiles');
        
        return new Promise((resolve, reject) => {
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll() {
        const transaction = this.db.transaction(['audioFiles'], 'readwrite');
        const store = transaction.objectStore('audioFiles');
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Migration depuis localStorage
    async migrateFromLocalStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('saintEsprit_data') || '{}');
            if (data.audioFiles) {
                for (const [id, audioData] of Object.entries(data.audioFiles)) {
                    await this.saveAudio(id, audioData);
                }
                // Nettoyer les audioFiles du localStorage après migration
                delete data.audioFiles;
                localStorage.setItem('saintEsprit_data', JSON.stringify(data));
                console.log('Audio files migrated to IndexedDB');
            }
        } catch (error) {
            console.error('Migration error:', error);
        }
    }
}

// Instance globale
const audioStorage = new AudioStorage();

// Fonctions globales pour compatibilité
async function initializeAudioStorage() {
    await audioStorage.init();
    await audioStorage.migrateFromLocalStorage();
}

async function saveAudioFile(audioFileId, audioData) {
    await audioStorage.saveAudio(audioFileId, audioData);
}

async function getAudioFile(audioFileId) {
    return await audioStorage.getAudio(audioFileId);
}

async function deleteAudioFile(audioFileId) {
    await audioStorage.deleteAudio(audioFileId);
}

// Export global
window.AudioStorage = AudioStorage;
window.audioStorage = audioStorage;