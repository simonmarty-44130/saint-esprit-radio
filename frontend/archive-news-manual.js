// Script manuel pour archiver la news "La chute de la falaise ou le chemin pour s'en sortir"
// À exécuter dans la console du navigateur après connexion à l'application

async function archiveNewsManually() {
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
        
        // Créer une entrée d'archive manuellement
        const archivedNews = {
            ...targetNews,
            archivedAt: new Date().toISOString(),
            originalId: targetNews.id,
            searchableContent: `${targetNews.title} ${targetNews.content} ${targetNews.author}`.toLowerCase()
        };
        
        // Stocker dans le localStorage comme archive
        let archives = [];
        try {
            const existingArchives = localStorage.getItem('saint-esprit-archives');
            if (existingArchives) {
                archives = JSON.parse(existingArchives);
            }
        } catch (e) {
            console.log("Création d'un nouveau stockage d'archives");
        }
        
        // Ajouter la news aux archives
        archives.push(archivedNews);
        localStorage.setItem('saint-esprit-archives', JSON.stringify(archives));
        console.log("📦 News ajoutée aux archives locales");
        
        // Supprimer la news de la liste active
        const index = window.app.newsManager.database.findIndex(n => n.id === targetNews.id);
        if (index > -1) {
            window.app.newsManager.database.splice(index, 1);
            console.log("🗑️ News retirée de la liste active");
            
            // Sauvegarder les changements
            if (window.app.storage) {
                await window.app.storage.save({
                    news: window.app.newsManager.database,
                    animations: window.app.animationManager ? window.app.animationManager.database : [],
                    blocks: window.app.blockManager ? window.app.blockManager.getBlocks() : []
                });
                console.log("💾 Base de données mise à jour");
            }
        }
        
        // Rafraîchir l'affichage
        if (window.app.newsManager.render) {
            window.app.newsManager.render();
            console.log("🔄 Interface mise à jour");
        }
        
        console.log("✅ News archivée avec succès!");
        console.log("📚 Archives actuelles:", archives.length, "news");
        console.log("💡 Note: Archive stockée localement. Pour une recherche complète, utilisez la section Archives.");
        
        return archivedNews;
        
    } catch (error) {
        console.error("❌ Erreur lors de l'archivage:", error);
    }
}

// Fonction pour voir les archives locales
function viewLocalArchives() {
    try {
        const archives = JSON.parse(localStorage.getItem('saint-esprit-archives') || '[]');
        console.log(`📚 ${archives.length} news archivées localement:`);
        archives.forEach((news, index) => {
            console.log(`${index + 1}. "${news.title}" - ${news.author} (Archivé le: ${new Date(news.archivedAt).toLocaleDateString('fr-FR')})`);
        });
        return archives;
    } catch (error) {
        console.error("Erreur lecture archives:", error);
        return [];
    }
}

// Exécuter l'archivage
console.log("=== ARCHIVAGE DE NEWS ===");
archiveNewsManually().then(result => {
    if (result) {
        console.log("=== TERMINÉ ===");
        console.log("Pour voir toutes les archives locales, tapez: viewLocalArchives()");
    }
});