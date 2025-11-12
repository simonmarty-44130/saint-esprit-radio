/**
 * OnAir Component - Adaptations pour AWS S3
 * Support des URLs S3 pour la lecture audio
 */
class OnAir {
    constructor() {
        this.currentAudioElement = null;
        this.audioInterval = null;
        this.currentContent = null;
        this.currentBlock = null;
        this.scrollInterval = null;
        this.currentPrompterSpeed = 5;
        this.conductorManager = null;
        this.newsManager = null;
        this.animationManager = null;
        this.lastConductorUpdate = null;
        this.hasNewChanges = false;
        this.audioManager = null;
        this.currentSegmentIndex = -1;
        this.segments = [];
    }

    /**
     * Initialize OnAir component with managers
     */
    init(managers) {
        this.conductorManager = managers.conductorManager;
        this.newsManager = managers.newsManager;
        this.animationManager = managers.animationManager;
        this.audioManager = managers.audioManager;
        
        // S'abonner aux changements du conducteur
        if (this.conductorManager) {
            this.conductorManager.on('segments-changed', () => {
                this.onConductorChanged();
            });
        }
        
        // Capturer l'état initial du conducteur
        this.lastConductorUpdate = JSON.stringify(this.conductorManager?.getSegments() || []);
        
        console.log('✅ OnAir component initialized with change detection');
    }
    
    /**
     * Détecter les changements dans le conducteur
     */
    onConductorChanged() {
        if (!this.conductorManager) return;
        
        const currentState = JSON.stringify(this.conductorManager.getSegments());
        
        // Si le conducteur a changé
        if (currentState !== this.lastConductorUpdate) {
            this.hasNewChanges = true;
            this.showUpdateNotification();
        }
    }
    
    /**
     * Afficher une notification de mise à jour disponible
     */
    showUpdateNotification() {
        // Mettre à jour le bouton Refresh pour indiquer des changements
        const refreshBtn = document.querySelector('.onair-navigation button[title="Rafraîchir"]');
        if (refreshBtn && !refreshBtn.classList.contains('has-updates')) {
            refreshBtn.classList.add('has-updates');
            refreshBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ff8787)';
            refreshBtn.style.animation = 'pulse 1s infinite';
            refreshBtn.innerHTML = '🔄 Mise à jour disponible';
        }
        
