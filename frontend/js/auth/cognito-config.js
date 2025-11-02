/**
 * Configuration AWS Cognito pour Saint-Esprit Radio
 * Authentification des utilisateurs sans Amplify CLI
 */

// Configuration Cognito (à remplacer avec vos vraies valeurs après création dans AWS Console)
const COGNITO_CONFIG = {
    region: 'eu-west-3',
    userPoolId: 'YOUR_USER_POOL_ID', // Créer dans AWS Console
    clientId: 'YOUR_CLIENT_ID', // Créer dans AWS Console
    identityPoolId: 'YOUR_IDENTITY_POOL_ID' // Créer dans AWS Console
};

class CognitoAuth {
    constructor() {
        this.poolData = {
            UserPoolId: COGNITO_CONFIG.userPoolId,
            ClientId: COGNITO_CONFIG.clientId
        };
        
        // Initialiser le User Pool si les IDs sont configurés
        if (COGNITO_CONFIG.userPoolId !== 'YOUR_USER_POOL_ID') {
            this.userPool = new AmazonCognitoIdentity.CognitoUserPool(this.poolData);
            this.cognitoUser = null;
        } else {
            console.warn('⚠️ Cognito non configuré - Mode développement local activé');
            this.userPool = null;
        }
    }
    
    /**
     * Inscription d'un nouvel utilisateur
     */
    async signUp(username, password, email) {
        if (!this.userPool) {
            console.log('Mode local: Utilisateur créé localement');
            localStorage.setItem('localUser', JSON.stringify({username, email}));
            return {success: true, local: true};
        }
        
        return new Promise((resolve, reject) => {
            const attributeList = [
                new AmazonCognitoIdentity.CognitoUserAttribute({
                    Name: 'email',
                    Value: email
                })
            ];
            
            this.userPool.signUp(username, password, attributeList, null, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
    
    /**
     * Connexion utilisateur
     */
    async signIn(username, password) {
        if (!this.userPool) {
            console.log('Mode local: Connexion locale');
            const localUser = JSON.parse(localStorage.getItem('localUser') || '{}');
            if (localUser.username === username) {
                localStorage.setItem('currentUser', username);
                return {success: true, local: true};
            }
            throw new Error('Utilisateur non trouvé en mode local');
        }
        
        const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: username,
            Password: password
        });
        
        const userData = {
            Username: username,
            Pool: this.userPool
        };
        
        this.cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
        
        return new Promise((resolve, reject) => {
            this.cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (result) => {
                    // Obtenir les tokens
                    const accessToken = result.getAccessToken().getJwtToken();
                    const idToken = result.getIdToken().getJwtToken();
                    const refreshToken = result.getRefreshToken().getToken();
                    
                    // Stocker les tokens
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('idToken', idToken);
                    localStorage.setItem('refreshToken', refreshToken);
                    
                    // Configurer AWS SDK avec les credentials Cognito
                    this.configureCognitoCredentials(idToken);
                    
                    resolve(result);
                },
                onFailure: (err) => {
                    reject(err);
                }
            });
        });
    }
    
    /**
     * Déconnexion
     */
    signOut() {
        if (!this.userPool) {
            console.log('Mode local: Déconnexion locale');
            localStorage.removeItem('currentUser');
            return;
        }
        
        if (this.cognitoUser) {
            this.cognitoUser.signOut();
        }
        
        // Nettoyer les tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('refreshToken');
    }
    
    /**
     * Vérifier si l'utilisateur est connecté
     */
    async isAuthenticated() {
        if (!this.userPool) {
            return !!localStorage.getItem('currentUser');
        }
        
        const cognitoUser = this.userPool.getCurrentUser();
        
        if (!cognitoUser) {
            return false;
        }
        
        return new Promise((resolve) => {
            cognitoUser.getSession((err, session) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(session.isValid());
                }
            });
        });
    }
    
    /**
     * Obtenir l'utilisateur actuel
     */
    getCurrentUser() {
        if (!this.userPool) {
            return localStorage.getItem('currentUser');
        }
        
        const cognitoUser = this.userPool.getCurrentUser();
        return cognitoUser ? cognitoUser.getUsername() : null;
    }
    
    /**
     * Configurer AWS SDK avec les credentials Cognito
     */
    configureCognitoCredentials(idToken) {
        AWS.config.region = COGNITO_CONFIG.region;
        
        const logins = {};
        logins[`cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/${COGNITO_CONFIG.userPoolId}`] = idToken;
        
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: COGNITO_CONFIG.identityPoolId,
            Logins: logins
        });
        
        // Rafraîchir les credentials
        AWS.config.credentials.refresh((error) => {
            if (error) {
                console.error('Erreur refresh credentials:', error);
            } else {
                console.log('✅ AWS Credentials configurés avec Cognito');
            }
        });
    }
}

// Export global pour utilisation dans l'app
window.CognitoAuth = CognitoAuth;