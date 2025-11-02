// Wrapper de compatibilité entre ancien storage.js et Amplify
import { AmplifyData } from './amplify-data.js';

export class AmplifyStorageWrapper {
    constructor() {
        this.amplifyData = new AmplifyData();
        this.isAmplifyMode = true;
    }
    
    // Méthodes compatibles avec l'ancien storage.js
    async save(data) {
        try {
            // Sauvegarder vers DynamoDB au lieu de S3
            const results = [];
            
            // Sauvegarder les news
            for (const news of data.news || []) {
                if (!news.id) {
                    // Nouvelle news
                    const created = await this.amplifyData.createNews(news);
                    results.push(created);
                } else {
                    // Mise à jour
                    const updated = await this.amplifyData.updateNews(news.id, news);
                    results.push(updated);
                }
            }
            
            console.log(`✅ ${results.length} éléments sauvegardés via Amplify`);
            return results;
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde Amplify:', error);
            throw error;
        }
    }
    
    async load() {
        try {
            const news = await this.amplifyData.listNews();
            
            // Format compatible avec l'ancien système
            const data = {
                news: news,
                blocks: [], // À implémenter quand le modèle Block sera ajouté
                animations: [], // À implémenter quand le modèle Animation sera ajouté
                emissions: [], // À implémenter quand le modèle Emission sera ajouté
                version: Date.now()
            };
            
            console.log(`✅ Données chargées via Amplify: ${news.length} news`);
            return data;
            
        } catch (error) {
            console.error('❌ Erreur chargement Amplify:', error);
            throw error;
        }
    }
    
    // Méthode pour vérifier si Amplify est disponible
    async checkAmplifyAvailability() {
        try {
            // Tenter une simple requête pour vérifier la connexion
            await this.amplifyData.listNews();
            return true;
        } catch (error) {
            console.warn('⚠️ Amplify non disponible, fallback vers S3:', error.message);
            return false;
        }
    }
    
    // Migration depuis l'ancien storage
    async migrateFromOldStorage(oldStorage) {
        try {
            console.log('🔄 Début de la migration S3 → DynamoDB...');
            
            const oldData = await oldStorage.getData();
            const migrationResult = await this.amplifyData.migrateFromS3({ 
                getData: () => oldData 
            });
            
            console.log(`✅ Migration terminée: ${migrationResult.migratedCount}/${migrationResult.total} éléments migrés`);
            
            if (migrationResult.errors && migrationResult.errors.length > 0) {
                console.warn('⚠️ Erreurs durant la migration:', migrationResult.errors);
            }
            
            return migrationResult;
            
        } catch (error) {
            console.error('❌ Erreur migration:', error);
            throw error;
        }
    }
    
    // Synchroniser les données entre S3 et DynamoDB
    async syncWithOldStorage(oldStorage) {
        try {
            console.log('🔄 Synchronisation S3 ↔ DynamoDB...');
            
            // Récupérer les données des deux sources
            const [oldData, newData] = await Promise.all([
                oldStorage.getData(),
                this.load()
            ]);
            
            // Identifier les différences
            const oldNewsIds = new Set(oldData.news?.map(n => n.id) || []);
            const newNewsIds = new Set(newData.news?.map(n => n.id) || []);
            
            // News présentes dans S3 mais pas dans DynamoDB
            const toMigrate = oldData.news?.filter(n => !newNewsIds.has(n.id)) || [];
            
            // News présentes dans DynamoDB mais pas dans S3
            const toBackup = newData.news?.filter(n => !oldNewsIds.has(n.id)) || [];
            
            console.log(`📊 Sync: ${toMigrate.length} à migrer vers DynamoDB, ${toBackup.length} à sauvegarder vers S3`);
            
            // Migrer vers DynamoDB
            for (const news of toMigrate) {
                try {
                    await this.amplifyData.createNews(news);
                    console.log(`✅ News migrée: ${news.title}`);
                } catch (error) {
                    console.warn(`⚠️ Erreur migration news ${news.id}:`, error.message);
                }
            }
            
            // Optionnel: sauvegarder vers S3 les nouvelles données
            if (toBackup.length > 0) {
                const updatedOldData = {
                    ...oldData,
                    news: [...(oldData.news || []), ...toBackup]
                };
                await oldStorage.saveData(updatedOldData);
                console.log(`✅ ${toBackup.length} news sauvegardées vers S3`);
            }
            
            return {
                migrated: toMigrate.length,
                backedUp: toBackup.length,
                total: oldData.news?.length || 0
            };
            
        } catch (error) {
            console.error('❌ Erreur synchronisation:', error);
            throw error;
        }
    }
}

// Export pour utilisation globale
window.AmplifyStorageWrapper = AmplifyStorageWrapper;