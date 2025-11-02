// Multitrack Editor Component - Éditeur multipistes pour montage de reportages
class MultitrackEditor {
    constructor() {
        this.initialized = false;
        this.audioContext = null;
        this.masterGainNode = null;
        
        // Tracks configuration
        this.tracks = [];
        this.maxTracks = 4;
        this.activeTrack = 0;
        
        // Canvas elements
        this.canvas = null;
        this.ctx = null;
        this.timelineCanvas = null;
        this.timelineCtx = null;
        
        // Playback state
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 60; // Default 60 seconds
        this.playStartTime = null;
        this.playingSources = [];
        
        // Zoom and scroll
        this.zoomLevel = 1;
        this.scrollX = 0;
        this.pixelsPerSecond = 100;
        
        // Selection
        this.selection = { clip: null, track: -1 };
        this.selectedClip = null;
        
        // In/Out points
        this.inPoint = null;
        this.outPoint = null;
        
        // Chutier (bin) for audio clips
        this.audioLibrary = [];
        this.selectedLibraryItem = null;
        
        // Drag and drop
        this.isDragging = false;
        this.draggedClip = null;
        this.dragOffset = { x: 0, y: 0 };
        this.dragType = null; // 'move' or 'resize'
        
        // Grid snap
        this.snapToGrid = true;
        this.gridInterval = 0.1; // 100ms grid
        
        // Navigation
        this.stepSize = 0.1; // seconds for arrow key navigation
        this.fastStepSize = 1.0; // seconds for shift+arrow navigation
        
        // Edit modes
        this.editMode = 'normal'; // 'normal' or 'razor'
        
        // Fade handles feature - load from saved preference
        const savedFadeHandles = localStorage.getItem('multitrack-fade-handles');
        this.fadeHandlesEnabled = savedFadeHandles === 'true' ? true : false;
        
        // News integration
        this.linkedNewsId = null;
        this.targetDuration = null; // Duration from the linked news
        this.newsText = ''; // Text content from the news
        
        // VU Meter
        this.analyser = null;
        this.vuMeterAnimation = null;
        this.vuMeterPeakLeft = 0;
        this.vuMeterPeakRight = 0;
        this.vuMeterPeakHoldLeft = 0;
        this.vuMeterPeakHoldRight = 0;
        this.vuMeterPeakHoldCounter = 0;
        
        // Recording
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordingChunks = [];
        this.recordingStartTime = 0;
        this.recordingTrack = -1;
        
        // Volume envelope (per clip)
        this.editingEnvelope = false;
        this.selectedVolumePoint = null;
    }

    async init() {
        if (this.initialized) {
            console.log('Multitrack already initialized, skipping init');
            return;
        }
        
        console.log('Initializing multitrack editor...');
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create master gain
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.connect(this.audioContext.destination);
        
        // Create analyser for VU meter
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.masterGainNode.connect(this.analyser);
        
        // Get canvas elements
        this.canvas = document.getElementById('multitrack-canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            console.log('Canvas found and initialized');
        } else {
            console.error('Canvas #multitrack-canvas not found!');
        }
        
        this.timelineCanvas = document.getElementById('multitrack-timeline');
        if (this.timelineCanvas) {
            this.timelineCtx = this.timelineCanvas.getContext('2d');
            console.log('Timeline canvas found and initialized');
        } else {
            console.error('Timeline canvas #multitrack-timeline not found!');
        }
        
        // Initialize tracks
        this.initializeTracks();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup resize handle for news editor
        this.setupResizeHandle();
        
        // Load audio library if method exists
        // this.loadAudioLibrary(); // Removed - library loaded on demand
        
        // Setup window resize handler
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
        
        this.initialized = true;
        
        // Initial canvas resize and draw
        this.resizeCanvas();
        this.render();
        this.drawTimeline();
        this.renderLibrary();
    }

    initializeTracks() {
        // Only reset tracks if they don't exist
        if (this.tracks.length === 0) {
            for (let i = 0; i < this.maxTracks; i++) {
                this.tracks.push({
                    id: i,
                    name: `Piste ${i + 1}`,
                    clips: [],
                    volume: 1.0,
                    muted: false,
                    solo: false,
                    armed: false,
                    color: this.getTrackColor(i),
                    gainNode: this.audioContext.createGain(),
                    height: 80
                });
                
                // Connect track gain to master
                this.tracks[i].gainNode.connect(this.masterGainNode);
            }
            
            // Set default track names
            if (this.tracks[0]) this.tracks[0].name = "Voix";
            if (this.tracks[1]) this.tracks[1].name = "Interview";
            if (this.tracks[2]) this.tracks[2].name = "Ambiance";
            if (this.tracks[3]) this.tracks[3].name = "Musique";
        }
    }

