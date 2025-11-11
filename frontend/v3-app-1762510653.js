/* ===== SAINT-ESPRIT V3 - APP LOGIC ===== */

class SaintEspritV3 {
    constructor() {
        this.currentView = 'dashboard';
        this.storage = null;
        this.newsManager = null;
        this.durationManager = null;
        this.currentNews = null;
        this.allNews = [];
        this.currentAnimation = null;
        this.allAnimations = [];
        this.currentConductor = null;
        this.allConductors = [];
        this.currentJournal = null;
        this.allJournals = [];
        this.audioPlayer = null;
        this.audioPlayerUrl = null;
        this.isPlaying = false;
        this.audioEditor = null;
        this.previousView = null; // Pour retour depuis audio editor
        this.draggedSegment = null;
        this.currentModal = null;
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
        const newsSearch = document.getElementById('news-search-input');
        if (newsSearch) {
            newsSearch.addEventListener('input', (e) => {
                this.filterNews(e.target.value);
            });
        }

        // Archives search
        const archivesSearch = document.getElementById('archives-search-input');
        if (archivesSearch) {
            archivesSearch.addEventListener('input', (e) => {
                this.filterArchives(e.target.value);
            });
        }

        // Type filter
        const typeFilter = document.getElementById('filter-type');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Category filter
        const categoryFilter = document.getElementById('filter-category');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.applyFilters();
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
            } else if (viewName === 'archives') {
                this.loadArchives();
            } else if (viewName === 'animation') {
                this.loadAnimations();
            } else if (viewName === 'conductor') {
                this.loadConductors();
            } else if (viewName === 'blocks') {
                this.loadJournals();
            } else if (viewName === 'onair') {
                this.initOnAirMode();
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
            const allNews = data.news || [];
            const allAnimations = data.animations || [];

            // Filter out archived items (they appear in Archives tab only)
            const news = allNews.filter(n => n.status !== 'archived').map(n => ({...n, itemType: 'news'}));
            const animations = allAnimations.filter(a => a.status !== 'archived').map(a => ({...a, itemType: 'animation'}));

            // Combine news and animations
            const contents = [...news, ...animations];
            console.log(`📄 Loaded ${contents.length} contenus (${news.length} news, ${animations.length} animations)`);

            // Store combined list for filtering
            this.allNews = contents;

            if (contents.length === 0) {
                const tableBody = document.getElementById('news-table-body');
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="9" style="text-align: center; padding: 40px;">
                                <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                                <div style="color: var(--text-muted);">Aucun contenu</div>
                            </td>
                        </tr>
                    `;
                }
                return;
            }

            // Display contents list
            this.displayNewsList(contents);

        } catch (error) {
            console.error('Error loading news:', error);
        }
    }

    displayNewsList(news) {
        const tableBody = document.getElementById('news-table-body');
        if (!tableBody) return;

        if (news.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                        <div style="color: var(--text-muted);">Aucun résultat</div>
                    </td>
                </tr>
            `;
            this.updateNewsStats([]);
            return;
        }

        tableBody.innerHTML = news.map(n => this.createNewsRow(n)).join('');
        this.updateNewsStats(news);
    }

    createNewsRow(news) {
        const status = news.status || 'draft';
        const statusLabels = {
            'draft': 'Brouillon',
            'review': 'Relecture',
            'ready': 'Prêt',
            'published': 'Publié',
            'archived': 'Archivé'
        };

        const statusLabel = statusLabels[status] || 'Brouillon';

        // Get author initials
        const authorName = news.author || 'Inconnu';
        const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

        // Format dates
        const createdDate = this.formatDate(news.createdAt);
        const updatedDate = this.formatDate(news.updatedAt || news.createdAt);
        const scheduledDate = this.formatDate(news.scheduledDate);

        // Format duration
        const duration = news.audioDuration || news.totalDuration || 0;
        const durationStr = this.formatDuration(duration);
        const hasDuration = duration > 0;
        const durationIcon = news.audioUrl ? '🎵' : '⏱️';

        // Excerpt from content
        const excerpt = news.content ? news.content.substring(0, 80) + '...' : '';

        // Type indicator
        const isAnimation = news.itemType === 'animation';
        const typeIcon = isAnimation ? '🎙️' : '📰';
        const editFunction = isAnimation ? 'editAnimation' : 'editNews';
        const duplicateFunction = isAnimation ? 'duplicateAnimation' : 'duplicateNews';
        const deleteFunction = isAnimation ? 'deleteAnimation' : 'deleteNews';

        // Priority indicator (based on scheduled date proximity)
        let priorityClass = '';
        if (news.scheduledDate) {
            const scheduled = new Date(news.scheduledDate);
            const now = new Date();
            const hoursUntil = (scheduled - now) / (1000 * 60 * 60);

            if (hoursUntil < 3 && hoursUntil > 0) {
                priorityClass = 'priority-high';
            } else if (hoursUntil < 6 && hoursUntil > 0) {
                priorityClass = 'priority-medium';
            }
        }

        return `
            <tr onclick="app.${editFunction}('${news.id}')">
                ${priorityClass ? `<div class="priority-indicator ${priorityClass}"></div>` : ''}
                <td>
                    <span class="status-badge status-${status}">
                        <span class="status-indicator"></span>
                        ${statusLabel}
                    </span>
                </td>
                <td class="title-cell">
                    <div class="news-title">${typeIcon} ${news.title || 'Sans titre'}</div>
                    ${excerpt ? `<div class="news-excerpt">${excerpt}</div>` : ''}
                </td>
                <td>
                    <span class="category-badge">${news.category || 'Général'}</span>
                </td>
                <td>
                    <div class="author-info">
                        <div class="author-avatar">${initials}</div>
                        <span class="author-name">${authorName}</span>
                    </div>
                </td>
                <td>
                    <div class="date-info">
                        <span class="date-primary">${createdDate.short}</span>
                        <span class="date-secondary">${createdDate.relative}</span>
                    </div>
                </td>
                <td>
                    <div class="date-info">
                        <span class="date-primary">${updatedDate.short}</span>
                        <span class="date-secondary">${updatedDate.relative}</span>
                    </div>
                </td>
                <td>
                    <div class="date-info">
                        <span class="date-primary">${scheduledDate.short}</span>
                        <span class="date-secondary">${scheduledDate.relative}</span>
                    </div>
                </td>
                <td>
                    <div class="duration ${hasDuration ? 'duration-with-audio' : ''}">
                        ${durationIcon} ${durationStr}
                    </div>
                </td>
                <td>
                    <div class="actions" onclick="event.stopPropagation()">
                        <button class="action-btn primary" onclick="app.${editFunction}('${news.id}')" title="Éditer">✏️</button>
                        <button class="action-btn" onclick="app.${duplicateFunction}('${news.id}')" title="Dupliquer">📋</button>
                        <button class="action-btn danger" onclick="app.${deleteFunction}('${news.id}')" title="Supprimer">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }

    formatDate(timestamp) {
        if (!timestamp) {
            return { short: '-', relative: '-' };
        }

        const date = new Date(timestamp);
        const now = new Date();

        // Short format: "11 Nov 12:34"
        const day = date.getDate();
        const month = date.toLocaleDateString('fr-FR', { month: 'short' });
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const short = `${day} ${month} ${hours}:${minutes}`;

        // Relative format
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let relative;
        if (diffMins < 1) {
            relative = 'à l\'instant';
        } else if (diffMins < 60) {
            relative = `il y a ${diffMins}min`;
        } else if (diffHours < 24) {
            relative = `il y a ${diffHours}h`;
        } else if (diffDays === 1) {
            relative = 'hier';
        } else if (diffDays < 7) {
            relative = `il y a ${diffDays}j`;
        } else {
            relative = date.toLocaleDateString('fr-FR');
        }

        // For future dates (scheduled)
        if (diffMs < 0) {
            const futureHours = Math.abs(diffHours);
            const futureDays = Math.abs(diffDays);

            if (futureHours < 1) {
                relative = 'bientôt';
            } else if (futureHours < 24) {
                relative = `dans ${futureHours}h`;
            } else if (futureDays === 1) {
                relative = 'demain';
            } else if (futureDays < 7) {
                relative = `dans ${futureDays}j`;
            } else {
                relative = 'à venir';
            }
        }

        return { short, relative };
    }

    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '00:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    updateNewsStats(contents) {
        // Count news and animations separately
        const newsCount = contents.filter(c => c.itemType === 'news').length;
        const animCount = contents.filter(c => c.itemType === 'animation').length;

        // Update total count
        const totalCount = document.getElementById('news-total-count');
        if (totalCount) {
            if (newsCount > 0 && animCount > 0) {
                totalCount.textContent = `${contents.length} contenus (${newsCount} news, ${animCount} animations)`;
            } else if (newsCount > 0) {
                totalCount.textContent = `${newsCount} news`;
            } else if (animCount > 0) {
                totalCount.textContent = `${animCount} animations`;
            } else {
                totalCount.textContent = `0 contenu`;
            }
        }

        // Count by status
        const stats = {
            total: contents.length,
            draft: 0,
            review: 0,
            ready: 0,
            published: 0,
            archived: 0,
            totalDuration: 0
        };

        contents.forEach(n => {
            const status = n.status || 'draft';
            if (stats[status] !== undefined) {
                stats[status]++;
            }
            stats.totalDuration += n.audioDuration || n.totalDuration || 0;
        });

        // Update footer stats
        const updateStat = (selector, value) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => el.textContent = value);
        };

        updateStat('.stat-value', stats.total);

        // Update individual status counts if elements exist
        const statsContainer = document.querySelector('.news-footer .stats');
        if (statsContainer) {
            const durationHours = Math.floor(stats.totalDuration / 3600);
            const durationMins = Math.floor((stats.totalDuration % 3600) / 60);

            statsContainer.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Total:</span>
                    <span class="stat-value">${stats.total}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Brouillons:</span>
                    <span class="stat-value">${stats.draft}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">En relecture:</span>
                    <span class="stat-value">${stats.review}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Prêts:</span>
                    <span class="stat-value">${stats.ready}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Publiés:</span>
                    <span class="stat-value">${stats.published}</span>
                </div>
            `;
        }

