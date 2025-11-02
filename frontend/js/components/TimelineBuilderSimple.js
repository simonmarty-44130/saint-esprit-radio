/**
 * TimelineBuilder - Version simple pour test
 */

console.log('🔍 DÉBUT CHARGEMENT TimelineBuilder SIMPLE');

class TimelineBuilderSimple {
    constructor() {
        console.log('TimelineBuilderSimple constructor called');
        this.startTime = null;
        this.endTime = null;
        this.items = [];
    }

    render() {
        console.log('TimelineBuilderSimple render called');
        const container = document.getElementById('timeline-builder-container');
        if (!container) {
            console.error('timeline-builder-container not found!');
            return;
        }
        
        container.innerHTML = `
            <div style="padding: 20px; background: #333; color: white; border-radius: 8px;">
                <h2>🎵 Template Builder - Version Simple</h2>
                <p>✅ TimelineBuilder chargé avec succès!</p>
                <div style="margin: 20px 0;">
                    <label>De: <input type="time" value="06:00"></label>
                    <label>À: <input type="time" value="07:00"></label>
                    <button onclick="alert('Test OK!')">Test</button>
                </div>
            </div>
        `;
    }
}

console.log('🔍 CLASSE TimelineBuilderSimple DÉFINIE');

// Export global
window.TimelineBuilderSimple = TimelineBuilderSimple;
window.TimelineBuilder = TimelineBuilderSimple; // Alias pour compatibilité
console.log('🔍 TimelineBuilderSimple EXPORTÉ');

// Auto-créer instance
window.timelineBuilder = new TimelineBuilderSimple();
console.log('🔍 Instance timelineBuilder créée');

console.log('🔍 FIN CHARGEMENT TimelineBuilder SIMPLE');
