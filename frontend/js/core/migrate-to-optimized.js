/**
 * Script de migration vers les modules optimisés
 * Permet de basculer entre l'ancien et le nouveau système
 */

class MigrationManager {
    constructor() {
        this.useOptimized = localStorage.getItem('useOptimizedModules') === 'true';
        this.metrics = {
            before: {},
            after: {}
        };
    }
    
    /**
     * Activer les modules optimisés
     */
    async enableOptimized() {
        console.log('🚀 Enabling optimized modules...');
        
        try {
            // Capturer les métriques avant
            this.captureMetrics('before');
            
            // Remplacer les modules
            await this.replaceModules();
            
            // Sauvegarder la préférence
            localStorage.setItem('useOptimizedModules', 'true');
            this.useOptimized = true;
            
            // Attendre que le système se stabilise
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Capturer les métriques après
            this.captureMetrics('after');
            
            // Afficher le rapport
            this.showReport();
            
            console.log('✅ Optimized modules enabled successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to enable optimized modules:', error);
            await this.rollback();
            return false;
        }
    }
    
    /**
     * Désactiver les modules optimisés (rollback)
     */
    async disableOptimized() {
        console.log('🔄 Rolling back to original modules...');
        
        localStorage.setItem('useOptimizedModules', 'false');
        this.useOptimized = false;
        
        // Recharger la page pour utiliser les anciens modules
        window.location.reload();
    }
    
    /**
     * Remplacer les modules par les versions optimisées
     */
    async replaceModules() {
        // Sauvegarder les références originales
        window.originalModules = {
            ContentManager: window.ContentManager,
            StorageDynamoDB: window.StorageDynamoDB,
            DynamoDBClient: window.DynamoDBClient
        };
        
        // Charger les modules optimisés
        await this.loadOptimizedModules();
        
        // Remplacer les instances globales
        if (window.app) {
            // Remplacer le storage
            if (window.app.storage) {
                const optimizedStorage = new StorageDynamoDBOptimized();
                await optimizedStorage.init();
                window.app.storage = optimizedStorage;
            }
            
            // Remplacer les ContentManagers
            if (window.app.newsManager) {
                const optimizedNews = new ContentManagerOptimized('news');
                await optimizedNews.init();
                window.app.newsManager = optimizedNews;
            }
            
            if (window.app.animationManager) {
                const optimizedAnimation = new ContentManagerOptimized('animation');
                await optimizedAnimation.init();
                window.app.animationManager = optimizedAnimation;
            }
        }
    }
    
    /**
     * Charger dynamiquement les modules optimisés
     */
    async loadOptimizedModules() {
        // Vérifier si les modules sont déjà chargés (via index.html)
        const modulesAlreadyLoaded = 
            typeof DynamoDBOptimized !== 'undefined' &&
            typeof ContentManagerOptimized !== 'undefined';
        
        if (modulesAlreadyLoaded) {
            console.log('✅ Modules optimisés déjà chargés via index.html');
            
            // Charger uniquement storage-dynamodb-optimized s'il manque
            if (typeof StorageDynamoDBOptimized === 'undefined') {
                console.log('📦 Chargement de StorageDynamoDBOptimized...');
                await this.loadScript('/js/core/storage-dynamodb-optimized.js');
            }
            return;
        }
        
        // Si les modules ne sont pas chargés, les charger dynamiquement
        const scripts = [
            '/js/core/dynamodb-optimized.js',
            '/js/managers/ContentManagerOptimized.js',
            '/js/core/storage-dynamodb-optimized.js'
        ];
        
        for (const src of scripts) {
            // Vérifier si le module correspondant existe déjà
            if (src.includes('dynamodb-optimized') && typeof DynamoDBOptimized !== 'undefined') continue;
            if (src.includes('ContentManagerOptimized') && typeof ContentManagerOptimized !== 'undefined') continue;
            if (src.includes('storage-dynamodb-optimized') && typeof StorageDynamoDBOptimized !== 'undefined') continue;
            
            await this.loadScript(src);
        }
    }
    
    /**
     * Charger un script dynamiquement
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Capturer les métriques de performance
     */
    captureMetrics(phase) {
        const metrics = {
            timestamp: Date.now(),
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB'
            } : 'N/A',
            domNodes: document.getElementsByTagName('*').length,
            eventListeners: this.countEventListeners()
        };
        
        // Métriques spécifiques si les modules sont chargés
        if (window.app?.newsManager?.getMetrics) {
            metrics.newsManager = window.app.newsManager.getMetrics();
        }
        
        if (window.app?.storage?.db?.getMetrics) {
            metrics.database = window.app.storage.db.getMetrics();
        }
        
