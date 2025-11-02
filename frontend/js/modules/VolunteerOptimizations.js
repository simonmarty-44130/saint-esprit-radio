/**
 * VolunteerOptimizations Module
 * Optimisations de performance pour le mode bénévole
 * Phase 4 - Finitions et optimisations
 */

class VolunteerOptimizations {
    constructor(app) {
        this.app = app;
        this.cacheEnabled = true;
        this.cache = new Map();
        this.performanceMetrics = {
            loadTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    init() {
        console.log('⚡ Initialisation des optimisations mode bénévole...');
        
        // Optimisations uniquement pour le mode bénévole
        if (this.app.userRole !== 'volunteer') return;
        
        // 1. Lazy loading des modules non essentiels
        this.setupLazyLoading();
        
        // 2. Cache intelligent pour les données fréquentes
        this.setupSmartCache();
        
        // 3. Optimisation du rendu
        this.optimizeRendering();
        
        // 4. Préchargement des ressources critiques
        this.preloadCriticalResources();
        
        // 5. Monitoring des performances
        this.setupPerformanceMonitoring();
        
        console.log('✅ Optimisations activées');
    }

    setupLazyLoading() {
        // Charger les modules à la demande
        const lazyModules = {
            'audio': () => import('../managers/AudioManager.js'),
            'export': () => import('../managers/ExportManager.js'),
            'conductor': () => import('../managers/ConductorManager.js')
        };
        
        // Intercepter les appels aux modules
        Object.keys(lazyModules).forEach(moduleName => {
            Object.defineProperty(this.app, `${moduleName}Manager`, {
                get: function() {
                    if (!this[`_${moduleName}Manager`]) {
                        console.log(`⏳ Chargement différé: ${moduleName}Manager`);
                        lazyModules[moduleName]().then(module => {
                            this[`_${moduleName}Manager`] = new module.default();
                        });
                    }
                    return this[`_${moduleName}Manager`];
                },
                configurable: true
            });
        });
    }

    setupSmartCache() {
        // Cache pour les données S3
        if (!this.app.storage || !this.app.storage.getFromS3) {
            console.warn('⚠️ Storage non disponible pour le cache');
            return;
        }
        
        const originalGetFromS3 = this.app.storage.getFromS3.bind(this.app.storage);
        const cache = this.cache;
        const metrics = this.performanceMetrics;
        const storage = this.app.storage;
        
        this.app.storage.getFromS3 = async function(key) {
            // Vérifier le cache
            const cacheKey = `s3:${key}`;
            if (cache.has(cacheKey)) {
                const cached = cache.get(cacheKey);
                // Cache valide pendant 5 minutes
                if (Date.now() - cached.timestamp < 300000) {
                    metrics.cacheHits++;
                    console.log(`📦 Cache hit: ${key}`);
                    return cached.data;
                }
            }
            
            metrics.cacheMisses++;
            const data = await originalGetFromS3(key);
            
            // Mettre en cache
            cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            // Limiter la taille du cache (max 50 entrées)
            if (cache.size > 50) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }
            
            return data;
        };
    }

    optimizeRendering() {
        // Utiliser requestAnimationFrame pour les mises à jour du DOM
        const originalRender = this.app.newsManager.render;
        
        this.app.newsManager.render = function() {
            requestAnimationFrame(() => {
                originalRender.call(this);
            });
        };
        
        // Debounce pour les recherches et filtres
        this.setupDebounce();
    }

    setupDebounce() {
        // Fonction de debounce générique
        const debounce = (func, delay) => {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        };
        
        // Appliquer le debounce aux champs de recherche
        document.addEventListener('input', (e) => {
            if (e.target.matches('.search-input, .filter-input')) {
                const debouncedSearch = debounce(() => {
                    // Logique de recherche
                    console.log('🔍 Recherche optimisée');
                }, 300);
                debouncedSearch();
            }
        });
    }

    preloadCriticalResources() {
        // Précharger les ressources importantes
        const criticalResources = [
            '/css/volunteer-mode.css',
            '/js/modules/StudiosCalendar.js',
            '/js/modules/EmissionEditor.js'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = resource;
            document.head.appendChild(link);
        });
        
        // Précharger les données utilisateur
        this.preloadUserData();
    }

