/* ===== SAINT-ESPRIT V3 - APP LOGIC ===== */

class SaintEspritV3 {
    constructor() {
        this.currentView = 'dashboard';
        this.storage = null;
        this.newsManager = null;
        this.durationManager = null;
        this.currentNews = null;
        this.allNews = [];
        this.audioPlayer = null;
        this.audioPlayerUrl = null;
        this.isPlaying = false;
        this.audioEditor = null;
        this.previousView = null; // Pour retour depuis audio editor
        this.init();
    }

    async init() {
        console.log('🚀 Saint-Esprit V3 initializing...');

        // Wait for Cognito auth
        if (window.cognitoAuth) {
            await window.cognitoAuth.waitForAuth();
            this.updateUserDisplay();
        }

        // Initialize storage
        await this.initStorage();

        // Setup navigation
        this.setupNavigation();

        // Update dashboard
        this.updateDashboard();

        // Show current date
        this.updateDate();

        console.log('✅ Saint-Esprit V3 ready!');
    }

    async initStorage() {
        try {
            // Use existing DynamoDB storage
            if (typeof StorageDynamoDB !== 'undefined') {
                this.storage = new StorageDynamoDB();
                await this.storage.init();
                console.log('✅ Storage initialized');
            }

            // Initialize Duration Manager
            if (typeof NewsDurationManager !== 'undefined') {
                this.durationManager = new NewsDurationManager();
                console.log('✅ Duration Manager initialized');
            }
        } catch (error) {
            console.error('❌ Storage init failed:', error);
        }
    }

    setupNavigation() {
        // Sidebar navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });

        // News search
        const newsSearch = document.getElementById('news-search');
        if (newsSearch) {
            newsSearch.addEventListener('input', (e) => {
                this.filterNews(e.target.value);
            });
        }
    }

