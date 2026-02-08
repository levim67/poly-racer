import * as THREE from 'three';
import { Timer } from './RaceTimer.js';

export class Game {
    constructor(engine) {
        this.engine = engine;

        // Game state
        this.state = 'menu'; // menu, countdown, playing, paused, finished
        this.currentTrack = null;
        this.currentTrackId = 'track1';

        // Spawn position
        this.spawnPosition = new THREE.Vector3(0, 0.5, 5);
        this.spawnRotation = 0;

        // Race state
        this.timer = new Timer();
        this.currentCheckpoint = 1; // Start looking for first checkpoint (skip start line)
        this.totalCheckpoints = 0;
        this.lastCheckpointPosition = null;
        this.lastCheckpointRotation = 0;

        // Components (set by main.js)
        this.vehicle = null;
        this.physics = null;
        this.ghostCar = null;
        this.collision = null;
        this.trackBuilder = null;

        // Recording
        this.isRecordingGhost = false;
        this.currentGhostData = null;

        // Race control
        this.waitingForStart = false;
        this.countdownInterval = null;

        // Callback
        this.onCheckpoint = null;
        this.onFinish = null;
        this.onBoost = null;
    }

    /**
     * Load and start a track
     */
    async loadTrack(trackData, trackId) {
        this.currentTrackId = trackId;
        this.currentTrack = trackData;

        // Build track
        const trackInfo = this.trackBuilder.build(trackData);

        // Set spawn
        this.spawnPosition = trackInfo.spawnPosition;
        this.spawnRotation = trackInfo.spawnRotation;
        this.totalCheckpoints = trackInfo.checkpointCount;

        // Load best time
        this.timer.checkBestTime(trackId);

        // Load ghost
        if (this.ghostCar) {
            const ghostData = this.ghostCar.loadGhost(trackId);
            if (ghostData) {
                this.currentGhostData = ghostData;
            }
        }

        // Reset race
        this.resetRace();
    }

