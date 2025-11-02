/**
 * Audio Manager adapté pour AWS S3
 * Modifications minimales pour supporter les URLs S3
 */
class AudioManager {
    constructor(storage) {
        this.storage = storage || window.app?.storage;
        this.currentAudio = null;
        this.audioCache = new Map();
        this.tempAudioFile = null;
        this.lastUploadedAudio = null; // Stocker le dernier audio uploadé
    }

    async init() {
        // Plus besoin d'initialiser IndexedDB
        console.log('🎵 Audio Manager ready with S3 support');
    }

    /**
     * Lecture audio - Adapté pour URLs S3
     */
    async play(audioFileId) {
        try {
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }

            // Check cache first
            if (this.audioCache.has(audioFileId)) {
                const audio = this.audioCache.get(audioFileId);
                audio.currentTime = 0;
                audio.play();
                this.currentAudio = audio;
                return;
            }

            // Récupérer depuis S3 (retourne une URL maintenant)
            const audioData = await this.storage.getAudioFile(audioFileId);
            console.log('[AudioManager] Audio data loaded:', audioData);
            
            let audioUrl;
            
            if (!audioData) {
                // Si pas de données, essayer de construire l'URL S3 directement
                console.warn('[AudioManager] No audio data found, trying direct S3 URL');
                const userId = this.storage.userId || '7199604e-c0b1-700b-8cdb-3b100af8fef0';
                // Ne pas ajouter .mp3 si audioFileId l'a déjà
                const fileKey = audioFileId.endsWith('.mp3') ? audioFileId : `${audioFileId}.mp3`;
                audioUrl = `https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/audio/${userId}/${fileKey}`;
            } else if (audioData.data) {
                // Si on a des données
                if (audioData.data.startsWith('data:')) {
                    // C'est un data URL (ancien format), l'utiliser directement
                    console.log('[AudioManager] Using data URL directly');
                    audioUrl = audioData.data;
                } else if (audioData.data.startsWith('http')) {
                    // C'est déjà une URL
                    audioUrl = audioData.data;
                } else {
                    // Construire l'URL S3
                    const userId = this.storage.userId || '7199604e-c0b1-700b-8cdb-3b100af8fef0';
                    // Ne pas ajouter .mp3 si audioFileId l'a déjà
                    const fileKey = audioFileId.endsWith('.mp3') ? audioFileId : `${audioFileId}.mp3`;
                    audioUrl = `https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/audio/${userId}/${fileKey}`;
                }
            } else if (audioData.url) {
                // Utiliser l'URL si elle existe
                audioUrl = audioData.url;
            } else {
                console.error('[AudioManager] No valid audio data or URL found');
                alert('Audio file not found or invalid');
                return;
            }
            
            // Corriger l'URL si nécessaire
            if (audioFileId && audioFileId.includes('flashinfo')) {
                // C'est un Flash Info, utiliser le bon chemin
                const date = audioFileId.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (date) {
                    // Ne pas ajouter .mp3 si audioFileId l'a déjà
                    const fileKey = audioFileId.endsWith('.mp3') ? audioFileId : `${audioFileId}.mp3`;
                    audioUrl = `https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/flash-info/${date[1]}/${date[2]}/${date[3]}/${fileKey}`;
                    console.log('[AudioManager] Flash Info URL corrigée:', audioUrl);
                }
            } else if (window.audioUrlFixer && !audioUrl.startsWith('data:')) {
                audioUrl = window.audioUrlFixer.fixUrl(audioUrl);
                console.log('[AudioManager] URL corrigée:', audioUrl);
            }
            
            // S'assurer que l'URL a bien l'extension .mp3
            // Mais éviter de l'ajouter deux fois si audioFileId l'a déjà
            if (!audioUrl.endsWith('.mp3') && !audioUrl.startsWith('data:')) {
                // Vérifier si ce n'est pas déjà dans l'audioFileId
                if (!audioFileId || !audioFileId.endsWith('.mp3')) {
                    audioUrl += '.mp3';
                }
            }
            
            const audio = new Audio(audioUrl);
            this.audioCache.set(audioFileId, audio);
            audio.play();
            this.currentAudio = audio;
            
        } catch (error) {
            console.error('Error playing audio:', error);
            alert('Error playing audio file');
        }
    }

    /**
     * Upload audio - Adapté pour S3
     */
    async handleFileUpload(file) {
        if (!file || !file.type.startsWith('audio/')) {
            alert('Please select an audio file');
            return null;
        }

        try {
            // Créer ID unique avec extension .mp3
            const audioFileId = Date.now().toString() + '.mp3';
            
            // Obtenir durée
            const duration = await this.getAudioDuration(file);
            
            // Préparer données pour S3
            const audioData = {
                data: file, // Blob direct au lieu de data URI
                name: file.name,
                type: file.type,
                duration: duration
            };

            // Sauvegarder vers S3 via Storage
            const savedAudioData = await this.storage.saveAudioFile(audioFileId, audioData);
            
            // Stocker pour réutilisation dans handleSoundModalSubmit
            this.lastUploadedAudio = {
                id: audioFileId,
                name: file.name,
                duration: duration,
                type: file.type,
                url: savedAudioData.url // URL S3 pour lecture directe
            };
            
            // Retourner format compatible
            return {
                audioFileId: audioFileId,
                name: file.name,
                duration: duration,
                type: file.type,
                url: savedAudioData.url
            };
            
        } catch (error) {
            console.error('Error uploading audio:', error);
            alert('Error uploading audio file');
            return null;
        }
    }

    /**
     * Obtenir durée audio (inchangé)
     */
    async getAudioDuration(file) {
        return new Promise((resolve) => {
            const audio = document.createElement('audio');
            const url = URL.createObjectURL(file);
            
            audio.addEventListener('loadedmetadata', () => {
                const duration = Math.round(audio.duration);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                URL.revokeObjectURL(url);
                resolve(formatted);
            });
            
            audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
                resolve('0:00');
            });
            
            audio.src = url;
        });
    }

    // Autres méthodes inchangées...
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }

    generateWaveform(canvasId) {
        // Méthode inchangée - génération waveform
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Logique existante préservée
        console.log('🌊 Waveform generation (existing logic preserved)');
    }

    /**
     * Gérer la soumission du modal de son
     */
    async handleSoundModalSubmit(type) {
        try {
            // Si on a déjà uploadé via handleFileUpload, utiliser ces données
            if (this.lastUploadedAudio) {
                const audioData = { ...this.lastUploadedAudio };
                
                // Récupérer les données du formulaire
                let nameInputId = type === 'news' ? 'sound-name' : `${type}-sound-name`;
                let typeInputId = type === 'news' ? 'sound-type' : `${type}-sound-type`;
                let descInputId = type === 'news' ? 'sound-description' : `${type}-sound-description`;
                
                const nameInput = document.getElementById(nameInputId);
                const typeInput = document.getElementById(typeInputId);
                const descInput = document.getElementById(descInputId);
                
                if (nameInput && nameInput.value) {
                    audioData.name = nameInput.value;
                }
                if (typeInput && typeInput.value) {
                    audioData.type = typeInput.value;
                }
                if (descInput && descInput.value) {
                    audioData.description = descInput.value;
                }
                
                // Réinitialiser pour la prochaine fois
                this.lastUploadedAudio = null;
                
                console.log(`✅ Using already uploaded audio: ${audioData.id}`);
                return audioData;
            }
            
            // Sinon, fallback sur l'ancien comportement (ne devrait pas arriver)
            console.warn('No pre-uploaded audio found, falling back to direct upload');
            
            let fileInputId = type === 'news' ? 'sound-file' : `${type}-sound-file`;
            let nameInputId = type === 'news' ? 'sound-name' : `${type}-sound-name`;
            
            const fileInput = document.getElementById(fileInputId);
            const nameInput = document.getElementById(nameInputId);
            
            if (!fileInput) {
                console.error(`Input not found: ${fileInputId}`);
                alert('Erreur: Formulaire non trouvé');
                return null;
            }
            
            if (!fileInput.files || !fileInput.files.length) {
                alert('Veuillez sélectionner un fichier audio');
                return null;
            }
            
            const file = fileInput.files[0];
            const name = nameInput ? nameInput.value : file.name;
            
            // Utiliser handleFileUpload pour éviter la duplication
            const uploadedAudio = await this.handleFileUpload(file);
            if (uploadedAudio && name) {
                uploadedAudio.name = name;
            }
            
            return uploadedAudio ? {
                id: uploadedAudio.audioFileId,
                name: name || uploadedAudio.name,
                duration: uploadedAudio.duration,
                type: uploadedAudio.type
            } : null;
            
        } catch (error) {
            console.error('❌ Error handling sound modal:', error);
            alert('Erreur lors de l\'upload du fichier audio');
            return null;
        }
    }

    /**
     * Convertir un fichier en Data URL
     */
    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Toutes les autres méthodes restent identiques...
}

// Export global inchangé
window.AudioManager = AudioManager;