    getTrackColor(index) {
        const colors = ['#00ff9f', '#00b4d8', '#f77f00', '#d62828'];
        return colors[index % colors.length];
    }
    
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        if (container) {
            // Use full width of container
            const newWidth = container.clientWidth;
            
            // Calculate height based on layout mode
            const tracksHeight = this.tracks.length * 80;
            const vuMeterHeight = 70; // 50px VU meter + 20px padding
            const minHeight = tracksHeight + vuMeterHeight;
            
            let newHeight;
            if (this.linkedNewsId) {
                // In news mode, always show all tracks with scrolling if needed
                newHeight = minHeight;
            } else {
                // In standalone mode, use container height if larger
                const containerHeight = container.clientHeight;
                newHeight = Math.max(containerHeight || minHeight, minHeight);
            }
            
            // Only update if size changed
            if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
                this.canvas.width = newWidth;
                this.canvas.height = newHeight;
                
                // Also resize timeline if it exists
                if (this.timelineCanvas) {
                    this.timelineCanvas.width = newWidth;
                    this.drawTimeline();
                }
                
                this.render();
            }
        }
    }

    setupResizeHandle() {
        const newsEditor = document.getElementById('multitrack-news-editor');
        const resizeHandle = document.getElementById('multitrack-resize-handle');
        const rightPanel = document.querySelector('.multitrack-right-panel');
        
        if (!resizeHandle || !newsEditor) return;
        
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;
        let containerHeight = 0;
        
        // Load saved preference
        const savedSplit = localStorage.getItem('multitrack-split-position');
        if (savedSplit && newsEditor.classList.contains('active')) {
            newsEditor.style.height = savedSplit + '%';
        }
        
        resizeHandle.addEventListener('mousedown', (e) => {
            if (!newsEditor.classList.contains('active')) return;
            
            isResizing = true;
            startY = e.clientY;
            startHeight = newsEditor.offsetHeight;
            containerHeight = rightPanel ? rightPanel.offsetHeight : window.innerHeight;
            
            // Prevent text selection while resizing
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ns-resize';
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaY = startY - e.clientY;
            const newHeight = startHeight + deltaY;
            const percentHeight = (newHeight / containerHeight) * 100;
            
            // Limit between 15% and 70%
            const clampedPercent = Math.min(70, Math.max(15, percentHeight));
            
            newsEditor.style.height = clampedPercent + '%';
            
            // Force canvas redraw
            if (this.canvas) {
                this.resizeCanvas();
                this.render();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                
                // Save preference
                const currentHeight = newsEditor.style.height;
                if (currentHeight) {
                    localStorage.setItem('multitrack-split-position', parseFloat(currentHeight));
                }
            }
        });
    }
    
    setupEventListeners() {
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // Drag and drop
            this.canvas.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.canvas.addEventListener('drop', (e) => this.handleDrop(e));
        }
        
        // Timeline click events
        if (this.timelineCanvas) {
            this.timelineCanvas.addEventListener('mousedown', (e) => this.handleTimelineClick(e));
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isActive()) {
                this.handleKeyboard(e);
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            if (this.isActive()) {
                this.render();
            }
        });
    }

    isActive() {
        const multitrackSection = document.getElementById('multitrack-section');
        return multitrackSection && multitrackSection.classList.contains('active');
    }

    // Add audio clip to library
    async addToLibrary(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Check if this file is already in the library (by name and duration)
            const existingClip = this.audioLibrary.find(item => 
                item.name === file.name && 
                Math.abs(item.duration - audioBuffer.duration) < 0.01
            );
            
            if (existingClip) {
                console.log('File already in library, skipping duplicate:', file.name);
                return existingClip;
            }
            
            const clip = {
                id: Date.now(),
                name: file.name,
                buffer: audioBuffer,
                duration: audioBuffer.duration,
                type: this.detectAudioType(file.name),
                waveformData: this.generateWaveformData(audioBuffer)
            };
            
            this.audioLibrary.push(clip);
            this.renderLibrary();
            
            return clip;
        } catch (error) {
            console.error('Error adding audio to library:', error);
            showNotification('Erreur lors de l\'ajout du fichier audio', 'error');
        }
    }

    detectAudioType(filename) {
        const lower = filename.toLowerCase();
        if (lower.includes('voix') || lower.includes('voice')) return 'voice';
        if (lower.includes('interview') || lower.includes('itw')) return 'interview';
        if (lower.includes('ambiance') || lower.includes('amb')) return 'ambiance';
        if (lower.includes('musique') || lower.includes('music')) return 'music';
        return 'generic';
    }

    generateWaveformData(buffer) {
        const data = buffer.getChannelData(0);
        const samples = 200; // Number of waveform points
        const blockSize = Math.floor(data.length / samples);
        const waveform = [];
        
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            let max = 0;
            for (let j = 0; j < blockSize; j++) {
                const index = i * blockSize + j;
                if (index < data.length) {
                    const value = Math.abs(data[index]);
                    sum += value;
                    max = Math.max(max, value);
                }
            }
            waveform.push({
                average: sum / blockSize,
                peak: max
            });
        }
        
        return waveform;
    }

    // Add clip to track
    addClipToTrack(libraryItem, trackIndex, position) {
        if (trackIndex < 0 || trackIndex >= this.tracks.length) return;
        
        const track = this.tracks[trackIndex];
        
        // Check for overlaps
        const endPosition = position + libraryItem.duration;
        const hasOverlap = track.clips.some(clip => 
            (position >= clip.position && position < clip.position + clip.duration) ||
            (endPosition > clip.position && endPosition <= clip.position + clip.duration)
        );
        
        if (hasOverlap) {
            showNotification('Un clip existe déjà à cette position', 'warning');
            return;
        }
        
        const clip = {
            id: Date.now(),
            libraryId: libraryItem.id,
            name: libraryItem.name,
            position: this.snapToGrid ? this.snapTimeToGrid(position) : position,
            duration: libraryItem.duration,
            trimStart: 0,
            trimEnd: libraryItem.duration,
            fadeIn: 0,
            fadeOut: 0,
            gain: 1.0,
            color: this.getClipColor(libraryItem.type)
        };
        
        track.clips.push(clip);
        track.clips.sort((a, b) => a.position - b.position);
        
        this.render();
        this.saveToHistory();
    }

    getClipColor(type) {
        const colors = {
            voice: '#00ff9f',
            interview: '#00b4d8',
            ambiance: '#f77f00',
            music: '#d62828',
            generic: '#666666'
        };
        return colors[type] || colors.generic;
    }

    snapTimeToGrid(time) {
        if (!this.snapToGrid) return time;
        return Math.round(time / this.gridInterval) * this.gridInterval;
    }

    // Rendering
    render() {
        if (!this.canvas) {
            console.warn('Cannot render: canvas not found');
            return;
        }
        
        if (!this.canvas.parentElement) {
            console.warn('Cannot render: canvas parent not found');
            return;
        }
        
        const width = this.canvas.width = this.canvas.parentElement.clientWidth || 800;
        const height = this.canvas.height = this.tracks.length * 80 + 70; // Track heights + VU meter space
        
        console.log(`Rendering multitrack: ${width}x${height}, tracks: ${this.tracks.length}`);
        
        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw timeline
        this.drawTimeline();
        
        // Draw tracks
        this.tracks.forEach((track, index) => {
            this.drawTrack(track, index);
        });
        
        // Draw target duration zone in tracks
        this.drawTargetDurationInTracks();
        
        // Draw In/Out points
        this.drawInOutPoints();
        
        // Draw playhead
        if (this.currentTime >= 0) {
            this.drawPlayhead();
        }
        
        // Draw VU meter if playing
        if (this.isPlaying) {
            this.drawVUMeter();
        }
        
        // Draw edit mode indicator
        this.drawEditModeIndicator();
        
        // Draw recording indicator if recording
        if (this.isRecording) {
            this.drawRecordingIndicator();
        }
    }
    
    drawRecordingIndicator() {
        // Draw REC indicator in top left
        const x = 130;
        const y = 15;
        
        // Pulsing red dot
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
        this.ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // REC text
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 14px sans-serif';
        this.ctx.fillText('REC', x + 15, y + 5);
        
        // Recording time
        const elapsed = (performance.now() - this.recordingStartTimeReal) / 1000;
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText(this.formatTime(elapsed), x + 50, y + 5);
    }
    
    drawEditModeIndicator() {
        if (this.editMode === 'razor') {
            // Draw razor mode indicator in top right
            const x = this.canvas.width - 100;
            const y = 10;
            
            this.ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
            this.ctx.fillRect(x, y, 90, 25);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('MODE RASOIR', x + 45, y + 17);
            
            this.ctx.textAlign = 'left';
        }
    }

    drawTimeline() {
        if (!this.timelineCanvas) return;
        
        const width = this.timelineCanvas.width = this.timelineCanvas.parentElement.clientWidth;
        const height = this.timelineCanvas.height = 40;
        const headerWidth = 120;
        
        this.timelineCtx.fillStyle = '#1a1a1a';
        this.timelineCtx.fillRect(0, 0, width, height);
        
        // Draw header area
        this.timelineCtx.fillStyle = '#222';
        this.timelineCtx.fillRect(0, 0, headerWidth, height);
        
        // Draw target duration zone if linked to news
        if (this.targetDuration !== null) {
            this.drawTargetDurationZone(width, height, headerWidth);
        }
        
        // Calculate visible time range
        const visibleDuration = width / (this.pixelsPerSecond * this.zoomLevel);
        const startTime = this.scrollX / (this.pixelsPerSecond * this.zoomLevel);
        const endTime = startTime + visibleDuration;
        
        // Draw time markers
        const interval = this.getTimeInterval(this.pixelsPerSecond * this.zoomLevel);
        this.timelineCtx.strokeStyle = '#444';
        this.timelineCtx.fillStyle = '#888';
        this.timelineCtx.font = '10px monospace';
        
        for (let t = 0; t <= this.duration; t += interval) {
            const x = headerWidth + (t - startTime) * this.pixelsPerSecond * this.zoomLevel;
            if (x >= headerWidth && x <= width) {
                this.timelineCtx.beginPath();
                this.timelineCtx.moveTo(x, height - 10);
                this.timelineCtx.lineTo(x, height);
                this.timelineCtx.stroke();
                
                const timeStr = this.formatTime(t);
                this.timelineCtx.fillText(timeStr, x + 2, height - 15);
            }
        }
        
        // Draw playhead in timeline
        const playheadX = headerWidth + this.currentTime * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
        if (playheadX >= headerWidth && playheadX <= width) {
            this.timelineCtx.strokeStyle = '#ff0000';
            this.timelineCtx.lineWidth = 2;
            this.timelineCtx.beginPath();
            this.timelineCtx.moveTo(playheadX, 0);
            this.timelineCtx.lineTo(playheadX, height);
            this.timelineCtx.stroke();
        }
    }

    getTimeInterval(pixelsPerSecond) {
        if (pixelsPerSecond > 100) return 1;
        if (pixelsPerSecond > 50) return 2;
        if (pixelsPerSecond > 20) return 5;
        if (pixelsPerSecond > 10) return 10;
        return 30;
    }
    
    drawTargetDurationZone(width, height, headerWidth) {
        if (this.targetDuration === null) return;
        
        // Calculate position of target duration line
        const targetX = headerWidth + this.targetDuration * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
        
        // Draw red zone after target duration (in timeline)
        if (targetX > headerWidth) {
            // Semi-transparent red overlay after target
            this.timelineCtx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            this.timelineCtx.fillRect(targetX, 0, width - targetX, height);
            
            // Target duration line
            this.timelineCtx.strokeStyle = '#ff0000';
            this.timelineCtx.lineWidth = 2;
            this.timelineCtx.beginPath();
            this.timelineCtx.moveTo(targetX, 0);
            this.timelineCtx.lineTo(targetX, height);
            this.timelineCtx.stroke();
            
            // Label
            this.timelineCtx.fillStyle = '#ff0000';
            this.timelineCtx.font = 'bold 11px sans-serif';
            this.timelineCtx.fillText(`Durée cible: ${this.formatTime(this.targetDuration)}`, targetX + 5, height / 2 + 3);
        }
    }
    
    drawTargetDurationInTracks() {
        if (this.targetDuration === null) return;
        
        const headerWidth = 120;
        const targetX = headerWidth + this.targetDuration * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
        const trackHeight = this.tracks.length * 80;
        
        // Draw semi-transparent red overlay in main canvas too
        if (targetX > headerWidth && targetX < this.canvas.width) {
            // Red line at target duration
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(targetX, 0);
            this.ctx.lineTo(targetX, trackHeight);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Light red overlay after target
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
            this.ctx.fillRect(targetX, 0, this.canvas.width - targetX, trackHeight);
        }
    }

    drawTrack(track, index) {
        const y = index * track.height;
        const width = this.canvas.width;
        
        // Track background
        this.ctx.fillStyle = index % 2 === 0 ? '#1a1a1a' : '#151515';
        this.ctx.fillRect(0, y, width, track.height);
        
        // Track border
        this.ctx.strokeStyle = '#333';
        this.ctx.strokeRect(0, y, width, track.height);
        
        // Draw clips
        track.clips.forEach(clip => {
            this.drawClip(clip, track, y);
        });
        
        // Track header (on a separate fixed area in real implementation)
        this.drawTrackHeader(track, index);
    }

    drawClip(clip, track, trackY) {
        const libraryItem = this.audioLibrary.find(item => item.id === clip.libraryId);
        if (!libraryItem) return;
        
        const headerWidth = 120; // Account for track header
        const x = headerWidth + clip.position * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
        const width = clip.duration * this.pixelsPerSecond * this.zoomLevel;
        const height = track.height - 10;
        const y = trackY + 5;
        
        // Don't draw if outside visible area
        if (x + width < headerWidth || x > this.canvas.width) return;
        
        // Clip background
        this.ctx.fillStyle = clip.color + '33'; // Semi-transparent
        this.ctx.fillRect(x, y, width, height);
        
        // Clip border (highlight if selected)
        const isSelected = this.selection.clip && this.selection.clip.id === clip.id;
        this.ctx.strokeStyle = isSelected ? '#ffff00' : clip.color;
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // Add selection glow if selected
        if (isSelected) {
            this.ctx.shadowColor = '#ffff00';
            this.ctx.shadowBlur = 10;
            this.ctx.strokeRect(x, y, width, height);
            this.ctx.shadowBlur = 0;
        }
        
        // Draw waveform
        this.drawClipWaveform(libraryItem, x, y, width, height);
        
        // Clip name
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '11px sans-serif';
        this.ctx.fillText(clip.name, x + 5, y + 15);
        
        // Fade handles and curves - only if enabled
        if (this.fadeHandlesEnabled) {
            if (clip.fadeIn > 0) {
                this.drawFadeIn(x, y, clip.fadeIn * this.pixelsPerSecond * this.zoomLevel, height);
            }
            if (clip.fadeOut > 0) {
                this.drawFadeOut(x + width - clip.fadeOut * this.pixelsPerSecond * this.zoomLevel, 
                                y, clip.fadeOut * this.pixelsPerSecond * this.zoomLevel, height);
            }
            
            // Draw fade handles (interactive corners)
            this.drawFadeHandles(x, y, width, height, isSelected, clip);
        }
    }

    drawClipWaveform(libraryItem, x, y, width, height) {
        if (!libraryItem.waveformData) return;
        
        const waveform = libraryItem.waveformData;
        const samplesPerPixel = waveform.length / width;
        
        this.ctx.fillStyle = '#00ff9f55';
        
        for (let px = 0; px < width; px++) {
            const sampleIndex = Math.floor(px * samplesPerPixel);
            if (sampleIndex < waveform.length) {
                const sample = waveform[sampleIndex];
                const barHeight = sample.peak * height * 0.8;
                this.ctx.fillRect(x + px, y + (height - barHeight) / 2, 1, barHeight);
            }
        }
    }

    drawFadeIn(x, y, width, height) {
        // Draw fade curve
        this.ctx.strokeStyle = '#00ff9f';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + height);
        
        // Draw exponential curve
        for (let px = 0; px <= width; px += 2) {
            const progress = px / width;
            const curveY = y + height - (height * Math.pow(progress, 2));
            this.ctx.lineTo(x + px, curveY);
        }
        this.ctx.stroke();
        
        // Draw semi-transparent overlay
        const gradient = this.ctx.createLinearGradient(x, y, x + width, y);
        gradient.addColorStop(0, 'rgba(0, 255, 159, 0)');
        gradient.addColorStop(1, 'rgba(0, 255, 159, 0.2)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, width, height);
    }

    drawFadeOut(x, y, width, height) {
        // Draw fade curve
        this.ctx.strokeStyle = '#ff6600';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        
        // Draw exponential curve
        for (let px = 0; px <= width; px += 2) {
            const progress = px / width;
            const curveY = y + (height * Math.pow(progress, 2));
            this.ctx.lineTo(x + px, curveY);
        }
        this.ctx.stroke();
        
        // Draw semi-transparent overlay
        const gradient = this.ctx.createLinearGradient(x, y, x + width, y);
        gradient.addColorStop(0, 'rgba(255, 102, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 102, 0, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, width, height);
    }
    
    drawFadeHandles(x, y, width, height, isSelected, clip) {
        // Safety check - ensure clip exists and has fade properties
        if (!clip || !this.ctx) return;
        
        const handleSize = 15;
        
        // Fade in handle (top-left corner)
        this.ctx.fillStyle = isSelected ? '#00ff9f' : '#00ff9f88';
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + handleSize, y);
        this.ctx.lineTo(x, y + handleSize);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw fade in duration text if has fade
        if (clip.fadeIn && clip.fadeIn > 0) {
            this.ctx.fillStyle = '#00ff9f';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${clip.fadeIn.toFixed(2)}s`, x + 2, y + handleSize + 12);
        }
        
        // Fade out handle (top-right corner)
        this.ctx.fillStyle = isSelected ? '#ff6600' : '#ff660088';
        this.ctx.beginPath();
        this.ctx.moveTo(x + width, y);
        this.ctx.lineTo(x + width - handleSize, y);
        this.ctx.lineTo(x + width, y + handleSize);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw fade out duration text if has fade
        if (clip.fadeOut && clip.fadeOut > 0) {
            this.ctx.fillStyle = '#ff6600';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`${clip.fadeOut.toFixed(2)}s`, x + width - 2, y + handleSize + 12);
        }
    }

    drawTrackHeader(track, index) {
        // Draw track header info on the left side of the track
        const y = index * track.height;
        const headerWidth = 120;
        
        // Header background
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, y, headerWidth, track.height);
        
        // Recording indicator for armed tracks
        if (track.armed && this.isRecording) {
            // Pulsing red background
            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            this.ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.2})`;
            this.ctx.fillRect(0, y, headerWidth, track.height);
        }
        
        // Track name
        this.ctx.fillStyle = track.armed ? '#ff3333' : '#fff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillText(track.name, 10, y + 20);
        
        // Draw control indicators
        const buttonsY = y + 35;
        const buttonSize = 20;
        const buttonSpacing = 25;
        
        // Mute button
        this.ctx.fillStyle = track.muted ? '#ff3333' : '#444';
        this.ctx.fillRect(10, buttonsY, buttonSize, buttonSize);
        this.ctx.fillStyle = track.muted ? '#fff' : '#888';
        this.ctx.font = 'bold 10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('M', 20, buttonsY + 14);
        
        // Solo button
        this.ctx.fillStyle = track.solo ? '#ffaa00' : '#444';
        this.ctx.fillRect(10 + buttonSpacing, buttonsY, buttonSize, buttonSize);
        this.ctx.fillStyle = track.solo ? '#fff' : '#888';
        this.ctx.fillText('S', 20 + buttonSpacing, buttonsY + 14);
        
        // Arm button
        this.ctx.fillStyle = track.armed ? '#ff0000' : '#444';
        this.ctx.fillRect(10 + buttonSpacing * 2, buttonsY, buttonSize, buttonSize);
        this.ctx.fillStyle = track.armed ? '#fff' : '#888';
        this.ctx.fillText('R', 20 + buttonSpacing * 2, buttonsY + 14);
        
        // Volume indicator
        this.ctx.fillStyle = '#666';
        this.ctx.fillRect(10, buttonsY + 25, 75, 4);
        this.ctx.fillStyle = '#00ff9f';
        this.ctx.fillRect(10, buttonsY + 25, 75 * track.volume, 4);
        
        this.ctx.textAlign = 'left';
        
        // Draw separator
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(headerWidth, y);
        this.ctx.lineTo(headerWidth, y + track.height);
        this.ctx.stroke();
    }

    drawInOutPoints() {
        const headerWidth = 120;
        const trackHeight = this.tracks.length * 80;
        
        // Draw In point
        if (this.inPoint !== null) {
            const inX = headerWidth + this.inPoint * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
            if (inX >= headerWidth && inX <= this.canvas.width) {
                // Draw line
                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(inX, 0);
                this.ctx.lineTo(inX, trackHeight);
                this.ctx.stroke();
                
                // Draw marker
                this.ctx.fillStyle = '#00ff00';
                this.ctx.beginPath();
                this.ctx.moveTo(inX, 0);
                this.ctx.lineTo(inX - 5, 10);
                this.ctx.lineTo(inX + 5, 10);
                this.ctx.closePath();
                this.ctx.fill();
                
                // Draw label
                this.ctx.fillStyle = '#00ff00';
                this.ctx.font = 'bold 10px sans-serif';
                this.ctx.fillText('IN', inX - 8, 20);
            }
        }
        
        // Draw Out point
        if (this.outPoint !== null) {
            const outX = headerWidth + this.outPoint * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
            if (outX >= headerWidth && outX <= this.canvas.width) {
                // Draw line
                this.ctx.strokeStyle = '#ff6600';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(outX, 0);
                this.ctx.lineTo(outX, trackHeight);
                this.ctx.stroke();
                
                // Draw marker
                this.ctx.fillStyle = '#ff6600';
                this.ctx.beginPath();
                this.ctx.moveTo(outX, 0);
                this.ctx.lineTo(outX - 5, 10);
                this.ctx.lineTo(outX + 5, 10);
                this.ctx.closePath();
                this.ctx.fill();
                
                // Draw label
                this.ctx.fillStyle = '#ff6600';
                this.ctx.font = 'bold 10px sans-serif';
                this.ctx.fillText('OUT', outX - 12, 20);
            }
        }
        
        // Draw shaded area between In and Out
        if (this.inPoint !== null && this.outPoint !== null) {
            const inX = headerWidth + this.inPoint * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
            const outX = headerWidth + this.outPoint * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
            
            const startX = Math.max(headerWidth, Math.min(inX, outX));
            const endX = Math.min(this.canvas.width, Math.max(inX, outX));
            
            if (endX > startX) {
                this.ctx.fillStyle = 'rgba(0, 255, 159, 0.1)';
                this.ctx.fillRect(startX, 0, endX - startX, trackHeight);
            }
        }
    }
    
    drawPlayhead() {
        const headerWidth = 120;
        const x = headerWidth + this.currentTime * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
        
        if (x >= headerWidth && x <= this.canvas.width) {
            // Different color and style when recording
            if (this.isRecording) {
                // Pulsing red playhead when recording
                const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
                this.ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
                this.ctx.lineWidth = 3;
                
                // Add glow effect
                this.ctx.shadowColor = '#ff0000';
                this.ctx.shadowBlur = 10;
            } else {
                this.ctx.strokeStyle = '#ff0000';
                this.ctx.lineWidth = 2;
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.tracks.length * 80);
            this.ctx.stroke();
            
            // Reset shadow
            this.ctx.shadowBlur = 0;
        }
    }

    drawVUMeter() {
        if (!this.analyser || !this.canvas) return;
        
        const width = this.canvas.width;
        const height = 50; // VU meter height
        const offsetY = Math.max(this.canvas.height - height - 10, this.tracks.length * 80 + 10); // Position at bottom or after tracks
        
        // Draw background
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, offsetY, width, height);
        
        // Draw border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0, offsetY, width, height);
        
        // Get audio data
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);
        
        // Calculate RMS levels for stereo (simulated from mono)
        let sumLeft = 0;
        let sumRight = 0;
        let peakLeft = 0;
        let peakRight = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const value = Math.abs(dataArray[i]);
            peakLeft = Math.max(peakLeft, value);
            peakRight = Math.max(peakRight, value * 0.95); // Slightly different for stereo effect
            sumLeft += value * value;
            sumRight += value * value * 0.9; // Slightly different for stereo effect
        }
        
        const rmsLeft = Math.sqrt(sumLeft / bufferLength);
        const rmsRight = Math.sqrt(sumRight / bufferLength);
        
        // Convert to dB
        const dbLeft = 20 * Math.log10(Math.max(0.00001, rmsLeft));
        const dbRight = 20 * Math.log10(Math.max(0.00001, rmsRight));
        const dbPeakLeft = 20 * Math.log10(Math.max(0.00001, peakLeft));
        const dbPeakRight = 20 * Math.log10(Math.max(0.00001, peakRight));
        
        // Normalize to 0-1 range (-60dB to 0dB)
        const normalizedLeft = Math.max(0, Math.min(1, (dbLeft + 60) / 60));
        const normalizedRight = Math.max(0, Math.min(1, (dbRight + 60) / 60));
        const normalizedPeakLeft = Math.max(0, Math.min(1, (dbPeakLeft + 60) / 60));
        const normalizedPeakRight = Math.max(0, Math.min(1, (dbPeakRight + 60) / 60));
        
        // Smooth the values
        this.vuMeterPeakLeft = Math.max(normalizedPeakLeft, this.vuMeterPeakLeft * 0.95);
        this.vuMeterPeakRight = Math.max(normalizedPeakRight, this.vuMeterPeakRight * 0.95);
        
        // Peak hold
        if (normalizedPeakLeft > this.vuMeterPeakHoldLeft) {
            this.vuMeterPeakHoldLeft = normalizedPeakLeft;
            this.vuMeterPeakHoldCounter = 30;
        } else if (this.vuMeterPeakHoldCounter > 0) {
            this.vuMeterPeakHoldCounter--;
        } else {
            this.vuMeterPeakHoldLeft = this.vuMeterPeakHoldLeft * 0.99;
        }
        
        if (normalizedPeakRight > this.vuMeterPeakHoldRight) {
            this.vuMeterPeakHoldRight = normalizedPeakRight;
        }
        
        // Draw meter background tracks
        const meterHeight = (height - 10) / 2;
        const meterY1 = offsetY + 5;
        const meterY2 = offsetY + height / 2 + 2;
        
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(5, meterY1, width - 10, meterHeight);
        this.ctx.fillRect(5, meterY2, width - 10, meterHeight);
        
        // Create gradient for the bars
        const gradient = this.ctx.createLinearGradient(5, 0, width - 5, 0);
        gradient.addColorStop(0, '#00ff00');
        gradient.addColorStop(0.6, '#66ff00');
        gradient.addColorStop(0.8, '#ffcc00');
        gradient.addColorStop(0.9, '#ff6600');
        gradient.addColorStop(1, '#ff0000');
        
        // Draw level bars for each channel
        for (let channel = 0; channel < 2; channel++) {
            const y = channel === 0 ? meterY1 : meterY2;
            const level = channel === 0 ? normalizedLeft : normalizedRight;
            const peak = channel === 0 ? this.vuMeterPeakLeft : this.vuMeterPeakRight;
            const peakHold = channel === 0 ? this.vuMeterPeakHoldLeft : this.vuMeterPeakHoldRight;
            
            // Draw the level bar
            const barWidth = level * (width - 10);
            
            // Draw bar with gradient
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(5, y, barWidth, meterHeight);
            this.ctx.clip();
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(5, y, width - 10, meterHeight);
            this.ctx.restore();
            
            // Draw peak indicator
            const peakX = 5 + peak * (width - 10);
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(peakX, y);
            this.ctx.lineTo(peakX, y + meterHeight);
            this.ctx.stroke();
            
            // Draw peak hold line
            const peakHoldX = 5 + peakHold * (width - 10);
            this.ctx.strokeStyle = '#ff00ff';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(peakHoldX, y);
            this.ctx.lineTo(peakHoldX, y + meterHeight);
            this.ctx.stroke();
        }
        
        // Draw scale markers
        const dbMarkers = [0, -6, -12, -20, -40];
        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px monospace';
        this.ctx.textAlign = 'center';
        
        dbMarkers.forEach(db => {
            const normalized = (db + 60) / 60;
            const x = 5 + normalized * (width - 10);
            
            // Draw tick
            this.ctx.strokeStyle = '#444';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, offsetY);
            this.ctx.lineTo(x, offsetY + height);
            this.ctx.stroke();
            
            // Draw label at top
            this.ctx.fillText(`${db}`, x, offsetY - 2);
        });
        
        // Draw channel labels
        this.ctx.fillStyle = '#888';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('L', width - 15, meterY1 + meterHeight/2 + 3);
        this.ctx.fillText('R', width - 15, meterY2 + meterHeight/2 + 3);
    }

    // Navigation methods
    goToStart() {
        this.currentTime = 0;
        this.render();
        this.updateTimeDisplay();
    }
    
    goToEnd() {
        this.currentTime = this.getMaxDuration();
        this.render();
        this.updateTimeDisplay();
    }
    
    movePlayhead(delta) {
        const maxDuration = this.getMaxDuration();
        this.currentTime = Math.max(0, Math.min(maxDuration, this.currentTime + delta));
        this.render();
        this.updateTimeDisplay();
    }
    
    setPlayheadPosition(time) {
        const maxDuration = this.getMaxDuration();
        this.currentTime = Math.max(0, Math.min(maxDuration, time));
        this.render();
        this.updateTimeDisplay();
    }
    
    updateTimeDisplay() {
        // Update time display in UI if it exists
        const timeDisplay = document.getElementById('multitrack-time-display');
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(this.currentTime);
        }
        
        // Update In/Out display
        const inOutDisplay = document.getElementById('multitrack-inout-display');
        if (inOutDisplay) {
            if (this.inPoint !== null && this.outPoint !== null) {
                const duration = this.outPoint - this.inPoint;
                inOutDisplay.textContent = `In: ${this.formatTime(this.inPoint)} | Out: ${this.formatTime(this.outPoint)} | Durée: ${this.formatTime(duration)}`;
            } else if (this.inPoint !== null) {
                inOutDisplay.textContent = `In: ${this.formatTime(this.inPoint)}`;
            } else if (this.outPoint !== null) {
                inOutDisplay.textContent = `Out: ${this.formatTime(this.outPoint)}`;
            } else {
                inOutDisplay.textContent = '';
            }
        }
    }
    
    // In/Out points
    setInPoint(time = null) {
        this.inPoint = time !== null ? time : this.currentTime;
        if (this.outPoint !== null && this.inPoint >= this.outPoint) {
            this.outPoint = null;
        }
        this.render();
        this.updateTimeDisplay();
        showNotification(`Point d'entrée défini à ${this.formatTime(this.inPoint)}`, 'success');
    }
    
    setOutPoint(time = null) {
        this.outPoint = time !== null ? time : this.currentTime;
        if (this.inPoint !== null && this.outPoint <= this.inPoint) {
            this.inPoint = null;
        }
        this.render();
        this.updateTimeDisplay();
        showNotification(`Point de sortie défini à ${this.formatTime(this.outPoint)}`, 'success');
    }
    
    clearInOutPoints() {
        this.inPoint = null;
        this.outPoint = null;
        this.render();
        this.updateTimeDisplay();
        showNotification('Points In/Out effacés', 'info');
    }
    
    goToInPoint() {
        if (this.inPoint !== null) {
            this.currentTime = this.inPoint;
            this.render();
            this.updateTimeDisplay();
        }
    }
    
    goToOutPoint() {
        if (this.outPoint !== null) {
            this.currentTime = this.outPoint;
            this.render();
            this.updateTimeDisplay();
        }
    }
    
    // Playback control
    play() {
        if (this.isPlaying) {
            this.pause();
            return;
        }
        
        this.isPlaying = true;
        this.playStartTime = this.audioContext.currentTime;
        this.playingSources = [];
        
        // Determine if any track is soloed
        const hasSoloedTrack = this.tracks.some(t => t.solo);
        
        // Use In point as start if defined, otherwise current position
        const playStartPosition = this.inPoint !== null && this.currentTime < this.inPoint ? 
            this.inPoint : this.currentTime;
        this.currentTime = playStartPosition;
        
        // Schedule all clips from current position
        this.tracks.forEach((track, trackIndex) => {
            // Skip muted tracks or non-soloed tracks when solo is active
            if (track.muted || (hasSoloedTrack && !track.solo)) return;
            
            track.clips.forEach(clip => {
                const libraryItem = this.audioLibrary.find(item => item.id === clip.libraryId);
                if (!libraryItem) return;
                
                // Calculate when to play this clip
                const clipEndTime = clip.position + clip.duration;
                
                if (clipEndTime > this.currentTime) {
                    // Clip is ahead or currently playing
                    const when = Math.max(0, clip.position - this.currentTime);
                    const offset = Math.max(0, this.currentTime - clip.position);
                    const duration = Math.min(clip.duration - offset, clipEndTime - this.currentTime);
                    
                    this.scheduleClip(clip, libraryItem, track, when, offset, duration);
                }
            });
        });
        
        this.startPlaybackAnimation();
        this.startVUMeter();
    }

    scheduleClip(clip, libraryItem, track, when, offset, duration) {
        const source = this.audioContext.createBufferSource();
        source.buffer = libraryItem.buffer;
        
        const clipGain = this.audioContext.createGain();
        clipGain.gain.value = (clip.gain || 1) * track.volume;
        
        // Apply volume envelope if exists
        if (clip.volumeEnvelope && clip.volumeEnvelope.length > 1) {
            const now = this.audioContext.currentTime;
            clip.volumeEnvelope.forEach(point => {
                const pointTime = now + when + point.time - offset;
                if (pointTime >= now) {
                    clipGain.gain.setValueAtTime(point.volume * track.volume, pointTime);
                }
            });
        }
        
        // Apply fades
        if (clip.fadeIn > 0 && offset < clip.fadeIn) {
            const now = this.audioContext.currentTime;
            clipGain.gain.setValueAtTime(0, now + when);
            clipGain.gain.linearRampToValueAtTime(
                (clip.gain || 1) * track.volume,
                now + when + clip.fadeIn - offset
            );
        }
        
        if (clip.fadeOut > 0) {
            const fadeStartTime = duration - clip.fadeOut;
            if (fadeStartTime > 0) {
                const now = this.audioContext.currentTime;
                clipGain.gain.setValueAtTime(
                    (clip.gain || 1) * track.volume,
                    now + when + fadeStartTime
                );
                clipGain.gain.linearRampToValueAtTime(0, now + when + duration);
            }
        }
        
        source.connect(clipGain);
        clipGain.connect(track.gainNode);
        
        source.start(this.audioContext.currentTime + when, offset + (clip.trimStart || 0), duration);
        
        // Store reference for stopping
        this.playingSources.push({
            source: source,
            startTime: this.audioContext.currentTime + when,
            duration: duration
        });
    }

    stop() {
        this.isPlaying = false;
        
        // Stop recording if active
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Stop all playing sources
        if (this.playingSources) {
            this.playingSources.forEach(item => {
                try {
                    item.source.stop();
                } catch (e) {}
            });
            this.playingSources = [];
        }
        
        this.stopPlaybackAnimation();
    }

    pause() {
        if (!this.isPlaying) return;
        
        // Calculate current position
        const elapsed = this.audioContext.currentTime - this.playStartTime;
        this.currentTime += elapsed;
        
        this.stop();
    }

    startPlaybackAnimation() {
        // Cancel any existing animation
        if (this.playbackAnimation) {
            cancelAnimationFrame(this.playbackAnimation);
        }
        
        const animate = () => {
            if (!this.isPlaying) {
                this.playbackAnimation = null;
                return;
            }
            
            const elapsed = this.audioContext.currentTime - this.playStartTime;
            this.currentTime += elapsed;
            this.playStartTime = this.audioContext.currentTime;
            
            // Auto-scroll to follow playhead
            const headerWidth = 120;
            const playheadX = this.currentTime * this.pixelsPerSecond * this.zoomLevel;
            const viewWidth = this.canvas.width - headerWidth;
            
            if (playheadX > this.scrollX + viewWidth - 100) {
                this.scrollX = playheadX - 100;
            }
            
            // Update time display
            this.updateTimeDisplay();
            
            // Check if we've reached the end or Out point
            const maxDuration = this.outPoint !== null ? 
                Math.min(this.outPoint, this.getMaxDuration()) : 
                this.getMaxDuration();
            
            if (this.currentTime >= maxDuration) {
                this.stop();
                this.currentTime = maxDuration;
            }
            
            this.render();
            
            this.playbackAnimation = requestAnimationFrame(animate);
        };
        
        animate();
    }

    stopPlaybackAnimation() {
        if (this.playbackAnimation) {
            cancelAnimationFrame(this.playbackAnimation);
            this.playbackAnimation = null;
        }
        this.stopVUMeter();
    }
    
    stopRecordingAnimation() {
        if (this.recordingAnimation) {
            cancelAnimationFrame(this.recordingAnimation);
            this.recordingAnimation = null;
        }
    }
    
    startVUMeter() {
        // VU meter is now drawn by the main playback animation
        // This method is kept for compatibility but doesn't need its own animation loop
    }
    
    stopVUMeter() {
        if (this.vuMeterAnimation) {
            cancelAnimationFrame(this.vuMeterAnimation);
            this.vuMeterAnimation = null;
        }
        // Reset peak hold values
        this.vuMeterPeakHoldLeft = 0;
        this.vuMeterPeakHoldRight = 0;
        this.vuMeterPeakHoldCounter = 0;
    }

    // Library panel
    renderLibrary() {
        const libraryEl = document.getElementById('multitrack-library');
        if (!libraryEl) return;
        
        if (this.audioLibrary.length === 0) {
            libraryEl.innerHTML = `
                <div class="library-empty">
                    <p>Chutier vide</p>
                    <p class="hint">Glissez des fichiers audio ici</p>
                </div>
            `;
            return;
        }
        
        libraryEl.innerHTML = this.audioLibrary.map(item => `
            <div class="library-item" draggable="true" data-id="${item.id}">
                <div class="library-item-icon">${this.getTypeIcon(item.type)}</div>
                <div class="library-item-info">
                    <div class="library-item-name">${item.name}</div>
                    <div class="library-item-duration">${this.formatTime(item.duration)}</div>
                </div>
            </div>
        `).join('');
        
        // Add drag event listeners
        libraryEl.querySelectorAll('.library-item').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                const id = parseInt(el.dataset.id);
                const item = this.audioLibrary.find(i => i.id === id);
                if (item) {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'library-item',
                        item: { id: item.id, duration: item.duration }
                    }));
                }
            });
        });
    }

    getTypeIcon(type) {
        const icons = {
            voice: '🎙️',
            interview: '🎤',
            ambiance: '🌍',
            music: '🎵',
            generic: '🔊'
        };
        return icons[type] || icons.generic;
    }

    // Event handlers
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on track headers
        if (x < 120) {
            const trackIndex = Math.floor(y / 80);
            if (trackIndex >= 0 && trackIndex < this.tracks.length) {
                const relY = y - trackIndex * 80;
                
                // Check if clicking on control buttons
                if (relY >= 35 && relY <= 55) {
                    const relX = x - 10;
                    if (relX >= 0 && relX <= 20) {
                        // Mute button
                        this.toggleTrackMute(trackIndex);
                        return;
                    } else if (relX >= 25 && relX <= 45) {
                        // Solo button
                        this.toggleTrackSolo(trackIndex);
                        return;
                    } else if (relX >= 50 && relX <= 70) {
                        // Arm button
                        this.toggleTrackArm(trackIndex);
                        return;
                    }
                }
            }
            return;
        }
        
        // Determine which track was clicked
        const trackIndex = Math.floor(y / 80);
        if (trackIndex >= 0 && trackIndex < this.tracks.length) {
            this.activeTrack = trackIndex;
            
            // Check if clicking on a clip
            const track = this.tracks[trackIndex];
            const headerWidth = 120;
            const time = ((x - headerWidth) + this.scrollX) / (this.pixelsPerSecond * this.zoomLevel);
            
            const clip = track.clips.find(c => 
                time >= c.position && time <= c.position + c.duration
            );
            
            // Handle razor mode
            if (this.editMode === 'razor' && clip) {
                // Split the clip at the click position
                if (this.splitClip(clip, track, time)) {
                    this.render();
                    this.saveToHistory();
                    showNotification('Clip divisé', 'success');
                }
                return;
            }
            
            // Normal mode handling
            if (clip) {
                if (e.button === 2) { // Right click
                    this.showClipContextMenu(clip, e.clientX, e.clientY);
                } else {
                    // Check if clicking on fade handles - only if enabled
                    if (this.fadeHandlesEnabled) {
                        const clipX = headerWidth + clip.position * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
                        const clipWidth = clip.duration * this.pixelsPerSecond * this.zoomLevel;
                        const clipY = trackIndex * 80 + 5;
                        const handleSize = 15;
                        
                        // Check fade in handle (top-left corner)
                        if (x >= clipX && x <= clipX + handleSize && 
                            y >= clipY && y <= clipY + handleSize) {
                            this.isDragging = true;
                            this.draggedClip = clip;
                            this.dragType = 'fadeIn';
                            this.canvas.style.cursor = 'ew-resize';
                            return;
                        }
                        
                        // Check fade out handle (top-right corner)
                        if (x >= clipX + clipWidth - handleSize && x <= clipX + clipWidth && 
                            y >= clipY && y <= clipY + handleSize) {
                            this.isDragging = true;
                            this.draggedClip = clip;
                            this.dragType = 'fadeOut';
                            this.canvas.style.cursor = 'ew-resize';
                            return;
                        }
                    }
                    
                    // Start dragging the clip
                    this.selectClip(clip, trackIndex);
                    this.isDragging = true;
                    this.draggedClip = clip;
                    this.dragType = 'move';
                    this.dragOffset = {
                        x: time - clip.position,
                        y: 0,
                        originalTrack: trackIndex
                    };
                    this.canvas.style.cursor = 'move';
                }
            } else {
                // Set playhead position
                this.currentTime = time;
                this.render();
            }
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const headerWidth = 120;
        
        // Check for hover over fade handles when not dragging
        if (!this.isDragging && x > headerWidth) {
            const trackIndex = Math.floor(y / 80);
            if (trackIndex >= 0 && trackIndex < this.tracks.length) {
                const track = this.tracks[trackIndex];
                const time = ((x - headerWidth) + this.scrollX) / (this.pixelsPerSecond * this.zoomLevel);
                
                const clip = track.clips.find(c => 
                    time >= c.position && time <= c.position + c.duration
                );
                
                if (clip) {
                    const clipX = headerWidth + clip.position * this.pixelsPerSecond * this.zoomLevel - this.scrollX;
                    const clipWidth = clip.duration * this.pixelsPerSecond * this.zoomLevel;
                    const clipY = trackIndex * 80 + 5;
                    const handleSize = 15;
                    
                    // Check if hovering over fade handles - DISABLED
                    // if ((x >= clipX && x <= clipX + handleSize && 
                    //      y >= clipY && y <= clipY + handleSize) ||
                    //     (x >= clipX + clipWidth - handleSize && x <= clipX + clipWidth && 
                    //      y >= clipY && y <= clipY + handleSize)) {
                    //     this.canvas.style.cursor = 'ew-resize';
                    // } else
                    if (time >= clip.position && time <= clip.position + clip.duration) {
                        this.canvas.style.cursor = 'move';
                    } else {
                        this.canvas.style.cursor = 'default';
                    }
                } else {
                    this.canvas.style.cursor = 'default';
                }
            }
        }
        
        if (this.isDragging && this.draggedClip) {
            const time = ((x - headerWidth) + this.scrollX) / (this.pixelsPerSecond * this.zoomLevel);
            const trackIndex = Math.min(Math.max(0, Math.floor(y / 80)), this.tracks.length - 1);
            
            // Fade dragging - only if enabled
            if (this.fadeHandlesEnabled && this.dragType === 'fadeIn') {
                // Adjust fade in duration
                const fadeEndTime = time - this.draggedClip.position;
                this.draggedClip.fadeIn = Math.max(0, Math.min(this.draggedClip.duration / 2, fadeEndTime));
                this.render();
            } else if (this.fadeHandlesEnabled && this.dragType === 'fadeOut') {
                // Adjust fade out duration
                const fadeStartTime = (this.draggedClip.position + this.draggedClip.duration) - time;
                this.draggedClip.fadeOut = Math.max(0, Math.min(this.draggedClip.duration / 2, fadeStartTime));
                this.render();
            } else if (this.dragType === 'move') {
                // Calculate new position
                let newPosition = time - this.dragOffset.x;
                
                // Snap to grid if enabled
                if (this.snapToGrid) {
                    newPosition = this.snapTimeToGrid(newPosition);
                }
                
                // Prevent negative position
                newPosition = Math.max(0, newPosition);
                
                // Check if moving to different track
                if (trackIndex !== this.dragOffset.originalTrack) {
                    // Remove from original track
                    const originalTrack = this.tracks[this.dragOffset.originalTrack];
                    originalTrack.clips = originalTrack.clips.filter(c => c.id !== this.draggedClip.id);
                    
                    // Add to new track
                    const newTrack = this.tracks[trackIndex];
                    newTrack.clips.push(this.draggedClip);
                    
                    // Update drag offset
                    this.dragOffset.originalTrack = trackIndex;
                }
                
                // Update clip position
                this.draggedClip.position = newPosition;
                
                // Sort clips in track
                const track = this.tracks[trackIndex];
                track.clips.sort((a, b) => a.position - b.position);
                
                this.render();
            }
        } else {
            // Update cursor based on hover and edit mode
            const trackIndex = Math.floor(y / 80);
            if (trackIndex >= 0 && trackIndex < this.tracks.length) {
                const track = this.tracks[trackIndex];
                const time = ((x - headerWidth) + this.scrollX) / (this.pixelsPerSecond * this.zoomLevel);
                
                const clip = track.clips.find(c => 
                    time >= c.position && time <= c.position + c.duration
                );
                
                if (this.editMode === 'razor') {
                    this.canvas.style.cursor = 'crosshair';
                } else {
                    this.canvas.style.cursor = clip ? 'move' : 'default';
                }
            }
        }
    }

    handleMouseUp(e) {
        if (this.isDragging && this.draggedClip) {
            this.saveToHistory();
            
            // If playing, restart playback to apply changes
            if (this.isPlaying) {
                const currentPos = this.currentTime;
                this.stop();
                this.currentTime = currentPos;
                this.play();
            }
        }
        this.isDragging = false;
        this.draggedClip = null;
        this.dragType = null;
        this.canvas.style.cursor = 'default';
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    handleTimelineClick(e) {
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const headerWidth = 120;
        
        // Only respond to clicks in the timeline area (not the header)
        if (x > headerWidth) {
            const time = ((x - headerWidth) + this.scrollX) / (this.pixelsPerSecond * this.zoomLevel);
            this.setPlayheadPosition(time);
        }
    }
    
    handleDrop(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const headerWidth = 120;
        
        const trackIndex = Math.floor(y / 80);
        if (trackIndex < 0 || trackIndex >= this.tracks.length) return;
        
        const time = ((x - headerWidth) + this.scrollX) / (this.pixelsPerSecond * this.zoomLevel);
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type === 'library-item') {
                const libraryItem = this.audioLibrary.find(i => i.id === data.item.id);
                if (libraryItem) {
                    this.addClipToTrack(libraryItem, trackIndex, time);
                }
            }
        } catch (error) {
            console.error('Drop error:', error);
        }
    }

    handleKeyboard(e) {
        // Check if user is typing in an input field or textarea
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
        
        // If user is typing, only handle specific shortcuts with Ctrl/Cmd
        if (isTyping && !(e.ctrlKey || e.metaKey)) {
            return;
        }
        
        // Navigation with arrow keys
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const step = e.shiftKey ? this.fastStepSize : this.stepSize;
            this.movePlayhead(-step);
            return;
        }
        
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const step = e.shiftKey ? this.fastStepSize : this.stepSize;
            this.movePlayhead(step);
            return;
        }
        
        // Home/End keys
        if (e.key === 'Home') {
            e.preventDefault();
            this.goToStart();
            return;
        }
        
        if (e.key === 'End') {
            e.preventDefault();
            this.goToEnd();
            return;
        }
        
        // Playback control
        if (e.code === 'Space') {
            e.preventDefault();
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
            return;
        }
        
        // Recording
        if (e.key === 'r' || e.key === 'R') {
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.record();
                return;
            }
        }
        
        // Razor mode toggle
        if (e.key === 'b' || e.key === 'B') {
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.toggleRazorMode();
                return;
            }
        }
        
        // Split at playhead
        if (e.key === 's' || e.key === 'S') {
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.splitAtPlayhead();
                return;
            }
        }
        
        // In/Out points
        if (e.key === 'i' || e.key === 'I') {
            e.preventDefault();
            if (e.shiftKey) {
                this.goToInPoint();
            } else {
                this.setInPoint();
            }
            return;
        }
        
        if (e.key === 'o' || e.key === 'O') {
            e.preventDefault();
            if (e.shiftKey) {
                this.goToOutPoint();
            } else {
                this.setOutPoint();
            }
            return;
        }
        
        // Delete
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selection.clip) {
                e.preventDefault();
                this.deleteSelectedClips();
            }
            return;
        }
        
        // Zoom controls
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            this.zoomIn();
            return;
        }
        
        if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            this.zoomOut();
            return;
        }
        
        if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.zoomFit();
            return;
        }
        
        // Grid snap toggle
        if (e.key === 'g' || e.key === 'G') {
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.toggleSnap();
                return;
            }
        }
        
        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'z':
                    e.preventDefault();
                    this.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'x':
                    e.preventDefault();
                    this.cut();
                    break;
                case 'c':
                    e.preventDefault();
                    this.copy();
                    break;
                case 'v':
                    e.preventDefault();
                    this.paste();
                    break;
                case 'a':
                    e.preventDefault();
                    this.selectAll();
                    break;
                case 's':
                    e.preventDefault();
                    this.exportMix();
                    break;
            }
        }
        
        // Escape - clear selection
        if (e.key === 'Escape') {
            e.preventDefault();
            this.selection = { clip: null, track: -1 };
            this.selectedClip = null;
            this.render();
        }
        
        // Number keys for track selection/arming
        if (e.key >= '1' && e.key <= '4') {
            const trackIndex = parseInt(e.key) - 1;
            if (e.shiftKey) {
                // Arm track with Shift+number
                this.toggleTrackArm(trackIndex);
            } else if (e.altKey) {
                // Mute track with Alt+number
                this.toggleTrackMute(trackIndex);
            } else if (e.ctrlKey || e.metaKey) {
                // Solo track with Ctrl+number
                this.toggleTrackSolo(trackIndex);
            } else {
                // Select track
                this.activeTrack = trackIndex;
                this.render();
            }
        }
    }

    // Utility methods
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    selectClip(clip, trackIndex) {
        this.selection = {
            clip: clip,
            track: trackIndex
        };
        this.render();
    }

    deleteSelectedClips() {
        if (this.selection.clip && this.selection.track >= 0) {
            const track = this.tracks[this.selection.track];
            track.clips = track.clips.filter(c => c.id !== this.selection.clip.id);
            this.selection = { clip: null, track: -1 };
            this.render();
            this.saveToHistory();
        }
    }
    
    selectAll() {
        // Select all clips in the active track
        if (this.activeTrack >= 0 && this.activeTrack < this.tracks.length) {
            const track = this.tracks[this.activeTrack];
            if (track.clips.length > 0) {
                // For simplicity, select the first clip
                // In a more complete implementation, you might want to select all clips
                this.selection = {
                    clip: track.clips[0],
                    track: this.activeTrack
                };
                this.render();
                showNotification(`${track.clips.length} clip(s) sélectionné(s) sur la piste ${track.name}`, 'info');
            }
        }
    }

    showClipContextMenu(clip, x, y) {
        // Would show a context menu with clip options
        // For now, just log
        console.log('Clip context menu for:', clip);
    }

    // History management
    saveToHistory() {
        // Save current state for undo/redo
        if (!this.history) this.history = [];
        if (!this.historyIndex) this.historyIndex = -1;
        
        // Remove any states after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add new state
        this.history.push(JSON.stringify(this.tracks));
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.tracks = JSON.parse(this.history[this.historyIndex]);
            this.render();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.tracks = JSON.parse(this.history[this.historyIndex]);
            this.render();
        }
    }

    // Additional control methods
    zoomIn() {
        this.zoomLevel = Math.min(10, this.zoomLevel * 1.2);
        this.render();
    }

    zoomOut() {
        this.zoomLevel = Math.max(0.1, this.zoomLevel / 1.2);
        this.render();
    }

    zoomFit() {
        if (!this.canvas) return;
        const maxDuration = this.getMaxDuration();
        if (maxDuration > 0) {
            this.zoomLevel = this.canvas.width / (maxDuration * this.pixelsPerSecond);
            this.scrollX = 0;
            this.render();
        }
    }

    getMaxDuration() {
        let max = this.duration;
        this.tracks.forEach(track => {
            track.clips.forEach(clip => {
                max = Math.max(max, clip.position + clip.duration);
            });
        });
        return max;
    }
    
    getActualClipsDuration() {
        // Get the actual duration based only on clips, not the timeline duration
        let max = 0;
        this.tracks.forEach(track => {
            track.clips.forEach(clip => {
                const clipEnd = clip.position + clip.duration;
                if (clipEnd > max) {
                    max = clipEnd;
                }
            });
        });
        return max;
    }

    toggleSnap() {
        this.snapToGrid = !this.snapToGrid;
        showNotification(`Magnétisme ${this.snapToGrid ? 'activé' : 'désactivé'}`, 'info');
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.render();
    }
    
    // Edit mode controls
    setEditMode(mode) {
        this.editMode = mode;
        this.updateCursor();
        showNotification(`Mode ${mode === 'razor' ? 'Rasoir' : 'Normal'} activé`, 'info');
    }
    
    toggleRazorMode() {
        this.editMode = this.editMode === 'razor' ? 'normal' : 'razor';
        this.updateCursor();
        showNotification(`Mode ${this.editMode === 'razor' ? 'Rasoir' : 'Normal'} activé`, 'info');
    }
    
    toggleFadeHandles() {
        this.fadeHandlesEnabled = !this.fadeHandlesEnabled;
        showNotification(
            this.fadeHandlesEnabled ? 
            '🎚️ Poignées de fade activées' : 
            '🎚️ Poignées de fade désactivées', 
            'info'
        );
        this.render();
        
        // Update button appearance
        const btn = document.getElementById('fade-handles-btn');
        if (btn) {
            btn.style.background = this.fadeHandlesEnabled ? 
                'rgba(255,165,0,0.5)' : 'rgba(255,165,0,0.2)';
            btn.style.border = this.fadeHandlesEnabled ? 
                '2px solid orange' : '1px solid rgba(255,165,0,0.5)';
        }
        
        // Save preference
        localStorage.setItem('multitrack-fade-handles', this.fadeHandlesEnabled ? 'true' : 'false');
    }
    
    updateCursor() {
        if (this.canvas) {
            if (this.editMode === 'razor') {
                this.canvas.style.cursor = 'crosshair';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    updateScrollbar() {
        // Update the horizontal scrollbar position
        const scrollbar = document.getElementById('multitrack-scroll');
        if (scrollbar) {
            const totalWidth = this.duration * this.pixelsPerSecond * this.zoomLevel;
            const visibleWidth = this.canvas.width - 120;
            const scrollPercent = (this.scrollX / (totalWidth - visibleWidth)) * 100;
            scrollbar.value = Math.max(0, Math.min(100, scrollPercent));
        }
    }
    
    // Split a clip at a specific time
    splitClip(clip, track, splitTime) {
        const clipStart = clip.position;
        const clipEnd = clip.position + clip.duration;
        
        // Only split if the time is within the clip
        if (splitTime <= clipStart || splitTime >= clipEnd) {
            return false;
        }
        
        // Create two new clips from the original
        const firstClip = JSON.parse(JSON.stringify(clip));
        const secondClip = JSON.parse(JSON.stringify(clip));
        
        // Update first clip
        firstClip.duration = splitTime - clipStart;
        firstClip.trimEnd = firstClip.trimStart + firstClip.duration;
        
        // Update second clip
        secondClip.id = Date.now() + Math.random();
        secondClip.position = splitTime;
        secondClip.duration = clipEnd - splitTime;
        secondClip.trimStart = firstClip.trimEnd;
        secondClip.trimEnd = clip.trimEnd;
        
        // Replace the original clip with the two new ones
        const clipIndex = track.clips.findIndex(c => c.id === clip.id);
        if (clipIndex !== -1) {
            track.clips.splice(clipIndex, 1, firstClip, secondClip);
            track.clips.sort((a, b) => a.position - b.position);
            return true;
        }
        
        return false;
    }
    
    // Split all clips at current playhead position
    splitAtPlayhead() {
        let splitCount = 0;
        
        this.tracks.forEach(track => {
            // Find clips that contain the current time
            const clipsToSplit = track.clips.filter(clip => {
                const clipStart = clip.position;
                const clipEnd = clip.position + clip.duration;
                return this.currentTime > clipStart && this.currentTime < clipEnd;
            });
            
            clipsToSplit.forEach(clip => {
                if (this.splitClip(clip, track, this.currentTime)) {
                    splitCount++;
                }
            });
        });
        
        if (splitCount > 0) {
            this.render();
            this.saveToHistory();
            showNotification(`${splitCount} clip(s) divisé(s)`, 'success');
        }
    }

    setScroll(value) {
        const maxScroll = Math.max(0, this.getMaxDuration() * this.pixelsPerSecond * this.zoomLevel - this.canvas.width);
        this.scrollX = (value / 100) * maxScroll;
        this.render();
    }

    cut() {
        // If In/Out points are defined, cut only within that range
        if (this.inPoint !== null && this.outPoint !== null) {
            this.cutInOutRange();
        } else if (this.selection.clip) {
            // Otherwise, cut the selected clip
            this.clipboard = JSON.parse(JSON.stringify(this.selection.clip));
            this.deleteSelectedClips();
        }
    }
    
    cutInOutRange() {
        if (this.inPoint === null || this.outPoint === null) return;
        
        const startTime = Math.min(this.inPoint, this.outPoint);
        const endTime = Math.max(this.inPoint, this.outPoint);
        const clipsToRemove = [];
        const clipsToAdd = [];
        
        // Process each track
        this.tracks.forEach((track, trackIndex) => {
            const newClips = [];
            
            track.clips.forEach(clip => {
                const clipStart = clip.position;
                const clipEnd = clip.position + clip.duration;
                
                // Clip is completely outside the range - keep it
                if (clipEnd <= startTime || clipStart >= endTime) {
                    newClips.push(clip);
                }
                // Clip is completely inside the range - remove it
                else if (clipStart >= startTime && clipEnd <= endTime) {
                    // Don't add to newClips (effectively removing it)
                }
                // Clip extends before and after the range - split it
                else if (clipStart < startTime && clipEnd > endTime) {
                    // Keep the part before
                    const beforeClip = JSON.parse(JSON.stringify(clip));
                    beforeClip.duration = startTime - clipStart;
                    beforeClip.trimEnd = beforeClip.trimStart + beforeClip.duration;
                    newClips.push(beforeClip);
                    
                    // Keep the part after
                    const afterClip = JSON.parse(JSON.stringify(clip));
                    afterClip.id = Date.now() + Math.random();
                    afterClip.position = endTime;
                    afterClip.duration = clipEnd - endTime;
                    afterClip.trimStart = afterClip.trimStart + (endTime - clipStart);
                    newClips.push(afterClip);
                }
                // Clip starts before and ends in range - trim end
                else if (clipStart < startTime && clipEnd <= endTime) {
                    const trimmedClip = JSON.parse(JSON.stringify(clip));
                    trimmedClip.duration = startTime - clipStart;
                    trimmedClip.trimEnd = trimmedClip.trimStart + trimmedClip.duration;
                    newClips.push(trimmedClip);
                }
                // Clip starts in range and ends after - trim start
                else if (clipStart >= startTime && clipEnd > endTime) {
                    const trimmedClip = JSON.parse(JSON.stringify(clip));
                    trimmedClip.position = endTime;
                    trimmedClip.duration = clipEnd - endTime;
                    trimmedClip.trimStart = trimmedClip.trimStart + (endTime - clipStart);
                    newClips.push(trimmedClip);
                }
            });
            
            // Update track clips
            track.clips = newClips;
        });
        
        // Shift all clips after the cut point to the left
        const cutDuration = endTime - startTime;
        this.tracks.forEach(track => {
            track.clips.forEach(clip => {
                if (clip.position >= endTime) {
                    clip.position -= cutDuration;
                }
            });
        });
        
        this.render();
        this.saveToHistory();
        showNotification(`Supprimé ${this.formatTime(cutDuration)} de contenu`, 'success');
    }

    copy() {
        // Copy selected clips
        if (this.selection.clip) {
            this.clipboard = JSON.parse(JSON.stringify(this.selection.clip));
            showNotification('Clip copié', 'success');
        }
    }

    paste() {
        // Paste clipboard content
        if (this.clipboard && this.activeTrack >= 0) {
            const newClip = JSON.parse(JSON.stringify(this.clipboard));
            newClip.id = Date.now();
            newClip.position = this.currentTime;
            
            const track = this.tracks[this.activeTrack];
            track.clips.push(newClip);
            track.clips.sort((a, b) => a.position - b.position);
            
            this.render();
            this.saveToHistory();
            showNotification('Clip collé', 'success');
        }
    }

    async record() {
        // Find the first armed track
        const armedTrack = this.tracks.find(track => track.armed);
        if (!armedTrack) {
            showNotification('Veuillez armer une piste pour l\'enregistrement', 'warning');
            return;
        }
        
        if (this.isRecording) {
            // Stop recording
            this.stopRecording();
        } else {
            // Start recording
            await this.startRecording(armedTrack);
        }
    }
    
    async startRecording(track) {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream);
            this.recordingChunks = [];
            this.recordingStartTime = this.currentTime;
            this.recordingTrack = track.id;
            this.recordingStartTimeReal = performance.now();
            
            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordingChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                // Create blob from chunks
                const blob = new Blob(this.recordingChunks, { type: 'audio/webm' });
                
                // Convert to audio buffer
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                // Create a library item
                const libraryItem = {
                    id: Date.now(),
                    name: `Enregistrement ${new Date().toLocaleTimeString()}`,
                    buffer: audioBuffer,
                    duration: audioBuffer.duration,
                    type: 'voice',
                    waveformData: this.generateWaveformData(audioBuffer)
                };
                
                // Add to library
                this.audioLibrary.push(libraryItem);
                this.renderLibrary();
                
                // Add clip to the armed track at recording position
                const recordTrack = this.tracks.find(t => t.id === this.recordingTrack);
                if (recordTrack) {
                    this.addClipToTrack(libraryItem, this.recordingTrack, this.recordingStartTime);
                }
                
                // Clean up
                stream.getTracks().forEach(track => track.stop());
                this.recordingChunks = [];
                this.isRecording = false;
                this.recordingTrack = -1;
                
                // Update UI
                this.updateRecordButton();
                showNotification('Enregistrement terminé', 'success');
            };
            
            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // Update UI
            this.updateRecordButton();
            showNotification('Enregistrement en cours...', 'info');
            
            // Start VU meter for monitoring
            this.startRecordingMonitor(stream);
            
        } catch (error) {
            console.error('Error starting recording:', error);
            showNotification('Erreur lors du démarrage de l\'enregistrement', 'error');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.stopRecordingMonitor();
            this.stopRecordingAnimation();
        }
    }
    
    startRecordingMonitor(stream) {
        // Create audio source from stream for monitoring
        const source = this.audioContext.createMediaStreamSource(stream);
        
        // Create analyser for recording monitor
        this.recordingAnalyser = this.audioContext.createAnalyser();
        this.recordingAnalyser.fftSize = 2048;
        
        // Connect source to analyser (but not to destination to avoid feedback)
        source.connect(this.recordingAnalyser);
        
        // Store source for cleanup
        this.recordingSource = source;
        
        // Start monitoring animation
        this.startRecordingVUMeter();
    }
    
    stopRecordingMonitor() {
        if (this.recordingSource) {
            this.recordingSource.disconnect();
            this.recordingSource = null;
        }
        if (this.recordingAnalyser) {
            this.recordingAnalyser.disconnect();
            this.recordingAnalyser = null;
        }
    }
    
    startRecordingVUMeter() {
        // Cancel any existing animation
        if (this.recordingAnimation) {
            cancelAnimationFrame(this.recordingAnimation);
        }
        
        const animate = () => {
            if (!this.isRecording) {
                this.recordingAnimation = null;
                return;
            }
            
            // Update current time based on recording duration
            const elapsed = (performance.now() - this.recordingStartTimeReal) / 1000;
            this.currentTime = this.recordingStartTime + elapsed;
            
            // Auto-scroll if playhead goes off screen
            const headerWidth = 120;
            const playheadX = this.currentTime * this.pixelsPerSecond * this.zoomLevel;
            const visibleRight = this.scrollX + this.canvas.width - headerWidth;
            
            if (playheadX > visibleRight) {
                this.scrollX = playheadX - (this.canvas.width - headerWidth) + 100;
                this.updateScrollbar();
            }
            
            // Draw recording indicator on the armed track
            this.render();
            this.recordingAnimation = requestAnimationFrame(animate);
        };
        animate();
    }
    
    updateRecordButton() {
        const recordBtn = document.querySelector('[onclick*="multitrackEditor.record"]');
        if (recordBtn) {
            if (this.isRecording) {
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
                recordBtn.title = 'Arrêter l\'enregistrement';
            } else {
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<i class="fas fa-circle"></i>';
                recordBtn.title = 'Enregistrer';
            }
        }
    }
    
    // Track control methods
    toggleTrackArm(trackIndex) {
        if (trackIndex < 0 || trackIndex >= this.tracks.length) return;
        
        // Disarm all other tracks first (only one track can be armed at a time)
        this.tracks.forEach((track, index) => {
            if (index !== trackIndex) {
                track.armed = false;
            }
        });
        
        // Toggle the selected track
        this.tracks[trackIndex].armed = !this.tracks[trackIndex].armed;
        
        this.render();
        this.updateTrackControls();
        
        if (this.tracks[trackIndex].armed) {
            showNotification(`Piste "${this.tracks[trackIndex].name}" armée pour l'enregistrement`, 'info');
        }
    }
    
    toggleTrackMute(trackIndex) {
        if (trackIndex < 0 || trackIndex >= this.tracks.length) return;
        
        this.tracks[trackIndex].muted = !this.tracks[trackIndex].muted;
        
        // If playing, restart playback to apply mute changes
        if (this.isPlaying) {
            const currentPos = this.currentTime;
            this.stop();
            this.currentTime = currentPos;
            this.play();
        }
        
        this.render();
        this.updateTrackControls();
        
        const track = this.tracks[trackIndex];
        showNotification(`Piste "${track.name}" ${track.muted ? 'mutée' : 'démutée'}`, 'info');
    }
    
    toggleTrackSolo(trackIndex) {
        if (trackIndex < 0 || trackIndex >= this.tracks.length) return;
        
        this.tracks[trackIndex].solo = !this.tracks[trackIndex].solo;
        
        // If soloing, unsolo all other tracks
        if (this.tracks[trackIndex].solo) {
            this.tracks.forEach((track, index) => {
                if (index !== trackIndex) {
                    track.solo = false;
                }
            });
        }
        
        // If playing, restart playback to apply solo changes
        if (this.isPlaying) {
            const currentPos = this.currentTime;
            this.stop();
            this.currentTime = currentPos;
            this.play();
        }
        
        this.render();
        this.updateTrackControls();
        
        const track = this.tracks[trackIndex];
        showNotification(`Piste "${track.name}" ${track.solo ? 'en solo' : 'solo désactivé'}`, 'info');
    }
    
    setTrackVolume(trackIndex, volume) {
        if (trackIndex < 0 || trackIndex >= this.tracks.length) return;
        
        this.tracks[trackIndex].volume = Math.max(0, Math.min(1, volume));
        this.tracks[trackIndex].gainNode.gain.value = this.tracks[trackIndex].volume;
        
        this.updateTrackControls();
    }
    
    updateTrackControls() {
        // Update track control UI elements
        // This would update the HTML controls for mute, solo, arm buttons
        // Implementation depends on HTML structure
    }

    handleFileSelect(event) {
        const files = event.target.files;
        if (files.length > 0) {
            Array.from(files).forEach(file => {
                this.addToLibrary(file);
            });
        }
    }

    // Export functionality
    async exportMix() {
        // Mix all tracks to a single audio file
        showNotification('Export du mixage en cours...', 'info');
        
        try {
            // Calculate actual duration of clips only
            const duration = this.getActualClipsDuration();
            
            // Create offline context for rendering
            const offlineCtx = new OfflineAudioContext(2, duration * 44100, 44100);
            
            // Create master gain
            const masterGain = offlineCtx.createGain();
            masterGain.connect(offlineCtx.destination);
            
            // Schedule all clips
            this.tracks.forEach(track => {
                if (track.muted) return;
                
                const trackGain = offlineCtx.createGain();
                trackGain.gain.value = track.volume;
                trackGain.connect(masterGain);
                
                track.clips.forEach(clip => {
                    const libraryItem = this.audioLibrary.find(item => item.id === clip.libraryId);
                    if (!libraryItem) return;
                    
                    const source = offlineCtx.createBufferSource();
                    source.buffer = libraryItem.buffer;
                    
                    const clipGain = offlineCtx.createGain();
                    clipGain.gain.value = clip.gain;
                    
                    // Apply fades
                    if (clip.fadeIn > 0) {
                        clipGain.gain.setValueAtTime(0, clip.position);
                        clipGain.gain.linearRampToValueAtTime(clip.gain, clip.position + clip.fadeIn);
                    }
                    if (clip.fadeOut > 0) {
                        const fadeStart = clip.position + clip.duration - clip.fadeOut;
                        clipGain.gain.setValueAtTime(clip.gain, fadeStart);
                        clipGain.gain.linearRampToValueAtTime(0, clip.position + clip.duration);
                    }
                    
                    source.connect(clipGain);
                    clipGain.connect(trackGain);
                    
                    source.start(clip.position, clip.trimStart, clip.trimEnd - clip.trimStart);
                });
            });
            
            // Render
            const renderedBuffer = await offlineCtx.startRendering();
            
            // Convert to WAV
            const wav = this.audioBufferToWav(renderedBuffer);
            const blob = new Blob([wav], { type: 'audio/wav' });
            
            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mixage_${new Date().toISOString().slice(0, 10)}.wav`;
            a.click();
            
            showNotification('Mixage exporté avec succès', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showNotification('Erreur lors de l\'export', 'error');
        }
    }

    audioBufferToWav(buffer) {
        const length = buffer.length * buffer.numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;

        // Write WAVE header
        const setUint16 = (data) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        const setUint32 = (data) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        // RIFF identifier
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        // fmt sub-chunk
        setUint32(0x20746d66); // "fmt "
        setUint32(16); // size
        setUint16(1); // PCM
        setUint16(buffer.numberOfChannels);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels); // avg bytes/sec
        setUint16(buffer.numberOfChannels * 2); // block align
        setUint16(16); // bits per sample

        // data sub-chunk
        setUint32(0x61746164); // "data"
        setUint32(length - pos - 4); // chunk size

        // Write interleaved data
        const volume = 1;
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                let sample = channels[i][offset] * volume;
                sample = Math.max(-1, Math.min(1, sample));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return arrayBuffer;
    }

    // News integration methods
    async linkToNews(newsId, title, duration, text, existingAudioData = null) {
        console.log('Linking to news:', { newsId, title, duration, text: text?.substring(0, 50), hasExistingAudio: !!existingAudioData });
        
        this.linkedNewsId = newsId;
        this.targetDuration = this.parseDuration(duration);
        this.newsText = text || '';
        
        // Update the duration to show target with more buffer
        this.duration = Math.max(this.targetDuration * 1.5, 120); // Add 50% buffer or min 2 minutes
        
        // Clear existing content for new project
        this.tracks.forEach(track => {
            track.clips = [];
        });
        this.audioLibrary = [];
        this.currentTime = 0;
        this.inPoint = null;
        this.outPoint = null;
        
        // Clear the library display first
        this.renderLibrary();
        
        // Load existing audio if available
        if (existingAudioData) {
            try {
                console.log('Loading existing audio from news...');
                
                // Convert base64 to blob if needed
                let audioBlob;
                if (typeof existingAudioData === 'string' && existingAudioData.startsWith('data:')) {
                    // It's a base64 data URL
                    const response = await fetch(existingAudioData);
                    audioBlob = await response.blob();
                } else if (existingAudioData instanceof Blob) {
                    audioBlob = existingAudioData;
                } else {
                    console.warn('Unknown audio data format:', typeof existingAudioData);
                }
                
                if (audioBlob) {
                    // Create a file object from the blob
                    const file = new File([audioBlob], `${title || 'news'}_audio.wav`, { type: 'audio/wav' });
                    
                    // Add to library
                    const libraryItem = await this.addToLibrary(file);
                    
                    // Add as a clip to the first track (Commentaire)
                    if (libraryItem && this.tracks[0]) {
                        this.addClipToTrack(libraryItem, 0, 0);
                        console.log('Loaded existing audio as clip in track 0');
                    }
                }
            } catch (error) {
                console.error('Error loading existing audio:', error);
                showNotification('Erreur lors du chargement de l\'audio existant', 'warning');
            }
        }
        
        // Set track names for journalism workflow
        if (this.tracks[0]) this.tracks[0].name = "Commentaire";
        if (this.tracks[1]) this.tracks[1].name = "Interview";
        if (this.tracks[2]) this.tracks[2].name = "Ambiance";
        if (this.tracks[3]) this.tracks[3].name = "Musique";
        
        // Set a default zoom out to see the target duration
        // We want to see about 90-120 seconds on screen for a 1:10 target
        const desiredViewDuration = Math.max(90, this.targetDuration * 1.5);
        
        // Use the actual canvas width if available, otherwise estimate
        const headerWidth = 120;
        const canvasWidth = this.canvas ? this.canvas.width - headerWidth : 900;  // Subtract header width
        const availableWidth = canvasWidth;
        
        // Calculate pixels per second to fit desired duration
        const targetPixelsPerSecond = availableWidth / desiredViewDuration;
        
        // Set pixels per second directly based on target
        this.pixelsPerSecond = targetPixelsPerSecond;
        // Calculate zoom level (inverse relationship - lower zoom = more zoomed out)
        this.zoomLevel = targetPixelsPerSecond / 100;  // Assuming base is 100 pps at zoom 1
        
        console.log(`Zoom set for news: targetDuration=${this.targetDuration}s, desiredView=${desiredViewDuration}s, zoom=${this.zoomLevel}, pps=${this.pixelsPerSecond}`);
        
        // Update news text editor first
        this.updateNewsTextEditor();
        
        // Force resize and render after DOM updates
        setTimeout(() => {
            this.resizeCanvas();
            this.render();
            this.drawTimeline();
            console.log('Rendered multitrack for news');
        }, 100);
        
        showNotification(`Projet lié à la news: ${title} (Durée cible: ${duration})`, 'info');
    }
    
    parseDuration(durationStr) {
        // Parse duration string like "1:10" to seconds
        if (!durationStr) return 60;
        
        const parts = durationStr.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            return minutes * 60 + seconds;
        }
        return parseInt(durationStr) || 60;
    }
    
    updateNewsTextEditor() {
        const textEditor = document.getElementById('multitrack-news-text');
        const editorPanel = document.getElementById('multitrack-news-editor');
        const container = document.querySelector('.multitrack-container');
        
        if (textEditor) {
            textEditor.value = this.newsText;
        }
        
        // Add/remove classes based on whether we have a linked news
        if (container) {
            if (this.linkedNewsId) {
                container.classList.add('from-news');
                if (editorPanel) {
                    editorPanel.classList.add('active');
                    
                    // Apply saved split position
                    const savedSplit = localStorage.getItem('multitrack-split-position');
                    if (savedSplit) {
                        editorPanel.style.height = savedSplit + '%';
                    } else {
                        editorPanel.style.height = '30%'; // Default
                    }
                }
            } else {
                container.classList.remove('from-news');
                if (editorPanel) {
                    editorPanel.classList.remove('active');
                }
            }
            // Resize canvas after DOM updates
            setTimeout(() => this.resizeCanvas(), 100);
        }
    }
    
    extractCorpsFromText(text) {
        // Extraire uniquement le corps du texte (sans lancement ni désannonce)
        if (!text) return text;
        
        // Retirer le lancement
        const lancementPattern = /\[LANCEMENT\][\s\S]*?\[\/LANCEMENT\]/gi;
        text = text.replace(lancementPattern, '');
        
        // Retirer la désannonce
        const desannoncePattern = /\[DESANNONCE\][\s\S]*?\[\/DESANNONCE\]/gi;
        text = text.replace(desannoncePattern, '');
        
        return text.trim();
    }
    
    saveNewsText() {
        const textEditor = document.getElementById('multitrack-news-text');
        if (textEditor) {
            this.newsText = textEditor.value;
            
            // Save back to news if linked
            if (this.linkedNewsId && window.app && window.app.newsManager) {
                // Get the news from the manager
                const database = window.app.newsManager.getDatabase();
                const newsItem = database.find(n => n.id === this.linkedNewsId);
                
                if (newsItem) {
                    // Update the content field
                    newsItem.content = this.newsText;
                    
                    // Save through the manager to ensure proper persistence
                    window.app.newsManager.setDatabase(database);
                    
                    // Also update if it's the current item
                    if (window.app.newsManager.currentId === this.linkedNewsId) {
                        const newsContentElement = document.getElementById('news-content');
                        if (newsContentElement) {
                            newsContentElement.value = this.newsText;
                        }
                    }
                    
                    showNotification('Texte de la news sauvegardé', 'success');
                } else {
                    console.error('News item not found:', this.linkedNewsId);
                }
            }
        }
    }
    
    async exportToNews() {
        if (!this.linkedNewsId) {
            showNotification('Aucune news liée à ce projet', 'warning');
            return;
        }
        
        try {
            // First save the text
            this.saveNewsText();
            
            // Export the audio mix
            const audioBlob = await this.exportMixToBlob();
            
            if (!audioBlob) {
                showNotification('Aucun audio à exporter. Ajoutez des clips audio d\'abord.', 'warning');
                return;
            }
            
            // Save audio to news through the manager
            if (window.app && window.app.newsManager) {
                const database = window.app.newsManager.getDatabase();
                const newsItem = database.find(n => n.id === this.linkedNewsId);
                
                if (newsItem) {
                    // Calculate duration
                    const actualDuration = this.getActualClipsDuration();
                    let durationStr = '0:00';
                    if (actualDuration > 0) {
                        const minutes = Math.floor(actualDuration / 60);
                        const seconds = Math.floor(actualDuration % 60);
                        durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    }
                    
                    // Upload mix to S3 instead of storing as base64
                    showNotification('Upload du mix en cours...', 'info');
                    
                    // Create a File object from the blob
                    const file = new File([audioBlob], `mix-multipiste-${Date.now()}.mp3`, { type: 'audio/mp3' });
                    
                    // Use AudioManager to upload
                    if (window.app && window.app.audioManager) {
                        window.app.audioManager.handleFileUpload(file).then(audioData => {
                            if (audioData) {
                                // Update news content
                                newsItem.content = this.newsText;
                                newsItem.hasAudio = true;
                                newsItem.lastModified = new Date().toISOString();
                                newsItem.actualDuration = durationStr;
                                
                                // IMPORTANT: Replace sounds array with the mix
                                // This is what Morgane wants - the mix replaces individual sounds
                                newsItem.sounds = [{
                                    id: `mix-${Date.now()}`,
                                    name: 'Montage multipiste',
                                    type: 'audio',
                                    duration: durationStr,
                                    audioFileId: audioData.audioFileId,
                                    url: audioData.url,
                                    fileName: `Mix multipiste - ${new Date().toLocaleDateString()}`
                                }];
                                
                                // Clear old audioData field (we now use sounds)
                                delete newsItem.audioData;
                                
                                // Save through the manager
                                window.app.newsManager.setDatabase(database);
                                
                                console.log('Mix successfully saved to news:', {
                                    newsId: this.linkedNewsId,
                                    soundAdded: newsItem.sounds[0],
                                    hasAudio: newsItem.hasAudio,
                                    actualDuration: newsItem.actualDuration
                                });
                                
                                showNotification('Mix exporté et ajouté à la news avec succès', 'success');
                                
                                // Return to news section
                                if (window.app && window.app.switchTab) {
                                    window.app.switchTab('news');
                                    
                                    // Reload the news to show the updated content and audio
                                    if (window.app.newsManager.currentId === this.linkedNewsId) {
                                        window.app.newsManager.load(this.linkedNewsId);
                                        // Force re-render of the sounds panel
                                        window.app.newsManager.renderSounds();
                                    }
                                }
                            } else {
                                showNotification('Erreur lors de l\'upload du mix', 'error');
                            }
                        }).catch(error => {
                            console.error('Upload mix error:', error);
                            showNotification('Erreur lors de l\'upload du mix', 'error');
                        });
                    } else {
                        showNotification('AudioManager non disponible', 'error');
                    }
                } else {
                    showNotification('News non trouvée', 'error');
                }
            }
        } catch (error) {
            console.error('Export to news error:', error);
            showNotification('Erreur lors de l\'export vers la news', 'error');
        }
    }
    
    async exportMixToBlob() {
        // Calculate actual duration of clips only (not timeline duration)
        const duration = this.getActualClipsDuration();
        
        if (duration === 0) {
            console.warn('No audio to export, duration is 0');
            return null;
        }
        
        // Debug: Check audio library state
        console.log('Audio library state:', {
            count: this.audioLibrary.length,
            items: this.audioLibrary.map(item => ({
                id: item.id,
                name: item.name,
                hasBuffer: !!item.buffer,
                duration: item.duration
            }))
        });
        
        // Log actual duration calculation
        console.log('Duration calculation:', {
            actualClipsDuration: duration,
            timelineDuration: this.duration,
            maxDuration: this.getMaxDuration()
        });
        
        console.log(`Exporting mix: duration=${duration}s, clips in tracks:`, 
            this.tracks.map(t => `${t.name}: ${t.clips.length} clips`));
        
        // Create offline context for rendering  
        const sampleRate = 44100;
        const numberOfChannels = 2;
        const length = Math.ceil(duration * sampleRate);
        
        const offlineCtx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
        
        // Create master gain
        const masterGain = offlineCtx.createGain();
        masterGain.connect(offlineCtx.destination);
        
        // Determine if any track is soloed
        const hasSoloedTrack = this.tracks.some(t => t.solo);
        
        let clipsScheduled = 0;
        
        // Schedule all clips
        this.tracks.forEach((track, trackIndex) => {
            // Skip muted tracks or non-soloed tracks when solo is active
            if (track.muted || (hasSoloedTrack && !track.solo)) {
                console.log(`Skipping track ${track.name}: muted=${track.muted}, solo=${track.solo}`);
                return;
            }
            
            const trackGain = offlineCtx.createGain();
            trackGain.gain.value = track.volume;
            trackGain.connect(masterGain);
            
            console.log(`Processing track ${track.name} with ${track.clips.length} clips`);
            
            track.clips.forEach(clip => {
                console.log(`Looking for library item with id ${clip.libraryId} for clip ${clip.name}`);
                const libraryItem = this.audioLibrary.find(item => item.id === clip.libraryId);
                if (!libraryItem || !libraryItem.buffer) {
                    console.warn(`Library item not found or missing buffer for clip in track ${track.name}:`, {
                        clipId: clip.id,
                        clipName: clip.name,
                        libraryId: clip.libraryId,
                        libraryFound: !!libraryItem,
                        hasBuffer: libraryItem ? !!libraryItem.buffer : false
                    });
                    return;
                }
                
                try {
                    const source = offlineCtx.createBufferSource();
                    source.buffer = libraryItem.buffer;
                    
                    const clipGain = offlineCtx.createGain();
                    clipGain.gain.value = clip.gain || 1.0;
                    
                    // Apply fades if present
                    if (clip.fadeIn > 0) {
                        clipGain.gain.setValueAtTime(0, clip.position);
                        clipGain.gain.linearRampToValueAtTime(clip.gain || 1.0, clip.position + clip.fadeIn);
                    }
                    if (clip.fadeOut > 0) {
                        const fadeStart = clip.position + clip.duration - clip.fadeOut;
                        clipGain.gain.setValueAtTime(clip.gain || 1.0, fadeStart);
                        clipGain.gain.linearRampToValueAtTime(0, clip.position + clip.duration);
                    }
                    
                    source.connect(clipGain);
                    clipGain.connect(trackGain);
                    
                    // Calculate actual trim values
                    const trimStart = clip.trimStart || 0;
                    const trimEnd = clip.trimEnd || clip.duration;
                    const clipDuration = trimEnd - trimStart;
                    
                    console.log(`Scheduling clip: position=${clip.position}, trimStart=${trimStart}, duration=${clipDuration}`);
                    source.start(clip.position, trimStart, clipDuration);
                    
                    clipsScheduled++;
                } catch (error) {
                    console.error('Error scheduling clip:', error);
                }
            });
        });
        
        if (clipsScheduled === 0) {
            console.warn('No clips were scheduled for export');
            return null;
        }
        
        console.log(`Scheduled ${clipsScheduled} clips for rendering`);
        
        // Render
        const renderedBuffer = await offlineCtx.startRendering();
        console.log(`Rendered audio buffer: duration=${renderedBuffer.duration}s, sampleRate=${renderedBuffer.sampleRate}`);
        
        // Convert to WAV blob
        const wav = this.audioBufferToWav(renderedBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        console.log(`Created WAV blob: size=${blob.size} bytes`);
        
        return blob;
    }
    
    audioBufferToWav(buffer) {
        const length = buffer.length * buffer.numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;
        
        // Write WAV header
        const setUint16 = (data) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        const setUint32 = (data) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };
        
        // RIFF identifier
        setUint32(0x46464952);
        // file length
        setUint32(length - 8);
        // RIFF type
        setUint32(0x45564157);
        // format chunk identifier
        setUint32(0x20746d66);
        // format chunk length
        setUint32(16);
        // sample format (raw)
        setUint16(1);
        // channel count
        setUint16(buffer.numberOfChannels);
        // sample rate
        setUint32(buffer.sampleRate);
        // byte rate (sample rate * block align)
        setUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
        // block align (channel count * bytes per sample)
        setUint16(buffer.numberOfChannels * 2);
        // bits per sample
        setUint16(16);
        // data chunk identifier
        setUint32(0x61746164);
        // data chunk length
        setUint32(length - pos - 4);
        
        // Write interleaved data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                const sample = Math.max(-1, Math.min(1, channels[i][offset]));
                view.setInt16(pos, sample * 0x7FFF, true);
                pos += 2;
            }
            offset++;
        }
        
        return arrayBuffer;
    }
    
    cleanup() {
        this.stop();
        this.stopPlaybackAnimation();
        this.stopRecordingAnimation();
        this.stopVUMeter();
        
        if (this.analyser) {
            this.analyser.disconnect();
        }
        if (this.masterGainNode) {
            this.masterGainNode.disconnect();
        }
    }
}

// Export to global scope
window.MultitrackEditor = MultitrackEditor;