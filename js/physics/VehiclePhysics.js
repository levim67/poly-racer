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
            maxSpeed: 90,               // m/s (~324 km/h)
            acceleration: 30,           // m/s²
            brakeForce: 40,            // m/s²
            reverseMaxSpeed: 20,        // m/s

            // Steering
            maxSteerAngle: 0.8,         // radians
            steerSpeed: 5,              // faster steering response
            steerSpeedFactor: 0.7,      // reduce steering at high speed

            // Drifting
            driftFriction: 0.96,        // higher grip while drifting
            normalFriction: 0.98,
            driftSteerMultiplier: 1.2,
            driftSpeedBoost: 1.1,

            // Grip
            gripFront: 0.98,
            gripRear: 0.90,

            // Suspension
            suspensionHeight: 0.4,      // Lowered to fix floating look
            suspensionStiffness: 30,    // Stiffer suspension
            suspensionDamping: 6,

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

        // 1. Suspension & Ground Check
        this.updateSuspension(trackCollision, deltaTime);

        if (this.isGrounded) {
            this.updateGroundedPhysics(throttle, brake, steer, drift, deltaTime);
        } else {
            this.updateAirPhysics(steer, deltaTime);
        }

        // Apply velocity
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // Apply rotation
        this.rotation.setFromQuaternion(this.quaternion);

        // Update bounding box
        this.updateBoundingBox();

        // Calculate speed in km/h
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
        // Poly Track style: Turn + Brake = Drift
        const isTurning = Math.abs(steer) > 0.5;
        const isBraking = brake > 0;
        const isFastEnough = Math.abs(forwardSpeed) > 10;

        const shouldDrift = drift || (isTurning && isBraking && isFastEnough);

        if (shouldDrift) {
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

        // --- ARTIFICIAL GRAVITY (STICK TO TRACK) ---
        // Pull towards the ground normal (allows loops/wall driving)
        // gravity is negative (-30), so we multiply by Normal to get Downward force relative to surface?
        // Wait, Normal is Up. We want Down. So Normal * Gravity (negative) is correct.
        const gravityVector = this.groundNormal.clone().multiplyScalar(cfg.gravity * dt);
        this.velocity.add(gravityVector);

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

    updateSuspension(trackCollision, dt) {
        let groundedWheels = 0;
        let avgNormal = new THREE.Vector3(0, 0, 0);

        // Down direction relative to car
        const down = new THREE.Vector3(0, -1, 0).applyQuaternion(this.quaternion);

        this.wheelOffsets.forEach(offset => {
            // Get wheel world position
            const wheelPos = offset.clone().applyQuaternion(this.quaternion).add(this.position);
            const rayStart = wheelPos.clone().add(this.quaternion.clone().multiply(new THREE.Vector3(0, 0.5, 0))); // Start slightly up

            if (trackCollision) {
                // Cast ray down
                // Max distance = offset (0.5) + suspension height (0.4) + extra (0.2)
                const hit = trackCollision.raycast(rayStart, down, 1.1);

                if (hit) {
                    groundedWheels++;
                    avgNormal.add(hit.normal);

                    // Suspension Force
                    // Compression = 1 - (distance / restLength)
                    const distance = hit.distance;
                    const restLength = 0.5 + this.config.suspensionHeight;

                    if (distance < restLength) {
                        const compression = 1 - (distance / restLength);
                        const forceVal = compression * this.config.suspensionStiffness;

                        // Apply force 
                        // Simplified: Add to velocity in direction of normal
                        // Dampening
                        const damp = this.velocity.dot(hit.normal) * this.config.suspensionDamping;
                        const totalForce = (forceVal - damp) * dt;

                        this.velocity.add(hit.normal.clone().multiplyScalar(totalForce));
                    }
                }
            }
        });

        if (groundedWheels > 0) {
            this.isGrounded = true;
            this.groundNormal.copy(avgNormal.divideScalar(groundedWheels).normalize());

            // Align car to ground (Stabilizer)
            this.alignToGround(dt);
        } else {
            this.isGrounded = false;
            // Don't reset ground normal immediately to avoid snapping
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
