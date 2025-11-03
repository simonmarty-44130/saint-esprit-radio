// Main application entry point
class SaintEspritApp {
    constructor() {
        this.storage = null;
        this.newsManager = null;
        this.animationManager = null;
        this.blockManager = null;
        this.conductorManager = null;
        this.templateManager = null;
        this.audioManager = null;
        this.audioEditor = null;
        
        this.currentTab = 'dashboard';
        this.showStartTime = null;
        this.scheduledStartTime = null; // Heure programmée de début
        this.isLive = false; // État ON AIR
        this.clockInterval = null;
        this.autoSaveInterval = null;
        this.autoBackupInterval = null;
        this.lastClockUpdate = 0;
        this.hasUserChanges = false; // Flag pour tracker les vraies modifications utilisateur
        this.isDirty = false; // Flag pour indiquer si des changements non sauvegardés existent
        this.isLoadingData = false; // Flag pour empêcher l'autoSave pendant le chargement
        this.cachedSegmentDurations = null;
        this.lastSegmentCacheTime = 0;
        
        // Global state
        this.newsDatabase = [];
        this.animationDatabase = [];
        this.blocksDatabase = [];
        this.conductorSegments = [];
        
        // Optimization flags
        this.isInitialized = false;
        this.audioEditorInitialized = false;
    }

    async init() {
        try {
            console.log(`🚀 Initializing Saint-Esprit v${Constants.VERSION}...`);
            console.log(`📅 Version: ${Constants.VERSION} (${Constants.VERSION_DATE})`);
            console.log(`📝 Updates: ${Constants.VERSION_NOTES}`);
            console.log(`🔄 Mode: DynamoDB Multi-User`);
            
            // Mettre à jour le titre de la page avec la version
            document.title = `Saint-Esprit v${Constants.VERSION} - Système de Newsroom Pro`;
            
            // Afficher la version dans le badge sidebar
            const versionBadge = document.getElementById('version-badge');
            if (versionBadge) {
                versionBadge.textContent = `v${Constants.VERSION}`;
            }
            
            // Afficher la version dans le header
            const headerVersion = document.getElementById('header-version');
            if (headerVersion) {
                headerVersion.textContent = `v${Constants.VERSION}`;
            }
            
            // Fix: S'assurer qu'aucun modal n'est actif au démarrage
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });

            // IMPORTANT : Attendre que l'authentification Cognito soit prête
            if (window.cognitoAuth) {
                console.log('⏳ En attente de l\'authentification Cognito...');
                await window.cognitoAuth.waitForAuth();
                console.log('✅ Authentification prête, initialisation du storage...');
            }

            // Initialize storage - Utiliser DynamoDB
            const useDynamoDB = true; // Forcer DynamoDB

            if (useDynamoDB) {
                console.log('📦 Initializing DynamoDB storage (multi-user mode)...');
                this.storage = new StorageDynamoDB();
            } else {
                console.log('📁 Using S3/JSON storage (legacy mode)...');
                this.storage = new Storage();
            }

            await this.storage.init();
            
            // Initialiser le cache manager
            this.cacheManager = new CacheManager();
            
            // Connecter le cache manager au storage
            if (this.storage && this.storage.setCacheManager) {
                this.storage.setCacheManager(this.cacheManager);
            }
            
            // Ajouter le bouton debug en mode dev
            if (this.cacheManager.isDev) {
                // Attendre que le DOM soit prêt
                setTimeout(() => {
                    this.cacheManager.addDebugButton();
                }, 1000);
            }
            
            // Initialize audio storage
            await initializeAudioStorage();
            
            // Check for migration
            if (typeof this.storage.migrateFromLocalStorage === 'function') {
                await this.storage.migrateFromLocalStorage();
            }
            
            // Initialize managers
            this.initializeManagers();
            
            // Load saved data
            await this.loadData();
            
            // Initialize UI
            this.initializeUI();
            
            // UserFilter désactivé - on utilise maintenant les filtres par auteur
            // if (useDynamoDB) {
            //     console.log('🔍 Initializing user filters...');
            //     this.userFilter = new UserFilter();
            //     this.userFilter.init();
            // }
            
            // Initialize auto-archiving pour les news à J+1
            this.startAutoArchiving();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start background tasks with clock re-enabled
            setTimeout(() => {
                this.startBackgroundTasks();
            }, 2000);
            
            // Check for backups (simplified version that doesn't crash)
            await this.checkAndRecoverBackup();
            
            // Initialize sync manager if available
            if (this.syncManager) {
                try {
                    await this.syncManager.init();
                    this.setupSyncEvents();
                } catch (e) {
                    console.warn('Sync manager initialization failed (non-critical):', e);
                }
            }
            
            // Show dashboard by default
            this.showDashboard();
            
