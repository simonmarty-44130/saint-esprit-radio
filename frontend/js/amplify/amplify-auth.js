// Gestionnaire d'authentification Amplify
import { signIn, signOut, getCurrentUser, signUp, confirmSignUp, confirmSignInWithNewPassword } from 'aws-amplify/auth';

export class AmplifyAuth {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
    }
    
    // Connexion utilisateur
    async signIn(username, password) {
        try {
            const result = await signIn({ username, password });
            
            if (result.isSignedIn) {
                this.currentUser = await getCurrentUser();
                this.isAuthenticated = true;
                console.log('✅ Connexion réussie:', this.currentUser.username);
                return this.currentUser;
            }
            
            // Gestion du premier login (changement mot de passe requis)
            if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
                console.log('⚠️ Changement de mot de passe requis');
                return { requiresPasswordChange: true, challengeParam: result };
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Erreur connexion:', error);
            throw error;
        }
    }
    
    // Confirmer avec nouveau mot de passe
    async confirmNewPassword(challengeResponse, newPassword) {
        try {
            const result = await confirmSignInWithNewPassword({
                challengeResponse,
                newPassword
            });
            
            if (result.isSignedIn) {
                this.currentUser = await getCurrentUser();
                this.isAuthenticated = true;
                console.log('✅ Mot de passe changé et connexion réussie');
                return this.currentUser;
            }
            
            return result;
        } catch (error) {
            console.error('❌ Erreur changement mot de passe:', error);
            throw error;
        }
    }
    
    // Déconnexion
    async signOut() {
        try {
            await signOut();
            this.currentUser = null;
            this.isAuthenticated = false;
            console.log('✅ Déconnexion réussie');
        } catch (error) {
            console.error('❌ Erreur déconnexion:', error);
            throw error;
        }
    }
    
    // Vérifier si utilisateur connecté
    async checkAuthStatus() {
        try {
            this.currentUser = await getCurrentUser();
            this.isAuthenticated = true;
            return this.currentUser;
        } catch (error) {
            this.isAuthenticated = false;
            return null;
        }
    }
    
    // Créer un nouveau compte  
    async signUp(username, password, email) {
        try {
            const result = await signUp({
                username,
                password,
                options: {
                    userAttributes: {
                        email
                    }
                }
            });
            console.log('✅ Compte créé:', result);
            return result;
        } catch (error) {
            console.error('❌ Erreur création compte:', error);
            throw error;
        }
    }
}

// Instance globale
window.amplifyAuth = new AmplifyAuth();