        this.metrics[phase] = metrics;
    }
    
    /**
     * Compter le nombre d'event listeners (estimation)
     */
    countEventListeners() {
        // getEventListeners n'est disponible que dans Chrome DevTools
        // On fait une estimation basée sur le nombre d'éléments
        const allElements = document.getElementsByTagName('*');
        // Estimation : environ 2 listeners par élément en moyenne
        return allElements.length * 2;
    }
    
    /**
     * Afficher le rapport de performance
     */
    showReport() {
        console.group('📊 Performance Report');
        
        console.log('Before Optimization:', this.metrics.before);
        console.log('After Optimization:', this.metrics.after);
        
        // Calculer les améliorations
        const improvements = {
            domNodes: this.calculateImprovement(
                this.metrics.before.domNodes,
                this.metrics.after.domNodes
            ),
            eventListeners: this.calculateImprovement(
                this.metrics.before.eventListeners,
                this.metrics.after.eventListeners
            )
        };
        
        console.log('Improvements:', improvements);
        
        // Afficher les métriques DynamoDB si disponibles
        if (this.metrics.after.database) {
            console.log('Database Metrics:', this.metrics.after.database);
        }
        
        console.groupEnd();
        
        // Afficher une notification
        this.showNotification(improvements);
    }
    
    /**
     * Calculer le pourcentage d'amélioration
     */
    calculateImprovement(before, after) {
        if (!before || !after) return 'N/A';
        const improvement = ((before - after) / before * 100).toFixed(1);
        return improvement > 0 ? `+${improvement}%` : `${improvement}%`;
    }
    
    /**
     * Afficher une notification avec les résultats
     */
    showNotification(improvements) {
        const message = `
            🚀 Modules Optimisés Activés!
            DOM: ${improvements.domNodes}
            Events: ${improvements.eventListeners}
        `;
        
        if (window.showNotification) {
            window.showNotification(message, 'success');
        } else {
            console.log(message);
        }
    }
    
    /**
     * Rollback en cas d'erreur
     */
    async rollback() {
        console.log('⚠️ Rolling back due to error...');
        
        if (window.originalModules) {
            window.ContentManager = window.originalModules.ContentManager;
            window.StorageDynamoDB = window.originalModules.StorageDynamoDB;
            window.DynamoDBClient = window.originalModules.DynamoDBClient;
        }
        
        localStorage.setItem('useOptimizedModules', 'false');
        
        // Recharger pour assurer un état propre
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
    
    /**
     * Tester les performances
     */
    async runBenchmark() {
        console.log('🏃 Running performance benchmark...');
        
        const tests = [
            {
                name: 'Load 100 items',
                run: async () => {
                    const start = performance.now();
                    // Simuler le chargement
                    if (window.app?.newsManager?.loadPage) {
                        await window.app.newsManager.loadPage(1);
                    }
                    return performance.now() - start;
                }
            },
            {
                name: 'Create new item',
                run: async () => {
                    const start = performance.now();
                    if (window.app?.newsManager?.create) {
                        await window.app.newsManager.create();
                    }
                    return performance.now() - start;
                }
            },
            {
                name: 'Search items',
                run: async () => {
                    const start = performance.now();
                    if (window.app?.newsManager?.search) {
                        await window.app.newsManager.search('test');
                    }
                    return performance.now() - start;
                }
            }
        ];
        
        const results = {};
        
        for (const test of tests) {
            try {
                const time = await test.run();
                results[test.name] = `${time.toFixed(2)}ms`;
                console.log(`✅ ${test.name}: ${time.toFixed(2)}ms`);
            } catch (error) {
                results[test.name] = 'Failed';
                console.error(`❌ ${test.name} failed:`, error);
            }
        }
        
        console.log('📊 Benchmark Results:', results);
        return results;
    }
}

// Créer l'instance globale
window.migrationManager = new MigrationManager();

// Auto-activer si configuré
if (window.migrationManager.useOptimized) {
    console.log('🔧 Optimized modules are enabled');
    // Le chargement se fera au démarrage de l'app
}

// Commandes utiles dans la console
console.log(`
╔════════════════════════════════════════════╗
║  Migration vers Modules Optimisés         ║
╠════════════════════════════════════════════╣
║  Commandes disponibles:                   ║
║                                            ║
║  migrationManager.enableOptimized()       ║
║  → Activer les modules optimisés          ║
║                                            ║
║  migrationManager.disableOptimized()      ║
║  → Revenir aux modules originaux          ║
║                                            ║
║  migrationManager.runBenchmark()          ║
║  → Tester les performances                ║
║                                            ║
║  migrationManager.showReport()            ║
║  → Afficher le rapport de performance     ║
╚════════════════════════════════════════════╝
`);