// Constants
const Constants = {
    // Version info
    VERSION: '2.1.1',
    VERSION_DATE: '2025-08-28',
    VERSION_NOTES: 'UI improvements, category updates, author display fix',
    
    // Format types mapping
    FORMAT_TYPES: {
        'block': { code: 'JOURNAL', color: '#00ccff', label: 'Journal' },
        'news': { code: 'N', color: '#ff0000', label: 'NEWS' },
        'animation': { code: 'ANIM', color: '#9333ea', label: 'ANIMATION' },
        'break': { code: 'BREAK', color: '#0080ff', label: 'BREAK' },
        'jingle': { code: 'JGL', color: '#ffff00', label: 'JINGLE' },
        'pub': { code: 'CM', color: '#ff9900', label: 'CM' },
        'ad_placeholder': { code: 'AD', color: '#808080', label: 'AD PLACEHOLDER', icon: '📺' },
        'meteo': { code: 'WX', color: '#00ff00', label: 'WEATHER' },
        'package': { code: 'PKG', color: '#00ff00', label: 'PKG' },
        'live': { code: 'LIVE', color: '#cc99ff', label: 'LIVE' },
        'custom': { code: 'SEG', color: '#ffffff', label: 'SEG' }
    },

    // Default durations
    DEFAULT_DURATIONS: {
        'block': '5:00',
        'news': '0:30',
        'animation': '1:00',
        'jingle': '0:10',
        'pub': '2:00',
        'ad_placeholder': '3:00',
        'meteo': '1:00',
        'package': '1:30',
        'live': '2:00',
        'break': '10:00',
        'custom': '0:30'
    },

    // Default titles
    DEFAULT_TITLES: {
        'block': 'Block',
        'jingle': 'Jingle',
        'pub': 'Commercial break',
        'ad_placeholder': 'Publicité - Open Radio',
        'meteo': 'Weather',
        'package': 'Package',
        'live': 'Live shot',
        'break': '↑ BREAK'
    },

    // Sound type icons
    SOUND_ICONS: {
        'microtrottoir': '🎤',
        'interview': '🎙️',
        'ambiance': '🌆',
        'musique': '🎵',
        'autre': '📻',
        'jingle': '🎵',
        'effet': '🎺',
        'transition': '🔄'
    },

    // Status icons
    STATUS_ICONS: {
        'approved': '✔️',
        'ready': '✅',
        'draft': '📝'
    },

    // Reading speeds
    READING_SPEEDS: {
        'news': 155,
        'animation': 150
    },

    // Templates
    TEMPLATES: {
        'news': [
            { type: 'break', title: '↑ NEWS', duration: '10:00' },
            { type: 'jingle', title: 'News open', duration: '0:10' },
            { type: 'block', title: 'HEADLINES', duration: '0:00', isExpanded: true },
            { type: 'news', title: 'Headline 1', duration: '0:10', parentId: 'HEADLINES' },
            { type: 'news', title: 'Headline 2', duration: '0:10', parentId: 'HEADLINES' },
            { type: 'news', title: 'Headline 3', duration: '0:10', parentId: 'HEADLINES' },
            { type: 'block', title: 'MAIN NEWS', duration: '0:00', isExpanded: true },
            { type: 'news', title: 'Top story', duration: '1:30', parentId: 'MAIN NEWS' },
            { type: 'package', title: 'PKG - Investigation', duration: '2:00', parentId: 'MAIN NEWS' },
            { type: 'live', title: 'LIVE - Reporter', duration: '1:30', parentId: 'MAIN NEWS' },
            { type: 'news', title: 'Local news', duration: '1:00', parentId: 'MAIN NEWS' },
            { type: 'pub', title: 'Commercial break 1', duration: '2:00' },
            { type: 'block', title: 'NATIONAL/INTERNATIONAL', duration: '0:00', isExpanded: true },
            { type: 'news', title: 'National news', duration: '1:30', parentId: 'NATIONAL/INTERNATIONAL' },
            { type: 'news', title: 'International', duration: '1:00', parentId: 'NATIONAL/INTERNATIONAL' },
            { type: 'block', title: 'SPORTS/WEATHER', duration: '0:00', isExpanded: true },
            { type: 'news', title: 'Sports', duration: '1:30', parentId: 'SPORTS/WEATHER' },
            { type: 'meteo', title: 'Weather', duration: '1:00', parentId: 'SPORTS/WEATHER' },
            { type: 'jingle', title: 'News close', duration: '0:10' }
        ],
        'morning': [
            { type: 'break', title: '↑ MORNING SHOW', duration: '20:00' },
            { type: 'jingle', title: 'Morning show open', duration: '0:15' },
            { type: 'animation', title: 'Welcome & intro', duration: '1:00' },
            { type: 'news', title: 'Morning headlines', duration: '2:00' },
            { type: 'meteo', title: 'Weather update', duration: '1:30' },
            { type: 'animation', title: 'Press review', duration: '3:00' },
            { type: 'jingle', title: 'Time check', duration: '0:05' },
            { type: 'pub', title: 'Commercials', duration: '2:30' },
            { type: 'animation', title: 'Guest interview', duration: '5:00' },
            { type: 'news', title: 'News update', duration: '1:30' },
            { type: 'animation', title: 'Daily feature', duration: '3:00' },
            { type: 'jingle', title: 'Close', duration: '0:10' }
        ],
        'hourly': [
            { type: 'jingle', title: 'Top of hour', duration: '0:03' },
            { type: 'animation', title: 'Station ID', duration: '0:10' },
            { type: 'news', title: 'News 1', duration: '0:45' },
            { type: 'news', title: 'News 2', duration: '0:45' },
            { type: 'news', title: 'News 3', duration: '0:30' },
            { type: 'meteo', title: 'Weather brief', duration: '0:15' },
            { type: 'jingle', title: 'Outro', duration: '0:02' }
        ]
    },

    // Default values
    DEFAULTS: {
        news: {
            title: 'New Story',
            category: 'general',
            duration: '0:30',
            author: 'Reporter'
        },
        animation: {
            title: 'Nouvelle animation',
            type: 'morning',
            duration: '1:00',
            author: 'Animateur'
        }
    },

    // Categories
    NEWS_CATEGORIES: [
        'Info générale',
        'Faits divers',
        'Économie',
        'Sport',
        'Religieux'
    ],

    ANIMATION_TYPES: [
        'morning',
        'transition',
        'music',
        'show',
        'interview',
        'outro'
    ],

    // Ad placeholder types
    AD_TYPES: [
        'commercial',
        'sponsoring',
        'promo'
    ],

    // Timers
    AUTO_SAVE_INTERVAL: 30000, // 30 seconds
    AUTO_BACKUP_INTERVAL: 300000, // 5 minutes
    DEBOUNCE_DELAY: 300, // 300ms
    CLOCK_UPDATE_INTERVAL: 1000, // 1 second

    // Virtual list
    VIRTUAL_LIST_BUFFER: 5,
    VIRTUAL_LIST_ITEM_HEIGHT: 70,

    // Show settings
    SHOW_START_TIME: { hours: 18, minutes: 0, seconds: 0 }, // 18:00:00
    SHOW_DURATION: 3600, // 60 minutes in seconds

    // Storage keys
    STORAGE_KEY: 'saintEsprit_data',
    BACKUP_KEY: 'saintEsprit_backup',
    TEMPLATES_KEY: 'saintEsprit_templates'
};

// Export as global
window.Constants = Constants;
window.formatTypes = Constants.FORMAT_TYPES;