        // Afficher une notification toast
        const notification = document.createElement('div');
        notification.className = 'onair-update-notification';
        notification.innerHTML = `
            <div style="position: fixed; top: 80px; right: 20px; background: #ff6b6b; color: white; 
                        padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                        z-index: 10000; animation: slideIn 0.3s ease-out;">
                <strong>📢 Conducteur modifié</strong><br>
                <small>Cliquez sur Refresh pour charger les changements</small>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Retirer la notification après 5 secondes
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    /**
     * Refresh OnAir view
     */
    refresh() {
        console.log('🔄 Refreshing OnAir view');
        
        // Si des changements sont disponibles, afficher une confirmation
        if (this.hasNewChanges) {
            console.log('📢 Application des nouveaux changements du conducteur');
        }
        
        // Forcer la régénération complète du HTML pour utiliser le nouveau format
        const audioControlsDiv = document.getElementById('audio-controls');
        if (audioControlsDiv) {
            console.log('[OnAir] Vidage complet des contrôles audio pour régénération');
            audioControlsDiv.innerHTML = '';
        }
        
        // Réinitialiser l'index si nécessaire
        if (this.segments && this.segments.length > 0 && this.currentSegmentIndex === -1) {
            this.currentSegmentIndex = 0;
        }
        
        this.loadRundown();
        
        // Recharger le segment actuel pour régénérer le HTML avec le nouveau format
        if (this.currentSegmentIndex >= 0 && this.segments && this.segments[this.currentSegmentIndex]) {
            console.log('[OnAir] Rechargement du segment actuel pour régénérer le HTML');
            setTimeout(() => {
                this.loadSegmentContent(this.segments[this.currentSegmentIndex]);
            }, 100);
        }
        
        // Réinitialiser l'état des changements
        this.hasNewChanges = false;
        this.lastConductorUpdate = JSON.stringify(this.conductorManager?.getSegments() || []);
        
        // Réinitialiser le bouton Refresh
        const refreshBtn = document.querySelector('.onair-navigation button[title="Rafraîchir"]');
        if (refreshBtn) {
            refreshBtn.classList.remove('has-updates');
            refreshBtn.style.background = '';
            refreshBtn.style.animation = '';
            refreshBtn.innerHTML = '🔄 Refresh';
        }
        
        // Afficher une notification de succès
        this.showSuccessNotification('✅ Conducteur mis à jour');
    }
    
    /**
     * Afficher une notification de succès
     */
    showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="position: fixed; top: 80px; right: 20px; background: #51cf66; color: white; 
                        padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                        z-index: 10000; animation: slideIn 0.3s ease-out;">
                ${message}
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Charger et afficher la conduite
     */
    loadRundown() {
        const tbody = document.getElementById('onair-rundown-body');
        if (!tbody) {
            console.error('onair-rundown-body not found');
            return;
        }

        // Vider le contenu existant
        tbody.innerHTML = '';

        // Récupérer les segments du conducteur
        this.segments = this.conductorManager?.getSegments() || [];
        
        if (this.segments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #999;">Aucun élément dans le conducteur</td></tr>';
            return;
        }

        let currentTime = 0;

        // Afficher chaque segment
        this.segments.forEach((segment, index) => {
            const row = document.createElement('tr');
            row.className = 'rundown-item';
            row.dataset.segmentId = segment.id;
            row.dataset.type = segment.type;
            
            // Calculer le hit time
            const hitTime = this.formatTime(currentTime);
            currentTime += this.parseDuration(segment.duration || '0:00');

            // Créer la ligne
            row.innerHTML = `
                <td class="col-pg">${index + 1}</td>
                <td class="col-format">
                    ${segment.type === 'news' ? '📰' : 
                      segment.type === 'animation' ? '🎵' : 
                      segment.type === 'block' ? '📦' : '📝'}
                </td>
                <td class="col-name">${segment.title || segment.name || 'Sans titre'}</td>
                <td class="col-duration">${segment.duration || '0:00'}</td>
                <td class="col-duration real-duration">${segment.actualDuration || segment.duration || '0:00'}</td>
                <td class="col-hit-time">${hitTime}</td>
            `;

            // Ajouter click handler
            row.addEventListener('click', () => {
                this.currentSegmentIndex = index;
                this.loadSegmentContent(segment);
            });

            tbody.appendChild(row);
        });
    }

    /**
     * Charger le contenu d'un segment
     */
    loadSegmentContent(segment) {
        const contentDiv = document.getElementById('onair-content');
        if (!contentDiv) return;

        console.log('Loading segment:', segment);

        // Marquer comme actif
        document.querySelectorAll('.rundown-item').forEach(row => {
            row.classList.remove('active');
        });
        const activeRow = document.querySelector(`[data-segment-id="${segment.id}"]`);
        if (activeRow) activeRow.classList.add('active');

        // Afficher le contenu selon le type
        if (segment.type === 'news') {
            // Utiliser getDatabase() et chercher l'item
            const newsDatabase = this.newsManager?.getDatabase() || [];
            const newsItem = newsDatabase.find(item => item.id === segment.newsId);
            if (newsItem) {
                this.displayNewsContent(newsItem, contentDiv);
            } else {
                console.warn(`News item not found: ${segment.newsId}`);
            }
        } else if (segment.type === 'animation') {
            // Utiliser getDatabase() et chercher l'item
            const animDatabase = this.animationManager?.getDatabase() || [];
            const animItem = animDatabase.find(item => item.id === segment.animationId);
            if (animItem) {
                this.displayAnimationContent(animItem, contentDiv);
            } else {
                console.warn(`Animation item not found: ${segment.animationId}`);
            }
        } else if (segment.type === 'block') {
            this.displayBlockContent(segment, contentDiv);
        } else {
            contentDiv.innerHTML = `
                <div style="padding: 2rem;">
                    <h2>${segment.title || 'Sans titre'}</h2>
                    <p>${segment.content || 'Aucun contenu'}</p>
                </div>
            `;
        }
    }

    /**
     * Extraire le texte pour l'affichage OnAir
     * Affiche uniquement ce qui est entre [LANCEMENT] et [/LANCEMENT]
     * et entre [DESANNONCE] et [/DESANNONCE]
     */
    extractLaunchText(content) {
        if (!content) return '';
        
        let extractedText = '';
        
        // Extraire le texte entre [LANCEMENT] et [/LANCEMENT]
        const launchRegex = /\[LANCEMENT\]([\s\S]*?)\[\/LANCEMENT\]/;
        const launchMatch = content.match(launchRegex);
        if (launchMatch && launchMatch[1]) {
            extractedText += launchMatch[1].trim() + '\n\n';
        }
        
        // Extraire le texte entre [DESANNONCE] et [/DESANNONCE]
        const desannonceRegex = /\[DESANNONCE\]([\s\S]*?)\[\/DESANNONCE\]/;
        const desannonceMatch = content.match(desannonceRegex);
        if (desannonceMatch && desannonceMatch[1]) {
            extractedText += desannonceMatch[1].trim();
        }
        
        // Si on a trouvé du texte entre les balises, le retourner
        if (extractedText.trim()) {
            return extractedText.trim();
        }
        
        // Sinon retourner le contenu original
        return content;
    }

    /**
     * Afficher le contenu d'une news
     */
    displayNewsContent(newsItem, container) {
        // Stocker l'item courant pour la gestion audio
        this.currentContent = newsItem;

        // Build HTML for news with lancement, audio indicator, and pied
        let contentHTML = '';

        // Extract text between tags
        const content = newsItem.content || '';
        const launchRegex = /\[LANCEMENT\]([\s\S]*?)\[\/LANCEMENT\]/;
        const desannonceRegex = /\[DESANNONCE\]([\s\S]*?)\[\/DESANNONCE\]/;
        const launchMatch = content.match(launchRegex);
        const desannonceMatch = content.match(desannonceRegex);

        // 1. LANCEMENT section
        if (launchMatch && launchMatch[1] && launchMatch[1].trim()) {
            contentHTML += `
                <div class="onair-section">
                    <div class="onair-section-label">📢 LANCEMENT</div>
                    <div class="onair-section-content">
                        ${launchMatch[1].trim().replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // 2. AUDIO indicator (if sounds exist)
        if (newsItem.sounds && newsItem.sounds.length > 0) {
            contentHTML += `
                <div class="onair-section">
                    <div class="onair-section-label">🎵 AUDIO</div>
                    <div class="onair-section-content audio-indicator">
                        <em>▶ Lecture audio ci-dessous (${newsItem.sounds.length} son(s))</em>
                    </div>
                </div>
            `;
        }

        // 3. PIED / DÉSANNONCE section
        if (desannonceMatch && desannonceMatch[1] && desannonceMatch[1].trim()) {
            contentHTML += `
                <div class="onair-section">
                    <div class="onair-section-label">🎙️ PIED / DÉSANNONCE</div>
                    <div class="onair-section-content">
                        ${desannonceMatch[1].trim().replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // If no structured content found, show full content
        if (!contentHTML) {
            contentHTML = `
                <div class="onair-content-text">
                    ${content ? content.replace(/\n/g, '<br>') : 'Aucun contenu'}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="onair-item-content">
                <div class="onair-item-header">
                    <h2>📰 ${newsItem.title}</h2>
                    <span class="duration">${newsItem.duration || '0:00'}</span>
                </div>
                ${contentHTML}
            </div>
        `;

        // Afficher les contrôles audio en bas si des sons existent
        this.setupAudioControls(newsItem);
    }
    
    /**
     * Configurer les contrôles audio
     */
    setupAudioControls(item) {
        const controlsDiv = document.getElementById('audio-controls');
        if (!controlsDiv) {
            console.warn('[OnAir] Div audio-controls non trouvée');
            return;
        }
        
        if (!item.sounds || item.sounds.length === 0) {
            controlsDiv.innerHTML = '';
            return;
        }
        
        console.log('[OnAir] Configuration des contrôles audio avec le nouveau format');
        console.log('[OnAir] Sons à afficher:', item.sounds);
        
        // Créer les contrôles pour chaque son
        controlsDiv.innerHTML = `
            <div class="audio-controls-container">
                ${item.sounds.map(sound => {
                    // Stocker les données dans des attributs data pour éviter les problèmes d'échappement
                    let audioUrl = sound.url || sound.audioUrl || '';
                    
                    // IMPORTANT: Corriger l'URL pour utiliser S3 direct (CloudFront redirige tout vers index.html)
                    if (window.audioUrlFixer) {
                        audioUrl = window.audioUrlFixer.fixUrl(audioUrl);
                    }
                    
                    console.log('[OnAir] Configuration son:', { 
                        audioFileId: sound.audioFileId, 
                        name: sound.name,
                        url: audioUrl 
                    });
                    
                    return `
                    <div class="audio-control-item" 
                         data-audio-id="${sound.audioFileId}" 
                         data-audio-url="${audioUrl}"
                         data-audio-name="${(sound.name || '').replace(/"/g, '&quot;')}"
                         data-audio-duration="${sound.duration || '0:00'}">
                        <div class="audio-info">
                            <span class="audio-name">🎵 ${sound.name}</span>
                            <span class="audio-type">${sound.type || 'audio'}</span>
                        </div>
                        <div class="audio-timer">
                            <span class="audio-duration">${sound.duration}</span>
                            <span class="audio-countdown" id="countdown-${sound.audioFileId}" style="display: none;">
                                <span class="countdown-value">0:00</span>
                            </span>
                        </div>
                        <button class="audio-play-btn" onclick="window.app.onAirComponent.playAudioFromElement(this)">
                            <span class="play-icon">▶️</span>
                        </button>
                    </div>
                `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Passer à l'élément suivant
     */
    nextItem() {
        // Arrêter l'audio en cours si nécessaire
        this.stopCurrentAudio();
        
        // Passer au segment suivant
        if (this.segments.length > 0) {
            this.currentSegmentIndex = (this.currentSegmentIndex + 1) % this.segments.length;
            const nextSegment = this.segments[this.currentSegmentIndex];
            
            if (nextSegment) {
                this.loadSegmentContent(nextSegment);
                
                // Faire défiler la table pour montrer l'élément actif
                const activeRow = document.querySelector(`[data-segment-id="${nextSegment.id}"]`);
                if (activeRow) {
                    activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    /**
     * Passer à l'élément précédent
     */
    previousItem() {
        // Arrêter l'audio en cours si nécessaire
        this.stopCurrentAudio();
        
        // Passer au segment précédent
        if (this.segments.length > 0) {
            this.currentSegmentIndex = this.currentSegmentIndex <= 0 ? 
                this.segments.length - 1 : this.currentSegmentIndex - 1;
            const prevSegment = this.segments[this.currentSegmentIndex];
            
            if (prevSegment) {
                this.loadSegmentContent(prevSegment);
                
                // Faire défiler la table pour montrer l'élément actif
                const activeRow = document.querySelector(`[data-segment-id="${prevSegment.id}"]`);
                if (activeRow) {
                    activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    /**
     * Afficher le contenu d'une animation
     */
    displayAnimationContent(animItem, container) {
        // Stocker l'item courant pour la gestion audio
        this.currentContent = animItem;

        // Build HTML for animation with lancement, audio indicator, and pied
        let contentHTML = '';

        // 1. LANCEMENT (before audio)
        if (animItem.lancement && animItem.lancement.trim()) {
            contentHTML += `
                <div class="onair-section">
                    <div class="onair-section-label">📢 LANCEMENT</div>
                    <div class="onair-section-content">
                        ${animItem.lancement.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // 2. AUDIO indicator (audio controls will be shown below)
        if (animItem.audioUrl || animItem.audioFileName) {
            contentHTML += `
                <div class="onair-section">
                    <div class="onair-section-label">🎵 AUDIO</div>
                    <div class="onair-section-content audio-indicator">
                        <em>▶ Lecture audio ci-dessous</em>
                    </div>
                </div>
            `;
        }

        // 3. PIED (after audio)
        if (animItem.pied && animItem.pied.trim()) {
            contentHTML += `
                <div class="onair-section">
                    <div class="onair-section-label">🎙️ PIED / DÉSANNONCE</div>
                    <div class="onair-section-content">
                        ${animItem.pied.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // If no content at all, show fallback
        if (!contentHTML) {
            contentHTML = `
                <div class="onair-content-text">
                    ${animItem.content ? animItem.content.replace(/\n/g, '<br>') : 'Aucun contenu'}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="onair-item-content">
                <div class="onair-item-header">
                    <h2>🎵 ${animItem.title}</h2>
                    <span class="duration">${animItem.duration || '0:00'}</span>
                </div>
                ${contentHTML}
            </div>
        `;

        // Afficher les contrôles audio en bas si des sons existent
        this.setupAudioControls(animItem);
    }

    /**
     * Afficher le contenu d'un bloc
     */
    displayBlockContent(segment, container) {
        // Stocker l'item courant
        this.currentContent = segment;
        
        container.innerHTML = `
            <div class="onair-item-content">
                <div class="onair-item-header">
                    <h2>📦 ${segment.title || 'Bloc'}</h2>
                    <span class="duration">${segment.duration || '0:00'}</span>
                </div>
                <div class="onair-content-text">
                    ${segment.content || 'Contenu du bloc'}
                </div>
            </div>
        `;
        
        // Nettoyer les contrôles audio car les blocs n'ont pas de sons
        const controlsDiv = document.getElementById('audio-controls');
        if (controlsDiv) {
            controlsDiv.innerHTML = '';
        }
    }

    /**
     * Formater le temps en HH:MM:SS
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Parser la durée MM:SS en secondes
     */
    parseDuration(duration) {
        if (!duration) return 0;
        const parts = duration.split(':');
        if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return 0;
    }

    /**
     * Jouer un son depuis l'élément HTML (lit les données depuis les attributs data)
     */
    playAudioFromElement(button) {
        console.log('[OnAir] playAudioFromElement appelé');
        const container = button.closest('.audio-control-item');
        if (!container) {
            console.error('[OnAir] Container non trouvé');
            return;
        }
        
        // Lire les données depuis les attributs data
        const audioFileId = container.dataset.audioId;
        const audioUrl = container.dataset.audioUrl;
        const audioName = container.dataset.audioName;
        const audioDuration = container.dataset.audioDuration;
        
        console.log('[OnAir] Lecture audio:', {
            audioFileId,
            audioUrl,
            audioName,
            audioDuration
        });
        
        // Appeler playSound avec les données
        this.playSound(audioFileId, audioName, audioDuration, audioUrl || null);
    }
    
    /**
     * Jouer un son - Adapté pour URLs S3
     */
    async playSound(audioFileId, soundName, duration, audioUrl = null) {
        // Stop current audio if playing
        this.stopCurrentAudio();
        
        try {
            let audioSrc;
            
            // Si une URL est fournie et qu'elle est sur saint-esprit-audio, l'utiliser
            if (audioUrl && audioUrl.includes('saint-esprit-audio')) {
                audioSrc = audioUrl;
                console.log(`[OnAir] Using provided S3 URL: ${audioSrc}`);
            } else {
                // Sinon, essayer de récupérer depuis storage (pour compatibilité)
                const audioData = await window.app.storage.getAudioFile(audioFileId);
                if (!audioData) {
                    console.error(`[OnAir] Audio file not found: ${audioFileId}`);
                    alert('Audio file not found');
                    return;
                }
                audioSrc = audioData.data || audioData.url;
                console.log(`[OnAir] Playing audio from storage: ${audioSrc}`);
            }
            
            // Créer élément audio avec source appropriée
            this.currentAudioElement = new Audio(audioSrc);
            this.currentAudioId = audioFileId;
            
            // Mise à jour interface
            const controlItem = document.querySelector(`[data-audio-id="${audioFileId}"]`);
            if (controlItem) {
                controlItem.classList.add('playing');
                const playBtn = controlItem.querySelector('.audio-play-btn');
                if (playBtn) {
                    playBtn.innerHTML = '<span class="play-icon">⏸️</span>';
                    playBtn.onclick = () => this.stopCurrentAudio();
                }
            }
            
            // Afficher le décompte
            const countdownEl = document.getElementById(`countdown-${audioFileId}`);
            if (countdownEl) {
                countdownEl.style.display = 'inline-block';
            }
            
            // Logique de timing avec couleur
            const durationSeconds = this.parseDuration(duration);
            this.updateAudioTime(audioFileId, durationSeconds);
            
            this.audioInterval = setInterval(() => {
                if (this.currentAudioElement) {
                    const elapsed = Math.floor(this.currentAudioElement.currentTime);
                    const remaining = Math.max(0, durationSeconds - elapsed);
                    this.updateAudioTime(audioFileId, remaining);
                    
                    // Changer la couleur selon le temps restant
                    const countdownValue = document.querySelector(`#countdown-${audioFileId} .countdown-value`);
                    if (countdownValue) {
                        if (remaining <= 5) {
                            countdownValue.style.color = '#ff0000'; // Rouge
                            countdownValue.style.fontWeight = 'bold';
                        } else if (remaining <= 10) {
                            countdownValue.style.color = '#ff8800'; // Orange
                        } else if (remaining <= 20) {
                            countdownValue.style.color = '#ffaa00'; // Jaune
                        } else {
                            countdownValue.style.color = '#00ff00'; // Vert
                        }
                    }
                    
                    if (remaining === 0) {
                        this.stopCurrentAudio();
                    }
                }
            }, 100);
            
            this.currentAudioElement.play();
            
            this.currentAudioElement.addEventListener('ended', () => {
                this.stopCurrentAudio();
            });
            
        } catch (error) {
            console.error('Error playing audio:', error);
            alert('Error playing audio file');
        }
    }

    /**
     * Arrêter l'audio en cours
     */
    stopCurrentAudio() {
        if (this.currentAudioElement) {
            this.currentAudioElement.pause();
            this.currentAudioElement = null;
        }
        
        if (this.audioInterval) {
            clearInterval(this.audioInterval);
            this.audioInterval = null;
        }
        
        // Réinitialiser interface
        document.querySelectorAll('.audio-control-item').forEach(item => {
            item.classList.remove('playing');
            const playBtn = item.querySelector('.audio-play-btn');
            if (playBtn) {
                playBtn.innerHTML = '<span class="play-icon">▶️</span>';
                // Pas besoin de restaurer l'onclick, il utilise déjà playSoundFromData
            }
        });
        
        // Cacher et réinitialiser le décompte
        if (this.currentAudioId) {
            const countdownEl = document.getElementById(`countdown-${this.currentAudioId}`);
            if (countdownEl) {
                countdownEl.style.display = 'none';
                const countdownValue = countdownEl.querySelector('.countdown-value');
                if (countdownValue) {
                    countdownValue.style.color = '';
                    countdownValue.style.fontWeight = '';
                }
            }
        }
        
        this.currentAudioId = null;
    }

    /**
     * Afficher les sons - Adapté pour inclure URLs
     */
    renderSounds(sounds) {
        if (!sounds || sounds.length === 0) {
            return '<div class="audio-controls-empty">Aucun son ajouté</div>';
        }

        let html = '';
        sounds.forEach(sound => {
            const icon = sound.type === 'jingle' ? '🎵' : '🎬';
            const sanitizedName = this.sanitizeHTML(sound.name);
            const audioUrl = sound.url || sound.audioUrl || '';
            
            html += `
                <div class="audio-control-item" 
                     data-audio-id="${sound.audioFileId}" 
                     data-audio-url="${audioUrl}"
                     data-audio-name="${sanitizedName.replace(/"/g, '&quot;')}"
                     data-audio-duration="${sound.duration || '0:00'}">
                    <button class="audio-play-btn" onclick="window.app.onAirComponent.playAudioFromElement(this)">
                        <span class="play-icon">▶️</span>
                    </button>
                    <div class="audio-info">
                        <span class="audio-name">${icon} ${sanitizedName}</span>
                        <span class="audio-duration" data-original-duration="${sound.duration}" id="audio-time-${sound.audioFileId}">${sound.duration}</span>
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    /**
     * Méthodes utilitaires inchangées
     */
    parseDuration(duration) {
        if (!duration) return 0;
        const parts = duration.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }

    updateAudioTime(audioFileId, seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        // Mettre à jour le décompte
        const countdownValue = document.querySelector(`#countdown-${audioFileId} .countdown-value`);
        if (countdownValue) {
            countdownValue.textContent = timeStr;
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Méthodes prompteur inchangées
     */
    startPrompter() {
        const prompterContent = document.getElementById('prompter-content');
        if (!prompterContent) return;

        this.scrollInterval = setInterval(() => {
            prompterContent.scrollTop += this.currentPrompterSpeed;
        }, 50);
    }

    stopPrompter() {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    }

    resetPrompter() {
        this.stopPrompter();
        const prompterContent = document.getElementById('prompter-content');
        if (prompterContent) {
            prompterContent.scrollTop = 0;
        }
    }

    adjustPrompterSpeed(delta) {
        this.currentPrompterSpeed = Math.max(1, Math.min(10, this.currentPrompterSpeed + delta));
        document.getElementById('prompter-speed').textContent = this.currentPrompterSpeed;
    }

    /**
     * Méthodes de rendu principal
     */
    render(content, block) {
        this.currentContent = content;
        this.currentBlock = block;

        const container = document.getElementById('on-air-display');
        if (!container) return;

        container.innerHTML = `
            <div class="on-air-header">
                <h2>${this.sanitizeHTML(content.title || 'Sans titre')}</h2>
                <div class="on-air-metadata">
                    <span class="on-air-type">${content.type === 'news' ? '📰 News' : '🎬 Animation'}</span>
                    ${block ? `<span class="on-air-block">📁 ${this.sanitizeHTML(block.name)}</span>` : ''}
                    <span class="on-air-duration">⏱ ${content.estimatedDuration || '0:00'}</span>
                </div>
            </div>

            <div class="on-air-content">
                <div class="prompter-container">
                    <div class="prompter-controls">
                        <button onclick="app.onAir.startPrompter()">▶️ Play</button>
                        <button onclick="app.onAir.stopPrompter()">⏸ Pause</button>
                        <button onclick="app.onAir.resetPrompter()">⏮ Reset</button>
                        <button onclick="app.onAir.adjustPrompterSpeed(-1)">🐢 Slower</button>
                        <span id="prompter-speed">${this.currentPrompterSpeed}</span>
                        <button onclick="app.onAir.adjustPrompterSpeed(1)">🐇 Faster</button>
                    </div>
                    <div id="prompter-content" class="prompter-text">
                        ${content.content || 'Aucun contenu'}
                    </div>
                </div>

                <div class="audio-controls-container">
                    <h3>🎵 Sons associés</h3>
                    <div id="audio-controls">
                        ${this.renderSounds(content.sounds)}
                    </div>
                </div>
            </div>

            <div class="on-air-footer">
                <button onclick="app.showSection('${content.type}')" class="btn-secondary">
                    ← Retour
                </button>
                ${content.tags?.includes('urgent') ? '<span class="tag-urgent">🔴 URGENT</span>' : ''}
                ${content.tags?.includes('ready') ? '<span class="tag-ready">✅ PRÊT</span>' : ''}
            </div>
        `;

        // Reset prompter au chargement
        this.resetPrompter();
    }
}

// Export global
window.OnAir = OnAir;