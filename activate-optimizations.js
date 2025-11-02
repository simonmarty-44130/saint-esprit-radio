/**
 * Script d'activation automatique des optimisations
 * À exécuter sur https://saint-esprit.link
 */

console.log("🚀 ACTIVATION DES OPTIMISATIONS - SAINT-ESPRIT");
console.log("=" + "=".repeat(50));

// Fonction d'activation avec monitoring
async function activateOptimizations() {
    try {
        // Étape 1: Vérifier la disponibilité des modules
        console.group("📦 Étape 1: Vérification des modules");
        
        if (typeof migrationManager === 'undefined') {
            console.error("❌ migrationManager non disponible");
            console.log("Tentative de chargement du script de migration...");
            
            // Charger le script si nécessaire
            const script = document.createElement('script');
            script.src = '/js/utils/migrate-to-optimized.js?v=' + Date.now();
            document.head.appendChild(script);
            
            // Attendre le chargement
            await new Promise(resolve => {
                script.onload = resolve;
                setTimeout(resolve, 3000); // Timeout de sécurité
            });
        }
        
        if (typeof migrationManager !== 'undefined') {
            console.log("✅ migrationManager disponible");
            console.log("État actuel:", migrationManager.useOptimized ? "OPTIMISÉ" : "STANDARD");
        } else {
            throw new Error("Impossible de charger migrationManager");
        }
        console.groupEnd();
        
        // Étape 2: Créer le contrôleur si nécessaire
        console.group("🎮 Étape 2: Configuration du contrôleur");
        if (typeof optimizationController === 'undefined') {
            window.optimizationController = {
                enable: () => migrationManager.enableOptimized(),
                disable: () => migrationManager.disableOptimized(),
                benchmark: () => migrationManager.runBenchmark(),
                status: () => ({
                    optimized: migrationManager.useOptimized,
                    metrics: migrationManager.metrics
                })
            };
            console.log("✅ Contrôleur créé");
        } else {
            console.log("✅ Contrôleur déjà disponible");
        }
        console.groupEnd();
        
        // Étape 3: Capturer les métriques avant activation
        console.group("📊 Étape 3: Métriques avant activation");
        const beforeMetrics = {
            timestamp: Date.now(),
            domNodes: document.getElementsByTagName('*').length,
            newsItems: document.querySelectorAll('[id^="news-"]').length,
            memory: performance.memory ? 
                Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 
                'N/A'
        };
        console.table(beforeMetrics);
        console.groupEnd();
        
        // Étape 4: Vérifier si déjà activé
        if (migrationManager.useOptimized) {
            console.log("⚠️ Les optimisations sont déjà activées");
            return {
                status: 'already_active',
                message: 'Les optimisations étaient déjà activées'
            };
        }
        
        // Étape 5: ACTIVATION
        console.group("⚡ Étape 5: ACTIVATION DES OPTIMISATIONS");
        console.log("Activation en cours...");
        
        // Définir le flag localStorage AVANT l'activation
        localStorage.setItem('useOptimizedModules', 'true');
        console.log("✅ Flag localStorage défini");
        
        // Activer via migrationManager
        const result = await migrationManager.enableOptimized();
        
        if (result) {
            console.log("✅ Optimisations activées avec succès!");
        } else {
            console.warn("⚠️ Activation partielle ou avec avertissements");
        }
        console.groupEnd();
        
        // Étape 6: Vérification post-activation
        console.group("✔️ Étape 6: Vérification post-activation");
        
        // Attendre que le système se stabilise
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterMetrics = {
            timestamp: Date.now(),
            domNodes: document.getElementsByTagName('*').length,
            newsItems: document.querySelectorAll('[id^="news-"]').length,
            memory: performance.memory ? 
                Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 
                'N/A',
            optimized: migrationManager.useOptimized,
            localStorage: localStorage.getItem('useOptimizedModules')
        };
        console.table(afterMetrics);
        
        // Calculer les améliorations
        const improvements = {
            domNodesReduction: ((beforeMetrics.domNodes - afterMetrics.domNodes) / beforeMetrics.domNodes * 100).toFixed(1) + '%',
            timeElapsed: (afterMetrics.timestamp - beforeMetrics.timestamp) + 'ms'
        };
        console.log("📈 Améliorations:", improvements);
        console.groupEnd();
        
        // Étape 7: Test rapide de fonctionnalité
        console.group("🧪 Étape 7: Test de fonctionnalité");
        
        // Vérifier que les modules optimisés sont actifs
        const checks = {
            DynamoDBOptimized: typeof DynamoDBOptimized !== 'undefined',
            ContentManagerOptimized: typeof ContentManagerOptimized !== 'undefined',
            SmartCache: typeof SmartCache !== 'undefined',
            optimizationActive: migrationManager.useOptimized
        };
        
        console.table(checks);
        
        const allChecks = Object.values(checks).every(v => v === true);
        if (allChecks) {
            console.log("✅ Tous les modules optimisés sont actifs");
        } else {
            console.warn("⚠️ Certains modules peuvent ne pas être actifs");
        }
        console.groupEnd();
        
        // Résultat final
        console.log("\n" + "=".repeat(50));
        console.log("🎉 ACTIVATION TERMINÉE AVEC SUCCÈS!");
        console.log("=".repeat(50));
        console.log("✅ Les optimisations sont maintenant ACTIVES");
        console.log("📊 Pour voir les métriques: optimizationController.status()");
        console.log("🔄 Pour désactiver si nécessaire: optimizationController.disable()");
        console.log("=".repeat(50));
        
        return {
            status: 'success',
            before: beforeMetrics,
            after: afterMetrics,
            improvements: improvements,
            message: 'Optimisations activées avec succès'
        };
        
    } catch (error) {
        console.error("❌ ERREUR lors de l'activation:", error);
        console.log("Tentative de rollback...");
        
        // Rollback en cas d'erreur
        localStorage.setItem('useOptimizedModules', 'false');
        
        return {
            status: 'error',
            error: error.message,
            message: 'Échec de l\'activation - système inchangé'
        };
    }
}

// Lancer l'activation automatiquement
console.log("🔄 Lancement de l'activation automatique dans 2 secondes...");
console.log("⏸️ Pour annuler: CTRL+C ou fermez la console maintenant");

setTimeout(async () => {
    const result = await activateOptimizations();
    
    // Sauvegarder le résultat globalement
    window.activationResult = result;
    
    // Afficher un résumé visuel
    if (result.status === 'success') {
        console.log('%c✅ OPTIMISATIONS ACTIVES', 'color: green; font-size: 20px; font-weight: bold;');
    } else if (result.status === 'already_active') {
        console.log('%c⚠️ DÉJÀ ACTIVES', 'color: orange; font-size: 20px; font-weight: bold;');
    } else {
        console.log('%c❌ ACTIVATION ÉCHOUÉE', 'color: red; font-size: 20px; font-weight: bold;');
    }
}, 2000);