/**
 * RecurrenceManager - Gestion des templates récurrents
 * Permet de sauvegarder et réutiliser des structures de timeline
 */

class RecurrenceManager {
    constructor() {
        this.templates = new Map();
        this.variables = new Map();
        this.storageKey = 'saint_esprit_recurrent_templates';
        
        // Charger templates depuis localStorage
        this.loadTemplatesFromStorage();
    }

    /**
     * Charger templates depuis localStorage
     */
    loadTemplatesFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const templates = JSON.parse(stored);
                templates.forEach(template => {
                    this.templates.set(template.id, template);
                });
            }
        } catch (error) {
            console.error('Erreur chargement templates:', error);
        }
    }

    /**
     * Sauvegarder templates dans localStorage
     */
    saveTemplatesToStorage() {
        try {
            const templates = Array.from(this.templates.values());
            localStorage.setItem(this.storageKey, JSON.stringify(templates));
        } catch (error) {
            console.error('Erreur sauvegarde templates:', error);
        }
    }

    /**
     * Sauvegarder timeline comme template récurrent
     */
    saveAsRecurrent(timelineData, templateName) {
        const template = {
            id: `recurrent_${Date.now()}`,
            name: templateName,
            isRecurrent: true,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0,
            startTime: timelineData.startTime,
            endTime: timelineData.endTime,
            totalDuration: timelineData.totalDuration,
            structure: timelineData.items.map(item => ({
                timeCode: item.timeCode,
                title: this.templatizeTitle(item.title),
                originalTitle: item.title,
                type: item.type,
                audioFileName: item.audioFileName,
                duration: item.duration,
                durationDisplay: item.durationDisplay,
                isVariable: this.detectVariables(item),
                variables: this.extractVariables(item)
            }))
        };
        
        this.templates.set(template.id, template);
        this.saveTemplatesToStorage();
        
        console.log('Template récurrent sauvegardé:', template);
        return template;
    }

    /**
     * Auto-détection des variables dans un item
     */
    detectVariables(item) {
        const patterns = {
            date: /\b(aujourd'hui|date|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i,
            weather: /\b(météo|temps|température|°C|ensoleillé|pluie|nuageux|orage)\b/i,
            news: /\b(flash|info|actualité|breaking|nouvelle)\b/i,
            music: /\b(musique|titre|chanson|artiste|album)\b/i,
            time: /\b(heure|horaire|top)\b/i,
            region: /\b(région|ville|département|local)\b/i
        };
        
        const text = `${item.title} ${item.content || ''}`;
        const detectedTypes = [];
        
        Object.entries(patterns).forEach(([type, pattern]) => {
            if (pattern.test(text)) {
                detectedTypes.push(type);
            }
        });
        
        return detectedTypes.length > 0;
    }

    /**
     * Extraire les variables d'un item
     */
    extractVariables(item) {
        const variables = [];
        const text = item.title;
        
        // Patterns spécifiques pour extraction
        const extractors = {
            date: {
                pattern: /\b(\d{1,2}\/\d{1,2}\/\d{4}|aujourd'hui|demain|hier)\b/gi,
                type: 'date',
                label: 'Date'
            },
            temperature: {
                pattern: /\b(\d{1,2}°C?)\b/gi,
                type: 'temperature',
                label: 'Température'
            },
            weather: {
                pattern: /\b(ensoleillé|pluie|nuageux|orage|brouillard|neige)\b/gi,
                type: 'weather',
                label: 'Météo'
            },
            region: {
                pattern: /\b(région|ville|département)\s+([\w\-]+)/gi,
                type: 'region',
                label: 'Région'
            }
        };
        
        // Détecter les patterns {{variable}}
        const customVarPattern = /{{(\w+)}}/g;
        let match;
        while ((match = customVarPattern.exec(text)) !== null) {
            variables.push({
                type: 'custom',
                name: match[1],
                label: match[1].charAt(0).toUpperCase() + match[1].slice(1),
                placeholder: match[0]
            });
        }
        
        // Détecter les patterns automatiques
        Object.entries(extractors).forEach(([key, extractor]) => {
            const matches = text.match(extractor.pattern);
            if (matches) {
                variables.push({
                    type: extractor.type,
                    name: extractor.type,
                    label: extractor.label,
                    placeholder: matches[0],
                    defaultValue: matches[0]
                });
            }
        });
        
        return variables;
    }

    /**
     * Conversion automatique titre → template
     */
    templatizeTitle(title) {
        let templatized = title;
        
        // Remplacer dates
        templatized = templatized.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '{{date}}');
        templatized = templatized.replace(/\b(aujourd'hui|demain|hier)\b/gi, '{{date}}');
        
        // Remplacer températures
        templatized = templatized.replace(/\d{1,2}°C?/g, '{{temperature}}');
        
        // Remplacer météo
        templatized = templatized.replace(/(ensoleillé|pluie|nuageux|orage|brouillard|neige)/gi, '{{weather}}');
        
        // Remplacer heures spécifiques (mais pas les timecodes)
        templatized = templatized.replace(/\b(\d{1,2}h\d{0,2})\b/g, (match) => {
            // Ne pas remplacer si c'est un timecode format HH:MM:SS
            if (title.indexOf(match) > 0 && title[title.indexOf(match) - 1] === ':') {
                return match;
            }
            return '{{time}}';
        });
        
        return templatized;
    }

    /**
     * Charger template pour personnalisation rapide
     */
    loadRecurrent(templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
            console.error('Template non trouvé:', templateId);
            return null;
        }
        
        // Mettre à jour stats d'usage
        template.lastUsed = new Date().toISOString();
        template.usageCount++;
        this.saveTemplatesToStorage();
        
        return {
            ...template,
            customizationForm: this.generateCustomizationForm(template)
        };
    }

    /**
     * Générer formulaire de personnalisation
     */
    generateCustomizationForm(template) {
        const variableItems = template.structure.filter(item => item.isVariable);
        const allVariables = new Map();
        
        // Collecter toutes les variables uniques
        variableItems.forEach(item => {
            item.variables.forEach(variable => {
                if (!allVariables.has(variable.name)) {
                    allVariables.set(variable.name, {
                        ...variable,
                        items: []
                    });
                }
                allVariables.get(variable.name).items.push(item);
            });
        });
        
        return {
            variables: Array.from(allVariables.values()),
            items: variableItems
        };
    }

    /**
     * Appliquer personnalisation à un template
     */
    applyCustomization(templateId, customValues) {
        const template = this.templates.get(templateId);
        if (!template) return null;
        
        // Créer une copie du template
        const customizedTimeline = {
            name: `${template.name}_${new Date().toISOString().split('T')[0]}`,
            startTime: template.startTime,
            endTime: template.endTime,
            totalDuration: template.totalDuration,
            isRecurrent: false,
            items: template.structure.map(item => {
                let customTitle = item.title;
                
                // Remplacer les variables
                Object.entries(customValues).forEach(([varName, varValue]) => {
                    const regex = new RegExp(`{{${varName}}}`, 'g');
                    customTitle = customTitle.replace(regex, varValue);
                });
                
                return {
                    ...item,
                    title: customTitle,
                    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
            })
        };
        
        return customizedTimeline;
    }

    /**
     * Obtenir tous les templates
     */
    getAllTemplates() {
        return Array.from(this.templates.values())
            .sort((a, b) => {
                // Trier par dernière utilisation puis par nom
                if (a.lastUsed && b.lastUsed) {
                    return new Date(b.lastUsed) - new Date(a.lastUsed);
                }
                if (a.lastUsed) return -1;
                if (b.lastUsed) return 1;
                return a.name.localeCompare(b.name);
            });
    }

    /**
     * Supprimer un template
     */
    deleteTemplate(templateId) {
        if (this.templates.delete(templateId)) {
            this.saveTemplatesToStorage();
            return true;
        }
        return false;
    }

    /**
     * Exporter templates
     */
    exportTemplates() {
        const templates = this.getAllTemplates();
        const dataStr = JSON.stringify(templates, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `saint_esprit_templates_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    /**
     * Importer templates
     */
    async importTemplates(file) {
        try {
            const text = await file.text();
            const templates = JSON.parse(text);
            
            templates.forEach(template => {
                // Générer nouvel ID pour éviter conflits
                template.id = `recurrent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.templates.set(template.id, template);
            });
            
            this.saveTemplatesToStorage();
            return templates.length;
        } catch (error) {
            console.error('Erreur import templates:', error);
            throw error;
        }
    }

    /**
     * Obtenir suggestions de variables pour autocomplétion
     */
    getVariableSuggestions() {
        return {
            date: ['{{date}}', '{{jour}}', '{{mois}}', '{{annee}}'],
            weather: ['{{weather}}', '{{temperature}}', '{{conditions}}'],
            news: ['{{titre_actu}}', '{{flash_info}}', '{{breaking_news}}'],
            time: ['{{heure}}', '{{periode}}'],
            region: ['{{region}}', '{{ville}}', '{{departement}}'],
            custom: ['{{animateur}}', '{{invité}}', '{{theme}}', '{{emission}}']
        };
    }
}

// Export global
window.RecurrenceManager = RecurrenceManager;

// Initialiser globalement
if (!window.recurrenceManager) {
    console.log('Creating RecurrenceManager instance...');
    window.recurrenceManager = new RecurrenceManager();
}