    switchView(viewName) {
        console.log(`📍 Switching to ${viewName}`);

        // Update navigation active state
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;

            // Load data for specific views
            if (viewName === 'news') {
                this.loadNews();
            }
        }
    }

    updateUserDisplay() {
        const userName = localStorage.getItem('saint-esprit-user-fullname') ||
                        localStorage.getItem('saint-esprit-user-name') ||
                        'Utilisateur';

        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = userName;

        const welcomeNameEl = document.getElementById('welcome-name');
        if (welcomeNameEl) {
            const firstName = userName.split(' ')[0];
            welcomeNameEl.textContent = firstName;
        }
    }

    updateDate() {
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('fr-FR', options);
        }
    }

    async updateDashboard() {
        if (!this.storage) return;

        try {
            const data = await this.storage.load();
            const news = data.news || [];
            const today = new Date().toISOString().split('T')[0];
            const todayNews = news.filter(n => n.scheduledDate === today);

            const newsCountEl = document.getElementById('news-count');
            if (newsCountEl) {
                newsCountEl.textContent = `${todayNews.length} aujourd'hui`;
            }
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }

    async loadNews() {
        if (!this.storage) return;

        try {
            const data = await this.storage.load();
            const news = data.news || [];
            console.log(`📰 Loaded ${news.length} news`);

            // Store full news list for filtering
            this.allNews = news;

            const newsList = document.getElementById('news-list');
            if (news.length === 0) {
                newsList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📰</div>
                        <p>Aucune news</p>
                        <button class="btn btn-secondary" onclick="app.createNews()">Créer une news</button>
                    </div>
                `;
                return;
            }

            // Display news list
            this.displayNewsList(news);

        } catch (error) {
            console.error('Error loading news:', error);
        }
    }

    displayNewsList(news) {
        const newsList = document.getElementById('news-list');
        if (!newsList) return;

        if (news.length === 0) {
            newsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>Aucun résultat</p>
                </div>
            `;
            return;
        }

        newsList.innerHTML = news.map(n => `
            <div class="news-item ${this.currentNews && this.currentNews.id === n.id ? 'active' : ''}" onclick="app.editNews('${n.id}')">
                <div class="news-title">${n.title || 'Sans titre'}</div>
                <div class="news-meta">${n.scheduledDate || ''} • ${n.author || ''}</div>
            </div>
        `).join('');
    }

    filterNews(searchTerm) {
        if (!this.allNews) return;

        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            // No search term, show all news
            this.displayNewsList(this.allNews);
            return;
        }

        // Filter news by title, content, author, category
        const filtered = this.allNews.filter(n => {
            return (
                (n.title && n.title.toLowerCase().includes(term)) ||
                (n.content && n.content.toLowerCase().includes(term)) ||
                (n.author && n.author.toLowerCase().includes(term)) ||
                (n.category && n.category.toLowerCase().includes(term))
            );
        });

        this.displayNewsList(filtered);
        console.log(`🔍 Filtered: ${filtered.length}/${this.allNews.length} news`);
    }

    createNews() {
        console.log('📝 Creating new news...');

        const now = new Date();
        const userName = localStorage.getItem('saint-esprit-user-fullname') ||
                        localStorage.getItem('saint-esprit-user-name') ||
                        'Utilisateur';

        // Clear audio
        this.stopAudio();
        if (this.audioPlayerUrl) {
            URL.revokeObjectURL(this.audioPlayerUrl);
            this.audioPlayerUrl = null;
        }
        this.audioPlayer = null;

        if (this.durationManager) {
            this.durationManager.clearAudio();
        }

        this.currentNews = {
            id: `news-${Date.now()}`,
            title: '',
            content: '',
            category: 'general',
            author: userName,
            scheduledDate: now.toISOString().split('T')[0],
            scheduledTime: now.toTimeString().slice(0,5),
            duration: '0:30',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.showNewsEditor();
    }

    async editNews(newsId) {
        console.log(`✏️ Editing news ${newsId}`);

        // Stop any playing audio
        this.stopAudio();

        try {
            const data = await this.storage.load();
            const news = (data.news || []).find(n => n.id === newsId);
            if (news) {
                this.currentNews = news;
                this.showNewsEditor();
                this.loadNews(); // Refresh list to show active item
            }
        } catch (error) {
            console.error('Error loading news:', error);
        }
    }

    showNewsEditor() {
        const editor = document.getElementById('news-editor');
        if (!editor) return;

        editor.innerHTML = `
            <div class="editor-form">
                <div class="editor-header">
                    <h3>${this.currentNews.id.startsWith('news-') && this.currentNews.id.includes(Date.now().toString().slice(0, -3)) ? 'Nouvelle News' : 'Édition'}</h3>
                    <div class="editor-actions">
                        <button class="btn btn-secondary" onclick="app.closeEditor()">Annuler</button>
                        <button class="btn btn-primary" onclick="app.saveNews()">💾 Enregistrer</button>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Titre</label>
                        <input type="text" id="news-title" value="${this.currentNews.title || ''}" placeholder="Titre de la news">
                    </div>
                </div>

                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label>Catégorie</label>
                        <select id="news-category">
                            <option value="general" ${this.currentNews.category === 'general' ? 'selected' : ''}>Info générale</option>
                            <option value="international" ${this.currentNews.category === 'international' ? 'selected' : ''}>International</option>
                            <option value="national" ${this.currentNews.category === 'national' ? 'selected' : ''}>National</option>
                            <option value="local" ${this.currentNews.category === 'local' ? 'selected' : ''}>Local</option>
                            <option value="sport" ${this.currentNews.category === 'sport' ? 'selected' : ''}>Sport</option>
                            <option value="culture" ${this.currentNews.category === 'culture' ? 'selected' : ''}>Culture</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="news-date" value="${this.currentNews.scheduledDate || ''}">
                    </div>

                    <div class="form-group">
                        <label>Heure</label>
                        <input type="time" id="news-time" value="${this.currentNews.scheduledTime || ''}">
                    </div>
                </div>

                <div class="form-group">
                    <label>Contenu</label>
                    <textarea id="news-content" rows="10" placeholder="Contenu de la news...">${this.currentNews.content || ''}</textarea>
                </div>

                <!-- Audio Upload -->
                <div class="form-group">
                    <label>Fichier Audio (optionnel)</label>
                    <div class="audio-upload" id="audio-upload">
                        <div class="audio-upload-prompt">
                            <div class="upload-icon">🎵</div>
                            <p>Cliquez ou glissez un fichier audio</p>
                            <small>MP3, WAV, OGG</small>
                        </div>
                        <div class="audio-file-info" style="display: none;">
                            <div class="audio-info-text">
                                <div class="audio-file-name"></div>
                                <div class="audio-file-meta">
                                    Durée: <span class="audio-file-duration">0:00</span> •
                                    <span class="audio-file-size">0 KB</span>
                                </div>
                            </div>
                            <div class="audio-controls">
                                <button type="button" class="btn btn-secondary btn-sm" id="audio-play-btn" onclick="app.toggleAudioPlayback()">▶️ Écouter</button>
                                <button type="button" class="btn btn-primary btn-sm" onclick="app.openAudioEditor()">✂️ Éditer</button>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="app.removeAudio()">🗑️ Supprimer</button>
                            </div>
                        </div>
                        <input type="file" id="audio-file-input" accept="audio/*" style="display: none;">
                    </div>
                </div>

                <!-- Duration Display -->
                <div class="duration-display">
                    <div class="duration-box">
                        <div class="duration-label">⏱️ Temps de lecture</div>
                        <div class="duration-value" id="reading-duration">0:00</div>
                    </div>
                    <div class="duration-box">
                        <div class="duration-label">🎵 Durée audio</div>
                        <div class="duration-value" id="audio-duration">0:00</div>
                    </div>
                    <div class="duration-box duration-box-total">
                        <div class="duration-label">📊 Durée totale</div>
                        <div class="duration-value" id="total-duration">0:00</div>
                    </div>
                </div>
            </div>
        `;

        // Setup event listeners
        this.setupEditorListeners();

        // Restore audio info if exists (async)
        if (this.currentNews.audioFileName && this.currentNews.audioDuration) {
            this.restoreAudioInfo().catch(err => {
                console.error('Error restoring audio:', err);
            });
        }

        // Update durations
        this.updateDurations();
    }

    setupEditorListeners() {
        // Content change -> update reading time
        const contentEl = document.getElementById('news-content');
        if (contentEl) {
            contentEl.addEventListener('input', () => this.updateDurations());
        }

        // Audio upload setup
        const uploadArea = document.getElementById('audio-upload');
        const fileInput = document.getElementById('audio-file-input');

        if (uploadArea && fileInput) {
            // Click to upload
            uploadArea.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    fileInput.click();
                }
            });

            // File selected
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) await this.handleAudioUpload(file);
            });

            // Drag & drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', async (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');

                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('audio/')) {
                    await this.handleAudioUpload(file);
                }
            });
        }
    }

    async handleAudioUpload(file) {
        if (!this.durationManager) return;

        try {
            const audioInfo = await this.durationManager.handleAudioUpload(file);

            // Stop any existing audio and revoke old URL
            this.stopAudio();
            if (this.audioPlayerUrl) {
                URL.revokeObjectURL(this.audioPlayerUrl);
            }

            // Create audio player for playback
            this.audioPlayerUrl = URL.createObjectURL(file);
            this.audioPlayer = new Audio(this.audioPlayerUrl);
            this.audioPlayer.addEventListener('ended', () => {
                this.isPlaying = false;
                this.updatePlayButton();
            });

            // Save audio info to current news
            if (this.currentNews) {
                this.currentNews.audioFileName = audioInfo.name;
                this.currentNews.audioDuration = audioInfo.duration;
                this.currentNews.audioSize = audioInfo.size;
            }

            // Update UI
            const uploadArea = document.getElementById('audio-upload');
            if (uploadArea) {
                uploadArea.classList.add('has-file');
                const prompt = uploadArea.querySelector('.audio-upload-prompt');
                const info = uploadArea.querySelector('.audio-file-info');

                if (prompt) prompt.style.display = 'none';
                if (info) {
                    info.style.display = 'flex';
                    info.querySelector('.audio-file-name').textContent = audioInfo.name;
                    info.querySelector('.audio-file-duration').textContent = audioInfo.durationFormatted;
                    info.querySelector('.audio-file-size').textContent = this.formatFileSize(audioInfo.size);
                }
            }

            // Update durations
            this.updateDurations();

            console.log('✅ Audio uploaded:', audioInfo.name);
        } catch (error) {
            console.error('❌ Audio upload error:', error);
            alert(error.message);
        }
    }

    toggleAudioPlayback() {
        if (!this.audioPlayer) {
            console.error('No audio player available');
            alert('Aucun fichier audio chargé');
            return;
        }

        if (this.isPlaying) {
            this.audioPlayer.pause();
            this.isPlaying = false;
            this.updatePlayButton();
        } else {
            const playPromise = this.audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        this.isPlaying = true;
                        this.updatePlayButton();
                    })
                    .catch(error => {
                        console.error('Error playing audio:', error);
                        alert('Erreur lors de la lecture audio');
                    });
            }
        }
    }

    stopAudio() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
            this.isPlaying = false;
        }
    }

    updatePlayButton() {
        const playBtn = document.getElementById('audio-play-btn');
        if (playBtn) {
            playBtn.textContent = this.isPlaying ? '⏸️ Pause' : '▶️ Écouter';
        }
    }

    removeAudio() {
        // Stop audio playback
        this.stopAudio();

        // Revoke object URL
        if (this.audioPlayerUrl) {
            URL.revokeObjectURL(this.audioPlayerUrl);
            this.audioPlayerUrl = null;
        }
        this.audioPlayer = null;

        if (this.durationManager) {
            this.durationManager.clearAudio();
        }

        // Remove audio info from current news
        if (this.currentNews) {
            delete this.currentNews.audioFileName;
            delete this.currentNews.audioDuration;
            delete this.currentNews.audioSize;
        }

        const uploadArea = document.getElementById('audio-upload');
        if (uploadArea) {
            uploadArea.classList.remove('has-file');
            const prompt = uploadArea.querySelector('.audio-upload-prompt');
            const info = uploadArea.querySelector('.audio-file-info');

            if (prompt) prompt.style.display = 'block';
            if (info) info.style.display = 'none';
        }

        const fileInput = document.getElementById('audio-file-input');
        if (fileInput) fileInput.value = '';

        this.updateDurations();
    }

    async restoreAudioInfo() {
        if (!this.currentNews.audioFileName || !this.currentNews.audioDuration) return;

        // Restore duration in manager
        if (this.durationManager) {
            this.durationManager.setAudioDuration(this.currentNews.audioDuration);
        }

        // If audio URL exists (saved to S3), create audio player
        if (this.currentNews.audioUrl) {
            console.log('🔄 Restoring audio from S3:', this.currentNews.audioFileName);

            // Stop any existing audio
            this.stopAudio();
            if (this.audioPlayerUrl) {
                URL.revokeObjectURL(this.audioPlayerUrl);
            }

            // Create audio player with S3 URL
            this.audioPlayer = new Audio(this.currentNews.audioUrl);
            this.audioPlayer.addEventListener('ended', () => {
                this.isPlaying = false;
                this.updatePlayButton();
            });

            // Note: For audio editor, we would need to download the file
            // For now, we'll fetch it when user clicks "Edit"

            // Update UI to show audio is available
            const uploadArea = document.getElementById('audio-upload');
            if (uploadArea) {
                uploadArea.classList.add('has-file');
                const prompt = uploadArea.querySelector('.audio-upload-prompt');
                const info = uploadArea.querySelector('.audio-file-info');

                if (prompt) prompt.style.display = 'none';
                if (info) {
                    info.style.display = 'flex';
                    info.querySelector('.audio-file-name').textContent = this.currentNews.audioFileName;
                    info.querySelector('.audio-file-duration').textContent = this.durationManager.formatDuration(this.currentNews.audioDuration);
                    info.querySelector('.audio-file-size').textContent = this.formatFileSize(this.currentNews.audioSize || 0);
                }
            }

            console.log('✅ Audio restored from S3');
        } else {
            console.log('⚠️ Audio metadata found but no S3 URL:', this.currentNews.audioFileName);
        }
    }

    updateDurations() {
        if (!this.durationManager) return;

        const contentEl = document.getElementById('news-content');
        if (!contentEl) return;

        const text = contentEl.value || '';
        const durations = this.durationManager.calculateTotalDuration(text);

        // Update display
        const readingEl = document.getElementById('reading-duration');
        const audioEl = document.getElementById('audio-duration');
        const totalEl = document.getElementById('total-duration');

        if (readingEl) readingEl.textContent = durations.readingTimeFormatted;
        if (audioEl) audioEl.textContent = durations.audioTimeFormatted;
        if (totalEl) totalEl.textContent = durations.totalTimeFormatted;
    }

    async saveNews() {
        if (!this.storage) {
            alert('Storage not initialized');
            return;
        }

        // Get form values
        this.currentNews.title = document.getElementById('news-title')?.value || '';
        this.currentNews.category = document.getElementById('news-category')?.value || 'general';
        this.currentNews.scheduledDate = document.getElementById('news-date')?.value || '';
        this.currentNews.scheduledTime = document.getElementById('news-time')?.value || '';
        this.currentNews.content = document.getElementById('news-content')?.value || '';
        this.currentNews.updatedAt = Date.now();

        // Calculate duration
        if (this.durationManager) {
            const durations = this.durationManager.calculateTotalDuration(this.currentNews.content);
            this.currentNews.duration = durations.totalTimeFormatted;
        }

        try {
            // Upload audio file to S3 if present
            if (this.durationManager && this.durationManager.audioFile) {
                console.log('📤 Uploading audio to S3...');
                const audioFileId = `${this.currentNews.id}-audio-${Date.now()}`;

                try {
                    const audioResult = await this.storage.saveAudioFile(audioFileId, {
                        data: this.durationManager.audioFile,
                        type: this.durationManager.audioFile.type
                    });

                    // Save S3 URL in news
                    this.currentNews.audioUrl = audioResult.url;
                    this.currentNews.audioKey = audioResult.key;
                    console.log('✅ Audio uploaded to S3:', audioResult.url);
                } catch (audioError) {
                    console.error('❌ Audio upload error:', audioError);
                    alert('Erreur lors de l\'upload audio. La news sera sauvegardée sans audio.');
                }
            }

            await this.storage.saveItem('news', this.currentNews);
            console.log('✅ News saved:', this.currentNews.id);

            // Refresh list
            await this.loadNews();

            // Show success
            this.showNotification('News enregistrée avec succès', 'success');
        } catch (error) {
            console.error('❌ Save error:', error);
            alert('Erreur lors de la sauvegarde');
        }
    }

    closeEditor() {
        // Stop any playing audio
        this.stopAudio();

        this.currentNews = null;
        const editor = document.getElementById('news-editor');
        if (editor) {
            editor.innerHTML = `
                <div class="editor-placeholder">
                    <div class="placeholder-icon">📝</div>
                    <p>Sélectionnez ou créez une news</p>
                </div>
            `;
        }
        this.loadNews();
    }

    showNotification(message, type = 'info') {
        // Simple notification (can be improved)
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? 'var(--success)' : 'var(--primary)'};
            color: white;
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    async openAudioEditor() {
        // Check if we have audio from memory or S3
        let audioFile = null;

        if (this.durationManager && this.durationManager.audioFile) {
            // Audio from memory (just uploaded)
            audioFile = this.durationManager.audioFile;
        } else if (this.currentNews && this.currentNews.audioUrl) {
            // Audio from S3 - need to download it
            console.log('📥 Downloading audio from S3 for editing...');
            try {
                const response = await fetch(this.currentNews.audioUrl);
                const blob = await response.blob();
                audioFile = new File([blob], this.currentNews.audioFileName, { type: 'audio/mpeg' });
                console.log('✅ Audio downloaded from S3');
            } catch (error) {
                console.error('❌ Error downloading audio:', error);
                alert('Erreur lors du téléchargement de l\'audio depuis S3');
                return;
            }
        } else {
            alert('Aucun fichier audio chargé');
            return;
        }

        // Save current view for return
        this.previousView = this.currentView;

        // Stop any playing audio
        this.stopAudio();

        // Switch to audio editor view
        this.switchView('audio-editor');

        // Initialize audio editor if not already done
        if (!this.audioEditor) {
            this.audioEditor = new AudioEditorV3();
        }

        // Load audio file into editor
        this.audioEditor.loadFile(audioFile);
    }

    returnToNews() {
        if (this.previousView) {
            this.switchView(this.previousView);
        } else {
            this.switchView('news');
        }

        // If audio was edited, reload it in the news editor
        if (this.audioEditor && this.audioEditor.hasChanges && this.currentNews) {
            // Export edited audio and reload
            this.audioEditor.exportToNews().then(file => {
                if (file) {
                    this.handleAudioUpload(file);
                }
            });
        }
    }
}

