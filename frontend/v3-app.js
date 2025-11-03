/* ===== SAINT-ESPRIT V3 - APP LOGIC ===== */

class SaintEspritV3 {
    constructor() {
        this.currentView = 'dashboard';
        this.storage = null;
        this.newsManager = null;
        this.durationManager = null;
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
                <div class="news-item" onclick="app.editNews('${n.id}')">
                    <div class="news-title">${n.title || 'Sans titre'}</div>
                    <div class="news-meta">${n.scheduledDate} • ${n.author}</div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading news:', error);
        }
    }

    createNews() {
        console.log('📝 Creating new news...');
        // TODO: Implement news creation
        alert('Création de news - En cours d\'implémentation');
    }

    editNews(newsId) {
        console.log(`✏️ Editing news ${newsId}`);
        // TODO: Implement news editor
        alert(`Édition de la news ${newsId} - En cours d\'implémentation`);
    }
}

// Global function for onclick handlers
function switchView(viewName) {
    if (window.app) {
        window.app.switchView(viewName);
    }
}

function createNews() {
    if (window.app) {
        window.app.createNews();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SaintEspritV3();
});

// Add news list item styles
const style = document.createElement('style');
style.textContent = `
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

.news-title {
    font-weight: 500;
    margin-bottom: 4px;
}

.news-meta {
    font-size: 12px;
    color: var(--text-muted);
}
`;
document.head.appendChild(style);
