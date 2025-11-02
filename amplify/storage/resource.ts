import { defineStorage } from '@aws-amplify/backend';

/**
 * Configuration du stockage S3 pour Saint-Esprit Radio
 * Amplify Gen 2
 */
export const storage = defineStorage({
  name: 'saintEspritStorage',
  
  // Règles d'accès par chemin
  access: (allow) => ({
    // Dossier personnel pour chaque utilisateur authentifié
    'users/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete'])
    ],
    
    // Dossier audio accessible pour tous les authentifiés
    'audio/*': [
      allow.authenticated.to(['read', 'write'])
    ],
    
    // Dossier public pour les assets
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write'])
    ],
    
    // Dossier des émissions
    'emissions/*': [
      allow.authenticated.to(['read', 'write'])
    ],
    
    // Dossier des templates
    'templates/*': [
      allow.authenticated.to(['read', 'write'])
    ],
    
    // Dossier des calendriers
    'calendars/*': [
      allow.authenticated.to(['read', 'write'])
    ],
    
    // Dossier des conducteurs
    'conducteurs/*': [
      allow.authenticated.to(['read', 'write'])
    ]
  })
});