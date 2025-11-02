/**
 * Content Manager Optimisé pour News et Animations
 * Version haute performance avec virtual scrolling et pagination DynamoDB
 */

class ContentManagerOptimized {
    constructor(type) {
        this.type = type; // 'news' ou 'animation'
        this.currentId = null;
        this.prefix = type === 'animation' ? 'animation-' : 'news-';
        this.listeners = new Map();
        
        // Client DynamoDB optimisé
        this.dbClient = null;
        
        // Pagination
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.lastKey = null;
        this.hasMore = true;
        
        // Cache local pour performance
        this.localCache = new Map();
        this.displayedItems = [];
        
        // Virtual scrolling
        this.virtualScroller = null;
        
        // Debouncing pour optimisation
        this.debouncedSave = Utils.debounce(() => this.save(), 500);
        this.debouncedSearch = Utils.debounce((query) => this.search(query), 300);
        
        // Filtres actuels
        this.filters = {
            status: 'active',
            category: null,
            userId: null,
            search: ''
        };
        
        // Métriques de performance
        this.metrics = {
            loadTime: 0,
            saveTime: 0,
            renderTime: 0
        };
        
        this.init();
    }
    
    /**
     * Initialisation asynchrone
     */
    async init() {
        try {
            console.log(`🚀 Initializing Optimized ContentManager for ${this.type}`);
            
            // Initialiser le client DynamoDB optimisé
            this.dbClient = new DynamoDBOptimized();
            await this.dbClient.init();
            
            // Initialiser le virtual scrolling
            this.initVirtualScrolling();
            
            // Charger la première page
            await this.loadPage(1);
            
            // Écouter les événements d'authentification
            this.setupAuthListeners();
            
            console.log(`✅ ContentManager ${this.type} initialized`);
        } catch (error) {
            console.error('❌ Failed to initialize ContentManager:', error);
        }
    }
    
    /**
     * Initialiser le virtual scrolling
     */
    initVirtualScrolling() {
        const listContainer = document.getElementById(`${this.prefix}list`);
        if (!listContainer) return;
        
        this.virtualScroller = new VirtualScroller(listContainer, {
            itemHeight: 60,
            buffer: 5,
            onScroll: (startIndex, endIndex) => {
                this.renderVisibleItems(startIndex, endIndex);
            },
            onScrollEnd: () => {
                // Charger plus si nécessaire
                if (this.shouldLoadMore()) {
                    this.loadNextPage();
                }
            }
        });
    }
    
    /**
     * Charger une page de données
     */
    async loadPage(pageNumber = 1) {
        const startTime = performance.now();
        
        try {
            // Reset si première page
            if (pageNumber === 1) {
                this.lastKey = null;
                this.displayedItems = [];
                this.localCache.clear();
            }
            
            // Construire les options de requête
            const queryOptions = {
                limit: this.pageSize,
                lastKey: this.lastKey,
                status: this.filters.status,
                userId: this.filters.userId,
                useCache: true
            };
            
            // Récupérer les données paginées (ajouter 's' pour correspondre aux noms de tables)
            const tableName = this.type === 'animation' ? 'animations' : 'news';
            const result = await this.dbClient.getPaginated(tableName, queryOptions) || { Items: [], LastEvaluatedKey: null, hasMore: false };
            
            // Mettre à jour l'état
            this.lastKey = result.LastEvaluatedKey;
            this.hasMore = result.hasMore;
            this.currentPage = pageNumber;
            
            // Ajouter au cache local
            if (result.Items && result.Items.length > 0) {
                result.Items.forEach(item => {
                    this.localCache.set(item.id, item);
                    this.displayedItems.push(item);
                });
            }
            
            // Mettre à jour le total
            this.totalItems = this.displayedItems.length;
            if (this.hasMore) {
                this.totalItems = '+ de ' + this.totalItems;
            }
            
            // Render avec virtual scrolling
            this.virtualScroller?.setItems(this.displayedItems);
            
            // Métriques
            this.metrics.loadTime = performance.now() - startTime;
            console.log(`📊 Page ${pageNumber} loaded in ${this.metrics.loadTime.toFixed(2)}ms`);
            
            // Notifier les listeners
            this.emit('page-loaded', {
                page: pageNumber,
                items: result.Items,
                hasMore: this.hasMore
            });
            
        } catch (error) {
            console.error('❌ Error loading page:', error);
            this.emit('error', error);
        }
    }
    
