/**
 * OnAirFix - Patch pour que OnAir utilise les URLs audio
 * À intégrer dans OnAir.js
 */

// Remplacer la méthode playSound dans OnAir.js par celle-ci :
async function playSound(audioFileId, soundName, duration, audioUrl = null) {
    // Stop current audio if playing
    this.stopCurrentAudio();
    
    // Pause speaking timer
    this.isSpeaking = false;
    
    try {
        // Priorité 1 : Utiliser l'URL si disponible
        if (audioUrl) {
            console.log(`🎵 Lecture depuis URL: ${audioUrl}`);
            this.currentAudioElement = new Audio(audioUrl);
        } 
        // Priorité 2 : Chercher dans IndexedDB (ancien système)
        else {
            console.log(`📁 Lecture depuis IndexedDB: ${audioFileId}`);
            const audioData = await window.app.storage.getAudioFile(audioFileId);
            if (!audioData) {
                alert('Fichier audio non trouvé localement.\nDemandez à l\'émetteur de refaire un "Upload TOUT".');
                this.isSpeaking = true;
                return;
            }
            this.currentAudioElement = new Audio(audioData.data);
        }
        
        // Update UI to show playing state
        const controlItem = document.querySelector(`[data-audio-id="${audioFileId}"]`);
        if (controlItem) {
            controlItem.classList.add('playing');
            const playBtn = controlItem.querySelector('.audio-play-btn');
            if (playBtn) {
                playBtn.innerHTML = '<span class="play-icon">⏸️</span>';
                playBtn.onclick = () => this.stopCurrentAudio();
            }
        }
        
        // Show countdown
        const countdownEl = safeGetElement(`countdown-${audioFileId}`);
        if (countdownEl) {
            countdownEl.style.display = 'inline';
        }
        
        // Update time display
        const durationSeconds = Utils.parseDuration(duration);
        this.updateAudioTime(audioFileId, durationSeconds);
        
        // Start countdown
        this.audioInterval = setInterval(() => {
            if (this.currentAudioElement) {
                const remaining = Math.max(0, durationSeconds - Math.floor(this.currentAudioElement.currentTime));
                this.updateAudioTime(audioFileId, remaining);
                
                if (remaining === 0) {
                    this.stopCurrentAudio();
                }
            }
        }, 100);
        
        // Play audio
        this.currentAudioElement.play().catch(error => {
            console.error('Erreur lecture audio:', error);
            alert('Erreur lors de la lecture.\nVérifiez votre connexion internet si l\'audio est en ligne.');
            this.stopCurrentAudio();
            this.isSpeaking = true;
        });
        
        // Handle audio end
        this.currentAudioElement.addEventListener('ended', () => {
            this.stopCurrentAudio();
        });
        
    } catch (error) {
        console.error('Error playing audio:', error);
        alert('Erreur lors de la lecture du fichier audio');
        this.isSpeaking = true;
    }
}

// Aussi modifier setupAudioControls pour passer l'URL :
function setupAudioControlsFixed(item) {
    const controlsDiv = safeGetElement('audio-controls');
    if (!controlsDiv) return;
    
    // Check if there's no audio content
    const hasExportedAudio = item.hasAudio && item.audioData;
    const hasSounds = item.sounds && item.sounds.length > 0;
    
    if (!hasExportedAudio && !hasSounds) {
        controlsDiv.innerHTML = '';
        return;
    }
    
    let html = '<div class="audio-controls-container">';
    
    // Add exported multitrack audio if present
    if (hasExportedAudio) {
        const audioId = `exported-${item.id}`;
        const duration = item.actualDuration || item.duration || '0:00';
        html += `
            <div class="audio-control-item" 
                 data-audio-id="${audioId}" 
                 data-item-id="${item.id}"
                 data-sound-name="${sanitizeHTML(item.title || 'Mix audio')}"
                 data-duration="${duration}"
                 style="border: 1px solid #00ff9f; background: rgba(0, 255, 159, 0.1);">
                <button class="audio-play-btn exported-audio-btn">
                    <span class="play-icon">▶️</span>
                </button>
                <div class="audio-info">
                    <span class="audio-name">🎚️ EXPORT MULTIPISTE - ${sanitizeHTML(item.title || 'Mix audio')}</span>
                    <div class="audio-duration-container">
                        <span class="audio-duration" id="audio-time-${audioId}">${duration}</span>
                        <span class="countdown" id="countdown-${audioId}" style="display: none; margin-left: 10px; font-weight: bold;"></span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add individual sounds - AVEC L'URL !
    if (hasSounds) {
        item.sounds.forEach(sound => {
            const icon = Constants.SOUND_ICONS[sound.type] || '📻';
            
            // Passer l'URL si disponible
            const audioUrl = sound.audioUrl ? `'${sound.audioUrl}'` : 'null';
            
            html += `
                <div class="audio-control-item" data-audio-id="${sound.audioFileId}">
                    <button class="audio-play-btn" onclick="window.app.onAirComponent.playSound('${sound.audioFileId}', '${sound.name}', '${sound.duration}', ${audioUrl})">
                        <span class="play-icon">▶️</span>
                    </button>
                    <div class="audio-info">
                        <span class="audio-name">${icon} ${sanitizeHTML(sound.name)}</span>
                        ${sound.audioUrl ? '<span style="color: #00B4D8; font-size: 10px;">☁️</span>' : ''}
                        <div class="audio-duration-container">
                            <span class="audio-duration" id="audio-time-${sound.audioFileId}">${sound.duration}</span>
                            <span class="countdown" id="countdown-${sound.audioFileId}" style="display: none; margin-left: 10px; font-weight: bold;"></span>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    controlsDiv.innerHTML = html;
    
    // Add event listeners for exported audio buttons
    const exportedButtons = controlsDiv.querySelectorAll('.exported-audio-btn');
    exportedButtons.forEach(btn => {
        const controlItem = btn.closest('.audio-control-item');
        if (controlItem) {
            const itemId = controlItem.dataset.itemId;
            const soundName = controlItem.dataset.soundName;
            const duration = controlItem.dataset.duration;
            btn.addEventListener('click', () => {
                this.playExportedAudio(parseInt(itemId), soundName, duration);
            });
        }
    });
}