/**
 * ExportManager - Gestionnaire d'export XML + fichiers
 * Génère les exports pour le diffuseur Action de Grâce
 */

class ExportManager {
    constructor() {
        this.exportFormat = 'action-de-grace';
        this.zipLibLoaded = false;
        this.loadZipLibrary();
    }

    /**
     * Charger la librairie JSZip dynamiquement
     */
    async loadZipLibrary() {
        if (window.JSZip) {
            this.zipLibLoaded = true;
            return;
        }

        try {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => {
                this.zipLibLoaded = true;
                console.log('JSZip chargé avec succès');
            };
            script.onerror = () => {
                console.error('Erreur chargement JSZip');
                this.zipLibLoaded = false;
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Erreur chargement JSZip:', error);
        }
    }

    /**
     * Générer XML pour diffuseur Action de Grâce
     */
    generateXML(timelineData) {
        const now = new Date();
        const formatDate = (date) => date.toISOString().replace('T', ' ').split('.')[0];
        
        // Calculer durée totale en secondes
        const totalSeconds = timelineData.items.reduce((acc, item) => acc + item.duration, 0);
        
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<timeline xmlns="http://radiofidelite.fr/actiondegrace/timeline/v1">
    <metadata>
        <name>${this.escapeXml(timelineData.name)}</name>
        <created>${formatDate(now)}</created>
        <version>1.0</version>
        <generator>Saint Esprit Template Builder</generator>
        <format>${this.exportFormat}</format>
    </metadata>
    
    <schedule>
        <start_time>${timelineData.startTime}</start_time>
        <end_time>${timelineData.endTime}</end_time>
        <total_duration>${totalSeconds}</total_duration>
        <duration_display>${timelineData.totalDurationDisplay || this.formatDuration(totalSeconds)}</duration_display>
        <items_count>${timelineData.items.length}</items_count>
    </schedule>
    
    <items>
${timelineData.items.map((item, index) => this.generateItemXML(item, index + 1)).join('\n')}
    </items>
    
    <files>
${timelineData.items
    .filter(item => item.audioFile)
    .map((item, index) => `        <file id="audio_${index + 1}" name="${this.escapeXml(item.audioFileName)}" />`)
    .join('\n')}
    </files>
</timeline>`;
        
        return xml;
    }

    /**
     * Générer XML pour un item
     */
    generateItemXML(item, sequence) {
        const attributes = [
            `sequence="${sequence}"`,
            `id="${item.id || 'item_' + sequence}"`,
            item.isVariable ? `has_variables="true"` : ''
        ].filter(Boolean).join(' ');
        
        return `        <item ${attributes}>
            <timecode>${item.timeCode}</timecode>
            <title><![CDATA[${item.title}]]></title>
            <type>${item.type}</type>
            <duration seconds="${item.duration}">${item.durationDisplay}</duration>
            ${item.audioFile ? `<audio_file>${this.escapeXml(item.audioFileName)}</audio_file>` : ''}
            ${item.type === 'live' && item.content ? `<content><![CDATA[${item.content}]]></content>` : ''}
            ${item.isVariable ? this.generateVariablesXML(item) : ''}
        </item>`;
    }

    /**
     * Générer XML pour les variables d'un item
     */
    generateVariablesXML(item) {
        if (!item.variables || item.variables.length === 0) return '';
        
        return `<variables>
${item.variables.map(v => `                <variable name="${v.name}" type="${v.type}" />`).join('\n')}
            </variables>`;
    }

    /**
     * Échapper caractères XML
     */
    escapeXml(text) {
        if (!text) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;'
        };
        
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Formater durée en secondes
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Créer ZIP avec XML + fichiers audio
     */
    async exportComplete(timelineData, options = {}) {
        if (!this.zipLibLoaded || !window.JSZip) {
            // Essayer de charger JSZip et réessayer
            await this.loadZipLibrary();
            
            if (!this.zipLibLoaded) {
                // Fallback: export XML seul
                this.exportXMLOnly(timelineData);
                return;
            }
        }

        try {
            const zip = new JSZip();
            
            // Ajouter XML principal
            const xml = this.generateXML(timelineData);
            zip.file('playlist.xml', xml);
            
            // Ajouter fichier README
            const readme = this.generateReadme(timelineData);
            zip.file('README.txt', readme);
            
            // Créer dossier audio et ajouter fichiers
            const audioFolder = zip.folder('audio');
            const audioFiles = timelineData.items.filter(item => item.audioFile);
            
            for (let i = 0; i < audioFiles.length; i++) {
                const item = audioFiles[i];
                if (item.audioFile instanceof File || item.audioFile instanceof Blob) {
                    // Utiliser le nom original ou générer un nom unique
                    const fileName = item.audioFileName || `audio_${i + 1}_${item.audioFile.name}`;
                    audioFolder.file(fileName, item.audioFile);
                }
            }
            
            // Ajouter manifest.json pour tracking
            const manifest = {
                version: '1.0',
                created: new Date().toISOString(),
                timeline: timelineData.name,
                files_count: audioFiles.length,
                total_duration: timelineData.totalDuration
            };
            zip.file('manifest.json', JSON.stringify(manifest, null, 2));
            
            // Générer et télécharger ZIP
            const blob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            }, (metadata) => {
                // Callback de progression
                if (options.onProgress) {
                    options.onProgress(metadata.percent);
                }
            });
            
            const fileName = this.generateFileName(timelineData);
            this.downloadBlob(blob, fileName);
            
            // Log success
            console.log('Export réussi:', {
                name: fileName,
                size: this.formatFileSize(blob.size),
                files: audioFiles.length + 3 // XML + README + manifest
            });
            
        } catch (error) {
            console.error('Erreur export ZIP:', error);
            alert('Erreur lors de l\'export. Tentative d\'export XML seul...');
            this.exportXMLOnly(timelineData);
        }
    }

    /**
     * Export XML seulement (fallback)
     */
    exportXMLOnly(timelineData) {
        const xml = this.generateXML(timelineData);
        const blob = new Blob([xml], { type: 'application/xml' });
        const fileName = `${timelineData.name}_${this.getDateString()}.xml`;
        
        this.downloadBlob(blob, fileName);
        
        alert('Export XML effectué. Les fichiers audio doivent être fournis séparément.');
    }

    /**
     * Générer README
     */
    generateReadme(timelineData) {
        const now = new Date();
        const audioCount = timelineData.items.filter(item => item.audioFile).length;
        
        return `PLAYLIST ACTION DE GRÂCE
========================

Nom: ${timelineData.name}
Date création: ${now.toLocaleString('fr-FR')}
Plage horaire: ${timelineData.startTime} - ${timelineData.endTime}
Durée totale: ${timelineData.totalDurationDisplay || 'N/A'}

CONTENU
-------
- Nombre d'éléments: ${timelineData.items.length}
- Fichiers audio: ${audioCount}
- Éléments live: ${timelineData.items.length - audioCount}

UTILISATION
-----------
1. Décompresser l'archive ZIP
2. Importer le fichier playlist.xml dans Action de Grâce
3. Les fichiers audio sont dans le dossier /audio
4. Vérifier la synchronisation des timecodes

STRUCTURE
---------
/playlist.xml     - Fichier principal de la playlist
/audio/          - Dossier contenant tous les fichiers audio
/manifest.json   - Métadonnées de l'export
/README.txt      - Ce fichier

NOTES
-----
- Format compatible Action de Grâce v3.0+
- Encodage UTF-8
- Timecodes au format HH:MM:SS

Généré par Saint Esprit Template Builder
© ${now.getFullYear()} Radio Fidélité`;
    }

    /**
     * Générer nom de fichier
     */
    generateFileName(timelineData) {
        const date = this.getDateString();
        const name = timelineData.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 50);
        
        return `playlist_${name}_${date}.zip`;
    }

    /**
     * Obtenir string date
     */
    getDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    /**
     * Formater taille fichier
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Télécharger blob
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        // Déclencher téléchargement
        document.body.appendChild(a);
        a.click();
        
        // Nettoyer
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Exporter templates (format JSON)
     */
    exportTemplates(templates) {
        const data = {
            version: '1.0',
            exported: new Date().toISOString(),
            templates: templates
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const filename = `saint_esprit_templates_${this.getDateString()}.json`;
        
        this.downloadBlob(blob, filename);
    }

    /**
     * Générer rapport d'export
     */
    generateExportReport(timelineData) {
        const report = {
            summary: {
                name: timelineData.name,
                date: new Date().toISOString(),
                duration: timelineData.totalDurationDisplay,
                items_count: timelineData.items.length
            },
            details: timelineData.items.map((item, index) => ({
                position: index + 1,
                timecode: item.timeCode,
                title: item.title,
                type: item.type,
                duration: item.durationDisplay,
                has_audio: !!item.audioFile,
                audio_file: item.audioFileName || null
            })),
            statistics: {
                total_audio_files: timelineData.items.filter(i => i.audioFile).length,
                total_live_items: timelineData.items.filter(i => i.type === 'live').length,
                total_duration_seconds: timelineData.totalDuration || 0
            }
        };
        
        return report;
    }

    /**
     * Vérifier compatibilité export
     */
    checkExportCompatibility(timelineData) {
        const issues = [];
        
        // Vérifier les noms de fichiers
        timelineData.items.forEach((item, index) => {
            if (item.audioFile && item.audioFileName) {
                // Caractères interdits dans les noms de fichiers
                if (/[<>:"/\\|?*]/.test(item.audioFileName)) {
                    issues.push(`Ligne ${index + 1}: Nom de fichier contient des caractères interdits`);
                }
                
                // Longueur du nom
                if (item.audioFileName.length > 255) {
                    issues.push(`Ligne ${index + 1}: Nom de fichier trop long`);
                }
            }
        });
        
        // Vérifier cohérence des timecodes
        let lastTime = 0;
        timelineData.items.forEach((item, index) => {
            const time = this.parseTimecode(item.timeCode);
            if (time < lastTime) {
                issues.push(`Ligne ${index + 1}: Timecode incohérent (${item.timeCode})`);
            }
            lastTime = time;
        });
        
        return {
            compatible: issues.length === 0,
            issues: issues
        };
    }

    /**
     * Parser timecode
     */
    parseTimecode(timecode) {
        const parts = timecode.split(':').map(Number);
        return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    }
}

// Export global
window.ExportManager = ExportManager;

// Initialiser globalement
if (!window.exportManager) {
    console.log('Creating ExportManager instance...');
    window.exportManager = new ExportManager();
}