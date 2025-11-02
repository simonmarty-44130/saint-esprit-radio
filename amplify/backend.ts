import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { storage } from './storage/resource';
import { data } from './data/resource';

/**
 * Backend principal pour Saint-Esprit Radio
 * Amplify Gen 2
 */
const backend = defineBackend({
  auth,
  storage,
  data
});

// Configuration additionnelle du backend
backend.addOutput({
  custom: {
    appName: 'Saint-Esprit Radio',
    appVersion: '2.0.0',
    environment: 'production'
  }
});