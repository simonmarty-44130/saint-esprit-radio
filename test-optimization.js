// Test des optimisations
console.log('🧪 Test des optimisations blocks...');

// Test 1: Vérifier le cache
if (window.app && window.app.blockManager) {
    const stats = window.app.blockManager.getCacheStats();
    console.log('Cache stats:', stats);
}

// Test 2: Vérifier les métriques
if (window.BlockMetrics) {
    console.log('✅ BlockMetrics chargé');
    BlockMetrics.display();
} else {
    console.error('❌ BlockMetrics non trouvé');
}

// Test 3: Tester une requête optimisée
if (window.storage && window.storage.db) {
    console.log('Test requête optimisée...');
    window.storage.db.getBlocksByUser('current').then(blocks => {
        console.log(`✅ ${blocks.length} blocks chargés avec Query`);
    });
}