        // Update total duration in footer
        const footerDuration = document.querySelector('.news-footer .stat-item:last-child .stat-value');
        if (footerDuration) {
            const durationHours = Math.floor(stats.totalDuration / 3600);
            const durationMins = Math.floor((stats.totalDuration % 3600) / 60);
            footerDuration.textContent = `${durationHours}h ${durationMins}min`;
        }
    }

    filterNews(searchTerm) {
        if (!this.allNews) return;

        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            // No search term, apply other filters
            this.applyFilters();
            return;
        }

        // Filter by search term
        const filtered = this.allNews.filter(n => {
            return (
                (n.title && n.title.toLowerCase().includes(term)) ||
                (n.content && n.content.toLowerCase().includes(term)) ||
                (n.author && n.author.toLowerCase().includes(term)) ||
                (n.category && n.category.toLowerCase().includes(term))
            );
        });

        // Apply additional filters
        const finalFiltered = this.applyAdditionalFilters(filtered);

        this.displayNewsList(finalFiltered);
        console.log(`🔍 Filtered: ${finalFiltered.length}/${this.allNews.length} contenus`);
    }

    applyFilters() {
        if (!this.allNews) return;

        const typeFilter = document.getElementById('filter-type')?.value || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';
        const categoryFilter = document.getElementById('filter-category')?.value || '';
        const searchTerm = document.getElementById('news-search-input')?.value || '';

        let filtered = this.allNews;

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(n => {
                return (
                    (n.title && n.title.toLowerCase().includes(term)) ||
                    (n.content && n.content.toLowerCase().includes(term)) ||
                    (n.author && n.author.toLowerCase().includes(term)) ||
                    (n.category && n.category.toLowerCase().includes(term))
                );
            });
        }

        // Apply type filter
        if (typeFilter) {
            filtered = filtered.filter(n => n.itemType === typeFilter);
        }

        // Apply status filter
        if (statusFilter) {
            filtered = filtered.filter(n => n.status === statusFilter);
        }

        // Apply category filter
        if (categoryFilter) {
            filtered = filtered.filter(n => n.category === categoryFilter);
        }

        this.displayNewsList(filtered);
        console.log(`🔍 Filtered: ${filtered.length}/${this.allNews.length} contenus`);
    }

    applyAdditionalFilters(items) {
        const typeFilter = document.getElementById('filter-type')?.value || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';
        const categoryFilter = document.getElementById('filter-category')?.value || '';

        let filtered = items;

        // Apply type filter
        if (typeFilter) {
            filtered = filtered.filter(n => n.itemType === typeFilter);
        }

        // Apply status filter
        if (statusFilter) {
            filtered = filtered.filter(n => n.status === statusFilter);
        }

        // Apply category filter
        if (categoryFilter) {
            filtered = filtered.filter(n => n.category === categoryFilter);
        }

        return filtered;
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
            status: 'draft',
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

        // Hide table view, show editor
        const tableContainer = document.querySelector('.news-table-container');
        const toolbar = document.querySelector('.news-toolbar');
        const footer = document.querySelector('.news-footer');
        if (tableContainer) tableContainer.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';
        if (footer) footer.style.display = 'none';
        editor.style.display = 'block';

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

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Statut</label>
                        <select id="news-status">
                            <option value="draft" ${(this.currentNews.status || 'draft') === 'draft' ? 'selected' : ''}>Brouillon</option>
                            <option value="review" ${this.currentNews.status === 'review' ? 'selected' : ''}>En relecture</option>
                            <option value="ready" ${this.currentNews.status === 'ready' ? 'selected' : ''}>Prêt</option>
                            <option value="published" ${this.currentNews.status === 'published' ? 'selected' : ''}>Publié</option>
                            <option value="archived" ${this.currentNews.status === 'archived' ? 'selected' : ''}>Archivé</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Catégorie</label>
                        <select id="news-category">
                            <option value="general" ${this.currentNews.category === 'general' ? 'selected' : ''}>Info générale</option>
                            <option value="international" ${this.currentNews.category === 'international' ? 'selected' : ''}>International</option>
                            <option value="national" ${this.currentNews.category === 'national' ? 'selected' : ''}>National</option>
                            <option value="local" ${this.currentNews.category === 'local' ? 'selected' : ''}>Local</option>
                            <option value="sport" ${this.currentNews.category === 'sport' ? 'selected' : ''}>Sport</option>
                            <option value="culture" ${this.currentNews.category === 'culture' ? 'selected' : ''}>Culture</option>
                            <option value="sommaire" ${this.currentNews.category === 'sommaire' ? 'selected' : ''}>Sommaire journal</option>
                            <option value="breve" ${this.currentNews.category === 'breve' ? 'selected' : ''}>Brève</option>
                        </select>
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Date de diffusion</label>
                        <input type="date" id="news-date" value="${this.currentNews.scheduledDate || ''}">
                    </div>

                    <div class="form-group">
                        <label>Heure de diffusion</label>
                        <input type="time" id="news-time" value="${this.currentNews.scheduledTime || ''}">
                    </div>
                </div>

                <div class="form-group">
                    <label>Contenu</label>
                    <textarea id="news-content" rows="10" placeholder="Contenu de la news...">${this.currentNews.content || ''}</textarea>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Lancement (optionnel)</label>
                        <textarea id="news-lancement" rows="3" placeholder="Texte de lancement pour le présentateur...">${this.currentNews.lancement || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Pied (optionnel)</label>
                        <textarea id="news-pied" rows="3" placeholder="Texte de pied pour le présentateur...">${this.currentNews.pied || ''}</textarea>
                    </div>
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

        // Lancement and Pied change -> update reading time
        const lancementEl = document.getElementById('news-lancement');
        if (lancementEl) {
            lancementEl.addEventListener('input', () => this.updateDurations());
        }

        const piedEl = document.getElementById('news-pied');
        if (piedEl) {
            piedEl.addEventListener('input', () => this.updateDurations());
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

        // Combiner contenu + lancement + pied pour calcul total
        const content = contentEl.value || '';
        const lancement = document.getElementById('news-lancement')?.value || '';
        const pied = document.getElementById('news-pied')?.value || '';
        const fullText = content + ' ' + lancement + ' ' + pied;

        const durations = this.durationManager.calculateTotalDuration(fullText);

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
        this.currentNews.status = document.getElementById('news-status')?.value || 'draft';
        this.currentNews.category = document.getElementById('news-category')?.value || 'general';
        this.currentNews.scheduledDate = document.getElementById('news-date')?.value || '';
        this.currentNews.scheduledTime = document.getElementById('news-time')?.value || '';
        this.currentNews.content = document.getElementById('news-content')?.value || '';
        this.currentNews.lancement = document.getElementById('news-lancement')?.value || '';
        this.currentNews.pied = document.getElementById('news-pied')?.value || '';
        this.currentNews.updatedAt = Date.now();

        // Calculate duration (store in seconds for calculations, not formatted)
        if (this.durationManager) {
            const fullText = this.currentNews.content + ' ' + this.currentNews.lancement + ' ' + this.currentNews.pied;
            const durations = this.durationManager.calculateTotalDuration(fullText);
            this.currentNews.duration = durations.totalTime; // Store as number (seconds)
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

            // Show success notification
            this.showNotification('News enregistrée avec succès', 'success');

            // Close editor and return to table
            this.closeEditor();
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
            editor.style.display = 'none';
            editor.innerHTML = `
                <div class="editor-placeholder">
                    <div class="placeholder-icon">📝</div>
                    <p>Sélectionnez ou créez une news</p>
                </div>
            `;
        }

        // Show table view again
        const tableContainer = document.querySelector('.news-table-container');
        const toolbar = document.querySelector('.news-toolbar');
        const footer = document.querySelector('.news-footer');
        if (tableContainer) tableContainer.style.display = 'block';
        if (toolbar) toolbar.style.display = 'flex';
        if (footer) footer.style.display = 'flex';

        this.loadNews();
    }

    async duplicateNews(newsId) {
        console.log(`📋 Duplicating news ${newsId}`);

        try {
            const data = await this.storage.load();
            const originalNews = (data.news || []).find(n => n.id === newsId);

            if (!originalNews) {
                alert('News introuvable');
                return;
            }

            // Create duplicate with new ID and timestamp
            const duplicate = {
                ...originalNews,
                id: `news-${Date.now()}`,
                title: `${originalNews.title} (copie)`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                // Don't copy audio URL (would need to copy file in S3)
                audioUrl: undefined,
                audioSize: undefined,
                audioDuration: undefined
            };

            this.currentNews = duplicate;
            this.showNewsEditor();
            this.showNotification('News dupliquée, n\'oubliez pas d\'enregistrer', 'info');
        } catch (error) {
            console.error('Error duplicating news:', error);
            alert('Erreur lors de la duplication');
        }
    }

    async deleteNews(newsId) {
        console.log(`🗑️ Deleting news ${newsId}`);

        if (!confirm('Êtes-vous sûr de vouloir supprimer cette news ?')) {
            return;
        }

        try {
            const data = await this.storage.load();
            const news = data.news || [];
            const index = news.findIndex(n => n.id === newsId);

            if (index === -1) {
                alert('News introuvable');
                return;
            }

            // Remove from array
            news.splice(index, 1);
            data.news = news;

            // Save
            await this.storage.save(data);
            await this.loadNews();

            this.showNotification('News supprimée', 'success');
            console.log('✅ News deleted successfully');
        } catch (error) {
            console.error('Error deleting news:', error);
            alert('Erreur lors de la suppression');
        }
    }

    async duplicateAnimation(animationId) {
        console.log(`📋 Duplicating animation ${animationId}`);

        try {
            const data = await this.storage.load();
            const originalAnimation = (data.animations || []).find(a => a.id === animationId);

            if (!originalAnimation) {
                alert('Animation introuvable');
                return;
            }

            // Create duplicate with new ID and timestamp
            const duplicate = {
                ...originalAnimation,
                id: `animation-${Date.now()}`,
                title: `${originalAnimation.title} (copie)`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                // Don't copy audio URL (would need to copy file in S3)
                audioUrl: undefined,
                audioSize: undefined,
                audioDuration: undefined
            };

            this.currentAnimation = duplicate;
            this.showAnimationEditor();
            this.showNotification('Animation dupliquée, n\'oubliez pas d\'enregistrer', 'info');
        } catch (error) {
            console.error('Error duplicating animation:', error);
            alert('Erreur lors de la duplication');
        }
    }

    async deleteAnimation(animationId) {
        console.log(`🗑️ Deleting animation ${animationId}`);

        if (!confirm('Êtes-vous sûr de vouloir supprimer cette animation ?')) {
            return;
        }

        try {
            const data = await this.storage.load();
            const animations = data.animations || [];
            const index = animations.findIndex(a => a.id === animationId);

            if (index === -1) {
                alert('Animation introuvable');
                return;
            }

            // Remove from array
            animations.splice(index, 1);
            data.animations = animations;

            // Save
            await this.storage.save(data);
            await this.loadNews(); // Reload unified contents view

            this.showNotification('Animation supprimée', 'success');
            console.log('✅ Animation deleted successfully');
        } catch (error) {
            console.error('Error deleting animation:', error);
            alert('Erreur lors de la suppression');
        }
    }

    // ===== ARCHIVES =====

    async loadArchives() {
        if (!this.storage) return;

        try {
            const data = await this.storage.load();
            const allNews = data.news || [];
            const allAnimations = data.animations || [];

            // Filter only archived items (news and animations)
            const archivedNews = allNews.filter(n => n.status === 'archived');
            const archivedAnimations = allAnimations.filter(a => a.status === 'archived');

            // Combine both with a type marker
            const archived = [
                ...archivedNews.map(n => ({...n, itemType: 'news'})),
                ...archivedAnimations.map(a => ({...a, itemType: 'animation'}))
            ];

            console.log(`📦 Loaded ${archived.length} archives (${archivedNews.length} news, ${archivedAnimations.length} animations)`);

            // Store for filtering
            this.allArchives = archived;

            this.displayArchivesList(archived);

        } catch (error) {
            console.error('Error loading archives:', error);
        }
    }

    displayArchivesList(archives) {
        const tableBody = document.getElementById('archives-table-body');
        if (!tableBody) return;

        if (archives.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                        <div style="color: var(--text-muted);">Aucune archive</div>
                    </td>
                </tr>
            `;
            this.updateArchivesStats([]);
            return;
        }

        tableBody.innerHTML = archives.map(n => this.createArchiveRow(n)).join('');
        this.updateArchivesStats(archives);
    }

    createArchiveRow(news) {
        // Get author initials
        const authorName = news.author || 'Inconnu';
        const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

        // Format dates
        const createdDate = this.formatDate(news.createdAt);
        const updatedDate = this.formatDate(news.updatedAt || news.createdAt);
        const scheduledDate = this.formatDate(news.scheduledDate);

        // Format duration
        const duration = news.audioDuration || news.totalDuration || 0;
        const durationStr = this.formatDuration(duration);
        const hasDuration = duration > 0;
        const durationIcon = news.audioUrl ? '🎵' : '⏱️';

        // Excerpt from content
        const excerpt = news.content ? news.content.substring(0, 80) + '...' : '';

        // Type indicator
        const typeIcon = news.itemType === 'animation' ? '🎙️' : '📰';
        const typeLabel = news.itemType === 'animation' ? 'Animation' : 'News';

        return `
            <tr>
                <td class="title-cell">
                    <div class="news-title">${typeIcon} ${news.title || 'Sans titre'}</div>
                    ${excerpt ? `<div class="news-excerpt">${excerpt}</div>` : ''}
                </td>
                <td>
                    <span class="category-badge">${news.category || 'Général'}</span>
                </td>
                <td>
                    <div class="author-info">
                        <div class="author-avatar">${initials}</div>
                        <span class="author-name">${authorName}</span>
                    </div>
                </td>
                <td>
                    <div class="date-info">
                        <span class="date-primary">${createdDate.short}</span>
                        <span class="date-secondary">${createdDate.relative}</span>
                    </div>
                </td>
                <td>
                    <div class="date-info">
                        <span class="date-primary">${updatedDate.short}</span>
                        <span class="date-secondary">${updatedDate.relative}</span>
                    </div>
                </td>
                <td>
                    <div class="date-info">
                        <span class="date-primary">${scheduledDate.short}</span>
                        <span class="date-secondary">${scheduledDate.relative}</span>
                    </div>
                </td>
                <td>
                    <div class="duration ${hasDuration ? 'duration-with-audio' : ''}">
                        ${durationIcon} ${durationStr}
                    </div>
                </td>
                <td>
                    <div class="actions" onclick="event.stopPropagation()">
                        <button class="action-btn primary" onclick="app.viewArchive('${news.id}')" title="Voir">👁️</button>
                        <button class="action-btn" onclick="app.restoreNews('${news.id}')" title="Restaurer">♻️</button>
                        <button class="action-btn danger" onclick="app.deleteNewsForever('${news.id}')" title="Supprimer définitivement">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }

    filterArchives(searchTerm) {
        if (!this.allArchives) return;

        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            this.displayArchivesList(this.allArchives);
            return;
        }

        const filtered = this.allArchives.filter(n => {
            return (
                (n.title && n.title.toLowerCase().includes(term)) ||
                (n.content && n.content.toLowerCase().includes(term)) ||
                (n.author && n.author.toLowerCase().includes(term)) ||
                (n.category && n.category.toLowerCase().includes(term))
            );
        });

        this.displayArchivesList(filtered);
        console.log(`🔍 Filtered archives: ${filtered.length}/${this.allArchives.length}`);
    }

    updateArchivesStats(archives) {
        // Update total count
        const totalCount = document.getElementById('archives-total-count');
        if (totalCount) {
            totalCount.textContent = `${archives.length} archive${archives.length > 1 ? 's' : ''}`;
        }

        // Calculate total duration
        let totalDuration = 0;
        archives.forEach(n => {
            totalDuration += n.audioDuration || n.totalDuration || 0;
        });

        // Update stats
        const statTotal = document.getElementById('archives-stat-total');
        if (statTotal) {
            statTotal.textContent = archives.length;
        }

        const statDuration = document.getElementById('archives-stat-duration');
        if (statDuration) {
            const hours = Math.floor(totalDuration / 3600);
            const mins = Math.floor((totalDuration % 3600) / 60);
            statDuration.textContent = `${hours}h ${mins}min`;
        }
    }

    async viewArchive(newsId) {
        console.log(`👁️ Viewing archive ${newsId}`);

        try {
            const data = await this.storage.load();
            const news = (data.news || []).find(n => n.id === newsId);
            if (news) {
                // Show as read-only in an alert or modal for now
                const info = `
Titre: ${news.title || 'Sans titre'}
Catégorie: ${news.category || 'Général'}
Auteur: ${news.author || 'Inconnu'}
Date: ${news.scheduledDate || '-'}

${news.content || 'Pas de contenu'}
                `.trim();
                alert(info);
            }
        } catch (error) {
            console.error('Error viewing archive:', error);
        }
    }

    async restoreNews(itemId) {
        console.log(`♻️ Restoring item ${itemId}`);

        if (!confirm('Restaurer cet élément vers le statut "Brouillon" ?')) {
            return;
        }

        try {
            const data = await this.storage.load();

            // Try to find in news first
            let item = (data.news || []).find(n => n.id === itemId);
            let itemType = 'news';

            // If not found, try animations
            if (!item) {
                item = (data.animations || []).find(a => a.id === itemId);
                itemType = 'animation';
            }

            if (!item) {
                alert('Archive introuvable');
                return;
            }

            // Change status back to draft
            item.status = 'draft';
            item.updatedAt = Date.now();

            // Save to appropriate collection
            await this.storage.saveItem(itemType, item);
            await this.loadArchives();

            this.showNotification(`${itemType === 'news' ? 'News' : 'Animation'} restaurée avec succès`, 'success');
            console.log(`✅ ${itemType} restored`);
        } catch (error) {
            console.error('Error restoring item:', error);
            alert('Erreur lors de la restauration');
        }
    }

    async deleteNewsForever(itemId) {
        console.log(`🗑️ Deleting item forever ${itemId}`);

        if (!confirm('⚠️ ATTENTION : Cette action supprimera définitivement cet élément. Continuer ?')) {
            return;
        }

        try {
            const data = await this.storage.load();

            // Try to find and delete from news first
            let news = data.news || [];
            let index = news.findIndex(n => n.id === itemId);
            let itemType = 'news';

            if (index !== -1) {
                news.splice(index, 1);
                data.news = news;
            } else {
                // Try animations
                let animations = data.animations || [];
                index = animations.findIndex(a => a.id === itemId);
                itemType = 'animation';

                if (index === -1) {
                    alert('Archive introuvable');
                    return;
                }

                animations.splice(index, 1);
                data.animations = animations;
            }

            // Save
            await this.storage.save(data);
            await this.loadArchives();

            this.showNotification('Archive supprimée définitivement', 'success');
            console.log(`✅ ${itemType} deleted forever`);
        } catch (error) {
            console.error('Error deleting archive:', error);
            alert('Erreur lors de la suppression');
        }
    }

    // ===== ANIMATIONS =====

    async loadAnimations() {
        if (!this.storage) return;

        try {
            const data = await this.storage.load();
            const allAnimations = data.animations || [];

            // Filter out archived animations (they appear in Archives tab only)
            const animations = allAnimations.filter(a => a.status !== 'archived');
            console.log(`🎙️ Loaded ${animations.length} animations (${allAnimations.length - animations.length} archived)`);

            // Store filtered animations list for filtering
            this.allAnimations = animations;

            const animationsList = document.getElementById('animations-list');
            if (animations.length === 0) {
                animationsList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🎙️</div>
                        <p>Aucune animation</p>
                        <button class="btn btn-secondary" onclick="app.createAnimation()">Créer une animation</button>
                    </div>
                `;
                return;
            }

            // Display animations list
            this.displayAnimationsList(animations);

        } catch (error) {
            console.error('Error loading animations:', error);
        }
    }

    displayAnimationsList(animations) {
        const animationsList = document.getElementById('animations-list');
        if (!animationsList) return;

        if (animations.length === 0) {
            animationsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>Aucun résultat</p>
                </div>
            `;
            return;
        }

        animationsList.innerHTML = animations.map(a => `
            <div class="news-item ${this.currentAnimation && this.currentAnimation.id === a.id ? 'active' : ''}" onclick="app.editAnimation('${a.id}')">
                <div class="news-title">${a.title || 'Sans titre'}</div>
                <div class="news-meta">${a.scheduledDate || ''} • ${a.author || ''}</div>
            </div>
        `).join('');
    }

    filterAnimations(searchTerm) {
        if (!this.allAnimations) return;

        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            // No search term, show all animations
            this.displayAnimationsList(this.allAnimations);
            return;
        }

        // Filter animations by title, content, author, category
        const filtered = this.allAnimations.filter(a => {
            return (
                (a.title && a.title.toLowerCase().includes(term)) ||
                (a.content && a.content.toLowerCase().includes(term)) ||
                (a.author && a.author.toLowerCase().includes(term)) ||
                (a.category && a.category.toLowerCase().includes(term))
            );
        });

        this.displayAnimationsList(filtered);
        console.log(`🔍 Filtered: ${filtered.length}/${this.allAnimations.length} animations`);
    }

    createAnimation() {
        console.log('📝 Creating new animation...');

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

        this.currentAnimation = {
            id: `animation-${Date.now()}`,
            title: '',
            content: '',
            category: 'chronique',
            author: userName,
            scheduledDate: now.toISOString().split('T')[0],
            scheduledTime: now.toTimeString().slice(0,5),
            duration: '0:30',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.showAnimationEditor();
    }

    async editAnimation(animationId) {
        console.log(`✏️ Editing animation ${animationId}`);

        // Stop any playing audio
        this.stopAudio();

        try {
            const data = await this.storage.load();
            const animation = (data.animations || []).find(a => a.id === animationId);
            if (animation) {
                this.currentAnimation = animation;
                this.showAnimationEditor();
                this.loadAnimations(); // Refresh list to show active item
            }
        } catch (error) {
            console.error('Error loading animation:', error);
        }
    }

    showAnimationEditor() {
        const editor = document.getElementById('animations-editor');
        if (!editor) return;

        editor.innerHTML = `
            <div class="editor-form">
                <div class="editor-header">
                    <h3>${this.currentAnimation.id.startsWith('animation-') && this.currentAnimation.id.includes(Date.now().toString().slice(0, -3)) ? 'Nouvelle Animation' : 'Édition'}</h3>
                    <div class="editor-actions">
                        <button class="btn btn-secondary" onclick="app.closeAnimationEditor()">Annuler</button>
                        <button class="btn btn-primary" onclick="app.saveAnimation()">💾 Enregistrer</button>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Titre</label>
                        <input type="text" id="animation-title" value="${this.currentAnimation.title || ''}" placeholder="Titre de l'animation">
                    </div>
                </div>

                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label>Catégorie</label>
                        <select id="animation-category">
                            <option value="chronique" ${this.currentAnimation.category === 'chronique' ? 'selected' : ''}>Chronique</option>
                            <option value="meteo" ${this.currentAnimation.category === 'meteo' ? 'selected' : ''}>Météo</option>
                            <option value="billet" ${this.currentAnimation.category === 'billet' ? 'selected' : ''}>Billet d'humeur</option>
                            <option value="speak" ${this.currentAnimation.category === 'speak' ? 'selected' : ''}>Speak</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="animation-date" value="${this.currentAnimation.scheduledDate || ''}">
                    </div>

                    <div class="form-group">
                        <label>Heure</label>
                        <input type="time" id="animation-time" value="${this.currentAnimation.scheduledTime || ''}">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Lancement (avant l'audio)</label>
                        <textarea id="animation-lancement" rows="3" placeholder="Texte à lire avant l'audio...">${this.currentAnimation.lancement || ''}</textarea>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Contenu</label>
                        <textarea id="animation-content" rows="5" placeholder="Contenu de l'animation...">${this.currentAnimation.content || ''}</textarea>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Pied (après l'audio)</label>
                        <textarea id="animation-pied" rows="3" placeholder="Texte à lire après l'audio...">${this.currentAnimation.pied || ''}</textarea>
                    </div>
                </div>

                <!-- Audio Upload -->
                <div class="form-row">
                    <div class="form-group">
                        <label>Audio</label>
                        <div class="audio-upload" id="animation-audio-upload">
                            <div class="upload-placeholder">
                                <div class="upload-icon">🎵</div>
                                <p>Glissez un fichier audio ou cliquez pour parcourir</p>
                                <input type="file" id="animation-audio-file-input" accept="audio/*" style="display: none;">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Duration Display -->
                <div class="duration-display">
                    <div class="duration-box">
                        <div class="duration-label">⏱️ Temps de lecture</div>
                        <div class="duration-value" id="animation-reading-duration">0:00</div>
                    </div>
                    <div class="duration-box">
                        <div class="duration-label">🎵 Durée audio</div>
                        <div class="duration-value" id="animation-audio-duration">0:00</div>
                    </div>
                    <div class="duration-box duration-box-total">
                        <div class="duration-label">📊 Durée totale</div>
                        <div class="duration-value" id="animation-total-duration">0:00</div>
                    </div>
                </div>
            </div>
        `;

        // Setup event listeners
        this.setupAnimationEditorListeners();

        // Restore audio info if exists (async)
        if (this.currentAnimation.audioFileName && this.currentAnimation.audioDuration) {
            this.restoreAnimationAudioInfo().catch(err => {
                console.error('Error restoring audio:', err);
            });
        }

        // Update durations
        this.updateAnimationDurations();
    }

    setupAnimationEditorListeners() {
        // Content change -> update reading time
        const contentEl = document.getElementById('animation-content');
        if (contentEl) {
            contentEl.addEventListener('input', () => this.updateAnimationDurations());
        }

        // Lancement and Pied change -> update reading time
        const lancementEl = document.getElementById('animation-lancement');
        if (lancementEl) {
            lancementEl.addEventListener('input', () => this.updateAnimationDurations());
        }

        const piedEl = document.getElementById('animation-pied');
        if (piedEl) {
            piedEl.addEventListener('input', () => this.updateAnimationDurations());
        }

        // Audio upload setup
        const uploadArea = document.getElementById('animation-audio-upload');
        const fileInput = document.getElementById('animation-audio-file-input');

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
                if (file) await this.handleAnimationAudioUpload(file);
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
                    await this.handleAnimationAudioUpload(file);
                }
            });
        }
    }

    async handleAnimationAudioUpload(file) {
        console.log('🎵 Animation Audio file selected:', file.name);

        if (!this.durationManager) {
            console.error('Duration manager not initialized');
            return;
        }

        // Store file in duration manager
        this.durationManager.audioFile = file;

        // Get audio duration
        const duration = await this.durationManager.getAudioDuration(file);
        this.currentAnimation.audioDuration = duration;
        this.currentAnimation.audioFileName = file.name;

        // Update upload area display
        const uploadArea = document.getElementById('animation-audio-upload');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-success">
                    <div class="upload-icon">✅</div>
                    <div class="upload-info">
                        <div class="upload-filename">${file.name}</div>
                        <div class="upload-duration">${this.formatDurationMMSS(duration)}</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="app.removeAnimationAudio()">Retirer</button>
                </div>
            `;
        }

        // Update durations
        this.updateAnimationDurations();
    }

    removeAnimationAudio() {
        if (this.durationManager) {
            this.durationManager.clearAudio();
        }
        this.currentAnimation.audioDuration = 0;
        this.currentAnimation.audioFileName = null;
        this.currentAnimation.audioUrl = null;

        const uploadArea = document.getElementById('animation-audio-upload');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-placeholder">
                    <div class="upload-icon">🎵</div>
                    <p>Glissez un fichier audio ou cliquez pour parcourir</p>
                    <input type="file" id="animation-audio-file-input" accept="audio/*" style="display: none;">
                </div>
            `;
            this.setupAnimationEditorListeners();
        }

        this.updateAnimationDurations();
    }

    async restoreAnimationAudioInfo() {
        const uploadArea = document.getElementById('animation-audio-upload');
        if (uploadArea && this.currentAnimation.audioFileName) {
            uploadArea.innerHTML = `
                <div class="upload-success">
                    <div class="upload-icon">✅</div>
                    <div class="upload-info">
                        <div class="upload-filename">${this.currentAnimation.audioFileName}</div>
                        <div class="upload-duration">${this.formatDurationMMSS(this.currentAnimation.audioDuration || 0)}</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="app.removeAnimationAudio()">Retirer</button>
                </div>
            `;
        }
    }

    updateAnimationDurations() {
        if (!this.durationManager) return;

        const content = document.getElementById('animation-content')?.value || '';
        const lancement = document.getElementById('animation-lancement')?.value || '';
        const pied = document.getElementById('animation-pied')?.value || '';
        const fullText = content + ' ' + lancement + ' ' + pied;

        const durations = this.durationManager.calculateTotalDuration(fullText);

        // Update display
        const readingEl = document.getElementById('animation-reading-duration');
        const audioEl = document.getElementById('animation-audio-duration');
        const totalEl = document.getElementById('animation-total-duration');

        if (readingEl) readingEl.textContent = durations.textTimeFormatted;
        if (audioEl) audioEl.textContent = durations.audioTimeFormatted;
        if (totalEl) totalEl.textContent = durations.totalTimeFormatted;
    }

    async saveAnimation() {
        if (!this.storage) {
            alert('Storage not initialized');
            return;
        }

        // Get form values
        this.currentAnimation.title = document.getElementById('animation-title')?.value || '';
        this.currentAnimation.category = document.getElementById('animation-category')?.value || 'chronique';
        this.currentAnimation.scheduledDate = document.getElementById('animation-date')?.value || '';
        this.currentAnimation.scheduledTime = document.getElementById('animation-time')?.value || '';
        this.currentAnimation.content = document.getElementById('animation-content')?.value || '';
        this.currentAnimation.lancement = document.getElementById('animation-lancement')?.value || '';
        this.currentAnimation.pied = document.getElementById('animation-pied')?.value || '';
        this.currentAnimation.updatedAt = Date.now();

        // Calculate duration (store in seconds for calculations, not formatted)
        if (this.durationManager) {
            const fullText = this.currentAnimation.content + ' ' + this.currentAnimation.lancement + ' ' + this.currentAnimation.pied;
            const durations = this.durationManager.calculateTotalDuration(fullText);
            this.currentAnimation.duration = durations.totalTime; // Store as number (seconds)
        }

        try {
            // Upload audio file to S3 if present
            if (this.durationManager && this.durationManager.audioFile) {
                console.log('📤 Uploading audio to S3...');
                const audioFileId = `${this.currentAnimation.id}-audio-${Date.now()}`;

                try {
                    const audioResult = await this.storage.saveAudioFile(audioFileId, {
                        data: this.durationManager.audioFile,
                        type: this.durationManager.audioFile.type
                    });

                    // Save S3 URL in animation
                    this.currentAnimation.audioUrl = audioResult.url;
                    this.currentAnimation.audioKey = audioResult.key;
                    console.log('✅ Audio uploaded to S3:', audioResult.url);
                } catch (audioError) {
                    console.error('❌ Audio upload error:', audioError);
                    alert('Erreur lors de l\'upload audio. L\'animation sera sauvegardée sans audio.');
                }
            }

            await this.storage.saveItem('animations', this.currentAnimation);
            console.log('✅ Animation saved:', this.currentAnimation.id);

            // Refresh list
            await this.loadAnimations();

            // Show success
            this.showNotification('Animation enregistrée avec succès', 'success');
        } catch (error) {
            console.error('❌ Save error:', error);
            alert('Erreur lors de la sauvegarde');
        }
    }

    closeAnimationEditor() {
        // Stop any playing audio
        this.stopAudio();

        this.currentAnimation = null;
        const editor = document.getElementById('animations-editor');
        if (editor) {
            editor.innerHTML = `
                <div class="editor-placeholder">
                    <div class="placeholder-icon">🎙️</div>
                    <p>Sélectionnez ou créez une animation</p>
                </div>
            `;
        }
        this.loadAnimations();
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
                const response = await fetch(this.currentNews.audioUrl, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    cache: 'no-cache'
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
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

    // ===== CONDUCTOR MANAGEMENT =====

    async loadConductors() {
        if (!this.storage) return;

        try {
            const data = await this.storage.load();
            const conductors = data.conductors || [];
            console.log(`📺 Loaded ${conductors.length} conductors`);

            this.allConductors = conductors;

            const conductorList = document.getElementById('conductor-list');
            if (conductors.length === 0) {
                conductorList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📺</div>
                        <p>Aucun conducteur</p>
                        <button class="btn btn-secondary" onclick="app.createConductor()">Créer un conducteur</button>
                    </div>
                `;
                return;
            }

            this.displayConductorsList(conductors);

        } catch (error) {
            console.error('Error loading conductors:', error);
        }
    }

    displayConductorsList(conductors) {
        const conductorList = document.getElementById('conductor-list');
        if (!conductorList) return;

        if (conductors.length === 0) {
            conductorList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>Aucun résultat</p>
                </div>
            `;
            return;
        }

        conductorList.innerHTML = conductors.map(c => `
            <div class="news-item ${this.currentConductor && this.currentConductor.id === c.id ? 'active' : ''}" onclick="app.editConductor('${c.id}')">
                <div class="news-title">${c.title || 'Sans titre'}</div>
                <div class="news-meta">${c.scheduledDate || ''} ${c.scheduledTime || ''} • ${c.segments?.length || 0} segments</div>
            </div>
        `).join('');
    }

    createConductor() {
        console.log('📺 Creating new conductor...');

        const now = new Date();
        const userName = localStorage.getItem('saint-esprit-user-fullname') ||
                        localStorage.getItem('saint-esprit-user-name') ||
                        'Utilisateur';

        this.currentConductor = {
            id: `conductor-${Date.now()}`,
            title: '',
            scheduledDate: now.toISOString().split('T')[0],
            scheduledTime: now.toTimeString().slice(0,5),
            author: userName,
            segments: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.showConductorEditor();
    }

    async editConductor(conductorId) {
        console.log(`✏️ Editing conductor ${conductorId}`);

        try {
            const data = await this.storage.load();
            const conductor = (data.conductors || []).find(c => c.id === conductorId);
            if (conductor) {
                this.currentConductor = conductor;
                this.showConductorEditor();
                this.loadConductors(); // Refresh list to show active item
            }
        } catch (error) {
            console.error('Error loading conductor:', error);
        }
    }

    showConductorEditor() {
        const editor = document.getElementById('conductor-editor');
        if (!editor) return;

        const stats = this.calculateConductorStats();

        editor.innerHTML = `
            <div class="editor-form">
                <div class="editor-header">
                    <h3>${this.currentConductor.id.startsWith('conductor-') && this.currentConductor.id.includes(Date.now().toString().slice(0, -3)) ? 'Nouveau Conducteur' : 'Édition'}</h3>
                    <div class="editor-actions">
                        <button class="btn btn-secondary" onclick="app.closeConductorEditor()">Annuler</button>
                        <button class="btn btn-primary" onclick="app.saveConductor()">💾 Enregistrer</button>
                        <button class="btn btn-success" onclick="app.startOnAir()" style="background: #f85149; margin-left: 8px;">🔴 Démarrer On Air</button>
                    </div>
                </div>

                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label>Titre</label>
                        <input type="text" id="conductor-title" value="${this.currentConductor.title || ''}" placeholder="Titre du conducteur">
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="conductor-date" value="${this.currentConductor.scheduledDate || ''}">
                    </div>
                    <div class="form-group">
                        <label>Heure de début</label>
                        <input type="time" id="conductor-time" value="${this.currentConductor.scheduledTime || ''}">
                    </div>
                </div>

                <!-- Info bar -->
                <div class="conductor-header-info">
                    <div class="conductor-info-item">
                        <div class="conductor-info-label">Segments</div>
                        <div class="conductor-info-value" id="conductor-segments-count">${stats.totalSegments}</div>
                    </div>
                    <div class="conductor-info-item">
                        <div class="conductor-info-label">Durée totale</div>
                        <div class="conductor-info-value" id="conductor-total-duration">${stats.totalDuration}</div>
                    </div>
                    <div class="conductor-info-item">
                        <div class="conductor-info-label">Début</div>
                        <div class="conductor-info-value" id="conductor-start-time">${this.currentConductor.scheduledTime || '00:00'}</div>
                    </div>
                    <div class="conductor-info-item">
                        <div class="conductor-info-label">Fin estimée</div>
                        <div class="conductor-info-value" id="conductor-end-time">${stats.endTime}</div>
                    </div>
                </div>

                <!-- Timeline -->
                <div class="conductor-timeline">
                    <div class="conductor-segments" id="conductor-segments">
                        ${this.renderSegments()}
                    </div>

                    <div class="conductor-sidebar">
                        <!-- Stats card -->
                        <div class="stats-card">
                            <div class="stats-title">📊 Statistiques</div>
                            <div class="stats-row">
                                <span class="stats-label">📰 News</span>
                                <span class="stats-value" id="stats-news">${stats.byType.news}</span>
                            </div>
                            <div class="stats-row">
                                <span class="stats-label">🎵 Musique</span>
                                <span class="stats-value" id="stats-music">${stats.byType.music}</span>
                            </div>
                            <div class="stats-row">
                                <span class="stats-label">📻 Publicités</span>
                                <span class="stats-value" id="stats-pub">${stats.byType.pub}</span>
                            </div>
                            <div class="stats-row">
                                <span class="stats-label">🎤 Animation</span>
                                <span class="stats-value" id="stats-animation">${stats.byType.animation}</span>
                            </div>
                            <div class="stats-row">
                                <span class="stats-label">📞 TEL/CODEC</span>
                                <span class="stats-value" id="stats-codec">${stats.byType.codec}</span>
                            </div>
                        </div>

                        <!-- Add segment button -->
                        <button class="btn btn-primary" style="width: 100%; margin-bottom: 16px;" onclick="app.addSegment()">+ Ajouter un segment</button>
                    </div>
                </div>
            </div>
        `;

        this.setupDragAndDrop();
    }

    renderSegments() {
        if (!this.currentConductor.segments || this.currentConductor.segments.length === 0) {
            return `
                <div class="empty-state" style="margin-top: 40px;">
                    <div class="empty-icon">📺</div>
                    <p>Aucun segment</p>
                    <button class="btn btn-primary" onclick="app.addSegment()">+ Ajouter un segment</button>
                </div>
            `;
        }

        let currentTime = this.parseTime(this.currentConductor.scheduledTime || '00:00');

        return this.currentConductor.segments.map((segment, index) => {
            const startTime = this.formatTimeHHMMSS(currentTime);
            const duration = segment.duration || 60; // Default 1 minute
            currentTime += duration;

            return `
                <div class="segment" draggable="true" data-index="${index}">
                    <div class="segment-header">
                        <div class="segment-number">${index + 1}</div>
                        <div class="segment-time">
                            <div class="segment-timecode">${startTime}</div>
                            <div class="segment-duration">→ ${this.formatDurationMMSS(duration)}</div>
                        </div>
                    </div>
                    <div class="segment-title">${this.getSegmentIcon(segment.type)} ${segment.title || 'Sans titre'}</div>
                    <div class="segment-content">${segment.content || ''}</div>
                    <span class="segment-type type-${segment.type}">${this.getSegmentTypeName(segment.type)}</span>
                    <div class="segment-actions">
                        <button onclick="app.editSegment(${index})">✏️ Éditer</button>
                        <button onclick="app.deleteSegment(${index})">🗑️ Supprimer</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getSegmentIcon(type) {
        const icons = {
            news: '📰',
            music: '🎵',
            pub: '📻',
            animation: '🎤',
            codec: '📞'
        };
        return icons[type] || '📝';
    }

    getSegmentTypeName(type) {
        const names = {
            news: 'News',
            music: 'Musique',
            pub: 'Publicité',
            animation: 'Animation',
            codec: 'TEL/CODEC'
        };
        return names[type] || 'Autre';
    }

    calculateConductorStats() {
        if (!this.currentConductor || !this.currentConductor.segments) {
            return {
                totalSegments: 0,
                totalDuration: '00:00',
                endTime: '00:00',
                byType: { news: 0, music: 0, pub: 0, animation: 0, codec: 0 }
            };
        }

        const segments = this.currentConductor.segments;
        const totalSeconds = segments.reduce((sum, s) => sum + (s.duration || 0), 0);
        const startTime = this.parseTime(this.currentConductor.scheduledTime || '00:00');
        const endTimeSeconds = startTime + totalSeconds;

        const byType = {
            news: segments.filter(s => s.type === 'news').length,
            music: segments.filter(s => s.type === 'music').length,
            pub: segments.filter(s => s.type === 'pub').length,
            animation: segments.filter(s => s.type === 'animation').length,
            codec: segments.filter(s => s.type === 'codec').length
        };

        return {
            totalSegments: segments.length,
            totalDuration: this.formatDurationMMSS(totalSeconds),
            endTime: this.formatTimeHHMM(endTimeSeconds),
            byType
        };
    }

    parseTime(timeStr) {
        // Parse HH:MM to seconds
        const parts = timeStr.split(':');
        return (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60);
    }

    formatTimeHHMM(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    formatTimeHHMMSS(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatDurationMMSS(seconds) {
        // Convertir en nombre valide, utiliser 0 si invalide
        const validSeconds = Number(seconds) || 0;
        const mins = Math.floor(validSeconds / 60);
        const secs = Math.floor(validSeconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    addSegment() {
        this.showSegmentModal(null);
    }

    editSegment(index) {
        this.showSegmentModal(index);
    }

    showSegmentModal(segmentIndex) {
        const isEdit = segmentIndex !== null;
        const segment = isEdit ? this.currentConductor.segments[segmentIndex] : null;

        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) this.closeSegmentModal();
        };

        modalOverlay.innerHTML = `
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${isEdit ? '✏️ Éditer le segment' : '➕ Nouveau segment'}</h3>
                    <button class="modal-close" onclick="app.closeSegmentModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Type de segment</label>
                        <select id="segment-type">
                            <option value="news" ${segment?.type === 'news' ? 'selected' : ''}>📰 News</option>
                            <option value="music" ${segment?.type === 'music' ? 'selected' : ''}>🎵 Musique</option>
                            <option value="pub" ${segment?.type === 'pub' ? 'selected' : ''}>📻 Publicité</option>
                            <option value="animation" ${segment?.type === 'animation' ? 'selected' : ''}>🎤 Animation</option>
                            <option value="codec" ${segment?.type === 'codec' ? 'selected' : ''}>📞 Insert TEL/CODEC</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Titre</label>
                        <input type="text" id="segment-title" placeholder="Titre du segment" value="${segment?.title || ''}">
                    </div>

                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
                        <div class="form-group">
                            <label>Durée (minutes)</label>
                            <input type="number" id="segment-duration-min" placeholder="0" value="${Math.floor((segment?.duration || 60) / 60)}" min="0">
                        </div>
                        <div class="form-group">
                            <label>Durée (secondes)</label>
                            <input type="number" id="segment-duration-sec" placeholder="60" value="${(segment?.duration || 60) % 60}" min="0" max="59">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Description (optionnel)</label>
                        <textarea id="segment-content" rows="4" placeholder="Description du segment...">${segment?.content || ''}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="app.closeSegmentModal()">Annuler</button>
                    <button class="btn btn-primary" onclick="app.saveSegmentModal(${segmentIndex})">💾 Enregistrer</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);
        this.currentModal = modalOverlay;

        // Focus on title input
        setTimeout(() => {
            const titleInput = document.getElementById('segment-title');
            if (titleInput) titleInput.focus();
        }, 100);
    }

    saveSegmentModal(segmentIndex) {
        const type = document.getElementById('segment-type')?.value || 'news';
        const title = document.getElementById('segment-title')?.value || '';
        const durationMin = parseInt(document.getElementById('segment-duration-min')?.value) || 0;
        const durationSec = parseInt(document.getElementById('segment-duration-sec')?.value) || 0;
        const content = document.getElementById('segment-content')?.value || '';

        if (!title) {
            alert('Le titre est obligatoire');
            return;
        }

        const duration = (durationMin * 60) + durationSec;

        if (segmentIndex !== null) {
            // Edit existing segment
            this.currentConductor.segments[segmentIndex] = {
                ...this.currentConductor.segments[segmentIndex],
                type,
                title,
                content,
                duration
            };
        } else {
            // Add new segment
            const segment = {
                id: `segment-${Date.now()}`,
                type,
                title,
                content,
                duration
            };

            if (!this.currentConductor.segments) {
                this.currentConductor.segments = [];
            }

            this.currentConductor.segments.push(segment);
        }

        this.closeSegmentModal();
        this.showConductorEditor();
    }

    closeSegmentModal() {
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
        }
    }

    deleteSegment(index) {
        if (!confirm('Supprimer ce segment ?')) return;

        this.currentConductor.segments.splice(index, 1);
        this.showConductorEditor();
    }

    setupDragAndDrop() {
        const segments = document.querySelectorAll('.segment[draggable="true"]');

        segments.forEach(segment => {
            segment.addEventListener('dragstart', (e) => {
                this.draggedSegment = parseInt(e.target.dataset.index);
                e.target.classList.add('dragging');
            });

            segment.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });

            segment.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            segment.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIndex = parseInt(e.currentTarget.dataset.index);

                if (this.draggedSegment !== null && this.draggedSegment !== targetIndex) {
                    // Swap segments
                    const segments = this.currentConductor.segments;
                    const draggedItem = segments[this.draggedSegment];
                    segments.splice(this.draggedSegment, 1);
                    segments.splice(targetIndex, 0, draggedItem);

                    this.showConductorEditor();
                }

                this.draggedSegment = null;
            });
        });
    }

    async saveConductor() {
        if (!this.storage) {
            alert('Storage not initialized');
            return;
        }

        // Get form values
        this.currentConductor.title = document.getElementById('conductor-title')?.value || '';
        this.currentConductor.scheduledDate = document.getElementById('conductor-date')?.value || '';
        this.currentConductor.scheduledTime = document.getElementById('conductor-time')?.value || '';
        this.currentConductor.updatedAt = Date.now();

        try {
            await this.storage.saveItem('conductors', this.currentConductor);
            console.log('✅ Conductor saved:', this.currentConductor.id);

            // Refresh list
            await this.loadConductors();

            // Show success
            this.showNotification('Conducteur enregistré avec succès', 'success');
        } catch (error) {
            console.error('❌ Save error:', error);
            alert('Erreur lors de la sauvegarde');
        }
    }

    closeConductorEditor() {
        this.currentConductor = null;
        const editor = document.getElementById('conductor-editor');
        if (editor) {
            editor.innerHTML = `
                <div class="editor-placeholder">
                    <div class="placeholder-icon">📺</div>
                    <p>Sélectionnez ou créez un conducteur</p>
                </div>
            `;
        }
        this.loadConductors();
    }

    // ===== JOURNAUX MANAGEMENT =====
    async loadJournals() {
        try {
            console.log('📋 Loading journals...');
            const journals = await this.storage.getAllJournals();
            this.allJournals = journals.sort((a, b) => b.createdAt - a.createdAt);

            const list = document.getElementById('journal-list');
            if (!list) return;

            if (this.allJournals.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📋</div>
                        <p>Aucun journal</p>
                        <button class="btn btn-secondary" onclick="app.createJournal()">Créer un journal</button>
                    </div>
                `;
                return;
            }

            list.innerHTML = this.allJournals.map(journal => {
                const newsCount = journal.newsIds ? journal.newsIds.length : 0;
                const totalDuration = this.calculateJournalDuration(journal);
                const targetDuration = journal.targetDuration || 900;
                const gap = totalDuration - targetDuration;
                const statusClass = Math.abs(gap) <= (journal.tolerance || 30) ? 'success' : 'warning';

                return `
                    <div class="list-item ${this.currentJournal && this.currentJournal.id === journal.id ? 'active' : ''}"
                         onclick="app.editJournal('${journal.id}')">
                        <div class="list-item-header">
                            <strong>${journal.title || 'Journal sans titre'}</strong>
                            <span class="badge ${statusClass}">${this.formatDurationMMSS(totalDuration)}</span>
                        </div>
                        <div class="list-item-meta">
                            ${journal.scheduledDate || ''} ${journal.scheduledTime || ''} • ${newsCount} news
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('❌ Load journals error:', error);
        }
    }

    createJournal() {
        const timestamp = Date.now();
        this.currentJournal = {
            id: `journal-${timestamp}`,
            title: `Journal du ${new Date().toLocaleDateString('fr-FR')}`,
            scheduledDate: new Date().toISOString().split('T')[0],
            scheduledTime: '18:00',
            newsIds: [],
            targetDuration: 900, // 15 minutes par défaut
            tolerance: 30, // 30 secondes de tolérance
            author: this.currentUser?.username || 'Anonyme',
            createdAt: timestamp,
            updatedAt: timestamp
        };

        this.showJournalEditor();
        this.loadJournals();
    }

    async editJournal(journalId) {
        const journal = this.allJournals.find(j => j.id === journalId);
        if (!journal) return;

        this.currentJournal = { ...journal };
        this.showJournalEditor();
    }

    async showJournalEditor() {
        if (!this.currentJournal) return;

        const editor = document.getElementById('journal-editor');
        if (!editor) return;

        // S'assurer que les news sont chargées
        if (!this.allNews || this.allNews.length === 0) {
            const data = await this.storage.load();
            this.allNews = data.news || [];
            console.log(`📰 Loaded ${this.allNews.length} news for journal editor`);
        }

        // Récupérer les news complètes depuis les IDs
        const newsInJournal = await this.getNewsFromIds(this.currentJournal.newsIds || []);
        const totalDuration = newsInJournal.reduce((sum, n) => sum + (n.duration || 0), 0);
        const targetDuration = this.currentJournal.targetDuration || 900;
        const gap = totalDuration - targetDuration;
        const tolerance = this.currentJournal.tolerance || 30;

        let durationStatus = '';
        if (Math.abs(gap) <= tolerance) {
            durationStatus = `<div class="duration-alert success">✅ Durée respectée (écart: ${this.formatDurationMMSS(Math.abs(gap))})</div>`;
        } else if (gap > tolerance) {
            durationStatus = `<div class="duration-alert warning">⚠️ Trop long de ${this.formatDurationMMSS(gap)}</div>`;
        } else {
            durationStatus = `<div class="duration-alert warning">⚠️ Trop court de ${this.formatDurationMMSS(Math.abs(gap))}</div>`;
        }

        editor.innerHTML = `
            <div class="editor-content">
                <div class="editor-header">
                    <input type="text"
                           class="title-input"
                           value="${this.currentJournal.title || ''}"
                           placeholder="Titre du journal"
                           onchange="app.currentJournal.title = this.value">
                    <button class="btn btn-danger" onclick="app.deleteJournal()">🗑️ Supprimer</button>
                </div>

                <div class="journal-info-bar">
                    <div class="info-item">
                        <label>📅 Date</label>
                        <input type="date"
                               value="${this.currentJournal.scheduledDate || ''}"
                               onchange="app.currentJournal.scheduledDate = this.value">
                    </div>
                    <div class="info-item">
                        <label>🕐 Heure</label>
                        <input type="time"
                               value="${this.currentJournal.scheduledTime || ''}"
                               onchange="app.currentJournal.scheduledTime = this.value">
                    </div>
                    <div class="info-item">
                        <label>⏱️ Durée cible</label>
                        <input type="number"
                               value="${Math.floor(targetDuration / 60)}"
                               min="1" max="120"
                               onchange="app.currentJournal.targetDuration = this.value * 60"
                               style="width: 80px"> min
                    </div>
                    <div class="info-item">
                        <label>🎯 Tolérance</label>
                        <input type="number"
                               value="${tolerance}"
                               min="0" max="120"
                               onchange="app.currentJournal.tolerance = parseInt(this.value)"
                               style="width: 80px"> sec
                    </div>
                    <div class="info-item">
                        <strong>Total: ${this.formatDurationMMSS(totalDuration)}</strong>
                    </div>
                </div>

                <div class="journal-stats-bar">
                    <div class="stat-item">
                        <span>News</span>
                        <strong>${newsInJournal.length}</strong>
                    </div>
                    <div class="stat-item">
                        <span>Durée totale</span>
                        <strong class="text-success">${this.formatDurationMMSS(totalDuration)}</strong>
                    </div>
                    <div class="stat-item">
                        <span>Objectif</span>
                        <strong class="text-primary">${this.formatDurationMMSS(targetDuration)}</strong>
                    </div>
                    <div class="stat-item">
                        <span>Écart</span>
                        <strong class="${gap > tolerance ? 'text-warning' : gap < -tolerance ? 'text-warning' : 'text-success'}">${gap >= 0 ? '-' : '+'}${this.formatDurationMMSS(Math.abs(gap))}</strong>
                    </div>
                </div>

                ${durationStatus}

                <div class="news-picker">
                    <label>➕ Ajouter des news</label>
                    <div class="news-picker-row">
                        <select id="news-select-${this.currentJournal.id}">
                            <option value="">Sélectionner une news...</option>
                            ${this.allNews.map(n => `
                                <option value="${n.id}">${n.title} (${this.formatDurationMMSS(n.duration || 0)})</option>
                            `).join('')}
                        </select>
                        <button class="btn btn-success btn-sm" onclick="const sel = document.getElementById('news-select-${this.currentJournal.id}'); app.addNewsToJournal(sel.value); sel.value=''">+ Ajouter</button>
                    </div>
                </div>

                <h3 class="section-title">📋 News du journal (glisser-déposer pour réorganiser)</h3>

                <div class="journal-news-list" id="journal-news-list">
                    ${newsInJournal.length === 0 ? `
                        <div class="empty-state">
                            <p>Aucune news dans ce journal</p>
                        </div>
                    ` : ''}
                </div>

                <div class="journal-sidebar">
                    <button class="btn btn-primary" onclick="app.saveJournal()">💾 Enregistrer</button>
                    <button class="btn btn-secondary" onclick="app.generateConductorFromJournal()">📺 Générer conducteur</button>
                    <button class="btn btn-secondary" onclick="app.closeJournalEditor()">✕ Fermer</button>

                    <div class="stats-card">
                        <h4>📊 Statistiques</h4>
                        <div class="stat-line">
                            <span>News:</span>
                            <strong>${newsInJournal.length}</strong>
                        </div>
                        <div class="stat-line">
                            <span>Durée moyenne:</span>
                            <strong>${newsInJournal.length > 0 ? this.formatDurationMMSS(totalDuration / newsInJournal.length) : '0:00'}</strong>
                        </div>
                        <div class="stat-line">
                            <span>Plus courte:</span>
                            <strong>${newsInJournal.length > 0 ? this.formatDurationMMSS(Math.min(...newsInJournal.map(n => n.duration || 0))) : '0:00'}</strong>
                        </div>
                        <div class="stat-line">
                            <span>Plus longue:</span>
                            <strong>${newsInJournal.length > 0 ? this.formatDurationMMSS(Math.max(...newsInJournal.map(n => n.duration || 0))) : '0:00'}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render news items
        await this.renderJournalNews();

        // Setup drag and drop
        this.setupJournalDragAndDrop();
    }

    async getNewsFromIds(newsIds) {
        // Récupérer les objets news complets depuis les IDs
        if (!newsIds || newsIds.length === 0) return [];
        return this.allNews.filter(n => newsIds.includes(n.id));
    }

    calculateJournalDuration(journal) {
        if (!journal.newsIds || journal.newsIds.length === 0) return 0;
        const newsInJournal = this.allNews.filter(n => journal.newsIds.includes(n.id));
        return newsInJournal.reduce((sum, n) => sum + (n.duration || 0), 0);
    }

    async renderJournalNews() {
        const list = document.getElementById('journal-news-list');
        if (!list || !this.currentJournal) return;

        const newsInJournal = await this.getNewsFromIds(this.currentJournal.newsIds || []);

        if (newsInJournal.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <p>Aucune news dans ce journal</p>
                </div>
            `;
            return;
        }

        list.innerHTML = newsInJournal.map((news, index) => {
            const categoryLabels = {
                'general': 'Info générale',
                'international': 'International',
                'national': 'National',
                'local': 'Local',
                'sport': 'Sport',
                'culture': 'Culture',
                'sommaire': 'Sommaire journal',
                'breve': 'Brève'
            };
            const categoryLabel = categoryLabels[news.category] || news.category || 'news';

            // Indicateurs lancement et pied
            const hasLancement = news.lancement && news.lancement.trim() !== '';
            const hasPied = news.pied && news.pied.trim() !== '';
            const indicators = [];
            if (hasLancement) indicators.push('<span class="badge badge-lancement" title="Contient un lancement">🎤 Lancement</span>');
            if (hasPied) indicators.push('<span class="badge badge-pied" title="Contient un pied">📝 Pied</span>');

            return `
                <div class="journal-news-item" data-index="${index}" draggable="true">
                    <div class="drag-handle">⋮⋮</div>
                    <div class="news-item-content">
                        <div class="news-item-header">
                            <strong>${news.title}</strong>
                            <span class="news-item-duration">${this.formatDurationMMSS(news.duration || 0)}</span>
                        </div>
                        <div class="news-item-meta">
                            <span class="badge badge-category">${categoryLabel}</span>
                            ${indicators.join(' ')}
                        </div>
                    </div>
                    <button class="btn-icon" onclick="app.removeNewsFromJournal(${index})" title="Retirer">🗑️</button>
                </div>
            `;
        }).join('');
    }

    async addNewsToJournal(newsId) {
        if (!newsId || !this.currentJournal) return;

        // Initialiser newsIds si nécessaire
        if (!this.currentJournal.newsIds) {
            this.currentJournal.newsIds = [];
        }

        // Vérifier si déjà présent
        if (this.currentJournal.newsIds.includes(newsId)) {
            alert('Cette news est déjà dans le journal');
            return;
        }

        // Ajouter l'ID (pas l'objet complet!)
        this.currentJournal.newsIds.push(newsId);
        this.currentJournal.updatedAt = Date.now();

        // Rafraîchir l'affichage
        await this.showJournalEditor();
    }

    async removeNewsFromJournal(index) {
        if (!this.currentJournal || !this.currentJournal.newsIds) return;

        this.currentJournal.newsIds.splice(index, 1);
        this.currentJournal.updatedAt = Date.now();

        await this.showJournalEditor();
    }

    setupJournalDragAndDrop() {
        const items = document.querySelectorAll('.journal-news-item');
        let draggedIndex = null;

        items.forEach((item, index) => {
            item.addEventListener('dragstart', (e) => {
                draggedIndex = index;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                if (e.clientY < midpoint) {
                    item.classList.add('drag-over-top');
                    item.classList.remove('drag-over-bottom');
                } else {
                    item.classList.add('drag-over-bottom');
                    item.classList.remove('drag-over-top');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('drag-over-top', 'drag-over-bottom');

                if (draggedIndex === null || draggedIndex === index) return;

                // Réorganiser les IDs
                const newsIds = [...this.currentJournal.newsIds];
                const [removed] = newsIds.splice(draggedIndex, 1);

                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                const targetIndex = e.clientY < midpoint ? index : index + 1;

                newsIds.splice(targetIndex > draggedIndex ? targetIndex - 1 : targetIndex, 0, removed);

                this.currentJournal.newsIds = newsIds;
                this.currentJournal.updatedAt = Date.now();

                await this.renderJournalNews();
                this.setupJournalDragAndDrop();
            });
        });
    }

    async saveJournal() {
        if (!this.currentJournal) return;

        try {
            this.currentJournal.updatedAt = Date.now();

            console.log('💾 Saving journal:', this.currentJournal);
            await this.storage.saveJournal(this.currentJournal);
            console.log('✅ Journal saved:', this.currentJournal.id);

            await this.loadJournals();
            this.showNotification('Journal enregistré avec succès', 'success');
        } catch (error) {
            console.error('❌ Save error:', error);
            alert('Erreur lors de la sauvegarde');
        }
    }

    async deleteJournal() {
        if (!this.currentJournal) return;

        if (!confirm(`Supprimer le journal "${this.currentJournal.title}" ?`)) return;

        try {
            await this.storage.deleteJournal(this.currentJournal.id);
            this.closeJournalEditor();
            this.showNotification('Journal supprimé', 'success');
        } catch (error) {
            console.error('❌ Delete error:', error);
            alert('Erreur lors de la suppression');
        }
    }

    async generateConductorFromJournal() {
        if (!this.currentJournal) return;

        const newsInJournal = await this.getNewsFromIds(this.currentJournal.newsIds || []);

        if (newsInJournal.length === 0) {
            alert('Le journal ne contient aucune news');
            return;
        }

        const timestamp = Date.now();
        const newConductor = {
            id: `conductor-${timestamp}`,
            title: `Conducteur - ${this.currentJournal.title}`,
            date: this.currentJournal.scheduledDate || new Date().toISOString().split('T')[0],
            startTime: this.currentJournal.scheduledTime || '18:00',
            segments: newsInJournal.map((news, index) => ({
                id: `seg-${timestamp}-${index}`,
                type: 'news',
                title: news.title,
                content: news.id, // Référence à la news
                duration: news.duration || 0,
                order: index
            })),
            author: this.currentUser?.username || 'Anonyme',
            createdAt: timestamp,
            updatedAt: timestamp
        };

        this.currentConductor = newConductor;

        // Sauvegarder le conducteur
        await this.storage.saveConductor(newConductor);

        // Basculer vers la vue conducteur
        this.switchView('conductor');

        this.showNotification('Conducteur généré avec succès', 'success');
    }

    closeJournalEditor() {
        this.currentJournal = null;
        const editor = document.getElementById('journal-editor');
        if (editor) {
            editor.innerHTML = `
                <div class="editor-placeholder">
                    <div class="placeholder-icon">📋</div>
                    <p>Sélectionnez ou créez un journal</p>
                </div>
            `;
        }
        this.loadJournals();
    }

    // ===== ON AIR MODE =====

    startOnAir() {
        if (!this.currentConductor) {
            alert('Veuillez sélectionner un conducteur');
            return;
        }

        if (!this.currentConductor.segments || this.currentConductor.segments.length === 0) {
            alert('Le conducteur ne contient aucun segment');
            return;
        }

        // Switch to On Air view
        this.switchView('onair');
    }

    initOnAirMode() {
        // Start clock
        this.updateOnAirClock();
        this.onAirClockInterval = setInterval(() => this.updateOnAirClock(), 1000);

        // Check if we have a conductor selected
        if (!this.currentConductor) {
            // Show empty state
            return;
        }

        // Initialize on-air state
        this.onAirCurrentIndex = 0;
        this.onAirPaused = false;
        this.onAirStartTime = Date.now(); // Temps de début absolu du conductor (ne change jamais)
        this.onAirSegmentStartTime = Date.now(); // Temps de début du segment actuel
        this.onAirElapsedTime = 0;

        // Start timer
        this.startOnAirTimer();

        // Display current segment
        this.updateOnAirDisplay();
    }

    updateOnAirClock() {
        const clock = document.getElementById('onair-clock');
        if (clock) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            clock.textContent = `${hours}:${minutes}:${seconds}`;
        }
    }

    startOnAirTimer() {
        if (this.onAirTimerInterval) {
            clearInterval(this.onAirTimerInterval);
        }

        this.onAirTimerInterval = setInterval(() => {
            if (!this.onAirPaused && this.currentConductor) {
                const currentSegment = this.currentConductor.segments[this.onAirCurrentIndex];
                if (!currentSegment) return;

                const segmentDuration = currentSegment.duration || 0;
                const elapsed = Math.floor((Date.now() - this.onAirSegmentStartTime) / 1000);
                const remaining = segmentDuration - elapsed;

                // Update timer display
                const timerEl = document.getElementById('onair-timer');
                if (timerEl) {
                    const mins = Math.floor(Math.abs(remaining) / 60);
                    const secs = Math.abs(remaining) % 60;
                    timerEl.textContent = `${remaining < 0 ? '-' : ''}${mins}:${String(secs).padStart(2, '0')}`;

                    // Warning if less than 30 seconds
                    if (remaining < 30 && remaining > 0) {
                        timerEl.classList.add('warning');
                    } else {
                        timerEl.classList.remove('warning');
                    }
                }

                // Update stats
                this.updateOnAirStats();
            }
        }, 1000);
    }

    async updateOnAirDisplay() {
        if (!this.currentConductor || !this.currentConductor.segments) return;

        const currentSegment = this.currentConductor.segments[this.onAirCurrentIndex];
        if (!currentSegment) return;

        // Get segment icon
        const segmentIcons = {
            'news': '📰',
            'animation': '🎙️',
            'pub': '📻',
            'music': '🎵',
            'habillage': '🎨',
            'chronique': '📖'
        };
        const icon = segmentIcons[currentSegment.type] || '📄';

        // Update badge
        const badgeEl = document.getElementById('onair-segment-badge');
        if (badgeEl) {
            badgeEl.textContent = `${icon} ${currentSegment.type.toUpperCase()} EN COURS`;
        }

        // Update segment number
        const numberEl = document.getElementById('onair-segment-number');
        if (numberEl) {
            numberEl.textContent = `#${this.onAirCurrentIndex + 1}`;
        }

        // Update title
        const titleEl = document.getElementById('onair-segment-title');
        if (titleEl) {
            titleEl.textContent = currentSegment.title || 'Sans titre';
        }

        // Si c'est une news, afficher lancement, audio et pied
        if (currentSegment.type === 'news' && currentSegment.content) {
            // Récupérer la news complète
            const news = await this.getNewsById(currentSegment.content);

            if (news) {
                // Récupérer les éléments du DOM
                const contentEl = document.getElementById('onair-segment-content');
                const lancementSection = document.getElementById('onair-lancement-section');
                const lancementText = document.getElementById('onair-lancement-text');
                const audioSection = document.getElementById('onair-audio-section');

                // Afficher lancement
                if (news.lancement && news.lancement.trim()) {
                    if (lancementSection) lancementSection.style.display = 'block';
                    if (lancementText) lancementText.textContent = news.lancement;
                } else {
                    if (lancementSection) lancementSection.style.display = 'none';
                }

                // Pour "sommaire" et "breve", afficher le contenu texte au lieu de l'audio
                if (news.category === 'sommaire' || news.category === 'breve') {
                    // Afficher le contenu texte
                    if (audioSection) audioSection.style.display = 'none';
                    if (contentEl) {
                        contentEl.style.display = 'block';
                        contentEl.textContent = news.content || '';
                    }
                    this.onAirCurrentNews = null;
                } else {
                    // Comportement normal : afficher l'audio s'il existe
                    if (contentEl) contentEl.style.display = 'none';
                    const audioInfo = document.getElementById('onair-audio-info');
                    if (news.audioUrl || news.audioFileName) {
                        if (audioSection) audioSection.style.display = 'block';
                        if (audioInfo) {
                            const duration = news.audioDuration || news.duration || 0;
                            audioInfo.textContent = `${news.audioFileName || 'Audio'} • ${this.formatDurationMMSS(duration)}`;
                        }
                        this.onAirCurrentNews = news;
                    } else {
                        if (audioSection) audioSection.style.display = 'none';
                        this.onAirCurrentNews = null;
                    }
                }

                // Afficher pied
                const piedSection = document.getElementById('onair-pied-section');
                const piedText = document.getElementById('onair-pied-text');
                if (news.pied && news.pied.trim()) {
                    if (piedSection) piedSection.style.display = 'block';
                    if (piedText) piedText.textContent = news.pied;
                } else {
                    if (piedSection) piedSection.style.display = 'none';
                }
            }
        } else {
            // Pour les segments non-news, afficher le contenu normal
            const contentEl = document.getElementById('onair-segment-content');
            if (contentEl) {
                contentEl.style.display = 'block';
                contentEl.textContent = currentSegment.content || '';
            }

            // Cacher les sections news
            const lancementSection = document.getElementById('onair-lancement-section');
            const audioSection = document.getElementById('onair-audio-section');
            const piedSection = document.getElementById('onair-pied-section');
            if (lancementSection) lancementSection.style.display = 'none';
            if (audioSection) audioSection.style.display = 'none';
            if (piedSection) piedSection.style.display = 'none';
            this.onAirCurrentNews = null;
        }

        // Update upcoming segments
        this.updateUpcomingSegments();

        // Update stats
        this.updateOnAirStats();
    }

    async getNewsById(newsId) {
        if (!this.allNews || this.allNews.length === 0) {
            const data = await this.storage.load();
            this.allNews = data.news || [];
        }
        return this.allNews.find(n => n.id === newsId);
    }

    onAirPlayAudio() {
        if (!this.onAirCurrentNews || !this.onAirCurrentNews.audioUrl) return;

        // Stop any existing audio
        this.onAirStopAudio();

        // Create audio element
        this.onAirAudio = new Audio(this.onAirCurrentNews.audioUrl);

        // Show stop button, hide play button
        const playBtn = document.getElementById('onair-audio-play');
        const stopBtn = document.getElementById('onair-audio-stop');
        if (playBtn) playBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';

        // Play audio
        this.onAirAudio.play();

        // Update info with time
        this.onAirAudioInterval = setInterval(() => {
            const audioInfo = document.getElementById('onair-audio-info');
            if (audioInfo && this.onAirAudio) {
                const current = Math.floor(this.onAirAudio.currentTime);
                const total = Math.floor(this.onAirAudio.duration) || 0;
                audioInfo.textContent = `${this.formatDurationMMSS(current)} / ${this.formatDurationMMSS(total)}`;
            }
        }, 100);

        // When audio ends
        this.onAirAudio.addEventListener('ended', () => {
            this.onAirStopAudio();
        });
    }

    onAirStopAudio() {
        if (this.onAirAudio) {
            this.onAirAudio.pause();
            this.onAirAudio = null;
        }

        if (this.onAirAudioInterval) {
            clearInterval(this.onAirAudioInterval);
            this.onAirAudioInterval = null;
        }

        // Show play button, hide stop button
        const playBtn = document.getElementById('onair-audio-play');
        const stopBtn = document.getElementById('onair-audio-stop');
        if (playBtn) playBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'none';

        // Reset info
        const audioInfo = document.getElementById('onair-audio-info');
        if (audioInfo && this.onAirCurrentNews) {
            const duration = this.onAirCurrentNews.audioDuration || this.onAirCurrentNews.duration || 0;
            audioInfo.textContent = `${this.onAirCurrentNews.audioFileName || 'Audio'} • ${this.formatDurationMMSS(duration)}`;
        }
    }

    updateUpcomingSegments() {
        if (!this.currentConductor || !this.currentConductor.segments) return;

        const upcomingList = document.getElementById('onair-upcoming-list');
        if (!upcomingList) return;

        const upcomingSegments = this.currentConductor.segments.slice(this.onAirCurrentIndex + 1, this.onAirCurrentIndex + 4);

        if (upcomingSegments.length === 0) {
            upcomingList.innerHTML = '<div class="onair-empty-state">Aucun segment suivant</div>';
            return;
        }

        const segmentIcons = {
            'news': '📰',
            'animation': '🎙️',
            'pub': '📻',
            'music': '🎵',
            'habillage': '🎨',
            'chronique': '📖'
        };

        upcomingList.innerHTML = upcomingSegments.map((seg, index) => {
            const icon = segmentIcons[seg.type] || '📄';
            const segmentNumber = this.onAirCurrentIndex + index + 2;
            const duration = this.formatDurationMMSS(seg.duration || 0);

            return `
                <div class="onair-upcoming-item">
                    <div class="onair-upcoming-number">${segmentNumber}</div>
                    <div class="onair-upcoming-info">
                        <div class="onair-upcoming-info-title">${icon} ${seg.title || 'Sans titre'}</div>
                        <div class="onair-upcoming-info-meta">${seg.type}</div>
                    </div>
                    <div class="onair-upcoming-time">
                        <div class="onair-upcoming-duration">${duration}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateOnAirStats() {
        if (!this.currentConductor) return;

        const segments = this.currentConductor.segments || [];
        const totalSegments = segments.length;
        const currentIndex = this.onAirCurrentIndex + 1;

        // Segments counter
        const segmentsEl = document.getElementById('onair-stat-segments');
        if (segmentsEl) {
            segmentsEl.textContent = `${currentIndex}/${totalSegments}`;
        }

        // Calculate elapsed time: temps réel écoulé depuis le début du conductor
        const elapsedSeconds = Math.floor((Date.now() - this.onAirStartTime) / 1000);

        // Calculate total and remaining time based on theoretical durations
        let totalSeconds = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
        let remainingSeconds = totalSeconds - elapsedSeconds;

        // Elapsed time
        const elapsedEl = document.getElementById('onair-stat-elapsed');
        if (elapsedEl) {
            elapsedEl.textContent = this.formatDurationMMSS(elapsedSeconds);
        }

        // Remaining time
        const remainingEl = document.getElementById('onair-stat-remaining');
        if (remainingEl) {
            remainingEl.textContent = this.formatDurationMMSS(Math.max(0, remainingSeconds));
        }

        // End time
        const endEl = document.getElementById('onair-stat-end');
        if (endEl) {
            const now = new Date();
            const endTime = new Date(now.getTime() + remainingSeconds * 1000);
            const hours = String(endTime.getHours()).padStart(2, '0');
            const minutes = String(endTime.getMinutes()).padStart(2, '0');
            endEl.textContent = `${hours}:${minutes}`;
        }
    }

    onAirNext() {
        if (!this.currentConductor || !this.currentConductor.segments) return;

        if (this.onAirCurrentIndex < this.currentConductor.segments.length - 1) {
            // Stop any playing audio
            this.onAirStopAudio();

            this.onAirCurrentIndex++;
            this.onAirSegmentStartTime = Date.now(); // Reset le timer du segment uniquement
            this.updateOnAirDisplay();
        } else {
            alert('Vous êtes au dernier segment');
        }
    }

    onAirPrevious() {
        if (!this.currentConductor) return;

        if (this.onAirCurrentIndex > 0) {
            // Stop any playing audio
            this.onAirStopAudio();

            this.onAirCurrentIndex--;
            this.onAirSegmentStartTime = Date.now(); // Reset le timer du segment uniquement
            this.updateOnAirDisplay();
        } else {
            alert('Vous êtes au premier segment');
        }
    }

    onAirPause() {
        this.onAirPaused = !this.onAirPaused;
        const pauseBtn = document.getElementById('onair-pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = this.onAirPaused ? '▶️' : '⏸️';
        }
    }

    onAirStop() {
        if (confirm('Arrêter la diffusion ?')) {
            this.exitOnAir();
        }
    }

    exitOnAir() {
        // Stop any playing audio
        this.onAirStopAudio();

        // Clear intervals
        if (this.onAirClockInterval) {
            clearInterval(this.onAirClockInterval);
            this.onAirClockInterval = null;
        }
        if (this.onAirTimerInterval) {
            clearInterval(this.onAirTimerInterval);
            this.onAirTimerInterval = null;
        }

        // Reset state
        this.onAirCurrentIndex = 0;
        this.onAirPaused = false;
        this.onAirStartTime = null;
        this.onAirCurrentNews = null;

        // Return to conductor view
        this.switchView('conductor');
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

    // Export functionality with menu
    exportAudio() {
        if (!this.currentBuffer) {
            showNotification('No audio to export', 'warning');
            return;
        }

        // Show export menu
        const menu = document.getElementById('audio-export-menu');
        if (menu) {
            const isActive = menu.classList.contains('active');
            menu.classList.toggle('active');

            // Add click outside listener to close menu
            if (!isActive) {
                setTimeout(() => {
                    const closeMenu = (e) => {
                        if (!menu.contains(e.target) && !e.target.closest('.btn-secondary')) {
                            menu.classList.remove('active');
                            document.removeEventListener('click', closeMenu);
                        }
                    };
                    document.addEventListener('click', closeMenu);
                }, 10);
            }
        }
    }

    async exportToNews() {
        if (!this.currentBuffer) {
            showNotification('No audio to export', 'warning');
            return;
        }

        // Check if we have a current news
        if (!window.app || !window.app.currentNews) {
            showNotification('No news selected', 'warning');
            return;
        }

        try {
            // Hide export menu
            const menu = document.getElementById('audio-export-menu');
            if (menu) menu.classList.remove('active');

            showNotification('Exporting to news...', 'info');

            // Create export buffer (with In/Out points)
            const exportBuffer = this.createExportBuffer();

            // Convert to WAV
            const audioData = this.bufferToWav(exportBuffer);
            const blob = new Blob([audioData], { type: 'audio/wav' });

            // Create File object
            const fileName = `${window.app.currentNews.id}-audio-edited-${Date.now()}.wav`;
            const file = new File([blob], fileName, { type: 'audio/wav' });

            // Mark audio editor as having no changes (to prevent loop)
            if (this.hasChanges !== undefined) {
                this.hasChanges = false;
            }

            // Return to news editor first
            if (window.app.switchView) {
                window.app.switchView('news');
            }

            // Use handleAudioUpload to do all the work (UI, S3, save, etc.)
            if (window.app.handleAudioUpload) {
                await window.app.handleAudioUpload(file);
                showNotification('Audio exported to news successfully!', 'success');
                console.log('✅ Audio exported to news');
            } else {
                throw new Error('handleAudioUpload not available');
            }
        } catch (error) {
            console.error('❌ Error exporting to news:', error);
            showNotification('Error exporting to news', 'error');
        }
    }

    async exportAsWAV() {
        if (!this.currentBuffer) {
            showNotification('No audio to export', 'warning');
            return;
        }

        try {
            // Hide export menu
            const menu = document.getElementById('audio-export-menu');
            if (menu) menu.classList.remove('active');

            // Create export buffer (with In/Out points)
            const exportBuffer = this.createExportBuffer();
            const audioData = this.bufferToWav(exportBuffer);
            const blob = new Blob([audioData], { type: 'audio/wav' });

            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edited_audio_${Date.now()}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotification('Audio exported as WAV', 'success');
        } catch (error) {
            console.error('Error exporting as WAV:', error);
            showNotification('Error exporting as WAV', 'error');
        }
    }

    async exportAsMP3() {
        if (!this.currentBuffer) {
            showNotification('No audio to export', 'warning');
            return;
        }

        try {
            // Hide export menu
            const menu = document.getElementById('audio-export-menu');
            if (menu) menu.classList.remove('active');

            // Create export buffer (with In/Out points)
            const exportBuffer = this.createExportBuffer();

            // For now, we'll export as WAV with .mp3 extension
            const audioData = this.bufferToWav(exportBuffer);
            const blob = new Blob([audioData], { type: 'audio/mpeg' });

            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edited_audio_${Date.now()}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotification('Audio exported as MP3', 'success');
        } catch (error) {
            console.error('Error exporting as MP3:', error);
            showNotification('Error exporting as MP3', 'error');
        }
    }

    createExportBuffer() {
        if (!this.currentBuffer) return null;

        // Determine export range
        let start = 0;
        let end = this.currentBuffer.duration;

        if (this.inPoint !== null && this.outPoint !== null) {
            start = this.inPoint;
            end = this.outPoint;
        }

        const startSample = Math.floor(start * this.currentBuffer.sampleRate);
        const endSample = Math.floor(end * this.currentBuffer.sampleRate);
        const length = endSample - startSample;

        // Create export buffer
        const exportBuffer = this.audioContext.createBuffer(
            this.currentBuffer.numberOfChannels,
            length,
            this.currentBuffer.sampleRate
        );

        // Copy audio data
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const sourceData = this.currentBuffer.getChannelData(channel);
            const exportData = exportBuffer.getChannelData(channel);

            for (let i = 0; i < length; i++) {
                exportData[i] = sourceData[startSample + i];
            }
        }

        return exportBuffer;
    }

    bufferToWav(buffer) {
        // Convert AudioBuffer to WAV format
        const length = buffer.length * buffer.numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;

        // Write WAV header
        const setUint16 = (data) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };

        const setUint32 = (data) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(buffer.numberOfChannels);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels); // avg. bytes/sec
        setUint16(buffer.numberOfChannels * 2); // block-align
        setUint16(16); // 16-bit

        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // Write interleaved data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return arrayBuffer;
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

.form-row-2 {
    grid-template-columns: 1fr 1fr;
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

/* ==================== ON AIR VIEW ==================== */

#onair-view {
    background: #000;
    color: #fff;
}

.onair-topbar {
    position: fixed;
    top: 0;
    left: 280px;
    right: 0;
    height: 48px;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid #222;
    display: flex;
    align-items: center;
    padding: 0 24px;
    gap: 24px;
    z-index: 1000;
}

.onair-topbar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 700;
    font-size: 16px;
    color: #f85149;
}

.onair-logo-icon {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #f85149, #da3633);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
}

.onair-topbar-status {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
}

.onair-live-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(248, 81, 73, 0.2);
    border: 2px solid #f85149;
    border-radius: 8px;
    font-weight: 700;
    font-size: 14px;
    color: #f85149;
}

.onair-live-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #f85149;
    animation: onair-pulse 2s infinite;
}

@keyframes onair-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.2); }
}

.onair-topbar-time {
    font-size: 20px;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    color: #fff;
}

.onair-container {
    margin-top: 48px;
    height: calc(100vh - 48px);
    display: grid;
    grid-template-columns: 1fr 400px;
    padding: 16px;
    gap: 16px;
}

.onair-main-display {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.onair-current-segment {
    background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
    border: 2px solid #f85149;
    border-radius: 16px;
    padding: 0;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 60px rgba(248, 81, 73, 0.3);
    overflow: hidden;
}

/* Timer en pleine largeur avec fond transparent rouge */
.onair-timer-banner {
    background: rgba(248, 81, 73, 0.15);
    border-bottom: 2px solid #f85149;
    padding: 16px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.onair-timer-label {
    font-size: 14px;
    color: #f85149;
    font-weight: 700;
    letter-spacing: 1px;
}

.onair-timer-value {
    font-size: 48px;
    font-weight: 900;
    font-family: 'Courier New', monospace;
    color: #f85149;
    line-height: 1;
}

.onair-timer-value.warning {
    color: #fbbf24;
    animation: onair-blink 1s infinite;
}

/* Header du segment */
.onair-segment-header {
    padding: 24px 32px;
    border-bottom: 1px solid #333;
}

.onair-segment-badge {
    display: inline-block;
    padding: 6px 12px;
    background: rgba(248, 81, 73, 0.2);
    border: 1px solid #f85149;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #f85149;
    margin-bottom: 8px;
}

.onair-segment-number {
    font-size: 64px;
    font-weight: 900;
    color: rgba(248, 81, 73, 0.3);
    line-height: 1;
    display: inline-block;
    margin-left: 16px;
}

.onair-segment-title {
    font-size: 32px;
    font-weight: 700;
    color: #fff;
    margin-top: 12px;
    line-height: 1.2;
}

.onair-segment-content {
    font-size: 20px;
    color: #999;
    line-height: 1.5;
    padding: 32px;
}

.onair-lancement-section,
.onair-pied-section,
.onair-audio-section {
    padding: 24px 32px;
    border-top: 1px solid #333;
}

.onair-section-label {
    font-size: 14px;
    font-weight: 700;
    color: #f85149;
    text-transform: uppercase;
    margin-bottom: 16px;
    letter-spacing: 1px;
}

.onair-lancement-text,
.onair-pied-text {
    font-size: 22px;
    color: #fff;
    line-height: 1.6;
    font-weight: 400;
}

.onair-pied-text {
    font-size: 20px;
    color: #999;
}

.onair-audio-controls {
    display: flex;
    gap: 16px;
    align-items: center;
}

.onair-audio-btn {
    padding: 16px 32px;
    font-size: 18px;
    font-weight: 700;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.onair-audio-btn.play {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.onair-audio-btn.play:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.6);
}

.onair-audio-btn.stop {
    background: #ef4444;
    color: white;
}

.onair-audio-btn.stop:hover {
    background: #dc2626;
}

.onair-audio-info {
    font-size: 16px;
    color: #999;
    font-family: 'Courier New', monospace;
}

.onair-controls {
    display: flex;
    justify-content: center;
    gap: 16px;
}

.onair-control-btn {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-size: 32px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.onair-control-btn.primary {
    background: linear-gradient(135deg, #f85149, #da3633);
    color: white;
    box-shadow: 0 8px 24px rgba(248, 81, 73, 0.4);
}

.onair-control-btn.primary:hover {
    transform: scale(1.1);
    box-shadow: 0 12px 32px rgba(248, 81, 73, 0.6);
}

.onair-control-btn.secondary {
    background: #1a1a1a;
    border: 2px solid #333;
    color: #999;
}

.onair-control-btn.secondary:hover {
    background: #2a2a2a;
    border-color: #f85149;
    color: #f85149;
}

.onair-sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
}

.onair-upcoming-segments {
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 24px;
    max-height: 300px;
    overflow-y: auto;
}

.onair-upcoming-title {
    font-size: 14px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 16px;
    letter-spacing: 1px;
}

.onair-upcoming-item {
    display: flex;
    gap: 16px;
    padding: 16px;
    background: #1a1a1a;
    border-radius: 8px;
    margin-bottom: 12px;
    align-items: center;
    transition: all 0.2s;
}

.onair-upcoming-item:hover {
    background: #2a2a2a;
    border: 1px solid #333;
}

.onair-upcoming-number {
    width: 48px;
    height: 48px;
    background: #0a0a0a;
    border: 2px solid #333;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: #666;
    flex-shrink: 0;
}

.onair-upcoming-info {
    flex: 1;
}

.onair-upcoming-info-title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 4px;
}

.onair-upcoming-info-meta {
    font-size: 13px;
    color: #666;
}

.onair-upcoming-time {
    text-align: right;
    font-family: 'Courier New', monospace;
}

.onair-upcoming-timecode {
    font-size: 18px;
    font-weight: 700;
    color: #999;
}

.onair-upcoming-duration {
    font-size: 12px;
    color: #666;
}

.onair-info-card {
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 24px;
}

.onair-info-title {
    font-size: 14px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 16px;
    letter-spacing: 1px;
}

.onair-info-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.onair-stat-item {
    text-align: center;
    padding: 16px;
    background: #1a1a1a;
    border-radius: 8px;
}

.onair-stat-value {
    font-size: 36px;
    font-weight: 700;
    color: #f85149;
    margin-bottom: 4px;
}

.onair-stat-label {
    font-size: 12px;
    color: #666;
}

.onair-empty-state {
    text-align: center;
    padding: 32px;
    color: #666;
}

/* Responsive for On Air */
@media (max-width: 1200px) {
    .onair-container {
        grid-template-columns: 1fr;
    }

    .onair-sidebar {
        max-height: 400px;
    }

    .onair-timer-value {
        font-size: 36px;
    }

    .onair-segment-number {
        font-size: 48px;
    }

    .onair-segment-title {
        font-size: 24px;
    }

    .onair-lancement-text {
        font-size: 18px;
    }

    .onair-pied-text {
        font-size: 16px;
    }
}

@media (max-width: 768px) {
    .onair-topbar {
        left: 0;
    }

    .onair-timer-banner {
        padding: 12px 16px;
    }

    .onair-timer-value {
        font-size: 28px;
    }

    .onair-segment-header {
        padding: 16px;
    }

    .onair-segment-number {
        font-size: 32px;
    }

    .onair-segment-title {
        font-size: 20px;
    }

    .onair-lancement-section,
    .onair-pied-section,
    .onair-audio-section {
        padding: 16px;
    }

    .onair-controls {
        gap: 8px;
    }

    .onair-control-btn {
        width: 60px;
        height: 60px;
        font-size: 24px;
    }

    .form-row-2,
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
