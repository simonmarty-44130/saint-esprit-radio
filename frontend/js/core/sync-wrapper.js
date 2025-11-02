/**
 * Sync Wrapper - Compatibilité entre l'ancien SyncManager et le nouveau Storage AWS
 * Ce wrapper permet aux anciens boutons de continuer à fonctionner
 */

class SyncWrapper {
    constructor(storage) {
        this.storage = storage;
        this.enabled = true;
        this.config = {
            username: storage.userId,
            interval: 30000
        };
    }

    /**
     * Initialize sync wrapper (compatibility method)
     */
    async init() {
        console.log('🔄 SyncWrapper initialized for AWS S3');
        // La synchronisation est déjà gérée par Storage
        return true;
    }

    /**
     * Méthodes pour compatibilité avec l'interface existante
     */
    async syncNow() {
        console.log('🔄 Manual sync triggered');
        try {
            if (window.app) {
                const data = {
                    news: window.app.newsManager?.getDatabase() || [],
                    animations: window.app.animationManager?.getDatabase() || [],
                    blocks: window.app.blockManager?.getBlocks() || [],
                    conductor: window.app.conductorManager?.getSegments() || [],
                    settings: window.app.settings || {},
                    templates: JSON.parse(localStorage.getItem('saint-esprit-templates') || '[]'),
                    journals: JSON.parse(localStorage.getItem('saint-esprit-journals') || '[]')
                };
                
                await this.storage.save(data);
                this.updateSyncStatus('✅ Synchronisé');
                return { success: true };
            }
        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.updateSyncStatus('❌ Erreur de sync');
            return { success: false, error };
        }
    }

    enableAutoSync() {
        this.enabled = true;
        console.log('✅ Auto-sync enabled (AWS S3)');
        this.updateSyncStatus('🟢 Auto-sync actif');
    }

    disableAutoSync() {
        this.enabled = false;
        console.log('⏸️ Auto-sync disabled');
        this.updateSyncStatus('⏸️ Auto-sync désactivé');
    }

    updateConfig(config) {
        if (config.interval) {
            this.config.interval = config.interval;
            console.log(`⏱️ Sync interval updated to ${config.interval}ms`);
        }
    }

    updateUsername(username) {
        if (username) {
            this.config.username = username;
            localStorage.setItem('saint-esprit-username', username);
            localStorage.setItem('saint-esprit-user', username);
            this.storage.userId = username.toLowerCase().replace(/[^a-z0-9]/g, '');
            console.log(`👤 Username updated to: ${username}`);
            
            // Recharger les données pour le nouvel utilisateur
            this.storage.loadUserDataFromS3().then(data => {
                if (window.app) {
                    window.app.loadFromData(data);
                    window.app.renderAll();
                }
            });
        }
    }

    updateSyncStatus(status) {
        const statusEl = document.getElementById('sync-status');
        const timeEl = document.getElementById('sync-last-time');
        
        if (statusEl) {
            statusEl.textContent = status;
        }
        
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = `(${now.toLocaleTimeString()})`;
        }
    }

    /**
     * Méthodes factices pour compatibilité
     */
    async checkForUpdates() {
        return await this.storage.detectChanges();
    }

    async resolveConflicts(conflicts) {
        console.log('Conflicts resolution not implemented in AWS mode');
        return { resolved: true };
    }

    getLastSyncTime() {
        const metadata = JSON.parse(localStorage.getItem('saint-esprit-syncMetadata') || '{}');
        return metadata.lastSync || null;
    }

    /**
     * Méthode pour gérer les anciens appels sync.php
     */
    async legacySyncCompat(action, data) {
        console.warn('Legacy sync.php call intercepted, using AWS S3 instead');
        
        if (action === 'upload') {
            return await this.syncNow();
        } else if (action === 'download') {
            const awsData = await this.storage.load();
            if (window.app) {
                window.app.loadFromData(awsData);
                window.app.renderAll();
            }
            return { success: true, data: awsData };
        }
        
        return { success: false, error: 'Unsupported legacy action' };
    }
}

// Export global pour compatibilité
window.SyncWrapper = SyncWrapper;