class Settings {
    constructor() {
        this.initialized = false;
        this.settings = {};
    }

    init(dependencies) {
        this.storage = dependencies.storage;
        this.initialized = true;
        this.loadSettings();
    }

    loadSettings() {
        this.settings = {
            radioName: safeGetValue('radio-name') || 'Saint Esprit',
            radioSlogan: safeGetValue('radio-slogan') || 'Professional Broadcasting',
            autoSave: safeGetElement('auto-save')?.checked !== false,
            autoBackup: safeGetElement('auto-backup')?.checked !== false,
            showTimer: safeGetElement('show-timer')?.checked !== false,
            autoUpdateConductor: safeGetElement('auto-update-conductor')?.checked !== false
        };
    }

    apply(settings) {
        if (settings.radioName) safeSetValue('radio-name', settings.radioName);
        if (settings.radioSlogan) safeSetValue('radio-slogan', settings.radioSlogan);
        
        const autoSaveEl = safeGetElement('auto-save');
        if (autoSaveEl) autoSaveEl.checked = settings.autoSave !== false;
        
        const autoBackupEl = safeGetElement('auto-backup');
        if (autoBackupEl) autoBackupEl.checked = settings.autoBackup !== false;
        
        const showTimerEl = safeGetElement('show-timer');
        if (showTimerEl) showTimerEl.checked = settings.showTimer !== false;
        
        const autoUpdateEl = safeGetElement('auto-update-conductor');
        if (autoUpdateEl) autoUpdateEl.checked = settings.autoUpdateConductor !== false;
        
        this.settings = settings;
    }

    getSettings() {
        this.loadSettings();
        return this.settings;
    }

    get autoSave() {
        return this.settings.autoSave;
    }
    
    updateSyncStatus(status) {
        // Update sync UI in settings
        const statusEl = document.getElementById('sync-status');
        const lastTimeEl = document.getElementById('sync-last-time');
        const usernameEl = document.getElementById('sync-username');
        const enabledEl = document.getElementById('sync-enabled');
        const intervalEl = document.getElementById('sync-interval');
        const conflictsBtn = document.getElementById('sync-conflicts-btn');
        const conflictsCount = document.getElementById('sync-conflicts-count');
        
        if (statusEl) {
            switch(status.status) {
                case 'success':
                    statusEl.innerHTML = '🟢 Synchronisé';
                    statusEl.style.color = '#00ff00';
                    break;
                case 'syncing':
                    statusEl.innerHTML = '🔄 Synchronisation...';
                    statusEl.style.color = '#ffaa00';
                    break;
                case 'error':
                    statusEl.innerHTML = '❌ Erreur';
                    statusEl.style.color = '#ff0000';
                    break;
                case 'offline':
                    statusEl.innerHTML = '⚫ Hors ligne';
                    statusEl.style.color = '#999';
                    break;
                default:
                    statusEl.innerHTML = '⚪ En attente';
                    statusEl.style.color = '#ccc';
            }
        }
        
        if (lastTimeEl && status.lastSync) {
            const time = new Date(status.lastSync);
            const now = new Date();
            const diff = now - time;
            
            if (diff < 60000) {
                lastTimeEl.textContent = '(à l\'instant)';
            } else if (diff < 3600000) {
                lastTimeEl.textContent = `(il y a ${Math.floor(diff / 60000)} min)`;
            } else {
                lastTimeEl.textContent = `(${time.toLocaleTimeString('fr-FR')})`;
            }
        } else if (lastTimeEl) {
            lastTimeEl.textContent = '(jamais)';
        }
        
        if (usernameEl) {
            // Si c'est un select ou input, on met à jour la valeur
            if (usernameEl.tagName === 'INPUT' || usernameEl.tagName === 'SELECT') {
                const username = status.username || '';
                usernameEl.value = username;
                
                // Si c'est un select et que l'utilisateur n'est pas dans la liste, on le sélectionne quand même
                if (usernameEl.tagName === 'SELECT' && username) {
                    const options = Array.from(usernameEl.options);
                    const exists = options.some(opt => opt.value === username);
                    if (!exists) {
                        // Si l'utilisateur n'est pas dans la liste prédéfinie, on réinitialise
                        usernameEl.value = '';
                    }
                }
            } else {
                // Si c'est un span (ancien comportement)
                usernameEl.textContent = status.username || 'journaliste-local';
            }
        }
        
        if (enabledEl) {
            enabledEl.checked = status.enabled;
        }
        
        if (intervalEl) {
            intervalEl.value = status.interval;
        }
        
        if (conflictsBtn && conflictsCount) {
            if (status.conflicts > 0) {
                conflictsBtn.style.display = 'inline-block';
                conflictsCount.textContent = status.conflicts;
            } else {
                conflictsBtn.style.display = 'none';
            }
        }
    }
    
    updateConflictsList(conflicts) {
        const conflictsBtn = document.getElementById('sync-conflicts-btn');
        const conflictsCount = document.getElementById('sync-conflicts-count');
        
        if (conflictsBtn && conflictsCount) {
            if (conflicts.length > 0) {
                conflictsBtn.style.display = 'inline-block';
                conflictsCount.textContent = conflicts.length;
            } else {
                conflictsBtn.style.display = 'none';
            }
        }
    }
    
    updateParticipantsList(participants) {
        const participantsDiv = document.getElementById('sync-participants');
        const participantsList = document.getElementById('sync-participants-list');
        
        if (participantsDiv && participantsList && participants && participants.length > 0) {
            participantsDiv.style.display = 'block';
            
            // User configuration avec couleurs
            const userConfig = {
                'Simon': { color: '#4CAF50', icon: '👨‍💼' },
                'Clara': { color: '#E91E63', icon: '👩‍💼' },
                'Morgane': { color: '#9C27B0', icon: '👩‍💼' },
                'Tiphaine': { color: '#2196F3', icon: '👩‍💼' },
                'Stagiaire 01': { color: '#FF9800', icon: '👨‍🎓' },
                'Stagiaire 02': { color: '#FF5722', icon: '👩‍🎓' }
            };
            
            participantsList.innerHTML = participants.map(p => {
                const config = userConfig[p] || { color: '#ccc', icon: '👤' };
                return `
                    <li style="color: ${config.color}; margin: 0.25rem 0; font-weight: bold;">
                        ${config.icon} ${p}
                    </li>
                `;
            }).join('');
        } else if (participantsDiv) {
            participantsDiv.style.display = 'none';
        }
    }

    get autoBackup() {
        return this.settings.autoBackup;
    }

    onTabChange(tabName) {
        if (tabName === 'settings') {
            this.loadSettings();
            
            // Update sync status including username
            if (window.app && window.app.syncManager) {
                const syncManager = window.app.syncManager;
                this.updateSyncStatus({
                    status: syncManager.lastSyncStatus || 'offline',
                    lastSync: syncManager.lastSyncTime,
                    username: syncManager.config.username,
                    enabled: syncManager.isEnabled,
                    interval: syncManager.config.interval / 1000,
                    conflicts: syncManager.conflictQueue ? syncManager.conflictQueue.length : 0
                });
            }
        }
    }

    cleanup() {
        // Save settings before cleanup
        this.loadSettings();
    }
}

window.Settings = Settings;