/**
 * HUD - In-game heads-up display
 */

import { Timer } from './Timer.js';

export class HUD {
    constructor() {
        // Cache DOM elements
        this.hud = document.getElementById('hud');
        this.currentTimeEl = document.getElementById('current-time');
        this.bestTimeEl = document.getElementById('best-time');
        this.speedValueEl = document.getElementById('speed-value');
        this.lapCounterEl = document.getElementById('lap-counter');
        this.checkpointFlashEl = document.getElementById('checkpoint-flash');

        this.visible = false;
    }

    /**
     * Show the HUD
     */
    show() {
        this.hud.classList.remove('hidden');
        this.visible = true;
    }

    /**
     * Hide the HUD
     */
    hide() {
        this.hud.classList.add('hidden');
        this.visible = false;
    }

    /**
     * Update HUD values
     */
    update(game) {
        if (!this.visible) return;

        // Update time
        this.currentTimeEl.textContent = game.getFormattedTime();

        // Update best time
        const bestTime = game.getFormattedBestTime();
        this.bestTimeEl.textContent = `BEST: ${bestTime}`;

        // Update speed
        const speed = Math.round(game.getSpeed());
        this.speedValueEl.textContent = speed;

        // Update lap counter
        const lap = game.getLapInfo();
        this.lapCounterEl.textContent = `LAP ${lap.current}/${lap.total}`;
    }

    /**
     * Flash checkpoint indicator
     */
    showCheckpoint(isFinish = false) {
        this.checkpointFlashEl.textContent = isFinish ? 'FINISH!' : 'CHECKPOINT';
        this.checkpointFlashEl.classList.remove('hidden');

        // Re-trigger animation
        this.checkpointFlashEl.style.animation = 'none';
        this.checkpointFlashEl.offsetHeight;
        this.checkpointFlashEl.style.animation = null;

        // Hide after animation
        setTimeout(() => {
            this.checkpointFlashEl.classList.add('hidden');
        }, 500);
    }

    /**
     * Reset HUD
     */
    reset() {
        this.currentTimeEl.textContent = '00:00.000';
        this.speedValueEl.textContent = '0';
    }
}
