// Simplified Content Manager for News and Animation
class ContentManager {
    constructor(type) {
        this.type = type; // 'news' or 'animation'
        this.database = [];
        this.currentId = null;
        this.prefix = type === 'animation' ? 'animation-' : 'news-';  // IMPORTANT: pr\u00e9fixe correct pour news
        this.listeners = new Map();
        
        // Virtual list for performance
        this.virtualList = null;
        
        // Cache for DOM elements
        this.domCache = new Map();
        
        // Lock management
        this.lockHeartbeatInterval = null;
        this.currentLockId = null;
        
        // Debounced functions
        if (typeof Utils !== 'undefined' && Utils.debounce) {
            this.debouncedCalculateDuration = Utils.debounce(
                () => this.calculateDuration(), 
                Constants.DEBOUNCE_DELAY || 300
            );
        }
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }

    // Database operations
    setDatabase(database) {
        this.database = database;
        this.emit('database-changed', this.database);
    }

    getDatabase() {
        return this.database;
    }

    getCurrentItem() {
        if (!this.currentId) return null;
        return this.database.find(item => item.id === this.currentId);
    }

    // Initialize manager
    async init() {
        console.log(`Initializing ${this.type} manager...`);
        
        // Load data from storage
        if (window.app && window.app.storage) {
            try {
                const data = await window.app.storage.loadData();
                if (data && data[this.type]) {
                    this.setDatabase(data[this.type] || []);
                }
            } catch (error) {
                console.error(`Error loading ${this.type} data:`, error);
            }
        }
        
        // Setup UI
        this.setupUI();
    }

    // Setup UI
    setupUI() {
        // This will be implemented based on the type
        console.log(`Setting up UI for ${this.type}`);
    }

    // Render the UI
    render() {
        console.log(`Rendering ${this.type} manager`);
        this.updateList();
    }

    // Update the list display
    updateList() {
        const listElement = document.getElementById(`${this.type}-list`);
        if (!listElement) {
            console.warn(`List element not found: ${this.type}-list`);
            return;
        }
        
        // Clear current list
        listElement.innerHTML = '';
        
        // Render items
        if (this.database.length === 0) {
            listElement.innerHTML = `<div class="empty-state">Aucune ${this.type === 'news' ? 'news' : 'animation'} disponible</div>`;
            return;
        }
        
        this.database.forEach(item => {
            const itemElement = this.createListItem(item);
            if (itemElement) {
                listElement.appendChild(itemElement);
            }
        });
    }

    // Create a list item element
    createListItem(item) {
        const div = document.createElement('div');
        div.className = `${this.type}-item`;
        div.dataset.id = item.id;
        // Ajouter aussi newsId pour compatibilité avec le gestionnaire de clic global
        if (this.type === 'news') {
            div.dataset.newsId = item.id;
        }
        
        const isSelected = item.id === this.currentId;
        if (isSelected) {
            div.classList.add('selected');
        }
        
        div.innerHTML = `
            <div class="item-header">
                <span class="item-title">${item.title || 'Sans titre'}</span>
                <span class="item-duration">${item.duration || '00:00'}</span>
            </div>
            <div class="item-meta">
                <span class="item-author">${this.getAuthorDisplay(item.author)}</span>
                <span class="item-date">${this.formatDate(item.updatedAt || item.createdAt)}</span>
            </div>
        `;
        
        // Add click handler
        div.onclick = () => this.selectItem(item.id);
        
        return div;
    }

    // Select an item
    async selectItem(itemId) {
        this.currentId = itemId;
        const item = this.getCurrentItem();
        
        if (item) {
            console.log(`Selected ${this.type}:`, item.title);
            
            // Show and update editor
            const editorElement = document.getElementById(`${this.type}-editor`);
            if (editorElement) {
                // Remove hidden class to show editor
                editorElement.classList.remove('hidden');
                this.updateEditor(item);
            }
            
            // Update list selection
            document.querySelectorAll(`.${this.type}-item`).forEach(el => {
                el.classList.toggle('selected', el.dataset.id === itemId);
            });
            
            // Hide the welcome message if it exists
            const welcomeMessage = document.querySelector('.news-welcome');
            if (welcomeMessage) {
                welcomeMessage.style.display = 'none';
            }
            
            this.emit('item-selected', item);
        }
    }

