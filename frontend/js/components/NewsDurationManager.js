// News Duration Manager - Calcul des durées de lecture et gestion audio
class NewsDurationManager {
    constructor() {
        this.WORDS_PER_MINUTE = 180; // Vitesse de lecture moyenne (mots par minute)
        this.audioFile = null;
        this.audioDuration = 0;
    }

    /**
     * Calcule la durée de lecture du texte (en secondes)
     * @param {string} text - Le texte à analyser
     * @returns {number} - Durée en secondes
     */
    calculateReadingTime(text) {
        if (!text || text.trim() === '') return 0;

        // Compter les mots (séparés par des espaces)
        const words = text.trim().split(/\s+/).length;

        // Calculer la durée en secondes
        const durationInSeconds = Math.ceil((words / this.WORDS_PER_MINUTE) * 60);

        return durationInSeconds;
    }

    /**
     * Formate une durée en secondes au format MM:SS
     * @param {number} seconds - Durée en secondes
     * @returns {string} - Format MM:SS
     */
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';

        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Calcule la durée totale (lecture + audio)
     * @param {string} text - Le texte
     * @param {number} audioDuration - Durée de l'audio en secondes (optionnel)
     * @returns {object} - { readingTime: number, audioTime: number, totalTime: number }
     */
    calculateTotalDuration(text, audioDuration = 0) {
        const readingTime = this.calculateReadingTime(text);
        const audioTime = audioDuration || this.audioDuration;
        const totalTime = readingTime + audioTime;

        return {
            readingTime,
            audioTime,
            totalTime,
            readingTimeFormatted: this.formatDuration(readingTime),
            audioTimeFormatted: this.formatDuration(audioTime),
            totalTimeFormatted: this.formatDuration(totalTime)
        };
    }

    /**
     * Gère l'upload d'un fichier audio
     * @param {File} file - Le fichier audio
     * @returns {Promise<object>} - Informations sur le fichier audio
     */
    async handleAudioUpload(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            // Vérifier que c'est bien un fichier audio
            if (!file.type.startsWith('audio/')) {
                reject(new Error('Le fichier doit être un fichier audio'));
                return;
            }

            // Créer un élément audio pour obtenir la durée
            const audio = new Audio();
            const objectUrl = URL.createObjectURL(file);

            audio.addEventListener('loadedmetadata', () => {
                this.audioDuration = Math.ceil(audio.duration);
                this.audioFile = file;

                URL.revokeObjectURL(objectUrl);

                resolve({
                    file: file,
                    name: file.name,
                    size: file.size,
                    duration: this.audioDuration,
                    durationFormatted: this.formatDuration(this.audioDuration),
                    type: file.type
                });
            });

            audio.addEventListener('error', () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Erreur lors de la lecture du fichier audio'));
            });

