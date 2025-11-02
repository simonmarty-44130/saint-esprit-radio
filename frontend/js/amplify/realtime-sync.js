/**
 * Synchronisation temps réel via AWS Amplify Gen 2
 * Remplace l'ancien SyncManager par des subscriptions GraphQL natives
 */

// Note: Ce module nécessite AWS Amplify configuré dans l'application
// Pour l'instant, il est désactivé car l'import de modules ES6 ne fonctionne pas

class RealtimeSync {
    constructor() {
        this.client = null;
        this.subscriptions = new Map();
        this.callbacks = new Map();
        this.isInitialized = false;
        this.currentUser = null;
    }

    /**
     * Initialiser la synchronisation temps réel
     */
    async init() {
        try {
            console.log('🚀 Initialisation de la synchronisation temps réel AWS...');
            
            // Générer le client GraphQL
            // Note: Désactivé car nécessite l'import ES6
            // this.client = generateClient();
            console.warn('⚠️ RealtimeSync désactivé - nécessite configuration Amplify');
            return;
            
            // Récupérer l'utilisateur courant depuis l'authentification
            this.currentUser = window.authManager?.getAuthorName() || localStorage.getItem('saint-esprit-user') || 'anonymous';
            
            // Activer toutes les subscriptions
            await this.setupAllSubscriptions();
            
            // Signaler l'activité de l'utilisateur
            await this.signalUserOnline();
            
            this.isInitialized = true;
            console.log('✅ Synchronisation temps réel activée !');
            
        } catch (error) {
            console.error('❌ Erreur initialisation sync temps réel:', error);
            throw error;
        }
    }

    /**
     * Configurer toutes les subscriptions
     */
    async setupAllSubscriptions() {
        // News subscriptions
        this.subscribeToModel('News', {
            onCreate: (item) => this.handleCreate('News', item),
            onUpdate: (item) => this.handleUpdate('News', item),
            onDelete: (item) => this.handleDelete('News', item)
        });

        // Animation subscriptions
        this.subscribeToModel('Animation', {
            onCreate: (item) => this.handleCreate('Animation', item),
            onUpdate: (item) => this.handleUpdate('Animation', item),
            onDelete: (item) => this.handleDelete('Animation', item)
        });

        // Block subscriptions
        this.subscribeToModel('Block', {
            onCreate: (item) => this.handleCreate('Block', item),
            onUpdate: (item) => this.handleUpdate('Block', item),
            onDelete: (item) => this.handleDelete('Block', item)
        });

        // Conductor subscriptions
        this.subscribeToModel('Conductor', {
            onCreate: (item) => this.handleCreate('Conductor', item),
            onUpdate: (item) => this.handleUpdate('Conductor', item),
            onDelete: (item) => this.handleDelete('Conductor', item)
        });

        // UserActivity subscriptions pour voir qui est en ligne
        this.subscribeToModel('UserActivity', {
            onCreate: (activity) => this.handleUserActivity(activity),
            onUpdate: (activity) => this.handleUserActivity(activity)
        });
    }

    /**
     * S'abonner aux changements d'un modèle
     */
    subscribeToModel(modelName, handlers) {
        try {
            const model = this.client.models[modelName];
            if (!model) {
                console.error(`❌ Modèle ${modelName} non trouvé`);
                return;
            }

            // onCreate subscription
            if (handlers.onCreate && model.onCreate) {
                const createSub = model.onCreate().subscribe({
                    next: (data) => {
                        console.log(`📥 [${modelName}] Nouvel élément créé:`, data);
                        handlers.onCreate(data);
                    },
                    error: (err) => console.error(`❌ Erreur subscription onCreate ${modelName}:`, err)
                });
                this.subscriptions.set(`${modelName}_create`, createSub);
            }

            // onUpdate subscription
            if (handlers.onUpdate && model.onUpdate) {
                const updateSub = model.onUpdate().subscribe({
                    next: (data) => {
                        console.log(`✏️ [${modelName}] Élément mis à jour:`, data);
                        handlers.onUpdate(data);
                    },
                    error: (err) => console.error(`❌ Erreur subscription onUpdate ${modelName}:`, err)
                });
                this.subscriptions.set(`${modelName}_update`, updateSub);
            }

            // onDelete subscription
            if (handlers.onDelete && model.onDelete) {
                const deleteSub = model.onDelete().subscribe({
                    next: (data) => {
                        console.log(`🗑️ [${modelName}] Élément supprimé:`, data);
                        handlers.onDelete(data);
                    },
                    error: (err) => console.error(`❌ Erreur subscription onDelete ${modelName}:`, err)
                });
                this.subscriptions.set(`${modelName}_delete`, deleteSub);
            }

            console.log(`✅ Subscriptions activées pour ${modelName}`);
            
        } catch (error) {
            console.error(`❌ Erreur setup subscriptions ${modelName}:`, error);
        }
    }

