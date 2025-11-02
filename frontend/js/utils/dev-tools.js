/**
 * Outils de développement pour debugging cache
 * Uniquement actif en mode dev
 */
class DevTools {
    constructor() {
        this.isDev = window.location.hostname.includes('localhost') || 
                     window.location.hostname.includes('127.0.0.1');
        
        if (this.isDev) {
            this.addGlobalHelpers();
        }
    }
    
    addGlobalHelpers() {
        // Helpers globaux dans la console
        window.debugCache = () => {
            if (window.app?.cacheManager) {
                window.app.cacheManager.logDiagnostic();
            } else {
                console.warn('⚠️ CacheManager non disponible');
            }
        };
        
        window.forceReload = async () => {
            if (window.app?.cacheManager) {
                await window.app.cacheManager.forceReloadAll();
            } else if (window.app?.forceDataReload) {
                await window.app.forceDataReload();
            } else {
                console.warn('⚠️ Aucune méthode de reload disponible');
            }
        };
        
        window.clearCache = () => {
            if (window.app?.cacheManager) {
                window.app.cacheManager.clearAllMemoryCache();
                window.app.cacheManager.clearLocalStorageCache();
                console.log('✅ Caches vidés');
            } else {
                console.warn('⚠️ CacheManager non disponible');
            }
        };
        
        // Raccourcis supplémentaires
        window.listNews = () => {
            const news = window.app?.storage?.cache?.news || [];
            console.table(news.map(n => ({
                id: n.id,
                title: n.title,
                category: n.category,
                createdAt: new Date(n.createdAt).toLocaleString()
            })));
        };
        
        window.countAll = () => {
            const counts = {
                news: window.app?.storage?.cache?.news?.length || 0,
                animations: window.app?.storage?.cache?.animations?.length || 0,
                blocks: window.app?.storage?.cache?.blocks?.length || 0,
                conductors: window.app?.storage?.cache?.conductors?.length || 0
            };
            console.table(counts);
            return counts;
        };
        
        console.log('🔧 DevTools chargés - Commandes disponibles:');
        console.log('   debugCache() - Diagnostic complet');
        console.log('   forceReload() - Force le rechargement');
        console.log('   clearCache() - Vide les caches');
        console.log('   listNews() - Liste les news en table');
        console.log('   countAll() - Compte tous les éléments');
    }
}

// Auto-init
if (typeof window !== 'undefined') {
    new DevTools();
}