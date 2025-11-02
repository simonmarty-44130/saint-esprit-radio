/**
 * Script d'initialisation AppSync
 * Remplace automatiquement l'ancien storage par le nouveau système AppSync+DynamoDB
 */

(async function initAppSync() {
    console.log('🚀 Initializing AppSync storage...');

    try {
        // Attendre que l'app soit chargée
        const waitForApp = () => new Promise(resolve => {
            if (window.app) {
                resolve();
            } else {
                const interval = setInterval(() => {
                    if (window.app) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            }
        });

        await waitForApp();

        // Créer le nouveau storage
        const appSyncStorage = new StorageAppSync();

        // Sauvegarder l'ancien storage pour migration
        const oldStorage = window.app.storage;

        // Remplacer le storage dans l'app
        window.app.storage = appSyncStorage;

        // Initialiser AppSync
        await appSyncStorage.init();

        console.log('✅ AppSync storage initialized successfully');

        // Afficher les stats
        const stats = appSyncStorage.getStats();
        console.log('📊 Stats:', stats);

        // Configurer les listeners pour rafraîchir l'interface
        appSyncStorage.addEventListener('news-created', (news) => {
            console.log('🔔 New news received, refreshing UI...');
            if (window.app && window.app.renderNews) {
                window.app.renderNews();
            }
        });

        appSyncStorage.addEventListener('news-deleted', (news) => {
            console.log('🗑️ News deleted, refreshing UI...');
            if (window.app && window.app.renderNews) {
                window.app.renderNews();
            }
        });

        appSyncStorage.addEventListener('news-updated', (news) => {
            console.log('✏️ News updated, refreshing UI...');
            if (window.app && window.app.renderNews) {
                window.app.renderNews();
            }
        });

        // Rafraîchir l'UI après chargement
        if (window.app && window.app.renderNews) {
            window.app.renderNews();
        }

        // Exposer globalement pour debug
        window.appSyncStorage = appSyncStorage;
        window.oldStorage = oldStorage;

        console.log('💡 Debug commands:');
        console.log('   appSyncStorage.getStats() - Show stats');
        console.log('   appSyncStorage.getNews() - List news');
        console.log('   appSyncStorage.createNews({...}) - Create news');

    } catch (error) {
        console.error('❌ Failed to initialize AppSync storage:', error);
        console.error('Falling back to old storage');
    }
})();
