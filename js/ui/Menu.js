/**
 * Menu System
 * Handles all menu screens and navigation
 */

import { Timer } from '../game/Timer.js';

export class Menu {
    constructor() {
        // Menu screens
        this.mainMenu = document.getElementById('main-menu');
        this.trackMenu = document.getElementById('track-menu');
        this.customizeMenu = document.getElementById('customize-menu');
        this.controlsMenu = document.getElementById('controls-menu');
        this.pauseMenu = document.getElementById('pause-menu');
        this.resultsScreen = document.getElementById('results-screen');

        // Mobile controls
        this.mobileControls = document.getElementById('mobile-controls');

        // State
        this.currentScreen = 'main';
        this.selectedTrackId = 'track1';
        this.selectedColor = '#ff3366';

        // Callbacks
        this.onPlay = null;
        this.onTrackSelect = null;
        this.onColorChange = null;
        this.onResume = null;
        this.onRestart = null;
        this.onQuit = null;

        // Track data (will be populated)
        this.tracks = [];

        this.init();
    }

    init() {
        // Main menu buttons
        document.getElementById('btn-play').addEventListener('click', () => {
            if (this.onPlay) this.onPlay(this.selectedTrackId);
        });

        document.getElementById('btn-tracks').addEventListener('click', () => {
            this.showScreen('tracks');
        });

        document.getElementById('btn-customize').addEventListener('click', () => {
            this.showScreen('customize');
        });

        document.getElementById('btn-controls').addEventListener('click', () => {
            this.showScreen('controls');
        });

        // Back buttons
        document.getElementById('btn-back-tracks').addEventListener('click', () => {
            this.showScreen('main');
        });

        document.getElementById('btn-back-customize').addEventListener('click', () => {
            this.showScreen('main');
        });

        document.getElementById('btn-back-controls').addEventListener('click', () => {
            this.showScreen('main');
        });

        // Pause menu buttons
        document.getElementById('btn-resume').addEventListener('click', () => {
            if (this.onResume) this.onResume();
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });

        document.getElementById('btn-quit').addEventListener('click', () => {
            if (this.onQuit) this.onQuit();
        });

        // Results screen buttons
        document.getElementById('btn-retry').addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });

        document.getElementById('btn-results-menu').addEventListener('click', () => {
            if (this.onQuit) this.onQuit();
        });

        // Color picker
        this.initColorPicker();

        // Check for mobile
        this.checkMobile();
    }

    initColorPicker() {
        const colorOptions = document.querySelectorAll('.color-option');

        colorOptions.forEach(option => {
            const color = option.dataset.color;
            option.style.backgroundColor = color;

            option.addEventListener('click', () => {
                // Update selection
                colorOptions.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');

                this.selectedColor = color;

                if (this.onColorChange) {
                    this.onColorChange(parseInt(color.replace('#', '0x'), 16));
                }
            });
        });
    }

    checkMobile() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            this.mobileControls.classList.remove('hidden');
        }
    }

    /**
     * Set available tracks
     */
    setTracks(tracks) {
        this.tracks = tracks;
        this.populateTrackGrid();
    }

    populateTrackGrid() {
        const grid = document.getElementById('track-grid');
        grid.innerHTML = '';

        this.tracks.forEach(track => {
            const card = document.createElement('div');
            card.className = 'track-card';
            if (track.id === this.selectedTrackId) {
                card.classList.add('selected');
            }

            // Get best time
            const bestKey = `polyracer_best_${track.id}`;
            const bestTime = localStorage.getItem(bestKey);
            const bestTimeFormatted = bestTime ? Timer.formatTime(parseFloat(bestTime)) : '--:--.---';

            card.innerHTML = `
                <div class="track-name">${track.name}</div>
                <div class="track-difficulty">${track.difficulty}</div>
                <div class="track-best">BEST: ${bestTimeFormatted}</div>
            `;

            card.addEventListener('click', () => {
                // Update selection
                document.querySelectorAll('.track-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                this.selectedTrackId = track.id;

                if (this.onTrackSelect) {
                    this.onTrackSelect(track.id);
                }
            });

            grid.appendChild(card);
        });
    }

    /**
     * Show a specific screen
     */
    showScreen(screen) {
        // Hide all screens
        this.mainMenu.classList.add('hidden');
        this.trackMenu.classList.add('hidden');
        this.customizeMenu.classList.add('hidden');
        this.controlsMenu.classList.add('hidden');
        this.pauseMenu.classList.add('hidden');
        this.resultsScreen.classList.add('hidden');

        // Show requested screen
        switch (screen) {
            case 'main':
                this.mainMenu.classList.remove('hidden');
                break;
            case 'tracks':
                this.populateTrackGrid(); // Refresh best times
                this.trackMenu.classList.remove('hidden');
                break;
            case 'customize':
                this.customizeMenu.classList.remove('hidden');
                break;
            case 'controls':
                this.controlsMenu.classList.remove('hidden');
                break;
            case 'pause':
                this.pauseMenu.classList.remove('hidden');
                break;
            case 'results':
                this.resultsScreen.classList.remove('hidden');
                break;
            case 'none':
                // Hide all (gameplay)
                break;
        }

        this.currentScreen = screen;
    }

    /**
     * Show results screen
     */
    showResults(time, bestTime, isNewRecord) {
        const resultTime = document.getElementById('result-time');
        const resultBest = document.getElementById('result-best');
        const newRecordEl = document.getElementById('new-record');
        const titleEl = document.getElementById('results-title');

        resultTime.textContent = Timer.formatTime(time);
        resultBest.textContent = Timer.formatTime(bestTime);

        if (isNewRecord) {
            newRecordEl.classList.remove('hidden');
            titleEl.textContent = '★ NEW RECORD! ★';
        } else {
            newRecordEl.classList.add('hidden');
            titleEl.textContent = 'RACE COMPLETE!';
        }

        this.showScreen('results');
    }

    /**
     * Show/hide mobile controls
     */
    showMobileControls(show) {
        if (show && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            this.mobileControls.classList.remove('hidden');
        } else {
            this.mobileControls.classList.add('hidden');
        }
    }

    /**
     * Hide all menus
     */
    hideAll() {
        this.showScreen('none');
    }
}
