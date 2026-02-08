/**
 * Input Manager
 * Handles keyboard, touch, and gamepad input with unified API
 */

export class InputManager {
    constructor() {
        // Keyboard state
        this.keys = {};
        this.keysJustPressed = {};
        this.keysJustReleased = {};

        // Touch state
        this.touches = {
            left: false,
            right: false,
            gas: false,
            brake: false,
            drift: false
        };

        // Gamepad state
        this.gamepad = null;
        this.gamepadState = {
            throttle: 0,
            brake: 0,
            steer: 0,
            drift: false,
            restart: false
        };

        // Unified input state
        this.input = {
            throttle: 0,      // 0-1
            brake: 0,         // 0-1
            steer: 0,         // -1 to 1
            drift: false,
            reset: false,
            restart: false,
            pause: false,
            cameraToggle: false
        };

        // Callbacks
        this.onRestart = null;
        this.onReset = null;
        this.onPause = null;
        this.onCameraToggle = null;

        this.init();
    }

    init() {
        // Keyboard events
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Touch events for mobile
        this.setupTouchControls();

        // Gamepad events
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            this.gamepad = e.gamepad;
        });

        window.addEventListener('gamepaddisconnected', () => {
            console.log('Gamepad disconnected');
            this.gamepad = null;
        });
    }

    onKeyDown(e) {
        if (!this.keys[e.code]) {
            this.keysJustPressed[e.code] = true;
        }
        this.keys[e.code] = true;

        // Prevent default for game keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
            e.preventDefault();
        }
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
        this.keysJustReleased[e.code] = true;
    }

    setupTouchControls() {
        const setupButton = (id, touchKey) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const start = () => { this.touches[touchKey] = true; };
            const end = () => { this.touches[touchKey] = false; };

            btn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
            btn.addEventListener('touchcancel', end);
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
        };

        setupButton('mobile-left', 'left');
        setupButton('mobile-right', 'right');
        setupButton('mobile-gas', 'gas');
        setupButton('mobile-brake', 'brake');
        setupButton('mobile-drift', 'drift');
    }

    updateGamepad() {
        // Get fresh gamepad state
        const gamepads = navigator.getGamepads();
        if (gamepads[0]) {
            const gp = gamepads[0];

            // Standard gamepad mapping
            this.gamepadState.throttle = gp.buttons[7]?.value || 0;  // RT
            this.gamepadState.brake = gp.buttons[6]?.value || 0;     // LT
            this.gamepadState.steer = gp.axes[0] || 0;               // Left stick X
            this.gamepadState.drift = gp.buttons[0]?.pressed || false; // A
            this.gamepadState.restart = gp.buttons[5]?.pressed || false; // RB
        }
    }

    update() {
        // Update gamepad
        this.updateGamepad();

        // Combine all input sources
        // Throttle
        let throttle = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle = 1;
        if (this.touches.gas) throttle = 1;
        throttle = Math.max(throttle, this.gamepadState.throttle);
        this.input.throttle = throttle;

        // Brake
        let brake = 0;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) brake = 1;
        if (this.touches.brake) brake = 1;
        brake = Math.max(brake, this.gamepadState.brake);
        this.input.brake = brake;

        // Steering
        let steer = 0;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) steer += 1;
        if (this.touches.left) steer -= 1;
        if (this.touches.right) steer += 1;
        if (Math.abs(this.gamepadState.steer) > 0.1) {
            steer = this.gamepadState.steer;
        }
        this.input.steer = Math.max(-1, Math.min(1, steer));

        // Drift
        this.input.drift = this.keys['Space'] || this.touches.drift || this.gamepadState.drift;

        // Action buttons (just pressed)
        this.input.reset = this.keysJustPressed['KeyR'];
        this.input.restart = this.keysJustPressed['Enter'] || this.gamepadState.restart;
        this.input.pause = this.keysJustPressed['Escape'];
        this.input.cameraToggle = this.keysJustPressed['KeyC'];

        // Fire callbacks
        if (this.input.reset && this.onReset) this.onReset();
        if (this.input.restart && this.onRestart) this.onRestart();
        if (this.input.pause && this.onPause) this.onPause();
        if (this.input.cameraToggle && this.onCameraToggle) this.onCameraToggle();

        // Clear just pressed/released
        this.keysJustPressed = {};
        this.keysJustReleased = {};
    }

    /**
     * Check if a key was just pressed this frame
     */
    isKeyJustPressed(code) {
        return this.keysJustPressed[code] || false;
    }

    /**
     * Check if a key is currently held
     */
    isKeyHeld(code) {
        return this.keys[code] || false;
    }

    /**
     * Get current input state
     */
    getInput() {
        return this.input;
    }
}
