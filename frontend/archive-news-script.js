// Script pour archiver la news "La chute de la falaise ou le chemin pour s'en sortir"
// À exécuter dans la console du navigateur après connexion à l'application

async function archiveSpecificNews() {
    try {
        console.log("🔍 Recherche de la news...");
        
        // Accéder au newsManager
        if (!window.app || !window.app.newsManager) {
            console.error("❌ L'application n'est pas chargée correctement");
            return;
        }
        
        // Récupérer toutes les news
        const allNews = window.app.newsManager.database;
        console.log(`📚 ${allNews.length} news trouvées dans la base`);
        
        // Chercher la news spécifique de Simon Marty
        const targetNews = allNews.find(news => 
            news.title && news.title.includes("La chute de la falaise") &&
            news.author && news.author.includes("Simon")
        );
        
        if (!targetNews) {
            console.error("❌ News non trouvée. Voici les news de Simon Marty disponibles:");
            allNews.filter(n => n.author && n.author.includes("Simon")).forEach(n => {
                console.log(`  - "${n.title}" (ID: ${n.id})`);
            });
            return;
        }
        
        console.log(`✅ News trouvée: "${targetNews.title}" (ID: ${targetNews.id})`);
        console.log(`   Auteur: ${targetNews.author}`);
        console.log(`   Catégorie: ${targetNews.category}`);
        
        // Créer l'ArchivesManager s'il n'existe pas
        if (!window.archivesManager) {
            const { ArchivesManager } = await import('./js/managers/ArchivesManager.js');
            window.archivesManager = new ArchivesManager();
        }
        
        // Archiver la news
        console.log("📦 Archivage en cours...");
        await window.archivesManager.archiveNews(targetNews);
        
        // Supprimer la news de la liste active
        const index = window.app.newsManager.database.indexOf(targetNews);
        if (index > -1) {
            window.app.newsManager.database.splice(index, 1);
            console.log("🗑️ News retirée de la liste active");
        }
        
        // Rafraîchir l'affichage
        if (window.app.newsManager.render) {
            window.app.newsManager.render();
            console.log("🔄 Interface mise à jour");
        }
        
        console.log("✅ News archivée avec succès!");
        console.log("💡 Vous pouvez maintenant la rechercher dans la section Archives");
        
    } catch (error) {
        console.error("❌ Erreur lors de l'archivage:", error);
    }
}

// Exécuter automatiquement
archiveSpecificNews();