    // Update editor with item content
    updateEditor(item) {
        const titleInput = document.getElementById(`${this.type}-title`);
        const contentTextarea = document.getElementById(`${this.type}-content`);
        const durationInput = document.getElementById(`${this.type}-duration`);
        const authorInput = document.getElementById(`${this.type}-author`);
        
        if (titleInput) {
            titleInput.value = item.title || '';
            // Add event listener for auto-save
            titleInput.oninput = () => this.saveCurrentItem();
        }
        if (contentTextarea) {
            contentTextarea.value = item.content || '';
            // Add event listener for auto-save
            contentTextarea.oninput = () => this.saveCurrentItem();
        }
        if (durationInput) {
            durationInput.value = item.duration || '00:00';
            durationInput.oninput = () => this.saveCurrentItem();
        }
        if (authorInput) {
            authorInput.value = item.author || '';
            authorInput.oninput = () => this.saveCurrentItem();
        }
    }
    
    // Save current item
    async saveCurrentItem() {
        const item = this.getCurrentItem();
        if (!item) return;
        
        const titleInput = document.getElementById(`${this.type}-title`);
        const contentTextarea = document.getElementById(`${this.type}-content`);
        const durationInput = document.getElementById(`${this.type}-duration`);
        const authorInput = document.getElementById(`${this.type}-author`);
        
        if (titleInput) item.title = titleInput.value;
        if (contentTextarea) item.content = contentTextarea.value;
        if (durationInput) item.duration = durationInput.value;
        if (authorInput) item.author = authorInput.value;
        
        item.updatedAt = Date.now();
        
        await this.saveItem(item);
        console.log(`Auto-saved ${this.type}:`, item.title);
        
        // Mettre à jour l'affichage de la liste
        this.updateList();
    }

    // Get author display name
    getAuthorDisplay(author) {
        if (!author) return 'Anonyme';
        
        // Si c'est un UUID, essayer de récupérer le nom réel
        if (author.includes('-')) {
            // Essayer de récupérer le nom depuis authManager ou localStorage
            const fullname = localStorage.getItem('saint-esprit-user-fullname');
            const username = localStorage.getItem('saint-esprit-user-name');
            const userEmail = localStorage.getItem('saint-esprit-user-email');
            
            // Si l'UUID correspond à l'utilisateur actuel
            if (window.authManager?.user?.sub === author) {
                return fullname || username || userEmail?.split('@')[0] || 'Anonyme';
            }
            
            // Sinon, retourner juste un placeholder
            return 'Utilisateur';
        }
        
        return author;
    }
    
