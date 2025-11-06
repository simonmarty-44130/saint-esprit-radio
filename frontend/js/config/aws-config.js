/**
 * Configuration AWS pour Saint-Esprit
 */

window.AWSConfig = {
    // Region AWS
    region: 'eu-west-3',
    
    // Cognito User Pool (le bon selon vous)
    userPoolId: 'eu-west-3_oD1fm8OLs',
    clientId: '5jst6bnhl26ekdr5a7pu9ik2f5',
    
    // Cognito Identity Pool existant pour Saint-Esprit
    identityPoolId: 'eu-west-3:3bffc600-c5a5-4d37-9fca-7277e64cc66d',
    
    // S3 Bucket (bucket public pour les fichiers audio)
    bucketName: 'saint-esprit-audio',
    
    // CloudFront
    cloudFrontDomain: 'https://saint-esprit.link',
    
    // DynamoDB Tables (seront créées automatiquement)
    tables: {
        news: 'saint-esprit-news',
        animations: 'saint-esprit-animations',
        blocks: 'saint-esprit-blocks',
        conductors: 'saint-esprit-conductors',
        journals: 'saint-esprit-journals',
        audio: 'saint-esprit-audio',
        habillage: 'saint-esprit-habillage'
    }
};