    /**
     * Reset race to start
     */
    resetRace() {
        this.stopCountdown();
        this.waitingForStart = false;

        // Reset physics
        if (this.physics) {
            this.physics.reset(this.spawnPosition, this.spawnRotation);
        }

        // Reset timer
        this.timer.reset();
        this.timer.totalLaps = this.currentTrack?.laps || 1;

        // Reset checkpoints
        this.currentCheckpoint = 1; // Skip start line
        this.lastCheckpointPosition = this.spawnPosition.clone();
        this.lastCheckpointRotation = this.spawnRotation;

        // Reset ghost
        if (this.ghostCar) {
            this.ghostCar.stopPlayback();
            this.ghostCar.stopRecording();
        }

        this.state = 'ready';
    }

    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) countdownEl.classList.add('hidden');
    }

    /**
     * Start countdown
     */
    startCountdown() {
        this.stopCountdown(); // Ensure clear first
        this.state = 'countdown';

        return new Promise(resolve => {
            let count = 3;

            const countdownEl = document.getElementById('countdown');
            const numberEl = document.getElementById('countdown-number');

            countdownEl.classList.remove('hidden');
            numberEl.textContent = count;

            this.countdownInterval = setInterval(() => {
                count--;

                if (count > 0) {
                    numberEl.textContent = count;
                    // Re-trigger animation
                    numberEl.style.animation = 'none';
                    numberEl.offsetHeight; // Trigger reflow
                    numberEl.style.animation = null;
                } else if (count === 0) {
                    numberEl.textContent = 'GO!';
                    numberEl.style.animation = 'none';
                    numberEl.offsetHeight;
                    numberEl.style.animation = null;
                } else {
                    this.stopCountdown();
                    this.startRace();
                    resolve();
                }
            }, 1000);
        });
    }

    /**
     * Start the race
     */
    startRace() {
        this.state = 'playing';
        this.waitingForStart = true;
        // Timer starts on first input
    }

    /**
     * Update game logic
     */
    update(deltaTime, input) {
        if (this.state !== 'playing') return;

        // Wait for input to start timer
        if (this.waitingForStart) {
            if (input.throttle > 0 || input.brake > 0 || input.steer !== 0) {
                this.waitingForStart = false;
                this.timer.start();

                // Start ghost recording/playback now
                if (this.ghostCar) {
                    this.ghostCar.startRecording();
                    if (this.currentGhostData) {
                        this.ghostCar.startPlayback(this.currentGhostData);
                    }
                }
            } else {
                return; // Wait
            }
        }

        // Update timer
        this.timer.update();

        // Check boost pads
        const boost = this.collision.checkBoostPad(this.physics.position);
        if (boost.hit) {
            this.physics.applyBoost(1.2);
            if (this.onBoost) this.onBoost();
            if (this.soundManager) this.soundManager.playBoost(); // Direct call
        }

        // Check checkpoints
        const checkpoint = this.collision.checkCheckpoint(this.physics.position);
        if (checkpoint.hit) {
            this.handleCheckpoint(checkpoint);
            if (this.soundManager) this.soundManager.playCheckpoint(); // Direct call
        }

        // Record ghost
        if (this.ghostCar && this.ghostCar.isRecording) {
            this.ghostCar.recordFrame(
                this.physics.position,
                this.physics.quaternion,
                this.timer.getTime()
            );
        }

        // Update ghost playback
        if (this.ghostCar && this.ghostCar.isPlaying) {
            this.ghostCar.update(this.timer.getTime());
        }

        // Check barrier collisions
        const barrier = this.collision.checkBarrierCollision(this.physics.boundingBox);
        if (barrier.collided) {
            this.physics.applyCollision(barrier.normal, barrier.penetration);
        }
    }

    handleCheckpoint(checkpoint) {
        // Must hit checkpoints in order (with wrapping)
        // If total is 0 (no checkpoints), ignore
        if (this.totalCheckpoints === 0) return;

        const expectedIndex = this.currentCheckpoint % this.totalCheckpoints;
        if (checkpoint.index !== expectedIndex) return;

        // Save checkpoint
        this.lastCheckpointPosition = this.physics.position.clone();
        this.lastCheckpointRotation = this.physics.rotation.y;

        this.currentCheckpoint++;

        if (this.onCheckpoint) {
            this.onCheckpoint(checkpoint.index, checkpoint.isFinish);
        }

        // Check if finish line
        if (checkpoint.isFinish) {
            this.handleFinish();
        }
    }

    handleFinish() {
        // Check if final lap
        if (this.timer.currentLap >= this.timer.totalLaps) {
            this.finishRace();
        } else {
            // Record lap, continue racing
            this.timer.recordLap();
            this.currentCheckpoint = 0;
        }
    }

    /**
     * Finish the race
     */
    finishRace() {
        const finalTime = this.timer.stop();
        this.state = 'finished';

        // Stop ghost recording
        let ghostData = null;
        if (this.ghostCar) {
            ghostData = this.ghostCar.stopRecording();
            this.ghostCar.stopPlayback();
        }

        // Check for new record
        const isNewRecord = this.timer.saveBestTime(this.currentTrackId, finalTime);

        // Save ghost if new record
        if (isNewRecord && ghostData && this.ghostCar) {
            this.ghostCar.saveGhost(this.currentTrackId, ghostData);
            this.currentGhostData = ghostData;
        }

        if (this.onFinish) {
            this.onFinish(finalTime, this.timer.bestTime, isNewRecord);
        }
    }

    /**
     * Reset to last checkpoint
     */
    resetToCheckpoint() {
        if (this.state !== 'playing') return;

        this.physics.reset(this.lastCheckpointPosition, this.lastCheckpointRotation);
    }

    /**
     * Pause the game
     */
    pause() {
        if (this.state === 'playing') {
            this.state = 'paused';
        }
    }

    /**
     * Resume the game
     */
    resume() {
        if (this.state === 'paused') {
            this.state = 'playing';
        }
    }

    /**
     * Get current speed in km/h
     */
    getSpeed() {
        return this.physics ? this.physics.getSpeedKmh() : 0;
    }

    /**
     * Get formatted time
     */
    getFormattedTime() {
        return this.timer.getFormattedTime();
    }

    /**
     * Get formatted best time
     */
    getFormattedBestTime() {
        return this.timer.getFormattedBestTime();
    }

    /**
     * Get lap info
     */
    getLapInfo() {
        return {
            current: this.timer.currentLap,
            total: this.timer.totalLaps
        };
    }
}
