/**
 * Cache Manager - Gestion intelligente du cache frontend
 * Résout les problèmes de synchronisation entre DynamoDB et l'interface
 */
class CacheManager {
    constructor() {
        this.cacheKeys = ['news', 'animations', 'blocks', 'conductors'];
        this.lastSync = {};
        this.forceReloadFlag = false;
        this.isDev = window.location.hostname.includes('localhost') || 
                     window.location.hostname.includes('127.0.0.1');
        
        // Intervalle de vérification automatique en mode dev
        if (this.isDev) {
            this.startDevModeChecks();
        }
        
        console.log('🗄️ CacheManager initialisé (mode dev:', this.isDev, ')');
    }

    /**
     * Force un reload complet de tous les caches
     */
    async forceReloadAll() {
        console.log('🔄 Force reload de tous les caches...');
        
        try {
            // 1. Vider tous les caches en mémoire
            this.clearAllMemoryCache();
            
            // 2. Vider localStorage si nécessaire
            this.clearLocalStorageCache();
            
            // 3. Recharger depuis DynamoDB avec cache-bust
            await this.reloadFromDynamoDB();
            
            // 4. Notifier tous les managers
            this.notifyAllManagers();
            
            console.log('✅ Force reload terminé');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur force reload:', error);
            return false;
        }
    }

    /**
     * Vide tous les caches en mémoire
     */
    clearAllMemoryCache() {
        if (window.app?.storage?.cache) {
            this.cacheKeys.forEach(key => {
                window.app.storage.cache[key] = [];
            });
            console.log('   🗑️ Cache mémoire vidé');
        }
        
        // Vider aussi les caches des managers
        ['newsManager', 'animationManager', 'blockManager', 'conductorManager'].forEach(manager => {
            if (window.app?.[manager]?.database) {
                window.app[manager].database = [];
            }
        });
    }

    /**
     * Vide le localStorage des données Saint-Esprit
     */
    clearLocalStorageCache() {
        const keysToRemove = Object.keys(localStorage).filter(key => 
            key.includes('saint-esprit') || 
            key.includes('news') || 
            key.includes('kto') ||
            key.includes('cache')
        );
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        if (keysToRemove.length > 0) {
            console.log(`   🗑️ ${keysToRemove.length} clés localStorage supprimées`);
        }
    }

    /**
     * Recharge toutes les données depuis DynamoDB avec cache-bust
     */
    async reloadFromDynamoDB() {
        if (!window.app?.storage?.loadAllData) {
            throw new Error('Storage loadAllData non disponible');
        }
        
        // Ajouter un flag pour bypasser les caches
        window.app.storage._cacheBustTimestamp = Date.now();
        
        console.log('   📡 Rechargement depuis DynamoDB...');
        await window.app.storage.loadAllData();
        
        // Mettre à jour les timestamps de sync
        this.cacheKeys.forEach(key => {
            this.lastSync[key] = Date.now();
        });
    }

    /**
     * Notifie tous les managers du changement de données
     */
    notifyAllManagers() {
        if (!window.app?.onDatabaseUpdate) return;
        
        this.cacheKeys.forEach(key => {
            const data = window.app.storage?.cache?.[key] || [];
            window.app.onDatabaseUpdate(key, data);
        });
        
        console.log('   🔔 Tous les managers notifiés');
    }

    /**
     * Détecte automatiquement les changements backend (mode dev)
     */
    async detectBackendChanges() {
        if (!this.isDev) return;
        
        try {
            // Comparer avec la dernière sync connue
            const currentData = await this.peekDynamoDBCounts();
            const hasChanges = this.compareWithLastSync(currentData);
            
            if (hasChanges) {
                console.log('🔍 Changements backend détectés, reload automatique...');
                await this.forceReloadAll();
            }
            
        } catch (error) {
            console.warn('⚠️ Erreur détection changements:', error.message);
        }
    }

    /**
     * Vérifie le nombre d'items dans DynamoDB sans charger les données
     */
    async peekDynamoDBCounts() {
        const counts = {};
        
        for (const key of this.cacheKeys) {
            try {
                const methodName = `load${key.charAt(0).toUpperCase() + key.slice(1)}`;
                if (window.app?.storage?.[methodName]) {
                    const data = await window.app.storage[methodName]();
                    counts[key] = Array.isArray(data) ? data.length : 0;
                }
            } catch (e) {
                counts[key] = 0;
            }
        }
        
        return counts;
    }

    /**
     * Compare les counts actuels avec la dernière sync
     */
    compareWithLastSync(currentCounts) {
        return Object.keys(currentCounts).some(key => {
            const cached = window.app.storage?.cache?.[key]?.length || 0;
            const current = currentCounts[key];
            return cached !== current;
        });
    }

    /**
     * Lance les vérifications automatiques en mode dev
     */
    startDevModeChecks() {
        // Vérification toutes les 30 secondes en mode dev
        setInterval(() => {
            this.detectBackendChanges();
        }, 30000);
        
        console.log('🔍 Détection automatique des changements activée (30s)');
    }

    /**
     * Ajoute un bouton de debug dans l'interface
     */
    addDebugButton() {
        if (!this.isDev) return;
        
        const debugButton = document.createElement('button');
        debugButton.innerHTML = '🔄 Force Reload Cache';
        debugButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            background: #e74c3c;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        debugButton.onclick = () => {
            this.forceReloadAll();
        };
        
        document.body.appendChild(debugButton);
        console.log('🔧 Bouton debug ajouté');
    }

    /**
     * Log de diagnostic complet
     */
    logDiagnostic() {
        console.group('🩺 Diagnostic Cache Manager');
        
        // Cache storage
        if (window.app?.storage?.cache) {
            this.cacheKeys.forEach(key => {
                const count = window.app.storage.cache[key]?.length || 0;
                console.log(`   ${key}: ${count} items en cache`);
            });
        }
        
        // Managers
        ['newsManager', 'animationManager', 'blockManager', 'conductorManager'].forEach(manager => {
            const count = window.app?.[manager]?.database?.length || 0;
            console.log(`   ${manager}: ${count} items`);
        });
        
        // localStorage
        const lsKeys = Object.keys(localStorage).filter(k => k.includes('saint-esprit'));
        console.log(`   localStorage: ${lsKeys.length} clés Saint-Esprit`);
        
        console.groupEnd();
    }
}

// Export global
window.CacheManager = CacheManager;