    async preloadUserData() {
        // Charger les données en arrière-plan
        if (this.app.storage && this.app.storage.userId) {
            try {
                // Précharger les émissions
                const emissions = await this.app.storage.getFromS3(
                    `users/${this.app.storage.userId}/data.json`
                );
                
                // Mettre en cache
                this.cache.set('user:emissions', {
                    data: emissions,
                    timestamp: Date.now()
                });
                
                console.log('📥 Données utilisateur préchargées');
            } catch (error) {
                console.warn('Préchargement échoué:', error);
            }
        }
    }

    setupPerformanceMonitoring() {
        // Observer les performances
        if ('PerformanceObserver' in window) {
            const perfObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'measure') {
                        console.log(`⏱️ ${entry.name}: ${entry.duration.toFixed(2)}ms`);
                        
                        // Alerter si trop lent
                        if (entry.duration > 1000) {
                            console.warn(`⚠️ Performance dégradée: ${entry.name}`);
                        }
                    }
                }
            });
            
            perfObserver.observe({ entryTypes: ['measure'] });
        }
        
        // Mesurer le temps de chargement initial
        window.addEventListener('load', () => {
            const loadTime = performance.now();
            this.performanceMetrics.loadTime = loadTime;
            console.log(`🚀 Temps de chargement: ${loadTime.toFixed(2)}ms`);
            
            // Envoyer les métriques si nécessaire
            this.reportMetrics();
        });
    }

    reportMetrics() {
        // Reporter les métriques de performance
        const report = {
            ...this.performanceMetrics,
            timestamp: Date.now(),
            userRole: this.app.userRole,
            cacheEfficiency: this.performanceMetrics.cacheHits / 
                (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) || 0
        };
        
        console.table(report);
        
        // Sauvegarder localement pour analyse
        localStorage.setItem('volunteer-performance-metrics', JSON.stringify(report));
    }

    // Méthodes utilitaires pour optimisation

    /**
     * Virtualisation de liste pour grandes quantités de données
     */
    createVirtualList(container, items, itemHeight = 50) {
        const visibleCount = Math.ceil(container.clientHeight / itemHeight);
        let scrollTop = 0;
        
        const renderVisible = () => {
            const startIndex = Math.floor(scrollTop / itemHeight);
            const endIndex = Math.min(startIndex + visibleCount + 1, items.length);
            
            // Effacer et re-rendre uniquement les éléments visibles
            container.innerHTML = '';
            
            for (let i = startIndex; i < endIndex; i++) {
                const item = items[i];
                const element = this.createItemElement(item);
                element.style.position = 'absolute';
                element.style.top = `${i * itemHeight}px`;
                container.appendChild(element);
            }
        };
        
        container.addEventListener('scroll', () => {
            scrollTop = container.scrollTop;
            requestAnimationFrame(renderVisible);
        });
        
        renderVisible();
    }

    /**
     * Compression des données avant sauvegarde
     */
    compressData(data) {
        // Retirer les champs non essentiels
        const compressed = JSON.parse(JSON.stringify(data));
        
        // Nettoyer les données
        if (Array.isArray(compressed)) {
            compressed.forEach(item => {
                // Retirer les champs temporaires
                delete item._temp;
                delete item._cache;
                
                // Compresser les dates
                if (item.createdAt) {
                    item.createdAt = Math.floor(item.createdAt / 1000);
                }
                if (item.updatedAt) {
                    item.updatedAt = Math.floor(item.updatedAt / 1000);
                }
            });
        }
        
        return compressed;
    }

    /**
     * Batch les opérations S3
     */
    batchS3Operations(operations) {
        return Promise.all(
            operations.map(op => 
                this.app.storage[op.method](op.key, op.data)
                    .catch(error => {
                        console.error(`Erreur batch S3: ${op.key}`, error);
                        return null;
                    })
            )
        );
    }

    /**
     * Nettoyer le cache
     */
    clearCache() {
        this.cache.clear();
        this.performanceMetrics.cacheHits = 0;
        this.performanceMetrics.cacheMisses = 0;
        console.log('🧹 Cache vidé');
    }

    /**
     * Obtenir les statistiques de performance
     */
    getPerformanceStats() {
        return {
            ...this.performanceMetrics,
            cacheSize: this.cache.size,
            memoryUsage: performance.memory ? 
                `${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB` : 'N/A'
        };
    }
}

// Export en global
window.VolunteerOptimizations = VolunteerOptimizations;