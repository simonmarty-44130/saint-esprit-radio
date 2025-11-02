/**
 * Script de migration MULTI-UTILISATEURS
 * Importe les données de TOUS les utilisateurs depuis S3 vers DynamoDB
 */

async function migrateAllUsersToDynamoDB() {
    console.log('🔄 Migration de TOUS les utilisateurs vers DynamoDB...');
    
    // Liste des utilisateurs à migrer (basée sur votre liste Cognito)
    const users = [
        { id: '7199604e-c0b1-700b-8cdb-3b100af8fef0', email: 'simon.marty@radio-fidelite.fr', name: 'Simon Marty' },
        { id: 'a16970ce-2061-70e6-6c7e-1d4872f2d432', email: 'clara.bert@radio-fidelite.fr', name: 'Clara Bert' },
        { id: 'c17980de-f0c1-7030-5bb8-f3d5ee447228', email: 'arthur.camus@radio-fidelite.fr', name: 'Arthur Camus' },
        { id: '4179903e-6001-703c-d4bd-56a83cd5ef66', email: 'morgane.poirier@radio-fidelite.fr', name: 'Morgane Poirier' },
        { id: 'f1b9509e-b001-70b4-1fd4-a66959aeea4b', email: 'tiphaine.sellier@radio-fidelite.fr', name: 'Tiphaine Sellier' },
        { id: '0129b09e-30c1-70e6-c135-d49dc2e6a7c3', email: 'test.radio@radio-fidelite.fr', name: 'Test Radio' }
    ];
    
    // Noms simplifiés pour les clés S3 (format utilisé dans storage.js)
    const userKeys = {
        '7199604e-c0b1-700b-8cdb-3b100af8fef0': 'simonmarty',
        'a16970ce-2061-70e6-6c7e-1d4872f2d432': 'clarabert',
        'c17980de-f0c1-7030-5bb8-f3d5ee447228': 'arthurcamus',
        '4179903e-6001-703c-d4bd-56a83cd5ef66': 'morganepoirier',
        'f1b9509e-b001-70b4-1fd4-a66959aeea4b': 'tiphainesellier',
        '0129b09e-30c1-70e6-c135-d49dc2e6a7c3': 'testradio'
    };
    
    try {
        // Initialiser le storage DynamoDB
        console.log('🔄 Initialisation de DynamoDB...');
        const dynamoStorage = new StorageDynamoDB();
        await dynamoStorage.init();
        
        let totalMigrated = 0;
        
        // Pour chaque utilisateur
        for (const user of users) {
            console.log(`\n👤 Migration de ${user.name} (${user.email})...`);
            
            const userKey = userKeys[user.id] || user.email.split('@')[0].replace(/[.-]/g, '');
            const dataUrl = `https://saint-esprit.link/users/${userKey}/data.json`;
            
            try {
                // Charger les données de l'utilisateur depuis S3
                console.log(`📥 Chargement depuis: ${dataUrl}`);
                
                const response = await fetch(dataUrl + '?t=' + Date.now(), {
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!response.ok) {
                    console.log(`⚠️ Pas de données pour ${user.name} (404 ou erreur)`);
                    continue;
                }
                
                const userData = await response.json();
                
                if (!userData) {
                    console.log(`⚠️ Données vides pour ${user.name}`);
                    continue;
                }
                
                console.log(`📊 Données trouvées pour ${user.name}:
                    - ${userData.news?.length || 0} news
                    - ${userData.animations?.length || 0} animations
                `);
                
                // Migrer les news
                if (userData.news && userData.news.length > 0) {
                    console.log(`📝 Migration de ${userData.news.length} news...`);
                    for (const item of userData.news) {
                        try {
                            const newsItem = {
                                ...item,
                                id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                                createdAt: item.createdAt || item.created || item.lastModified || Date.now(),
                                userId: user.id,
                                userEmail: user.email,
                                author: item.author || user.name,
                                updatedAt: Date.now()
                            };
                            
                            await dynamoStorage.saveItem('news', newsItem);
                            totalMigrated++;
                            console.log(`  ✅ News "${newsItem.title}" migrée`);
                        } catch (error) {
                            console.error(`  ❌ Erreur migration news:`, error.message);
                        }
                    }
                }
                
                // Migrer les animations
                if (userData.animations && userData.animations.length > 0) {
                    console.log(`🎬 Migration de ${userData.animations.length} animations...`);
                    for (const item of userData.animations) {
                        try {
                            const animItem = {
                                ...item,
                                id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                                createdAt: item.createdAt || item.created || item.lastModified || Date.now(),
                                userId: user.id,
                                userEmail: user.email,
                                author: item.author || user.name,
                                updatedAt: Date.now()
                            };
                            
                            await dynamoStorage.saveItem('animations', animItem);
                            totalMigrated++;
                            console.log(`  ✅ Animation "${animItem.title}" migrée`);
                        } catch (error) {
                            console.error(`  ❌ Erreur migration animation:`, error.message);
                        }
                    }
                }
                
                // Migrer les blocks (si présents et si c'est l'utilisateur principal)
                if (userData.blocks && userData.blocks.length > 0) {
                    console.log(`📦 Migration de ${userData.blocks.length} blocks...`);
                    for (const item of userData.blocks) {
                        try {
                            const blockItem = {
                                ...item,
                                id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                                createdAt: item.createdAt || item.created || Date.now(),
                                userId: user.id,
                                userEmail: user.email,
                                author: user.name,
                                updatedAt: Date.now()
                            };
                            
                            await dynamoStorage.saveItem('blocks', blockItem);
                            totalMigrated++;
                            console.log(`  ✅ Block "${blockItem.name}" migré`);
                        } catch (error) {
                            console.error(`  ❌ Erreur migration block:`, error.message);
                        }
                    }
                }
                
                console.log(`✅ ${user.name} migré avec succès!`);
                
            } catch (error) {
                console.error(`❌ Erreur pour ${user.name}:`, error.message);
                continue;
            }
        }
        
        console.log(`
        ========================================
        ✅ MIGRATION TERMINÉE !
        ========================================
        📊 ${totalMigrated} éléments migrés au total
        `);
        
        // Recharger les données pour vérifier
        await dynamoStorage.loadAllData();
        const stats = dynamoStorage.getStats();
        
        console.log(`
        📈 STATISTIQUES FINALES :
        - ${stats.totalNews} news au total
        - ${stats.totalAnimations} animations au total
        - ${stats.totalBlocks} blocks au total
        - ${stats.activeUsers} utilisateurs actifs
        
        Par utilisateur :
        - Vos contenus : ${stats.myNews} news, ${stats.myAnimations} animations
        `);
        
        // Rafraîchir l'interface
        if (window.app) {
            await window.app.loadData();
            console.log('🔄 Interface rafraîchie avec toutes les données');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Erreur critique lors de la migration:', error);
        return false;
    }
}

// Fonction pour vérifier quels utilisateurs ont des données
async function checkUsersData() {
    const users = [
        { name: 'Simon Marty', key: 'simonmarty' },
        { name: 'Clara Bert', key: 'clarabert' },
        { name: 'Arthur Camus', key: 'arthurcamus' },
        { name: 'Morgane Poirier', key: 'morganepoirier' },
        { name: 'Tiphaine Sellier', key: 'tiphainesellier' },
        { name: 'Test Radio', key: 'testradio' }
    ];
    
    console.log('🔍 Vérification des données existantes sur S3...\n');
    
    for (const user of users) {
        const url = `https://saint-esprit.link/users/${user.key}/data.json`;
        try {
            const response = await fetch(url + '?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ ${user.name}: ${data.news?.length || 0} news, ${data.animations?.length || 0} animations`);
            } else {
                console.log(`❌ ${user.name}: Pas de données`);
            }
        } catch (error) {
            console.log(`❌ ${user.name}: Erreur de chargement`);
        }
    }
}

// Exporter les fonctions
window.migrateAllUsers = migrateAllUsersToDynamoDB;
window.checkUsersData = checkUsersData;

// Message d'aide
console.log(`
🔄 MIGRATION MULTI-UTILISATEURS
================================

Commandes disponibles :

1️⃣ checkUsersData()
   Vérifie quels utilisateurs ont des données sur S3

2️⃣ migrateAllUsers()
   Migre TOUS les utilisateurs vers DynamoDB

⚠️ La migration ne doit être faite qu'une seule fois !
`);