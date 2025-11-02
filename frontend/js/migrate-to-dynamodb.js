/**
 * Script de migration des données JSON vers DynamoDB
 * À exécuter une seule fois pour migrer les données existantes
 */

async function migrateDataToDynamoDB() {
    console.log('🔄 Début de la migration vers DynamoDB...');
    
    try {
        // 1. Charger les anciennes données depuis S3/JSON
        console.log('📥 Chargement des données JSON existantes...');
        const oldStorage = new Storage(); // Ancien storage S3/JSON
        await oldStorage.init();
        
        const oldData = await oldStorage.load();
        
        if (!oldData) {
            console.log('❌ Aucune donnée à migrer');
            return;
        }
        
        console.log(`📊 Données trouvées :
            - ${oldData.news?.length || 0} news
            - ${oldData.animations?.length || 0} animations
            - ${oldData.blocks?.length || 0} blocks
            - ${oldData.conductors?.length || 0} conducteurs
        `);
        
        // 2. Initialiser le nouveau storage DynamoDB
        console.log('🔄 Initialisation de DynamoDB...');
        const newStorage = new StorageDynamoDB();
        await newStorage.init();
        
        // 3. Migrer chaque type de données
        let migratedCount = 0;
        
        // Migrer les news
        if (oldData.news && oldData.news.length > 0) {
            console.log(`📝 Migration de ${oldData.news.length} news...`);
            for (const item of oldData.news) {
                try {
                    // Ajouter les champs manquants si nécessaire
                    const newsItem = {
                        ...item,
                        id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                        createdAt: item.createdAt || item.created || Date.now(),
                        userId: item.userId || item.author?.toLowerCase().replace(/\s+/g, '') || 'unknown',
                        author: item.author || 'Unknown'
                    };
                    
                    await newStorage.saveItem('news', newsItem);
                    migratedCount++;
                    console.log(`✅ News "${newsItem.title}" migrée`);
                } catch (error) {
                    console.error(`❌ Erreur migration news:`, error);
                }
            }
        }
        
        // Migrer les animations
        if (oldData.animations && oldData.animations.length > 0) {
            console.log(`🎬 Migration de ${oldData.animations.length} animations...`);
            for (const item of oldData.animations) {
                try {
                    const animItem = {
                        ...item,
                        id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                        createdAt: item.createdAt || item.created || Date.now(),
                        userId: item.userId || item.author?.toLowerCase().replace(/\s+/g, '') || 'unknown',
                        author: item.author || 'Unknown'
                    };
                    
                    await newStorage.saveItem('animations', animItem);
                    migratedCount++;
                    console.log(`✅ Animation "${animItem.title}" migrée`);
                } catch (error) {
                    console.error(`❌ Erreur migration animation:`, error);
                }
            }
        }
        
        // Migrer les blocks
        if (oldData.blocks && oldData.blocks.length > 0) {
            console.log(`📦 Migration de ${oldData.blocks.length} blocks...`);
            for (const item of oldData.blocks) {
                try {
                    const blockItem = {
                        ...item,
                        id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                        createdAt: item.createdAt || item.created || Date.now(),
                        userId: item.userId || 'system',
                        author: item.author || 'System'
                    };
                    
                    await newStorage.saveItem('blocks', blockItem);
                    migratedCount++;
                    console.log(`✅ Block "${blockItem.name}" migré`);
                } catch (error) {
                    console.error(`❌ Erreur migration block:`, error);
                }
            }
        }
        
        // Migrer les conducteurs
        if (oldData.conductors && oldData.conductors.length > 0) {
            console.log(`🎼 Migration de ${oldData.conductors.length} conducteurs...`);
            for (const item of oldData.conductors) {
                try {
                    const conductorItem = {
                        ...item,
                        id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                        createdAt: item.createdAt || item.created || Date.now(),
                        userId: item.userId || 'system',
                        author: item.author || 'System'
                    };
                    
                    await newStorage.saveItem('conductors', conductorItem);
                    migratedCount++;
                    console.log(`✅ Conducteur migré`);
                } catch (error) {
                    console.error(`❌ Erreur migration conducteur:`, error);
                }
            }
        }
        
        console.log(`
        ✅ Migration terminée !
        📊 ${migratedCount} éléments migrés avec succès
        
        🎉 Vos données sont maintenant dans DynamoDB !
        `);
        
        // 4. Recharger les données pour vérifier
        await newStorage.loadAllData();
        const stats = newStorage.getStats();
        
        console.log(`
        📈 Statistiques finales :
        - ${stats.totalNews} news
        - ${stats.totalAnimations} animations
        - ${stats.totalBlocks} blocks
        - ${stats.totalConductors} conducteurs
        - ${stats.activeUsers} utilisateurs actifs
        `);
        
        // 5. Rafraîchir l'interface
        if (window.app) {
            await window.app.loadData();
            console.log('🔄 Interface rafraîchie avec les nouvelles données');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        return false;
    }
}

// Fonction pour lancer la migration manuellement
window.migrateToDynamoDB = migrateDataToDynamoDB;

// Message d'aide
console.log(`
🔄 MIGRATION VERS DYNAMODB
========================

Pour migrer vos données JSON existantes vers DynamoDB, 
exécutez cette commande dans la console :

migrateToDynamoDB()

Cette opération ne doit être faite qu'une seule fois !
`);