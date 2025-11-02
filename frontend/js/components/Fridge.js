// Fridge Component - gère les contenus planifiés
class Fridge {
    constructor() {
        this.initialized = false;
        this.newsManager = null;
        this.animationManager = null;
        this.blockManager = null;
        this.conductorManager = null;
        this.currentFilter = 'all';
        this.currentAuthorFilter = '';
        this.currentWeekStart = null;
    }

    init(dependencies) {
        this.newsManager = dependencies.newsManager;
        this.animationManager = dependencies.animationManager;
        this.blockManager = dependencies.blockManager;
        this.conductorManager = dependencies.conductorManager;
        this.initialized = true;
        
        // Initialiser la semaine courante
        this.currentWeekStart = this.getStartOfWeek(new Date());
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Écouter les changements dans les managers
        if (this.newsManager) {
            this.newsManager.on('database-changed', () => {
                if (this.isActive()) this.render();
            });
        }
        
        if (this.animationManager) {
            this.animationManager.on('database-changed', () => {
                if (this.isActive()) this.render();
            });
        }
        
        if (this.blockManager) {
            this.blockManager.on('blocks-changed', () => {
                if (this.isActive()) this.render();
            });
        }
    }

    onTabChange(tabName) {
        if (tabName === 'fridge') {
            this.render();
        }
    }

    isActive() {
        const fridgeSection = safeGetElement('fridge-section');
        return fridgeSection && fridgeSection.classList.contains('active');
    }

