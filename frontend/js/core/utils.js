// Show notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#ff3333' : type === 'warning' ? '#ffaa00' : type === 'success' ? '#00B4D8' : '#00b4d8'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-family: sans-serif;
        font-size: 14px;
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add animation styles if not already present
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// Utility functions
const Utils = {
    // Safe DOM element access
    safeGetElement(id) {
        try {
            return document.getElementById(id);
        } catch (e) {
            console.error(`Failed to get element ${id}:`, e);
            return null;
        }
    },

    safeSetValue(elementId, value) {
        const element = this.safeGetElement(elementId);
        if (element) {
            element.value = value || '';
            return true;
        }
        return false;
    },

    safeGetValue(elementId, defaultValue = '') {
        const element = this.safeGetElement(elementId);
        return element ? element.value : defaultValue;
    },

    // Duration validation and formatting
    validateDuration(duration) {
        if (!duration || duration === '') return '0:00';
        
        // Try to match different formats: M:SS, MM:SS, MMM:SS
        const match = duration.match(/^(\d{1,3}):(\d{1,2})$/);
        if (!match) {
            // If not in correct format, try to parse as number of minutes
            const minutes = parseInt(duration);
            if (!isNaN(minutes) && minutes >= 0 && minutes <= 999) {
                return `${minutes}:00`;
            }
            return duration || '0:00'; // Keep original if can't parse
        }
        
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        
        if (minutes < 0 || minutes > 999) return duration || '0:00';
        if (seconds < 0 || seconds > 59) {
            // If seconds > 59, convert to minutes
            const totalSeconds = minutes * 60 + seconds;
            const newMinutes = Math.floor(totalSeconds / 60);
            const newSeconds = totalSeconds % 60;
            return `${newMinutes}:${newSeconds.toString().padStart(2, '0')}`;
        }
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },

    formatDurationFromSeconds(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.round(totalSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },

    parseDuration(duration) {
        const parts = duration.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
    },

    formatTime(date) {
        return date.toTimeString().substring(0, 8);
    },

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    },

    // HTML sanitization
    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Generate unique ID
    generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    },

    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background-color: ${type === 'success' ? '#00ff00' : type === 'warning' ? '#ffff00' : type === 'error' ? '#ff0000' : '#0080ff'};
            color: ${type === 'warning' ? '#000' : '#fff'};
            border-radius: 4px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 1000;
            font-weight: 600;
            font-size: 0.875rem;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// Export as global
window.Utils = Utils;

// Create global shortcuts
window.safeGetElement = Utils.safeGetElement.bind(Utils);
window.safeSetValue = Utils.safeSetValue.bind(Utils);
window.safeGetValue = Utils.safeGetValue.bind(Utils);
window.validateDuration = Utils.validateDuration.bind(Utils);
window.formatDurationFromSeconds = Utils.formatDurationFromSeconds.bind(Utils);
window.sanitizeHTML = Utils.sanitizeHTML.bind(Utils);
window.showNotification = Utils.showNotification.bind(Utils);