            audio.src = objectUrl;
        });
    }

    /**
     * Supprime l'audio actuel
     */
    clearAudio() {
        this.audioFile = null;
        this.audioDuration = 0;
    }

    /**
     * Obtient le fichier audio actuel
     * @returns {File|null}
     */
    getAudioFile() {
        return this.audioFile;
    }

    /**
     * Obtient la durée audio actuelle
     * @returns {number}
     */
    getAudioDuration() {
        return this.audioDuration;
    }

    /**
     * Définit une durée audio (pour charger depuis la DB)
     * @param {number} duration - Durée en secondes
     */
    setAudioDuration(duration) {
        this.audioDuration = duration || 0;
    }

    /**
     * Met à jour l'affichage des durées dans le DOM
     * @param {string} text - Le texte de la news
     * @param {string} readingTimeElementId - ID de l'élément affichant la durée de lecture
     * @param {string} totalTimeElementId - ID de l'élément affichant la durée totale
     */
    updateDurationDisplay(text, readingTimeElementId, totalTimeElementId) {
        const durations = this.calculateTotalDuration(text);

        const readingEl = document.getElementById(readingTimeElementId);
        if (readingEl) {
            readingEl.textContent = durations.readingTimeFormatted;
        }

        const totalEl = document.getElementById(totalTimeElementId);
        if (totalEl) {
            totalEl.textContent = durations.totalTimeFormatted;
        }

        return durations;
    }

    /**
     * Crée le HTML pour la zone d'upload audio
     * @param {string} containerId - ID du conteneur
     * @returns {string} - HTML de la zone d'upload
     */
    createAudioUploadHTML(containerId = 'audio-upload-zone') {
        return `
            <div class="form-group">
                <label class="form-label">Fichier Audio (optionnel)</label>
                <div class="audio-upload-area" id="${containerId}">
                    <input type="file" id="audio-file-input" accept="audio/*" style="display: none;">
                    <div class="audio-upload-prompt">
                        <span style="font-size: 48px;">🎵</span>
                        <p style="margin: 12px 0; font-weight: 600;">Cliquez pour importer un fichier audio</p>
                        <p style="font-size: 13px; color: var(--text-muted);">MP3, WAV, OGG, etc.</p>
                    </div>
                    <div class="audio-file-info" style="display: none;">
                        <div>
                            <div style="font-weight: 600; margin-bottom: 4px;" id="audio-file-name"></div>
                            <div style="font-size: 12px; color: var(--text-muted);">
                                Durée: <span id="audio-file-duration">0:00</span>
                                • <span id="audio-file-size">0 KB</span>
                            </div>
                        </div>
                        <button type="button" class="toolbar-btn" id="remove-audio-btn" style="margin: 0;">
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Crée le HTML pour l'affichage des durées
     * @returns {string} - HTML de l'affichage des durées
     */
    createDurationDisplayHTML() {
        return `
            <div class="duration-display">
                <div class="duration-item">
                    <div class="duration-label">Temps de lecture</div>
                    <div class="duration-value" id="reading-time-display">0:00</div>
                </div>
                <div class="duration-item">
                    <div class="duration-label">Durée audio</div>
                    <div class="duration-value" id="audio-time-display">0:00</div>
                </div>
                <div class="duration-item">
                    <div class="duration-label">Durée totale</div>
                    <div class="duration-value" id="total-time-display">0:00</div>
                </div>
            </div>
        `;
    }

    /**
     * Initialise les événements pour la zone d'upload
     * @param {string} containerId - ID du conteneur
     * @param {Function} onUploadCallback - Fonction appelée après upload réussi
     */
    initializeAudioUpload(containerId, onUploadCallback) {
        const container = document.getElementById(containerId);
        const fileInput = document.getElementById('audio-file-input');
        const removeBtn = document.getElementById('remove-audio-btn');

        if (!container || !fileInput) {
            console.error('[NewsDurationManager] Upload elements not found');
            return;
        }

        // Click sur la zone d'upload
        container.addEventListener('click', (e) => {
            if (!e.target.closest('#remove-audio-btn')) {
                fileInput.click();
            }
        });

        // Sélection de fichier
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const audioInfo = await this.handleAudioUpload(file);
                this.showAudioInfo(audioInfo);

                // Callback pour mise à jour externe
                if (onUploadCallback) {
                    onUploadCallback(audioInfo);
                }
            } catch (error) {
                console.error('[NewsDurationManager] Error uploading audio:', error);
                alert(error.message);
            }
        });

        // Bouton de suppression
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearAudio();
                this.hideAudioInfo();
                fileInput.value = '';

                // Callback pour mise à jour externe
                if (onUploadCallback) {
                    onUploadCallback(null);
                }
            });
        }
    }

    /**
     * Affiche les informations du fichier audio
     * @param {object} audioInfo - Informations sur le fichier
     */
    showAudioInfo(audioInfo) {
        const container = document.getElementById('audio-upload-zone');
        if (!container) return;

        const prompt = container.querySelector('.audio-upload-prompt');
        const info = container.querySelector('.audio-file-info');

        if (prompt) prompt.style.display = 'none';
        if (info) info.style.display = 'flex';

        // Mise à jour des infos
        const nameEl = document.getElementById('audio-file-name');
        const durationEl = document.getElementById('audio-file-duration');
        const sizeEl = document.getElementById('audio-file-size');

        if (nameEl) nameEl.textContent = audioInfo.name;
        if (durationEl) durationEl.textContent = audioInfo.durationFormatted;
        if (sizeEl) sizeEl.textContent = this.formatFileSize(audioInfo.size);

        // Mettre à jour l'affichage de durée audio
        const audioTimeDisplay = document.getElementById('audio-time-display');
        if (audioTimeDisplay) {
            audioTimeDisplay.textContent = audioInfo.durationFormatted;
        }

        // Ajouter la classe "has-file"
        container.classList.add('has-file');
    }

    /**
     * Cache les informations du fichier audio
     */
    hideAudioInfo() {
        const container = document.getElementById('audio-upload-zone');
        if (!container) return;

        const prompt = container.querySelector('.audio-upload-prompt');
        const info = container.querySelector('.audio-file-info');

        if (prompt) prompt.style.display = 'block';
        if (info) info.style.display = 'none';

        // Retirer la classe "has-file"
        container.classList.remove('has-file');

        // Réinitialiser l'affichage de durée audio
        const audioTimeDisplay = document.getElementById('audio-time-display');
        if (audioTimeDisplay) {
            audioTimeDisplay.textContent = '0:00';
        }
    }

    /**
     * Formate la taille d'un fichier
     * @param {number} bytes - Taille en bytes
     * @returns {string} - Taille formatée
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

// Export global
window.NewsDurationManager = NewsDurationManager;
