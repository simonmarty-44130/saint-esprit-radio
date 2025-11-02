// Configuration Amplify pour Saint-Esprit
import { Amplify } from 'aws-amplify';
import outputs from '../../../amplify_outputs.json' assert { type: 'json' };

// Configuration globale Amplify
Amplify.configure(outputs);

// Export de la configuration pour debug
export const amplifyConfig = {
    // API GraphQL
    API_ENDPOINT: outputs.data.url,
    
    // Authentification  
    USER_POOL_ID: outputs.auth.user_pool_id,
    CLIENT_ID: outputs.auth.user_pool_client_id,
    IDENTITY_POOL_ID: outputs.auth.identity_pool_id,
    
    // Stockage
    BUCKET_NAME: outputs.storage.bucket_name,
    
    // Région
    REGION: outputs.auth.aws_region
};

console.log('✅ Amplify configuré pour Saint-Esprit:', amplifyConfig);