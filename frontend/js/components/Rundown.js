class Rundown {
    constructor() {
        this.initialized = false;
    }

    init(dependencies) {
        this.conductorManager = dependencies.conductorManager;
        this.newsManager = dependencies.newsManager;
        this.animationManager = dependencies.animationManager;
        this.initialized = true;
    }

    onTabChange(tabName) {
        if (tabName === 'conductor') {
            this.refresh();
        }
    }

    refresh() {
        if (this.conductorManager) {
            this.conductorManager.render();
        }
    }

    cleanup() {
        // Cleanup resources
    }
}

window.Rundown = Rundown;