// Template Manager - gère les templates de conducteur avec variables
class TemplateManager {
    constructor() {
        this.templates = {};
        this.listeners = new Map();
        this.storageKey = 'saintEsprit_templates';
        
        // Variables par défaut disponibles
        this.defaultVariables = {
            date: () => new Date().toLocaleDateString('fr-FR'),
            time: () => new Date().toLocaleTimeString('fr-FR'),
            day: () => new Date().toLocaleDateString('fr-FR', { weekday: 'long' }),
            month: () => new Date().toLocaleDateString('fr-FR', { month: 'long' }),
            year: () => new Date().getFullYear(),
            week: () => this.getWeekNumber(new Date())
        };
        
        this.loadTemplates();
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

    // Load templates from localStorage
    loadTemplates() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.templates = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            this.templates = {};
        }
    }

    // Save templates to localStorage
    saveTemplates() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.templates));
        } catch (error) {
            console.error('Error saving templates:', error);
        }
    }

    // Save current conductor as template
    async saveAsTemplate(name, dayOfWeek = null) {
        if (!window.app?.conductorManager) {
            showNotification('Conductor manager not available', 'error');
            return false;
        }

        const segments = window.app.conductorManager.getSegments();
        if (segments.length === 0) {
            showNotification('No segments to save as template', 'warning');
            return false;
        }

        // Process segments to extract template structure
        const templateSegments = await this.processSegmentsForTemplate(segments);

        const template = {
            name: name,
            dayOfWeek: dayOfWeek, // null for generic, or 0-6 for specific day
            segments: templateSegments,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            variables: this.extractVariables(templateSegments),
            metadata: {
                totalDuration: this.calculateTotalDuration(segments),
                segmentCount: segments.length,
                hasBlocks: segments.some(s => s.type === 'block')
            }
        };

        // Store template
        const key = dayOfWeek !== null ? `day_${dayOfWeek}` : `template_${Date.now()}`;
        this.templates[key] = template;
        this.saveTemplates();

        this.emit('template-saved', template);
        showNotification(`Template "${name}" saved${dayOfWeek !== null ? ` for ${this.getDayName(dayOfWeek)}` : ''}`, 'success');
        return true;
    }

    // Process segments to create template structure
    async processSegmentsForTemplate(segments) {
        const templateSegments = [];

        for (const segment of segments) {
            const templateSegment = {
                type: segment.type,
                title: this.templatizeText(segment.title),
                duration: segment.duration,
                locked: segment.locked || false,
                parentId: segment.parentId || null,
                isExpanded: segment.isExpanded !== false
            };

            // Handle specific segment types
            if (segment.type === 'block' && segment.blockId) {
                templateSegment.blockTemplate = {
                    title: this.templatizeText(segment.title),
                    color: segment.blockColor,
                    plannedDuration: segment.duration
                };
            } else if (segment.type === 'news' && segment.newsId) {
                const news = window.app.newsManager.getDatabase().find(n => n.id === segment.newsId);
                if (news && news.recurring) {
                    templateSegment.newsTemplate = {
                        title: this.templatizeText(news.title),
                        content: this.templatizeText(news.content),
                        author: this.templatizeText(news.author),
                        category: news.category,
                        duration: news.duration,
                        sounds: news.sounds || []
                    };
                } else {
                    // For non-recurring news, just store the reference
                    templateSegment.newsId = segment.newsId;
                }
            } else if (segment.type === 'animation' && segment.animationId) {
                const animation = window.app.animationManager.getDatabase().find(a => a.id === segment.animationId);
                if (animation && animation.recurring) {
                    templateSegment.animationTemplate = {
                        title: this.templatizeText(animation.title),
                        content: this.templatizeText(animation.content),
                        author: this.templatizeText(animation.author),
                        type: animation.type,
                        duration: animation.duration,
                        sounds: animation.sounds || []
                    };
                } else {
                    // For non-recurring animations, just store the reference
                    templateSegment.animationId = segment.animationId;
                }
            } else {
                // For other types (jingle, pub, etc.)
                templateSegment.content = segment.content ? this.templatizeText(segment.content) : '';
            }

            templateSegments.push(templateSegment);
        }

        return templateSegments;
    }

    // Convert text to template with variables
    templatizeText(text) {
        if (!text) return '';
        
        // Replace common patterns with variables
        text = text.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '{{date}}');
        text = text.replace(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi, '{{day}}');
        text = text.replace(/\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/gi, '{{month}}');
        text = text.replace(/\b20\d{2}\b/g, '{{year}}');
        
        return text;
    }

    // Extract all variables from template
    extractVariables(templateSegments) {
        const variables = new Set();
        const regex = /\{\{(\w+)\}\}/g;

        const extractFromText = (text) => {
            if (!text) return;
            let match;
            while ((match = regex.exec(text)) !== null) {
                variables.add(match[1]);
            }
        };

        const processSegment = (segment) => {
            extractFromText(segment.title);
            extractFromText(segment.content);
            
            if (segment.newsTemplate) {
                extractFromText(segment.newsTemplate.title);
                extractFromText(segment.newsTemplate.content);
                extractFromText(segment.newsTemplate.author);
            }
            if (segment.animationTemplate) {
                extractFromText(segment.animationTemplate.title);
                extractFromText(segment.animationTemplate.content);
                extractFromText(segment.animationTemplate.author);
            }
        };

        templateSegments.forEach(processSegment);
        return Array.from(variables);
    }

    // Replace variables in text
    replaceVariables(text, customValues = {}) {
        if (!text) return '';

        // Merge custom values with defaults
        const values = {
            ...this.defaultVariables,
            ...customValues
        };

        return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
            if (values[variable]) {
                // If it's a function, call it
                if (typeof values[variable] === 'function') {
                    return values[variable]();
                }
                return values[variable];
            }
            return match; // Keep original if no replacement found
        });
    }

    // Load template
    async loadTemplate(dayOfWeek = null, customValues = {}) {
        const key = dayOfWeek !== null ? `day_${dayOfWeek}` : this.getLatestTemplateKey();
        const template = this.templates[key];

        if (!template) {
            showNotification(`No template found for ${dayOfWeek !== null ? this.getDayName(dayOfWeek) : 'generic use'}`, 'warning');
            return false;
        }

        // Ask for variable values if needed
        const variableValues = await this.promptForVariables(template.variables, customValues);

        // Create segments from template
        const segments = await this.createSegmentsFromTemplate(template.segments, variableValues);

        // Load into conductor
        if (window.app?.conductorManager) {
            window.app.conductorManager.setSegments(segments);
            this.emit('template-loaded', template);
            showNotification(`Template "${template.name}" loaded`, 'success');
            return true;
        }

        return false;
    }

    // Create actual segments from template
    async createSegmentsFromTemplate(templateSegments, variableValues) {
        const segments = [];
        const blockIdMap = new Map(); // Map template parentIds to new IDs

        for (const templateSegment of templateSegments) {
            const segment = {
                id: Date.now() + Math.random(),
                type: templateSegment.type,
                title: this.replaceVariables(templateSegment.title, variableValues),
                duration: templateSegment.duration,
                locked: templateSegment.locked,
                isExpanded: templateSegment.isExpanded,
                actualDuration: templateSegment.duration
            };

            // Handle parent mapping for hierarchical structures
            if (templateSegment.parentId) {
                segment.parentId = blockIdMap.get(templateSegment.parentId) || null;
            }

            // Handle specific types
            if (templateSegment.type === 'block' && templateSegment.blockTemplate) {
                // Create or find block
                const blockData = {
                    title: this.replaceVariables(templateSegment.blockTemplate.title, variableValues),
                    color: templateSegment.blockTemplate.color,
                    plannedDuration: templateSegment.blockTemplate.plannedDuration
                };
                
                // You might want to create the block in BlockManager here
                segment.blockColor = blockData.color;
                blockIdMap.set(templateSegment.id, segment.id);
            } else if (templateSegment.newsTemplate) {
                // Create news from template
                const newsData = {
                    title: this.replaceVariables(templateSegment.newsTemplate.title, variableValues),
                    content: this.replaceVariables(templateSegment.newsTemplate.content, variableValues),
                    author: this.replaceVariables(templateSegment.newsTemplate.author, variableValues),
                    category: templateSegment.newsTemplate.category,
                    duration: templateSegment.newsTemplate.duration,
                    sounds: templateSegment.newsTemplate.sounds,
                    recurring: true,
                    templateId: `template_news_${Date.now()}`,
                    status: 'draft'
                };

                // Create news item
                if (window.app?.newsManager) {
                    const news = window.app.newsManager.createFromTemplate(newsData);
                    segment.newsId = news.id;
                    segment.content = news.content;
                    segment.author = news.author;
                }
            } else if (templateSegment.animationTemplate) {
                // Create animation from template
                const animationData = {
                    title: this.replaceVariables(templateSegment.animationTemplate.title, variableValues),
                    content: this.replaceVariables(templateSegment.animationTemplate.content, variableValues),
                    author: this.replaceVariables(templateSegment.animationTemplate.author, variableValues),
                    type: templateSegment.animationTemplate.type,
                    duration: templateSegment.animationTemplate.duration,
                    sounds: templateSegment.animationTemplate.sounds,
                    recurring: true,
                    templateId: `template_animation_${Date.now()}`,
                    status: 'draft'
                };

                // Create animation item
                if (window.app?.animationManager) {
                    const animation = window.app.animationManager.createFromTemplate(animationData);
                    segment.animationId = animation.id;
                    segment.content = animation.content;
                    segment.author = animation.author;
                }
            } else if (templateSegment.newsId || templateSegment.animationId) {
                // Direct reference - just copy
                if (templateSegment.newsId) segment.newsId = templateSegment.newsId;
                if (templateSegment.animationId) segment.animationId = templateSegment.animationId;
            } else {
                segment.content = this.replaceVariables(templateSegment.content || '', variableValues);
            }

            segments.push(segment);
        }

        return segments;
    }

    // Prompt user for variable values
    async promptForVariables(variables, customValues = {}) {
        const values = { ...customValues };

        if (variables && variables.length > 0) {
            const nonDefaultVariables = variables.filter(v => !this.defaultVariables[v]);
            
            if (nonDefaultVariables.length > 0) {
                // For now, use simple prompts. In future, could use a modal
                for (const variable of nonDefaultVariables) {
                    if (!values[variable]) {
                        const value = prompt(`Enter value for {{${variable}}}:`);
                        if (value !== null) {
                            values[variable] = value;
                        }
                    }
                }
            }
        }

        return values;
    }

    // Get templates for a specific day
    getTemplatesForDay(dayOfWeek) {
        const dayKey = `day_${dayOfWeek}`;
        return this.templates[dayKey] ? [this.templates[dayKey]] : [];
    }

    // Get all templates
    getAllTemplates() {
        return Object.entries(this.templates).map(([key, template]) => ({
            key,
            ...template
        }));
    }

    // Delete template
    deleteTemplate(key) {
        if (this.templates[key]) {
            const templateName = this.templates[key].name;
            delete this.templates[key];
            this.saveTemplates();
            this.emit('template-deleted', key);
            showNotification(`Template "${templateName}" deleted`, 'warning');
            return true;
        }
        return false;
    }

    // Helper methods
    getDayName(dayIndex) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayIndex];
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    calculateTotalDuration(segments) {
        let totalSeconds = 0;
        segments.forEach(segment => {
            const duration = Utils.parseDuration(segment.actualDuration || segment.duration || '0:00');
            totalSeconds += duration;
        });
        return formatDurationFromSeconds(totalSeconds);
    }

    getLatestTemplateKey() {
        const genericTemplates = Object.keys(this.templates)
            .filter(key => key.startsWith('template_'))
            .sort((a, b) => this.templates[b].createdAt.localeCompare(this.templates[a].createdAt));
        
        return genericTemplates[0] || null;
    }

    // Export template
    exportTemplate(key) {
        const template = this.templates[key];
        if (!template) return;

        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template_${template.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Import template
    async importTemplate(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const template = JSON.parse(event.target.result);
                    const key = template.dayOfWeek !== null ? 
                        `day_${template.dayOfWeek}` : 
                        `template_${Date.now()}`;
                    
                    this.templates[key] = template;
                    this.saveTemplates();
                    this.emit('template-imported', template);
                    showNotification(`Template "${template.name}" imported`, 'success');
                    resolve(template);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
}

// Export global
window.TemplateManager = TemplateManager;
