/**
 * Poly Racer - Main Entry Point
 * Initializes and coordinates all game systems
 */

import * as THREE from 'three';

// Make THREE available globally for all modules
window.THREE = THREE;

// Engine
import { Engine } from './engine/Engine.js';
import { Renderer } from './engine/Renderer.js';
import { InputManager } from './engine/InputManager.js';
import { Camera } from './engine/Camera.js';

// Physics
import { VehiclePhysics } from './physics/VehiclePhysics.js';
import { CollisionSystem } from './physics/CollisionSystem.js';

// Game
import { Game } from './game/Game.js';
import { Vehicle } from './game/Vehicle.js';
import { GhostCar } from './game/GhostCar.js';

// Track
import { SplineTrackBuilder } from './track/SplineTrackBuilder.js';

// UI
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { SoundManager } from './audio/SoundManager.js';

// Effects
import { ParticleSystem } from './effects/ParticleSystem.js';

class PolyRacer {
    constructor() {
        // Get canvas
        this.canvas = document.getElementById('game-canvas');

        // Core systems
        this.engine = new Engine(this.canvas);
        this.renderer = new Renderer(this.canvas);
        this.inputManager = new InputManager();
        this.camera = new Camera();

        // Physics
        this.physics = new VehiclePhysics();
        this.collision = new CollisionSystem();

        // Game
        this.game = new Game(this.engine);
        this.vehicle = new Vehicle(this.renderer);
        this.ghostCar = new GhostCar(this.renderer);
        this.trackBuilder = new SplineTrackBuilder(this.renderer, this.collision);

        // Effects
        this.particles = new ParticleSystem(this.renderer);

        // Audio
        this.soundManager = new SoundManager();

        // UI
        this.hud = new HUD();
        this.menu = new Menu();

        // Track data
        this.tracks = [
            { id: 'track1', name: 'Beginner Circuit', difficulty: 'Easy' },
            { id: 'track2', name: 'Mountain Rise', difficulty: 'Medium' },
            { id: 'track3', name: 'Adrenaline Rush', difficulty: 'Hard' }
        ];

        // Current track data
        this.currentTrackData = null;

        // Bind methods
        this.update = this.update.bind(this);
        this.fixedUpdate = this.fixedUpdate.bind(this);
        this.render = this.render.bind(this);
    }

    async init() {
        console.log('Initializing Poly Racer...');

        // Update loading progress
        this.updateLoadingProgress(10, 'Initializing engine...');

        // Initialize engine
        this.engine.init();

        // Link systems
        this.game.physics = this.physics;
        this.game.vehicle = this.vehicle;
        this.game.ghostCar = this.ghostCar;
        this.game.collision = this.collision;
        this.game.trackBuilder = this.trackBuilder;
        this.game.soundManager = this.soundManager;

        this.updateLoadingProgress(30, 'Loading assets...');

        // Add vehicle to scene
        this.vehicle.addToScene(this.renderer.scene);
        this.ghostCar.addToScene(this.renderer.scene);

        this.updateLoadingProgress(50, 'Setting up UI...');

        // Setup menu
        this.menu.setTracks(this.tracks);
        this.setupMenuCallbacks();

        this.updateLoadingProgress(70, 'Loading track...');

        // Load default track
        await this.loadTrack('track1');

        this.updateLoadingProgress(90, 'Finalizing...');

        // Setup input callbacks
        this.setupInputCallbacks();

        // Setup game callbacks
        this.setupGameCallbacks();

        // Set engine callbacks
        this.engine.onUpdate = this.update;
        this.engine.onFixedUpdate = this.fixedUpdate;
        this.engine.onRender = this.render;

        this.updateLoadingProgress(100, 'Ready!');

        // Start engine
        this.engine.start();

        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 500);

