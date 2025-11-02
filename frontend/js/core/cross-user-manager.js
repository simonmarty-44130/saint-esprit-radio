/**
 * Gestionnaire pour voir les bibliothèques des autres utilisateurs
 * Permet de parcourir et importer les news/animations des collègues
 */

class CrossUserManager {
    constructor(storage) {
        this.storage = storage;
        this.currentViewingUser = null;
        this.cachedUserData = {};
    }

    /**
     * Lister tous les utilisateurs disponibles
     * Récupère dynamiquement les utilisateurs depuis Cognito
     */
    async listAvailableUsers() {
        try {
            console.log('🔍 Chargement des utilisateurs depuis Cognito...');
            
            let availableUsers = [];
            
            // Essayer de récupérer les utilisateurs depuis Cognito si disponible
            if (window.authManager && typeof window.authManager.listUsers === 'function') {
                try {
                    const cognitoUsers = await window.authManager.listUsers();
                    availableUsers = cognitoUsers
                        .map(user => user.name || user.email?.split('@')[0] || user.username)
                        .filter(name => name && name.toLowerCase() !== this.storage.userId.toLowerCase());
                } catch (cognitoError) {
                    console.warn('⚠️ Impossible de récupérer les utilisateurs depuis Cognito:', cognitoError);
                }
            }
            
            // Si pas d'utilisateurs Cognito, utiliser la liste de secours
            if (availableUsers.length === 0) {
                console.log('📋 Utilisation de la liste de secours');
                const fallbackUsers = [
                    'Tiphaine Sellier',
                    'Clara Bert',
                    'Morgane Poirier', 
                    'Arthur Camus',
                    'Test Radio'
                ];
                
                availableUsers = fallbackUsers.filter(user => 
                    user.toLowerCase() !== this.storage.userId.toLowerCase()
                );
            }
            
            console.log(`✅ ${availableUsers.length} utilisateurs disponibles:`, availableUsers);
            return availableUsers;
        } catch (error) {
            console.error('❌ Erreur lors du chargement des utilisateurs:', error);
            return [];
        }
    }

    /**
     * Charger les données d'un autre utilisateur
     */
    async loadUserData(userId) {
        // Normaliser l'ID utilisateur de la même façon que Storage.js
        // Minuscules et enlever tous les caractères sauf lettres et chiffres
        const normalizedUserId = userId.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        try {
            // Vérifier le cache
            if (this.cachedUserData[userId] && 
                Date.now() - this.cachedUserData[userId].timestamp < 60000) {
                console.log(`📦 Utilisation du cache pour ${userId}`);
                return this.cachedUserData[userId].data;
            }
            
            console.log(`📥 Chargement des données de ${userId}...`);
            console.log(`🔄 Normalisation: "${userId}" → "${normalizedUserId}"`);
            console.log(`📂 Chemin S3: users/${normalizedUserId}/data.json`);
            
            const response = await this.storage.s3.getObject({
                Bucket: this.storage.config.bucket,
                Key: `users/${normalizedUserId}/data.json`
            }).promise();
            
            const userData = JSON.parse(response.Body.toString());
            
            // Mettre en cache
            this.cachedUserData[userId] = {
                timestamp: Date.now(),
                data: userData
            };
            
            console.log(`✅ Données de ${userId} chargées:`, {
                news: userData.news?.length || 0,
                animations: userData.animations?.length || 0,
                blocks: userData.blocks?.length || 0
            });
            
            return userData;
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                console.warn(`⚠️ Aucune donnée trouvée pour ${userId} (${normalizedUserId})`);
                console.log(`💡 L'utilisateur ${userId} n'a peut-être pas encore créé de contenu`);
                return {
                    news: [],
                    animations: [],
                    blocks: []
                };
            }
            console.error(`❌ Erreur lors du chargement des données de ${userId}:`, error);
            return null;
        }
    }

    /**
     * Obtenir les news d'un autre utilisateur
     */
    async getUserNews(userId) {
        const userData = await this.loadUserData(userId);
        return userData?.news || [];
    }

    /**
     * Obtenir les animations d'un autre utilisateur
     */
    async getUserAnimations(userId) {
        const userData = await this.loadUserData(userId);
        return userData?.animations || [];
    }

    /**
     * Obtenir les blocks/journaux d'un autre utilisateur
     */
    async getUserBlocks(userId) {
        const userData = await this.loadUserData(userId);
        return userData?.blocks || [];
    }

    /**
     * Importer une news d'un autre utilisateur
     */
    importNews(news, fromUser) {
        // Créer une copie locale
        const importedNews = {
            ...news,
            id: Date.now() + Math.random(),
            status: 'draft',
            importedFrom: fromUser,
            importedAt: new Date().toISOString(),
            originalId: news.id
        };
        
        // Nettoyer les métadonnées sensibles
        delete importedNews.lastUsed;
        delete importedNews.usageCount;
        
        console.log(`📥 News importée de ${fromUser}: ${importedNews.title}`);
        showNotification(`News "${importedNews.title}" importée de ${fromUser}`, 'success');
        
        return importedNews;
    }

    /**
     * Importer une animation d'un autre utilisateur
     */
    importAnimation(animation, fromUser) {
        const importedAnimation = {
            ...animation,
            id: Date.now() + Math.random(),
            status: 'draft',
            importedFrom: fromUser,
            importedAt: new Date().toISOString(),
            originalId: animation.id
        };
        
        delete importedAnimation.lastUsed;
        delete importedAnimation.usageCount;
        
        console.log(`📥 Animation importée de ${fromUser}: ${importedAnimation.title}`);
        showNotification(`Animation "${importedAnimation.title}" importée de ${fromUser}`, 'success');
        
        return importedAnimation;
    }

    /**
     * Créer un sélecteur d'utilisateur pour l'interface
     * @param {string} selectorId - ID unique pour le sélecteur (ex: 'news' ou 'animation')
     */
    async createUserSelector(selectorId = 'news') {
        const users = await this.listAvailableUsers();
        
        // Option par défaut pour ses propres éléments
        let options = `<option value="">👤 Mes éléments</option>`;
        
        // Ajouter un séparateur visuel si il y a d'autres utilisateurs
        if (users.length > 0) {
            options += `<option disabled>──────────</option>`;
            
            // Ajouter chaque utilisateur
            users.forEach(user => {
                options += `<option value="${user}">👥 ${user}</option>`;
            });
        }
        
        const selectId = `library-user-selector-${selectorId}`;
        const onChange = selectorId === 'animation' 
            ? `app.switchUserLibraryAnimation(this.value)` 
            : `app.switchUserLibrary(this.value)`;
        
        return `
            <div class="user-selector">
                <label>📚 Bibliothèque :</label>
                <select id="${selectId}" onchange="${onChange}">
                    ${options}
                </select>
            </div>
        `;
    }
}

// Export
window.CrossUserManager = CrossUserManager;