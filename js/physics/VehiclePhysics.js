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
            maxSteerAngle: 0.6,         // radians (~35 degrees)
            steerSpeed: 4,              // Slower, weightier steering
            steerSpeedFactor: 0.5,      // reduce steering at high speed

            // Grip / Tire Model
            normalFriction: 1.1,        // Baseline grip
            tireStiffness: 15.0,        // Cornering stiffness
            slipLimit: 0.3,             // Peak slip angle

            // Aerodynamics
            downforce: 1.5,             // Aero grip multiplier

            // Suspension
            suspensionHeight: 0.4,
            suspensionStiffness: 40,    // Stiffer for racing
            suspensionDamping: 8,       // Higher damping

            // Gravity
            gravity: -40,               // Stronger gravity for weight
            airControl: 0.1             // Very little air control (Realism)
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

        // Get local velocity
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion);

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

        // Natural deceleration (rolling resistance + drag)
        if (throttle === 0 && brake === 0) {
            forwardSpeed -= forwardSpeed * 0.5 * dt;
        }

        // --- STEERING ---
        // Speed sensitive steering
        const speedFactor = 1 - Math.min(Math.abs(forwardSpeed) / cfg.maxSpeed, 1) * cfg.steerSpeedFactor;
        const targetSteer = steer * cfg.maxSteerAngle * speedFactor;

        // Smooth steering
        this.steerAngle += (targetSteer - this.steerAngle) * cfg.steerSpeed * dt;

        // --- TIRE FORCE (PACEJKA LITE) ---
        // Calculate Slip Angle
        // slip = atan(v_lat / v_long) - steer
        // We calculate needed lateral force to follow steer, then cap it by grip.

        // Desired rotation
        const wheelBase = 2.5;
        const ackermannYawRate = (forwardSpeed / wheelBase) * Math.tan(this.steerAngle);

        this.rotation.y += ackermannYawRate * dt;
        this.quaternion.setFromEuler(this.rotation);

        // 2. Lateral Friction (Rear Wheels resisting slide)
        // If we rotate too fast vs vector, we slide.
        // Vector is updated below by re-projecting.

        // Calculate localized velocity again after rotation
        const newForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
        const newRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);

        let vForward = this.velocity.dot(newForward);
        let vLateral = this.velocity.dot(newRight);

        // Grip Limit
        // Normal force = 1 (approx mass) * Gravity + Downforce
        const downforce = Math.abs(forwardSpeed) * 1.5; // Aero
        const normalForce = 30 + downforce; // 30 is base gravity
        const maxGrip = normalForce * cfg.normalFriction;

        // Lateral force needed to kill lateral velocity
        const frictionForce = -vLateral * 10; // Stiffness

        // Cap friction at limit (Slip)
        let appliedFriction = Math.max(-maxGrip, Math.min(maxGrip, frictionForce));

        // If drifting (E-Brake or Power Oversteer)
        if (drift) {
            appliedFriction *= 0.1; // Loss of rear grip
            this.isDrifting = true;
        } else if (Math.abs(frictionForce) > maxGrip) {
            // Sliding naturally
            this.isDrifting = true;
            appliedFriction *= 0.8; // Kinetic friction < Static
        } else {
            this.isDrifting = false;
        }

        // Apply Drag
        forwardSpeed -= 0.1 * dt * (forwardSpeed * forwardSpeed * 0.001); // Air Resistance

        // Reconstruct Velocity
        this.velocity.copy(newForward.multiplyScalar(vForward));
        this.velocity.add(newRight.multiplyScalar(vLateral + appliedFriction * dt));

        // --- AERODYNAMICS (DOWNFORCE) ---
        // Push car down relative to its roof (Down)
        // This allows upside-down driving if speed is high enough
        const downDir = new THREE.Vector3(0, -1, 0).applyQuaternion(this.quaternion);
        // Downforce increases with Square of Speed
        const aeroForce = downDir.multiplyScalar(Math.abs(forwardSpeed) * forwardSpeed * 0.02 * dt);
        this.velocity.add(aeroForce);

        // --- GLOBAL GRAVITY ---
        // Always pulls down world Y (-30)
        // UNLESS we are in a special "Magnet Zone" (which we aren't).
        // BUT for loops, we need the Downforce to overcome Gravity.
        this.velocity.y += cfg.gravity * dt;

        // Align to ground with limits
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
        const down = new THREE.Vector3(0, -1, 0).applyQuaternion(this.quaternion);

        this.wheelOffsets.forEach(offset => {
            const wheelPos = offset.clone().applyQuaternion(this.quaternion).add(this.position);
            const rayStart = wheelPos.clone().add(this.quaternion.clone().multiply(new THREE.Vector3(0, 0.5, 0)));

            if (trackCollision) {
                // Cast ray
                const hit = trackCollision.raycast(rayStart, down, 1.2); // Slightly longer ray

                if (hit) {
                    groundedWheels++;
                    avgNormal.add(hit.normal);

                    // Spring
                    const distance = hit.distance;
                    const restLength = 0.5 + this.config.suspensionHeight; // 0.9

                    if (distance < restLength) {
                        // Hooke's Law: F = -k * x
                        const x = restLength - distance; // Compression amount
                        const forceVal = x * this.config.suspensionStiffness; // k

                        // Damper: F = -c * v
                        // Velocity of compression?
                        // Simple Project velocity onto normal
                        const vNormal = this.velocity.dot(hit.normal);
                        const dampVal = vNormal * this.config.suspensionDamping; // c

                        const totalForce = Math.max(0, forceVal - dampVal);

                        // Apply to car velocity (Impulse)
                        // F = ma, a = F/m. Assume m=1.
                        // Impulse = F * dt
                        this.velocity.add(hit.normal.clone().multiplyScalar(totalForce * dt));
                    }
                }
            }
        });

        if (groundedWheels > 0) {
            this.isGrounded = true;
            this.groundNormal.copy(avgNormal.divideScalar(groundedWheels).normalize());
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

        this.rotation.x += (euler.x - this.rotation.x) * 2 * dt;
        this.rotation.z += (euler.z - this.rotation.z) * 2 * dt;

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