    /**
     * Charger la page suivante
     */
    async loadNextPage() {
        if (!this.hasMore) return;
        await this.loadPage(this.currentPage + 1);
    }
    
    /**
     * Recherche optimisée avec debouncing
     */
    async search(query) {
        this.filters.search = query;
        
        if (!query) {
            // Reset à la vue par défaut
            await this.loadPage(1);
            return;
        }
        
        // Recherche locale d'abord (instantané)
        const localResults = this.searchLocal(query);
        if (localResults.length > 0) {
            this.displayedItems = localResults;
            this.virtualScroller?.setItems(this.displayedItems);
        }
        
        // Puis recherche serveur pour plus de résultats
        // (implementation selon vos besoins)
    }
    
    /**
     * Recherche dans le cache local
     */
    searchLocal(query) {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.localCache.values()).filter(item => {
            const searchableText = `${item.title} ${item.content} ${item.author}`.toLowerCase();
            return searchableText.includes(lowerQuery);
        });
    }
    
    /**
     * Créer un nouvel item optimisé
     */
    async create(templateItem = null) {
        const startTime = performance.now();
        
        try {
            // Attendre l'auth si nécessaire
            await this.waitForAuth();
            
            // Créer le nouvel item
            const newItem = {
                id: this.generateId(),
                title: templateItem?.title || 'Nouveau ' + this.type,
                content: templateItem?.content || '',
                author: window.authManager?.getCurrentUserFullName() || 'Reporter',
                status: 'draft',
                createdAt: Date.now(),
                duration: 0,
                category: templateItem?.category || 'general',
                ...templateItem
            };
            
            // Sauvegarder immédiatement en DB
            const tableName = this.type === 'animation' ? 'animations' : 'news';
            const savedItem = await this.dbClient.upsert(tableName, newItem);
            
            // Ajouter au cache local
            this.localCache.set(savedItem.id, savedItem);
            
            // Ajouter en début de liste (plus récent)
            this.displayedItems.unshift(savedItem);
            this.virtualScroller?.setItems(this.displayedItems);
            
            // Sélectionner le nouvel item
            this.currentId = savedItem.id;
            this.populateForm(savedItem);
            
            // Métriques
            this.metrics.saveTime = performance.now() - startTime;
            console.log(`✅ Created in ${this.metrics.saveTime.toFixed(2)}ms`);
            
            // Notifier
            this.emit('item-created', savedItem);
            showNotification('Créé avec succès!', 'success');
            
            return savedItem;
            
        } catch (error) {
            console.error('❌ Error creating item:', error);
            showNotification('Erreur lors de la création', 'error');
            throw error;
        }
    }
    
    /**
     * Sauvegarder avec optimisations
     */
    async save() {
        if (!this.currentId) return;
        
        const startTime = performance.now();
        const item = this.localCache.get(this.currentId);
        if (!item) return;
        
        try {
            // Collecter les données du formulaire
            const formData = this.collectFormData();
            Object.assign(item, formData);
            
            // Sauvegarder en DB avec retry automatique
            const tableName = this.type === 'animation' ? 'animations' : 'news';
            const savedItem = await this.dbClient.upsert(tableName, item);
            
            // Mettre à jour le cache
            this.localCache.set(savedItem.id, savedItem);
            
            // Mettre à jour l'affichage (sans re-render complet)
            this.updateItemDisplay(savedItem);
            
            // Métriques
            this.metrics.saveTime = performance.now() - startTime;
            console.log(`💾 Saved in ${this.metrics.saveTime.toFixed(2)}ms`);
            
            // Notifier
            this.emit('item-saved', savedItem);
            showNotification('Sauvegardé!', 'success');
            
        } catch (error) {
            console.error('❌ Error saving:', error);
            showNotification('Erreur lors de la sauvegarde', 'error');
        }
    }
    
    /**
     * Suppression optimisée
     */
    async delete() {
        if (!this.currentId) return;
        if (!confirm(`Supprimer ce ${this.type}?`)) return;
        
        const item = this.localCache.get(this.currentId);
        if (!item) return;
        
        try {
            // Supprimer de la DB
            const tableName = this.type === 'animation' ? 'animations' : 'news';
            await this.dbClient.delete(tableName, item.id, item.createdAt);
            
            // Retirer du cache local
            this.localCache.delete(item.id);
            
            // Retirer de la liste affichée
            const index = this.displayedItems.findIndex(i => i.id === item.id);
            if (index > -1) {
                this.displayedItems.splice(index, 1);
                this.virtualScroller?.setItems(this.displayedItems);
            }
            
            // Reset l'éditeur
            this.currentId = null;
            this.clearEditor();
            
            // Notifier
            this.emit('item-deleted', item);
            showNotification('Supprimé', 'warning');
            
        } catch (error) {
            console.error('❌ Error deleting:', error);
            showNotification('Erreur lors de la suppression', 'error');
        }
    }
    
    /**
     * Render optimisé avec virtual scrolling
     */
    renderVisibleItems(startIndex, endIndex) {
        const startTime = performance.now();
        
        const visibleItems = this.displayedItems.slice(startIndex, endIndex + 1);
        const container = document.getElementById(`${this.prefix}list-content`);
        if (!container) return;
        
        // Clear et render uniquement les items visibles
        container.innerHTML = '';
        
        visibleItems.forEach((item, index) => {
            const element = this.createItemElement(item);
            element.style.position = 'absolute';
            element.style.top = `${(startIndex + index) * 60}px`;
            container.appendChild(element);
        });
        
        // Métriques
        this.metrics.renderTime = performance.now() - startTime;
        if (this.metrics.renderTime > 16) {
            console.warn(`⚠️ Render took ${this.metrics.renderTime.toFixed(2)}ms (> 16ms frame budget)`);
        }
    }
    
    /**
     * Créer l'élément DOM pour un item
     */
    createItemElement(item) {
        const div = document.createElement('div');
        div.className = `${this.prefix}item list-item`;
        div.dataset.id = item.id;
        div.id = `${this.prefix}item-${item.id}`;
        
        // Ajouter les classes selon l'état
        if (item.id === this.currentId) {
            div.classList.add('selected');
        }
        if (item.urgent) {
            div.classList.add('urgent');
        }
        if (item.ready) {
            div.classList.add('ready');
        }
        
        // Utiliser un template compatible avec le style existant
        div.innerHTML = `
            <div class="item-content">
                <div class="item-header">
                    <span class="item-title">${this.escapeHtml(item.title || 'Sans titre')}</span>
                    <span class="item-badges">
                        ${item.urgent ? '<span class="badge badge-urgent">Urgent</span>' : ''}
                        ${item.ready ? '<span class="badge badge-ready">Prêt</span>' : ''}
                        ${item.recurring ? '<span class="badge badge-recurring">Récurrent</span>' : ''}
                    </span>
                </div>
                <div class="item-meta">
                    <span class="item-author">${this.escapeHtml(item.author || 'Anonyme')}</span>
                    <span class="item-duration">${item.duration || 0}s</span>
                    <span class="item-status status-${item.status || 'draft'}">${item.status || 'draft'}</span>
                </div>
            </div>
        `;
        
        // Event listener pour sélection
        div.addEventListener('click', () => {
            // Retirer la classe selected des autres items
            document.querySelectorAll(`#${this.prefix}list .selected`).forEach(el => {
                el.classList.remove('selected');
            });
            // Ajouter selected à cet item
            div.classList.add('selected');
            // Sélectionner l'item
            this.selectItem(item.id);
        });
        
        return div;
    }
    
    /**
     * Mettre à jour l'affichage d'un item sans re-render complet
     */
    updateItemDisplay(item) {
        const element = document.querySelector(`[data-id="${item.id}"]`);
        if (!element) return;
        
        // Mise à jour ciblée du DOM
        element.querySelector('.item-title').textContent = item.title;
        element.querySelector('.item-duration').textContent = `${item.duration || 0}s`;
        element.querySelector('.item-status').textContent = item.status;
        element.querySelector('.item-status').className = `item-status status-${item.status}`;
    }
    
    /**
     * Helpers
     */
    generateId() {
        return `${this.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    shouldLoadMore() {
        const container = document.getElementById(`${this.prefix}list`);
        if (!container) return false;
        
        const scrollPercentage = (container.scrollTop + container.clientHeight) / container.scrollHeight;
        return scrollPercentage > 0.8 && this.hasMore;
    }
    
    async waitForAuth() {
        let attempts = 0;
        while (!window.authManager?.isAuthenticated() && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }
    
    collectFormData() {
        return {
            title: safeGetValue(`${this.prefix}title`),
            content: safeGetValue(`${this.prefix}content`),
            duration: parseInt(safeGetValue(`${this.prefix}duration`) || 0),
            author: safeGetValue(`${this.prefix}author`),
            status: safeGetValue(`${this.prefix}status`) || 'draft',
            category: this.type === 'news' ? safeGetValue('category') : null,
            type: this.type === 'animation' ? safeGetValue('animation-type') : null,
            notes: safeGetValue(`${this.prefix}notes`),
            urgent: safeGetElement(`${this.prefix}tag-urgent`)?.checked || false,
            ready: safeGetElement(`${this.prefix}tag-ready`)?.checked || false,
            recurring: safeGetElement(`${this.prefix}tag-recurring`)?.checked || false
        };
    }
    
    populateForm(item) {
        safeSetValue(`${this.prefix}title`, item.title);
        safeSetValue(`${this.prefix}content`, item.content);
        safeSetValue(`${this.prefix}duration`, item.duration);
        safeSetValue(`${this.prefix}author`, item.author);
        safeSetValue(`${this.prefix}status`, item.status);
        safeSetValue(`${this.prefix}notes`, item.notes || '');
        
        if (this.type === 'news') {
            safeSetValue('category', item.category);
        } else {
            safeSetValue('animation-type', item.type);
        }
        
        const urgentEl = safeGetElement(`${this.prefix}tag-urgent`);
        if (urgentEl) urgentEl.checked = item.urgent === true;
        
        const readyEl = safeGetElement(`${this.prefix}tag-ready`);
        if (readyEl) readyEl.checked = item.ready === true;
        
        const recurringEl = safeGetElement(`${this.prefix}tag-recurring`);
        if (recurringEl) recurringEl.checked = item.recurring === true;
    }
    
    clearEditor() {
        const fields = ['title', 'content', 'duration', 'author', 'status', 'notes'];
        fields.forEach(field => safeSetValue(`${this.prefix}${field}`, ''));
    }
    
    selectItem(id) {
        this.currentId = id;
        const item = this.localCache.get(id);
        if (item) {
            this.populateForm(item);
            this.emit('item-selected', item);
        }
    }
    
    setupAuthListeners() {
        window.addEventListener('auth-ready', () => {
            if (this.currentId) {
                const item = this.localCache.get(this.currentId);
                if (item && item.author === 'Reporter') {
                    item.author = window.authManager?.getCurrentUserFullName() || 'Reporter';
                    this.populateForm(item);
                }
            }
        });
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
    
    // Méthode de compatibilité pour app.js
    refreshList() {
        // Re-render la liste visible
        if (this.virtualScroller && this.displayedItems.length > 0) {
            this.virtualScroller.render();
        }
        // Ou recharger la première page si pas d'items
        else if (this.displayedItems.length === 0) {
            this.loadPage(1);
        }
    }
    
    // Méthode render pour compatibilité avec app.js
    render() {
        // Si on a un virtual scroller, l'utiliser
        if (this.virtualScroller && this.displayedItems.length > 0) {
            this.virtualScroller.render();
            return;
        }
        
        // Sinon, render basique pour compatibilité
        const listContainer = document.getElementById(`${this.prefix}list`);
        if (!listContainer) return;
        
        // Clear et render tous les items (fallback sans virtual scrolling)
        listContainer.innerHTML = '';
        
        if (this.displayedItems.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">Aucun élément à afficher</div>';
            return;
        }
        
        // Créer les éléments DOM
        this.displayedItems.forEach(item => {
            const element = this.createItemElement(item);
            listContainer.appendChild(element);
        });
    }
    
    // Alias pour compatibilité
    setDatabase(database) {
        // Convertir le format de données si nécessaire
        if (Array.isArray(database)) {
            this.displayedItems = database;
            this.localCache.clear();
            database.forEach(item => {
                this.localCache.set(item.id, item);
            });
            if (this.virtualScroller) {
                this.virtualScroller.setItems(this.displayedItems);
            }
        }
    }
    
    getDatabase() {
        return this.displayedItems;
    }
    
    // Méthodes publiques pour obtenir les métriques
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.localCache.size,
            displayedItems: this.displayedItems.length,
            dbMetrics: this.dbClient?.getMetrics()
        };
    }
}

/**
 * Virtual Scroller pour performance optimale
 */
class VirtualScroller {
    constructor(container, options = {}) {
        this.container = container;
        this.itemHeight = options.itemHeight || 60;
        this.buffer = options.buffer || 5;
        this.onScroll = options.onScroll || (() => {});
        this.onScrollEnd = options.onScrollEnd || (() => {});
        
        this.items = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        
        this.scrollEndTimer = null;
        
        this.init();
    }
    
    init() {
        // Créer le conteneur virtuel
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.viewport.style.height = '100%';
        this.viewport.style.overflow = 'auto';
        
        this.content = document.createElement('div');
        this.content.id = this.container.id + '-content';
        this.content.style.position = 'relative';
        
        this.spacer = document.createElement('div');
        this.spacer.style.position = 'absolute';
        this.spacer.style.top = '0';
        this.spacer.style.left = '0';
        this.spacer.style.width = '1px';
        
        this.viewport.appendChild(this.content);
        this.viewport.appendChild(this.spacer);
        
        // Remplacer le contenu du container
        this.container.innerHTML = '';
        this.container.appendChild(this.viewport);
        
        // Event listeners
        this.viewport.addEventListener('scroll', this.handleScroll.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
        
        this.updateDimensions();
    }
    
    setItems(items) {
        this.items = items;
        this.totalHeight = items.length * this.itemHeight;
        this.spacer.style.height = this.totalHeight + 'px';
        this.render();
    }
    
    handleScroll() {
        this.scrollTop = this.viewport.scrollTop;
        this.render();
        
        // Detect scroll end
        clearTimeout(this.scrollEndTimer);
        this.scrollEndTimer = setTimeout(() => {
            this.onScrollEnd();
        }, 150);
    }
    
    handleResize() {
        this.updateDimensions();
        this.render();
    }
    
    updateDimensions() {
        this.containerHeight = this.viewport.clientHeight;
    }
    
    render() {
        if (!this.items || this.items.length === 0) return;
        
        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.buffer
        );
        
        this.onScroll(startIndex, endIndex);
    }
}

// Exporter globalement
window.ContentManagerOptimized = ContentManagerOptimized;
window.VirtualScroller = VirtualScroller;