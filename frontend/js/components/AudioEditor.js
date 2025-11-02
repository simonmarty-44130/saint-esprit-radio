// Audio Editor Component
class AudioEditor {
    constructor() {
        this.audioContext = null;
        this.currentBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.isRecording = false;
        this.currentTime = 0;
        this.playStartTime = 0;
        this.selection = { start: 0, end: 0 };
        this.inPoint = null;
        this.outPoint = null;
        this.zoomLevel = 100; // pixels per second
        this.history = [];
        this.historyIndex = -1;
        this.clipboard = null;
        
        // Volume envelope system
        this.volumePoints = []; // Array of {time: number, volume: number}
        this.isEditingVolume = false;
        this.selectedVolumePoint = null;
        
        // Navigation
        this.stepSize = 0.1; // seconds for arrow key navigation
        this.fastStepSize = 1.0; // seconds for shift+arrow navigation
        
        // Canvas elements
        this.canvas = null;
        this.ctx = null;
        this.waveformContainer = null;
        
        // Recording
        this.mediaRecorder = null;
        this.recordedChunks = [];
        
        // Mouse state
        this.isSelecting = false;
        this.isDraggingVolumePoint = false;
        
        // VU Meter for real-time playback
        this.analyser = null;
        this.vuMeterAnimation = null;
        this.vuMeterPeakLeft = 0;
        this.vuMeterPeakRight = 0;
        this.vuMeterPeakHoldLeft = 0;
        this.vuMeterPeakHoldRight = 0;
        this.vuMeterPeakHoldCounter = 0;
    }

    async init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.canvas = document.getElementById('waveform-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.waveformContainer = document.getElementById('audio-waveform');
        
        // Create gain node for volume automation
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        
        // Create analyser for VU meter
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.gainNode.connect(this.analyser);
        
        // Initialize VU meter canvas
        this.initializeVUMeter();
        
        this.setupEventListeners();
        this.loadAudioLibrary();
        this.initializeVolumeEnvelope();
    }
    
    initializeVUMeter() {
        // VU meter will be drawn directly on the main canvas
        // No need for a separate container
        this.vuMeterHeight = 40; // Height of the VU meter area
    }

    initializeVolumeEnvelope() {
        // Initialize with default volume points
        this.volumePoints = [
            { time: 0, volume: 1.0 },
            { time: 1, volume: 1.0 }
        ];
    }

    setupEventListeners() {
        // Mouse events for selection and volume editing
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent context menu
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const audioEditorSection = document.getElementById('audio-editor-section');
            if (audioEditorSection && audioEditorSection.classList.contains('active')) {
                this.handleKeyboard(e);
                // Update cursor when Ctrl is pressed
                if ((e.key === 'Control' || e.key === 'Meta') && this.isEditingVolume) {
                    const rect = this.canvas.getBoundingClientRect();
                    const mouseEvent = new MouseEvent('mousemove', {
                        clientX: e.clientX || rect.left,
                        clientY: e.clientY || rect.top,
                        ctrlKey: e.ctrlKey,
                        metaKey: e.metaKey
                    });
                    this.handleMouseMove(mouseEvent);
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            const audioEditorSection = document.getElementById('audio-editor-section');
            if (audioEditorSection && audioEditorSection.classList.contains('active')) {
                // Update cursor when Ctrl is released
                if ((e.key === 'Control' || e.key === 'Meta') && this.isEditingVolume) {
                    const rect = this.canvas.getBoundingClientRect();
                    const mouseEvent = new MouseEvent('mousemove', {
                        clientX: e.clientX || rect.left,
                        clientY: e.clientY || rect.top,
                        ctrlKey: false,
                        metaKey: false
                    });
                    this.handleMouseMove(mouseEvent);
                }
            }
        });
    }

    addVolumeEnvelopeControls() {
        // This method is no longer needed as the buttons are now in the HTML
        // The envelope toggle functionality is handled by toggleEnvelope()
    }

    toggleEnvelope() {
        this.isEditingVolume = !this.isEditingVolume;
        const btn = document.getElementById('envelope-toggle');
        const panel = document.getElementById('envelope-panel');
        
        if (btn) {
            btn.classList.toggle('active', this.isEditingVolume);
            btn.style.backgroundColor = this.isEditingVolume ? '#555' : '';
        }
        
        if (panel) {
            panel.style.display = this.isEditingVolume ? 'block' : 'none';
        }
        
        this.drawWaveform();
        showNotification(
            this.isEditingVolume ? 'Volume envelope editing enabled' : 'Volume envelope editing disabled',
            'info'
        );
    }

    resetEnvelope() {
        this.volumePoints = [
            { time: 0, volume: 1.0 },
            { time: this.currentBuffer ? this.currentBuffer.duration : 1, volume: 1.0 }
        ];
        this.drawWaveform();
        this.saveToHistory();
        showNotification('Volume envelope reset', 'info');
    }

    applyEnvelope() {
        if (!this.currentBuffer || this.volumePoints.length < 2) {
            showNotification('No envelope to apply', 'warning');
            return;
        }
        
        // Apply volume envelope to the actual audio data
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);
            