            this.isInitialized = true;
            console.log('✅ Saint-Esprit initialized successfully!');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            showNotification('Failed to initialize application', 'error');
        }
    }

    initializeManagers() {
        // Initialize content managers
        this.newsManager = new ContentManager('news');
        this.animationManager = new ContentManager('animation');
        
        // Initialize block manager
        this.blockManager = new BlockManager();
        
        // Initialize conductor manager
        this.conductorManager = new ConductorManager();
        
        // Initialize conductor template manager
        this.conductorTemplateManager = new ConductorTemplateManager();

        // Flag pour éviter les sauvegardes multiples pendant l'ajout de blocs avec enfants
        this.isAddingBlockWithChildren = false;
        
        // Initialize audio manager
        this.audioManager = new AudioManager(this.storage);
        
        // Initialize sync manager - Désactivé (remplacé par Storage S3)
        // Note: Ne pas utiliser le nom SyncManager car c'est une API native du navigateur
        this.syncManager = null;
        
        // Initialize audio sync manager
        this.audioSyncManager = typeof AudioSyncManager !== 'undefined' ? new AudioSyncManager(this) : null;
        
        // Initialize S3 audio manager (priorité si configuré)
        this.audioS3Manager = typeof AudioS3Manager !== 'undefined' ? new AudioS3Manager(this) : null;
        
        // Initialize audio sync fix (correctif pour sync audio)
        this.audioSyncFix = typeof AudioSyncFix !== 'undefined' ? new AudioSyncFix(this) : null;
        
        // Initialize audio URL manager (système par URL simple)
        this.audioUrlManager = typeof AudioUrlManager !== 'undefined' ? new AudioUrlManager(this) : null;
        
        // Initialize recording monitor pour créer automatiquement des news KTO
        this.recordingMonitor = typeof RecordingMonitor !== 'undefined' ? new RecordingMonitor(this) : null;
        if (this.recordingMonitor) {
            console.log('✅ RecordingMonitor initialisé');
        }
        
        // Initialize audio editor
        this.audioEditor = new AudioEditor();
        
        // Initialize multitrack editor - created on demand
        this.multitrackEditor = null; // Will be created when needed
        
        // Initialize fridge component
        this.fridgeComponent = new Fridge();
        
        
        // Setup event listeners between managers
        this.setupManagerEvents();
    }
    
    setupSyncEvents() {
        if (!this.syncManager) return;
        
        // Update initial sync status in settings
        if (this.settingsComponent) {
            this.settingsComponent.updateSyncStatus({
                status: this.syncManager.lastSyncStatus || 'offline',
                lastSync: this.syncManager.lastSyncTime,
                username: this.syncManager.config.username,
                enabled: this.syncManager.isEnabled,
                interval: this.syncManager.config.interval / 1000,
                conflicts: this.syncManager.conflictQueue ? this.syncManager.conflictQueue.length : 0
            });
        }
        
        // Listen to sync events
        this.syncManager.on('sync-started', () => {
            const indicator = document.getElementById('sync-indicator');
            if (indicator) {
                indicator.textContent = '🔄';
                indicator.title = 'Synchronisation en cours...';
                indicator.classList.add('syncing');
            }
        });
        
        this.syncManager.on('sync-completed', (data) => {
            const indicator = document.getElementById('sync-indicator');
            if (indicator) {
                indicator.textContent = '✅';
                indicator.title = `Synchronisé (${new Date(data.time).toLocaleTimeString()})`;
                indicator.classList.remove('syncing');
            }
            showNotification('Synchronisation terminée', 'success');
        });
        
        this.syncManager.on('sync-failed', (error) => {
            const indicator = document.getElementById('sync-indicator');
            if (indicator) {
                indicator.textContent = '⚠️';
                indicator.title = 'Erreur de synchronisation';
                indicator.classList.remove('syncing');
            }
            console.error('Sync error:', error);
        });
        
        this.syncManager.on('sync-conflict', (conflicts) => {
            const count = conflicts.length;
            showNotification(`${count} conflit(s) détecté(s)`, 'warning');
            
            // Update settings page if open
            if (this.currentTab === 'settings' && this.settingsComponent) {
                this.settingsComponent.updateConflictsList(conflicts);
            }
        });
        
        this.syncManager.on('data-updated', async (data) => {
            // Reload data from storage
            await this.loadData();
            
            // Refresh current view
            if (this.currentTab) {
                this.refreshCurrentView();
            }
            
            showNotification('Données mises à jour depuis le serveur', 'info');
        });
    }

    setupManagerEvents() {
        // News manager events
        this.newsManager.on('database-changed', (database) => {
            this.newsDatabase = database;
            // Marquer comme modification utilisateur seulement si pas en chargement
            if (!this.isLoadingData) {
                this.hasUserChanges = true;
                this.isDirty = true;
                this.autoSave();
            }
        });
        
        this.newsManager.on('item-deleted', (item) => {
            this.conductorManager.removeSegmentByItemId(item.id, 'newsId');
            this.hasUserChanges = true;
            this.isDirty = true;
        });
        
        // Animation manager events
        this.animationManager.on('database-changed', (database) => {
            this.animationDatabase = database;
            // Marquer comme modification utilisateur seulement si pas en chargement
            if (!this.isLoadingData) {
                this.hasUserChanges = true;
                this.isDirty = true;
                this.autoSave();
            }
        });
        
        this.animationManager.on('item-deleted', (item) => {
            this.conductorManager.removeSegmentByItemId(item.id, 'animationId');
            this.hasUserChanges = true;
            this.isDirty = true;
        });
        
        // Block manager events
        this.blockManager.on('blocks-changed', (blocks) => {
            this.blocksDatabase = blocks;
            // Marquer comme modification utilisateur seulement si pas en chargement
            if (!this.isLoadingData) {
                this.hasUserChanges = true;
                this.isDirty = true;
                this.autoSave();
            }
            
            // Refresh editor HTML to update block selectors
            if (this.newsManager.currentId || this.animationManager.currentId) {
                this.initializeEditorHTML();
                
                // Reload current item to preserve form data
                if (this.newsManager.currentId) {
                    this.newsManager.load(this.newsManager.currentId);
                }
                if (this.animationManager.currentId) {
                    this.animationManager.load(this.animationManager.currentId);
                }
            }
        });
        
        // Écouter tous les événements du block manager pour garantir la sauvegarde
        this.blockManager.on('block-created', () => {
            this.hasUserChanges = true;
            this.isDirty = true;
            this.autoSave();
        });
        this.blockManager.on('block-saved', () => {
            this.hasUserChanges = true;
            this.isDirty = true;
            this.autoSave();
        });
        this.blockManager.on('block-deleted', () => {
            this.hasUserChanges = true;
            this.isDirty = true;
            this.autoSave();
        });
        this.blockManager.on('block-items-changed', () => {
            this.hasUserChanges = true;
            this.isDirty = true;
            this.autoSave();
        });
        
        // Conductor manager events
        this.conductorManager.on('segments-changed', (segments) => {
            this.conductorSegments = segments;
            // Marquer comme modification utilisateur seulement si pas en chargement
            // et pas pendant l'ajout de blocs avec enfants
            if (!this.isLoadingData && !this.isAddingBlockWithChildren) {
                this.hasUserChanges = true;
                this.isDirty = true;
                this.autoSave();
            }
        });
    }

    async loadData() {
        try {
            // Marquer qu'on est en train de charger pour éviter les autoSave
            this.isLoadingData = true;
            console.log('📥 Début du chargement des données...');
            
            const data = await this.storage.load();
            
            // Load databases
            this.newsDatabase = data.news || [];
            this.animationDatabase = data.animations || [];
            this.blocksDatabase = data.blocks || [];
            // Extraire les segments du premier conducteur s'il existe
            if (data.conductors && data.conductors.length > 0) {
                this.conductorSegments = data.conductors[0].segments || [];
                console.log('📦 Conducteur chargé avec', this.conductorSegments.length, 'segments');
            } else {
                this.conductorSegments = [];
                console.log('💭 Aucun conducteur trouvé');
            }
            
            // Stocker les databases complètes pour le filtrage
            this.allNewsDatabase = [...this.newsDatabase];
            this.allAnimationDatabase = [...this.animationDatabase];
            
            console.log('Loading data:', {
                news: this.newsDatabase.length,
                animations: this.animationDatabase.length,
                blocks: this.blocksDatabase.length,
                conductor: this.conductorSegments.length
            });
            
            // Set in managers
            this.newsManager.setDatabase(this.newsDatabase);
            this.animationManager.setDatabase(this.animationDatabase);
            this.blockManager.setBlocks(this.blocksDatabase);
            this.conductorManager.setSegments(this.conductorSegments);
            
            // Initialiser les filtres par auteur
            this.updateNewsAuthorFilter();
            this.updateAnimationAuthorFilter();
            
            // Apply settings
            if (data.settings) {
                this.applySettings(data.settings);
            }
            
            // Fin du chargement - réactiver l'autoSave
            this.isLoadingData = false;
            this.hasUserChanges = false; // Pas de changements au chargement
            console.log('✅ Chargement terminé, autoSave réactivé');
            
        } catch (error) {
            console.error('Failed to load data:', error);
            showNotification('Failed to load saved data', 'error');
            // Même en cas d'erreur, réactiver l'autoSave
            this.isLoadingData = false;
        }
    }

    initializeUI() {
        // Render initial lists
        this.newsManager.render();
        this.animationManager.render();
        this.blockManager.render();
        this.conductorManager.render();
        
        // Initialize editor HTML if needed
        this.initializeEditorHTML();
        
        // Update timer display
        this.updateTimerDisplay(this.currentTab);
        
        // Initialize scheduled start time
        this.updateShowStartTime();
        
        // Setup click outside handler for block selector dropdowns
        this.setupBlockSelectorClickOutside();
    }

    updateConnectedUsers() {
        // Récupérer la liste des utilisateurs connectés depuis le CrossUserManager
        if (this.crossUserManager) {
            const users = this.crossUserManager.getConnectedUsers();
            const usersList = document.getElementById('connected-users-list');
            
            if (usersList) {
                if (users && users.length > 0) {
                    usersList.innerHTML = users.map(user => `
                        <div style="padding: 0.3rem 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                            <span style="color: #00ff9f;">●</span> ${user.name || user.userId}
                            ${user.lastActivity ? `<span style="color: #666; font-size: 0.75rem;"> - ${this.getTimeAgo(user.lastActivity)}</span>` : ''}
                        </div>
                    `).join('');
                } else {
                    // Au moins afficher l'utilisateur actuel
                    const currentUser = this.storage?.getCurrentUser();
                    const userName = localStorage.getItem('saint-esprit-user-name') || 
                                   localStorage.getItem('saint-esprit-user-fullname') || 
                                   currentUser || 'Utilisateur';
                    
                    usersList.innerHTML = `
                        <div style="padding: 0.3rem 0;">
                            <span style="color: #00ff9f;">●</span> ${userName} (vous)
                        </div>
                    `;
                }
            }
        }
    }
    
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'En ligne';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}j`;
    }
    
    showDashboard() {
        const today = new Date().toISOString().split('T')[0];
        const allNews = [...this.newsDatabase];
        const allItems = [...this.newsDatabase, ...this.animationDatabase];
        
        // Statistiques générales
        const todayItems = allItems.filter(item => item.scheduledDate === today);
        const readyItems = todayItems.filter(item => item.status === 'ready');
        const urgentItems = todayItems.filter(item => 
            item.status !== 'ready' && item.tags?.includes('urgent')
        );
        
        // Nouvelles statistiques pour les news uniquement
        const futureNews = allNews.filter(news => news.scheduledDate && news.scheduledDate > today);
        const todayNews = allNews.filter(news => news.scheduledDate === today);
        const expiredNews = allNews.filter(news => {
            if (!news.scheduledDate) return false;
            if (news.expiresAt && news.expiresAt < today) return true;
            // Considérer comme périmé si plus de 7 jours dans le passé
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return news.scheduledDate < weekAgo.toISOString().split('T')[0];
        });
        const undatedNews = allNews.filter(news => !news.scheduledDate);
        
        const dashboardHTML = this.getDashboardHTML({
            progress: Math.round((readyItems.length / todayItems.length) * 100) || 0,
            totalItems: todayItems.length,
            readyCount: readyItems.length,
            urgentItems: urgentItems,
            futureNewsCount: futureNews.length,
            todayNewsCount: todayNews.length,
            expiredNewsCount: expiredNews.length,
            undatedNewsCount: undatedNews.length,
            dayName: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][new Date().getDay()]
        });
        
        // Cacher toutes les sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Obtenir ou créer la section dashboard
        let dashboardSection = document.getElementById('dashboard-section');
        if (!dashboardSection) {
            dashboardSection = document.createElement('div');
            dashboardSection.id = 'dashboard-section';
            dashboardSection.className = 'section';
            document.querySelector('.main-container').appendChild(dashboardSection);
        }
        
        // Afficher le dashboard
        dashboardSection.innerHTML = dashboardHTML;
        dashboardSection.classList.add('active');
        
        // Mettre à jour le timer display
        this.updateTimerDisplay('dashboard');
        
        // Afficher les utilisateurs connectés
        this.updateConnectedUsers();
        
        // Mettre à jour la navigation active
        document.querySelectorAll('.nav-item, .nav-tab').forEach(nav => {
            nav.classList.toggle('active', nav.dataset.tab === 'dashboard');
        });
        
        this.currentTab = 'dashboard';
    }

    getDashboardHTML(data) {
        // Récupérer le prénom de l'utilisateur
        const fullName = localStorage.getItem('saint-esprit-user-fullname') || 
                        localStorage.getItem('saint-esprit-user-name') || '';
        const firstName = fullName.split(' ')[0] || '';
        const welcomeMessage = firstName ? `Bienvenue sur Saint-Esprit, ${firstName}` : 'Bienvenue sur Saint-Esprit';
        
        return `
            <div class="dashboard-container" style="padding: 2rem; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: calc(100vh - 200px);">
                <div style="text-align: center;">
                    <h1 style="font-size: 3rem; margin-bottom: 1rem; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 700;">${welcomeMessage}</h1>
                    <h2 style="font-size: 1.8rem; margin-bottom: 2rem; color: var(--text-secondary);">Système de Newsroom pour Radio Fidélité</h2>
                    <p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 3rem;">${data.dayName} ${new Date().toLocaleDateString('fr-FR')}</p>

                    <!-- VERSION DISPLAY -->
                    <div style="position: fixed; bottom: 10px; right: 10px; background: var(--bg-secondary); padding: 5px 10px; border-radius: var(--radius-md); border: 1px solid var(--primary); font-size: 0.9rem; color: var(--primary); font-family: monospace; box-shadow: var(--shadow-md);">
                        Saint-Esprit v${Constants.VERSION}
                    </div>

                    <div style="display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="app.switchTab('news')" style="padding: 1rem 2rem; font-size: 1.1rem;">
                            📰 Créer une News
                        </button>
                        <button class="btn btn-primary" onclick="app.switchTab('animation')" style="padding: 1rem 2rem; font-size: 1.1rem;">
                            🎙️ Créer une Animation
                        </button>
                        <button class="btn btn-primary" onclick="app.switchTab('conductor')" style="padding: 1rem 2rem; font-size: 1.1rem;">
                            📋 Voir le Conducteur
                        </button>
                    </div>

                    <div style="margin-top: 3rem; padding: 1.5rem; background: var(--primary-bg); border-radius: var(--radius-xl); border: 1px solid var(--primary); box-shadow: var(--shadow-md);">
                        <h3 style="color: var(--primary); margin-bottom: 1rem; font-weight: 600;">📊 Statistiques du jour</h3>
                        <p style="color: var(--text-secondary); font-size: 1rem;">
                            ${data.totalItems} éléments planifiés • ${data.readyCount} prêts • ${data.totalItems - data.readyCount} en préparation
                        </p>
                        ${data.urgentItems.length > 0 ?
                            `<p style="color: var(--error); margin-top: 0.5rem;">⚠️ ${data.urgentItems.length} élément(s) urgent(s) à finaliser</p>`
                            : '<p style="color: var(--success); margin-top: 0.5rem;">✅ Aucun élément urgent</p>'
                    }
                    
                    <!-- Séparateur -->
                    <div style="border-top: 1px solid var(--border); margin: 1rem 0;"></div>

                    <!-- Nouvelles statistiques des news -->
                    <div style="margin-top: 1rem;">
                        <h4 style="color: var(--primary); margin-bottom: 0.5rem; font-size: 0.95rem; font-weight: 600;">📰 État des news</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
                            <div style="color: var(--info);">
                                <span style="font-weight: bold;">${data.todayNewsCount}</span> news aujourd'hui
                            </div>
                            <div style="color: var(--warning);">
                                <span style="font-weight: bold;">${data.futureNewsCount}</span> news à venir
                            </div>
                            <div style="color: var(--error);">
                                <span style="font-weight: bold;">${data.expiredNewsCount}</span> news périmées
                            </div>
                            <div style="color: var(--text-muted);">
                                <span style="font-weight: bold;">${data.undatedNewsCount}</span> news non datées
                            </div>
                        </div>
                    </div>

                    <!-- Séparateur -->
                    <div style="border-top: 1px solid var(--border); margin: 1rem 0;"></div>

                    <!-- Utilisateurs connectés -->
                    <div>
                        <h4 style="color: var(--primary); margin-bottom: 0.5rem; font-size: 0.95rem; font-weight: 600;">👥 Utilisateurs en ligne</h4>
                        <div id="connected-users-list" style="color: var(--text-secondary); font-size: 0.85rem;">
                            <!-- La liste sera remplie dynamiquement -->
                        </div>
                    </div>
                </div>
                <button class="btn btn-primary" style="font-size: 1.25rem; padding: 1rem 2rem;" onclick="app.loadTemplate('${data.dayName.toLowerCase()}')">
                    📋 Charger Template ${data.dayName}
                </button>
            </div>
        `;
    }

    initializeEditorHTML() {
        // News editor HTML
        const newsEditor = safeGetElement('news-editor');
        if (newsEditor) {
            newsEditor.innerHTML = this.getEditorHTML('news');
            
            // Ajouter les event listeners après création du HTML
            setTimeout(() => {
                const newsContent = safeGetElement('news-content');
                if (newsContent) {
                    newsContent.addEventListener('input', () => {
                        this.newsManager.debouncedCalculateDuration();
                    });
                }
                
                // Add event listener for multitrack button
                const multitrackBtn = safeGetElement('multitrack-news-btn');
                if (multitrackBtn) {
                    multitrackBtn.addEventListener('click', () => {
                        console.log('Multitrack button clicked');
                        this.openMultitrackForNews();
                    });
                }
            }, 100);
        }
        
        // Animation editor HTML
        const animationEditor = safeGetElement('animation-editor');
        if (animationEditor) {
            animationEditor.innerHTML = this.getEditorHTML('animation');
            
            // Ajouter les event listeners après création du HTML
            setTimeout(() => {
                const animationContent = safeGetElement('animation-content');
                if (animationContent) {
                    animationContent.addEventListener('input', () => {
                        this.animationManager.debouncedCalculateDuration();
                    });
                }
            }, 100);
        }
        
        // Block editor HTML
        const blocksEditor = safeGetElement('blocks-editor');
        if (blocksEditor) {
            blocksEditor.innerHTML = this.getBlockEditorHTML();
            
            // Add event listener for planned duration field
            const plannedDurationInput = safeGetElement('block-planned-duration');
            if (plannedDurationInput) {
                plannedDurationInput.addEventListener('input', () => {
                    if (this.blockManager && this.blockManager.currentBlockId) {
                        this.blockManager.calculateBlockDuration();
                    }
                });
            }
        }
    }

    getEditorHTML(type) {
        const prefix = type === 'animation' ? 'animation-' : 'news-';
        const categoryField = type === 'news' ? `
            <select id="${prefix}category" style="padding: 6px 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px;">
                ${Constants.NEWS_CATEGORIES.map(cat => 
                    `<option value="${cat}">${cat}</option>`
                ).join('')}
            </select>
        ` : `
            <select id="${prefix}type" style="padding: 6px 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px;">
                ${Constants.ANIMATION_TYPES.map(t => 
                    `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
                ).join('')}
            </select>
        `;
        
        // Get available blocks for assignment
        const blocks = this.blockManager ? this.blockManager.getBlocks() : [];
        const blockSelector = blocks.length > 0 ? `
            <div id="${prefix}block-selector" style="display: inline-block; position: relative;">
                <button type="button" onclick="app.toggleBlockSelector('${prefix}')" 
                        style="padding: 6px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #ccc; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                    <span>📰 Journaux</span>
                    <span id="${prefix}selected-blocks-count" style="background: #444; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem;">0</span>
                    <span style="font-size: 0.8rem;">▼</span>
                </button>
                <div id="${prefix}block-selector-dropdown" style="display: none; position: absolute; top: 100%; left: 0; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; padding: 8px; z-index: 1000; min-width: 250px; max-height: 300px; overflow-y: auto; margin-top: 4px;">
                    <div id="${prefix}block-selector-list">
                        ${blocks.map(block => {
                            const autoTitle = this.blockManager.generateAutoTitle(block.hitTime, block.scheduledDate);
                            return `
                                <label style="display: flex; align-items: center; gap: 8px; padding: 4px; cursor: pointer; hover: background: #2a2a2a;">
                                    <input type="checkbox" id="${prefix}block-${block.id}" value="${block.id}" 
                                           onchange="app.onBlockCheckboxChange('${prefix}')"
                                           style="cursor: pointer;">
                                    <span style="width: 12px; height: 12px; background: ${block.color}; border-radius: 2px;"></span>
                                    <span style="flex: 1;">${sanitizeHTML(autoTitle)}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                    ${blocks.length === 0 ? '<p style="color: #666; text-align: center; padding: 8px;">Aucun journal disponible</p>' : ''}
                </div>
            </div>
        ` : '';
        
        return `
            <div class="editor-toolbar">
                <button class="toolbar-btn" onclick="app.${type}Manager.save()">💾 Enregistrer</button>
                <button class="toolbar-btn" onclick="app.preview('${type}')">👁️ Aperçu</button>
                ${type === 'news' ? `
                <button class="toolbar-btn" id="multitrack-news-btn" style="background: linear-gradient(135deg, #00ff9f, #00b4d8); color: #000;">
                    🎚️ Éditeur Multipiste
                </button>
                ` : ''}
                ${blocks.length > 0 ? `
                <div class="toolbar-separator"></div>
                ${blockSelector}
                <div class="toolbar-separator"></div>
                ` : ''}
                <button class="toolbar-btn" onclick="app.${type}Manager.delete()" style="background-color: #5a0000; color: #ff6666;">🗑️ Supprimer</button>
            </div>
            <div class="editor-content">
                <input type="text" id="${prefix}title" placeholder="Titre ${type === 'news' ? 'de la news' : 'de l\'animation'}..." style="font-size: 1.5rem; font-weight: bold;">
                <div style="display: grid; grid-template-columns: 140px 80px 180px 140px 140px; gap: 8px; margin-bottom: 8px; align-items: center;">
                    ${categoryField}
                    <input type="text" id="${prefix}duration" placeholder="0:30" style="padding: 6px 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; text-align: center;">
                    <input type="text" id="${prefix}author" placeholder="${type === 'news' ? 'Reporter' : 'Animateur'}" style="padding: 6px 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px;">
                    <select id="${prefix}status" style="padding: 6px 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px;">
                        <option value="draft">📝 Brouillon</option>
                        <option value="ready">✅ Prêt</option>
                        <option value="approved">✔️ Approuvé</option>
                    </select>
                    <input type="date" id="${prefix}scheduled-date" placeholder="jj/mm/aaaa" style="padding: 6px 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; font-size: 0.875rem;">
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 0.75rem; color: #888;">Étiquettes:</span>
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="checkbox" id="${prefix}tag-recurring" style="cursor: pointer;">
                            <span style="font-size: 0.75rem; color: #95e1d3;">🔄 Récurrent</span>
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.75rem; color: #888;">Dernière utilisation:</span>
                        <span id="${prefix}last-used" style="font-size: 0.75rem; color: #666;">Never</span>
                    </div>
                </div>
                <div id="${prefix}duration-breakdown" class="duration-breakdown" style="display: none;">
                    <div class="duration-item">
                        <span>Reading time:</span>
                        <span id="${prefix}reading-time">0:00</span>
                    </div>
                    <div class="duration-item">
                        <span>Sound elements:</span>
                        <span id="${prefix}sounds-time">0:00</span>
                    </div>
                    <div class="duration-item">
                        <span>Total calculated:</span>
                        <span id="${prefix}calculated-duration">0:00</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: #1a1a1a; border-radius: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button class="format-btn" onclick="app.${type}Manager.formatText('bold')" title="Gras" style="padding: 6px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; font-weight: bold; cursor: pointer; font-size: 0.875rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: auto; min-width: 32px;">B</button>
                        <button class="format-btn" onclick="app.${type}Manager.formatText('italic')" title="Italique" style="padding: 6px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; font-style: italic; cursor: pointer; font-size: 0.875rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: auto; min-width: 32px;">I</button>
                        <button class="format-btn" onclick="app.${type}Manager.formatText('underline')" title="Souligné" style="padding: 6px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; text-decoration: underline; cursor: pointer; font-size: 0.875rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: auto; min-width: 32px;">U</button>
                        <span style="width: 1px; height: 20px; background: #444; margin: 0 4px;"></span>
                        <button class="format-btn" onclick="app.${type}Manager.insertBullet()" title="Liste" style="padding: 6px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.75rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: auto;">• Liste</button>
                    </div>
                    ${type === 'news' ? `
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="width: 1px; height: 20px; background: #444; margin: 0 4px;"></span>
                        <button class="format-btn" onclick="app.newsManager.insertLancement()" title="Lancement" style="padding: 6px 12px; background: #00ff9f; border: none; border-radius: 4px; color: #000; cursor: pointer; font-size: 0.75rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: auto;">📢 Lancement</button>
                        <button class="format-btn" onclick="app.newsManager.insertDesannonce()" title="Désannonce" style="padding: 6px 12px; background: #00b4d8; border: none; border-radius: 4px; color: #000; cursor: pointer; font-size: 0.75rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: auto;">📤 Désannonce</button>
                    </div>
                    ` : ''}
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="width: 1px; height: 20px; background: #444; margin: 0 4px;"></span>
                        <button class="format-btn" onclick="app.openSoundModal('${type}')" title="Son" style="padding: 6px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.75rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: auto;">🎵 Son</button>
                        <button class="format-btn" onclick="app.${type}Manager.insertTime()" title="Durée" style="padding: 6px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.75rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: auto;">🕐 Durée</button>
                        ${type === 'news' ? `<button class="format-btn" onclick="app.printNews()" title="Imprimer" style="padding: 6px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.75rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: auto;">🖨️ Print</button>` : ''}
                    </div>
                    <div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.75rem; color: #888;">Total duration:</span>
                        <span id="${prefix}total-duration-display" style="font-weight: bold; color: #4ecdc4; font-size: 0.875rem;">0:00</span>
                        <span style="font-size: 0.7rem; color: #666;">(<span id="${prefix}word-count">0</span> mots)</span>
                    </div>
                </div>
                <div class="textarea-container">
                    <textarea id="${prefix}content" 
                              oninput="app.${type}Manager?.calculateDuration?.()"
                              placeholder="Content...

Use:
- **text** for bold
- *text* for italic  
- __text__ for underline
- [SOUND: name - duration] for sounds"></textarea>
                </div>
                <div class="sounds-panel" id="${prefix}sounds-panel">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.875rem; color: #999;">Sound elements</h4>
                    <div id="${prefix}sounds-list" class="sounds-list"></div>
                </div>
            </div>
        `;
    }

    getBlockEditorHTML() {
        return `
            <div class="editor-toolbar">
                <button class="toolbar-btn" onclick="app.blockManager.save()">💾 Save</button>
                <button class="toolbar-btn" onclick="app.blockManager.openAssignModal()">📎 Assign Items</button>
                <button class="toolbar-btn" onclick="app.blockManager.delete()" style="background-color: #5a0000; color: #ff6666;">🗑️ Supprimer</button>
            </div>
            <div class="editor-content">
                <input type="text" id="block-title" placeholder="Titre du journal..." style="font-size: 1.5rem; font-weight: bold;">
                <div class="flex gap-2 mb-2">
                    <div style="flex: 1.5;">
                        <label style="font-size: 0.875rem; color: #999;">Auteur / Journaliste :</label>
                        <input type="text" id="block-author" placeholder="Nom du journaliste" style="width: 100%;">
                    </div>
                    <div class="flex-1">
                        <label style="font-size: 0.875rem; color: #999;">Durée prévue :</label>
                        <input type="text" id="block-planned-duration" placeholder="5:00" style="width: 100px;">
                    </div>
                    <div class="flex-1">
                        <label style="font-size: 0.875rem; color: #999;">Heure de diffusion :</label>
                        <input type="text" id="block-hit-time" placeholder="18:30" style="width: 100px;">
                    </div>
                    <div class="flex-1">
                        <label style="font-size: 0.875rem; color: #999;">Date planifiée :</label>
                        <input type="date" id="block-scheduled-date" style="width: 140px;">
                    </div>
                    <div style="flex: 0.5;">
                        <label style="font-size: 0.875rem; color: #999;">Couleur :</label>
                        <input type="color" id="block-color" value="#00ff9f" style="width: 50px; height: 34px; cursor: pointer;">
                    </div>
                    <div class="flex-1">
                        <label style="font-size: 0.875rem; color: #999;">Durée totale :</label>
                        <div id="block-total-duration" style="font-size: 1.25rem; font-weight: bold; color: #00ff9f;">0:00</div>
                    </div>
                </div>
                
                <div class="block-duration-info mb-3">
                    <div class="duration-comparison">
                        <div>
                            <span class="duration-label">Durée prévue :</span>
                            <span class="duration-value" id="block-planned-display">5:00</span>
                        </div>
                        <div>
                            <span class="duration-label">Durée réelle :</span>
                            <span class="duration-value" style="color: #00ff9f;" id="block-actual-display">0:00</span>
                        </div>
                        <div>
                            <span class="duration-label">Différence :</span>
                            <span class="duration-value" id="block-difference-display" style="color: #ff6b6b;">-5:00</span>
                        </div>
                    </div>
                </div>
                
                <h4 class="mb-2">Éléments assignés</h4>
                <div id="block-assigned-items" class="assigned-items-list mb-3" style="max-height: 300px; overflow-y: auto;">
                    <p style="color: #999; text-align: center;">Aucun élément assigné</p>
                </div>
                
                <h4 class="mb-2">Sommaire <span id="block-description-word-count" style="font-size: 0.75rem; color: #666; font-weight: normal;">(0 mots)</span></h4>
                <textarea id="block-description" placeholder="Sommaire du journal..." style="min-height: 150px;"></textarea>
            </div>
        `;
    }

    setupEventListeners() {
        console.log('🔊 Setting up event listeners...');
        
        // New sidebar navigation
        const navItems = document.querySelectorAll('.nav-item');
        console.log(`Found ${navItems.length} nav items to attach`);
        
        navItems.forEach((item, index) => {
            const tab = item.dataset.tab;
            console.log(`Attaching listener to nav ${index}: ${tab}`);
            
            item.addEventListener('click', (e) => {
                console.log(`💆 Nav clicked: ${tab}`);
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });
        
        // Legacy nav-tab support (if any remain)
        const legacyTabs = document.querySelectorAll('.nav-tab');
        console.log(`Found ${legacyTabs.length} legacy nav tabs`);
        
        legacyTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                console.log(`💆 Legacy tab clicked: ${e.target.dataset.tab}`);
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Search inputs
        const newsSearch = safeGetElement('news-search');
        if (newsSearch) {
            newsSearch.addEventListener('input', Utils.debounce((e) => {
                this.newsManager.search(e.target.value);
            }, 300));
        }
        
        const animationSearch = safeGetElement('animation-search');
        if (animationSearch) {
            animationSearch.addEventListener('input', Utils.debounce((e) => {
                this.animationManager.search(e.target.value);
            }, 300));
        }
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcut(e);
        });
        
        // Window visibility change
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Before unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // Click outside to close sidebar on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const sidebarToggle = document.getElementById('sidebar-toggle');
                
                if (sidebar && sidebar.classList.contains('expanded') &&
                    !sidebar.contains(e.target) && 
                    !sidebarToggle?.contains(e.target)) {
                    sidebar.classList.remove('expanded');
                }
            }
        });
        
        // Gestionnaire de clic pour les news-items
        document.addEventListener('click', (e) => {
            const newsItem = e.target.closest('.news-item');
            if (newsItem && !e.target.closest('button')) {
                const newsId = newsItem.dataset.newsId || newsItem.dataset.id;
                console.log('📰 Click on news-item, newsId:', newsId, 'datasets:', newsItem.dataset);
                if (newsId) {
                    console.log('📰 Opening news:', newsId);
                    if (this.newsManager) {
                        // Passer l'ID comme string, pas comme nombre
                        this.newsManager.load(newsId);
                    } else {
                        console.error('❌ newsManager not initialized!');
                    }
                }
            }
        });
        
        console.log('✅ Event listeners setup completed');
    }

    startBackgroundTasks() {
        // Clock updates
        this.clockInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.updateClocks();
            }
        }, Constants.CLOCK_UPDATE_INTERVAL);
        
        // Auto-save - Désactivé par défaut (sera déclenché par les actions utilisateur)
        // L'intervalle automatique peut causer des écrasements non désirés
        // if (safeGetElement('auto-save')?.checked !== false) {
        //     this.autoSaveInterval = setInterval(() => {
        //         this.autoSave();
        //     }, Constants.AUTO_SAVE_INTERVAL);
        // }
        
        // Info pour l'utilisateur
        console.log('💾 AutoSave activé : sauvegarde automatique après chaque modification');
        
        // Auto-backup
        if (safeGetElement('auto-backup')?.checked !== false) {
            this.autoBackupInterval = setInterval(() => {
                this.createBackup();
            }, Constants.AUTO_BACKUP_INTERVAL);
        }
    }

    showConflictsModal() {
        if (!this.syncManager) return;
        
        const conflicts = this.syncManager.getConflicts();
        if (conflicts.length === 0) {
            showNotification('Aucun conflit à résoudre', 'info');
            return;
        }
        
        // Create modal HTML
        const modalHTML = `
            <div id="conflicts-modal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3>⚠️ Résolution des conflits de synchronisation</h3>
                        <button class="icon-btn" onclick="app.closeModal('conflicts-modal')">✕</button>
                    </div>
                    <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                        ${conflicts.map(conflict => `
                            <div class="conflict-item" style="border: 1px solid #333; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                                <h4 style="color: #ff6666; margin-bottom: 0.5rem;">
                                    ${conflict.type === 'news' ? '📰' : conflict.type === 'animation' ? '🎙️' : '📋'} 
                                    ${conflict.localItem.title || 'Sans titre'}
                                </h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div style="background: rgba(0, 100, 255, 0.1); padding: 0.5rem; border-radius: 4px;">
                                        <strong style="color: #00aaff;">📱 Version locale</strong>
                                        <p style="font-size: 0.875rem; color: #ccc; margin: 0.25rem 0;">
                                            Modifié : ${new Date(conflict.localTime).toLocaleString('fr-FR')}<br>
                                            Par : ${conflict.localItem.author || 'Inconnu'}
                                        </p>
                                        <button class="btn btn-primary btn-sm" onclick="app.resolveConflict('${conflict.type}-${conflict.id}', true)">
                                            Utiliser cette version
                                        </button>
                                    </div>
                                    <div style="background: rgba(0, 255, 100, 0.1); padding: 0.5rem; border-radius: 4px;">
                                        <strong style="color: #00ff66;">☁️ Version serveur</strong>
                                        <p style="font-size: 0.875rem; color: #ccc; margin: 0.25rem 0;">
                                            Modifié : ${new Date(conflict.serverTime).toLocaleString('fr-FR')}<br>
                                            Par : ${conflict.serverItem.author || 'Inconnu'}
                                        </p>
                                        <button class="btn btn-secondary btn-sm" onclick="app.resolveConflict('${conflict.type}-${conflict.id}', false)">
                                            Utiliser cette version
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal('conflicts-modal')">Fermer</button>
                    </div>
                </div>
            </div>
        `;
        
        // Insert modal into DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
    }
    
    async resolveConflict(conflictId, useLocal) {
        if (!this.syncManager) return;
        
        await this.syncManager.resolveConflict(conflictId, useLocal);
        
        // Update conflicts count
        const conflicts = this.syncManager.getConflicts();
        const conflictsBtn = document.getElementById('sync-conflicts-btn');
        const conflictsCount = document.getElementById('sync-conflicts-count');
        
        if (conflictsBtn && conflictsCount) {
            if (conflicts.length > 0) {
                conflictsBtn.style.display = 'inline-block';
                conflictsCount.textContent = conflicts.length;
            } else {
                conflictsBtn.style.display = 'none';
                this.closeModal('conflicts-modal');
                showNotification('Tous les conflits ont été résolus', 'success');
            }
        }
        
        // Refresh modal if still open
        if (document.getElementById('conflicts-modal')) {
            this.closeModal('conflicts-modal');
            if (conflicts.length > 0) {
                this.showConflictsModal();
            }
        }
    }
    
    refreshCurrentView() {
        // Refresh the current tab's content
        if (this.currentTab === 'news') {
            this.newsManager.refresh();
        } else if (this.currentTab === 'animation') {
            this.animationManager.refresh();
        } else if (this.currentTab === 'conductor') {
            this.refreshRundown();
        } else if (this.currentTab === 'blocks') {
            this.blockManager.refreshBlocksList();
        }
    }
    
    getMultitrackEditor() {
        if (!this.multitrackEditor) {
            console.log('Creating MultitrackEditor on first use...');
            this.multitrackEditor = new MultitrackEditor();
            // Don't init here, let it be done when actually needed
        }
        return this.multitrackEditor;
    }
    
    async openMultitrackFromNav() {
        // Open multitrack with a blank project or last project
        console.log('Opening multitrack from navigation...');
        
        // First ensure multitrack is initialized
        if (!this.multitrackEditor) {
            await this.initializeMultitrack();
        }
        
        // Check if there's an existing linked news
        if (!this.multitrackEditor.linkedNewsId) {
            // Create a blank project
            await this.multitrackEditor.linkToNews(
                null, // no news ID
                'Projet Libre', // title
                '3:00', // default 3 minutes duration
                '', // no text
                null // no existing audio
            );
        }
        
        // Switch to multitrack view
        this.switchTab('multitrack');
        
        // Make sure the news editor panel is visible
        const newsEditor = document.getElementById('multitrack-news-editor');
        if (newsEditor) {
            newsEditor.classList.add('active');
        }
        
        const container = document.querySelector('.multitrack-container');
        if (container) {
            container.classList.add('from-news');
        }
        
        // Force resize after a moment
        setTimeout(() => {
            if (this.multitrackEditor) {
                this.multitrackEditor.resizeCanvas();
                this.multitrackEditor.render();
            }
        }, 100);
        
        showNotification('Multipistes ouvert en mode libre', 'info');
    }
    
    switchTab(tabName) {
        // Handle dashboard specially
        if (tabName === 'dashboard') {
            this.showDashboard();
            return;
        }
        
        // Handle chroniques-invites tab
        if (tabName === 'chroniques-invites') {
            // Initialize chroniques module if needed
            if (window.chroniquesInvites && !window.chroniquesInvites.initialized) {
                window.chroniquesInvites.init();
                window.chroniquesInvites.initialized = true;
            }
        }
        
        // Update active navigation items
        const navItems = document.querySelectorAll('.nav-item, .nav-tab');
        navItems.forEach(nav => {
            nav.classList.toggle('active', nav.dataset.tab === tabName);
        });
        
        // Update sections
        const allSections = document.querySelectorAll('.section');
        allSections.forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSectionId = `${tabName}-section`;
        const section = safeGetElement(targetSectionId);
        if (section) {
            section.classList.add('active');
        }
        
        this.currentTab = tabName;
        
        // Update timer display
        this.updateTimerDisplay(tabName);
        
        // Rafraîchir les listes selon l'onglet
        if (tabName === 'news') {
            this.newsManager.render();
        } else if (tabName === 'animation') {
            this.animationManager.render();
        } else if (tabName === 'blocks') {
            console.log('Rendering blocks...');
            // Toujours rafraîchir la liste des blocks
            this.blockManager.render();
            if (!this.blocksInitialized) {
                this.initializeBlocks();
            }
        } else if (tabName === 'conductor') {
            console.log('Rendering conductor...');
            this.conductorManager.render();
        } else if (tabName === 'onair' && !this.onAirInitialized) {
            this.initializeOnAir();
        } else if (tabName === 'automation') {
            this.initializeAutomation();
        } else if (tabName === 'conductor-print' && !this.printInitialized) {
            this.initializePrint();
        } else if (tabName === 'audio-editor' && !this.audioEditorInitialized) {
            this.initializeAudioEditor();
        } else if (tabName === 'multitrack' && !this.multitrackInitialized) {
            this.initializeMultitrack();
        } else if (tabName === 'fridge' && !this.fridgeInitialized) {
            this.initializeFridge();
        } else if (tabName === 'template-builder') {
            this.initializeTemplateBuilder();
        }
    }
    
    openMultitrackForNews() {
        console.log('Opening multitrack for news...');
        
        // Check if newsManager exists
        if (!this.newsManager) {
            console.error('NewsManager not initialized');
            showNotification('Erreur: NewsManager non initialisé', 'error');
            return;
        }
        
        // Get current news data
        const currentNews = this.newsManager.getCurrentItem();
        console.log('Current news:', currentNews);
        
        if (!currentNews) {
            showNotification('Veuillez d\'abord créer et sauvegarder une news', 'warning');
            return;
        }
        
        // Save current news first
        this.newsManager.save();
        
        // Get the actual text content from the textarea or from the saved news
        const newsContentElement = document.getElementById('news-content');
        let newsText = '';
        
        // First try to get from textarea (current editing)
        if (newsContentElement && newsContentElement.value) {
            newsText = newsContentElement.value;
        } 
        // Otherwise get from saved news data
        else if (currentNews.content) {
            newsText = currentNews.content;
        }
        
        console.log('News text to transfer:', newsText ? newsText.substring(0, 100) + '...' : 'No text');
        
        // Initialize multitrack editor if needed BEFORE switching
        if (!this.multitrackEditor) {
            this.multitrackEditor = new MultitrackEditor();
        }
        
        // Switch to multitrack section
        this.switchTab('multitrack');
        
        // Initialize and link after DOM is ready
        setTimeout(async () => {
            try {
                // Ensure multitrack is properly initialized
                if (!this.multitrackInitialized) {
                    await this.initializeMultitrack();
                } else if (!this.multitrackEditor.initialized) {
                    await this.multitrackEditor.init();
                }
                
                // Now link the news to multitrack editor with existing audio if present
                await this.multitrackEditor.linkToNews(
                    currentNews.id,
                    currentNews.title,
                    currentNews.duration || '1:10',
                    newsText,
                    currentNews.audioData || null  // Pass existing audio data if available
                );
                
                // Show the news text editor panel
                const newsEditorPanel = document.getElementById('multitrack-news-editor');
                if (newsEditorPanel) {
                    newsEditorPanel.style.display = 'block';
                }
                
                console.log('Multitrack linked to news successfully');
            } catch (error) {
                console.error('Error linking multitrack to news:', error);
                showNotification('Erreur lors de l\'ouverture de l\'éditeur multipiste', 'error');
            }
        }, 100);
    }

    updateTimerDisplay(tab) {
        const timerDisplay = safeGetElement('main-timer-display');
        if (!timerDisplay) return;
        
        if (tab === 'news' || tab === 'animation' || tab === 'dashboard') {
            timerDisplay.innerHTML = `
                <div class="timer-item">
                    <div class="timer-label">TIME</div>
                    <div class="timer-value" id="current-time">${new Date().toTimeString().substring(0, 8)}</div>
                </div>
            `;
            timerDisplay.classList.add('simple');
        } else if (tab === 'audio-editor') {
            // Audio Editor: afficher seulement ON AIR et TIME (pas de NEXT)
            timerDisplay.innerHTML = `
                <div class="timer-item">
                    <div class="timer-label">ON AIR</div>
                    <div class="timer-value positive" id="on-air-timer">00:00:00</div>
                </div>
                <div class="timer-item">
                    <div class="timer-label">TIME</div>
                    <div class="timer-value" id="current-time">${new Date().toTimeString().substring(0, 8)}</div>
                </div>
            `;
            timerDisplay.classList.remove('simple');
        } else {
            timerDisplay.innerHTML = `
                <div class="timer-item">
                    <div class="timer-label">ON AIR</div>
                    <div class="timer-value positive" id="on-air-timer">00:00:00</div>
                </div>
                <div class="timer-item">
                    <div class="timer-label">TIME</div>
                    <div class="timer-value" id="current-time">${new Date().toTimeString().substring(0, 8)}</div>
                </div>
            `;
            timerDisplay.classList.remove('simple');
        }
    }

    invalidateSegmentCache() {
        this.cachedSegmentDurations = null;
        this.lastSegmentCacheTime = 0;
    }
    
    updateClocks() {
        try {
            const now = new Date();
            const timeString = now.toTimeString().substring(0, 8);
            
            const currentTimeEl = safeGetElement('current-time');
            if (currentTimeEl) {
                currentTimeEl.textContent = timeString;
            }
            
            // Only update complex timers if we're on the relevant tabs
            if (this.currentTab !== 'conductor' && this.currentTab !== 'onair') {
                return; // Skip expensive calculations if not needed
            }
            
            // ON AIR timer - countdown for current segment
            const nextTimerEl = safeGetElement('next-timer');
            if (nextTimerEl && this.conductorManager && this.conductorManager.getSegments) {
            // Cache segment durations for 5 seconds to avoid recalculating every second
            const now = Date.now();
            if (!this.cachedSegmentDurations || now - this.lastSegmentCacheTime > 5000) {
                const segments = this.conductorManager.getSegments();
                this.cachedSegmentDurations = segments.map(segment => ({
                    visible: this.conductorManager.isSegmentVisible(segment),
                    duration: Utils.parseDuration(segment.actualDuration || segment.duration || '0:00')
                }));
                this.lastSegmentCacheTime = now;
            }
            
            // Calculate remaining time for on-air segment
            let totalRemainingSeconds = 0;
            
            // Si on est en mode ON AIR avec un segment actif
            if (this.currentTab === 'onair' && this.onAirComponent && this.onAirComponent.currentSegmentIndex >= 0) {
                const currentIndex = this.onAirComponent.currentSegmentIndex;
                
                // Ajouter le temps restant du segment actuel
                if (this.onAirComponent.segmentStartTime && this.cachedSegmentDurations[currentIndex]) {
                    const segmentDuration = this.cachedSegmentDurations[currentIndex].duration;
                    const elapsed = Math.floor((Date.now() - this.onAirComponent.segmentStartTime) / 1000);
                    const remaining = Math.max(0, segmentDuration - elapsed);
                    totalRemainingSeconds += remaining;
                }
                
                // Ajouter la durée de tous les segments suivants visibles (depuis le cache)
                for (let i = currentIndex + 1; i < this.cachedSegmentDurations.length; i++) {
                    if (this.cachedSegmentDurations[i].visible) {
                        totalRemainingSeconds += this.cachedSegmentDurations[i].duration;
                    }
                }
            } else {
                // Mode conducteur : calculer la durée totale de tous les segments visibles (depuis le cache)
                for (const segmentData of this.cachedSegmentDurations) {
                    if (segmentData.visible) {
                        totalRemainingSeconds += segmentData.duration;
                    }
                }
            }
            
            // Formater et afficher le temps total restant
            const hours = Math.floor(totalRemainingSeconds / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((totalRemainingSeconds % 3600) / 60).toString().padStart(2, '0');
            const seconds = (totalRemainingSeconds % 60).toString().padStart(2, '0');
            nextTimerEl.textContent = `${hours}:${minutes}:${seconds}`;
            
            // Changer la couleur selon le temps restant
            if (totalRemainingSeconds === 0) {
                nextTimerEl.style.color = '#999';
            } else if (totalRemainingSeconds < 300) { // Moins de 5 minutes
                nextTimerEl.style.color = '#ff6b6b';
            } else if (totalRemainingSeconds < 900) { // Moins de 15 minutes
                nextTimerEl.style.color = '#ff8800';
            } else {
                nextTimerEl.style.color = '#00ff9f';
            }
            
            // Supprimer les classes inutiles
            nextTimerEl.classList.remove('negative');
        }
        
        // On Air timer
        const onAirTimerEl = safeGetElement('on-air-timer');
        if (onAirTimerEl) {
            if (this.isLive && this.showStartTime) {
                // Mode LIVE : afficher le temps écoulé
                const elapsed = Math.floor((now - this.showStartTime) / 1000);
                const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
                const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
                const seconds = (elapsed % 60).toString().padStart(2, '0');
                onAirTimerEl.textContent = `${hours}:${minutes}:${seconds}`;
                onAirTimerEl.classList.add('positive');
                onAirTimerEl.classList.remove('negative');
            } else if (this.scheduledStartTime) {
                // Mode ATTENTE : afficher le temps restant
                const timeUntilStart = Math.floor((this.scheduledStartTime - now) / 1000);
                if (timeUntilStart > 0) {
                    const hours = Math.floor(timeUntilStart / 3600).toString().padStart(2, '0');
                    const minutes = Math.floor((timeUntilStart % 3600) / 60).toString().padStart(2, '0');
                    const seconds = (timeUntilStart % 60).toString().padStart(2, '0');
                    onAirTimerEl.textContent = `-${hours}:${minutes}:${seconds}`;
                    onAirTimerEl.classList.add('negative');
                    onAirTimerEl.classList.remove('positive');
                } else {
                    // Le temps est dépassé
                    onAirTimerEl.textContent = '00:00:00';
                    onAirTimerEl.classList.remove('negative', 'positive');
                }
            } else {
                onAirTimerEl.textContent = '00:00:00';
                onAirTimerEl.classList.remove('negative', 'positive');
            }
        }
        } catch (error) {
            console.error('Error in updateClocks:', error);
            // Stop the clock interval if there's a persistent error
            if (this.clockErrorCount === undefined) {
                this.clockErrorCount = 0;
            }
            this.clockErrorCount++;
            if (this.clockErrorCount > 5) {
                console.error('Too many clock errors, stopping clock updates');
                if (this.clockInterval) {
                    clearInterval(this.clockInterval);
                    this.clockInterval = null;
                }
            }
        }
    }

    handleKeyboardShortcut(e) {
        // Prevent shortcuts if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
            return;
        }
        
        // Function keys navigation (F1-F10)
        const functionKeyTabs = {
            'F1': 'dashboard',
            'F2': 'news',
            'F3': 'animation', 
            'F4': 'audio-editor',
            'F5': 'blocks',
            'F6': 'fridge',
            'F7': 'conductor',
            'F8': 'onair',
            'F9': 'template-builder',
            'F10': 'settings',
            'F11': 'automation'
        };
        
        if (functionKeyTabs[e.key]) {
            e.preventDefault();
            this.switchTab(functionKeyTabs[e.key]);
            return;
        }
        
        // Ctrl/Cmd + S = Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.save();
        }
        
        // Ctrl/Cmd + N = New
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            if (this.currentTab === 'news') {
                this.newsManager.create();
            } else if (this.currentTab === 'animation') {
                this.animationManager.create();
            } else if (this.currentTab === 'blocks') {
                this.blockManager.create();
            }
        }
        
        // ESC = Close modals or collapse sidebar on mobile
        if (e.key === 'Escape') {
            // Close any open modals first
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
            } else if (window.innerWidth <= 768) {
                // Collapse sidebar on mobile
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.remove('expanded');
                }
            }
        }
    }

    handleVisibilityChange() {
        // Pause/resume background tasks based on visibility
        if (document.visibilityState === 'hidden') {
            // Could pause non-essential tasks here
        }
    }

    async autoSave() {
        if (safeGetElement('auto-save')?.checked === false) return;
        
        // Protection : ne sauvegarder que s'il y a eu de vraies modifications utilisateur
        if (!this.hasUserChanges) {
            console.log('⏸️ AutoSave ignoré : pas de modifications utilisateur');
            return;
        }
        
        // Protection : ne pas sauvegarder pendant le chargement initial
        if (this.isLoadingData) {
            console.log('⏸️ AutoSave ignoré : chargement en cours');
            return;
        }
        
        // Protection contre les sauvegardes trop fréquentes
        const now = Date.now();
        if (this.lastSaveTime && (now - this.lastSaveTime) < 10000) { // Minimum 10 secondes entre sauvegardes
            // Sauvegarde ignorée (trop récente) - silencieux pour éviter le spam
            // Ne plus programmer de sauvegarde différée automatique
            // pour éviter les boucles infinies
            if (this.pendingSaveTimeout) {
                clearTimeout(this.pendingSaveTimeout);
                this.pendingSaveTimeout = null;
            }
            return;
        }
        
        try {
            // AutoSave déclenché après modification utilisateur
            await this.save();
            this.hasUserChanges = false; // Réinitialiser le flag après sauvegarde
            this.isDirty = false;
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    async forceSave() {
        // Sauvegarde forcée sans protection anti-spam
        // Force Save déclenché
        
        // Annuler tout timeout en attente pour éviter les boucles
        if (this.pendingSaveTimeout) {
            clearTimeout(this.pendingSaveTimeout);
            this.pendingSaveTimeout = null;
        }
        
        const result = await this.save(true);
        
        // Réinitialiser les flags pour éviter les sauvegardes en boucle
        this.hasUserChanges = false;
        this.isDirty = false;
        this.lastSaveTime = Date.now();
        
        return result;
    }
    
    async save(force = false) {
        // Anti-spam protection (sauf si forcé)
        if (!force) {
            this.lastSaveTime = Date.now();
        }
        const currentSegments = this.conductorManager.getSegments();
        
        const data = {
            news: this.newsManager.getDatabase(),
            animations: this.animationManager.getDatabase(),
            blocks: this.blockManager.getBlocks(),
            // Créer UN conducteur avec les segments
            conductors: currentSegments.length > 0 ? [{
                id: 'main-conductor',
                createdAt: Date.now(),
                segments: currentSegments,
                userId: 'default'
            }] : [],
            settings: this.getSettings()
        };
        
        // Log minimal pour la sauvegarde
        if (data.conductors.length > 0 && data.conductors[0].segments.length > 0) {
            console.log(`💾 Sauvegarde: ${data.conductors[0].segments.length} segments`);
        }
        
        await this.storage.save(data);
    }

    async createBackup() {
        if (safeGetElement('auto-backup')?.checked === false) return;
        
        try {
            const backup = await this.storage.createBackup();
            
            // Update last backup time
            const lastBackupEl = safeGetElement('last-backup-time');
            if (lastBackupEl) {
                lastBackupEl.textContent = new Date(backup.timestamp).toLocaleString();
            }
        } catch (error) {
            console.error('Backup failed:', error);
        }
    }

    async checkAndRecoverBackup() {
        // Simplified version that doesn't block
        try {
            console.log('[DEBUG] Checking backups (simplified)...');
            
            // Skip backup check entirely for now - it was causing the crash
            // The backup system needs to be redesigned to not block the app
            
            // TODO: Implement a non-blocking backup check system
            // Ideas:
            // - Use Web Workers for backup operations
            // - Check backups after app is fully loaded
            // - Use a simpler backup system (localStorage instead of IndexedDB)
            
            console.log('[DEBUG] Backup check skipped (preventing crash)');
            return;
            
        } catch (error) {
            console.warn('Backup check error (ignored):', error);
        }
    }

    dismissRecoveryNotice() {
        const recoveryNotice = safeGetElement('recovery-notice');
        if (recoveryNotice) {
            recoveryNotice.classList.remove('show');
        }
    }

    async forceDataReload() {
        if (this.cacheManager) {
            return await this.cacheManager.forceReloadAll();
        }
        
        // Fallback sans cache manager
        console.log('🔄 Force reload sans cache manager...');
        await this.storage.loadAllData();
        this.onDatabaseUpdate('news', this.storage.cache.news);
        this.onDatabaseUpdate('animations', this.storage.cache.animations);
        this.onDatabaseUpdate('blocks', this.storage.cache.blocks);
        this.onDatabaseUpdate('conductors', this.storage.cache.conductors);
    }

    getSettings() {
        return {
            radioName: safeGetValue('radio-name') || 'Saint Esprit',
            radioSlogan: safeGetValue('radio-slogan') || 'Professional Broadcasting',
            autoSave: safeGetElement('auto-save')?.checked !== false,
            autoBackup: safeGetElement('auto-backup')?.checked !== false,
            showTimer: safeGetElement('show-timer')?.checked !== false,
            autoUpdateConductor: safeGetElement('auto-update-conductor')?.checked !== false
        };
    }

    applySettings(settings) {
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
    }

    // Modal handlers
    openSoundModal(type) {
        const manager = type === 'news' ? this.newsManager : this.animationManager;
        if (!manager.currentId) {
            alert(`Please select or create a ${type} item first.`);
            return;
        }
        
        // Reset form and open modal
        const modalId = type === 'news' ? 'sound-modal' : 'animation-sound-modal';
        const modal = safeGetElement(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    closeModal(modalId) {
        const modal = safeGetElement(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Conductor/Rundown methods
    addSegmentModal() {
        const modal = safeGetElement('add-segment-modal');
        if (modal) {
            modal.classList.add('active');
            this.updateSegmentForm();
        }
    }
    

    updateSegmentForm() {
        const type = safeGetValue('segment-type');
        const formContainer = safeGetElement('segment-form');
        if (!formContainer) return;
        
        let formHtml = '';
        
        // Ajouter l'option de parent pour tous les types sauf block
        if (type !== 'block') {
            const blocks = this.conductorSegments.filter(seg => seg.type === 'block');
            if (blocks.length > 0) {
                formHtml += `
                    <label style="font-size: 0.875rem; color: #ccc; margin-bottom: 0.25rem;">Parent block (optional):</label>
                    <select id="segment-parent-id" class="mb-2">
                        <option value="">-- No parent (top level) --</option>
                        ${blocks.map(block => 
                            `<option value="${block.id}">📁 ${sanitizeHTML(block.title)}</option>`
                        ).join('')}
                    </select>
                `;
            }
        }
        
        if (type === 'ad_placeholder') {
            // Directly open the ad placeholder modal
            this.closeModal('add-segment-modal');
            this.conductorManager.openAdPlaceholderModal();
            return;
        } else if (type === 'block') {
            console.log('Blocks dans la base:', this.blocksDatabase);
            console.log('Segments dans le conducteur:', this.conductorSegments.filter(s => s.type === 'block'));
            
            const availableBlocks = this.blocksDatabase.filter(block => 
                !this.conductorSegments.some(seg => seg.blockId === block.id || seg.blockId === String(block.id))
            );
            
            console.log('Blocks disponibles:', availableBlocks);
            
            if (availableBlocks.length === 0) {
                formHtml += '<p style="color: #999;">No blocks available. Create a block first.</p>';
            } else {
                // Trier par ordre alphabétique
                availableBlocks.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
                
                formHtml += `
                    <select id="segment-block-id" class="mb-2">
                        ${availableBlocks.map(block => 
                            `<option value="${block.id}">${sanitizeHTML(block.title)} (${block.plannedDuration})</option>`
                        ).join('')}
                    </select>
                `;
            }
        } else if (type === 'news') {
            // Afficher toutes les news sans filtrage - faire une copie pour ne pas modifier l'original
            const availableNews = [...this.newsDatabase];
            
            if (availableNews.length === 0) {
                formHtml = '<p style="color: #999;">No news items available. Create a news item first.</p>';
            } else {
                // Trier par ordre alphabétique
                availableNews.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
                
                formHtml = `
                    <select id="segment-news-id" class="mb-2">
                        ${availableNews.map(news => 
                            `<option value="${news.id}">${sanitizeHTML(news.title)} (${news.duration})</option>`
                        ).join('')}
                    </select>
                `;
            }
        } else if (type === 'animation') {
            // Afficher toutes les animations sans filtrage - faire une copie pour ne pas modifier l'original
            const availableAnimations = [...this.animationDatabase];
            
            if (availableAnimations.length === 0) {
                formHtml = '<p style="color: #999;">No animation items available. Create an animation item first.</p>';
            } else {
                // Trier par ordre alphabétique
                availableAnimations.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
                
                formHtml = `
                    <select id="segment-animation-id" class="mb-2">
                        ${availableAnimations.map(animation => 
                            `<option value="${animation.id}">${sanitizeHTML(animation.title)} (${animation.duration})</option>`
                        ).join('')}
                    </select>
                `;
            }
        } else {
            const defaultTitle = Constants.DEFAULT_TITLES[type] || '';
            const defaultDuration = Constants.DEFAULT_DURATIONS[type] || '0:30';
            
            formHtml += `
                <input type="text" id="segment-${type}-title" placeholder="Title" class="mb-2" 
                       value="${defaultTitle}">
                ${type === 'block' ? 
                    `<p style="color: #999; font-size: 0.875rem; margin-bottom: 0.5rem;">Duration will be calculated from child segments</p>` :
                    `<input type="text" id="segment-${type}-duration" placeholder="Duration (MM:SS)" class="mb-2"
                           value="${defaultDuration}">`
                }
                ${type === 'live' || type === 'package' || type === 'custom' || type === 'block' ? 
                    `<textarea id="segment-${type}-content" placeholder="Notes..." rows="3"></textarea>` : ''}
            `;
        }
        
        formContainer.innerHTML = formHtml;
    }

    async addSegment() {
        const type = safeGetValue('segment-type');
        const parentIdEl = safeGetElement('segment-parent-id');
        const parentId = parentIdEl ? parseInt(parentIdEl.value) || null : null;
        
        let segment = {
            type: type
        };
        
        if (type === 'block') {
            const blockIdElement = safeGetElement('segment-block-id');
            if (!blockIdElement) {
                alert('No blocks available.');
                return;
            }
            const blockId = blockIdElement.value; // Ne pas convertir en nombre !
            const block = this.blocksDatabase.find(b => b.id === blockId || b.id === String(blockId));
            if (block) {
                const actualDuration = this.blockManager.calculateBlockDurationSync(block);
                
                // Préparer les enfants pour le ConductorManager
                const children = [];
                if (block.items && block.items.length > 0) {
                    for (const item of block.items) {
                        if (item.type === 'news') {
                            const news = this.newsDatabase.find(n => n.id === item.id || String(n.id) === String(item.id));
                            if (news) {
                                const calculatedDuration = this.newsManager.calculateItemDuration(news);
                                children.push({
                                    type: 'news',
                                    newsId: news.id,
                                    title: news.title,
                                    duration: news.duration,
                                    actualDuration: calculatedDuration,
                                    author: news.author
                                });
                            }
                        } else if (item.type === 'animation') {
                            const animation = this.animationDatabase.find(a => a.id === item.id || String(a.id) === String(item.id));
                            if (animation) {
                                const calculatedDuration = this.animationManager.calculateItemDuration(animation);
                                children.push({
                                    type: 'animation',
                                    animationId: animation.id,
                                    title: animation.title,
                                    duration: animation.duration,
                                    actualDuration: calculatedDuration,
                                    author: animation.author
                                });
                            }
                        }
                    }
                }
                
                segment = {
                    ...segment,
                    blockId: blockId,
                    title: this.blockManager.generateAutoTitle(block.hitTime, block.scheduledDate),
                    duration: block.plannedDuration,
                    actualDuration: actualDuration,
                    blockColor: block.color,
                    content: block.description || '',  // Ajouter la description du bloc comme contenu
                    children: children  // Passer les enfants ici !
                };
                
                // Bloquer temporairement les événements de sauvegarde
                this.isAddingBlockWithChildren = true;
                
                // Ajouter le block avec ses enfants (le ConductorManager les ajoutera automatiquement)
                const blockSegment = this.conductorManager.addSegment(segment, parentId, true);
                
                console.log(`✅ Bloc ajouté avec ${children.length} enfants`);
                
                // Réactiver les événements et forcer la sauvegarde une seule fois
                this.isAddingBlockWithChildren = false;
                
                // Émettre l'événement une seule fois après tous les ajouts
                this.conductorManager.emit('segments-changed', this.conductorManager.segments);
                
                this.closeModal('add-segment-modal');
                return;
            }
        } else if (type === 'news') {
            const newsIdElement = safeGetElement('segment-news-id');
            if (!newsIdElement) {
                alert('No news available.');
                return;
            }
            const newsId = newsIdElement.value; // Ne pas convertir en nombre !
            const news = this.newsDatabase.find(n => n.id === newsId || n.id === String(newsId));
            if (news) {
                // Calculer la durée totale incluant les sons
                const calculatedDuration = this.newsManager.calculateItemDuration(news);
                
                segment = {
                    ...segment,
                    newsId: newsId,
                    title: news.title,
                    duration: news.duration,
                    actualDuration: calculatedDuration,
                    // Ne pas stocker le contenu complet pour éviter les problèmes de taille DynamoDB
                    author: news.author
                };
            }
        } else if (type === 'animation') {
            const animationIdElement = safeGetElement('segment-animation-id');
            if (!animationIdElement) {
                alert('No animation available.');
                return;
            }
            const animationId = animationIdElement.value; // Ne pas convertir en nombre !
            const animation = this.animationDatabase.find(a => a.id === animationId || a.id === String(animationId));
            if (animation) {
                // Calculer la durée totale incluant les sons
                const calculatedDuration = this.animationManager.calculateItemDuration(animation);
                
                segment = {
                    ...segment,
                    animationId: animationId,
                    title: animation.title,
                    duration: animation.duration,
                    actualDuration: calculatedDuration,
                    // Ne pas stocker le contenu complet pour éviter les problèmes de taille DynamoDB
                    author: animation.author
                };
            }
        } else {
            segment = {
                ...segment,
                title: safeGetValue(`segment-${type}-title`),
                duration: type === 'block' ? '0:00' : validateDuration(safeGetValue(`segment-${type}-duration`)),
                content: safeGetValue(`segment-${type}-content`) || ''
            };
        }
        
        this.conductorManager.addSegment(segment, parentId);
        this.closeModal('add-segment-modal');
    }

    refreshRundown() {
        // Recalculer les durées réelles pour tous les segments
        this.conductorSegments.forEach(segment => {
            if (segment.newsId) {
                const news = this.newsDatabase.find(n => n.id === segment.newsId || n.id === String(segment.newsId));
                if (news) {
                    const calculatedDuration = this.newsManager.calculateItemDuration(news);
                    this.conductorManager.updateSegment(segment.id, {
                        actualDuration: calculatedDuration,
                        title: news.title,
                        duration: news.duration
                    });
                }
            } else if (segment.animationId) {
                const animation = this.animationDatabase.find(a => a.id === segment.animationId || a.id === String(segment.animationId));
                if (animation) {
                    const calculatedDuration = this.animationManager.calculateItemDuration(animation);
                    this.conductorManager.updateSegment(segment.id, {
                        actualDuration: calculatedDuration,
                        title: animation.title,
                        duration: animation.duration
                    });
                }
            }
        });
        
        this.conductorManager.render();
        showNotification('Rundown refreshed with updated durations', 'info');
    }

    loadTemplate(templateName) {
        showNotification('Les templates ont été retirés de cette version', 'info');
    }

    saveTemplate() {
        showNotification('Les templates ont été retirés de cette version', 'info');
        return;
        const options = [
            'Save template as:',
            '',
            'Day template:',
            '- monday',
            '- tuesday',
            '- wednesday',
            '- thursday',
            '- friday',
            '- saturday',
            '- sunday',
            '',
            'Or enter a custom name'
        ].join('\n');
        
        const templateName = prompt(options);
        if (!templateName) return;
        
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = days.indexOf(templateName.toLowerCase());
        
        if (dayIndex !== -1) {
            // Save as day template
            this.templateManager.saveAsTemplate(
                `${templateName.charAt(0).toUpperCase() + templateName.slice(1)} Template`,
                dayIndex
            );
        } else {
            // Save as generic template
            this.templateManager.saveAsTemplate(templateName, null);
        }
    }

    showTemplateList() {
        const templates = this.templateManager.getAllTemplates();
        if (templates.length === 0) {
            showNotification('No saved templates found', 'info');
            return;
        }
        
        let list = 'Saved templates:\n\n';
        templates.forEach(template => {
            const type = template.dayOfWeek !== null ? 
                `Day: ${this.templateManager.getDayName(template.dayOfWeek)}` : 'Generic';
            list += `- ${template.name} (${type})\n`;
        });
        
        alert(list);
    }

    goLive() {
        this.isLive = true;
        this.showStartTime = new Date();
        
        // Switch to ON AIR tab
        this.switchTab('onair');
        
        showNotification('Show is LIVE! Switched to ON AIR mode.', 'success');
    }
    
    updateShowStartTime() {
        const showStartInput = safeGetElement('show-start-time');
        if (!showStartInput || !showStartInput.value) return;
        
        const [hours, minutes] = showStartInput.value.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(hours, minutes, 0, 0);
        
        // Si l'heure est déjà passée aujourd'hui, prendre demain
        const now = new Date();
        if (startTime < now) {
            startTime.setDate(startTime.getDate() + 1);
        }
        
        this.scheduledStartTime = startTime;
        
        // Mettre à jour le conducteur
        this.conductorManager.render();
        
        showNotification(`Show scheduled for ${showStartInput.value}`, 'info');
    }

    // Initialize On Air
    initializeOnAir() {
        if (!this.onAirComponent) {
            this.onAirComponent = new OnAir();
            this.onAirComponent.init({
                conductorManager: this.conductorManager,
                newsManager: this.newsManager,
                animationManager: this.animationManager,
                audioManager: this.audioManager
            });
        }
        this.onAirComponent.refresh();
        this.onAirInitialized = true;
    }
    

    // Initialize Blocks component
    initializeBlocks() {
        if (!this.blocksComponent) {
            this.blocksComponent = new Blocks();
            this.blocksComponent.init({
                blockManager: this.blockManager,
                newsManager: this.newsManager,
                animationManager: this.animationManager
            });
        }
        // Toujours rafraîchir la liste des blocks
        this.blockManager.render();
        this.blocksInitialized = true;
    }

    // Initialize Print
    initializePrint() {
        // Print initialization if needed
        this.printInitialized = true;
    }

    // Initialize Audio Editor
    async initializeAudioEditor() {
        if (!this.audioEditor) {
            this.audioEditor = new AudioEditor();
        }
        await this.audioEditor.init();
        this.audioEditorInitialized = true;
    }

    // Initialize Multitrack Editor
    async initializeMultitrack() {
        if (!this.multitrackEditor) {
            console.log('Lazy loading MultitrackEditor...');
            this.multitrackEditor = new MultitrackEditor();
        }
        if (!this.multitrackEditor.initialized) {
            await this.multitrackEditor.init();
        }
        
        // Add file input handler only once
        const fileInput = document.getElementById('multitrack-file-input');
        if (fileInput && !fileInput.hasAttribute('data-listener-attached')) {
            fileInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                for (let file of files) {
                    await this.multitrackEditor.addToLibrary(file);
                }
                e.target.value = ''; // Reset input
            });
            fileInput.setAttribute('data-listener-attached', 'true');
        }
        
        this.multitrackInitialized = true;
    }

    // Initialize Fridge
    initializeFridge() {
        if (!this.fridgeComponent) {
            this.fridgeComponent = new Fridge();
        }
        if (!this.fridgeComponent.initialized) {
            this.fridgeComponent.init({
                newsManager: this.newsManager,
                animationManager: this.animationManager,
                blockManager: this.blockManager,
                conductorManager: this.conductorManager
            });
        }
        // Notifier le changement d'onglet
        this.fridgeComponent.onTabChange('fridge');
        this.fridgeInitialized = true;
    }
    
    // Initialize Template Builder
    initializeTemplateBuilder() {
        try {
            if (window.timelineBuilder) {
                window.timelineBuilder.render();
            } else if (window.TimelineBuilder) {
                // Si l'instance n'existe pas mais la classe existe, créer l'instance
                window.timelineBuilder = new window.TimelineBuilder();
                window.timelineBuilder.render();
            } else {
                console.error('❌ TimelineBuilder not found! Make sure the script is loaded.');
            }
        } catch (error) {
            console.error('❌ Template Builder initialization failed:', error);
        }
    }

    // Print methods
    printNews() {
        const item = this.newsManager.getCurrentItem();
        if (!item) {
            showNotification('No news selected', 'error');
            return;
        }
        
        // Créer une fenêtre d'impression
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        const printDoc = printWindow.document;
        
        // Styles d'impression
        printDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${item.title} - ${new Date().toLocaleDateString('fr-FR')}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    h1 {
                        font-size: 24px;
                        margin-bottom: 10px;
                    }
                    .meta {
                        color: #666;
                        margin-bottom: 20px;
                        font-size: 14px;
                    }
                    .content {
                        font-size: 16px;
                        white-space: pre-wrap;
                    }
                    .sounds {
                        margin-top: 20px;
                        padding: 10px;
                        background: #f5f5f5;
                        border-radius: 5px;
                    }
                    .sounds h3 {
                        margin-top: 0;
                        font-size: 18px;
                    }
                    .sound-item {
                        margin: 5px 0;
                        padding: 5px;
                        background: white;
                        border-radius: 3px;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h1>${sanitizeHTML(item.title)}</h1>
                <div class="meta">
                    <strong>Catégorie:</strong> ${item.category} | 
                    <strong>Durée:</strong> ${item.duration} | 
                    <strong>Auteur:</strong> ${sanitizeHTML(item.author)} | 
                    <strong>Statut:</strong> ${item.status} | 
                    <strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}
                </div>
                <div class="content">${sanitizeHTML(item.content)
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/__(.*?)__/g, '<u>$1</u>')
                    .replace(/\n/g, '<br>')}</div>
        `);
        
        // Ajouter les sons s'il y en a
        if (item.sounds && item.sounds.length > 0) {
            printDoc.write(`
                <div class="sounds">
                    <h3>Éléments sonores (${item.sounds.length})</h3>
            `);
            
            item.sounds.forEach(sound => {
                printDoc.write(`
                    <div class="sound-item">
                        <strong>${sanitizeHTML(sound.name)}</strong> - 
                        ${sound.type} - 
                        ${sound.duration}
                        ${sound.description ? `<br><em>${sanitizeHTML(sound.description)}</em>` : ''}
                    </div>
                `);
            });
            
            printDoc.write('</div>');
        }
        
        // Notes si présentes
        if (item.notes) {
            printDoc.write(`
                <div style="margin-top: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <strong>Notes:</strong><br>
                    ${sanitizeHTML(item.notes).replace(/\n/g, '<br>')}
                </div>
            `);
        }
        
        printDoc.write(`
            </body>
            </html>
        `);
        
        printDoc.close();
        
        // Lancer l'impression après un court délai
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
    
    generateConductorTable() {
        // Implementation for conductor table generation
        const container = safeGetElement('conductor-table-container');
        if (!container) return;
        
        const printData = this.conductorManager.generatePrintData();
        // Generate HTML table from printData
        
        showNotification('Conductor table generated', 'success');
    }

    printConductor() {
        this.generateConductorTable();
        setTimeout(() => {
            window.print();
        }, 100);
    }

    exportConductorPDF() {
        this.generateConductorTable();
        setTimeout(() => {
            window.print();
        }, 100);
    }

    // Gérer les conducteurs (afficher modal)
    manageConductors() {
        console.log('🎛️ Ouverture du gestionnaire de conducteurs');
        // Pour l'instant, afficher simplement une alerte
        alert('Gestionnaire de conducteurs - Fonctionnalité en développement\n\nVous pouvez:\n- Créer un nouveau conducteur avec le bouton "+ Nouveau"\n- Changer de conducteur via le menu déroulant\n- Supprimer des éléments du conducteur actif');
    }
    
    // Afficher le modal de nouveau conducteur
    showNewConductorModal() {
        console.log('📝 Ouverture du modal nouveau conducteur');
        const name = prompt('Nom du nouveau conducteur:');
        if (name && name.trim()) {
            // Créer un nouveau conducteur vide
            this.conductorManager.segments = [];
            this.conductorManager.render();
            showNotification(`✅ Nouveau conducteur "${name}" créé`, 'success');
        }
    }
    
    exportConductor() {
        // Export conductor data for Action de Grace
        const exportData = this.conductorManager.exportForActionDeGrace();
        
        // Create JSON file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `conductor_export_${timestamp}.json`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        showNotification('Conductor exported for Action de Grace', 'success');
    }



    // Sound file handlers
    async handleSoundFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const soundData = await this.audioManager.handleFileUpload(file);
        if (soundData) {
            safeSetValue('sound-name', file.name.replace(/\.[^/.]+$/, ""));
            safeSetValue('sound-duration', soundData.duration);
            safeGetElement('add-sound-btn').disabled = false;
            
            const waveformEl = safeGetElement('sound-waveform');
            if (waveformEl) {
                waveformEl.style.display = 'block';
                this.audioManager.generateWaveform('waveform');
            }
        }
    }

    async handleAnimationSoundFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const soundData = await this.audioManager.handleFileUpload(file);
        if (soundData) {
            safeSetValue('animation-sound-name', file.name.replace(/\.[^/.]+$/, ""));
            safeSetValue('animation-sound-duration', soundData.duration);
            safeGetElement('add-animation-sound-btn').disabled = false;
            
            const waveformEl = safeGetElement('animation-sound-waveform');
            if (waveformEl) {
                waveformEl.style.display = 'block';
                this.audioManager.generateWaveform('animation-waveform');
            }
        }
    }

    // Add sound
    async addSound() {
        const soundData = await this.audioManager.handleSoundModalSubmit('news');
        if (soundData) {
            await this.newsManager.addSound(soundData);
            this.closeModal('sound-modal');
        }
    }

    async addAnimationSound() {
        const soundData = await this.audioManager.handleSoundModalSubmit('animation');
        if (soundData) {
            await this.animationManager.addSound(soundData);
            this.closeModal('animation-sound-modal');
        }
    }

    // Preview
    preview(type) {
        const manager = type === 'news' ? this.newsManager : this.animationManager;
        const item = manager.getCurrentItem();
        if (!item) return;
        
        // Create preview modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = this.getPreviewHTML(item, type);
        document.body.appendChild(modal);
    }

    getPreviewHTML(item, type) {
        // Preview implementation
        return `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>${type === 'news' ? 'News' : 'Animation'} Preview</h3>
                    <button class="icon-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <h2>${sanitizeHTML(item.title)}</h2>
                    <p>Duration: ${item.duration}</p>
                    <div style="margin-top: 1rem;">
                        ${item.content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        `;
    }

    // Export/Import data
    async exportData() {
        await this.storage.exportData();
    }

    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await this.storage.importData(file);
                    await this.loadData();
                    this.initializeUI();
                    showNotification('Data imported successfully!', 'success');
                } catch (error) {
                    console.error('Import error:', error);
                    showNotification('Import failed. Please check the file format.', 'error');
                }
            }
        };
        
        input.click();
    }

    clearAllConductor() {
        if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer TOUS les éléments du conducteur ?')) {
            return;
        }
        
        // Vider le tableau des segments
        this.conductorManager.clearAll();
        
        // Rafraîchir ON AIR si actif
        if (this.onAirInitialized && this.onAirComponent) {
            this.onAirComponent.refresh();
        }
        
        // Sauvegarder
        this.autoSave();
        
        showNotification('✅ Conducteur vidé', 'success');
    }

    
    // Fonction temporaire pour nettoyer les vieux conducteurs
    async cleanupOldConductors() {
        console.log('🧹 Nettoyage des anciens conducteurs...');
        if (this.storage && this.storage.db) {
            try {
                // Récupérer tous les conducteurs
                const allConductors = await this.storage.db.scanTable('conductors');
                console.log(`🧹 Nettoyage: Trouvé ${allConductors.length} conducteurs dans la base`);
                
                if (allConductors.length > 0) {
                    console.log('🔍 Détail des conducteurs à supprimer:', allConductors.map(c => ({
                        id: c.id,
                        createdAt: new Date(c.createdAt).toLocaleString('fr-FR'),
                        segments: c.segments ? c.segments.length : 0,
                        userId: c.userId
                    })));
                }
                
                // Supprimer tous les conducteurs existants
                for (const conductor of allConductors) {
                    await this.storage.deleteItem('conductors', conductor.id, conductor.createdAt);
                    console.log(`🗑️ Supprimé conducteur ${conductor.id} (${conductor.segments ? conductor.segments.length : 0} segments)`);
                }
                
                // Sauvegarder le conducteur actuel
                await this.save();
                
                showNotification('✅ Anciens conducteurs nettoyés', 'success');
            } catch (error) {
                console.error('Erreur lors du nettoyage:', error);
                showNotification('❌ Erreur lors du nettoyage', 'error');
            }
        }
    }

    async clearAllData() {
        if (confirm('Reset all data? This cannot be undone.')) {
            await this.storage.clearAll();
            this.newsDatabase = [];
            this.animationDatabase = [];
            this.blocksDatabase = [];
            this.conductorSegments = [];
            this.newsManager.setDatabase([]);
            this.animationManager.setDatabase([]);
            this.blockManager.setBlocks([]);
            this.conductorManager.setSegments([]);
            this.initializeUI();
            showNotification('All data cleared', 'warning');
        }
    }

    // Block modal
    openAddItemToBlockModal() {
        const modal = safeGetElement('block-assign-modal');
        if (modal) {
            modal.classList.add('active');
            this.blockManager.updateAssignModalContent();
        }
    }


    // Block context menu
    showBlockContextMenu(event, blockId) {
        event.preventDefault();
        
        // Créer un menu contextuel
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) existingMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: #333;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 0.5rem 0;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        `;
        
        const menuItems = [
            { icon: '📰', text: 'Add News', type: 'news' },
            { icon: '🎙️', text: 'Add Animation', type: 'animation' },
            { icon: '🎵', text: 'Add Jingle', type: 'jingle' },
            { icon: '📺', text: 'Add Commercial', type: 'pub' },
            { icon: '☁️', text: 'Add Weather', type: 'meteo' },
            { icon: '📹', text: 'Add Package', type: 'package' },
            { icon: '🔴', text: 'Add Live', type: 'live' },
            { icon: '✏️', text: 'Add Custom', type: 'custom' }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.style.cssText = `
                padding: 0.5rem 1rem;
                cursor: pointer;
                color: #ccc;
                transition: all 0.2s;
            `;
            menuItem.innerHTML = `${item.icon} ${item.text}`;
            menuItem.onmouseover = () => {
                menuItem.style.backgroundColor = '#444';
                menuItem.style.color = '#fff';
            };
            menuItem.onmouseout = () => {
                menuItem.style.backgroundColor = 'transparent';
                menuItem.style.color = '#ccc';
            };
            menuItem.onclick = () => {
                menu.remove();
                // Set parent block in modal
                this.addSegmentToBlock(blockId, item.type);
            };
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Remove menu on click outside
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 100);
    }
    
    addSegmentToBlock(blockId, type) {
        // Ouvrir le modal avec le parent pré-sélectionné
        this.addSegmentModal();
        
        // Attendre que le modal soit rendu
        setTimeout(() => {
            safeSetValue('segment-type', type);
            this.updateSegmentForm();
            
            // Attendre que le formulaire soit mis à jour
            setTimeout(() => {
                const parentSelect = safeGetElement('segment-parent-id');
                if (parentSelect) {
                    parentSelect.value = blockId.toString();
                }
            }, 50);
        }, 50);
    }

    // Cleanup
    // Update block selector color based on selection
    
    // Sidebar toggle for mobile
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('expanded');
        }
    }
    
    // Fullscreen toggle
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    // Template Management Functions
    showTemplateMenu() {
        this.openModal('template-modal');
        this.loadTemplateList();
        this.updateDailyStatus();
    }
    
    loadTemplateList() {
        const container = document.getElementById('template-list-container');
        if (!container) return;
        
        const templates = this.conductorTemplateManager.templates;
        container.innerHTML = '';
        
        if (templates.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Aucun template disponible</p>';
            return;
        }
        
        templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'template-item';
            item.dataset.templateId = template.id;
            item.innerHTML = `
                <div class="template-item-info">
                    <div class="template-item-name">${template.name}</div>
                    <div class="template-item-description">${template.description}</div>
                </div>
                <div class="template-item-actions">
                    <button class="btn btn-sm" onclick="app.previewTemplate('${template.id}')">Aperçu</button>
                </div>
            `;
            item.onclick = () => this.selectTemplate(template.id);
            container.appendChild(item);
        });
        
        // Set today's date as default
        const dateInput = document.getElementById('template-target-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
    
    selectTemplate(templateId) {
        // Remove previous selection
        document.querySelectorAll('.template-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to clicked item
        const item = document.querySelector(`[data-template-id="${templateId}"]`);
        if (item) {
            item.classList.add('selected');
        }
        
        // Store selected template
        this.selectedTemplateId = templateId;
        
        // Show preview
        this.previewTemplate(templateId);
    }
    
    previewTemplate(templateId) {
        const template = this.conductorTemplateManager.templates.find(t => t.id === templateId);
        if (!template) return;
        
        const preview = document.getElementById('template-preview');
        if (!preview) return;
        
        let html = '<h5>Aperçu du template :</h5>';
        template.segments.forEach(segment => {
            const typeClass = segment.contentType === 'block-container' ? 'block-container' : segment.contentType;
            const typeLabel = {
                'daily': '📅 Quotidien',
                'recurring': '🔄 Récurrent (réutilisé)',
                'recurring-duplicate': '📝 Récurrent (dupliqué)',
                'permanent': '📌 Permanent',
                'dynamic': '⚡ Dynamique',
                'block-container': '📦 Bloc vide'
            }[segment.contentType] || segment.contentType;
            
            let description = '';
            if (segment.contentType === 'block-container' && segment.contentFilter) {
                description = `<br><small style="color: ${segment.contentFilter.color}">
                    ${segment.contentFilter.description || 'À remplir avec les sujets du jour'}
                </small>`;
            }
            
            html += `
                <div class="preview-segment ${typeClass}">
                    <strong>${segment.title}</strong>
                    <span class="segment-type">${typeLabel}</span>
                    <br>
                    <small>Durée: ${segment.duration} | Position: ${segment.position}</small>
                    ${description}
                </div>
            `;
        });
        
        preview.innerHTML = html;
    }
    
    async applySelectedTemplate() {
        if (!this.selectedTemplateId) {
            showNotification('Veuillez sélectionner un template', 'warning');
            return;
        }
        
        const dateInput = document.getElementById('template-target-date');
        const targetDate = dateInput ? new Date(dateInput.value) : new Date();
        
        try {
            showNotification('Application du template en cours...', 'info');
            
            // Apply the template
            const conductor = await this.conductorTemplateManager.applyTemplate(this.selectedTemplateId, targetDate);
            
            // Count different types of segments
            let existingCount = 0;
            let newCount = 0;
            let emptyBlocks = 0;
            
            conductor.segments.forEach(segment => {
                if (segment.status === 'empty-block') {
                    emptyBlocks++;
                } else if (segment.content) {
                    if (segment.content.isDuplicate) {
                        newCount++;
                    } else {
                        existingCount++;
                    }
                }
            });
            
            // Add segments to conductor manager
            conductor.segments.forEach(segment => {
                this.conductorManager.addSegment(segment);
            });
            
            // Refresh the conductor view
            this.refreshRundown();
            
            // Detailed notification
            let message = `Template appliqué : ${conductor.name}`;
            if (existingCount > 0) message += `\n✅ ${existingCount} fiches existantes trouvées`;
            if (newCount > 0) message += `\n📝 ${newCount} nouvelles fiches créées`;
            if (emptyBlocks > 0) message += `\n📦 ${emptyBlocks} blocs vides à remplir`;
            message += `\n📊 Progression : ${conductor.completion}%`;
            
            showNotification(message, 'success');
            
            // Close modal
            this.closeModal('template-modal');
            
        } catch (error) {
            console.error('Error applying template:', error);
            showNotification('Erreur lors de l\'application du template', 'error');
        }
    }
    
    switchTemplateTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.template-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Hide all tab contents
        document.querySelectorAll('.template-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // Show selected tab
        const tabContent = document.getElementById(`template-${tab}-tab`);
        if (tabContent) {
            tabContent.style.display = 'block';
        }
        
        // Update footer button
        const applyBtn = document.getElementById('template-apply-btn');
        if (applyBtn) {
            if (tab === 'apply') {
                applyBtn.style.display = 'block';
            } else {
                applyBtn.style.display = 'none';
            }
        }
        
        // Load content for specific tabs
        if (tab === 'manage') {
            this.loadTemplateManager();
        }
    }
    
    createTemplateFromCurrent() {
        const nameInput = document.getElementById('template-name');
        const descInput = document.getElementById('template-description');
        
        if (!nameInput || !nameInput.value) {
            showNotification('Veuillez entrer un nom pour le template', 'warning');
            return;
        }
        
        const currentConductor = {
            name: 'Current Conductor',
            segments: this.conductorManager.getSegments()
        };
        
        if (currentConductor.segments.length === 0) {
            showNotification('Le conducteur actuel est vide', 'warning');
            return;
        }
        
        const template = this.conductorTemplateManager.createTemplateFromConductor(
            currentConductor,
            nameInput.value
        );
        
        if (descInput && descInput.value) {
            template.description = descInput.value;
        }
        
        showNotification(`Template "${template.name}" créé avec succès`, 'success');
        
        // Clear inputs
        nameInput.value = '';
        if (descInput) descInput.value = '';
        
        // Switch to apply tab
        this.switchTemplateTab('apply');
        this.loadTemplateList();
    }
    
    loadTemplateManager() {
        const container = document.getElementById('template-manage-list');
        if (!container) return;
        
        const templates = this.conductorTemplateManager.templates;
        container.innerHTML = '';
        
        if (templates.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Aucun template à gérer</p>';
            return;
        }
        
        templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'template-manage-item';
            item.innerHTML = `
                <div class="template-manage-info">
                    <strong>${template.name}</strong><br>
                    <small>${template.description}</small><br>
                    <small>${template.segments.length} segments</small>
                </div>
                <div class="template-manage-actions">
                    <button class="btn btn-sm" onclick="app.editTemplate('${template.id}')">Modifier</button>
                    <button class="btn btn-sm btn-template danger" onclick="app.deleteTemplate('${template.id}')">Supprimer</button>
                </div>
            `;
            container.appendChild(item);
        });
    }
    
    deleteTemplate(templateId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) return;
        
        const index = this.conductorTemplateManager.templates.findIndex(t => t.id === templateId);
        if (index !== -1) {
            this.conductorTemplateManager.templates.splice(index, 1);
            this.conductorTemplateManager.saveTemplates();
            showNotification('Template supprimé', 'success');
            this.loadTemplateManager();
        }
    }
    
    async updateDailyStatus(date = new Date()) {
        const status = await this.conductorTemplateManager.getDailyStatus(date);
        
        // Update status display
        const dateEl = document.getElementById('status-date');
        const readyEl = document.getElementById('status-ready');
        const progressEl = document.getElementById('status-progress');
        const missingEl = document.getElementById('status-missing');
        
        if (dateEl) dateEl.textContent = date.toLocaleDateString('fr-FR');
        if (readyEl) readyEl.textContent = `${status.readySegments}/${status.totalSegments}`;
        if (progressEl) progressEl.style.width = `${status.completion}%`;
        if (missingEl) {
            if (status.missingSegments.length > 0) {
                missingEl.innerHTML = status.missingSegments.join('<br>');
            } else {
                missingEl.textContent = 'Aucun';
            }
        }
    }
    
    cleanup() {
        // Save before exit
        this.save();
        
        // Clear intervals
        if (this.clockInterval) clearInterval(this.clockInterval);
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        if (this.autoBackupInterval) clearInterval(this.autoBackupInterval);
        if (this.autoArchiveInterval) clearInterval(this.autoArchiveInterval);
    }
    
    // Démarrer l'archivage automatique des news à J+1
    startAutoArchiving() {
        console.log('🗂️ Démarrage de l\'archivage automatique des news...');
        
        // Exécuter immédiatement
        this.archiveOldNews();
        
        // Puis toutes les heures
        this.autoArchiveInterval = setInterval(() => {
            this.archiveOldNews();
        }, 3600000); // 1 heure
    }
    
    // Archiver les news dont la scheduledDate est passée de plus de 24h
    async archiveOldNews() {
        try {
            console.log('🔄 Vérification des news à archiver...');
            
            if (!this.newsManager || !this.newsDatabase) return;
            
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            let archivedCount = 0;
            
            // Parcourir toutes les news
            const newsToArchive = this.allNewsDatabase || this.newsDatabase || [];
            
            for (const news of newsToArchive) {
                // Vérifier si la news a une scheduledDate
                if (news.scheduledDate) {
                    const scheduledDate = new Date(news.scheduledDate);
                    
                    // Si la scheduledDate est passée de plus de 24h
                    if (scheduledDate < yesterday && news.status !== 'archived') {
                        console.log(`📦 Archivage de la news "${news.title}" (scheduledDate: ${news.scheduledDate})`);
                        
                        // Marquer comme archivée
                        news.status = 'archived';
                        news.archivedAt = new Date().toISOString();
                        
                        // Sauvegarder via DynamoDB
                        if (this.storage && this.storage.saveItem) {
                            await this.storage.saveItem('news', news);
                        }
                        
                        archivedCount++;
                    }
                }
            }
            
            if (archivedCount > 0) {
                console.log(`✅ ${archivedCount} news archivée(s)`);
                // Rafraîchir l'affichage
                await this.loadData();
            } else {
                console.log('ℹ️ Aucune news à archiver');
            }
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'archivage automatique:', error);
        }
    }
    
    // Créer/mettre à jour le filtre par auteur pour les news
    updateNewsAuthorFilter() {
        const container = document.getElementById('news-author-filter-container');
        if (!container || !this.newsManager) return;
        
        // Récupérer tous les auteurs uniques depuis la database complète
        const authors = new Set();
        const newsDatabase = this.allNewsDatabase || this.newsDatabase || [];
        newsDatabase.forEach(news => {
            if (news.author && news.author.trim()) {
                authors.add(news.author.trim());
            }
        });
        
        // Créer le sélecteur
        const currentFilter = this.newsAuthorFilter || '';
        let html = `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span style="color: #888; font-size: 0.875rem;">Filtrer par:</span>
                <select id="news-author-filter" 
                        onchange="app.filterNewsByAuthor(this.value)"
                        style="padding: 0.25rem 0.5rem; background: #1a1a1a; border: 1px solid #333; 
                               border-radius: 4px; color: #fff; font-size: 0.875rem; flex: 1;">
                    <option value="">Tous les auteurs</option>
        `;
        
        // Ajouter les auteurs triés
        const sortedAuthors = Array.from(authors).sort();
        sortedAuthors.forEach(author => {
            const selected = author === currentFilter ? 'selected' : '';
            html += `<option value="${author}" ${selected}>${author}</option>`;
        });
        
        html += `</select></div>`;
        container.innerHTML = html;
    }
    
    // Filtrer les news par auteur
    filterNewsByAuthor(author) {
        this.newsAuthorFilter = author;
        
        if (!this.newsManager) return;
        
        // Récupérer toutes les news (non filtrées)
        const allNews = this.allNewsDatabase || this.newsDatabase || [];
        
        // Filtrer par auteur si nécessaire
        let filteredNews = allNews;
        if (author && author.trim()) {
            filteredNews = allNews.filter(news => news.author === author);
        }
        
        // Mettre à jour l'affichage
        this.newsManager.setDatabase(filteredNews);
        this.newsDatabase = filteredNews; // Mettre à jour la database actuelle
        console.log(`Filtrage par auteur: ${author || 'Tous'} - ${filteredNews.length} news affichées`);
    }
    
    // Créer/mettre à jour le filtre par auteur pour les animations
    updateAnimationAuthorFilter() {
        const container = document.getElementById('animation-author-filter-container');
        if (!container || !this.animationManager) return;
        
        // Récupérer tous les auteurs uniques depuis la database complète
        const authors = new Set();
        const animationDatabase = this.allAnimationDatabase || this.animationDatabase || [];
        animationDatabase.forEach(animation => {
            if (animation.author && animation.author.trim()) {
                authors.add(animation.author.trim());
            }
        });
        
        // Créer le sélecteur
        const currentFilter = this.animationAuthorFilter || '';
        let html = `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span style="color: #888; font-size: 0.875rem;">Filtrer par:</span>
                <select id="animation-author-filter" 
                        onchange="app.filterAnimationsByAuthor(this.value)"
                        style="padding: 0.25rem 0.5rem; background: #1a1a1a; border: 1px solid #333; 
                               border-radius: 4px; color: #fff; font-size: 0.875rem; flex: 1;">
                    <option value="">Tous les auteurs</option>
        `;
        
        // Ajouter les auteurs triés
        const sortedAuthors = Array.from(authors).sort();
        sortedAuthors.forEach(author => {
            const selected = author === currentFilter ? 'selected' : '';
            html += `<option value="${author}" ${selected}>${author}</option>`;
        });
        
        html += `</select></div>`;
        container.innerHTML = html;
    }
    
    // Filtrer les animations par auteur
    filterAnimationsByAuthor(author) {
        this.animationAuthorFilter = author;
        
        if (!this.animationManager) return;
        
        // Récupérer toutes les animations (non filtrées)
        const allAnimations = this.allAnimationDatabase || this.animationDatabase || [];
        
        // Filtrer par auteur si nécessaire
        let filteredAnimations = allAnimations;
        if (author && author.trim()) {
            filteredAnimations = allAnimations.filter(animation => animation.author === author);
        }
        
        // Mettre à jour l'affichage
        this.animationManager.setDatabase(filteredAnimations);
        this.animationDatabase = filteredAnimations; // Mettre à jour la database actuelle
        console.log(`Filtrage animations par auteur: ${author || 'Tous'} - ${filteredAnimations.length} animations affichées`);
    }
    
    // Callback pour les mises à jour de la base de données (DynamoDB)
    onDatabaseUpdate(type, data) {
        // Log uniquement pour le debug des conducteurs
        if (type === 'conductors') {
            console.log(`📊 Database update for ${type}:`, data.length, 'items');
        }
        
        // Rafraîchir l'affichage selon le type
        switch(type) {
            case 'news':
                if (this.newsManager) {
                    // Stocker la database complète
                    this.allNewsDatabase = [...data];
                    this.newsDatabase = [...data];
                    
                    // Appliquer le filtre actuel si défini
                    if (this.newsAuthorFilter) {
                        const filtered = data.filter(news => news.author === this.newsAuthorFilter);
                        this.newsManager.setDatabase(filtered);
                        this.newsDatabase = filtered;
                    } else {
                        this.newsManager.refreshList();
                    }
                    
                    // Mettre à jour le filtre par auteur
                    this.updateNewsAuthorFilter();
                }
                break;
            case 'animations':
                if (this.animationManager) {
                    // Stocker la database complète
                    this.allAnimationDatabase = [...data];
                    this.animationDatabase = [...data];
                    
                    // Appliquer le filtre actuel si défini
                    if (this.animationAuthorFilter) {
                        const filtered = data.filter(animation => animation.author === this.animationAuthorFilter);
                        this.animationManager.setDatabase(filtered);
                        this.animationDatabase = filtered;
                    } else {
                        this.animationManager.refreshList();
                    }
                    
                    // Mettre à jour le filtre par auteur
                    this.updateAnimationAuthorFilter();
                }
                break;
            case 'blocks':
                if (this.blockManager) {
                    this.blockManager.setBlocks(data);
                    this.blockManager.render();
                }
                break;
            case 'conductors':
                if (this.conductorManager) {
                    // Ne mettre à jour que si les segments ont vraiment changé
                    const currentSegments = this.conductorManager.getSegments();
                    const newSegments = (data && data.length > 0 && data[0].segments) ? data[0].segments : [];
                    
                    // Comparer le nombre de segments et éviter les mises à jour inutiles
                    if (currentSegments.length !== newSegments.length || 
                        JSON.stringify(currentSegments.map(s => s.id)) !== JSON.stringify(newSegments.map(s => s.id))) {
                        // Marquer qu'on est en train de charger pour éviter de déclencher autoSave
                        this.isLoadingData = true;
                        
                        if (newSegments.length > 0) {
                            this.conductorManager.setSegments(newSegments);
                        } else {
                            this.conductorManager.setSegments([]);
                        }
                        
                        // Réactiver après un court délai
                        setTimeout(() => {
                            this.isLoadingData = false;
                        }, 100);
                    }
                    this.conductorManager.render();
                }
                break;
                
        }
    }

    // Fonctions pour le sélecteur de blocks avec cases à cocher
    toggleBlockSelector(prefix) {
        const dropdown = document.getElementById(`${prefix}block-selector-dropdown`);
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    }

    onBlockCheckboxChange(prefix) {
        // Mettre à jour le compteur
        const checkboxes = document.querySelectorAll(`#${prefix}block-selector-list input[type="checkbox"]:checked`);
        const countElement = document.getElementById(`${prefix}selected-blocks-count`);
        if (countElement) {
            countElement.textContent = checkboxes.length;
        }
    }

    // Fermer le dropdown si on clique ailleurs
    setupBlockSelectorClickOutside() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('[id$="block-selector"]')) {
                // Fermer tous les dropdowns
                document.querySelectorAll('[id$="block-selector-dropdown"]').forEach(dropdown => {
                    dropdown.style.display = 'none';
                });
            }
        });
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    console.time('App initialization');
    window.app = new SaintEspritApp();
    await window.app.init();
    console.timeEnd('App initialization');
});