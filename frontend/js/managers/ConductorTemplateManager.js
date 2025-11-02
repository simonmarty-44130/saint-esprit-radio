/**
 * ConductorTemplateManager - Gestion intelligente des templates de conducteur
 * Permet de créer des structures réutilisables avec contenu dynamique
 */

class ConductorTemplateManager {
    constructor() {
        this.templates = [];
        this.currentTemplate = null;
        this.loadTemplates();
    }

    // Types de contenu pour les segments
    static CONTENT_TYPES = {
        DAILY: 'daily',                   // Contenu du jour (journal, météo du jour)
        RECURRING: 'recurring',           // Contenu récurrent (jingle, animation fixe)
        RECURRING_DUPLICATE: 'recurring-duplicate', // Duplique une fiche récurrente avec nouveau titre
        PERMANENT: 'permanent',           // Contenu permanent (générique, indicatif)
        DYNAMIC: 'dynamic',               // Contenu dynamique basé sur des règles
        BLOCK_CONTAINER: 'block-container' // Bloc vide à remplir (structure sans contenu)
    };

    // Sources de contenu
    static CONTENT_SOURCES = {
        NEWS: 'news',
        ANIMATION: 'animation',
        BLOCK: 'block',
        MANUAL: 'manual',
        AUTO: 'auto'  // Recherche automatique
    };

    loadTemplates() {
        const saved = localStorage.getItem('conductor-templates');
        if (saved) {
            try {
                this.templates = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load conductor templates:', e);
                this.templates = this.getDefaultTemplates();
            }
        } else {
            this.templates = this.getDefaultTemplates();
        }
    }

    saveTemplates() {
        localStorage.setItem('conductor-templates', JSON.stringify(this.templates));
    }

