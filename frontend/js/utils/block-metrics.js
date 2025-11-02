/**
 * BlockMetrics - Système de métriques pour le module Blocks/Journaux
 * Permet de tracker les performances et l'utilisation
 */

class BlockMetrics {
    constructor() {
        this.metrics = {
            operations: {},
            cache: {},
            dynamodb: {},
            errors: []
        };
        
        this.startTime = Date.now();
        this.operationCounts = {};
        
        // Configuration CloudWatch si disponible
        this.cloudwatchEnabled = false;
        this.namespace = 'SaintEsprit/Blocks';
    }
    
    /**
     * Tracker une opération avec sa durée
     */
    static track(operation, duration, metadata = {}) {
        if (!window.blockMetrics) {
            window.blockMetrics = new BlockMetrics();
        }
        
        const metrics = window.blockMetrics;
        
        // Enregistrer l'opération
        if (!metrics.metrics.operations[operation]) {
            metrics.metrics.operations[operation] = {
                count: 0,
                totalDuration: 0,
                minDuration: Infinity,
                maxDuration: 0,
                avgDuration: 0,
                lastExecuted: null
            };
        }
        
        const op = metrics.metrics.operations[operation];
        op.count++;
        op.totalDuration += duration;
        op.minDuration = Math.min(op.minDuration, duration);
        op.maxDuration = Math.max(op.maxDuration, duration);
        op.avgDuration = op.totalDuration / op.count;
        op.lastExecuted = new Date().toISOString();
        
        // Log pour debug
        console.log(`📊 [PERF] ${operation}: ${duration}ms`, metadata);
        
        // Envoyer à CloudWatch si configuré
        if (metrics.cloudwatchEnabled && window.cloudwatch) {
            metrics.sendToCloudWatch(operation, duration, metadata);
        }
        
        // Alertes pour performances dégradées
        if (duration > 1000) {
            console.warn(`⚠️ Opération lente détectée: ${operation} (${duration}ms)`);
            metrics.logError('slow_operation', {
                operation,
                duration,
                metadata
            });
        }
    }
    
    /**
     * Tracker les métriques du cache
     */
    static trackCache(hitRate, cacheSize, stats) {
        if (!window.blockMetrics) {
            window.blockMetrics = new BlockMetrics();
        }
        
        const metrics = window.blockMetrics;
        metrics.metrics.cache = {
            hitRate,
            cacheSize,
            ...stats,
            timestamp: new Date().toISOString()
        };
        
        console.log(`📊 [CACHE] Hit rate: ${hitRate}%, Size: ${cacheSize}`);
    }
    
    /**
     * Tracker les métriques DynamoDB
     */
    static trackDynamoDB(operation, consumedCapacity) {
        if (!window.blockMetrics) {
            window.blockMetrics = new BlockMetrics();
        }
        
        const metrics = window.blockMetrics;
        
        if (!metrics.metrics.dynamodb[operation]) {
            metrics.metrics.dynamodb[operation] = {
                count: 0,
                totalRCU: 0,
                totalWCU: 0
            };
        }
        
        const db = metrics.metrics.dynamodb[operation];
        db.count++;
        
        if (consumedCapacity) {
            db.totalRCU += consumedCapacity.ReadCapacityUnits || 0;
            db.totalWCU += consumedCapacity.WriteCapacityUnits || 0;
        }
        
        console.log(`📊 [DDB] ${operation}: RCU=${db.totalRCU}, WCU=${db.totalWCU}`);
    }
    
    /**
     * Logger une erreur
     */
    static logError(type, details) {
        if (!window.blockMetrics) {
            window.blockMetrics = new BlockMetrics();
        }
        
        const metrics = window.blockMetrics;
        metrics.metrics.errors.push({
            type,
            details,
            timestamp: new Date().toISOString()
        });
        
        // Limiter le nombre d'erreurs stockées
        if (metrics.metrics.errors.length > 100) {
            metrics.metrics.errors.shift();
        }
    }
    
