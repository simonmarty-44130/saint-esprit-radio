// Script pour archiver la news "La chute de la falaise ou le chemin pour s'en sortir" via Amplify
// À exécuter dans la console du navigateur après connexion à l'application

async function archiveNewsViaAmplify() {
    try {
        console.log("🔍 Recherche de la news...");
        
        // Vérifier que l'application est chargée
        if (!window.app || !window.app.newsManager) {
            console.error("❌ L'application n'est pas chargée correctement");
            return;
        }
        
        // Récupérer toutes les news
        const allNews = window.app.newsManager.database;
        console.log(`📚 ${allNews.length} news trouvées dans la base`);
        
        // Chercher la news spécifique
        const targetNews = allNews.find(news => 
            news.title && news.title.includes("La chute de la falaise")
        );
        
        if (!targetNews) {
            console.error("❌ News non trouvée. Voici les news disponibles:");
            allNews.forEach(n => {
                console.log(`  - "${n.title}" (Auteur: ${n.author}, ID: ${n.id})`);
            });
            return;
        }
        
        console.log(`✅ News trouvée: "${targetNews.title}" (ID: ${targetNews.id})`);
        console.log(`   Auteur: ${targetNews.author}`);
        console.log(`   Catégorie: ${targetNews.category}`);
        
        // Initialiser ArchivesManager s'il n'existe pas
        if (!window.archivesManager) {
            window.archivesManager = new ArchivesManager();
            await window.archivesManager.init();
            console.log("📦 ArchivesManager initialisé");
        }
        
        // Vérifier que le client Amplify est disponible
        if (!window.archivesManager.client) {
            console.log("⚠️ Client Amplify non trouvé dans ArchivesManager, tentative de récupération...");
            
            // Essayer de récupérer le client directement
            if (window.amplifyData && window.amplifyData.client) {
                window.archivesManager.client = window.amplifyData.client;
                console.log("✅ Client Amplify récupéré depuis window.amplifyData");
            } else {
                console.error("❌ Impossible de récupérer le client Amplify");
                console.log("💡 Assurez-vous que amplify-data.js est chargé");
                return;
            }
        }
        
        // Archiver la news via Amplify
        console.log("📦 Archivage en cours via Amplify...");
        await window.archivesManager.archiveNews(targetNews);
        console.log("✅ News archivée dans DynamoDB");
        
        // Supprimer la news de la liste active
        const index = window.app.newsManager.database.findIndex(n => n.id === targetNews.id);
        if (index > -1) {
            window.app.newsManager.database.splice(index, 1);
            console.log("🗑️ News retirée de la liste active");
            
            // Sauvegarder les changements via Amplify
            if (window.app.storage && window.app.storage.save) {
                await window.app.storage.save({
                    news: window.app.newsManager.database,
                    animations: window.app.animationManager ? window.app.animationManager.database : [],
                    blocks: window.app.blockManager ? window.app.blockManager.getBlocks() : []
                });
                console.log("💾 Base de données mise à jour dans DynamoDB");
            }
        }
        
        // Rafraîchir l'affichage
        if (window.app.newsManager.render) {
            window.app.newsManager.render();
            console.log("🔄 Interface mise à jour");
        }
        
        console.log("✅ News archivée avec succès dans AWS!");
        console.log("💡 Vous pouvez maintenant la rechercher dans la section Archives");
        
        return true;
        
    } catch (error) {
        console.error("❌ Erreur lors de l'archivage:", error);
        console.error("Détails:", error.message);
        
        // Si l'erreur vient du modèle NewsArchive qui n'existe pas
        if (error.message && error.message.includes('NewsArchive')) {
            console.log("⚠️ Le modèle NewsArchive n'existe peut-être pas dans Amplify");
            console.log("💡 Vérifiez votre configuration Amplify Gen2");
        }
    }
}

// Fonction pour vérifier l'état d'Amplify
function checkAmplifyStatus() {
    console.log("=== ÉTAT AMPLIFY ===");
    console.log("window.amplifyData existe:", !!window.amplifyData);
    if (window.amplifyData) {
        console.log("window.amplifyData.client existe:", !!window.amplifyData.client);
    }
    console.log("window.archivesManager existe:", !!window.archivesManager);
    if (window.archivesManager) {
        console.log("window.archivesManager.client existe:", !!window.archivesManager.client);
    }
    console.log("===================");
}

// Vérifier l'état avant d'archiver
console.log("=== ARCHIVAGE DE NEWS VIA AMPLIFY ===");
checkAmplifyStatus();
console.log("\nDémarrage de l'archivage...\n");

// Exécuter l'archivage
archiveNewsViaAmplify().then(result => {
    if (result) {
        console.log("\n=== ARCHIVAGE TERMINÉ AVEC SUCCÈS ===");
    }
});