    /**
     * Gérer la création d'un élément
     */
    handleCreate(modelName, item) {
        // Ne pas traiter nos propres modifications
        if (item.lastModifiedBy === this.currentUser) {
            return;
        }

        // Appeler les callbacks enregistrés
        const callbacks = this.callbacks.get(`${modelName}_create`) || [];
        callbacks.forEach(cb => cb(item));

        // Mettre à jour l'interface si nécessaire
        this.updateUI(modelName, 'create', item);

        // Afficher une notification
        this.showNotification(`Nouveau ${modelName} ajouté par ${item.author || 'un utilisateur'}`);
    }

    /**
     * Gérer la mise à jour d'un élément
     */
    handleUpdate(modelName, item) {
        // Ne pas traiter nos propres modifications
        if (item.lastModifiedBy === this.currentUser) {
            return;
        }

        // Appeler les callbacks enregistrés
        const callbacks = this.callbacks.get(`${modelName}_update`) || [];
        callbacks.forEach(cb => cb(item));

        // Mettre à jour l'interface
        this.updateUI(modelName, 'update', item);

        // Notification discrète
        console.log(`🔄 ${modelName} mis à jour par ${item.lastModifiedBy}`);
    }

    /**
     * Gérer la suppression d'un élément
     */
    handleDelete(modelName, item) {
        // Ne pas traiter nos propres suppressions
        if (item.lastModifiedBy === this.currentUser) {
            return;
        }

        // Appeler les callbacks enregistrés
        const callbacks = this.callbacks.get(`${modelName}_delete`) || [];
        callbacks.forEach(cb => cb(item));

        // Mettre à jour l'interface
        this.updateUI(modelName, 'delete', item);

        // Afficher une notification
        this.showNotification(`${modelName} supprimé par ${item.lastModifiedBy || 'un utilisateur'}`);
    }

    /**
     * Gérer l'activité des utilisateurs
     */
    handleUserActivity(activity) {
        if (activity.userId === this.currentUser) {
            return;
        }

        // Mettre à jour l'indicateur d'utilisateurs en ligne
        this.updateOnlineUsers(activity);

        // Si un utilisateur édite quelque chose, afficher un indicateur
        if (activity.action === 'editing' && activity.itemId) {
            this.showEditingIndicator(activity);
        }
    }

