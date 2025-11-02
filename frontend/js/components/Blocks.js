// Blocks Component
class Blocks {
    constructor() {
        this.initialized = false;
        this.blockManager = null;
        this.newsManager = null;
        this.animationManager = null;
    }

    init(dependencies) {
        this.blockManager = dependencies.blockManager;
        this.newsManager = dependencies.newsManager;
        this.animationManager = dependencies.animationManager;
        this.initialized = true;
        
        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen to block manager events
        if (this.blockManager) {
            this.blockManager.on('block-loaded', (block) => {
                this.updateBlockEditor(block);
            });
            
            this.blockManager.on('block-items-changed', (block) => {
                if (block.id === this.blockManager.currentBlockId) {
                    this.blockManager.calculateBlockDuration();
                }
            });
        }
    }

    onTabChange(tabName) {
        if (tabName === 'blocks') {
            // Refresh block list
            if (this.blockManager) {
                this.blockManager.render();
            }
        }
    }

    updateBlockEditor(block) {
        // Update color picker
        const colorPicker = safeGetElement('block-color');
        if (colorPicker) {
            colorPicker.value = block.color || '#00ccff';
        }
        
        // Update duration displays
        if (this.blockManager) {
            this.blockManager.calculateBlockDuration();
        }
    }

    cleanup() {
        // Cleanup resources if needed
    }
}

// Export global
window.Blocks = Blocks;