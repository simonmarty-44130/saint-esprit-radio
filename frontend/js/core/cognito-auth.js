/**
 * Cognito Authentication Manager
 * Gestion de l'authentification avec AWS Cognito
 */

class CognitoAuth {
    constructor() {
        // Configuration Cognito
        this.config = {
            region: 'eu-west-3',
            userPoolId: 'eu-west-3_oD1fm8OLs',
            clientId: '5jst6bnhl26ekdr5a7pu9ik2f5',
            identityPoolId: 'eu-west-3:3bffc600-c5a5-4d37-9fca-7277e64cc66d',
            domain: 'saint-esprit-radio-auth',
            redirectUri: window.location.origin + '/',
            logoutUri: window.location.origin + '/logout.html'
        };

        // Mapping des utilisateurs connus (temporaire en attendant que Cognito soit configuré)
        this.knownUsers = {
            'simon.marty@radio-fidelite.fr': 'Simon Marty',
            'tiphaine.sellier@radio-fidelite.fr': 'Tiphaine Sellier',
            'clara.bert@radio-fidelite.fr': 'Clara Bert',
            'morgane.poirier@radio-fidelite.fr': 'Morgane Poirier',
            'arthur.camus@radio-fidelite.fr': 'Arthur Camus'
        };

        // URLs Cognito
        this.cognitoUrl = `https://${this.config.domain}.auth.${this.config.region}.amazoncognito.com`;

        // État de l'authentification
        this.isAuthenticated = false;
        this.user = null;
        this.tokens = null;
        this.authReady = false;
        this.authPromise = null;

        // Initialiser au chargement
        this.init();
    }

    async init() {
        console.log('🔐 Initialisation Cognito Auth...');

        // Créer une promise pour que d'autres composants puissent attendre
        this.authPromise = (async () => {
            // Vérifier si on revient d'une redirection Cognito
            await this.handleCallback();

            // Vérifier si on a des tokens stockés
            await this.checkStoredTokens();

            this.authReady = true;
            console.log('✅ Authentification Cognito prête');
        })();

        return this.authPromise;
    }

    /**
     * Attendre que l'authentification soit prête
     */
    async waitForAuth() {
        if (this.authReady) return;
        if (this.authPromise) {
            await this.authPromise;
        }
    }
    
    /**
     * Gère le callback après authentification
     */
    async handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // Gérer les erreurs OAuth
        if (error) {
            console.error('❌ Erreur OAuth:', error);
            console.error('Description:', errorDescription);

            // Nettoyer l'URL
            window.history.replaceState({}, document.title, window.location.pathname);

            // Afficher un message à l'utilisateur
            alert(`Erreur d'authentification: ${error}\n${errorDescription || ''}`);
            return;
        }

        // Vérifier aussi le code stocké en session
        const storedCode = sessionStorage.getItem('auth-code');

