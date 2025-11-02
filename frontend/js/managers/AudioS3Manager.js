/**
 * AudioS3Manager - Gestion des fichiers audio avec AWS S3
 * Alternative plus professionnelle au système serveur local
 */
class AudioS3Manager {
    constructor(app) {
        this.app = app;
        // S3 est maintenant géré directement par storage.js
        this.isConfigured = true; // Toujours actif car nous utilisons AWS SDK directement
        console.log('✅ AudioS3Manager using direct AWS S3 via storage.js');
    }

    /**
     * Vérifie si S3 est configuré (maintenant toujours true)
     */
    async checkConfiguration() {
        // S3 est configuré directement dans storage.js
        this.isConfigured = true;
        console.log('✅ AWS S3 ready (direct SDK connection)');
        return true;
    }

    /**
     * Upload tous les fichiers audio vers S3
     */
    async uploadAllToS3() {
        if (!this.isConfigured) {
            console.log('⚠️ S3 non configuré, utilisation du système local');
            // Fallback vers le système local
            if (this.app.audioSyncManager) {
                return this.app.audioSyncManager.uploadAllAudio();
            }
            return { success: false, error: 'S3 non configuré' };
        }

        console.log('☁️ Upload des fichiers audio vers S3...');
        
        try {
            // Récupérer tous les fichiers audio locaux
            const audioFiles = await this.getAllLocalAudioFiles();
            console.log(`Trouvé ${audioFiles.length} fichiers audio locaux`);
            
            let uploadCount = 0;
            const uploadedUrls = new Map(); // Pour mapper les noms aux URLs S3
            
            for (const audio of audioFiles) {
                try {
                    const result = await this.uploadFileToS3(audio.name, audio.data);
                    if (result.success) {
                        uploadedUrls.set(audio.name, result.url);
                        uploadCount++;
                        console.log(`✅ Uploadé vers S3: ${audio.name}`);
                    }
                } catch (e) {
                    console.error(`❌ Erreur upload S3 ${audio.name}:`, e);
                }
            }
            
            // Mettre à jour les URLs dans les news
            await this.updateNewsWithS3Urls(uploadedUrls);
            
            console.log(`✅ Upload S3 terminé: ${uploadCount}/${audioFiles.length} fichiers`);
            return { 
                success: true, 
                uploaded: uploadCount, 
                total: audioFiles.length,
                urls: uploadedUrls 
            };
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'upload S3:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload un fichier spécifique vers S3
     */
    async uploadFileToS3(filename, blob) {
        const formData = new FormData();
        
        // Créer un objet File à partir du Blob
        const file = new File([blob], filename, { type: 'audio/mpeg' });
        formData.append('audio', file);
        
        const response = await fetch(this.s3Endpoint, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Upload S3 échoué');
        }
        
        return result;
    }

    /**
     * Récupère la liste des fichiers sur S3
     */
    async listS3Files() {
        if (!this.isConfigured) {
            return [];
        }

        try {
            const response = await fetch(this.s3Endpoint + '?action=list');
            const data = await response.json();
            
            if (data.success && data.files) {
                return data.files;
            }
            
            return [];
        } catch (e) {
            console.error('Erreur liste S3:', e);
            return [];
        }
    }

    /**
     * Télécharge tous les fichiers depuis S3
     */
    async downloadAllFromS3() {
        if (!this.isConfigured) {
            console.log('⚠️ S3 non configuré, utilisation du système local');
            // Fallback vers le système local
            if (this.app.audioSyncManager) {
                return this.app.audioSyncManager.downloadAllAudio();
            }
            return { success: false, error: 'S3 non configuré' };
        }

        console.log('☁️ Téléchargement des fichiers audio depuis S3...');
        
        try {
            const s3Files = await this.listS3Files();
            console.log(`Trouvé ${s3Files.length} fichiers sur S3`);
            
            let downloadCount = 0;
            
            for (const file of s3Files) {
                try {
                    // Télécharger le fichier depuis S3
                    const response = await fetch(file.url);
                    const blob = await response.blob();
                    
                    // Sauvegarder localement
                    await this.saveAudioToLocal(file.name, blob);
                    downloadCount++;
                    console.log(`✅ Téléchargé depuis S3: ${file.name}`);
                    
                } catch (e) {
                    console.error(`❌ Erreur téléchargement S3 ${file.name}:`, e);
                }
            }
            
            // Mettre à jour les URLs dans les news
            await this.updateNewsWithS3Files(s3Files);
            
            console.log(`✅ Téléchargement S3 terminé: ${downloadCount}/${s3Files.length} fichiers`);
            return { 
                success: true, 
                downloaded: downloadCount, 
                total: s3Files.length 
            };
            
        } catch (error) {
            console.error('❌ Erreur lors du téléchargement S3:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Met à jour les news avec les URLs S3
     */
    async updateNewsWithS3Urls(urlMap) {
        if (!this.app.newsManager) return;
        
        const news = this.app.newsManager.getDatabase();
        let updated = false;
        
        news.forEach(newsItem => {
            if (newsItem.audioFilename) {
                // Chercher l'URL S3 correspondante
                const s3Url = urlMap.get(newsItem.audioFilename);
                if (s3Url) {
                    newsItem.audioS3Url = s3Url;
                    newsItem.audioUrl = s3Url; // Utiliser directement l'URL S3
                    updated = true;
                    console.log(`✅ News "${newsItem.title}" liée à S3: ${s3Url}`);
                }
            }
        });
        
        if (updated) {
            this.app.newsManager.saveDatabase();
        }
    }

    /**
     * Met à jour les news avec les fichiers S3 disponibles
     */
    async updateNewsWithS3Files(s3Files) {
        if (!this.app.newsManager) return;
        
        const news = this.app.newsManager.getDatabase();
        let updated = false;
        
        news.forEach(newsItem => {
            if (newsItem.audioFilename) {
                // Chercher le fichier S3 correspondant
                const s3File = s3Files.find(f => 
                    f.name.includes(newsItem.audioFilename) || 
                    newsItem.audioFilename.includes(f.name)
                );
                
                if (s3File) {
                    newsItem.audioS3Url = s3File.url;
                    newsItem.audioUrl = s3File.url; // Utiliser directement l'URL S3
                    updated = true;
                    console.log(`✅ News "${newsItem.title}" liée à S3: ${s3File.url}`);
                }
            }
        });
        
        if (updated) {
            this.app.newsManager.saveDatabase();
        }
    }

    /**
     * Récupère tous les fichiers audio stockés localement
     */
    async getAllLocalAudioFiles() {
        const files = [];
        
        // Ouvrir la base IndexedDB
        const db = await this.openAudioDB();
        const transaction = db.transaction(['audioFiles'], 'readonly');
        const store = transaction.objectStore('audioFiles');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to read audio files'));
            };
        });
    }

    /**
     * Sauvegarde un fichier audio dans IndexedDB
     */
    async saveAudioToLocal(filename, blob) {
        const db = await this.openAudioDB();
        const transaction = db.transaction(['audioFiles'], 'readwrite');
        const store = transaction.objectStore('audioFiles');
        
        return new Promise((resolve, reject) => {
            const request = store.put({
                name: filename,
                data: blob,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to save audio'));
        });
    }

    /**
     * Ouvre ou crée la base de données audio
     */
    async openAudioDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SaintEspritAudio', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('audioFiles')) {
                    const store = db.createObjectStore('audioFiles', { keyPath: 'name' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('Failed to open audio database'));
        });
    }

    /**
     * Méthode unifiée pour upload (S3 si configuré, sinon local)
     */
    async uploadAll() {
        if (this.isConfigured) {
            return this.uploadAllToS3();
        } else if (this.app.audioSyncManager) {
            return this.app.audioSyncManager.uploadAllAudio();
        }
        return { success: false, error: 'Aucun système de sync disponible' };
    }

    /**
     * Méthode unifiée pour download (S3 si configuré, sinon local)
     */
    async downloadAll() {
        if (this.isConfigured) {
            return this.downloadAllFromS3();
        } else if (this.app.audioSyncManager) {
            return this.app.audioSyncManager.downloadAllAudio();
        }
        return { success: false, error: 'Aucun système de sync disponible' };
    }
}

// Export pour utilisation dans l'app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioS3Manager;
}