    /**
     * Obtenir un rapport des métriques
     */
    static getReport() {
        if (!window.blockMetrics) {
            return { message: 'Aucune métrique disponible' };
        }
        
        const metrics = window.blockMetrics;
        const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
        
        // Calculer les statistiques globales
        let totalOperations = 0;
        let totalDuration = 0;
        
        for (const op of Object.values(metrics.metrics.operations)) {
            totalOperations += op.count;
            totalDuration += op.totalDuration;
        }
        
        return {
            uptime: `${Math.floor(uptime / 60)}m ${uptime % 60}s`,
            totalOperations,
            avgOperationTime: totalOperations > 0 ? Math.round(totalDuration / totalOperations) : 0,
            operations: metrics.metrics.operations,
            cache: metrics.metrics.cache,
            dynamodb: metrics.metrics.dynamodb,
            recentErrors: metrics.metrics.errors.slice(-10),
            topSlowOperations: metrics.getSlowOperations()
        };
    }
    
    /**
     * Obtenir les opérations les plus lentes
     */
    getSlowOperations() {
        const operations = Object.entries(this.metrics.operations)
            .map(([name, stats]) => ({
                name,
                avgDuration: stats.avgDuration,
                maxDuration: stats.maxDuration,
                count: stats.count
            }))
            .sort((a, b) => b.avgDuration - a.avgDuration)
            .slice(0, 5);
        
        return operations;
    }
    
    /**
     * Envoyer les métriques à CloudWatch
     */
    async sendToCloudWatch(metricName, value, dimensions = {}) {
        if (!window.cloudwatch) return;
        
        try {
            const params = {
                Namespace: this.namespace,
                MetricData: [{
                    MetricName: metricName,
                    Value: value,
                    Unit: 'Milliseconds',
                    Timestamp: new Date(),
                    Dimensions: Object.entries(dimensions).map(([k, v]) => ({
                        Name: k,
                        Value: String(v)
                    }))
                }]
            };
            
            await window.cloudwatch.putMetricData(params).promise();
        } catch (error) {
            console.error('Erreur envoi CloudWatch:', error);
        }
    }
    
    /**
     * Afficher les métriques dans la console
     */
    static display() {
        const report = BlockMetrics.getReport();
        
        console.group('📊 Block Metrics Report');
        console.log('Uptime:', report.uptime);
        console.log('Total Operations:', report.totalOperations);
        console.log('Avg Operation Time:', report.avgOperationTime + 'ms');
        
        if (report.cache) {
            console.group('Cache Stats');
            console.log('Hit Rate:', report.cache.hitRate);
            console.log('Cache Size:', report.cache.cacheSize);
            console.log('Hits:', report.cache.hits);
            console.log('Misses:', report.cache.misses);
            console.groupEnd();
        }
        
        if (report.topSlowOperations.length > 0) {
            console.group('Top Slow Operations');
            console.table(report.topSlowOperations);
            console.groupEnd();
        }
        
        if (report.recentErrors.length > 0) {
            console.group('Recent Errors');
            console.table(report.recentErrors);
            console.groupEnd();
        }
        
        console.groupEnd();
        
        return report;
    }
    
    /**
     * Réinitialiser les métriques
     */
    static reset() {
        window.blockMetrics = new BlockMetrics();
        console.log('✅ Métriques réinitialisées');
    }
}

// Export global
window.BlockMetrics = BlockMetrics;

// Auto-rapport toutes les 5 minutes en mode debug
if (window.location.hash.includes('debug')) {
    setInterval(() => {
        console.log('📊 Auto-rapport des métriques blocks');
        BlockMetrics.display();
    }, 5 * 60 * 1000);
}

// Commandes utiles pour la console
console.log('💡 BlockMetrics disponible. Commandes:');
console.log('  BlockMetrics.display() - Afficher le rapport');
console.log('  BlockMetrics.getReport() - Obtenir les données');
console.log('  BlockMetrics.reset() - Réinitialiser');