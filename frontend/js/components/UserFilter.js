/**
 * Composant de filtre par utilisateur
 * Permet de filtrer le contenu par utilisateur
 */

class UserFilter {
    constructor() {
        this.currentFilter = {
            userId: null, // null = tous
            showOnlyMine: false
        };
        
        this.users = new Map(); // Cache des utilisateurs
    }

    /**
     * Initialiser le composant
     */
    init() {
        this.render();
        this.attachEventListeners();
        this.loadUsers();
    }

    /**
     * Charger la liste des utilisateurs
     */
    async loadUsers() {
        try {
            // Récupérer tous les utilisateurs uniques depuis les données
            const storage = window.app.storage;
            const data = await storage.load();
            
            const userIds = new Set();
            const userMap = new Map();
            
            // Extraire les utilisateurs uniques
            [...(data.news || []), ...(data.animations || [])].forEach(item => {
                if (item.userId && item.author) {
                    userIds.add(item.userId);
                    if (!userMap.has(item.userId)) {
                        userMap.set(item.userId, {
                            id: item.userId,
                            name: item.author,
                            email: item.userEmail || ''
                        });
                    }
                }
            });
            
            this.users = userMap;
            this.updateUserList();
            
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    /**
     * Render du composant
     */
    render() {
        // Ajouter le filtre dans chaque section (News et Animations)
        const sections = ['news', 'animation'];
        
        sections.forEach(section => {
            const searchBar = document.querySelector(`#${section}-search`)?.parentElement;
            if (searchBar && !document.querySelector(`#${section}-user-filter`)) {
                const filterHtml = `
                    <div id="${section}-user-filter" class="user-filter-container">
                        <div class="filter-header">
                            <span class="filter-icon">👥</span>
                            <span class="filter-title">Filtre utilisateur</span>
                        </div>
                        <div class="filter-controls">
                            <button class="filter-btn filter-all active" data-filter="all">
                                <span>📚</span> Tout
                            </button>
                            <button class="filter-btn filter-mine" data-filter="mine">
                                <span>👤</span> Mes contenus
                            </button>
                            <div class="filter-dropdown">
                                <button class="filter-btn filter-select" data-filter="select">
                                    <span>🔍</span> <span class="selected-user">Sélectionner...</span>
                                    <span class="dropdown-arrow">▼</span>
                                </button>
                                <div class="filter-dropdown-content hidden">
                                    <input type="text" class="filter-search" placeholder="Rechercher un utilisateur...">
                                    <div class="filter-user-list"></div>
                                </div>
                            </div>
                        </div>
                        <div class="filter-stats">
                            <span class="stat-item">
                                <span class="stat-icon">📰</span>
                                <span class="stat-count" data-type="count">-</span> éléments
                            </span>
                            <span class="stat-item">
                                <span class="stat-icon">👥</span>
                                <span class="stat-count" data-type="users">-</span> contributeurs
                            </span>
                        </div>
                    </div>
                `;
                
                searchBar.insertAdjacentHTML('afterend', filterHtml);
            }
        });
        
        this.addStyles();
    }

    /**
     * Ajouter les styles CSS
     */
    addStyles() {
        if (document.getElementById('user-filter-styles')) return;
        
        const styles = `
            <style id="user-filter-styles">
                .user-filter-container {
                    background: var(--bg-light);
                    border: 1px solid var(--border);
                    border-radius: var(--border-radius);
                    padding: 0.75rem;
                    margin: 0.5rem 0;
                }

                .filter-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid var(--border);
                }

                .filter-icon {
                    font-size: 1.2rem;
                }

                .filter-title {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .filter-controls {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    margin-bottom: 0.75rem;
                }

                .filter-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    padding: 0.4rem 0.8rem;
                    background: var(--bg-dark);
                    border: 1px solid var(--border);
                    border-radius: var(--border-radius-sm);
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: var(--transition);
                    white-space: nowrap;
                }

                .filter-btn:hover {
                    background: var(--bg-darker);
                    border-color: var(--primary);
                    color: var(--text-primary);
                }

                .filter-btn.active {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }

                .filter-dropdown {
                    position: relative;
                    flex: 1;
                    min-width: 200px;
                }

                .filter-select {
                    width: 100%;
                    justify-content: space-between;
                }

                .selected-user {
                    flex: 1;
                    text-align: left;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .dropdown-arrow {
                    font-size: 0.7rem;
                    transition: transform 0.2s;
                }

                .filter-select.open .dropdown-arrow {
                    transform: rotate(180deg);
                }

                .filter-dropdown-content {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    margin-top: 0.25rem;
                    background: var(--bg-darker);
                    border: 1px solid var(--border);
                    border-radius: var(--border-radius-sm);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    z-index: 1000;
                    max-height: 250px;
                    overflow-y: auto;
                }

                .filter-dropdown-content.hidden {
                    display: none;
                }

                .filter-search {
                    width: calc(100% - 1rem);
                    margin: 0.5rem;
                    padding: 0.4rem;
                    background: var(--bg-dark);
                    border: 1px solid var(--border);
                    border-radius: var(--border-radius-sm);
                    color: var(--text-primary);
                    font-size: 0.85rem;
                }

                .filter-user-list {
                    padding: 0.25rem 0;
                }

                .filter-user-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    cursor: pointer;
                    transition: var(--transition);
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }

                .filter-user-item:hover {
                    background: var(--bg-light);
                    color: var(--text-primary);
                }

                .filter-user-item.selected {
                    background: var(--primary);
                    color: white;
                }

                .user-avatar {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--primary);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: bold;
                }

                .user-info {
                    flex: 1;
                }

                .user-name {
                    display: block;
                    font-weight: 500;
                }

                .user-email {
                    display: block;
                    font-size: 0.75rem;
                    opacity: 0.7;
                }

                .filter-stats {
                    display: flex;
                    gap: 1rem;
                    padding-top: 0.5rem;
                    border-top: 1px solid var(--border);
                    font-size: 0.85rem;
                    color: var(--text-muted);
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                }

                .stat-icon {
                    opacity: 0.7;
                }

                .stat-count {
                    color: var(--text-primary);
                    font-weight: 600;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Attacher les event listeners
     */
    attachEventListeners() {
        // Boutons de filtre
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                const section = e.currentTarget.closest('.user-filter-container').id.split('-')[0];
                
                if (filter === 'all') {
                    this.setFilter(null, section);
                } else if (filter === 'mine') {
                    this.setFilter({ showOnlyMine: true }, section);
                } else if (filter === 'select') {
                    this.toggleDropdown(e.currentTarget);
                }
            });
        });
        
        // Recherche dans la dropdown
        document.querySelectorAll('.filter-search').forEach(input => {
            input.addEventListener('input', (e) => {
                this.filterUserList(e.target.value, e.target.closest('.filter-dropdown'));
            });
        });
        
        // Fermer les dropdowns en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-dropdown')) {
                document.querySelectorAll('.filter-dropdown-content').forEach(dd => {
                    dd.classList.add('hidden');
                });
                document.querySelectorAll('.filter-select').forEach(btn => {
                    btn.classList.remove('open');
                });
            }
        });
    }

    /**
     * Toggle dropdown
     */
    toggleDropdown(button) {
        const dropdown = button.nextElementSibling;
        const isOpen = !dropdown.classList.contains('hidden');
        
        // Fermer toutes les dropdowns
        document.querySelectorAll('.filter-dropdown-content').forEach(dd => {
            dd.classList.add('hidden');
        });
        document.querySelectorAll('.filter-select').forEach(btn => {
            btn.classList.remove('open');
        });
        
        // Ouvrir/fermer celle-ci
        if (!isOpen) {
            dropdown.classList.remove('hidden');
            button.classList.add('open');
            dropdown.querySelector('.filter-search')?.focus();
        }
    }

    /**
     * Mettre à jour la liste des utilisateurs
     */
    updateUserList() {
        document.querySelectorAll('.filter-user-list').forEach(list => {
            let html = '';
            
            this.users.forEach(user => {
                const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
                html += `
                    <div class="filter-user-item" data-user-id="${user.id}">
                        <div class="user-avatar">${initials}</div>
                        <div class="user-info">
                            <span class="user-name">${user.name}</span>
                            ${user.email ? `<span class="user-email">${user.email}</span>` : ''}
                        </div>
                    </div>
                `;
            });
            
            list.innerHTML = html;
            
            // Attacher les listeners
            list.querySelectorAll('.filter-user-item').forEach(item => {
                item.addEventListener('click', () => {
                    const userId = item.dataset.userId;
                    const userName = item.querySelector('.user-name').textContent;
                    const section = item.closest('.user-filter-container').id.split('-')[0];
                    
                    this.setFilter({ userId }, section);
                    
                    // Mettre à jour le bouton
                    const button = item.closest('.filter-dropdown').querySelector('.selected-user');
                    button.textContent = userName;
                    
                    // Fermer la dropdown
                    item.closest('.filter-dropdown-content').classList.add('hidden');
                    item.closest('.filter-dropdown').querySelector('.filter-select').classList.remove('open');
                });
            });
        });
    }

    /**
     * Filtrer la liste des utilisateurs
     */
    filterUserList(searchTerm, dropdown) {
        const items = dropdown.querySelectorAll('.filter-user-item');
        const term = searchTerm.toLowerCase();
        
        items.forEach(item => {
            const name = item.querySelector('.user-name').textContent.toLowerCase();
            const email = item.querySelector('.user-email')?.textContent.toLowerCase() || '';
            
            if (name.includes(term) || email.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * Appliquer un filtre
     */
    setFilter(filter, section) {
        this.currentFilter = filter;
        
        // Mettre à jour l'UI
        const container = document.getElementById(`${section}-user-filter`);
        if (container) {
            // Reset tous les boutons
            container.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Activer le bon bouton
            if (!filter) {
                container.querySelector('.filter-all').classList.add('active');
            } else if (filter.showOnlyMine) {
                container.querySelector('.filter-mine').classList.add('active');
            } else if (filter.userId) {
                container.querySelector('.filter-select').classList.add('active');
            }
        }
        
        // Appliquer le filtre au storage
        if (window.app && window.app.storage) {
            window.app.storage.setFilter(filter);
        }
        
        // Mettre à jour les stats
        this.updateStats(section);
    }

    /**
     * Mettre à jour les statistiques
     */
    updateStats(section) {
        const container = document.getElementById(`${section}-user-filter`);
        if (!container) return;
        
        const stats = window.app.storage.getStats();
        const countEl = container.querySelector('[data-type="count"]');
        const usersEl = container.querySelector('[data-type="users"]');
        
        if (section === 'news') {
            countEl.textContent = this.currentFilter?.showOnlyMine ? stats.myNews : stats.totalNews;
        } else {
            countEl.textContent = this.currentFilter?.showOnlyMine ? stats.myAnimations : stats.totalAnimations;
        }
        
        usersEl.textContent = stats.activeUsers;
    }
}

// Export global
window.UserFilter = UserFilter;