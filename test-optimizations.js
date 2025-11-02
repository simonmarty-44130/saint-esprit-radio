/**
 * Script de test post-déploiement des optimisations
 * À exécuter dans la console de https://saint-esprit.link
 */

console.log("🚀 TEST OPTIMISATIONS MODULE NEWS - SAINT-ESPRIT");
console.log("=" + "=".repeat(50));

// Test 1: Vérification du chargement des modules
console.group("📦 Test 1: Vérification chargement modules");
const modules = {
    "DynamoDBOptimized": typeof DynamoDBOptimized,
    "ContentManagerOptimized": typeof ContentManagerOptimized,
    "SmartCache": typeof SmartCache,
    "VirtualScroller": typeof VirtualScroller,
    "migrationManager": typeof migrationManager
};

let allLoaded = true;
for (const [module, type] of Object.entries(modules)) {
    const loaded = type !== 'undefined';
    console.log(`${loaded ? '✅' : '❌'} ${module}: ${type}`);
    if (!loaded) allLoaded = false;
}

if (allLoaded) {
    console.log("✅ Tous les modules optimisés sont chargés correctement!");
} else {
    console.warn("⚠️ Certains modules ne sont pas chargés");
}
console.groupEnd();

// Test 2: Vérification de l'état du système de migration
console.group("🔄 Test 2: Système de migration");
if (typeof migrationManager !== 'undefined') {
    console.log("État actuel:", migrationManager.useOptimized ? "OPTIMISÉ" : "STANDARD");
    console.log("Préférence stockée:", localStorage.getItem('useOptimizedModules'));
    
    // Créer le contrôleur global
    window.optimizationController = {
        enable: () => {
            console.log("🚀 Activation des modules optimisés...");
            return migrationManager.enableOptimized();
        },
        disable: () => {
            console.log("🔄 Désactivation des modules optimisés...");
            return migrationManager.disableOptimized();
        },
        benchmark: async () => {
            console.log("📊 Lancement du benchmark...");
            return await migrationManager.runBenchmark();
        },
        status: () => {
            return {
                optimized: migrationManager.useOptimized,
                metrics: migrationManager.metrics
            };
        }
    };
    
    console.log("✅ Contrôleur d'optimisation créé: window.optimizationController");
} else {
    console.error("❌ Migration manager non disponible");
}
console.groupEnd();

// Test 3: Métriques de base
console.group("📊 Test 3: Métriques système");
const metrics = {
    "DOM Nodes": document.getElementsByTagName('*').length,
    "Event Listeners": (() => {
        let count = 0;
        const all = document.getElementsByTagName('*');
        // Estimation basique
        return all.length * 2; // Approximation
    })(),
    "Memory (MB)": performance.memory ? 
        Math.round(performance.memory.usedJSHeapSize / 1048576) : 
        "N/A",
    "News items chargés": document.querySelectorAll('[id^="news-item"]').length,
    "Cache actif": typeof window.app?.storage?.cache !== 'undefined'
};

for (const [metric, value] of Object.entries(metrics)) {
    console.log(`${metric}: ${value}`);
}
console.groupEnd();

// Test 4: Test fonctionnel rapide
console.group("🧪 Test 4: Tests fonctionnels");
const tests = [];

// Test de présence des managers
if (window.app) {
    tests.push({
        name: "App initialisée",
        passed: true
    });
    
    if (window.app.newsManager) {
        tests.push({
            name: "NewsManager présent",
            passed: true
        });
    }
    
    if (window.app.storage) {
        tests.push({
            name: "Storage présent",
            passed: true
        });
    }
} else {
    tests.push({
        name: "App initialisée",
        passed: false,
        error: "window.app non disponible"
    });
}

// Afficher les résultats
tests.forEach(test => {
    if (test.passed) {
        console.log(`✅ ${test.name}`);
    } else {
        console.error(`❌ ${test.name}: ${test.error || 'Failed'}`);
    }
});
console.groupEnd();

// Résumé et actions disponibles
console.log("\n" + "=".repeat(50));
console.log("📋 RÉSUMÉ DU DÉPLOIEMENT");
console.log("=".repeat(50));

if (allLoaded) {
    console.log("✅ Modules optimisés déployés avec succès!");
    console.log("\n🎯 ACTIONS DISPONIBLES:");
    console.log("────────────────────────");
    console.log("1. ACTIVER les optimisations:");
    console.log("   optimizationController.enable()");
    console.log("");
    console.log("2. Lancer un BENCHMARK:");
    console.log("   optimizationController.benchmark()");
    console.log("");
    console.log("3. Vérifier le STATUS:");
    console.log("   optimizationController.status()");
    console.log("");
    console.log("4. DÉSACTIVER si problème:");
    console.log("   optimizationController.disable()");
    console.log("");
    console.log("💡 Conseil: Testez d'abord avec benchmark() avant d'activer!");
} else {
    console.error("⚠️ Déploiement partiellement réussi");
    console.log("Vérifiez la console pour les erreurs");
    console.log("Rollback possible via AWS CLI si nécessaire");
}

console.log("=".repeat(50));
console.log("📊 Test terminé -", new Date().toLocaleTimeString('fr-FR'));