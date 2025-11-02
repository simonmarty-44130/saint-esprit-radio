/**
 * AudioUrlManager - Gestion simplifiée des audios par URL
 * Au lieu de synchroniser les fichiers, on synchronise juste les URLs !
 */
class AudioUrlManager {
    constructor(app) {
        this.app = app;
        this.uploadEndpoint = 'sync/upload-audio.php';
        this.baseUrl = window.location.origin + '/saint-esprit/sync/audio_files/';
    }

    /**
     * Upload un fichier audio et retourne son URL
     */
    async uploadAudio(audioBlob, filename) {
        console.log(`📤 Upload de ${filename}...`);
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onloadend = async () => {
                const base64 = reader.result;
                
                const formData = new URLSearchParams();
                formData.append('filename', filename);
                formData.append('audioData', base64);
                
                try {
                    const response = await fetch(this.uploadEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: formData.toString()
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        // Construire l'URL complète
                        const audioUrl = this.baseUrl + result.filename;
                        console.log(`✅ Audio uploadé: ${audioUrl}`);
                        resolve({
                            success: true,
                            url: audioUrl,
                            filename: result.filename
                        });
                    } else {
                        reject(new Error(result.error || 'Upload failed'));
                    }
                } catch (e) {
                    reject(e);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(audioBlob);
        });
    }

    /**
     * Met à jour toutes les news pour utiliser des URLs au lieu d'audioFileId
     */
    async convertNewsToUrls() {
        console.log('🔄 Conversion des audios en URLs...');
        
        if (!this.app.newsManager) {
            return { success: false, error: 'NewsManager non disponible' };
        }

        const news = this.app.newsManager.getDatabase();
        let converted = 0;
        let errors = 0;
        
        for (const newsItem of news) {
            if (newsItem.sounds && newsItem.sounds.length > 0) {
                for (const sound of newsItem.sounds) {
                    // Si on a un audioFileId mais pas d'URL
                    if (sound.audioFileId && !sound.audioUrl) {
                        try {
                            // Récupérer l'audio depuis IndexedDB
                            const audioData = await window.app.storage.getAudioFile(sound.audioFileId);
                            
                            if (audioData) {
                                // Upload et obtenir l'URL
                                const result = await this.uploadAudio(
                                    audioData.data, 
                                    `${newsItem.id}_${sound.audioFileId}.mp3`
                                );
                                
                                // Stocker l'URL dans le son
                                sound.audioUrl = result.url;
                                converted++;
                                console.log(`✅ Converti: ${sound.name} → ${result.url}`);
                            } else {
                                console.warn(`⚠️ Audio non trouvé localement: ${sound.name}`);
                                errors++;
                            }
                        } catch (e) {
                            console.error(`❌ Erreur conversion ${sound.name}:`, e);
                            errors++;
                        }
                    } else if (sound.audioUrl) {
                        console.log(`✓ ${sound.name} a déjà une URL: ${sound.audioUrl}`);
                    }
                }
            }
        }
        
        // Sauvegarder les news avec les URLs
        if (converted > 0) {
            this.app.newsManager.saveDatabase();
            console.log(`✅ ${converted} audios convertis en URLs`);
        }
        
        return {
            success: true,
            converted: converted,
            errors: errors
        };
    }

    /**
     * Vérifie que toutes les URLs audio sont accessibles
     */
    async verifyAudioUrls() {
        console.log('🔍 Vérification des URLs audio...');
        
        const news = this.app.newsManager.getDatabase();
        let valid = 0;
        let invalid = 0;
        let missing = 0;
        
        for (const newsItem of news) {
            if (newsItem.sounds && newsItem.sounds.length > 0) {
                for (const sound of newsItem.sounds) {
                    if (sound.audioUrl) {
                        try {
                            // Test simple : HEAD request pour vérifier que l'URL existe
                            const response = await fetch(sound.audioUrl, { method: 'HEAD' });
                            if (response.ok) {
                                valid++;
                                console.log(`✅ URL valide: ${sound.name}`);
                            } else {
                                invalid++;
                                console.warn(`❌ URL invalide (${response.status}): ${sound.audioUrl}`);
                            }
                        } catch (e) {
                            invalid++;
                            console.error(`❌ Erreur accès URL: ${sound.audioUrl}`, e);
                        }
                    } else if (sound.audioFileId) {
                        missing++;
                        console.warn(`⚠️ Pas d'URL pour: ${sound.name} (ID: ${sound.audioFileId})`);
                    }
                }
            }
        }
        
        console.log(`📊 Résultat: ${valid} valides, ${invalid} invalides, ${missing} sans URL`);
        
        return {
            valid: valid,
            invalid: invalid,
            missing: missing,
            total: valid + invalid + missing
        };
    }

    /**
     * Répare automatiquement les audios en convertissant tout en URLs
     */
    async autoFix() {
        console.log('🔧 Réparation automatique des audios...');
        
        // 1. Convertir tous les audioFileId en URLs
        const convertResult = await this.convertNewsToUrls();
        
        // 2. Vérifier les URLs
        const verifyResult = await this.verifyAudioUrls();
        
        // 3. Sauvegarder
        this.app.save();
        
        return {
            success: true,
            converted: convertResult.converted,
            errors: convertResult.errors,
            verification: verifyResult
        };
    }
}

// Export pour utilisation dans l'app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioUrlManager;
}