        if (code) {
            console.log('🔑 Code d\'autorisation détecté dans l\'URL');

            // Stocker le code en session pour éviter de le perdre lors d'un refresh
            sessionStorage.setItem('auth-code', code);

            // S'assurer qu'on n'a pas déjà des tokens valides
            const existingToken = localStorage.getItem('cognito_id_token');
            if (!existingToken) {
                await this.exchangeCodeForTokens(code);
                // Nettoyer le code stocké après utilisation
                sessionStorage.removeItem('auth-code');
            } else {
                console.log('✅ Tokens déjà présents, skip exchange');
                // Nettoyer l'URL
                window.history.replaceState({}, document.title, window.location.pathname);
                sessionStorage.removeItem('auth-code');
            }
        } else if (storedCode) {
            console.log('🔑 Code d\'autorisation trouvé en session');

            // S'assurer qu'on n'a pas déjà des tokens valides
            const existingToken = localStorage.getItem('cognito_id_token');
            if (!existingToken) {
                await this.exchangeCodeForTokens(storedCode);
                // Nettoyer le code stocké après utilisation
                sessionStorage.removeItem('auth-code');
            }
        }
    }
    
    /**
     * Échange le code d'autorisation contre des tokens
     */
    async exchangeCodeForTokens(code) {
        const tokenUrl = `${this.cognitoUrl}/oauth2/token`;
        
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            code: code,
            redirect_uri: this.config.redirectUri
        });
        
        console.log('📤 Envoi de la requête d\'échange de code...');
        
        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Tokens reçus avec succès');
                
                this.storeTokens(data);
                await this.parseIdToken(data.id_token);
                
                // Récupérer les infos utilisateur complètes via l'API UserInfo
                await this.fetchUserInfo(data.access_token);
                
                // Attendre un peu pour s'assurer que tout est bien sauvegardé
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Nettoyer l'URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Recharger l'application avec l'utilisateur authentifié
                console.log('🔄 Rechargement de l\'application...');
                window.location.reload();
            } else {
                const errorText = await response.text();
                console.error('❌ Erreur lors de l\'échange du code:', errorText);
                console.error('Status:', response.status);
                
                // Si le code est invalide ou expiré, le nettoyer
                if (response.status === 400) {
                    sessionStorage.removeItem('auth-code');
                    console.log('Code invalide/expiré, nettoyage effectué');
                }
            }
        } catch (error) {
            console.error('❌ Erreur réseau lors de l\'échange du code:', error);
        }
    }
    
    /**
     * Stocke les tokens dans localStorage
     */
    storeTokens(tokens) {
        localStorage.setItem('cognito_id_token', tokens.id_token);
        localStorage.setItem('cognito_access_token', tokens.access_token);
        localStorage.setItem('cognito_refresh_token', tokens.refresh_token);
        localStorage.setItem('saint-esprit-authenticated', 'true');
        
        this.tokens = tokens;
        this.isAuthenticated = true;
        
        console.log('✅ Tokens stockés avec succès');
    }
    
    /**
     * Récupère les informations utilisateur via l'API UserInfo
     */
    configureAWSCredentials(idToken) {
        try {
            // Configuration des credentials AWS avec Cognito
            const logins = {};
            logins[`cognito-idp.${this.config.region}.amazonaws.com/${this.config.userPoolId}`] = idToken;
            
            window.AWS.config.region = this.config.region;
            window.AWS.config.credentials = new window.AWS.CognitoIdentityCredentials({
                IdentityPoolId: this.config.identityPoolId,
                Logins: logins
            });
            
            // Rafraîchir les credentials
            window.AWS.config.credentials.refresh((error) => {
                if (error) {
                    console.error('❌ Erreur refresh AWS credentials:', error);
                } else {
                    console.log('✅ AWS Credentials configurés avec Cognito');
                }
            });
        } catch (error) {
            console.error('❌ Erreur configuration AWS credentials:', error);
        }
    }
    
    async fetchUserInfo(accessToken) {
        const userInfoUrl = `${this.cognitoUrl}/oauth2/userInfo`;
        
        try {
            const response = await fetch(userInfoUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (response.ok) {
                const userInfo = await response.json();
                console.log('👥 UserInfo récupérée:', userInfo);
                
                // Construire le nom complet
                let fullName = userInfo.name;
                if (!fullName && (userInfo.given_name || userInfo.family_name)) {
                    fullName = `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim();
                }
                
                // Si toujours pas de nom, utiliser le mapping des utilisateurs connus
                if (!fullName || fullName === userInfo.username) {
                    const email = userInfo.email || this.user?.email;
                    if (email && this.knownUsers[email]) {
                        fullName = this.knownUsers[email];
                        console.log('📝 Nom récupéré depuis le mapping:', fullName);
                    }
                }
                
                // Mettre à jour les infos utilisateur avec les données complètes
                if (fullName && fullName !== userInfo.username) {
                    this.user.name = fullName;
                    
                    // Extraire prénom et nom si possible
                    const nameParts = fullName.split(' ');
                    if (nameParts.length >= 2) {
                        this.user.firstName = nameParts[0];
                        this.user.lastName = nameParts.slice(1).join(' ');
                    }
                    
                    // Mettre à jour le localStorage avec le vrai nom
                    localStorage.setItem('saint-esprit-user-name', fullName);
                    localStorage.setItem('saint-esprit-user-fullname', fullName);
                    
                    // Utiliser le nom complet comme identifiant principal
                    localStorage.setItem('saint-esprit-user', fullName);
                    
                    console.log('✅ Nom utilisateur mis à jour:', fullName);
                } else {
                    console.warn('⚠️ Impossible de déterminer le nom complet de l\'utilisateur');
                }
                
                return userInfo;
            } else {
                console.warn('Impossible de récupérer UserInfo:', response.status);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération UserInfo:', error);
        }
        
        return null;
    }
    
    /**
     * Parse le JWT ID token pour extraire les infos utilisateur
     */
    async parseIdToken(idToken) {
        try {
            const payload = idToken.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            
            console.log('📋 Token décodé:', decoded);
            
            // Construire le nom complet à partir des attributs disponibles
            let fullName = decoded.name;
            if (!fullName && (decoded.given_name || decoded.family_name)) {
                fullName = `${decoded.given_name || ''} ${decoded.family_name || ''}`.trim();
            }
            
            // Si toujours pas de nom, utiliser le mapping des utilisateurs connus
            if (!fullName && decoded.email && this.knownUsers[decoded.email]) {
                fullName = this.knownUsers[decoded.email];
                console.log('📝 Nom récupéré depuis le mapping local:', fullName);
            }
            
            this.user = {
                username: decoded['cognito:username'] || decoded.email,
                email: decoded.email,
                name: fullName || decoded['cognito:username'] || decoded.email,
                firstName: decoded.given_name,
                lastName: decoded.family_name,
                sub: decoded.sub
            };
            
            // Stocker les infos utilisateur - utiliser le nom complet, pas l'UUID
            localStorage.setItem('saint-esprit-user', fullName || this.user.name);
            localStorage.setItem('saint-esprit-user-email', this.user.email);
            localStorage.setItem('saint-esprit-user-name', this.user.name);
            
            console.log('👤 Utilisateur connecté:', this.user.name);
            console.log('📧 Email:', this.user.email);
            
            // Si on a un nom complet, l'utiliser comme ID utilisateur pour charger les bonnes données
            if (fullName) {
                localStorage.setItem('saint-esprit-user-fullname', fullName);
            }
            
        } catch (error) {
            console.error('Erreur lors du parsing du token:', error);
        }
    }
    
    /**
     * Vérifie si on a des tokens stockés et valides
     */
    async checkStoredTokens() {
        const idToken = localStorage.getItem('cognito_id_token');
        const accessToken = localStorage.getItem('cognito_access_token');
        
        if (idToken && accessToken) {
            // Vérifier si le token n'est pas expiré
            try {
                const payload = JSON.parse(atob(idToken.split('.')[1]));
                const exp = payload.exp * 1000; // Convertir en millisecondes
                
                if (Date.now() < exp) {
                    await this.parseIdToken(idToken);
                    this.isAuthenticated = true;
                    
                    // Toujours essayer de récupérer les infos utilisateur complètes
                    const fullname = localStorage.getItem('saint-esprit-user-fullname');
                    if (!fullname || fullname === 'undefined' || fullname.includes('-')) {
                        console.log('🔍 Récupération des infos utilisateur complètes...');
                        await this.fetchUserInfo(accessToken);
                    }
                    
                    // Configurer les credentials AWS avec le token Cognito (optionnel)
                    // Désactivé pour l'instant car l'Identity Pool n'est pas configuré
                    // this.configureAWSCredentials(idToken);
                    
                    console.log('✅ Session valide pour:', this.user?.name);
                } else {
                    console.log('⏰ Token expiré, tentative de refresh...');
                    await this.refreshTokens();
                }
            } catch (error) {
                console.error('Token invalide:', error);
                this.clearTokens();
            }
        } else {
            console.log('❌ Aucun token trouvé - Authentification manuelle requise');
            // Ne pas rediriger automatiquement pour éviter les boucles
            this.showLoginPrompt();
        }
    }
    
    /**
     * Rafraîchit les tokens avec le refresh token
     */
    async refreshTokens() {
        const refreshToken = localStorage.getItem('cognito_refresh_token');
        if (!refreshToken) {
            console.log('Pas de refresh token disponible');
            // Ne pas rediriger automatiquement
            return;
        }
        
        const tokenUrl = `${this.cognitoUrl}/oauth2/token`;
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.config.clientId,
            refresh_token: refreshToken
        });
        
        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.storeTokens({
                    ...data,
                    refresh_token: refreshToken // Garder l'ancien refresh token
                });
                await this.parseIdToken(data.id_token);
                await this.fetchUserInfo(data.access_token);
                console.log('✅ Tokens rafraîchis avec succès');
            } else {
                console.error('Échec du refresh des tokens');
                this.clearTokens();
                // Ne pas rediriger automatiquement
            }
        } catch (error) {
            console.error('Erreur lors du refresh:', error);
            this.clearTokens();
            // Ne pas rediriger automatiquement
        }
    }
    
    /**
     * Redirige vers la page de login Cognito
     */
    login() {
        const authUrl = `${this.cognitoUrl}/login`;
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            response_type: 'code',
            scope: 'email openid profile',
            redirect_uri: this.config.redirectUri
        });
        
        const loginUrl = `${authUrl}?${params.toString()}`;
        console.log('🔐 Redirection vers Cognito:', loginUrl);
        
        window.location.href = loginUrl;
    }
    
    /**
     * Déconnexion
     */
    logout() {
        // Nettoyer les tokens locaux
        this.clearTokens();
        
        // Rediriger vers Cognito logout
        const logoutUrl = `${this.cognitoUrl}/logout`;
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            logout_uri: this.config.logoutUri
        });
        
        window.location.href = `${logoutUrl}?${params.toString()}`;
    }
    
    /**
     * Nettoie tous les tokens et données utilisateur
     */
    clearTokens() {
        localStorage.removeItem('cognito_id_token');
        localStorage.removeItem('cognito_access_token');
        localStorage.removeItem('cognito_refresh_token');
        localStorage.removeItem('saint-esprit-authenticated');
        localStorage.removeItem('saint-esprit-user');
        localStorage.removeItem('saint-esprit-user-email');
        localStorage.removeItem('saint-esprit-user-name');
        
        this.tokens = null;
        this.user = null;
        this.isAuthenticated = false;
    }
    
    /**
     * Récupère le token d'accès pour les appels API
     */
    getAccessToken() {
        return localStorage.getItem('cognito_access_token');
    }
    
    /**
     * Récupère l'ID token pour AWS
     */
    getIdToken() {
        return localStorage.getItem('cognito_id_token');
    }
    
    /**
     * Récupère les infos utilisateur
     */
    getUser() {
        return this.user;
    }
    
    /**
     * Récupère l'ID de l'utilisateur (sub de Cognito)
     */
    getUserId() {
        return this.user?.sub || this.user?.username || 'unknown';
    }
    
    /**
     * Récupère le nom complet de l'utilisateur
     */
    getCurrentUserFullName() {
        // Priorité : nom complet stocké > nom depuis user > email
        const fullname = localStorage.getItem('saint-esprit-user-fullname');
        if (fullname && fullname !== 'undefined' && !fullname.includes('-')) {
            return fullname;
        }
        
        if (this.user?.name) {
            return this.user.name;
        }
        
        if (this.user?.email) {
            return this.user.email.split('@')[0]
                .replace(/[.-]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return 'Utilisateur';
    }
    
    /**
     * Vérifie si l'utilisateur est authentifié
     */
    checkAuth() {
        return this.isAuthenticated;
    }
    
    /**
     * Méthode isAuthenticated pour compatibilité
     */
    isAuthenticatedMethod() {
        return this.isAuthenticated;
    }
    
    /**
     * Affiche un prompt de connexion ou redirige vers la page de login
     */
    showLoginPrompt() {
        console.log('Authentification requise pour accéder au site');

        // Vérifier si on est en train de traiter un callback OAuth
        const urlParams = new URLSearchParams(window.location.search);
        const hasCode = urlParams.has('code');
        const hasError = urlParams.has('error');

        // Ne pas rediriger si on a un code (callback en cours) ou une erreur OAuth
        if (hasCode || hasError) {
            console.log('⏳ Callback OAuth en cours...');
            return;
        }

        // Vérifier si on vient juste de tenter une authentification (éviter les boucles)
        const lastAuthAttempt = sessionStorage.getItem('last-auth-attempt');
        const now = Date.now();

        if (lastAuthAttempt && (now - parseInt(lastAuthAttempt)) < 5000) {
            console.warn('⚠️ Tentative d\'authentification récente détectée, éviter la boucle');
            return;
        }

        // Stocker la tentative d'authentification
        sessionStorage.setItem('last-auth-attempt', now.toString());

        // Rediriger vers la page de login Cognito
        const loginUrl = `${this.cognitoUrl}/login?` +
            `client_id=${this.config.clientId}&` +
            `response_type=code&` +
            `scope=email+openid+profile&` +
            `redirect_uri=${encodeURIComponent(this.config.redirectUri)}`;

        console.log('🔐 Redirection vers la page de login...');
        window.location.href = loginUrl;
    }
}

// Initialiser l'authentification Cognito
window.cognitoAuth = new CognitoAuth();

// Créer authManager pour compatibilité avec les boutons existants
window.authManager = {
    logout: () => window.cognitoAuth.logout(),
    refreshUserInfo: async () => {
        const accessToken = localStorage.getItem('cognito_access_token');
        if (accessToken) {
            await window.cognitoAuth.fetchUserInfo(accessToken);
            console.log('✅ Infos utilisateur rafraîchies - rechargez la page');
        }
    },
    login: () => window.cognitoAuth.login(),
    getUser: () => window.cognitoAuth.getUser(),
    getUserId: () => window.cognitoAuth.getUserId(),
    getCurrentUserFullName: () => window.cognitoAuth.getCurrentUserFullName(),
    getIdToken: () => window.cognitoAuth.getIdToken(),
    getAccessToken: () => window.cognitoAuth.getAccessToken(),
    isAuthenticated: () => window.cognitoAuth.isAuthenticatedMethod(),
    checkAuth: () => window.cognitoAuth.checkAuth(),
    getCurrentUser: () => window.cognitoAuth.getUser() // Alias pour compatibilité
};

// Export pour compatibilité
window.CognitoAuth = CognitoAuth;