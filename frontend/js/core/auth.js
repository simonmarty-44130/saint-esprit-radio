/**
 * Module d'authentification AWS Cognito
 * Gestion centralisée de l'authentification et récupération des informations utilisateur
 */

class AuthManager {
    constructor() {
        this.cognitoConfig = {
            domain: 'saint-esprit-radio-auth.auth.eu-west-3.amazoncognito.com',
            clientId: '5jst6bnhl26ekdr5a7pu9ik2f5',
            userPoolId: 'eu-west-3_oD1fm8OLs',
            redirectUri: window.location.origin + '/',
            logoutUri: window.location.origin + '/logout.html',
            region: 'eu-west-3'
        };
        
        this.currentUser = null;
        this.idToken = null;
        this.accessToken = null;
    }

    /**
     * Initialiser l'authentification
     */
    async init() {
        try {
            console.log('🔐 AuthManager init...');
            console.log('📍 URL actuelle:', window.location.href);
            console.log('🔍 Paramètres URL:', window.location.search);
            console.log('🔍 Hash:', window.location.hash);
            
            // Capturer le code depuis sessionStorage au cas où
            const savedCode = sessionStorage.getItem('auth-code');
            if (savedCode) {
                console.log('🔑 Code récupéré depuis sessionStorage');
                sessionStorage.removeItem('auth-code');
                await this.handleAuthCallback(savedCode);
                return this.currentUser;
            }
            
            // Vérifier si on revient de Cognito avec un code
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            
            // Vérifier aussi le hash au cas où
            const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
            const hashCode = hashParams.get('code');
            
            if (code || hashCode) {
                const authCode = code || hashCode;
                console.log('🔑 Code d\'authentification reçu:', authCode.substring(0, 20) + '...');
                await this.handleAuthCallback(authCode);
                // Nettoyer l'URL
                window.history.replaceState({}, document.title, window.location.pathname);
            } else {
                console.log('❌ Aucun code d\'authentification dans l\'URL');
            }
            
            // Vérifier la session existante
            const sessionValid = await this.checkSession();
            console.log('🔍 Session valide:', sessionValid, 'User:', this.currentUser);
            
            return this.currentUser;
        } catch (error) {
            console.error('Erreur initialisation auth:', error);
            // Ne pas bloquer l'application en cas d'erreur
            return null;
        }
    }

    /**
     * Gérer le callback d'authentification
     */
    async handleAuthCallback(code) {
        try {
            console.log('🔄 Échange du code contre les tokens...');
            // Échanger le code contre des tokens
            const tokenEndpoint = `https://${this.cognitoConfig.domain}/oauth2/token`;
            
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.cognitoConfig.clientId,
                code: code,
                redirect_uri: this.cognitoConfig.redirectUri
            });

            console.log('📮 Envoi de la requête à:', tokenEndpoint);
            console.log('📦 Paramètres:', params.toString());

            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            console.log('📨 Réponse reçue:', response.status);