// ===== AUDIO EDITOR V3 =====
class AudioEditorV3 {
    constructor() {
        this.audioContext = null;
        this.currentBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.playStartTime = 0;
        this.selection = { start: 0, end: 0 };
        this.inPoint = null;
        this.outPoint = null;
        this.zoomLevel = 1.0; // Zoom factor (1.0 = fit to width)
        this.scrollOffset = 0; // Horizontal scroll in seconds
        this.history = [];
        this.historyIndex = -1;
        this.hasChanges = false;
        this.canvas = null;
        this.ctx = null;
        this.isSelecting = false;
        this.init();
    }

    async init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.canvas = document.getElementById('waveform-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);

        this.setupEventListeners();
        this.resizeCanvas();

        console.log('✅ Audio Editor V3 initialized');
    }

    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Resize canvas
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    handleKeyboard(e) {
        // Only handle keyboard when audio editor is visible
        const audioEditorView = document.getElementById('audio-editor-view');
        if (!audioEditorView || !audioEditorView.classList.contains('active')) return;

        switch(e.key) {
            case ' ': // Space - Play/Pause
                e.preventDefault();
                this.togglePlayback();
                break;
            case 'i':
            case 'I':
                e.preventDefault();
                this.setInPoint();
                break;
            case 'o':
            case 'O':
                e.preventDefault();
                this.setOutPoint();
                break;
            case 'Delete':
            case 'Backspace':
                if (this.selection.start !== this.selection.end) {
                    e.preventDefault();
                    this.deleteSelection();
                }
                break;
            case 'z':
            case 'Z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                }
                break;
            case 'y':
            case 'Y':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.redo();
                }
                break;
            case 'x':
            case 'X':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.cut();
                }
                break;
            case 'c':
            case 'C':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.copy();
                }
                break;
            case 'v':
            case 'V':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.paste();
                }
                break;
            case '+':
            case '=':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
            case '_':
                e.preventDefault();
                this.zoomOut();
                break;
        }
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.drawWaveform();
    }

    async loadFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.selection = { start: 0, end: 0 };
            this.inPoint = null;
            this.outPoint = null;
            this.currentTime = 0;
            this.clipboard = null;
            this.history = [];
            this.historyIndex = -1;
            this.saveToHistory();
            this.drawWaveform();
            this.updateTimeDisplay();
            this.updateButtonStates();
            console.log('✅ Audio loaded:', file.name, '-', this.formatTime(this.currentBuffer.duration));
        } catch (error) {
            console.error('❌ Error loading audio:', error);
            alert('Erreur lors du chargement de l\'audio');
        }
    }

    drawWaveform() {
        if (!this.currentBuffer) return;

        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.fillStyle = '#0d1117';
        this.ctx.fillRect(0, 0, width, height);

        const data = this.currentBuffer.getChannelData(0);
        const duration = this.currentBuffer.duration;

        // Calculate visible duration based on zoom
        const visibleDuration = duration / this.zoomLevel;
        const startTime = this.scrollOffset;
        const endTime = Math.min(startTime + visibleDuration, duration);

        const startSample = Math.floor(startTime * this.currentBuffer.sampleRate);
        const endSample = Math.floor(endTime * this.currentBuffer.sampleRate);
        const totalSamples = endSample - startSample;

        const step = Math.max(1, Math.ceil(totalSamples / width));
        const amp = height / 2;

        // Draw waveform
        this.ctx.strokeStyle = '#58a6ff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;

            const sampleIndex = startSample + (i * step);

            for (let j = 0; j < step && (sampleIndex + j) < endSample; j++) {
                const datum = data[sampleIndex + j];
                if (datum !== undefined) {
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
            }

            const x = i;
            const yMin = (1 + min) * amp;
            const yMax = (1 + max) * amp;

            if (i === 0) {
                this.ctx.moveTo(x, yMax);
            }
            this.ctx.lineTo(x, yMax);
            this.ctx.lineTo(x, yMin);
        }

        this.ctx.stroke();

        // Draw selection
        if (this.selection.start !== this.selection.end) {
            const startX = this.timeToPixel(this.selection.start);
            const endX = this.timeToPixel(this.selection.end);
            this.ctx.fillStyle = 'rgba(88, 166, 255, 0.2)';
            this.ctx.fillRect(startX, 0, endX - startX, height);
        }

        // Draw IN/OUT points
        if (this.inPoint !== null) {
            const x = this.timeToPixel(this.inPoint);
            this.ctx.strokeStyle = '#3fb950';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        if (this.outPoint !== null) {
            const x = this.timeToPixel(this.outPoint);
            this.ctx.strokeStyle = '#f85149';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Draw playhead
        const playheadX = this.timeToPixel(this.currentTime);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(playheadX, 0);
        this.ctx.lineTo(playheadX, height);
        this.ctx.stroke();
    }

    timeToPixel(time) {
        if (!this.currentBuffer) return 0;
        const duration = this.currentBuffer.duration;
        const visibleDuration = duration / this.zoomLevel;
        const relativeTime = time - this.scrollOffset;
        return (relativeTime / visibleDuration) * this.canvas.width;
    }

    pixelToTime(pixel) {
        if (!this.currentBuffer) return 0;
        const duration = this.currentBuffer.duration;
        const visibleDuration = duration / this.zoomLevel;
        const relativeTime = (pixel / this.canvas.width) * visibleDuration;
        return this.scrollOffset + relativeTime;
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = this.pixelToTime(x);

        this.isSelecting = true;
        this.selection.start = time;
        this.selection.end = time;
        this.currentTime = time;
        this.drawWaveform();
        this.updateTimeDisplay();
    }

    handleMouseMove(e) {
        if (!this.isSelecting) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = this.pixelToTime(x);

        this.selection.end = time;
        this.drawWaveform();
    }

    handleMouseUp(e) {
        this.isSelecting = false;

        if (Math.abs(this.selection.start - this.selection.end) < 0.01) {
            this.selection = { start: 0, end: 0 };
        } else if (this.selection.start > this.selection.end) {
            [this.selection.start, this.selection.end] = [this.selection.end, this.selection.start];
        }

        this.updateButtonStates();
        this.drawWaveform();
    }

    updateButtonStates() {
        const hasSelection = this.selection.start !== this.selection.end;
        const hasInOut = this.inPoint !== null && this.outPoint !== null;
        const canEdit = hasSelection || hasInOut;
        const hasClipboard = this.clipboard !== null;

        // Cut, Copy, Delete require selection OR IN/OUT points
        const cutBtn = document.getElementById('cut-btn');
        const copyBtn = document.getElementById('copy-btn');
        const deleteBtn = document.getElementById('delete-btn');
        const fadeinBtn = document.getElementById('fadein-btn');
        const fadeoutBtn = document.getElementById('fadeout-btn');

        if (cutBtn) cutBtn.disabled = !canEdit;
        if (copyBtn) copyBtn.disabled = !canEdit;
        if (deleteBtn) deleteBtn.disabled = !canEdit;
        if (fadeinBtn) fadeinBtn.disabled = !canEdit;
        if (fadeoutBtn) fadeoutBtn.disabled = !canEdit;

        // Paste requires clipboard
        const pasteBtn = document.getElementById('paste-btn');
        if (pasteBtn) pasteBtn.disabled = !hasClipboard;

        // Undo/Redo
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (!this.currentBuffer) return;

        // Stop any existing playback without resetting currentTime
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode = null;
        }

        const startTime = this.currentTime;
        const duration = this.currentBuffer.duration - startTime;

        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.currentBuffer;
        this.sourceNode.connect(this.gainNode);
        this.sourceNode.start(0, startTime, duration);

        this.playStartTime = this.audioContext.currentTime - startTime;
        this.isPlaying = true;

        this.sourceNode.onended = () => {
            if (this.isPlaying) {
                this.stop();
            }
        };

        this.updatePlayButton();
        this.startPlaybackAnimation();
    }

    pause() {
        if (this.sourceNode) {
            this.currentTime = this.audioContext.currentTime - this.playStartTime;
            this.sourceNode.stop();
            this.sourceNode = null;
        }
        this.isPlaying = false;
        this.updatePlayButton();
        this.drawWaveform();
    }

    stop() {
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode = null;
        }
        this.isPlaying = false;
        this.currentTime = 0;
        this.updatePlayButton();
        this.drawWaveform();
        this.updateTimeDisplay();
    }

    startPlaybackAnimation() {
        if (!this.isPlaying) return;

        this.currentTime = this.audioContext.currentTime - this.playStartTime;

        if (this.currentTime >= this.currentBuffer.duration) {
            this.stop();
            return;
        }

        this.drawWaveform();
        this.updateTimeDisplay();

        requestAnimationFrame(() => this.startPlaybackAnimation());
    }

    updatePlayButton() {
        const btn = document.getElementById('play-btn');
        if (btn) {
            btn.textContent = this.isPlaying ? '⏸️' : '▶️';
        }
    }

    updateTimeDisplay() {
        const currentEl = document.getElementById('current-time');
        const totalEl = document.getElementById('total-duration');

        if (currentEl) {
            currentEl.textContent = this.formatTime(this.currentTime);
        }

        if (totalEl && this.currentBuffer) {
            totalEl.textContent = this.formatTime(this.currentBuffer.duration);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    setInPoint() {
        if (this.selection.start !== this.selection.end) {
            this.inPoint = this.selection.start;
        } else {
            this.inPoint = this.currentTime;
        }
        this.drawWaveform();
        this.updateButtonStates();
        console.log('✅ IN point set at', this.formatTime(this.inPoint));
    }

    setOutPoint() {
        if (this.selection.start !== this.selection.end) {
            this.outPoint = this.selection.end;
        } else {
            this.outPoint = this.currentTime;
        }
        this.drawWaveform();
        this.updateButtonStates();
        console.log('✅ OUT point set at', this.formatTime(this.outPoint));
    }

    clearInOut() {
        this.inPoint = null;
        this.outPoint = null;
        this.drawWaveform();
        this.updateButtonStates();
        console.log('✅ IN/OUT points cleared');
    }

    cut() {
        // Use selection or IN/OUT points
        const hasSelection = this.selection.start !== this.selection.end;
        const hasInOut = this.inPoint !== null && this.outPoint !== null;

        if (!hasSelection && !hasInOut) {
            return;
        }

        this.copy();
        this.deleteSelection();
    }

    copy() {
        if (!this.currentBuffer) return;

        // Use selection or IN/OUT points
        let startTime, endTime;
        if (this.selection.start !== this.selection.end) {
            startTime = this.selection.start;
            endTime = this.selection.end;
        } else if (this.inPoint !== null && this.outPoint !== null) {
            startTime = Math.min(this.inPoint, this.outPoint);
            endTime = Math.max(this.inPoint, this.outPoint);
        } else {
            return;
        }

        const startSample = Math.floor(startTime * this.currentBuffer.sampleRate);
        const endSample = Math.floor(endTime * this.currentBuffer.sampleRate);
        const length = endSample - startSample;

        // Copy selected audio to clipboard
        this.clipboard = this.audioContext.createBuffer(
            this.currentBuffer.numberOfChannels,
            length,
            this.currentBuffer.sampleRate
        );

        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const sourceData = this.currentBuffer.getChannelData(channel);
            const clipboardData = this.clipboard.getChannelData(channel);

            for (let i = 0; i < length; i++) {
                clipboardData[i] = sourceData[startSample + i];
            }
        }

        this.updateButtonStates();
        console.log('✅ Copied', this.formatTime(this.selection.end - this.selection.start));
    }

    paste() {
        if (!this.clipboard || !this.currentBuffer) return;

        this.saveToHistory();

        const insertPoint = this.currentTime;
        const insertSample = Math.floor(insertPoint * this.currentBuffer.sampleRate);
        const clipboardLength = this.clipboard.length;
        const newLength = this.currentBuffer.length + clipboardLength;

        // Create new buffer with extra space
        const newBuffer = this.audioContext.createBuffer(
            this.currentBuffer.numberOfChannels,
            newLength,
            this.currentBuffer.sampleRate
        );

        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const sourceData = this.currentBuffer.getChannelData(channel);
            const clipboardData = this.clipboard.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);

            // Copy before insertion point
            for (let i = 0; i < insertSample; i++) {
                newData[i] = sourceData[i];
            }

            // Copy clipboard
            for (let i = 0; i < clipboardLength; i++) {
                newData[insertSample + i] = clipboardData[i];
            }

            // Copy after insertion point
            for (let i = insertSample; i < this.currentBuffer.length; i++) {
                newData[i + clipboardLength] = sourceData[i];
            }
        }

        this.currentBuffer = newBuffer;
        this.selection = { start: 0, end: 0 };
        this.hasChanges = true;
        this.drawWaveform();
        this.updateTimeDisplay();
        this.updateButtonStates();
        console.log('✅ Pasted at', this.formatTime(insertPoint));
    }

    deleteSelection() {
        if (!this.currentBuffer) return;

        // Use selection or IN/OUT points
        let startTime, endTime;
        if (this.selection.start !== this.selection.end) {
            startTime = this.selection.start;
            endTime = this.selection.end;
        } else if (this.inPoint !== null && this.outPoint !== null) {
            startTime = Math.min(this.inPoint, this.outPoint);
            endTime = Math.max(this.inPoint, this.outPoint);
        } else {
            return;
        }

        this.saveToHistory();

        const startSample = Math.floor(startTime * this.currentBuffer.sampleRate);
        const endSample = Math.floor(endTime * this.currentBuffer.sampleRate);
        const deletedLength = endSample - startSample;
        const newLength = this.currentBuffer.length - deletedLength;

        // Create new buffer without deleted section
        const newBuffer = this.audioContext.createBuffer(
            this.currentBuffer.numberOfChannels,
            newLength,
            this.currentBuffer.sampleRate
        );

        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const sourceData = this.currentBuffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);

            // Copy before deletion
            for (let i = 0; i < startSample; i++) {
                newData[i] = sourceData[i];
            }

            // Copy after deletion
            for (let i = endSample; i < this.currentBuffer.length; i++) {
                newData[i - deletedLength] = sourceData[i];
            }
        }

        this.currentBuffer = newBuffer;
        this.selection = { start: 0, end: 0 };
        this.currentTime = Math.min(this.currentTime, this.currentBuffer.duration);
        this.hasChanges = true;
        this.drawWaveform();
        this.updateTimeDisplay();
        this.updateButtonStates();
        console.log('✅ Deleted', this.formatTime(endSample / this.currentBuffer.sampleRate - startSample / this.currentBuffer.sampleRate));
    }

    normalize() {
        if (!this.currentBuffer) return;

        this.saveToHistory();

        let maxAmplitude = 0;

        // Find max amplitude
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                maxAmplitude = Math.max(maxAmplitude, Math.abs(data[i]));
            }
        }

        if (maxAmplitude === 0) {
            alert('Audio silence - impossible de normaliser');
            return;
        }

        // Normalize to -1dB (0.89)
        const targetLevel = 0.89;
        const gain = targetLevel / maxAmplitude;

        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                data[i] *= gain;
            }
        }

        this.hasChanges = true;
        this.drawWaveform();
        console.log(`✅ Normalized (gain: ${gain.toFixed(2)}x)`);
    }

    fadeIn() {
        if (!this.currentBuffer) return;

        // Use selection or IN/OUT points
        let startTime, endTime;
        if (this.selection.start !== this.selection.end) {
            startTime = this.selection.start;
            endTime = this.selection.end;
        } else if (this.inPoint !== null && this.outPoint !== null) {
            startTime = Math.min(this.inPoint, this.outPoint);
            endTime = Math.max(this.inPoint, this.outPoint);
        } else {
            return;
        }

        this.saveToHistory();

        const startSample = Math.floor(startTime * this.currentBuffer.sampleRate);
        const endSample = Math.floor(endTime * this.currentBuffer.sampleRate);
        const length = endSample - startSample;

        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);

            for (let i = 0; i < length; i++) {
                const gain = i / length; // Linear fade 0 to 1
                data[startSample + i] *= gain;
            }
        }

        this.hasChanges = true;
        this.drawWaveform();
        console.log('✅ Fade In applied');
    }

    fadeOut() {
        if (!this.currentBuffer) return;

        // Use selection or IN/OUT points
        let startTime, endTime;
        if (this.selection.start !== this.selection.end) {
            startTime = this.selection.start;
            endTime = this.selection.end;
        } else if (this.inPoint !== null && this.outPoint !== null) {
            startTime = Math.min(this.inPoint, this.outPoint);
            endTime = Math.max(this.inPoint, this.outPoint);
        } else {
            return;
        }

        this.saveToHistory();

        const startSample = Math.floor(startTime * this.currentBuffer.sampleRate);
        const endSample = Math.floor(endTime * this.currentBuffer.sampleRate);
        const length = endSample - startSample;

        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);

            for (let i = 0; i < length; i++) {
                const gain = 1 - (i / length); // Linear fade 1 to 0
                data[startSample + i] *= gain;
            }
        }

        this.hasChanges = true;
        this.drawWaveform();
        console.log('✅ Fade Out applied');
    }

    zoomIn() {
        if (!this.currentBuffer) return;

        const oldZoom = this.zoomLevel;
        this.zoomLevel = Math.min(this.zoomLevel * 2, 100); // Max zoom x100

        // Keep playhead centered when zooming
        const duration = this.currentBuffer.duration;
        const oldVisibleDuration = duration / oldZoom;
        const newVisibleDuration = duration / this.zoomLevel;
        const centerTime = this.scrollOffset + oldVisibleDuration / 2;
        this.scrollOffset = Math.max(0, centerTime - newVisibleDuration / 2);
        this.scrollOffset = Math.min(this.scrollOffset, duration - newVisibleDuration);

        this.drawWaveform();
        console.log(`🔍+ Zoom: ${this.zoomLevel.toFixed(1)}x`);
    }

    zoomOut() {
        if (!this.currentBuffer) return;

        const oldZoom = this.zoomLevel;
        this.zoomLevel = Math.max(this.zoomLevel / 2, 1.0); // Min zoom 1.0 (fit)

        // Keep playhead centered when zooming
        const duration = this.currentBuffer.duration;
        const oldVisibleDuration = duration / oldZoom;
        const newVisibleDuration = duration / this.zoomLevel;
        const centerTime = this.scrollOffset + oldVisibleDuration / 2;
        this.scrollOffset = Math.max(0, centerTime - newVisibleDuration / 2);
        this.scrollOffset = Math.min(this.scrollOffset, duration - newVisibleDuration);

        // If we're at fit level, reset scroll
        if (this.zoomLevel === 1.0) {
            this.scrollOffset = 0;
        }

        this.drawWaveform();
        console.log(`🔍- Zoom: ${this.zoomLevel.toFixed(1)}x`);
    }

    zoomFit() {
        this.zoomLevel = 1.0;
        this.scrollOffset = 0;
        this.drawWaveform();
        console.log('⬌ Zoom: Fit to width');
    }

    saveToHistory() {
        // Clone current buffer for history
        if (!this.currentBuffer) return;

        const clonedBuffer = this.audioContext.createBuffer(
            this.currentBuffer.numberOfChannels,
            this.currentBuffer.length,
            this.currentBuffer.sampleRate
        );

        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const sourceData = this.currentBuffer.getChannelData(channel);
            const destData = clonedBuffer.getChannelData(channel);
            destData.set(sourceData);
        }

        // Remove any history after current index
        this.history.splice(this.historyIndex + 1);

        // Add new state
        this.history.push(clonedBuffer);
        this.historyIndex = this.history.length - 1;

        // Limit history to 20 states
        if (this.history.length > 20) {
            this.history.shift();
            this.historyIndex--;
        }

        this.updateButtonStates();
    }

    undo() {
        if (this.historyIndex <= 0) return;

        this.historyIndex--;
        this.currentBuffer = this.history[this.historyIndex];
        this.selection = { start: 0, end: 0 };
        this.currentTime = Math.min(this.currentTime, this.currentBuffer.duration);
        this.drawWaveform();
        this.updateTimeDisplay();
        this.updateButtonStates();
        console.log('↶ Undo');
    }

    redo() {
        if (this.historyIndex >= this.history.length - 1) return;

        this.historyIndex++;
        this.currentBuffer = this.history[this.historyIndex];
        this.selection = { start: 0, end: 0 };
        this.currentTime = Math.min(this.currentTime, this.currentBuffer.duration);
        this.drawWaveform();
        this.updateTimeDisplay();
        this.updateButtonStates();
        console.log('↷ Redo');
    }

    exportAudio() {
        alert('Export audio - En développement');
    }

    async exportToNews() {
        // Return the current buffer as a File for the news editor
        if (!this.currentBuffer) return null;

        // In real implementation, would encode buffer to audio file
        alert('Export vers News - En développement');
        return null;
    }
}

