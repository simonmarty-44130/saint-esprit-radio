// Script d'initialisation des données pour Saint-Esprit Radio
import { AmplifyData } from './amplify-data.js';

export async function initializeTestData() {
    const data = new AmplifyData();
    const results = {
        news: [],
        errors: []
    };
    
    console.log('🚀 Initialisation des données de test...');
    
    // Données de test pour les news
    const testNews = [
        {
            title: "Bienvenue sur Saint-Esprit Radio avec Amplify Gen 2",
            content: "Notre plateforme radio est maintenant équipée de la technologie AWS Amplify Gen 2, offrant une synchronisation en temps réel et une expérience utilisateur améliorée.",
            author: "Direction Radio Fidélité"
        },
        {
            title: "Nouvelle émission : Matinale Spirituelle",
            content: "Rejoignez-nous chaque matin de 6h à 9h pour notre nouvelle émission matinale. Au programme : méditation, musique inspirante et actualités de la communauté.",
            author: "Équipe de programmation"
        },
        {
            title: "Formation pour les bénévoles",
            content: "Une session de formation sur le nouveau système est prévue ce samedi. Tous les bénévoles sont invités à participer pour découvrir les nouvelles fonctionnalités.",
            author: "Coordination bénévoles"
        },
        {
            title: "Podcast disponible : Les grandes voix de la foi",
            content: "Retrouvez notre série de podcasts exclusifs avec des interviews de personnalités inspirantes de notre communauté.",
            author: "Studio Production"
        },
        {
            title: "Maintenance technique programmée",
            content: "Une maintenance du système est prévue dimanche soir de 22h à minuit. Les services seront temporairement indisponibles.",
            author: "Service Technique"
        }
    ];
    
    // Créer les news de test
    for (const newsData of testNews) {
        try {
            const created = await data.createNews(newsData);
            results.news.push(created);
            console.log(`✅ News créée: "${newsData.title}"`);
        } catch (error) {
            console.error(`❌ Erreur création news: ${error.message}`);
            results.errors.push({ news: newsData.title, error: error.message });
        }
    }
    
    console.log(`\n📊 Résultat de l'initialisation:`);
    console.log(`✅ ${results.news.length} news créées`);
    console.log(`❌ ${results.errors.length} erreurs`);
    
    return results;
}

// Fonction pour nettoyer toutes les données (utile pour les tests)
export async function clearAllData() {
    const data = new AmplifyData();
    
    try {
        console.log('🗑️ Suppression de toutes les données...');
        
        // Récupérer toutes les news
        const allNews = await data.listNews();
        
        // Supprimer chaque news
        for (const news of allNews) {
            await data.deleteNews(news.id);
            console.log(`✅ News supprimée: "${news.title}"`);
        }
        
        console.log(`✅ ${allNews.length} news supprimées`);
        return allNews.length;
        
    } catch (error) {
        console.error('❌ Erreur suppression données:', error);
        throw error;
    }
}

// Export pour utilisation globale
window.initializeTestData = initializeTestData;
window.clearAllData = clearAllData;