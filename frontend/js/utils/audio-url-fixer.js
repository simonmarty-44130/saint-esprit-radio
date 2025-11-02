/**
 * Utilitaire pour corriger les URLs audio
 * PROBLÈME: CloudFront redirige tout vers index.html, donc les fichiers audio ne sont pas accessibles
 * SOLUTION: Toujours utiliser S3 direct pour les fichiers audio
 */

class AudioUrlFixer {
    constructor() {
        this.cloudfrontDomain = 'd1e4y2k4u0hrs3.cloudfront.net';
        // Utiliser le bucket saint-esprit-audio qui est public
        this.audioBucket = 'saint-esprit-audio';
        this.s3Domain = `${this.audioBucket}.s3.eu-west-3.amazonaws.com`;
        this.s3BaseUrl = `https://${this.s3Domain}`;
        
        // Ancien bucket Amplify privé à remplacer
        this.amplifyBucket = 'amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke';
    }

    /**
     * Corriger une URL audio pour utiliser S3 direct (bucket Amplify)
     */
    fixUrl(url) {
        if (!url) return url;
        
        // IMPORTANT: Ne pas modifier les URLs présignées AWS !
        if (url.includes('X-Amz-Signature') || url.includes('X-Amz-Credential')) {
            console.log('🔐 Presigned URL detected, not modifying');
            return url;
        }
        
        // IMPORTANT: Si l'URL contient saint-esprit.link (notre domaine CloudFront), 
        // extraire le path et construire l'URL S3 directe
        if (url.includes('saint-esprit.link')) {
            // Extraire le path après saint-esprit.link
            const match = url.match(/saint-esprit\.link\/(.+)/);
            if (match) {
                const path = match[1];
                const fixedUrl = `${this.s3BaseUrl}/${path}`;
                console.log(`🔧 Fixed saint-esprit.link URL: ${url} → ${fixedUrl}`);
                return fixedUrl;
            }
        }
        
        // Si l'URL contient CloudFront, la remplacer par S3 Amplify
        if (url.includes(this.cloudfrontDomain)) {
            const fixedUrl = url.replace(
                `https://${this.cloudfrontDomain}`,
                this.s3BaseUrl
            );
            console.log(`🔧 Fixed CloudFront URL: ${url} → ${fixedUrl}`);
            return fixedUrl;
        }
        
        // Si l'URL contient le bucket Amplify privé, migrer vers saint-esprit-audio public
        if (url.includes(this.amplifyBucket)) {
            const fixedUrl = url.replace(
                `https://${this.amplifyBucket}.s3.eu-west-3.amazonaws.com`,
                this.s3BaseUrl
            );
            console.log(`🔧 Migrated from Amplify to saint-esprit-audio: ${url} → ${fixedUrl}`);
            return fixedUrl;
        }
        
        // Si c'est une URL relative, la transformer en URL S3 absolue
        if (!url.startsWith('http')) {
            const fixedUrl = `${this.s3BaseUrl}/${url}`;
            console.log(`🔧 Made absolute URL: ${url} → ${fixedUrl}`);
            return fixedUrl;
        }
        
        // Si l'URL est déjà sur le bucket saint-esprit-audio, la garder
        if (url.includes(this.audioBucket)) {
            return url;
        }
        
        // Sinon retourner l'URL telle quelle
        return url;
    }

    /**
     * Corriger toutes les URLs dans un objet sound
     */
    fixSoundObject(sound) {
        if (!sound) return sound;
        
        const fixed = { ...sound };
        
        // Corriger toutes les propriétés qui peuvent contenir des URLs
        if (fixed.url) fixed.url = this.fixUrl(fixed.url);
        if (fixed.audioUrl) fixed.audioUrl = this.fixUrl(fixed.audioUrl);
        if (fixed.s3Url) fixed.s3Url = this.fixUrl(fixed.s3Url);
        
        return fixed;
    }

    /**
     * Corriger toutes les URLs dans un tableau de sons
     */
    fixSoundsArray(sounds) {
        if (!sounds || !Array.isArray(sounds)) return sounds;
        return sounds.map(sound => this.fixSoundObject(sound));
    }

    /**
     * Corriger toutes les URLs dans un item (news, animation, etc.)
     */
    fixItem(item) {
        if (!item) return item;
        
        const fixed = { ...item };
        
        // Corriger les sons
        if (fixed.sounds) {
            fixed.sounds = this.fixSoundsArray(fixed.sounds);
        }
        
        // Corriger les URLs directes
        if (fixed.audioUrl) fixed.audioUrl = this.fixUrl(fixed.audioUrl);
        if (fixed.url) fixed.url = this.fixUrl(fixed.url);
        
        return fixed;
    }

    /**
     * Corriger toutes les URLs dans un tableau d'items
     */
    fixItemsArray(items) {
        if (!items || !Array.isArray(items)) return items;
        return items.map(item => this.fixItem(item));
    }

    /**
     * Corriger toutes les URLs dans les données complètes
     */
    fixAllData(data) {
        if (!data) return data;
        
        const fixed = { ...data };
        
        // Corriger chaque type de données
        if (fixed.news) fixed.news = this.fixItemsArray(fixed.news);
        if (fixed.animations) fixed.animations = this.fixItemsArray(fixed.animations);
        if (fixed.blocks) fixed.blocks = this.fixItemsArray(fixed.blocks);
        if (fixed.conductors) fixed.conductors = this.fixItemsArray(fixed.conductors);
        
        return fixed;
    }
}

// Créer une instance globale
window.audioUrlFixer = new AudioUrlFixer();

// Export pour les modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioUrlFixer;
}