// Global functions for onclick handlers
function switchView(viewName) {
    if (window.app) window.app.switchView(viewName);
}

function createNews() {
    if (window.app) window.app.createNews();
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SaintEspritV3();
});

// Add dynamic styles
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

.news-item {
    padding: 12px;
    background: var(--bg-light);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    margin-bottom: 8px;
    transition: all 0.2s;
}

.news-item:hover {
    background: var(--bg-lighter);
    border-color: var(--border-light);
}

.news-item.active {
    background: var(--bg-lighter);
    border-color: var(--primary);
}

.news-title {
    font-weight: 500;
    margin-bottom: 4px;
}

.news-meta {
    font-size: 12px;
    color: var(--text-muted);
}

/* Editor Form */
.editor-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--border);
}

.editor-header h3 {
    font-size: 20px;
    font-weight: 600;
}

.editor-actions {
    display: flex;
    gap: var(--space-sm);
}

.form-row {
    display: grid;
    gap: var(--space-md);
}

.form-row-3 {
    grid-template-columns: 1fr 1fr 1fr;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.form-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
}

.form-group input,
.form-group select,
.form-group textarea {
    padding: var(--space-md);
    background: var(--bg-darker);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
}

.form-group textarea {
    resize: vertical;
    min-height: 150px;
}