    getDefaultTemplates() {
        return [
            {
                id: 'morning-show',
                name: 'Journal du matin',
                description: 'Template standard pour le journal du matin',
                segments: [
                    {
                        type: 'segment',
                        title: 'Générique ouverture',
                        contentType: 'permanent',
                        contentSource: 'animation',
                        contentFilter: {
                            title: 'Générique Journal'
                        },
                        duration: '0:10',
                        position: 1
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Journal 7h',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Journal 7h',
                            emptyOnApply: true,  // Le bloc sera vide, prêt à recevoir les sujets du jour
                            color: '#FF6B6B'
                        },
                        duration: '3:00',
                        position: 2,
                        isRecurrent: true  // Indique que c'est un bloc récurrent
                    },
                    {
                        type: 'segment',
                        title: 'Météo',
                        contentType: 'recurring-duplicate',
                        contentSource: 'animation',
                        contentFilter: {
                            baseTitle: 'Météo',  // Cherche une fiche récurrente "Météo"
                            titlePattern: 'Météo du %DATE%',  // Nouveau titre généré
                            isRecurrent: true
                        },
                        duration: '1:00',
                        position: 3
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Flash Info',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Flash Info',
                            emptyOnApply: true,
                            color: '#FFA500'
                        },
                        duration: '0:30',
                        position: 4,
                        isRecurrent: true
                    },
                    {
                        type: 'segment',
                        title: 'Jingle de transition',
                        contentType: 'recurring',
                        contentSource: 'animation',
                        contentFilter: {
                            title: 'Jingle Info'
                        },
                        duration: '0:05',
                        position: 5
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Chroniques',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Chroniques',
                            emptyOnApply: true,
                            color: '#9C27B0'
                        },
                        duration: '2:00',
                        position: 6,
                        isRecurrent: true
                    },
                    {
                        type: 'segment',
                        title: 'Générique fermeture',
                        contentType: 'permanent',
                        contentSource: 'animation',
                        contentFilter: {
                            title: 'Générique Fin'
                        },
                        duration: '0:10',
                        position: 7
                    }
                ]
            },
            {
                id: 'multi-edition',
                name: 'Journée Multi-Éditions',
                description: 'Template pour une journée avec plusieurs éditions de journaux',
                segments: [
                    // ÉDITION 7H
                    {
                        type: 'segment',
                        title: 'Générique 7h',
                        contentType: 'permanent',
                        contentSource: 'animation',
                        contentFilter: { title: 'Générique 7h' },
                        duration: '0:10',
                        position: 1
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Journal 7h',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Journal 7h',
                            emptyOnApply: true,
                            color: '#FF6B6B',
                            description: 'Sélectionner 5-6 sujets principaux'
                        },
                        duration: '5:00',
                        position: 2,
                        isRecurrent: true
                    },
                    {
                        type: 'segment',
                        title: 'Météo 7h',
                        contentType: 'daily',
                        contentSource: 'news',
                        contentFilter: { category: 'meteo', titlePattern: 'Météo 7h %DATE%' },
                        duration: '1:00',
                        position: 3
                    },
                    // ÉDITION 8H
                    {
                        type: 'segment',
                        title: 'Jingle 8h',
                        contentType: 'recurring',
                        contentSource: 'animation',
                        contentFilter: { title: 'Jingle Flash 8h' },
                        duration: '0:05',
                        position: 4
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Flash 8h',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Flash 8h',
                            emptyOnApply: true,
                            color: '#FFA500',
                            description: 'Sélectionner 3 sujets courts'
                        },
                        duration: '2:00',
                        position: 5,
                        isRecurrent: true
                    },
                    // ÉDITION 12H
                    {
                        type: 'segment',
                        title: 'Générique Midi',
                        contentType: 'permanent',
                        contentSource: 'animation',
                        contentFilter: { title: 'Générique Journal Midi' },
                        duration: '0:10',
                        position: 6
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Journal 12h',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Journal 12h',
                            emptyOnApply: true,
                            color: '#2196F3',
                            description: 'Mise à jour avec nouveaux sujets + rappels importants'
                        },
                        duration: '7:00',
                        position: 7,
                        isRecurrent: true
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Sport Midi',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Sport',
                            emptyOnApply: true,
                            color: '#4CAF50',
                            description: 'Actualités sportives'
                        },
                        duration: '2:00',
                        position: 8,
                        isRecurrent: true
                    },
                    // ÉDITION 18H
                    {
                        type: 'segment',
                        title: 'Générique Soir',
                        contentType: 'permanent',
                        contentSource: 'animation',
                        contentFilter: { title: 'Générique Journal Soir' },
                        duration: '0:10',
                        position: 9
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Journal 18h',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Journal 18h',
                            emptyOnApply: true,
                            color: '#9C27B0',
                            description: 'Synthèse de la journée + développements'
                        },
                        duration: '8:00',
                        position: 10,
                        isRecurrent: true
                    },
                    {
                        type: 'segment',
                        title: 'Bloc Culture',
                        contentType: 'block-container',
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Culture',
                            emptyOnApply: true,
                            color: '#FF9800',
                            description: 'Agenda culturel et chroniques'
                        },
                        duration: '3:00',
                        position: 11,
                        isRecurrent: true
                    }
                ]
            },
            {
                id: 'template-demo',
                name: 'Démonstration Options Récurrentes',
                description: 'Montre les différentes façons de gérer les fiches récurrentes',
                segments: [
                    {
                        type: 'segment',
                        title: 'Jingle (réutilisé tel quel)',
                        contentType: 'recurring',  // Réutilise la même fiche sans modification
                        contentSource: 'animation',
                        contentFilter: {
                            title: 'Jingle Info'
                        },
                        duration: '0:05',
                        position: 1
                    },
                    {
                        type: 'segment',
                        title: 'Météo (dupliquée avec date)',
                        contentType: 'recurring-duplicate',  // Crée une nouvelle fiche avec la date
                        contentSource: 'animation',
                        contentFilter: {
                            baseTitle: 'Météo',
                            titlePattern: 'Météo du %DATE%'
                        },
                        duration: '1:00',
                        position: 2
                    },
                    {
                        type: 'segment',
                        title: 'Chronique (dupliquée)',
                        contentType: 'recurring-duplicate',  // Crée une nouvelle fiche
                        contentSource: 'news',
                        contentFilter: {
                            baseTitle: 'Chronique',
                            titlePattern: 'Chronique %DATE%'
                        },
                        duration: '2:00',
                        position: 3
                    },
                    {
                        type: 'segment',
                        title: 'Bloc vide pour sujets',
                        contentType: 'block-container',  // Bloc vide à remplir
                        contentSource: 'block',
                        contentFilter: {
                            blockName: 'Sujets du jour',
                            emptyOnApply: true,
                            color: '#FF5722'
                        },
                        duration: '5:00',
                        position: 4,
                        isRecurrent: true
                    },
                    {
                        type: 'segment',
                        title: 'Générique (permanent)',
                        contentType: 'permanent',  // Toujours le même, jamais modifié
                        contentSource: 'animation',
                        contentFilter: {
                            title: 'Générique Fin'
                        },
                        duration: '0:10',
                        position: 5
                    }
                ]
            }
        ];
    }

    /**
     * Applique un template pour créer un conducteur du jour
     */
    async applyTemplate(templateId, targetDate = new Date()) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        const conductor = {
            id: Date.now(),
            name: `${template.name} - ${this.formatDate(targetDate)}`,
            date: targetDate,
            templateId: templateId,
            segments: [],
            status: 'draft',
            completion: 0
        };

        // Process each segment in the template
        for (const templateSegment of template.segments) {
            const segment = await this.processTemplateSegment(templateSegment, targetDate);
            conductor.segments.push(segment);
        }

        // Calculate completion
        conductor.completion = this.calculateCompletion(conductor.segments);

        return conductor;
    }

    /**
     * Traite un segment de template pour créer un segment réel
     */
    async processTemplateSegment(templateSegment, targetDate) {
        const segment = {
            ...templateSegment,
            id: Date.now() + Math.random(),
            date: targetDate,
            content: null,
            status: 'pending',
            actualDuration: null
        };

        // Recherche du contenu selon le type
        switch (templateSegment.contentType) {
            case 'daily':
                segment.content = await this.findDailyContent(
                    templateSegment.contentSource,
                    templateSegment.contentFilter,
                    targetDate
                );
                break;
            
            case 'recurring':
                // Réutilise la même fiche sans modification
                segment.content = await this.findRecurringContent(
                    templateSegment.contentSource,
                    templateSegment.contentFilter
                );
                break;
                
            case 'recurring-duplicate':
                // Duplique une fiche récurrente avec un nouveau titre incluant la date
                segment.content = await this.duplicateRecurringContent(
                    templateSegment.contentSource,
                    templateSegment.contentFilter,
                    targetDate
                );
                break;
            
            case 'permanent':
                segment.content = await this.findRecurringContent(
                    templateSegment.contentSource,
                    templateSegment.contentFilter
                );
                break;
            
            case 'dynamic':
                segment.content = await this.findDynamicContent(
                    templateSegment.contentSource,
                    templateSegment.contentFilter,
                    targetDate
                );
                break;
                
            case 'block-container':
                // Créer un bloc vide avec la structure
                segment.content = await this.createEmptyBlock(
                    templateSegment.contentFilter
                );
                segment.isBlock = true;
                segment.isRecurrent = templateSegment.isRecurrent;
                break;
        }

        // Update status based on content availability
        if (segment.content) {
            segment.status = segment.contentType === 'block-container' ? 'empty-block' : 'ready';
            segment.actualDuration = segment.content.duration || segment.duration;
        } else {
            segment.status = 'missing';
        }

        return segment;
    }

    /**
     * Recherche le contenu quotidien (news/météo du jour)
     * Recherche intelligente : d'abord par titre exact, puis par date de création
     */
    async findDailyContent(source, filter, date) {
        const dateStr = this.formatDate(date);
        const dateFr = date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit'
        });
        
        // Get content from the appropriate source
        let items = [];
        if (source === 'news') {
            items = await this.getNewsItems();
        } else if (source === 'animation') {
            items = await this.getAnimationItems();
        }

        // D'abord chercher par titre avec la date
        if (filter.titlePattern) {
            const expectedTitle = filter.titlePattern
                .replace('%DATE%', dateFr)
                .replace('%DAY%', this.getDayName(date))
                .replace('%MONTH%', this.getMonthName(date));
            
            // Recherche exacte
            const exactMatch = items.find(item => item.title === expectedTitle);
            if (exactMatch) {
                console.log(`✅ Correspondance exacte trouvée : "${exactMatch.title}"`);
                return exactMatch;
            }
            
            // Recherche flexible (contient la date et les mots clés)
            const flexibleMatch = items.find(item => {
                const hasDate = item.title.includes(dateFr) || item.title.includes(dateStr);
                const hasKeywords = filter.keywords ? 
                    filter.keywords.every(kw => item.title.toLowerCase().includes(kw.toLowerCase())) :
                    true;
                return hasDate && hasKeywords;
            });
            
            if (flexibleMatch) {
                console.log(`✅ Correspondance flexible trouvée : "${flexibleMatch.title}"`);
                return flexibleMatch;
            }
        }

        // Sinon chercher par date de création et catégorie
        return items.find(item => {
            // Check date
            if (filter.date === 'today') {
                const itemDate = new Date(item.createdAt || item.date);
                if (this.formatDate(itemDate) !== dateStr) return false;
            }

            // Check category
            if (filter.category && item.category !== filter.category) {
                return false;
            }

            return true;
        });
    }

    /**
     * Recherche le contenu récurrent
     */
    async findRecurringContent(source, filter) {
        let items = [];
        if (source === 'animation') {
            items = await this.getAnimationItems();
        } else if (source === 'block') {
            items = await this.getBlockItems();
        }

        return items.find(item => {
            // Si l'item est marqué comme récurrent, on le trouve
            if (item.isRecurrent) {
                if (filter.baseTitle && item.title.includes(filter.baseTitle)) {
                    return true;
                }
            }
            if (filter.title && item.title === filter.title) {
                return true;
            }
            if (filter.id && item.id === filter.id) {
                return true;
            }
            return false;
        });
    }
    
    /**
     * Duplique une fiche récurrente avec un nouveau titre incluant la date
     * MAIS vérifie d'abord si une fiche avec ce titre existe déjà
     */
    async duplicateRecurringContent(source, filter, date) {
        // D'abord, générer le titre cible avec la date
        const targetTitle = this.generateTitleWithDate(
            filter.baseTitle || 'Item', 
            filter, 
            date
        );
        
        // Vérifier si une fiche avec ce titre exact existe déjà
        let items = [];
        if (source === 'animation') {
            items = await this.getAnimationItems();
        } else if (source === 'news') {
            items = await this.getNewsItems();
        }
        
        // Chercher une fiche avec le titre exact de la date cible
        const existingItem = items.find(item => {
            // Comparaison exacte du titre
            if (item.title === targetTitle) {
                return true;
            }
            // Comparaison flexible (au cas où il y a des variations mineures)
            const dateStr = date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit'
            });
            if (item.title.includes(dateStr) && item.title.includes(filter.baseTitle)) {
                return true;
            }
            return false;
        });
        
        // Si la fiche existe déjà, la retourner
        if (existingItem) {
            console.log(`✅ Fiche trouvée : "${existingItem.title}"`);
            return existingItem;
        }
        
        // Sinon, chercher la fiche récurrente de base pour la dupliquer
        const baseItem = await this.findRecurringContent(source, filter);
        
        if (!baseItem) {
            console.warn(`⚠️ Aucune fiche récurrente trouvée avec le titre de base : "${filter.baseTitle}"`);
            return null;
        }
        
        // Créer une copie avec le nouveau titre
        const newItem = {
            ...baseItem,
            id: `${baseItem.id}-${Date.now()}`, // Nouvel ID unique
            title: targetTitle,
            originalId: baseItem.id, // Référence à l'original
            createdAt: new Date().toISOString(),
            isDuplicate: true,
            duplicatedFrom: baseItem.title,
            isRecurrent: false  // La nouvelle fiche n'est pas récurrente elle-même
        };
        
        // Sauvegarder la nouvelle fiche
        if (source === 'animation' && window.app && window.app.animationManager) {
            window.app.animationManager.database.push(newItem);
            window.app.animationManager.saveDatabase();
            console.log(`📝 Nouvelle fiche animation créée : "${newItem.title}"`);
        } else if (source === 'news' && window.app && window.app.newsManager) {
            window.app.newsManager.database.push(newItem);
            window.app.newsManager.saveDatabase();
            console.log(`📝 Nouvelle fiche news créée : "${newItem.title}"`);
        }
        
        return newItem;
    }
    
    /**
     * Génère un titre avec la date
     */
    generateTitleWithDate(baseTitle, filter, date) {
        const dateStr = date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit'
        });
        
        // Si un pattern est défini, l'utiliser
        if (filter.titlePattern) {
            return filter.titlePattern
                .replace('%DATE%', dateStr)
                .replace('%ORIGINAL%', baseTitle);
        }
        
        // Sinon, remplacer la date existante ou ajouter la date
        const dateRegex = /\d{2}\/\d{2}/;
        if (dateRegex.test(baseTitle)) {
            // Remplacer la date existante
            return baseTitle.replace(dateRegex, dateStr);
        } else {
            // Ajouter la date
            return `${baseTitle} ${dateStr}`;
        }
    }

    /**
     * Recherche le contenu dynamique basé sur des règles
     */
    async findDynamicContent(source, filter, date) {
        // Implémentation pour contenu dynamique
        // Par exemple : sélection automatique basée sur le jour de la semaine
        const dayOfWeek = date.getDay();
        
        if (filter.dayRules && filter.dayRules[dayOfWeek]) {
            return await this.findRecurringContent(source, filter.dayRules[dayOfWeek]);
        }

        return null;
    }
    
    /**
     * Crée un bloc vide avec la structure définie
     */
    async createEmptyBlock(filter) {
        // Chercher si le bloc existe déjà dans le BlockManager
        const existingBlocks = await this.getBlockItems();
        let block = existingBlocks.find(b => b.name === filter.blockName);
        
        if (!block) {
            // Créer un nouveau bloc s'il n'existe pas
            block = {
                id: `block-${Date.now()}`,
                name: filter.blockName,
                color: filter.color || '#4CAF50',
                items: [],  // Vide par défaut
                duration: '0:00',
                createdAt: new Date().toISOString(),
                isRecurrent: true
            };
            
            // Sauvegarder le bloc dans le BlockManager
            if (window.app && window.app.blockManager) {
                window.app.blockManager.blocks.push(block);
                window.app.blockManager.saveBlocks();
            }
        } else if (filter.emptyOnApply) {
            // Créer une copie du bloc avec les items vides
            block = {
                ...block,
                id: `block-${Date.now()}`,  // Nouvel ID pour cette instance
                items: [],  // Vider les items
                duration: '0:00',
                appliedDate: new Date().toISOString()
            };
        }
        
        return block;
    }

    /**
     * Calcule le pourcentage de complétion d'un conducteur
     */
    calculateCompletion(segments) {
        if (!segments || segments.length === 0) return 0;
        
        const readyCount = segments.filter(s => s.status === 'ready').length;
        return Math.round((readyCount / segments.length) * 100);
    }

    /**
     * Obtient le statut de préparation pour une date donnée
     */
    async getDailyStatus(date = new Date()) {
        const status = {
            date: date,
            totalSegments: 0,
            readySegments: 0,
            missingSegments: [],
            completion: 0
        };

        // Check if there's a conductor for this date
        const conductor = await this.getConductorForDate(date);
        if (conductor) {
            status.totalSegments = conductor.segments.length;
            status.readySegments = conductor.segments.filter(s => s.status === 'ready').length;
            status.missingSegments = conductor.segments
                .filter(s => s.status === 'missing')
                .map(s => s.title);
            status.completion = this.calculateCompletion(conductor.segments);
        }

        return status;
    }

    /**
     * Crée un template à partir d'un conducteur existant
     */
    createTemplateFromConductor(conductor, templateName) {
        const template = {
            id: `template-${Date.now()}`,
            name: templateName,
            description: `Template créé à partir du conducteur ${conductor.name}`,
            segments: conductor.segments.map(segment => ({
                type: segment.type,
                title: segment.title,
                contentType: this.detectContentType(segment),
                contentSource: segment.source || 'manual',
                contentFilter: this.extractContentFilter(segment),
                duration: segment.duration,
                position: segment.position
            }))
        };

        this.templates.push(template);
        this.saveTemplates();
        
        return template;
    }

    /**
     * Détecte automatiquement le type de contenu d'un segment
     */
    detectContentType(segment) {
        const title = segment.title.toLowerCase();
        
        // Mots-clés pour identifier les contenus permanents
        if (title.includes('générique') || title.includes('indicatif')) {
            return 'permanent';
        }
        
        // Mots-clés pour identifier les contenus quotidiens
        if (title.includes('journal') || title.includes('météo') || 
            title.includes('aujourd') || title.includes('jour')) {
            return 'daily';
        }
        
        // Mots-clés pour identifier les contenus récurrents
        if (title.includes('jingle') || title.includes('transition')) {
            return 'recurring';
        }
        
        return 'manual';
    }

    /**
     * Extrait les filtres de contenu d'un segment
     */
    extractContentFilter(segment) {
        const filter = {};
        
        // Extract category from title
        if (segment.title.toLowerCase().includes('journal')) {
            filter.category = 'journal';
        } else if (segment.title.toLowerCase().includes('météo')) {
            filter.category = 'meteo';
        } else if (segment.title.toLowerCase().includes('flash')) {
            filter.category = 'flash';
        }
        
        // Extract title if it's specific
        if (segment.linkedId) {
            filter.id = segment.linkedId;
        } else if (segment.title) {
            filter.titlePattern = segment.title;
        }
        
        return filter;
    }

    // Helper methods
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    getDayName(date) {
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        return days[date.getDay()];
    }

    getMonthName(date) {
        const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        return months[date.getMonth()];
    }

    // Data access methods (à connecter avec les vrais managers)
    async getNewsItems() {
        // À connecter avec newsManager
        if (window.app && window.app.newsManager) {
            return window.app.newsManager.getAllItems();
        }
        return [];
    }

    async getAnimationItems() {
        // À connecter avec animationManager
        if (window.app && window.app.animationManager) {
            return window.app.animationManager.getAllItems();
        }
        return [];
    }

    async getBlockItems() {
        // À connecter avec blockManager
        if (window.app && window.app.blockManager) {
            return window.app.blockManager.blocks;
        }
        return [];
    }

    async getConductorForDate(date) {
        // À connecter avec conductorManager
        if (window.app && window.app.conductorManager) {
            const conductors = window.app.conductorManager.getSegments();
            return conductors.find(c => {
                const cDate = new Date(c.date);
                return this.formatDate(cDate) === this.formatDate(date);
            });
        }
        return null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConductorTemplateManager;
}