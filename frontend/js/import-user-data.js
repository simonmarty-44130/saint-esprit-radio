/**
 * Script d'import direct des données utilisateurs dans DynamoDB
 * Utilisez ce script pour importer des données JSON fournies manuellement
 */

async function importUserData(userId, userName, userEmail, jsonData) {
    console.log(`📥 Import des données pour ${userName}...`);
    
    try {
        // Initialiser DynamoDB
        const dynamoStorage = new StorageDynamoDB();
        await dynamoStorage.init();
        
        let imported = 0;
        
        // Parser les données si c'est une chaîne
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        
        // Importer les news
        if (data.news && data.news.length > 0) {
            console.log(`📝 Import de ${data.news.length} news...`);
            for (const item of data.news) {
                try {
                    const newsItem = {
                        ...item,
                        id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                        createdAt: item.createdAt || item.created || item.lastModified || Date.now(),
                        userId: userId,
                        userEmail: userEmail,
                        author: item.author || userName,
                        updatedAt: Date.now()
                    };
                    
                    await dynamoStorage.saveItem('news', newsItem);
                    imported++;
                    console.log(`  ✅ News "${newsItem.title}"`);
                } catch (error) {
                    console.error(`  ❌ Erreur news:`, error.message);
                }
            }
        }
        
        // Importer les animations
        if (data.animations && data.animations.length > 0) {
            console.log(`🎬 Import de ${data.animations.length} animations...`);
            for (const item of data.animations) {
                try {
                    const animItem = {
                        ...item,
                        id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                        createdAt: item.createdAt || item.created || item.lastModified || Date.now(),
                        userId: userId,
                        userEmail: userEmail,
                        author: item.author || userName,
                        updatedAt: Date.now()
                    };
                    
                    await dynamoStorage.saveItem('animations', animItem);
                    imported++;
                    console.log(`  ✅ Animation "${animItem.title}"`);
                } catch (error) {
                    console.error(`  ❌ Erreur animation:`, error.message);
                }
            }
        }
        
        // Importer les blocks
        if (data.blocks && data.blocks.length > 0) {
            console.log(`📦 Import de ${data.blocks.length} blocks...`);
            for (const item of data.blocks) {
                try {
                    const blockItem = {
                        ...item,
                        id: item.id || Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                        createdAt: item.createdAt || item.created || Date.now(),
                        userId: userId,
                        userEmail: userEmail,
                        author: userName,
                        updatedAt: Date.now()
                    };
                    
                    await dynamoStorage.saveItem('blocks', blockItem);
                    imported++;
                    console.log(`  ✅ Block "${blockItem.name}"`);
                } catch (error) {
                    console.error(`  ❌ Erreur block:`, error.message);
                }
            }
        }
        
        console.log(`✅ ${imported} éléments importés pour ${userName}`);
        
        // Rafraîchir l'interface
        if (window.app) {
            await window.app.loadData();
        }
        
        return imported;
        
    } catch (error) {
        console.error(`❌ Erreur import pour ${userName}:`, error);
        return 0;
    }
}

// Fonction pour importer Clara Bert
window.importClaraBert = async function(jsonData) {
    return await importUserData(
        'a16970ce-2061-70e6-6c7e-1d4872f2d432',
        'Clara Bert',
        'clara.bert@radio-fidelite.fr',
        jsonData
    );
};

// Fonction pour importer Arthur Camus
window.importArthurCamus = async function(jsonData) {
    return await importUserData(
        'c17980de-f0c1-7030-5bb8-f3d5ee447228',
        'Arthur Camus',
        'arthur.camus@radio-fidelite.fr',
        jsonData
    );
};

// Fonction pour importer Morgane Poirier
window.importMorganePoirier = async function(jsonData) {
    return await importUserData(
        '4179903e-6001-703c-d4bd-56a83cd5ef66',
        'Morgane Poirier',
        'morgane.poirier@radio-fidelite.fr',
        jsonData
    );
};

// Fonction pour importer Tiphaine Sellier
window.importTiphaineSellier = async function(jsonData) {
    return await importUserData(
        'f1b9509e-b001-70b4-1fd4-a66959aeea4b',
        'Tiphaine Sellier',
        'tiphaine.sellier@radio-fidelite.fr',
        jsonData
    );
};

// Fonction pour importer Simon Marty
window.importSimonMarty = async function(jsonData) {
    return await importUserData(
        '7199604e-c0b1-700b-8cdb-3b100af8fef0',
        'Simon Marty',
        'simon.marty@radio-fidelite.fr',
        jsonData
    );
};

// Export générique
window.importUserData = importUserData;

console.log(`
📥 IMPORT DES DONNÉES UTILISATEURS
==================================

Pour importer les données d'un utilisateur, utilisez :

importClaraBert(jsonData)
importArthurCamus(jsonData)
importMorganePoirier(jsonData)
importTiphaineSellier(jsonData)
importSimonMarty(jsonData)

Ou pour un import personnalisé :
importUserData(userId, userName, userEmail, jsonData)

Collez simplement le JSON après la fonction !
`);