/* Audio Upload */
.audio-upload {
    padding: var(--space-xl);
    background: var(--bg-darker);
    border: 2px dashed var(--border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.3s;
}

.audio-upload:hover,
.audio-upload.dragover {
    border-color: var(--primary);
    background: var(--bg-light);
}

.audio-upload.has-file {
    border-style: solid;
    border-color: var(--success);
}

.audio-upload-prompt {
    text-align: center;
}

.upload-icon {
    font-size: 48px;
    margin-bottom: var(--space-md);
}

.audio-upload-prompt p {
    font-weight: 500;
    margin-bottom: var(--space-sm);
}

.audio-upload-prompt small {
    color: var(--text-muted);
    font-size: 12px;
}

.audio-file-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.audio-info-text {
    flex: 1;
}

.audio-file-name {
    font-weight: 500;
    margin-bottom: 4px;
}

.audio-file-meta {
    font-size: 12px;
    color: var(--text-muted);
}

.audio-controls {
    display: flex;
    gap: var(--space-sm);
}

.btn-sm {
    padding: var(--space-sm) var(--space-md);
    font-size: 13px;
}

/* Duration Display */
.duration-display {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: var(--bg-darker);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
}

.duration-box {
    text-align: center;
}

.duration-box-total {
    border-left: 2px solid var(--border);
}

.duration-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: var(--space-sm);
}

.duration-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--primary);
    font-family: 'Courier New', monospace;
}

@media (max-width: 768px) {
    .form-row-3 {
        grid-template-columns: 1fr;
    }

    .duration-display {
        grid-template-columns: 1fr;
    }

    .duration-box-total {
        border-left: none;
        border-top: 2px solid var(--border);
        padding-top: var(--space-md);
    }
}
`;
document.head.appendChild(style);
