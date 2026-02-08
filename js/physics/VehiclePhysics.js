/**
 * Vehicle Physics System
 * Arcade-style car physics with drifting
 */

import * as THREE from 'three';

export class VehiclePhysics {
    constructor() {
        // Physics state
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.quaternion = new THREE.Quaternion();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.angularVelocity = 0;

        // Ground state
        this.isGrounded = true;
        this.groundNormal = new THREE.Vector3(0, 1, 0);
        this.groundHeight = 0;

        // Vehicle properties
        this.config = {
            // Engine
            maxSpeed: 80,               // m/s (~288 km/h)
            acceleration: 25,           // m/s²
            brakeForce: 40,            // m/s²
            reverseMaxSpeed: 20,        // m/s

            // Steering
            maxSteerAngle: 0.8,         // radians
            steerSpeed: 3,              // how fast steering responds
            steerSpeedFactor: 0.7,      // reduce steering at high speed

            // Drifting
            driftFriction: 0.92,
            normalFriction: 0.98,
            driftSteerMultiplier: 1.5,
            driftSpeedBoost: 1.1,

            // Grip
            gripFront: 0.95,
            gripRear: 0.85,

            // Suspension
            suspensionHeight: 0.5,
            suspensionStiffness: 15,
            suspensionDamping: 3,

            // Gravity
            gravity: -30,
            airControl: 0.3
        };

        // Current state
        this.speed = 0;
        this.steerAngle = 0;
        this.isDrifting = false;
        this.driftFactor = 0;

        // Wheel positions (for ground checks)
        this.wheelOffsets = [
            new THREE.Vector3(-0.7, 0, 1.2),   // Front left
            new THREE.Vector3(0.7, 0, 1.2),    // Front right
            new THREE.Vector3(-0.7, 0, -1.2),  // Rear left
            new THREE.Vector3(0.7, 0, -1.2)    // Rear right
        ];

        // Collision
        this.boundingBox = new THREE.Box3();
        this.size = new THREE.Vector3(1.5, 1, 3);
    }

    /**
     * Reset physics state
     */
    reset(position, rotation = 0) {
        this.position.copy(position);
        this.position.y = position.y + 0.5;
        this.rotation.set(0, rotation, 0);
        this.quaternion.setFromEuler(this.rotation);
        this.velocity.set(0, 0, 0);
        this.angularVelocity = 0;
        this.speed = 0;
        this.steerAngle = 0;
        this.isDrifting = false;
        this.driftFactor = 0;
        this.isGrounded = true;
    }

    /**
     * Update physics
     */
    update(input, deltaTime, trackCollision) {
        // Get input
        const throttle = input.throttle;
        const brake = input.brake;
        const steer = input.steer;
        const drift = input.drift;

        // Ground check
        this.updateGroundState(trackCollision);

        if (this.isGrounded) {
            this.updateGroundedPhysics(throttle, brake, steer, drift, deltaTime);
        } else {
            this.updateAirPhysics(steer, deltaTime);
        }

        // Apply velocity
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // Update bounding box
        this.updateBoundingBox();

        // Calculate speed in km/h for display
        const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
        this.speed = this.velocity.dot(forwardDir);
    }

    updateGroundedPhysics(throttle, brake, steer, drift, dt) {
        const cfg = this.config;

        // Get forward direction
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);

        // Current speed along forward axis
        let forwardSpeed = this.velocity.dot(forward);
        let lateralSpeed = this.velocity.dot(right);

        // --- ACCELERATION & BRAKING ---
        if (throttle > 0 && forwardSpeed < cfg.maxSpeed) {
            forwardSpeed += cfg.acceleration * throttle * dt;
        }

        if (brake > 0) {
            if (forwardSpeed > 0) {
                // Braking
                forwardSpeed -= cfg.brakeForce * brake * dt;
                forwardSpeed = Math.max(0, forwardSpeed);
            } else if (forwardSpeed > -cfg.reverseMaxSpeed) {
                // Reversing
                forwardSpeed -= cfg.acceleration * brake * 0.5 * dt;
            }
        }

        // Natural deceleration
        if (throttle === 0 && brake === 0) {
            forwardSpeed *= 0.995;
        }

        // --- STEERING ---
        const speedFactor = 1 - Math.min(Math.abs(forwardSpeed) / cfg.maxSpeed, 1) * cfg.steerSpeedFactor;
        const targetSteer = steer * cfg.maxSteerAngle * speedFactor;

        // Smooth steering
        this.steerAngle += (targetSteer - this.steerAngle) * cfg.steerSpeed * dt;