    filterByPeriod(period) {
        this.currentFilter = period;
        
        // Mettre à jour les boutons de filtre
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === period);
        });
        
        this.renderItems();
    }

    render() {
        this.renderWeekView();
        this.updateAuthorFilter();
        this.renderItems();
    }

    renderWeekView() {
        const container = safeGetElement('fridge-week-view');
        if (!container) return;

        const weekDays = [];
        const start = new Date(this.currentWeekStart);
        start.setHours(0, 0, 0, 0);
        
        // Générer les 7 jours de la semaine
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            day.setHours(0, 0, 0, 0);
            weekDays.push(day);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let html = '<div class="week-header">';
        html += '<button class="week-nav" onclick="app.fridgeComponent.previousWeek()">◀</button>';
        html += `<span class="week-title">${this.formatWeekTitle(this.currentWeekStart)}</span>`;
        html += '<button class="week-nav" onclick="app.fridgeComponent.nextWeek()">▶</button>';
        html += '</div>';

        html += '<div class="week-days">';
        weekDays.forEach(day => {
            const isToday = day.getTime() === today.getTime();
            const dayItems = this.getItemsForDate(day);
            const hasItems = dayItems.length > 0;
            
            // Formater la date au format YYYY-MM-DD en utilisant les composants locaux
            const year = day.getFullYear();
            const month = String(day.getMonth() + 1).padStart(2, '0');
            const dayNum = String(day.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${dayNum}`;
            
            html += `
                <div class="week-day ${isToday ? 'today' : ''} ${hasItems ? 'has-items' : ''}" 
                     onclick="app.fridgeComponent.selectDay('${dateStr}')">
                    <div class="day-name">${this.getDayName(day)}</div>
                    <div class="day-number">${day.getDate()}</div>
                    ${hasItems ? `<div class="items-count">${dayItems.length}</div>` : ''}
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    renderItems() {
        const container = safeGetElement('fridge-items-container');
        if (!container) return;

        let allItems = this.getAllScheduledItems();
        
        // Appliquer le filtre
        allItems = this.applyFilter(allItems);
        
        if (allItems.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #999; padding: 3rem;">
                    <h3>Aucun contenu planifié</h3>
                    <p>Les contenus avec une date de diffusion programmée apparaîtront ici</p>
                </div>
            `;
            return;
        }

        // Grouper par date
        const groupedItems = this.groupItemsByDate(allItems);
        
        let html = '';
        Object.keys(groupedItems).sort().forEach(dateStr => {
            const date = new Date(dateStr);
            const items = groupedItems[dateStr];
            
            html += `
                <div class="fridge-date-group">
                    <div class="date-header">
                        <h3>${this.formatDateHeader(date)}</h3>
                        <span class="items-count">${items.length} élément${items.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="fridge-items-list">
                        ${items.map(item => this.renderFridgeItem(item)).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    getAllScheduledItems() {
        const items = [];
        
        // Récupérer les news avec scheduledDate
        if (this.newsManager) {
            const news = this.newsManager.getDatabase()
                .filter(item => item.scheduledDate)
                .map(item => ({ ...item, type: 'news' }));
            items.push(...news);
        }
        
        // Récupérer les animations avec scheduledDate
        if (this.animationManager) {
            const animations = this.animationManager.getDatabase()
                .filter(item => item.scheduledDate)
                .map(item => ({ ...item, type: 'animation' }));
            items.push(...animations);
        }
        
        // Récupérer les journaux (blocks) avec scheduledDate
        if (this.blockManager) {
            const blocks = this.blockManager.getBlocks()
                .filter(item => item.scheduledDate)
                .map(item => ({ ...item, type: 'block' }));
            items.push(...blocks);
        }
        
        return items;
    }

    applyFilter(items) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // Filtrer par période
        let filteredItems = items;
        switch (this.currentFilter) {
            case 'today':
                filteredItems = items.filter(item => {
                    const itemDate = new Date(item.scheduledDate);
                    return itemDate.toDateString() === today.toDateString();
                });
                break;
            
            case 'tomorrow':
                filteredItems = items.filter(item => {
                    const itemDate = new Date(item.scheduledDate);
                    return itemDate.toDateString() === tomorrow.toDateString();
                });
                break;
            
            case 'week':
                filteredItems = items.filter(item => {
                    const itemDate = new Date(item.scheduledDate);
                    return itemDate >= today && itemDate < weekEnd;
                });
                break;
        }
        
        // Filtrer par auteur si nécessaire
        if (this.currentAuthorFilter) {
            filteredItems = filteredItems.filter(item => {
                return item.author && item.author === this.currentAuthorFilter;
            });
        }
        
        return filteredItems;
    }

    groupItemsByDate(items) {
        const grouped = {};
        
        items.forEach(item => {
            const dateStr = item.scheduledDate;
            if (!grouped[dateStr]) {
                grouped[dateStr] = [];
            }
            grouped[dateStr].push(item);
        });
        
        return grouped;
    }

    renderFridgeItem(item) {
        // Déterminer l'icône selon le type
        let typeIcon = '📰';
        if (item.type === 'animation') typeIcon = '🎙️';
        if (item.type === 'block') typeIcon = '📰';
        
        const statusIcon = Constants.STATUS_ICONS[item.status] || '📝';
        
        // Indicateurs de tags
        const tagIndicators = [];
        if (item.urgent) tagIndicators.push('🚨');
        if (item.recurring) tagIndicators.push('🔄');
        if (item.ready) tagIndicators.push('✅');
        
        // Vérifier si l'item est déjà dans le conducteur
        const inRundown = this.isItemInRundown(item);
        
        // Déterminer le contenu à afficher
        let contentPreview = '';
        let metaInfo = '';
        
        if (item.type === 'block') {
            // Pour les journaux
            contentPreview = item.description || 'Aucun sommaire';
            const itemCount = item.items ? item.items.length : 0;
            metaInfo = `
                <span style="background: ${item.color}; padding: 2px 6px; border-radius: 3px;">Journal</span>
                <span>•</span>
                <span>${item.plannedDuration || '0:00'}</span>
                <span>•</span>
                <span>${itemCount} élément${itemCount !== 1 ? 's' : ''}</span>
                ${item.author ? `<span>• <strong>${sanitizeHTML(item.author)}</strong></span>` : ''}
                ${item.hitTime ? `<span>• ${item.hitTime}</span>` : ''}
            `;
        } else {
            // Pour news et animations
            contentPreview = item.content || '';
            metaInfo = `
                <span>${item.type === 'news' ? item.category : item.type}</span>
                <span>•</span>
                <span>${item.duration || '0:00'}</span>
                <span>•</span>
                <span>${sanitizeHTML(item.author || '')}</span>
            `;
        }
        
        return `
            <div class="fridge-item ${item.urgent ? 'urgent' : ''} ${inRundown ? 'in-rundown' : ''} ${item.type === 'block' ? 'fridge-block' : ''}" 
                 draggable="true"
                 ondragstart="app.fridgeComponent.handleDragStart(event, '${item.type}', ${item.id})"
                 onclick="app.fridgeComponent.editItem('${item.type}', ${item.id})">
                <div class="fridge-item-header">
                    <div class="item-type-icon">${typeIcon}</div>
                    <div class="item-info">
                        <h4 class="item-title">${sanitizeHTML(item.title)} ${tagIndicators.join(' ')}</h4>
                        <div class="item-meta">
                            ${metaInfo}
                            ${inRundown ? '<span style="color: #00B4D8; margin-left: 0.5rem;">• Dans le conducteur</span>' : ''}
                        </div>
                    </div>
                    <div class="item-actions">
                        ${item.type !== 'block' ? `<span class="status-icon" title="${item.status}">${statusIcon}</span>` : ''}
                        <button class="fridge-action-btn" onclick="event.stopPropagation(); app.fridgeComponent.addToRundown('${item.type}', ${item.id})" 
                                title="Ajouter au conducteur" ${inRundown ? 'disabled' : ''}>
                            ➕
                        </button>
                    </div>
                </div>
                <div class="item-preview">
                    ${sanitizeHTML(contentPreview.substring(0, 120)) + (contentPreview.length > 120 ? '...' : '')}
                </div>
            </div>
        `;
    }

    getItemsForDate(date) {
        // Formater la date au format YYYY-MM-DD en tenant compte du fuseau horaire local
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        return this.getAllScheduledItems().filter(item => item.scheduledDate === dateStr);
    }

    isItemInRundown(item) {
        if (!this.conductorManager) return false;
        
        const segments = this.conductorManager.getSegments();
        
        if (item.type === 'block') {
            return segments.some(segment => segment.blockId === item.id);
        } else {
            const idField = item.type === 'news' ? 'newsId' : 'animationId';
            return segments.some(segment => segment[idField] === item.id);
        }
    }

    // Navigation
    previousWeek() {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
        this.renderWeekView();
    }

    nextWeek() {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
        this.renderWeekView();
    }

    selectDay(dateStr) {
        // Créer la date en utilisant les composants pour éviter les problèmes de timezone
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day); // month - 1 car les mois sont 0-indexés
        date.setHours(0, 0, 0, 0);
        
        const dayItems = this.getItemsForDate(date);
        
        if (dayItems.length > 0) {
            // Faire défiler vers les items de ce jour
            const dateGroup = document.querySelector(`[data-date="${dateStr}"]`);
            if (dateGroup) {
                dateGroup.scrollIntoView({ behavior: 'smooth' });
            }
        }
        
        showNotification(`${dayItems.length} élément${dayItems.length > 1 ? 's' : ''} pour le ${this.formatDateHeader(date)}`, 'info');
    }

    // Actions sur les items
    editItem(type, itemId) {
        if (type === 'news' && this.newsManager) {
            window.app.switchTab('news');
            this.newsManager.load(itemId);
        } else if (type === 'animation' && this.animationManager) {
            window.app.switchTab('animation');
            this.animationManager.load(itemId);
        } else if (type === 'block' && this.blockManager) {
            window.app.switchTab('blocks');
            this.blockManager.load(itemId);
        }
    }

    async addToRundown(type, itemId) {
        if (!this.conductorManager) return;
        
        let item = null;
        let segment = null;
        
        if (type === 'news' && this.newsManager) {
            item = this.newsManager.getDatabase().find(n => n.id === itemId);
            if (item) {
                const calculatedDuration = this.newsManager.calculateItemDuration(item);
                segment = {
                    type: 'news',
                    newsId: item.id,
                    title: item.title,
                    duration: item.duration,
                    actualDuration: calculatedDuration,
                    content: item.content,
                    author: item.author
                };
            }
        } else if (type === 'animation' && this.animationManager) {
            item = this.animationManager.getDatabase().find(a => a.id === itemId);
            if (item) {
                const calculatedDuration = this.animationManager.calculateItemDuration(item);
                segment = {
                    type: 'animation',
                    animationId: item.id,
                    title: item.title,
                    duration: item.duration,
                    actualDuration: calculatedDuration,
                    content: item.content,
                    author: item.author
                };
            }
        } else if (type === 'block' && this.blockManager) {
            item = this.blockManager.getBlocks().find(b => b.id === itemId);
            if (item) {
                segment = this.blockManager.exportToConductor(item.id);
            }
        }
        
        if (segment) {
            this.conductorManager.addSegment(segment);
            
            // Marquer l'item comme utilisé récemment
            if (item) {
                item.lastUsed = new Date().toISOString();
                if (window.app) {
                    await window.app.save();
                }
            }
            
            this.renderItems(); // Rafraîchir pour mettre à jour l'état "dans le conducteur"
            showNotification(`"${item.title}" ajouté au conducteur`, 'success');
        }
    }

    // Drag & Drop
    handleDragStart(event, type, itemId) {
        event.dataTransfer.setData('application/json', JSON.stringify({
            source: 'fridge',
            type: type,
            id: itemId
        }));
        event.dataTransfer.effectAllowed = 'copy';
        
        // Style visuel pendant le drag
        event.target.style.opacity = '0.5';
    }

    // Utilitaires de date
    getStartOfWeek(date) {
        const start = new Date(date);
        // Réinitialiser l'heure à minuit dans le fuseau horaire local
        start.setHours(0, 0, 0, 0);
        
        const day = start.getDay();
        // Calculer le nombre de jours à soustraire pour atteindre le lundi
        // Si dimanche (0), on recule de 6 jours, sinon on recule de (jour - 1) jours
        const daysToMonday = day === 0 ? 6 : day - 1;
        
        // Créer une nouvelle date pour éviter les problèmes de mutation
        const monday = new Date(start);
        monday.setDate(start.getDate() - daysToMonday);
        monday.setHours(0, 0, 0, 0);
        
        return monday;
    }

    getDayName(date) {
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        return days[date.getDay()];
    }

    formatWeekTitle(weekStart) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        const startMonth = weekStart.toLocaleDateString('fr-FR', { month: 'short' });
        const endMonth = weekEnd.toLocaleDateString('fr-FR', { month: 'short' });
        
        if (weekStart.getMonth() === weekEnd.getMonth()) {
            return `${weekStart.getDate()}-${weekEnd.getDate()} ${startMonth} ${weekStart.getFullYear()}`;
        } else {
            return `${weekStart.getDate()} ${startMonth} - ${weekEnd.getDate()} ${endMonth} ${weekStart.getFullYear()}`;
        }
    }

    formatDateHeader(date) {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        
        if (date.toDateString() === today.toDateString()) {
            return "Aujourd'hui";
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return "Demain";
        } else {
            return date.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }

    // Méthodes pour le filtre par auteur
    updateAuthorFilter() {
        const select = safeGetElement('fridge-author-filter');
        if (!select) return;
        
        // Collecter tous les auteurs uniques
        const authors = new Set();
        const allItems = this.getAllScheduledItems();
        
        allItems.forEach(item => {
            if (item.author && item.author.trim()) {
                authors.add(item.author);
            }
        });
        
        // Reconstruire les options
        const currentValue = select.value;
        select.innerHTML = '<option value="">Tous les auteurs</option>';
        
        Array.from(authors).sort().forEach(author => {
            const option = document.createElement('option');
            option.value = author;
            option.textContent = author;
            if (author === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
    
    filterByAuthor(author) {
        this.currentAuthorFilter = author;
        this.renderItems();
    }
    
    cleanup() {
        // Nettoyage si nécessaire
    }
}

// Export global
window.Fridge = Fridge;