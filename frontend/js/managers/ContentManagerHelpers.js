// Helper functions pour compatibilité AWS
if (typeof formatDurationFromSeconds === "undefined") {
    window.formatDurationFromSeconds = function(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };
}

if (typeof safeGetElement === "undefined") {
    window.safeGetElement = function(id) {
        return document.getElementById(id);
    };
}

if (typeof safeSetValue === "undefined") {
    window.safeSetValue = function(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value;
    };
}

if (typeof safeGetValue === "undefined") {
    window.safeGetValue = function(id) {
        const element = document.getElementById(id);
        return element ? element.value : "";
    };
}

if (typeof sanitizeHTML === "undefined") {
    window.sanitizeHTML = function(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    };
}

if (typeof validateDuration === "undefined") {
    window.validateDuration = function(duration) {
        if (!duration) return "0:00";
        const parts = duration.split(":");
        const minutes = parseInt(parts[0]) || 0;
        const seconds = parseInt(parts[1]) || 0;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };
}

if (typeof showNotification === "undefined") {
    window.showNotification = function(message, type) {
        console.log(`[${type}] ${message}`);
    };
}

// Constants fallback
if (typeof Constants === "undefined") {
    window.Constants = {
        DEBOUNCE_DELAY: 500,
        AUTO_SAVE_INTERVAL: 10000,
        READING_SPEEDS: {
            news: 180,
            animation: 150
        },
        STATUS_ICONS: {
            draft: "📝",
            ready: "✅",
            published: "📤"
        },
        SOUND_ICONS: {
            jingle: "🎵",
            music: "🎶",
            voice: "🎤",
            autre: "🔊"
        },
        DEFAULTS: {
            news: {
                title: "Nouvelle news",
                author: "Journaliste",
                category: "Actualité",
                duration: "1:00"
            },
            animation: {
                title: "Nouvelle animation",
                author: "Animateur",
                type: "Chronique",
                duration: "2:00"
            }
        },
        VIRTUAL_LIST_ITEM_HEIGHT: 80,
        VIRTUAL_LIST_BUFFER: 5
    };
}

// Utils fallback
if (typeof Utils === "undefined") {
    window.Utils = {
        debounce: function(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        },
        throttle: function(func, delay) {
            let lastCall = 0;
            return function(...args) {
                const now = Date.now();
                if (now - lastCall < delay) return;
                lastCall = now;
                return func.apply(this, args);
            };
        }
    };
}


