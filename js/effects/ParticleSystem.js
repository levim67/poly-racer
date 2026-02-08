/**
 * Particle System
 * Visual effects for drifting, boost, and impacts
 */

import * as THREE from 'three';

export class ParticleSystem {
    constructor(renderer) {
        this.renderer = renderer;
        this.particles = [];
        this.pools = {};

        // Create particle pools
        this.createPool('dust', 50, 0xccaa88, 0.3);
        this.createPool('spark', 30, 0xffaa00, 0.15);
        this.createPool('boost', 20, 0x00ffaa, 0.4);
    }

    createPool(name, count, color, size) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const lifetimes = new Float32Array(count);
        const sizes = new Float32Array(count);

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: color,
            size: size,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;

        this.renderer.add(points);

        this.pools[name] = {
            points: points,
            geometry: geometry,
            positions: positions,
            velocities: velocities,
            lifetimes: lifetimes,
            sizes: sizes,
            count: count,
            activeCount: 0,
            baseSize: size
        };
    }

    /**
     * Emit particles
     */
    emit(poolName, position, direction, count = 5, speed = 5, lifetime = 1) {
        const pool = this.pools[poolName];
        if (!pool) return;

        for (let i = 0; i < count; i++) {
            const idx = (pool.activeCount + i) % pool.count;
            const offset = idx * 3;

            // Set position
            pool.positions[offset] = position.x + (Math.random() - 0.5) * 0.5;
            pool.positions[offset + 1] = position.y + (Math.random() - 0.5) * 0.5;
            pool.positions[offset + 2] = position.z + (Math.random() - 0.5) * 0.5;

            // Set velocity
            pool.velocities[offset] = direction.x * speed + (Math.random() - 0.5) * speed * 0.5;
            pool.velocities[offset + 1] = direction.y * speed + Math.random() * speed * 0.3;
            pool.velocities[offset + 2] = direction.z * speed + (Math.random() - 0.5) * speed * 0.5;

            // Set lifetime
            pool.lifetimes[idx] = lifetime;
            pool.sizes[idx] = pool.baseSize * (0.5 + Math.random() * 0.5);
        }

        pool.activeCount = (pool.activeCount + count) % pool.count;
        pool.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * Update all particles
     */
    update(deltaTime) {
        for (const name in this.pools) {
            const pool = this.pools[name];
            let anyActive = false;

            for (let i = 0; i < pool.count; i++) {
                if (pool.lifetimes[i] > 0) {
                    anyActive = true;
                    const offset = i * 3;

                    // Update position
                    pool.positions[offset] += pool.velocities[offset] * deltaTime;
                    pool.positions[offset + 1] += pool.velocities[offset + 1] * deltaTime;
                    pool.positions[offset + 2] += pool.velocities[offset + 2] * deltaTime;

                    // Apply gravity
                    pool.velocities[offset + 1] -= 10 * deltaTime;

                    // Reduce lifetime
                    pool.lifetimes[i] -= deltaTime;

                    // Fade out
                    if (pool.lifetimes[i] <= 0) {
                        // Move off screen
                        pool.positions[offset + 1] = -1000;
                    }
                }
            }

            if (anyActive) {
                pool.geometry.attributes.position.needsUpdate = true;
            }
        }
    }

    /**
     * Emit drift dust
     */
    emitDrift(position, direction) {
        this.emit('dust', position, direction, 3, 3, 0.5);
    }

    /**
     * Emit boost effect
     */
    emitBoost(position, direction) {
        this.emit('boost', position, direction, 5, 8, 0.3);
    }

    /**
     * Emit impact sparks
     */
    emitImpact(position) {
        this.emit('spark', position, new THREE.Vector3(0, 1, 0), 10, 10, 0.5);
    }
}
