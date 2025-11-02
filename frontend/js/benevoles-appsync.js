/**
 * Client AppSync pour l'espace bénévoles
 * Remplace AWS SDK v2 par Amplify v6 + AppSync
 */

class BenevolesAppSync {
    constructor() {
        this.client = null;
        this.currentUser = null;
    }

    async init() {
        try {
            console.log('🔧 Initializing Benevoles AppSync...');

            // Charger Amplify depuis window
            if (!window.amplify || !window.amplifyUtils) {
                throw new Error('Amplify not loaded');
            }

            const { Amplify } = window.amplify;
            const { generateClient } = window.amplifyUtils;
            const { fetchAuthSession } = window.amplifyAuth;

            // Charger la configuration
            const config = await fetch('/amplify_outputs.json').then(r => r.json());
            Amplify.configure(config);

            // Créer le client GraphQL
            this.client = generateClient();

            // Récupérer l'utilisateur connecté
            const session = await fetchAuthSession();
            this.currentUser = session.tokens?.idToken?.payload?.['cognito:username'] ||
                             session.tokens?.idToken?.payload?.email?.split('@')[0] ||
                             'Bénévole';

            console.log(`✅ Benevoles AppSync initialized for: ${this.currentUser}`);
            return true;

        } catch (error) {
            console.error('❌ Benevoles AppSync init failed:', error);
            throw error;
        }
    }

    /**
     * Sauvegarder une émission + envoyer email
     */
    async saveEmission(emissionData) {
        try {
            console.log('💾 Saving emission to DynamoDB...');

            const input = {
                title: emissionData.title,
                content: emissionData.content,
                author: this.currentUser,
                guests: emissionData.guests || null,
                musics: emissionData.musics || null,
                wordCount: emissionData.wordCount,
                readingTime: emissionData.readingTime,
                musicTime: emissionData.musicTime,
                totalTime: emissionData.totalTime,
                status: 'submitted',
                submittedAt: new Date().toISOString()
            };

            const result = await this.client.graphql({
                query: `mutation CreateEmission($input: CreateEmissionInput!) {
                    createEmission(input: $input) {
                        id
                        title
                        author
                        status
                        submittedAt
                    }
                }`,
                variables: { input }
            });

            console.log('✅ Emission saved:', result.data.createEmission.id);

            // Envoyer l'email de notification
            await this.sendEmissionEmail(result.data.createEmission.id, emissionData);

            return result.data.createEmission;

        } catch (error) {
            console.error('❌ Error saving emission:', error);
            throw error;
        }
    }

    /**
     * Sauvegarder une chronique audio
     */
    async saveChronique(chroniqueData) {
        try {
            console.log('💾 Saving chronique to DynamoDB...');

            const input = {
                title: chroniqueData.title,
                author: this.currentUser,
                type: chroniqueData.type,
                audioUrl: chroniqueData.audioUrl || null,
                s3Key: chroniqueData.s3Key || null,
                duration: chroniqueData.duration,
                dateDiffusion: chroniqueData.dateDiffusion,
                lancement: chroniqueData.lancement || null,
                desannonce: chroniqueData.desannonce || null,
                status: 'submitted',
                submittedAt: new Date().toISOString()
            };

            const result = await this.client.graphql({
                query: `mutation CreateChronique($input: CreateChroniqueInput!) {
                    createChronique(input: $input) {
                        id
                        title
                        author
                        type
                        status
                        submittedAt
                    }
                }`,
                variables: { input }
            });

            console.log('✅ Chronique saved:', result.data.createChronique.id);

            return result.data.createChronique;

        } catch (error) {
            console.error('❌ Error saving chronique:', error);
            throw error;
        }
    }

    /**
     * Uploader un fichier audio vers S3
     */
    async uploadAudio(audioBlob, filename) {
        try {
            console.log('📤 Uploading audio to S3...');

            const { uploadData } = window.amplifyStorage;

            const result = await uploadData({
                path: `chroniques/${filename}`,
                data: audioBlob,
                options: {
                    contentType: 'audio/wav'
                }
            }).result;

            console.log('✅ Audio uploaded:', result.path);

            return {
                s3Key: result.path,
                url: `https://amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke.s3.eu-west-3.amazonaws.com/${result.path}`
            };

        } catch (error) {
            console.error('❌ Error uploading audio:', error);
            throw error;
        }
    }

    /**
     * Envoyer email de notification (via SES - à garder)
     */
    async sendEmissionEmail(emissionId, data) {
        // Cette fonctionnalité reste avec AWS SDK v2 car SES n'est pas dans Amplify
        console.log('📧 Email notification will be sent via SES (external)');

        // L'email sera envoyé via le système existant
        // On garde AWS SES pour les notifications
        return true;
    }

    /**
     * Lister mes émissions
     */
    async getMyEmissions() {
        try {
            const result = await this.client.graphql({
                query: `query ListEmissions {
                    listEmissions(filter: {author: {eq: "${this.currentUser}"}}) {
                        items {
                            id
                            title
                            status
                            submittedAt
                            reviewedAt
                            reviewNotes
                        }
                    }
                }`
            });

            return result.data.listEmissions.items;

        } catch (error) {
            console.error('❌ Error getting emissions:', error);
            return [];
        }
    }

    /**
     * Lister mes chroniques
     */
    async getMyChroniques() {
        try {
            const result = await this.client.graphql({
                query: `query ListChroniques {
                    listChroniques(filter: {author: {eq: "${this.currentUser}"}}) {
                        items {
                            id
                            title
                            type
                            status
                            dateDiffusion
                            submittedAt
                            reviewedAt
                            reviewNotes
                        }
                    }
                }`
            });

            return result.data.listChroniques.items;

        } catch (error) {
            console.error('❌ Error getting chroniques:', error);
            return [];
        }
    }
}

// Export global
window.BenevolesAppSync = BenevolesAppSync;