            for (let i = 0; i < data.length; i++) {
                const time = i / this.currentBuffer.sampleRate;
                const volume = this.getVolumeAtTime(time);
                data[i] *= volume;
            }
        }
        
        // Reset envelope to flat after applying
        this.volumePoints = [
            { time: 0, volume: 1.0 },
            { time: this.currentBuffer.duration, volume: 1.0 }
        ];
        
        this.drawWaveform();
        this.saveToHistory();
        showNotification('Volume envelope applied to audio', 'success');
    }

    goToStart() {
        this.currentTime = 0;
        this.drawWaveform();
        this.updateTimeDisplay();
    }

    // File operations
    newProject() {
        if (this.currentBuffer && !confirm('Create new project? Unsaved changes will be lost.')) {
            return;
        }
        
        this.currentBuffer = null;
        this.clearSelection();
        this.clearInOutPoints();
        this.history = [];
        this.historyIndex = -1;
        this.initializeVolumeEnvelope();
        this.currentTime = 0;
        this.drawWaveform();
        showNotification('New project created', 'info');
    }

    async openFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/mp3,audio/mpeg,audio/wav,audio/m4a';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.loadAudioFile(file);
            }
        };
        
        input.click();
    }

    async loadAudioFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Reset volume envelope for new file
            this.volumePoints = [
                { time: 0, volume: 1.0 },
                { time: this.currentBuffer.duration, volume: 1.0 }
            ];
            
            this.drawWaveform();
            this.saveToHistory();
            
            // Update info
            const duration = this.currentBuffer.duration;
            document.getElementById('audio-duration').textContent = 
                `Duration: ${this.formatTime(duration)}`;
            document.getElementById('audio-format').textContent = 
                `Format: ${file.type.split('/')[1].toUpperCase()}`;
                
        } catch (error) {
            console.error('Error loading audio file:', error);
            showNotification('Error loading audio file', 'error');
        }
    }

    save() {
        if (!this.currentBuffer) {
            showNotification('No audio to save', 'warning');
            return;
        }
        
        // Open export modal
        const modal = document.getElementById('audio-export-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    // Waveform drawing
    drawWaveform() {
        if (!this.canvas) return;
        
        const width = this.canvas.width = this.waveformContainer.clientWidth;
        const height = this.canvas.height = 360; // Increased height for VU meter
        
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, width, height);
        
        if (!this.currentBuffer) {
            // Draw empty state
            this.ctx.fillStyle = '#666';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('No audio loaded', width / 2, height / 2);
            return;
        }
        
        // Draw timeline at the top
        this.drawTimeline(width, 30);
        
        // Draw waveform with integrated volume envelope
        const waveformTop = 35;
        const vuMeterHeight = 40;
        const waveformHeight = height - waveformTop - vuMeterHeight - 10;
        this.drawAudioWaveformWithEnvelope(width, waveformHeight, waveformTop);
        
        // Draw VU meter at the bottom (only during playback)
        if (this.isPlaying) {
            this.drawVUMeter(width, vuMeterHeight, height - vuMeterHeight - 5);
        }
        
        // Draw selection if any
        if (this.selection.start !== this.selection.end) {
            this.drawSelection(height);
        }
        
        // Draw In/Out points
        this.drawInOutPoints(height);
        
        // Draw playhead
        this.drawPlayhead(height);
    }

    drawVUMeter(width, height, offsetY) {
        if (!this.analyser) return;
        
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
        this.vuMeterPeakLeft = Math.max(normalizedPeakLeft, (this.vuMeterPeakLeft || 0) * 0.95);
        this.vuMeterPeakRight = Math.max(normalizedPeakRight, (this.vuMeterPeakRight || 0) * 0.95);
        
        // Peak hold
        if (normalizedPeakLeft > (this.vuMeterPeakHoldLeft || 0)) {
            this.vuMeterPeakHoldLeft = normalizedPeakLeft;
            this.vuMeterPeakHoldCounter = 30;
        } else if ((this.vuMeterPeakHoldCounter || 0) > 0) {
            this.vuMeterPeakHoldCounter--;
        } else {
            this.vuMeterPeakHoldLeft = (this.vuMeterPeakHoldLeft || 0) * 0.99;
        }
        
        if (normalizedPeakRight > (this.vuMeterPeakHoldRight || 0)) {
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

    drawTimeline(width, height) {
        const duration = this.currentBuffer ? this.currentBuffer.duration : 60;
        const pixelsPerSecond = width / duration;
        
        // Simple background
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, width, height);
        
        // Determine interval based on zoom
        let interval = 1; // seconds
        if (pixelsPerSecond < 10) interval = 5;
        else if (pixelsPerSecond < 5) interval = 10;
        else if (pixelsPerSecond > 100) interval = 0.5;
        else if (pixelsPerSecond > 200) interval = 0.1;
        
        // Draw ticks and labels
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        
        for (let time = 0; time <= duration; time += interval) {
            const x = Math.round(time * pixelsPerSecond); // Round for crisp lines
            
            // Draw tick
            this.ctx.beginPath();
            this.ctx.moveTo(x, height - 5);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
            
            // Draw time label
            if (interval >= 1 || (time % 1 === 0)) {
                const minutes = Math.floor(time / 60);
                const seconds = Math.floor(time % 60);
                const label = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
                this.ctx.fillText(label, x, height - 10);
            }
        }
    }

    drawAudioWaveformWithEnvelope(width, height, offsetY) {
        const data = this.currentBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;
        const centerY = offsetY + amp;
        
        // First pass: Draw the waveform (optimized for performance)
        this.ctx.save();
        
        // Simple solid fill for better performance
        this.ctx.fillStyle = '#003300';
        
        // Draw waveform
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        
        // Use integer steps for better performance
        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            // Sample the audio data
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j] || 0;
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            
            // Scale to amplitude
            min *= 0.9; // Slight reduction to avoid clipping
            max *= 0.9;
            
            this.ctx.lineTo(i, centerY + min * amp);
            this.ctx.lineTo(i, centerY + max * amp);
        }
        
        this.ctx.lineTo(width, centerY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Simple outline
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // Second pass: Apply volume envelope (optimized)
        if (this.volumePoints.length > 0 && this.isEditingVolume) {
            // Simple volume reference lines
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.lineWidth = 1;
            
            // Just show 0%, 50%, 100% lines
            [0, 0.5, 1].forEach(vol => {
                const y = centerY - ((vol - 0.5) * 2 * amp * 0.8);
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(width, y);
                this.ctx.stroke();
                
                // Simple labels
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.font = '10px monospace';
                this.ctx.fillText(`${Math.round(vol * 100)}%`, 5, y + 3);
            });
            
            // Draw envelope line (simple linear)
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            
            for (let i = 0; i < this.volumePoints.length; i++) {
                const point = this.volumePoints[i];
                const x = (point.time / this.currentBuffer.duration) * width;
                const y = centerY - ((point.volume - 0.5) * 2 * amp * 0.8);
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
            
            // Draw volume points (optimized)
            this.volumePoints.forEach((point, index) => {
                const x = (point.time / this.currentBuffer.duration) * width;
                const y = centerY - ((point.volume - 0.5) * 2 * amp * 0.8);
                
                // Draw main point
                this.ctx.beginPath();
                this.ctx.fillStyle = this.selectedVolumePoint === index ? '#ff6b6b' : '#00ff9f';
                this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
                this.ctx.fill();
                
                // Simple border
                this.ctx.strokeStyle = this.selectedVolumePoint === index ? '#fff' : '#000';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                
                // Show info only for selected point
                if (this.selectedVolumePoint === index) {
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '11px monospace';
                    const volumePercent = Math.round(point.volume * 100);
                    const text = `${volumePercent}%`;
                    const textWidth = this.ctx.measureText(text).width;
                    
                    // Background for text
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    this.ctx.fillRect(x - textWidth/2 - 3, y - 18, textWidth + 6, 14);
                    
                    // Text
                    this.ctx.fillStyle = '#fff';
                    this.ctx.fillText(text, x - textWidth/2, y - 8);
                }
            });
        }
        
        this.ctx.restore();
    }

    // Cette méthode n'est plus nécessaire car l'enveloppe est intégrée dans drawAudioWaveformWithEnvelope

    getVolumeAtTime(time) {
        if (this.volumePoints.length === 0) return 1.0;
        if (this.volumePoints.length === 1) return this.volumePoints[0].volume;
        
        // Find the two points around this time
        let beforePoint = null;
        let afterPoint = null;
        
        for (let i = 0; i < this.volumePoints.length; i++) {
            const point = this.volumePoints[i];
            if (point.time <= time) {
                beforePoint = point;
            }
            if (point.time >= time && !afterPoint) {
                afterPoint = point;
                break;
            }
        }
        
        if (!beforePoint) return afterPoint.volume;
        if (!afterPoint) return beforePoint.volume;
        if (beforePoint === afterPoint) return beforePoint.volume;
        
        // Linear interpolation
        const t = (time - beforePoint.time) / (afterPoint.time - beforePoint.time);
        return beforePoint.volume + t * (afterPoint.volume - beforePoint.volume);
    }

    drawSelection(height) {
        const start = this.timeToPixel(this.selection.start);
        const end = this.timeToPixel(this.selection.end);
        
        this.ctx.fillStyle = 'rgba(37, 99, 235, 0.3)';
        this.ctx.fillRect(start, 30, end - start, height - 30); // Start after timeline
    }

    drawInOutPoints(height) {
        if (this.inPoint !== null) {
            const x = this.timeToPixel(this.inPoint);
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 30);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
            
            // Draw "IN" label
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.fillText('IN', x + 2, 45);
        }
        
        if (this.outPoint !== null) {
            const x = this.timeToPixel(this.outPoint);
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 30);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
            
            // Draw "OUT" label
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.fillText('OUT', x + 2, 45);
        }
    }

    drawPlayhead(height) {
        if (this.currentBuffer) {
            const x = this.timeToPixel(this.currentTime);
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
            
            // Draw time indicator at the top
            const time = this.formatTime(this.currentTime);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(time, x, 10);
        }
    }

    // Playback controls with volume automation
    play() {
        if (this.isPlaying || !this.currentBuffer) return;
        
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.currentBuffer;
        this.sourceNode.connect(this.gainNode);
        
        const startTime = this.inPoint !== null ? this.inPoint : this.currentTime;
        const endTime = this.outPoint !== null ? this.outPoint : this.currentBuffer.duration;
        const duration = endTime - startTime;
        
        // Show and start VU meter
        this.startVUMeter();
        
        if (duration <= 0) {
            showNotification('Invalid playback range', 'warning');
            return;
        }
        
        this.playStartTime = this.audioContext.currentTime;
        this.sourceNode.start(0, startTime, duration);
        this.isPlaying = true;
        
        // Apply volume automation
        this.applyVolumeAutomation(startTime, endTime);
        
        this.sourceNode.onended = () => {
            this.isPlaying = false;
            this.sourceNode = null;
        };
        
        this.updatePlayhead();
    }

    applyVolumeAutomation(startTime, endTime) {
        const now = this.audioContext.currentTime;
        
        // Cancel any previous automation
        this.gainNode.gain.cancelScheduledValues(now);
        
        // Set initial value
        const initialVolume = this.getVolumeAtTime(startTime);
        this.gainNode.gain.setValueAtTime(initialVolume, now);
        
        // Create more granular automation points for smooth transitions
        const sampleRate = 30; // Updates per second
        const step = 1 / sampleRate;
        
        for (let time = startTime + step; time <= endTime; time += step) {
            const volume = this.getVolumeAtTime(time);
            const audioTime = now + (time - startTime);
            this.gainNode.gain.linearRampToValueAtTime(volume, audioTime);
        }
        
        // Ensure final value
        const finalVolume = this.getVolumeAtTime(endTime);
        const finalTime = now + (endTime - startTime);
        this.gainNode.gain.linearRampToValueAtTime(finalVolume, finalTime);
    }

    pause() {
        if (this.sourceNode && this.isPlaying) {
            this.sourceNode.stop();
            this.isPlaying = false;
            this.stopVUMeter();
        }
    }

    stop() {
        this.pause();
        this.currentTime = this.inPoint !== null ? this.inPoint : 0;
        this.updatePlayhead();
        this.stopVUMeter();
    }
    
    startVUMeter() {
        // Start animation loop
        const animate = () => {
            if (!this.isPlaying) return;
            
            // Redraw waveform with VU meter
            this.drawWaveform();
            this.vuMeterAnimation = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    stopVUMeter() {
        if (this.vuMeterAnimation) {
            cancelAnimationFrame(this.vuMeterAnimation);
            this.vuMeterAnimation = null;
        }
        
        // Reset peaks
        this.vuMeterPeakLeft = 0;
        this.vuMeterPeakRight = 0;
        this.vuMeterPeakHoldLeft = 0;
        this.vuMeterPeakHoldRight = 0;
        this.vuMeterPeakHoldCounter = 0;
        
        // Final redraw to clear VU meter
        this.drawWaveform();
    }

    // Navigation methods
    movePlayhead(delta) {
        if (!this.currentBuffer) return;
        
        this.currentTime = Math.max(0, Math.min(this.currentBuffer.duration, this.currentTime + delta));
        this.drawWaveform();
        this.updateTimeDisplay();
    }

    goToInPoint() {
        if (this.inPoint !== null) {
            this.currentTime = this.inPoint;
            this.drawWaveform();
            this.updateTimeDisplay();
        }
    }

    goToOutPoint() {
        if (this.outPoint !== null) {
            this.currentTime = this.outPoint;
            this.drawWaveform();
            this.updateTimeDisplay();
        }
    }

    // In/Out points
    setInPoint(time = null) {
        this.inPoint = time !== null ? time : this.currentTime;
        if (this.outPoint !== null && this.inPoint >= this.outPoint) {
            this.outPoint = null;
        }
        this.drawWaveform();
        this.updateSelectionInfo();
        showNotification(`In point set at ${this.formatTime(this.inPoint)}`, 'success');
    }

    setOutPoint(time = null) {
        this.outPoint = time !== null ? time : this.currentTime;
        if (this.inPoint !== null && this.outPoint <= this.inPoint) {
            this.inPoint = null;
        }
        this.drawWaveform();
        this.updateSelectionInfo();
        showNotification(`Out point set at ${this.formatTime(this.outPoint)}`, 'success');
    }

    clearInOutPoints() {
        this.inPoint = null;
        this.outPoint = null;
        this.drawWaveform();
        this.updateSelectionInfo();
        showNotification('In/Out points cleared', 'info');
    }

    updateSelectionInfo() {
        const selectionInfo = document.getElementById('audio-selection-info');
        if (selectionInfo) {
            if (this.inPoint !== null && this.outPoint !== null) {
                const duration = this.outPoint - this.inPoint;
                selectionInfo.textContent = `In/Out: ${this.formatTime(this.inPoint)} - ${this.formatTime(this.outPoint)} (${this.formatTime(duration)})`;
            } else if (this.inPoint !== null) {
                selectionInfo.textContent = `In: ${this.formatTime(this.inPoint)}`;
            } else if (this.outPoint !== null) {
                selectionInfo.textContent = `Out: ${this.formatTime(this.outPoint)}`;
            } else if (this.selection.start !== this.selection.end) {
                const duration = Math.abs(this.selection.end - this.selection.start);
                selectionInfo.textContent = `Selection: ${this.formatTime(duration)}`;
            } else {
                selectionInfo.textContent = 'Selection: None';
            }
        }
    }

    updateTimeDisplay() {
        const timeDisplay = document.getElementById('audio-editor-time');
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(this.currentTime);
        }
    }

    // Recording
    async record() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
                const arrayBuffer = await blob.arrayBuffer();
                this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                // Reset volume envelope for new recording
                this.volumePoints = [
                    { time: 0, volume: 1.0 },
                    { time: this.currentBuffer.duration, volume: 1.0 }
                ];
                
                this.drawWaveform();
                this.saveToHistory();
                showNotification('Recording saved', 'success');
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            const recordBtn = document.querySelector('.transport-btn.record');
            if (recordBtn) {
                recordBtn.classList.add('recording');
            }
            
        } catch (error) {
            console.error('Error starting recording:', error);
            showNotification('Error accessing microphone', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            const recordBtn = document.querySelector('.transport-btn.record');
            if (recordBtn) {
                recordBtn.classList.remove('recording');
            }
            
            // Stop all tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    // Edit operations
    cut() {
        if (!this.hasSelection() && !this.hasInOutPoints()) {
            showNotification('Please select a region or set In/Out points to cut', 'warning');
            return;
        }
        
        this.copy();
        this.delete();
    }

    copy() {
        if (!this.hasSelection() && !this.hasInOutPoints()) {
            showNotification('Please select a region or set In/Out points to copy', 'warning');
            return;
        }
        
        const { start, end } = this.getActiveRange();
        const startSample = Math.floor(start * this.currentBuffer.sampleRate);
        const endSample = Math.floor(end * this.currentBuffer.sampleRate);
        const length = endSample - startSample;
        
        this.clipboard = {
            numberOfChannels: this.currentBuffer.numberOfChannels,
            sampleRate: this.currentBuffer.sampleRate,
            length: length,
            data: [],
            volumePoints: this.getVolumePointsInRange(start, end)
        };
        
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const channelData = this.currentBuffer.getChannelData(channel);
            this.clipboard.data[channel] = channelData.slice(startSample, endSample);
        }
        
        showNotification('Audio copied to clipboard', 'success');
    }

    paste() {
        if (!this.clipboard) {
            showNotification('Nothing to paste', 'warning');
            return;
        }
        
        if (!this.currentBuffer) {
            // Create new buffer from clipboard
            this.currentBuffer = this.audioContext.createBuffer(
                this.clipboard.numberOfChannels,
                this.clipboard.length,
                this.clipboard.sampleRate
            );
            
            for (let channel = 0; channel < this.clipboard.numberOfChannels; channel++) {
                const newData = this.currentBuffer.getChannelData(channel);
                newData.set(this.clipboard.data[channel]);
            }
            
            // Set volume points from clipboard
            this.volumePoints = this.clipboard.volumePoints || [
                { time: 0, volume: 1.0 },
                { time: this.currentBuffer.duration, volume: 1.0 }
            ];
        } else {
            // Insert at current time
            const insertTime = this.currentTime;
            const newLength = this.currentBuffer.length + this.clipboard.length;
            const newBuffer = this.audioContext.createBuffer(
                this.currentBuffer.numberOfChannels,
                newLength,
                this.currentBuffer.sampleRate
            );
            
            const insertSample = Math.floor(insertTime * this.currentBuffer.sampleRate);
            
            for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
                const oldData = this.currentBuffer.getChannelData(channel);
                const newData = newBuffer.getChannelData(channel);
                const clipboardData = this.clipboard.data[channel] || new Float32Array(this.clipboard.length);
                
                // Copy before insertion point
                newData.set(oldData.subarray(0, insertSample), 0);
                
                // Insert clipboard data
                newData.set(clipboardData, insertSample);
                
                // Copy after insertion point
                newData.set(oldData.subarray(insertSample), insertSample + this.clipboard.length);
            }
            
            // Adjust volume points
            const clipboardDuration = this.clipboard.length / this.clipboard.sampleRate;
            this.shiftVolumePointsAfter(insertTime, clipboardDuration);
            
            // Add clipboard volume points
            if (this.clipboard.volumePoints) {
                this.clipboard.volumePoints.forEach(point => {
                    this.volumePoints.push({
                        time: insertTime + point.time,
                        volume: point.volume
                    });
                });
                this.sortVolumePoints();
            }
            
            this.currentBuffer = newBuffer;
        }
        
        this.drawWaveform();
        this.saveToHistory();
        showNotification('Audio pasted', 'success');
    }

    delete() {
        if (!this.hasSelection() && !this.hasInOutPoints()) {
            showNotification('Please select a region or set In/Out points to delete', 'warning');
            return;
        }
        
        const { start, end } = this.getActiveRange();
        const startSample = Math.floor(start * this.currentBuffer.sampleRate);
        const endSample = Math.floor(end * this.currentBuffer.sampleRate);
        
        // Create new buffer without selected region
        const newLength = this.currentBuffer.length - (endSample - startSample);
        const newBuffer = this.audioContext.createBuffer(
            this.currentBuffer.numberOfChannels,
            newLength,
            this.currentBuffer.sampleRate
        );
        
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const oldData = this.currentBuffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            
            // Copy before selection
            for (let i = 0; i < startSample; i++) {
                newData[i] = oldData[i];
            }
            
            // Copy after selection
            for (let i = endSample; i < oldData.length; i++) {
                newData[i - (endSample - startSample)] = oldData[i];
            }
        }
        
        // Remove volume points in the deleted range and shift the rest
        const deletedDuration = end - start;
        this.volumePoints = this.volumePoints.filter(point => point.time < start || point.time > end);
        this.shiftVolumePointsAfter(start, -deletedDuration);
        
        this.currentBuffer = newBuffer;
        this.clearSelection();
        this.clearInOutPoints();
        this.drawWaveform();
        this.saveToHistory();
        showNotification('Selection deleted', 'success');
    }

    // Helper methods for edit operations
    hasSelection() {
        return this.selection.start !== this.selection.end;
    }

    hasInOutPoints() {
        return this.inPoint !== null && this.outPoint !== null;
    }

    getActiveRange() {
        if (this.hasInOutPoints()) {
            return { start: this.inPoint, end: this.outPoint };
        } else if (this.hasSelection()) {
            return { 
                start: Math.min(this.selection.start, this.selection.end),
                end: Math.max(this.selection.start, this.selection.end)
            };
        }
        return { start: 0, end: 0 };
    }

    getVolumePointsInRange(start, end) {
        return this.volumePoints
            .filter(point => point.time >= start && point.time <= end)
            .map(point => ({ time: point.time - start, volume: point.volume }));
    }

    shiftVolumePointsAfter(time, offset) {
        this.volumePoints.forEach(point => {
            if (point.time > time) {
                point.time += offset;
            }
        });
        this.volumePoints = this.volumePoints.filter(point => point.time >= 0);
    }

    sortVolumePoints() {
        this.volumePoints.sort((a, b) => a.time - b.time);
    }

    // Effects with volume automation support
    fadeIn() {
        if (!this.hasSelection() && !this.hasInOutPoints()) {
            showNotification('Please select a region or set In/Out points to apply fade in', 'warning');
            return;
        }
        
        const { start, end } = this.getActiveRange();
        
        // Add volume points for fade in
        this.addVolumePoint(start, 0.0);
        this.addVolumePoint(end, 1.0);
        
        this.applyFade('in');
    }

    fadeOut() {
        if (!this.hasSelection() && !this.hasInOutPoints()) {
            showNotification('Please select a region or set In/Out points to apply fade out', 'warning');
            return;
        }
        
        const { start, end } = this.getActiveRange();
        
        // Add volume points for fade out
        this.addVolumePoint(start, 1.0);
        this.addVolumePoint(end, 0.0);
        
        this.applyFade('out');
    }

    applyFade(type) {
        const { start, end } = this.getActiveRange();
        const startSample = Math.floor(start * this.currentBuffer.sampleRate);
        const endSample = Math.floor(end * this.currentBuffer.sampleRate);
        const length = endSample - startSample;
        
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);
            
            for (let i = startSample; i < endSample; i++) {
                const progress = (i - startSample) / length;
                const multiplier = type === 'in' ? progress : 1 - progress;
                data[i] *= multiplier;
            }
        }
        
        this.drawWaveform();
        this.saveToHistory();
        showNotification(`Fade ${type} applied`, 'success');
    }

    normalize() {
        if (!this.currentBuffer) {
            showNotification('No audio to normalize', 'warning');
            return;
        }
        
        let maxValue = 0;
        
        // Find peak value
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                maxValue = Math.max(maxValue, Math.abs(data[i]));
            }
        }
        
        if (maxValue === 0) return;
        
        // Apply normalization
        const multiplier = 0.95 / maxValue;
        
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                data[i] *= multiplier;
            }
        }
        
        this.drawWaveform();
        this.saveToHistory();
        showNotification('Audio normalized', 'success');
    }

    amplify() {
        if (!this.currentBuffer) {
            showNotification('No audio to amplify', 'warning');
            return;
        }
        
        const gainStr = prompt('Enter gain in dB (-20 to +20):', '6');
        if (gainStr === null) return;
        
        const gainDb = parseFloat(gainStr);
        if (isNaN(gainDb) || gainDb < -20 || gainDb > 20) {
            showNotification('Invalid gain value. Please enter a value between -20 and +20 dB.', 'error');
            return;
        }
        
        // Convert dB to linear gain
        const gainLinear = Math.pow(10, gainDb / 20);
        
        const { start, end } = this.hasSelection() || this.hasInOutPoints() ? 
            this.getActiveRange() : 
            { start: 0, end: this.currentBuffer.duration };
        
        const startSample = Math.floor(start * this.currentBuffer.sampleRate);
        const endSample = Math.floor(end * this.currentBuffer.sampleRate);
        
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);
            for (let i = startSample; i < endSample; i++) {
                data[i] *= gainLinear;
                // Clip to prevent distortion
                data[i] = Math.max(-1, Math.min(1, data[i]));
            }
        }
        
        this.drawWaveform();
        this.saveToHistory();
        showNotification(`Amplify ${gainDb > 0 ? '+' : ''}${gainDb} dB applied`, 'success');
    }

    silence() {
        if (!this.hasSelection() && !this.hasInOutPoints()) {
            showNotification('Please select a region or set In/Out points to silence', 'warning');
            return;
        }
        
        const { start, end } = this.getActiveRange();
        const startSample = Math.floor(start * this.currentBuffer.sampleRate);
        const endSample = Math.floor(end * this.currentBuffer.sampleRate);
        
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const data = this.currentBuffer.getChannelData(channel);
            for (let i = startSample; i < endSample; i++) {
                data[i] = 0;
            }
        }
        
        // Add volume points for silenced region
        this.addVolumePoint(start, 0.0);
        this.addVolumePoint(end, 0.0);
        
        this.drawWaveform();
        this.saveToHistory();
        showNotification('Selection silenced', 'success');
    }

    // Volume point management
    addVolumePoint(time, volume) {
        // Remove existing point at the same time
        this.volumePoints = this.volumePoints.filter(point => Math.abs(point.time - time) > 0.001);
        
        // Add new point
        this.volumePoints.push({ time, volume });
        this.sortVolumePoints();
        this.drawWaveform();
    }

    removeVolumePoint(index) {
        if (index >= 0 && index < this.volumePoints.length) {
            this.volumePoints.splice(index, 1);
            this.drawWaveform();
            this.saveToHistory();
        }
    }

    findVolumePointAt(x, y) {
        if (!this.currentBuffer || !this.isEditingVolume) return -1;
        
        const duration = this.currentBuffer.duration;
        const width = this.canvas.width;
        const waveformTop = 35;
        const waveformHeight = this.canvas.height - waveformTop - 5;
        const centerY = waveformTop + waveformHeight / 2;
        const amp = waveformHeight / 2;
        
        // Precise detection radius
        const detectionRadius = 8;
        
        for (let i = 0; i < this.volumePoints.length; i++) {
            const point = this.volumePoints[i];
            const pointX = (point.time / duration) * width;
            const pointY = centerY - ((point.volume - 0.5) * 2 * amp * 0.8);
            
            const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
            if (distance <= detectionRadius) {
                return i;
            }
        }
        
        return -1;
    }

    // Export functionality (updated to support In/Out points and volume automation)
    updateExportOptions() {
        const target = document.getElementById('audio-export-target').value;
        const fileOptions = document.getElementById('export-options-file');
        const contentOptions = document.getElementById('export-options-content');
        
        if (target === 'file') {
            fileOptions.style.display = 'block';
            contentOptions.style.display = 'none';
        } else {
            fileOptions.style.display = 'none';
            contentOptions.style.display = 'block';
            
            // Populate items dropdown
            const itemSelect = document.getElementById('audio-export-item');
            itemSelect.innerHTML = '';
            
            if (target === 'news' && window.app && window.app.newsManager) {
                const news = window.app.newsManager.getDatabase();
                news.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.title;
                    itemSelect.appendChild(option);
                });
            } else if (target === 'animation' && window.app && window.app.animationManager) {
                const animations = window.app.animationManager.getDatabase();
                animations.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.title;
                    itemSelect.appendChild(option);
                });
            }
            
            if (itemSelect.options.length === 0) {
                itemSelect.innerHTML = '<option value="">No items available</option>';
            }
        }
    }

    async executeExport() {
        const target = document.getElementById('audio-export-target').value;
        
        if (target === 'file') {
            await this.exportToFile();
        } else {
            await this.exportToContent(target);
        }
        
        window.app.closeModal('audio-export-modal');
    }

    async exportToFile() {
        const format = document.getElementById('audio-export-format').value;
        const quality = document.getElementById('audio-export-quality').value;
        
        // Create buffer for export (respecting In/Out points)
        const exportBuffer = this.createExportBuffer();
        const audioData = this.bufferToWav(exportBuffer);
        const blob = new Blob([audioData], { type: `audio/${format}` });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_audio_${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('Audio exported successfully', 'success');
    }

    createExportBuffer() {
        if (!this.currentBuffer) return null;
        
        // Determine export range
        let start = 0;
        let end = this.currentBuffer.duration;
        
        if (this.hasInOutPoints()) {
            start = this.inPoint;
            end = this.outPoint;
        } else if (this.hasSelection()) {
            start = Math.min(this.selection.start, this.selection.end);
            end = Math.max(this.selection.start, this.selection.end);
        }
        
        const startSample = Math.floor(start * this.currentBuffer.sampleRate);
        const endSample = Math.floor(end * this.currentBuffer.sampleRate);
        const length = endSample - startSample;
        
        // Create export buffer
        const exportBuffer = this.audioContext.createBuffer(
            this.currentBuffer.numberOfChannels,
            length,
            this.currentBuffer.sampleRate
        );
        
        // Copy audio data with volume automation
        for (let channel = 0; channel < this.currentBuffer.numberOfChannels; channel++) {
            const sourceData = this.currentBuffer.getChannelData(channel);
            const exportData = exportBuffer.getChannelData(channel);
            
            for (let i = 0; i < length; i++) {
                const sourceIndex = startSample + i;
                const time = start + (i / this.currentBuffer.sampleRate);
                const volume = this.getVolumeAtTime(time);
                
                exportData[i] = sourceData[sourceIndex] * volume;
            }
        }
        
        return exportBuffer;
    }

    async exportToContent(type) {
        const itemId = parseInt(document.getElementById('audio-export-item').value);
        if (!itemId) {
            showNotification('Please select an item', 'warning');
            return;
        }
        
        // Create export buffer
        const exportBuffer = this.createExportBuffer();
        const audioData = this.bufferToWav(exportBuffer);
        const blob = new Blob([audioData], { type: 'audio/wav' });
        const reader = new FileReader();
        
        reader.onload = async () => {
            const base64Data = reader.result;
            const audioFileId = `audio_${Date.now()}.mp3`;
            
            // Save to storage
            if (window.app && window.app.storage) {
                await window.app.storage.saveAudioFile(audioFileId, {
                    data: base64Data,
                    name: 'Edited Audio',
                    type: 'audio/wav',
                    duration: this.formatTime(exportBuffer.duration)
                });
            }
            
            // Add to news or animation
            const soundData = {
                id: Date.now(),
                name: 'Edited Audio',
                type: 'autre',
                duration: this.formatTime(exportBuffer.duration),
                description: 'Audio edited in Audio Editor',
                audioFileId: audioFileId,
                fileName: 'edited_audio.wav'
            };
            
            if (type === 'news' && window.app && window.app.newsManager) {
                const item = window.app.newsManager.getDatabase().find(n => n.id === itemId);
                if (item) {
                    if (!item.sounds) item.sounds = [];
                    item.sounds.push(soundData);
                    window.app.newsManager.setDatabase(window.app.newsManager.getDatabase());
                    await window.app.save();
                    showNotification('Audio added to news', 'success');
                }
            } else if (type === 'animation' && window.app && window.app.animationManager) {
                const item = window.app.animationManager.getDatabase().find(a => a.id === itemId);
                if (item) {
                    if (!item.sounds) item.sounds = [];
                    item.sounds.push(soundData);
                    window.app.animationManager.setDatabase(window.app.animationManager.getDatabase());
                    await window.app.save();
                    showNotification('Audio added to animation', 'success');
                }
            }
        };
        
        reader.readAsDataURL(blob);
    }

    // Helper methods
    clearSelection() {
        this.selection = { start: 0, end: 0 };
        this.drawWaveform();
        this.updateSelectionInfo();
    }

    timeToPixel(time) {
        return (time / (this.currentBuffer ? this.currentBuffer.duration : 1)) * this.canvas.width;
    }

    pixelToTime(pixel) {
        return (pixel / this.canvas.width) * (this.currentBuffer ? this.currentBuffer.duration : 1);
    }

    formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${min}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    bufferToWav(buffer) {
        // Convert AudioBuffer to WAV format
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
        
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"
        
        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(buffer.numberOfChannels);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels); // avg. bytes/sec
        setUint16(buffer.numberOfChannels * 2); // block-align
        setUint16(16); // 16-bit
        
        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length
        
        // Write interleaved data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }
        
        return arrayBuffer;
    }

    // Undo/Redo
    saveToHistory() {
        // Limit history size
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push({
            buffer: this.currentBuffer,
            selection: { ...this.selection },
            inPoint: this.inPoint,
            outPoint: this.outPoint,
            volumePoints: this.volumePoints.map(p => ({ ...p }))
        });
        
        if (this.history.length > 20) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.currentBuffer = state.buffer;
            this.selection = { ...state.selection };
            this.inPoint = state.inPoint;
            this.outPoint = state.outPoint;
            this.volumePoints = state.volumePoints.map(p => ({ ...p }));
            this.drawWaveform();
            showNotification('Undo', 'info');
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.currentBuffer = state.buffer;
            this.selection = { ...state.selection };
            this.inPoint = state.inPoint;
            this.outPoint = state.outPoint;
            this.volumePoints = state.volumePoints.map(p => ({ ...p }));
            this.drawWaveform();
            showNotification('Redo', 'info');
        }
    }

    // Zoom controls
    zoomIn() {
        this.zoomLevel = Math.min(1000, this.zoomLevel * 1.5);
        this.drawWaveform();
    }

    zoomOut() {
        this.zoomLevel = Math.max(10, this.zoomLevel / 1.5);
        this.drawWaveform();
    }

    zoomFit() {
        if (this.currentBuffer) {
            this.zoomLevel = this.canvas.width / this.currentBuffer.duration;
            this.drawWaveform();
        }
    }

    // Mouse handlers
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = this.pixelToTime(x);
        
        // Skip timeline area
        if (y < 30) return;
        
        // Check for volume point interaction
        if (this.isEditingVolume) {
            const pointIndex = this.findVolumePointAt(x, y);
            
            // Right click = drag/edit existing point
            if (e.button === 2) { // Right click
                if (pointIndex !== -1) {
                    // Select and start dragging point with right click
                    this.selectedVolumePoint = pointIndex;
                    this.isDraggingVolumePoint = true;
                    this.drawWaveform();
                }
                return;
            }
            
            // Left click handling
            if (e.button === 0) { // Left click
                if (pointIndex !== -1) {
                    if (e.ctrlKey || e.metaKey) {
                        // Delete point with Ctrl+click
                        if (this.volumePoints.length > 2) {
                            this.removeVolumePoint(pointIndex);
                            this.selectedVolumePoint = null;
                            this.drawWaveform();
                        }
                    } else {
                        // Just select the point with left click (no dragging)
                        this.selectedVolumePoint = pointIndex;
                        this.isDraggingVolumePoint = false;
                        this.drawWaveform();
                    }
                } else {
                    // Add new volume point with left click on empty space
                    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                        const waveformTop = 35;
                        const waveformHeight = this.canvas.height - waveformTop - 5;
                        const centerY = waveformTop + waveformHeight / 2;
                        const amp = waveformHeight / 2;
                        
                        // Calculate volume based on Y position relative to center
                        const relativeY = centerY - y;
                        const volume = Math.max(0, Math.min(1, (relativeY / (amp * 0.8)) * 0.5 + 0.5));
                        
                        this.addVolumePoint(time, volume);
                        // Select the newly created point
                        this.selectedVolumePoint = this.volumePoints.length - 1;
                        this.isDraggingVolumePoint = false;
                        this.drawWaveform();
                        this.saveToHistory();
                    } else {
                        // Deselect if clicking elsewhere with modifier
                        this.selectedVolumePoint = null;
                        this.drawWaveform();
                    }
                }
                return;
            }
        }
        
        // Handle In/Out point setting with modifier keys
        if (e.altKey) {
            this.setInPoint(time);
            return;
        } else if (e.shiftKey) {
            this.setOutPoint(time);
            return;
        }
        
        // Regular selection
        this.selection.start = time;
        this.selection.end = time;
        this.isSelecting = true;
        this.currentTime = time;
        this.drawWaveform();
        this.updateTimeDisplay();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = this.pixelToTime(x);
        
        // Update cursor based on context
        if (this.isEditingVolume && !this.isDraggingVolumePoint) {
            const pointIndex = this.findVolumePointAt(x, y);
            if (pointIndex !== -1) {
                // Show different cursor if Ctrl is held (delete mode)
                if ((e.ctrlKey || e.metaKey) && this.volumePoints.length > 2) {
                    this.canvas.style.cursor = 'not-allowed';
                } else {
                    this.canvas.style.cursor = 'pointer';
                }
            } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                this.canvas.style.cursor = 'crosshair';
            } else {
                this.canvas.style.cursor = 'default';
            }
        } else if (this.isDraggingVolumePoint) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'default';
        }
        
        if (this.isDraggingVolumePoint && this.selectedVolumePoint !== null) {
            // Update volume point position
            const waveformTop = 35;
            const waveformHeight = this.canvas.height - waveformTop - 5;
            const centerY = waveformTop + waveformHeight / 2;
            const amp = waveformHeight / 2;
            
            // Calculate volume based on Y position relative to center
            const relativeY = centerY - y;
            const volume = Math.max(0, Math.min(1, (relativeY / (amp * 0.8)) * 0.5 + 0.5));
            
            // Update point position
            const point = this.volumePoints[this.selectedVolumePoint];
            const oldTime = point.time;
            
            point.time = Math.max(0, 
                Math.min(this.currentBuffer ? this.currentBuffer.duration : 1, time));
            point.volume = volume;
            
            // If time changed, need to re-sort and update selected index
            if (oldTime !== point.time) {
                this.sortVolumePoints();
                // Find new index after sorting
                this.selectedVolumePoint = this.volumePoints.findIndex(p => p === point);
            }
            
            this.drawWaveform();
            return;
        }
        
        if (!this.isSelecting) return;
        
        this.selection.end = time;
        this.drawWaveform();
        this.updateSelectionInfo();
    }

    handleMouseUp(e) {
        if (this.isDraggingVolumePoint) {
            this.isDraggingVolumePoint = false;
            this.selectedVolumePoint = null;
            this.saveToHistory();
            return;
        }
        
        this.isSelecting = false;
        
        // Normalize selection
        if (this.selection.end < this.selection.start) {
            [this.selection.start, this.selection.end] = 
                [this.selection.end, this.selection.start];
        }
        
        this.updateSelectionInfo();
    }

    handleDoubleClick(e) {
        if (this.isEditingVolume) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = this.pixelToTime(x);
        
        // Double-click to set playhead
        this.currentTime = time;
        this.drawWaveform();
        this.updateTimeDisplay();
    }

    // Keyboard shortcuts (enhanced)
    handleKeyboard(e) {
        // Volume point editing with arrow keys when a point is selected
        if (this.isEditingVolume && this.selectedVolumePoint !== null && this.volumePoints[this.selectedVolumePoint]) {
            const point = this.volumePoints[this.selectedVolumePoint];
            let modified = false;
            
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                // Increase volume by 5% (or 1% with Shift)
                const step = e.shiftKey ? 0.01 : 0.05;
                point.volume = Math.min(1, point.volume + step);
                modified = true;
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                // Decrease volume by 5% (or 1% with Shift)
                const step = e.shiftKey ? 0.01 : 0.05;
                point.volume = Math.max(0, point.volume - step);
                modified = true;
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                // Move point earlier by 0.1s (or 0.01s with Shift)
                const step = e.shiftKey ? 0.01 : 0.1;
                point.time = Math.max(0, point.time - step);
                this.sortVolumePoints();
                // Update selected index after sorting
                this.selectedVolumePoint = this.volumePoints.findIndex(p => p === point);
                modified = true;
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                // Move point later by 0.1s (or 0.01s with Shift)
                const step = e.shiftKey ? 0.01 : 0.1;
                const maxTime = this.currentBuffer ? this.currentBuffer.duration : 10;
                point.time = Math.min(maxTime, point.time + step);
                this.sortVolumePoints();
                // Update selected index after sorting
                this.selectedVolumePoint = this.volumePoints.findIndex(p => p === point);
                modified = true;
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                // Delete selected point if not first or last
                if (this.volumePoints.length > 2) {
                    this.removeVolumePoint(this.selectedVolumePoint);
                    this.selectedVolumePoint = null;
                    modified = true;
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // Deselect current point
                this.selectedVolumePoint = null;
                this.drawWaveform();
                return;
            } else if (e.key === 'Tab') {
                e.preventDefault();
                // Navigate to next/previous point
                if (e.shiftKey) {
                    // Previous point
                    this.selectedVolumePoint--;
                    if (this.selectedVolumePoint < 0) {
                        this.selectedVolumePoint = this.volumePoints.length - 1;
                    }
                } else {
                    // Next point
                    this.selectedVolumePoint++;
                    if (this.selectedVolumePoint >= this.volumePoints.length) {
                        this.selectedVolumePoint = 0;
                    }
                }
                this.drawWaveform();
                return;
            } else if (e.key >= '0' && e.key <= '9') {
                // Set volume directly with number keys (0-9 = 0%-90%, 0 = 100%)
                e.preventDefault();
                const value = e.key === '0' ? 1.0 : parseInt(e.key) * 0.1;
                point.volume = value;
                modified = true;
            } else if (e.key === 'Home') {
                // Jump to first point
                e.preventDefault();
                this.selectedVolumePoint = 0;
                this.drawWaveform();
                return;
            } else if (e.key === 'End') {
                // Jump to last point
                e.preventDefault();
                this.selectedVolumePoint = this.volumePoints.length - 1;
                this.drawWaveform();
                return;
            }
            
            if (modified) {
                this.drawWaveform();
                this.saveToHistory();
                return;
            }
        }
        
        // If no point is selected but volume editing is enabled, Tab selects first point
        if (this.isEditingVolume && this.selectedVolumePoint === null && e.key === 'Tab') {
            e.preventDefault();
            // Select first or last point depending on Shift
            this.selectedVolumePoint = e.shiftKey ? this.volumePoints.length - 1 : 0;
            this.drawWaveform();
            return;
        }
        
        // Normal navigation with arrow keys (when no volume point selected)
        if (!this.isEditingVolume || this.selectedVolumePoint === null) {
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
        
        // Other shortcuts
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
            }
        } else if (e.key === 'Delete') {
            e.preventDefault();
            this.delete();
        } else if (e.key === ' ') {
            e.preventDefault();
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.clearSelection();
            this.clearInOutPoints();
        }
    }

    selectAll() {
        if (this.currentBuffer) {
            this.selection.start = 0;
            this.selection.end = this.currentBuffer.duration;
            this.drawWaveform();
            this.updateSelectionInfo();
        }
    }

    // Update playhead position during playback
    updatePlayhead() {
        if (!this.isPlaying) return;
        
        const elapsed = this.audioContext.currentTime - this.playStartTime;
        const startTime = this.inPoint !== null ? this.inPoint : 0;
        this.currentTime = startTime + elapsed;
        
        // Stop if we've reached the end
        const endTime = this.outPoint !== null ? this.outPoint : this.currentBuffer.duration;
        if (this.currentTime >= endTime) {
            this.pause();
            this.currentTime = endTime;
        }
        
        this.drawWaveform();
        this.updateTimeDisplay();
        
        if (this.isPlaying) {
            requestAnimationFrame(() => this.updatePlayhead());
        }
    }

    // Load audio library
    loadAudioLibrary() {
        // Load existing audio files from storage
        const libraryList = document.getElementById('audio-library-list');
        if (libraryList) {
            libraryList.innerHTML = '<p style="color: #999;">Loading audio library...</p>';
        }
        
        // Implementation to load from IndexedDB
        this.refreshLibrary();
    }

    async refreshLibrary() {
        // Get all audio files from storage
        if (window.app && window.app.storage) {
            try {
                const audioFiles = await window.app.storage.getAllAudioFiles();
                const libraryList = document.getElementById('audio-library-list');
                
                if (!libraryList) return;
                
                if (!audioFiles || audioFiles.length === 0) {
                    libraryList.innerHTML = '<p style="color: #999;">Aucun fichier audio dans la bibliothèque</p>';
                    return;
                }
                
                // Gérer le nouveau format (tableau d'objets avec url)
                if (Array.isArray(audioFiles)) {
                    libraryList.innerHTML = audioFiles.map(file => `
                        <div class="library-item" onclick="app.audioEditor.loadFromLibrary('${file.url}')">
                            <span>🎵 ${file.name || 'Audio'}</span>
                            <span style="color: #999;">${file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</span>
                        </div>
                    `).join('');
                } else {
                    // Ancien format (objet avec clés)
                    libraryList.innerHTML = Object.entries(audioFiles).map(([id, file]) => `
                        <div class="library-item" onclick="app.audioEditor.loadFromLibrary('${file.url || id}')">
                            <span>🎵 ${file.name}</span>
                            <span style="color: #999;">${file.duration || ''}</span>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Error loading audio library:', error);
                const libraryList = document.getElementById('audio-library-list');
                if (libraryList) {
                    libraryList.innerHTML = '<p style="color: #f00;">Erreur lors du chargement de la bibliothèque</p>';
                }
            }
        }
    }

    async loadFromLibrary(audioFileId) {
        try {
            // Si c'est une URL S3 directe
            if (audioFileId.startsWith('http')) {
                const response = await fetch(audioFileId);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                // Reset volume envelope for loaded file
                this.volumePoints = [
                    { time: 0, volume: 1.0 },
                    { time: this.currentBuffer.duration, volume: 1.0 }
                ];
                
                this.drawWaveform();
                this.saveToHistory();
                
                // Update info
                document.getElementById('audio-duration').textContent = 
                    `Duration: ${this.currentBuffer.duration.toFixed(2)}s`;
                document.getElementById('audio-format').textContent = 
                    `Format: MP3`;
                    
                showNotification('Audio chargé depuis la bibliothèque', 'success');
            } else {
                // Ancienne méthode pour rétro-compatibilité
                const audioData = await window.app.storage.getAudioFile(audioFileId);
                if (audioData && audioData.data) {
                    // Si c'est une URL, charger directement
                    if (audioData.url) {
                        const response = await fetch(audioData.url);
                        const arrayBuffer = await response.arrayBuffer();
                        this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    } else if (audioData.data.includes('base64')) {
                        // Ancienne méthode base64
                        const base64 = audioData.data.split(',')[1];
                        const binary = atob(base64);
                        const arrayBuffer = new ArrayBuffer(binary.length);
                        const bytes = new Uint8Array(arrayBuffer);
                        
                        for (let i = 0; i < binary.length; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        
                        this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    }
                    
                    // Reset volume envelope for loaded file
                    this.volumePoints = [
                        { time: 0, volume: 1.0 },
                        { time: this.currentBuffer.duration, volume: 1.0 }
                    ];
                    
                    this.drawWaveform();
                    this.saveToHistory();
                    
                    // Update info
                    document.getElementById('audio-duration').textContent = 
                        `Duration: ${this.currentBuffer.duration.toFixed(2)}s`;
                    document.getElementById('audio-format').textContent = 
                        `Format: MP3`;
                        
                    showNotification('Audio chargé depuis la bibliothèque', 'success');
                }
            }
        } catch (error) {
            console.error('Error loading from library:', error);
            showNotification('Erreur lors du chargement de l\'audio', 'error');
        }
    }
}

// Export global
window.AudioEditor = AudioEditor;