    // Format date for display
    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffHours < 1) {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            return `il y a ${diffMinutes} min`;
        } else if (diffHours < 24) {
            return `il y a ${diffHours}h`;
        } else {
            return date.toLocaleDateString('fr-FR');
        }
    }

    // Create method (alias for creating and selecting a new item)
    async create() {
        const newItem = this.createNewItem();
        
        // Add to database
        this.database.unshift(newItem);
        
        // Save to storage
        await this.saveItem(newItem);
        
        // Select the new item
        this.currentId = newItem.id;
        
        // Update UI
        this.updateList();
        this.selectItem(newItem.id);
        
        console.log(`Created new ${this.type}:`, newItem.title);
        
        return newItem;
    }
    
    // Create new item
    createNewItem() {
        const defaults = {
            news: {
                title: 'Nouveau titre',
                content: '',
                duration: '00:30',
                author: 'Reporter'
            },
            animation: {
                title: 'Nouvelle animation',
                content: '',
                duration: '00:30',
                author: 'Animateur'
            }
        };
        
        // Get author from auth manager
        const authorName = window.authManager?.getAuthorName() || 
                          window.app?.storage?.userId || 
                          localStorage.getItem('saint-esprit-user') || 
                          'Reporter';
        
        const newItem = {
            ...defaults[this.type],  // Appliquer les defaults EN PREMIER
            id: Date.now().toString(),
            author: authorName,       // PUIS écraser avec le nom correct
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        return newItem;
    }

    // Save item
    async saveItem(item) {
        if (!item) return;
        
        // Update database
        const index = this.database.findIndex(i => i.id === item.id);
        if (index >= 0) {
            this.database[index] = item;
        } else {
            this.database.push(item);
        }
        
        // Save to storage
        if (window.app && window.app.storage) {
            try {
                await window.app.storage.saveData(this.type, this.database);
            } catch (error) {
                console.error(`Error saving ${this.type}:`, error);
            }
        }
        
        this.emit('item-saved', item);
    }

    // Delete item
    async deleteItem(itemId) {
        const index = this.database.findIndex(i => i.id === itemId);
        if (index >= 0) {
            const item = this.database[index];
            this.database.splice(index, 1);
            
            // Save to storage
            if (window.app && window.app.storage) {
                try {
                    await window.app.storage.saveData(this.type, this.database);
                } catch (error) {
                    console.error(`Error deleting ${this.type}:`, error);
                }
            }
            
            this.emit('item-deleted', item);
        }
    }

    // Search functionality
    search(query) {
        if (!query) return this.database;
        
        const lowerQuery = query.toLowerCase();
        return this.database.filter(item => 
            item.title.toLowerCase().includes(lowerQuery) ||
            item.content.toLowerCase().includes(lowerQuery) ||
            item.author.toLowerCase().includes(lowerQuery)
        );
    }

    // Calculate duration
    calculateDuration() {
        console.log('⏱️ [ContentManager] calculateDuration appelé avec préfixe:', this.prefix);
        
        const contentEl = document.getElementById(`${this.prefix}content`);
        const wordCountEl = document.getElementById(`${this.prefix}word-count`);
        const readingTimeEl = document.getElementById(`${this.prefix}reading-time`);
        const soundsTimeEl = document.getElementById(`${this.prefix}sounds-time`);
        const calculatedDurationEl = document.getElementById(`${this.prefix}calculated-duration`);
        
        if (!contentEl) {
            console.log('❌ [ContentManager] Pas de textarea content trouvé:', `${this.prefix}content`);
            return '00:00';
        }
        
        // Calculer le nombre de mots
        const text = contentEl.value || '';
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        
        // Calculer le temps de lecture (200 mots/minute)
        const wordsPerMinute = 200;
        const readingSeconds = Math.ceil((wordCount / wordsPerMinute) * 60);
        
        // TODO: Calculer le temps des sons (pour l'instant 0)
        const soundsSeconds = 0;
        const totalSeconds = readingSeconds + soundsSeconds;
        
        // Formater les durées
        const formatDuration = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${String(secs).padStart(2, '0')}`;
        };
        
        console.log('⏱️ [ContentManager] Calculs:');
        console.log('  - Mots:', wordCount);
        console.log('  - Temps lecture:', formatDuration(readingSeconds));
        console.log('  - Total:', formatDuration(totalSeconds));
        
        // Mettre à jour l'affichage
        if (wordCountEl) {
            wordCountEl.textContent = wordCount;
        }
        if (readingTimeEl) {
            readingTimeEl.textContent = formatDuration(readingSeconds);
        }
        if (soundsTimeEl) {
            soundsTimeEl.textContent = formatDuration(soundsSeconds);
        }
        if (calculatedDurationEl) {
            calculatedDurationEl.textContent = formatDuration(totalSeconds);
        }
        
        return formatDuration(totalSeconds);
    }

    // Get time ago
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'quelques secondes';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} heure${hours > 1 ? 's' : ''}`;
        const days = Math.floor(hours / 24);
        return `${days} jour${days > 1 ? 's' : ''}`;
    }
}

// Export as global
window.ContentManager = ContentManager;
console.log('ContentManager loaded successfully');