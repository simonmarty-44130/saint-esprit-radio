import { defineAuth } from '@aws-amplify/backend';

/**
 * Configuration de l'authentification pour Saint-Esprit Radio
 * Amplify Gen 2
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    // Permettre aussi la connexion avec nom d'utilisateur
    username: true
  },
  
  // Configuration des attributs utilisateur
  
  // Configuration de la récupération de compte
  accountRecovery: 'EMAIL_ONLY',
  
  // Validation du mot de passe
  passwordPolicy: {
    minimumLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: false
  },
  
  // Les groupes seront créés automatiquement par les autorisations du schéma GraphQL
});