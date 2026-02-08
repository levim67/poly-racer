/**
 * Camera System
 * Chase camera with smooth following and first-person mode
 */

import * as THREE from 'three';

export class Camera {
    constructor() {
        // Three.js camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        // Camera modes
        this.mode = 'chase'; // 'chase', 'first-person', 'orbit'

        // Chase camera settings
        this.chaseDistance = 12;
        this.chaseHeight = 5;
        this.chaseLookAhead = 5;
        this.chaseSmoothness = 5;

        // First-person settings
        this.fpOffset = new THREE.Vector3(0, 1.5, 0.5);

        // Current position/rotation
        this.currentPosition = new THREE.Vector3(0, 10, 20);
        this.currentLookAt = new THREE.Vector3(0, 0, 0);

        // Shake effect
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTime = 0;

        // Speed effect (FOV increase)
        this.baseFOV = 60;
        this.maxFOV = 80;
        this.currentFOV = 60;

        this.camera.position.copy(this.currentPosition);
    }

    /**
     * Handle window resize
     */
    handleResize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Toggle camera mode
     */
    toggleMode() {
        if (this.mode === 'chase') {
            this.mode = 'first-person';
        } else {
            this.mode = 'chase';
        }
    }

    /**
     * Update camera to follow target
     */
    update(target, deltaTime, speed = 0) {
        if (!target) return;

        // Update shake
        this.updateShake(deltaTime);

        // Update FOV based on speed
        this.updateFOV(speed, deltaTime);

        if (this.mode === 'chase') {
            this.updateChaseCamera(target, deltaTime);
        } else if (this.mode === 'first-person') {
            this.updateFirstPersonCamera(target);
        }

        // Apply shake
        this.applyShake();
    }

    updateChaseCamera(target, deltaTime) {
        // Get target's position and direction
        const targetPos = target.position.clone();
        const targetDir = new THREE.Vector3(0, 0, -1);
        targetDir.applyQuaternion(target.quaternion);

        // Calculate ideal camera position
        const idealOffset = targetDir.clone().multiplyScalar(-this.chaseDistance);
        idealOffset.y = this.chaseHeight;
        const idealPosition = targetPos.clone().add(idealOffset);

        // Calculate look-at point (ahead of car)
        const lookAhead = targetDir.clone().multiplyScalar(this.chaseLookAhead);
        const idealLookAt = targetPos.clone().add(lookAhead);
        idealLookAt.y += 1;

        // Smooth interpolation
        const lerpFactor = 1 - Math.exp(-this.chaseSmoothness * deltaTime);
        this.currentPosition.lerp(idealPosition, lerpFactor);
        this.currentLookAt.lerp(idealLookAt, lerpFactor);

        // Apply to camera
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);
    }

    updateFirstPersonCamera(target) {
        // Position camera inside the car
        const offset = this.fpOffset.clone();
        offset.applyQuaternion(target.quaternion);

        this.camera.position.copy(target.position).add(offset);

        // Look forward
        const lookAt = target.position.clone();
        const forward = new THREE.Vector3(0, 0, -10);
        forward.applyQuaternion(target.quaternion);
        lookAt.add(forward);
        lookAt.y += 1;

        this.camera.lookAt(lookAt);
    }

    updateFOV(speed, deltaTime) {
        // Increase FOV with speed for dramatic effect
        const speedFactor = Math.min(speed / 200, 1); // Max at 200 km/h
        const targetFOV = this.baseFOV + (this.maxFOV - this.baseFOV) * speedFactor * 0.5;

        this.currentFOV += (targetFOV - this.currentFOV) * deltaTime * 5;
        this.camera.fov = this.currentFOV;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Apply camera shake
     */
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeTime = 0;
    }

    updateShake(deltaTime) {
        if (this.shakeDuration > 0) {
            this.shakeTime += deltaTime;
            if (this.shakeTime >= this.shakeDuration) {
                this.shakeDuration = 0;
                this.shakeIntensity = 0;
            }
        }
    }

    applyShake() {
        if (this.shakeIntensity > 0 && this.shakeDuration > 0) {
            const progress = this.shakeTime / this.shakeDuration;
            const fadeOut = 1 - progress;
            const intensity = this.shakeIntensity * fadeOut;

            this.camera.position.x += (Math.random() - 0.5) * intensity;
            this.camera.position.y += (Math.random() - 0.5) * intensity;
        }
    }

    /**
     * Set camera position instantly
     */
    setPosition(x, y, z) {
        this.currentPosition.set(x, y, z);
        this.camera.position.set(x, y, z);
    }

    /**
     * Set look-at point instantly
     */
    setLookAt(x, y, z) {
        this.currentLookAt.set(x, y, z);
        this.camera.lookAt(this.currentLookAt);
    }
}
