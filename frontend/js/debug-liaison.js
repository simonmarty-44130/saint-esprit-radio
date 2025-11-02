// Script de debug pour liaison news-journal
console.log('=== DEBUG LIAISON NEWS-JOURNAL ===');

// Fonction de diagnostic
function debugLiaison() {
    if (!window.app) {
        console.error('❌ window.app non disponible');
        return;
    }
    
    console.log('1. Vérification des managers:');
    console.log('   - newsManager:', !!window.app.newsManager);
    console.log('   - blockManager:', !!window.app.blockManager);
    
    if (window.app.newsManager) {
        const news = window.app.newsManager.getDatabase();
        console.log(`2. News disponibles: ${news.length}`);
        if (news.length > 0) {
            console.log('   Exemple de news:', {
                id: news[0].id,
                title: news[0].title,
                blockId: news[0].blockId,
                assignedBlock: news[0].assignedBlock
            });
        }
    }
    
    if (window.app.blockManager) {
        const blocks = window.app.blockManager.getBlocks();
        console.log(`3. Blocks disponibles: ${blocks.length}`);
        if (blocks.length > 0) {
            console.log('   Exemple de block:', {
                id: blocks[0].id,
                title: blocks[0].title,
                items: blocks[0].items
            });
        }
    }
    
    // Tester la liaison
    console.log('\n4. Test de liaison:');
    if (window.app.newsManager && window.app.blockManager) {
        const news = window.app.newsManager.getDatabase();
        const blocks = window.app.blockManager.getBlocks();
        
        if (news.length > 0 && blocks.length > 0) {
            const testNews = news[0];
            const testBlock = blocks[0];
            
            console.log(`   Tentative d'assignation de "${testNews.title}" au journal "${testBlock.title}"`);
            
            // Méthode via blockManager.addItem
            if (typeof window.app.blockManager.addItem === 'function') {
                window.app.blockManager.addItem(testBlock.id, 'news', testNews.id);
                console.log('   ✅ addItem exécuté');
                
                // Vérifier si la liaison a fonctionné
                const updatedBlock = window.app.blockManager.getBlock(testBlock.id);
                const hasItem = updatedBlock.items.some(item => item.type === 'news' && item.id === testNews.id);
                console.log(`   Liaison effective: ${hasItem ? '✅' : '❌'}`);
                
                if (hasItem) {
                    console.log('   Items du block après liaison:', updatedBlock.items);
                }
            } else {
                console.log('   ❌ blockManager.addItem non disponible');
            }
        } else {
            console.log('   ⚠️ Pas assez de données pour tester (créez au moins 1 news et 1 journal)');
        }
    }
    
    // Vérifier l'interface
    console.log('\n5. Vérification interface:');
    const selectors = document.querySelectorAll('[id*="block-selector"]');
    console.log(`   Sélecteurs trouvés: ${selectors.length}`);
    selectors.forEach(sel => {
        console.log(`   - ${sel.id}`);
    });
    
    const checkboxes = document.querySelectorAll('input[id*="block-"]');
    console.log(`   Checkboxes blocks trouvées: ${checkboxes.length}`);
}

// Exécuter le debug
setTimeout(() => {
    debugLiaison();
    console.log('\n=== Pour corriger, utilisez: ===');
    console.log('app.blockManager.addItem(blockId, "news", newsId)');
    console.log('app.blockManager.removeItem(blockId, "news", newsId)');
}, 2000);