/**
 * Core Game Engine
 * Handles game loop, state management, and core systems coordination
 */

export class Engine {
    constructor(canvas) {
        this.canvas = canvas;
        this.isRunning = false;
        this.isPaused = false;
        
        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fixedDeltaTime = 1 / 60; // 60 FPS physics
        this.accumulator = 0;
        this.timeScale = 1;
        
        // State
        this.state = 'loading'; // loading, menu, playing, paused, finished
        this.previousState = null;
        
        // Systems (set by main.js)
        this.renderer = null;
        this.inputManager = null;
        this.camera = null;
        this.physics = null;
        this.game = null;
        this.ui = null;
        this.audio = null;
        
        // Callbacks
        this.onUpdate = null;
        this.onFixedUpdate = null;
        this.onRender = null;
        this.onStateChange = null;
        
        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
    }
    
    /**
     * Initialize the engine
     */
    init() {
        // Setup canvas sizing
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
        
        // Visibility change handling
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') {
                this.pause();
            }
        });
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        if (this.renderer) {
            this.renderer.handleResize(width, height);
        }
        
        if (this.camera) {
            this.camera.handleResize(width, height);
        }
    }
    
    /**
     * Start the game loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop);
    }
    
    /**
     * Stop the game loop
     */
    stop() {
        this.isRunning = false;
    }
    
    /**
     * Main game loop
     */
    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        // Calculate delta time
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
        this.lastTime = currentTime;
        
        // Skip updates if paused
        if (!this.isPaused && this.state === 'playing') {
            // Fixed timestep physics
            this.accumulator += this.deltaTime * this.timeScale;
            
            while (this.accumulator >= this.fixedDeltaTime) {
                if (this.onFixedUpdate) {
                    this.onFixedUpdate(this.fixedDeltaTime);
                }
                this.accumulator -= this.fixedDeltaTime;
            }
            
            // Variable timestep update
            if (this.onUpdate) {
                this.onUpdate(this.deltaTime * this.timeScale);
            }
        }
        
        // Always render
        if (this.onRender) {
            this.onRender(this.deltaTime);
        }
        
        requestAnimationFrame(this.gameLoop);
    }
    
    /**
     * Change game state
     */
    setState(newState) {
        if (this.state === newState) return;
        
        this.previousState = this.state;
        this.state = newState;
        
        if (this.onStateChange) {
            this.onStateChange(newState, this.previousState);
        }
    }
    
    /**
     * Pause the game
     */
    pause() {
        if (this.state !== 'playing') return;
        
        this.isPaused = true;
        this.setState('paused');
    }
    
    /**
     * Resume the game
     */
    resume() {
        if (this.state !== 'paused') return;
        
        this.isPaused = false;
        this.setState('playing');
    }
    
    /**
     * Get interpolation alpha for smooth rendering
     */
    getAlpha() {
        return this.accumulator / this.fixedDeltaTime;
    }
}