            if (response.ok) {
                const tokens = await response.json();
                console.log('✅ Tokens reçus de Cognito:', tokens);
                await this.processTokens(tokens);
                return true;
            } else {
                const errorText = await response.text();
                console.error('❌ Erreur échange de code:', response.status, errorText);
                return false;
            }
        } catch (error) {
            console.error('Erreur callback auth:', error);
        }
    }

    /**
     * Traiter les tokens reçus
     */
    async processTokens(tokens) {
        this.idToken = tokens.id_token;
        this.accessToken = tokens.access_token;
        
        // Stocker les tokens
        localStorage.setItem('saint-esprit-id-token', this.idToken);
        localStorage.setItem('saint-esprit-access-token', this.accessToken);
        
        // Décoder le token ID pour récupérer les infos utilisateur
        const payload = this.parseJwt(this.idToken);
        
        // Debug pour voir le contenu du token
        console.log('📋 Token payload:', payload);
        
        // Récupérer toutes les infos possibles du token
        const email = payload.email || payload['cognito:username'] || payload.preferred_username || '';
        const givenName = payload.given_name || '';
        const familyName = payload.family_name || '';
        const payloadName = payload.name || '';
        
        // Construire le nom complet en priorité
        let fullName = '';
        if (payloadName) {
            fullName = payloadName;
        } else if (givenName && familyName) {
            fullName = `${givenName} ${familyName}`;
        } else if (givenName) {
            fullName = givenName;
        } else if (familyName) {
            fullName = familyName;
        } else {
            fullName = this.extractNameFromEmail(email);
        }
        
        // Cas spécial pour simon.marty
        if (payload['cognito:username'] === 'simon.marty' || email === 'simon.marty@radio-fidelite.fr' || email === 'simon.marty') {
            this.currentUser = {
                email: 'simon.marty@radio-fidelite.fr',
                name: 'Simon Marty',
                fullName: 'Simon Marty',
                groups: payload['cognito:groups'] || [],
                sub: payload.sub,
                username: 'simon.marty'
            };
        } else {
            this.currentUser = {
                email: email,
                name: fullName,
                fullName: fullName,
                groups: payload['cognito:groups'] || [],
                sub: payload.sub,
                username: payload['cognito:username'] || payload.preferred_username || email
            };
        }
        
        // Stocker les infos utilisateur IMMÉDIATEMENT
        const nameToStore = this.currentUser.fullName || this.currentUser.name || 'Reporter';
        localStorage.setItem('saint-esprit-user', nameToStore);
        localStorage.setItem('saint-esprit-user-data', JSON.stringify(this.currentUser));
        
        console.log('✅ Utilisateur connecté et stocké:', this.currentUser);
        console.log('✅ Nom stocké dans localStorage:', nameToStore);
        
        // Émettre un événement pour notifier que l'auth est prête
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('auth-ready', { detail: this.currentUser }));
        }
    }

    /**
     * Extraire le nom depuis l'email
     */
    extractNameFromEmail(email) {
        if (!email) return 'Anonyme';
        
        // Extraire la partie avant @
        const match = email.match(/^([^@]+)@?/);
        if (match) {
            const username = match[1];
            
            // Cas spécial pour simon.marty
            if (username.toLowerCase() === 'simon.marty' || username.toLowerCase() === 'simon') {
                return 'Simon Marty';
            }
            
            // Si contient un point, transformer en Prénom Nom
            if (username.includes('.')) {
                return username
                    .split('.')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                    .join(' ');
            }
            
            // Si contient un tiret
            if (username.includes('-')) {
                return username
                    .split('-')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                    .join(' ');
            }
            
            // Sinon, juste capitaliser
            return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
        }
        
        return 'Anonyme';
    }

    /**
     * Vérifier la session existante
     */
    async checkSession() {
        const idToken = localStorage.getItem('saint-esprit-id-token');
        const userData = localStorage.getItem('saint-esprit-user-data');
        
        if (idToken && userData) {
            try {
                // Vérifier si le token est encore valide
                const payload = this.parseJwt(idToken);
                const now = Math.floor(Date.now() / 1000);
                
                if (payload.exp > now) {
                    this.idToken = idToken;
                    this.accessToken = localStorage.getItem('saint-esprit-access-token');
                    this.currentUser = JSON.parse(userData);
                    
                    console.log('[Auth] Session restaurée pour:', this.currentUser.fullName || this.currentUser.name);
                    
                    // Émettre un événement pour notifier que l'auth est prête
                    if (window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('auth-ready', { detail: this.currentUser }));
                    }
                    
                    return true;
                } else {
                    // Token expiré, nettoyer sans rediriger
                    console.log('[Auth] Token expiré, nettoyage du localStorage');
                    this.clearLocalStorage();
                    return false;
                }
            } catch (error) {
                console.error('Erreur vérification session:', error);
                return false;
            }
        }
        
        console.log('[Auth] Aucune session existante trouvée');
        return false;
    }

    /**
     * Parser un JWT
     */
    parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Erreur parsing JWT:', error);
            return null;
        }
    }

    /**
     * Obtenir l'utilisateur courant
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Obtenir le nom d'auteur pour les contenus
     */
    getAuthorName() {
        // D'abord essayer currentUser
        if (this.currentUser && this.currentUser.fullName && this.currentUser.fullName !== 'Anonyme') {
            console.log('[Auth] getAuthorName depuis currentUser:', this.currentUser.fullName);
            return this.currentUser.fullName;
        }
        
        // Sinon essayer de recharger depuis localStorage
        const userData = localStorage.getItem('saint-esprit-user-data');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                if (user.fullName && user.fullName !== 'Anonyme') {
                    // Mettre à jour currentUser si nécessaire
                    if (!this.currentUser) {
                        this.currentUser = user;
                    }
                    console.log('[Auth] getAuthorName depuis localStorage:', user.fullName);
                    return user.fullName;
                }
                if (user.name && user.name !== 'Anonyme') {
                    console.log('[Auth] getAuthorName depuis localStorage (name):', user.name);
                    return user.name;
                }
            } catch (e) {
                console.error('[Auth] Erreur parsing userData:', e);
            }
        }
        
        // Fallback sur saint-esprit-user simple
        const fallbackName = localStorage.getItem('saint-esprit-user');
        if (fallbackName && fallbackName !== 'Anonyme') {
            console.log('[Auth] getAuthorName fallback localStorage:', fallbackName);
            return fallbackName;
        }
        
        console.log('[Auth] getAuthorName retourne Anonyme (aucune donnée trouvée)');
        return 'Anonyme';
    }

    /**
     * Vérifier si l'utilisateur est connecté
     */
    isAuthenticated() {
        return this.currentUser !== null && this.idToken !== null;
    }

    /**
     * Vérifier si l'utilisateur a un rôle spécifique
     */
    hasRole(role) {
        if (!this.currentUser) return false;
        return this.currentUser.groups.includes(role);
    }

    /**
     * Rediriger vers la page de connexion
     */
    login() {
        // Utiliser /login au lieu de /oauth2/authorize
        const authUrl = `https://${this.cognitoConfig.domain}/login?` +
            `client_id=${this.cognitoConfig.clientId}&` +
            `response_type=code&` +
            `scope=email+openid+profile&` +
            `redirect_uri=${encodeURIComponent(this.cognitoConfig.redirectUri)}`;
        
        console.log('🔗 Redirection vers:', authUrl);
        window.location.href = authUrl;
    }

    /**
     * Nettoyer le stockage local sans rediriger
     */
    clearLocalStorage() {
        localStorage.removeItem('saint-esprit-id-token');
        localStorage.removeItem('saint-esprit-access-token');
        localStorage.removeItem('saint-esprit-user');
        localStorage.removeItem('saint-esprit-user-data');
        
        this.currentUser = null;
        this.idToken = null;
        this.accessToken = null;
    }

    /**
     * Déconnexion
     */
    logout() {
        // Nettoyer le stockage local
        this.clearLocalStorage();
        
        // Nettoyer aussi les données d'authentification Cognito
        localStorage.removeItem('saint-esprit-authenticated');
        localStorage.removeItem('saint-esprit-auth-code');
        
        // Rediriger vers Cognito logout (logout_uri seulement, pas de redirect_uri)
        const logoutUrl = `https://${this.cognitoConfig.domain}/logout?` +
            `client_id=${this.cognitoConfig.clientId}&` +
            `logout_uri=${encodeURIComponent(this.cognitoConfig.logoutUri)}`;
        
        window.location.href = logoutUrl;
    }

    /**
     * Obtenir les headers d'authentification pour les API
     */
    getAuthHeaders() {
        if (this.idToken) {
            return {
                'Authorization': `Bearer ${this.idToken}`
            };
        }
        return {};
    }

    /**
     * Lister les utilisateurs disponibles
     * Note: Cette méthode nécessite des permissions administratives dans Cognito
     * Pour l'instant, retourne une liste statique des utilisateurs connus
     */
    async listUsers() {
        try {
            // Dans un environnement de production, ceci ferait un appel à l'API Admin de Cognito
            // Pour l'instant, retourner les utilisateurs connus de Radio Fidélité
            const knownUsers = [
                { 
                    username: 'simon.marty',
                    email: 'simon.marty@radio-fidelite.fr',
                    name: 'Simon Marty',
                    status: 'CONFIRMED'
                },
                { 
                    username: 'tiphaine.sellier',
                    email: 'tiphaine.sellier@radio-fidelite.fr',
                    name: 'Tiphaine Sellier',
                    status: 'CONFIRMED'
                },
                { 
                    username: 'clara.bert',
                    email: 'clara.bert@radio-fidelite.fr',
                    name: 'Clara Bert',
                    status: 'CONFIRMED'
                },
                { 
                    username: 'morgane.poirier',
                    email: 'morgane.poirier@radio-fidelite.fr',
                    name: 'Morgane Poirier',
                    status: 'CONFIRMED'
                },
                { 
                    username: 'arthur.camus',
                    email: 'arthur.camus@radio-fidelite.fr',
                    name: 'Arthur Camus',
                    status: 'CONFIRMED'
                },
                { 
                    username: 'test.radio',
                    email: 'test.radio@radio-fidelite.fr',
                    name: 'Test Radio',
                    status: 'CONFIRMED'
                }
            ];
            
            // Si on a accès à UserActivity via AppSync, on pourrait récupérer les utilisateurs actifs
            if (window.realtimeSync && window.realtimeSync.getActiveUsers) {
                try {
                    const activeUsers = await window.realtimeSync.getActiveUsers();
                    // Merger avec la liste des utilisateurs connus
                    activeUsers.forEach(activeUser => {
                        if (!knownUsers.find(u => u.username === activeUser.userId)) {
                            knownUsers.push({
                                username: activeUser.userId,
                                name: activeUser.username || activeUser.userId,
                                status: 'ACTIVE',
                                lastSeen: activeUser.timestamp
                            });
                        }
                    });
                } catch (error) {
                    console.warn('Impossible de récupérer les utilisateurs actifs:', error);
                }
            }
            
            return knownUsers;
        } catch (error) {
            console.error('Erreur listUsers:', error);
            return [];
        }
    }
}

// Instance globale
window.authManager = new AuthManager();

// Fonction de test pour la connexion
window.testLogin = function() {
    // Utiliser /login qui fonctionne avec Cognito Hosted UI
    const authUrl = 'https://saint-esprit-radio-auth.auth.eu-west-3.amazoncognito.com/login?' +
        'client_id=5jst6bnhl26ekdr5a7pu9ik2f5&' +
        'response_type=code&' +
        'scope=email+openid+profile&' +
        'redirect_uri=' + encodeURIComponent(window.location.origin + '/');
    
    console.log('🔗 Test de connexion avec /login:', authUrl);
    window.location.href = authUrl;
};