        // --- DRIFTING ---
        if (drift && Math.abs(forwardSpeed) > 10) {
            this.isDrifting = true;
            this.driftFactor = Math.min(this.driftFactor + dt * 3, 1);
        } else {
            this.driftFactor = Math.max(this.driftFactor - dt * 5, 0);
            if (this.driftFactor < 0.1) this.isDrifting = false;
        }

        // Apply steering rotation
        let turnRate = this.steerAngle * (forwardSpeed / 20);

        if (this.isDrifting) {
            turnRate *= cfg.driftSteerMultiplier;
            // Add some counter-steer feel
            lateralSpeed *= cfg.driftFriction;
        } else {
            // Kill lateral velocity (grip)
            lateralSpeed *= cfg.normalFriction;
            lateralSpeed *= (1 - Math.min(Math.abs(forwardSpeed) / cfg.maxSpeed, 0.5));
        }

        // Apply turn
        this.rotation.y -= turnRate * dt;
        this.quaternion.setFromEuler(this.rotation);

        // Reconstruct velocity
        forward.set(0, 0, -1).applyQuaternion(this.quaternion);
        right.set(1, 0, 0).applyQuaternion(this.quaternion);

        this.velocity.copy(forward.multiplyScalar(forwardSpeed));
        this.velocity.add(right.multiplyScalar(lateralSpeed));

        // Align to ground
        this.alignToGround(dt);
    }

    updateAirPhysics(steer, dt) {
        const cfg = this.config;

        // Apply gravity
        this.velocity.y += cfg.gravity * dt;

        // Air control (limited)
        this.rotation.y -= steer * cfg.airControl * dt;
        this.quaternion.setFromEuler(this.rotation);
    }

    updateGroundState(trackCollision) {
        // Simple ground check - ray downward
        const rayStart = this.position.clone();
        rayStart.y += 1;

        if (trackCollision) {
            const hit = trackCollision.raycast(rayStart, new THREE.Vector3(0, -1, 0), 3);
            if (hit) {
                this.isGrounded = true;
                this.groundHeight = hit.point.y;
                this.groundNormal.copy(hit.normal);

                // Keep car on ground
                const targetY = this.groundHeight + this.config.suspensionHeight;
                const diff = targetY - this.position.y;

                this.velocity.y += diff * this.config.suspensionStiffness;
                this.velocity.y *= 1 - this.config.suspensionDamping * 0.016;

                return;
            }
        }

        // Fallback - simple ground plane
        if (this.position.y <= this.config.suspensionHeight) {
            this.isGrounded = true;
            this.groundHeight = 0;
            this.groundNormal.set(0, 1, 0);

            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }
            this.position.y = this.config.suspensionHeight;
        } else {
            this.isGrounded = false;
        }
    }

    alignToGround(dt) {
        // Gradually align car rotation to ground normal
        const up = new THREE.Vector3(0, 1, 0);
        const targetUp = this.groundNormal.clone();

        // Create rotation to align up vector with ground normal
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(up, targetUp);

        // Keep yaw, apply pitch/roll from ground
        const euler = new THREE.Euler().setFromQuaternion(q);

        this.rotation.x += (euler.x - this.rotation.x) * 5 * dt;
        this.rotation.z += (euler.z - this.rotation.z) * 5 * dt;

        this.quaternion.setFromEuler(this.rotation);
    }

    updateBoundingBox() {
        const halfSize = this.size.clone().multiplyScalar(0.5);
        this.boundingBox.setFromCenterAndSize(this.position, this.size);
    }

    /**
     * Get speed in km/h
     */
    getSpeedKmh() {
        return Math.abs(this.speed) * 3.6;
    }

    /**
     * Check collision with track bounds
     */
    checkTrackBounds(trackCollision) {
        if (!trackCollision) return false;

        // Check if car is on track
        return trackCollision.isOnTrack(this.position);
    }

    /**
     * Apply collision response
     */
    applyCollision(normal, penetration) {
        // Push out of collision
        this.position.add(normal.clone().multiplyScalar(penetration));

        // Reflect velocity
        const dot = this.velocity.dot(normal);
        if (dot < 0) {
            this.velocity.sub(normal.clone().multiplyScalar(dot * 1.5));
            this.velocity.multiplyScalar(0.7); // Lose some speed
        }
    }

    /**
     * Apply boost
     */
    applyBoost(multiplier = 1.5, duration = 0.5) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
        const boostSpeed = Math.min(this.speed * multiplier, this.config.maxSpeed * 1.2);
        this.velocity.copy(forward.multiplyScalar(boostSpeed));
    }
}