        console.log('Poly Racer initialized!');
    }

    updateLoadingProgress(percent, text) {
        const progress = document.getElementById('loader-progress');
        const textEl = document.getElementById('loader-text');

        if (progress) progress.style.width = `${percent}%`;
        if (textEl) textEl.textContent = text;
    }

    async loadTrack(trackId) {
        try {
            const response = await fetch(`tracks/${trackId}.json`);
            if (!response.ok) {
                throw new Error(`Failed to fetch track: ${response.status}`);
            }
            const trackData = await response.json();
            this.currentTrackData = trackData;

            await this.game.loadTrack(trackData, trackId);

            // Reset camera
            this.camera.setPosition(
                this.game.spawnPosition.x,
                this.game.spawnPosition.y + 10,
                this.game.spawnPosition.z + 20
            );
            this.camera.setLookAt(
                this.game.spawnPosition.x,
                this.game.spawnPosition.y,
                this.game.spawnPosition.z
            );

            return trackData;
        } catch (error) {
            console.error('Failed to load track:', error);
            return null;
        }
    }

    setupMenuCallbacks() {
        this.menu.onPlay = async (trackId) => {
            this.menu.hideAll();
            await this.loadTrack(trackId);
            this.game.resetRace();
            this.hud.show();
            this.menu.showMobileControls(true);
            await this.game.startCountdown();
            this.engine.setState('playing');
        };

        this.menu.onTrackSelect = async (trackId) => {
            await this.loadTrack(trackId);
        };

        this.menu.onColorChange = (color) => {
            this.vehicle.setColor(color);
        };

        this.menu.onResume = () => {
            this.menu.hideAll();
            this.game.resume();
            this.engine.resume();
        };

        this.menu.onRestart = async () => {
            this.menu.hideAll();
            this.game.resetRace();
            this.hud.show();
            await this.game.startCountdown();
            this.engine.setState('playing');
        };

        this.menu.onQuit = () => {
            this.hud.hide();
            this.menu.showMobileControls(false);
            this.game.resetRace();
            this.engine.setState('menu');
            this.menu.showScreen('main');
        };
    }

    setupInputCallbacks() {
        this.inputManager.onReset = () => {
            if (this.game.state === 'playing') {
                this.game.resetToCheckpoint();
            }
        };

        this.inputManager.onRestart = () => {
            if (this.game.state === 'playing' || this.game.state === 'finished') {
                this.menu.onRestart();
            }
        };

        this.inputManager.onPause = () => {
            if (this.game.state === 'playing') {
                this.game.pause();
                this.engine.pause();
                this.menu.showScreen('pause');
            } else if (this.game.state === 'paused') {
                this.menu.onResume();
            }
        };

        this.inputManager.onCameraToggle = () => {
            this.camera.toggleMode();
        };
    }

    setupGameCallbacks() {
        this.game.onCheckpoint = (index, isFinish) => {
            this.hud.showCheckpoint(isFinish);
            this.camera.shake(0.3, 0.2);
        };

        this.game.onFinish = (time, bestTime, isNewRecord) => {
            this.hud.hide();
            this.menu.showResults(time, bestTime, isNewRecord);
        };

        this.game.onBoost = () => {
            this.camera.shake(0.2, 0.1);
        };
    }

    /**
     * Fixed timestep update (physics)
     */
    fixedUpdate(deltaTime) {
        if (this.game.state !== 'playing') return;

        const input = this.inputManager.getInput();

        // Update physics
        this.physics.update(input, deltaTime, this.collision);

        // Update vehicle visual
        this.vehicle.update(this.physics, deltaTime);
    }

    /**
     * Variable timestep update
     */
    update(deltaTime) {
        // Update input
        this.inputManager.update();

        if (this.game.state === 'playing') {
            const input = this.inputManager.getInput();

            // Update game logic
            this.game.update(deltaTime, input);

            // Update HUD
            this.hud.update(this.game);

            // Emit drift particles
            if (this.physics.isDrifting && this.physics.isGrounded) {
                const rearPos = this.physics.position.clone();
                rearPos.y = 0.1;
                const dir = new THREE.Vector3(0, 0.5, 1).applyQuaternion(this.physics.quaternion);
                this.particles.emitDrift(rearPos, dir);

                // Smoke
                this.particles.emitTireSmoke(this.physics.wheelOffsets[2].clone().applyQuaternion(this.physics.quaternion).add(this.physics.position));
                this.particles.emitTireSmoke(this.physics.wheelOffsets[3].clone().applyQuaternion(this.physics.quaternion).add(this.physics.position));

                // Sound
                this.soundManager.startDrift();
            } else {
                this.soundManager.stopDrift();
            }

            // Engine sound
            const speedRatio = Math.min(Math.abs(this.physics.speed) / this.physics.config.maxSpeed, 1);
            this.soundManager.updateEngine(speedRatio);
            this.soundManager.startEngine(); // Ensure it's running
        } else {
            // Stop drift sound if not playing
            this.soundManager.stopDrift();
        }


        // Update particles
        this.particles.update(deltaTime);

        // Update camera
        this.camera.update(this.vehicle, deltaTime, this.physics.getSpeedKmh());

        // Update sun position to follow car
        this.renderer.updateSunPosition(this.physics.position);
    }

    /**
     * Render
     */
    render(deltaTime) {
        this.renderer.render(this.camera);
    }
}

// Start game when DOM is ready
async function startGame() {
    try {
        console.log('THREE.js version:', THREE.REVISION);
        const game = new PolyRacer();
        await game.init();
    } catch (error) {
        console.error('Failed to initialize game:', error);
        document.getElementById('loader-text').textContent = 'Error: ' + error.message;
    }
}

// Ensure DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    startGame();
}