    /**
     * Mettre à jour l'interface utilisateur
     */
    updateUI(modelName, action, item) {
        // Mise à jour selon le modèle et l'action
        switch (modelName) {
            case 'News':
                if (window.app?.newsManager) {
                    if (action === 'create' || action === 'update') {
                        // Ajouter ou mettre à jour dans la base locale
                        const index = window.app.newsManager.database.findIndex(n => n.id === item.id);
                        if (index >= 0) {
                            window.app.newsManager.database[index] = item;
                        } else {
                            window.app.newsManager.database.push(item);
                        }
                        window.app.newsManager.updateList();
                    } else if (action === 'delete') {
                        // Supprimer de la base locale
                        window.app.newsManager.database = window.app.newsManager.database.filter(n => n.id !== item.id);
                        window.app.newsManager.updateList();
                    }
                }
                break;

            case 'Animation':
                if (window.app?.animationManager) {
                    if (action === 'create' || action === 'update') {
                        const index = window.app.animationManager.database.findIndex(a => a.id === item.id);
                        if (index >= 0) {
                            window.app.animationManager.database[index] = item;
                        } else {
                            window.app.animationManager.database.push(item);
                        }
                        window.app.animationManager.updateList();
                    } else if (action === 'delete') {
                        window.app.animationManager.database = window.app.animationManager.database.filter(a => a.id !== item.id);
                        window.app.animationManager.updateList();
                    }
                }
                break;

            case 'Block':
                if (window.app?.blockManager) {
                    if (action === 'create' || action === 'update') {
                        const index = window.app.blockManager.blocks.findIndex(b => b.id === item.id);
                        if (index >= 0) {
                            window.app.blockManager.blocks[index] = item;
                        } else {
                            window.app.blockManager.blocks.push(item);
                        }
                        window.app.blockManager.updateList();
                    } else if (action === 'delete') {
                        window.app.blockManager.blocks = window.app.blockManager.blocks.filter(b => b.id !== item.id);
                        window.app.blockManager.updateList();
                    }
                }
                break;

            case 'Conductor':
                if (window.app?.conductorManager) {
                    if (action === 'create' || action === 'update') {
                        // Recharger le conducteur si c'est celui affiché
                        if (window.app.conductorManager.currentDate === item.date) {
                            window.app.conductorManager.segments = item.segments;
                            window.app.conductorManager.renderConductor();
                        }
                    }
                }
                break;
        }
    }

    /**
     * Enregistrer un callback pour un événement
     */
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
    }

    /**
     * Signaler que l'utilisateur est en ligne
     */
    async signalUserOnline() {
        try {
            await this.client.models.UserActivity.create({
                userId: this.currentUser,
                username: this.currentUser,
                action: 'online',
                timestamp: new Date().toISOString()
            });

            // Rafraîchir périodiquement
            setInterval(() => {
                this.client.models.UserActivity.create({
                    userId: this.currentUser,
                    username: this.currentUser,
                    action: 'online',
                    timestamp: new Date().toISOString()
                });
            }, 60000); // Toutes les minutes

        } catch (error) {
            console.error('❌ Erreur signal online:', error);
        }
    }

    /**
     * Signaler qu'on édite un élément
     */
    async signalEditing(itemType, itemId) {
        try {
            await this.client.models.UserActivity.create({
                userId: this.currentUser,
                username: this.currentUser,
                action: 'editing',
                itemType: itemType,
                itemId: itemId,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Erreur signal editing:', error);
        }
    }

    /**
     * Afficher une notification
     */
    showNotification(message) {
        // Créer une notification discrète
        const notification = document.createElement('div');
        notification.className = 'realtime-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
                max-width: 300px;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">🔄</span>
                    <span style="font-size: 14px;">${message}</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Retirer après 3 secondes
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    /**
     * Mettre à jour la liste des utilisateurs en ligne
     */
    updateOnlineUsers(activity) {
        // Implémenter l'affichage des utilisateurs en ligne
        console.log(`👤 ${activity.username} est ${activity.action}`);
    }

    /**
     * Afficher un indicateur d'édition
     */
    showEditingIndicator(activity) {
        console.log(`✏️ ${activity.username} édite ${activity.itemType} #${activity.itemId}`);
        // TODO: Ajouter un indicateur visuel sur l'élément en cours d'édition
    }

    /**
     * Nettoyer les subscriptions
     */
    destroy() {
        // Signaler qu'on se déconnecte
        if (this.currentUser) {
            this.client.models.UserActivity.create({
                userId: this.currentUser,
                username: this.currentUser,
                action: 'offline',
                timestamp: new Date().toISOString()
            });
        }

        // Désabonner toutes les subscriptions
        this.subscriptions.forEach(sub => {
            if (sub && sub.unsubscribe) {
                sub.unsubscribe();
            }
        });
        this.subscriptions.clear();
        this.callbacks.clear();
        
        console.log('🔌 Synchronisation temps réel désactivée');
    }
}

// Créer une instance globale
window.realtimeSync = new RealtimeSync();