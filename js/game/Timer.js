/**
 * Timer System
 * High-precision timing for races
 */

export class Timer {
    constructor() {
        this.startTime = 0;
        this.currentTime = 0;
        this.lapTimes = [];
        this.bestTime = null;
        this.isRunning = false;

        // Lap state
        this.currentLap = 0;
        this.totalLaps = 1;
        this.lapStartTime = 0;
    }

    /**
     * Start the timer
     */
    start() {
        this.startTime = performance.now();
        this.lapStartTime = this.startTime;
        this.currentTime = 0;
        this.lapTimes = [];
        this.currentLap = 1;
        this.isRunning = true;
    }

    /**
     * Stop the timer
     */
    stop() {
        if (this.isRunning) {
            this.currentTime = performance.now() - this.startTime;
            this.isRunning = false;
        }
        return this.currentTime;
    }

    /**
     * Reset the timer
     */
    reset() {
        this.startTime = 0;
        this.currentTime = 0;
        this.lapTimes = [];
        this.currentLap = 0;
        this.isRunning = false;
    }

    /**
     * Update timer (call each frame)
     */
    update() {
        if (this.isRunning) {
            this.currentTime = performance.now() - this.startTime;
        }
    }

    /**
     * Record lap time
     */
    recordLap() {
        if (!this.isRunning) return null;

        const now = performance.now();
        const lapTime = now - this.lapStartTime;

        this.lapTimes.push(lapTime);
        this.lapStartTime = now;
        this.currentLap++;

        return lapTime;
    }

    /**
     * Check if race is finished
     */
    isFinished() {
        return this.currentLap > this.totalLaps;
    }

    /**
     * Get current time in milliseconds
     */
    getTime() {
        return this.currentTime;
    }

    /**
     * Get current lap time
     */
    getCurrentLapTime() {
        if (!this.isRunning) return 0;
        return performance.now() - this.lapStartTime;
    }

    /**
     * Set and check best time
     */
    checkBestTime(trackId) {
        const key = `polyracer_best_${trackId}`;
        const saved = localStorage.getItem(key);

        if (saved) {
            this.bestTime = parseFloat(saved);
        } else {
            this.bestTime = null;
        }

        return this.bestTime;
    }

    /**
     * Save best time if new record
     */
    saveBestTime(trackId, time) {
        const key = `polyracer_best_${trackId}`;

        if (this.bestTime === null || time < this.bestTime) {
            localStorage.setItem(key, time.toString());
            this.bestTime = time;
            return true; // New record
        }

        return false;
    }

    /**
     * Format time to string (MM:SS.mmm)
     */
    static formatTime(ms) {
        if (ms === null || ms === undefined) return '--:--.---';

        const totalSeconds = ms / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const milliseconds = Math.floor(ms % 1000);

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }

    /**
     * Get formatted current time
     */
    getFormattedTime() {
        return Timer.formatTime(this.currentTime);
    }

    /**
     * Get formatted best time
     */
    getFormattedBestTime() {
        return Timer.formatTime(this.bestTime);
    }
}
