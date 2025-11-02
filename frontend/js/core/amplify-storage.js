/**
 * Storage avec AWS Amplify
 * Version moderne utilisant Amplify au lieu du SDK AWS direct
 */

import { Amplify, Storage, Auth } from 'aws-amplify';
import awsconfig from '../../aws-exports'; // Généré par amplify push

// Configurer Amplify
Amplify.configure(awsconfig);

class AmplifyStorage {
    constructor() {
        this.userId = null;
        this.data = null;
        this.lastSyncCheck = 0;
        this.init();
    }
    
    async init() {
        try {
            // Vérifier si l'utilisateur est connecté
            const user = await Auth.currentAuthenticatedUser();
            this.userId = user.username;
            console.log(`✅ Amplify Storage initialized for user: ${this.userId}`);
            
            // Charger les données utilisateur
            await this.loadUserData();
            
        } catch (error) {
            console.log('❌ User not authenticated (Cognito will handle)');
            // Cognito gère l'authentification maintenant
        }
    }
    
    /**
     * Charger les données utilisateur depuis S3
     */
    async loadUserData() {
        try {
            const result = await Storage.get(`users/${this.userId}/data.json`, {
                download: true,
                level: 'private'
            });
            
            const text = await result.Body.text();
            this.data = JSON.parse(text);
            console.log(`📥 Data loaded from S3, version: ${this.data.version}`);
            
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                console.log('📝 Creating new user data...');
                this.data = this.getDefaultData();
                await this.saveUserData();
            } else {
                console.error('Error loading data:', error);
                throw error;
            }
        }
    }
    
    /**
     * Sauvegarder les données utilisateur vers S3
     */
    async saveUserData() {
        try {
            this.data.version = (this.data.version || 0) + 1;
            this.data.lastModified = Date.now();
            
            const result = await Storage.put(
                `users/${this.userId}/data.json`,
                JSON.stringify(this.data, null, 2),
                {
                    level: 'private',
                    contentType: 'application/json'
                }
            );
            
            console.log(`💾 Data saved to S3, version: ${this.data.version}`);
            return result;
            
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }
    
    /**
     * Upload un fichier audio
     */
    async uploadAudio(file, progressCallback) {
        try {
            const fileName = `audio/${this.userId}/${Date.now()}_${file.name}`;
            
            const result = await Storage.put(fileName, file, {
                level: 'private',
                contentType: file.type,
                progressCallback(progress) {
                    const percentage = (progress.loaded / progress.total) * 100;
                    console.log(`Upload progress: ${percentage.toFixed(2)}%`);
                    if (progressCallback) {
                        progressCallback(percentage);
                    }
                }
            });
            
            console.log('✅ Audio uploaded:', result.key);
            return result.key;
            
        } catch (error) {
            console.error('Error uploading audio:', error);
            throw error;
        }
    }
    
    /**
     * Obtenir l'URL d'un fichier audio
     */
    async getAudioUrl(key) {
        try {
            const url = await Storage.get(key, {
                level: 'private',
                expires: 3600 // URL valide pendant 1 heure
            });
            
            return url;
            
        } catch (error) {
            console.error('Error getting audio URL:', error);
            throw error;
        }
    }
    
    /**
     * Lister les fichiers audio de l'utilisateur
     */
    async listAudioFiles() {
        try {
            const result = await Storage.list(`audio/${this.userId}/`, {
                level: 'private'
            });
            
            return result.results;
            
        } catch (error) {
            console.error('Error listing audio files:', error);
            throw error;
        }
    }
    
    /**
     * Supprimer un fichier audio
     */
    async deleteAudio(key) {
        try {
            await Storage.remove(key, {
                level: 'private'
            });
            
            console.log('✅ Audio deleted:', key);
            
        } catch (error) {
            console.error('Error deleting audio:', error);
            throw error;
        }
    }
    
    // ===== INTERFACE COMPATIBLE AVEC L'EXISTANT =====
    
    /**
     * Obtenir toutes les données (compatible avec l'ancien système)
     */
    async getAllData() {
        return this.data;
    }
    
    /**
     * Sauvegarder toutes les données (compatible avec l'ancien système)
     */
    async saveAllData(data) {
        this.data = data;
        await this.saveUserData();
    }
    
    /**
     * Obtenir les news (compatible)
     */
    getNews() {
        return this.data?.news || [];
    }
    
    /**
     * Ajouter une news (compatible)
     */
    async addNews(news) {
        if (!this.data.news) {
            this.data.news = [];
        }
        this.data.news.push(news);
        await this.saveUserData();
    }
    
    /**
     * Obtenir les blocks (compatible)
     */
    getBlocks() {
        return this.data?.blocks || [];
    }
    
    /**
     * Ajouter un block (compatible)
     */
    async addBlock(block) {
        if (!this.data.blocks) {
            this.data.blocks = [];
        }
        this.data.blocks.push(block);
        await this.saveUserData();
    }
    
    /**
     * Obtenir les données par défaut
     */
    getDefaultData() {
        return {
            version: 1,
            userId: this.userId,
            createdAt: Date.now(),
            lastModified: Date.now(),
            news: [],
            blocks: [],
            animations: [],
            conducteurs: [],
            fridge: [],
            templates: [],
            settings: {
                theme: 'light',
                autoSave: true,
                notifications: true
            }
        };
    }
    
    /**
     * Déconnexion
     */
    async signOut() {
        try {
            await Auth.signOut();
            // Utiliser la déconnexion Cognito
            if (window.cognitoLogout) {
                window.cognitoLogout();
            }
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }
}

// Export pour utilisation
export default AmplifyStorage;