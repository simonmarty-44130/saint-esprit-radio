// Gestionnaire de données Amplify GraphQL
import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export class AmplifyData {
    constructor() {
        this.client = client;
        this.subscribers = new Map();
    }
    
    // ===== NEWS =====
    
    // Créer une news
    async createNews(newsData) {
        try {
            const result = await this.client.models.News.create({
                title: newsData.title,
                content: newsData.content,
                author: newsData.author || 'Unknown'
            });
            
            console.log('✅ News créée:', result.data);
            return result.data;
        } catch (error) {
            console.error('❌ Erreur création news:', error);
            throw error;
        }
    }
    
    // Lister toutes les news
    async listNews(filter = {}) {
        try {
            const result = await this.client.models.News.list({
                filter: filter
            });
            
            console.log(`✅ ${result.data.length} news récupérées`);
            return result.data;
        } catch (error) {
            console.error('❌ Erreur récupération news:', error);
            throw error;
        }
    }
    
    // Récupérer une news par ID
    async getNews(id) {
        try {
            const result = await this.client.models.News.get({ id });
            console.log('✅ News récupérée:', result.data);
            return result.data;
        } catch (error) {
            console.error('❌ Erreur récupération news:', error);
            throw error;
        }
    }
    
    // Mettre à jour une news
    async updateNews(id, updates) {
        try {
            const result = await this.client.models.News.update({
                id,
                ...updates
            });
            
            console.log('✅ News mise à jour:', result.data);
            return result.data;
        } catch (error) {
            console.error('❌ Erreur mise à jour news:', error);
            throw error;
        }
    }
    
    // Supprimer une news
    async deleteNews(id) {
        try {
            await this.client.models.News.delete({ id });
            console.log('✅ News supprimée:', id);
        } catch (error) {
            console.error('❌ Erreur suppression news:', error);
            throw error;
        }
    }
    
    // ===== TEMPS RÉEL =====
    
    // Écouter les créations de news
    subscribeToNewsCreated(callback) {
        const subscription = this.client.models.News.onCreate().subscribe({
            next: (news) => {
                console.log('🔔 Nouvelle news créée:', news);
                callback(news);
            },
            error: (err) => console.error('❌ Erreur subscription create:', err)
        });
        
        this.subscribers.set('newsCreated', subscription);
        return subscription;
    }
    
    // Écouter les mises à jour de news
    subscribeToNewsUpdated(callback) {
        const subscription = this.client.models.News.onUpdate().subscribe({
            next: (news) => {
                console.log('🔔 News mise à jour:', news);
                callback(news);
            },
            error: (err) => console.error('❌ Erreur subscription update:', err)
        });
        
        this.subscribers.set('newsUpdated', subscription);
        return subscription;
    }
    
    // Écouter les suppressions de news
    subscribeToNewsDeleted(callback) {
        const subscription = this.client.models.News.onDelete().subscribe({
            next: (news) => {
                console.log('🔔 News supprimée:', news);
                callback(news);
            },
            error: (err) => console.error('❌ Erreur subscription delete:', err)
        });
        
        this.subscribers.set('newsDeleted', subscription);
        return subscription;
    }
    
    // Arrêter toutes les souscriptions
    unsubscribeAll() {
        this.subscribers.forEach((sub, key) => {
            sub.unsubscribe();
            console.log(`✅ Souscription ${key} arrêtée`);
        });
        this.subscribers.clear();
    }
    
    // ===== MIGRATION DEPUIS S3 =====
    
    // Migrer les données existantes depuis l'ancien storage S3
    async migrateFromS3(oldStorage) {
        try {
            console.log('🔄 Début migration S3 → DynamoDB...');
            
            // Récupérer les anciennes données
            const oldData = await oldStorage.getData();
            
            // Migrer les news
            let migratedCount = 0;
            let errors = [];
            
            for (const news of oldData.news || []) {
                try {
                    await this.createNews({
                        ...news,
                        // Ajouter metadata de migration
                        migratedFromS3: true,
                        migratedAt: new Date().toISOString()
                    });
                    migratedCount++;
                } catch (error) {
                    console.warn('⚠️ Erreur migration news:', news.id, error);
                    errors.push({ news: news.id, error: error.message });
                }
            }
            
            console.log(`✅ Migration terminée: ${migratedCount}/${oldData.news?.length || 0} news migrées`);
            
            return { 
                migratedCount, 
                total: oldData.news?.length || 0,
                errors: errors
            };
            
        } catch (error) {
            console.error('❌ Erreur migration:', error);
            throw error;
        }
    }
}

// Instance globale  
window.amplifyData = new AmplifyData();