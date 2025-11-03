/* ===== SAINT-ESPRIT V3 - APP LOGIC ===== */

class SaintEspritV3 {
    constructor() {
        this.currentView = 'dashboard';
        this.storage = null;
        this.newsManager = null;
        this.durationManager = null;
        this.currentNews = null;
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
            const news = await this.storage.getAll('news');
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
            const news = await this.storage.getAll('news');
            console.log(`📰 Loaded ${news.length} news`);

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
            newsList.innerHTML = news.map(n => `
                <div class="news-item ${this.currentNews && this.currentNews.id === n.id ? 'active' : ''}" onclick="app.editNews('${n.id}')">
                    <div class="news-title">${n.title || 'Sans titre'}</div>
                    <div class="news-meta">${n.scheduledDate || ''} • ${n.author || ''}</div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading news:', error);
        }
    }

    createNews() {
        console.log('📝 Creating new news...');

        const now = new Date();
        const userName = localStorage.getItem('saint-esprit-user-fullname') ||
                        localStorage.getItem('saint-esprit-user-name') ||
                        'Utilisateur';

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

        try {
            const news = await this.storage.get('news', newsId);
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
                            <button type="button" class="btn btn-secondary btn-sm" onclick="app.removeAudio()">🗑️ Supprimer</button>
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

    removeAudio() {
        if (this.durationManager) {
            this.durationManager.clearAudio();
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
            await this.storage.save('news', this.currentNews);
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

.audio-file-name {
    font-weight: 500;
    margin-bottom: 4px;
}

.audio-file-meta {
    font-size: 12px;
    color: var(--text-muted);
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
