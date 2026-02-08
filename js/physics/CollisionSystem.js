/**
 * Collision System
 * Handles track and barrier collisions
 */

import * as THREE from 'three';

export class CollisionSystem {
    constructor() {
        this.trackMeshes = [];
        this.barrierMeshes = [];
        this.boostPads = [];
        this.checkpoints = [];

        this.raycaster = new THREE.Raycaster();
    }

    /**
     * Add track mesh for collision
     */
    addTrackMesh(mesh) {
        this.trackMeshes.push(mesh);
    }

    /**
     * Add barrier mesh
     */
    addBarrierMesh(mesh) {
        this.barrierMeshes.push(mesh);
    }

    /**
     * Add boost pad
     */
    addBoostPad(position, size, direction) {
        this.boostPads.push({
            position: position.clone(),
            size: size.clone(),
            direction: direction.clone(),
            bounds: new THREE.Box3().setFromCenterAndSize(position, size)
        });
    }

    /**
     * Add checkpoint
     */
    addCheckpoint(position, size, index, isFinish = false) {
        this.checkpoints.push({
            position: position.clone(),
            size: size.clone(),
            index: index,
            isFinish: isFinish,
            bounds: new THREE.Box3().setFromCenterAndSize(position, size)
        });
    }

    /**
     * Clear all collision data
     */
    clear() {
        this.trackMeshes = [];
        this.barrierMeshes = [];
        this.boostPads = [];
        this.checkpoints = [];
    }

    /**
     * Raycast against track
     */
    raycast(origin, direction, maxDistance = 10) {
        this.raycaster.set(origin, direction);
        this.raycaster.far = maxDistance;

        const intersects = this.raycaster.intersectObjects(this.trackMeshes, true);

        if (intersects.length > 0) {
            return {
                point: intersects[0].point,
                normal: intersects[0].face.normal.clone().transformDirection(intersects[0].object.matrixWorld),
                distance: intersects[0].distance
            };
        }

        return null;
    }

    /**
     * Check if position is on track
     */
    isOnTrack(position) {
        const origin = position.clone();
        origin.y += 5;

        const hit = this.raycast(origin, new THREE.Vector3(0, -1, 0), 10);
        return hit !== null;
    }

    /**
     * Check barrier collision
     */
    checkBarrierCollision(boundingBox) {
        for (const barrier of this.barrierMeshes) {
            if (!barrier.geometry.boundingBox) {
                barrier.geometry.computeBoundingBox();
            }

            const barrierBox = barrier.geometry.boundingBox.clone();
            barrierBox.applyMatrix4(barrier.matrixWorld);

            if (boundingBox.intersectsBox(barrierBox)) {
                // Calculate intersection depth
                const intersection = boundingBox.clone().intersect(barrierBox);
                const xPen = intersection.max.x - intersection.min.x;
                const zPen = intersection.max.z - intersection.min.z;

                // Determine push direction based on shallowest penetration
                const pushDir = new THREE.Vector3();
                const center = new THREE.Vector3();
                boundingBox.getCenter(center);
                const barrierCenter = new THREE.Vector3();
                barrierBox.getCenter(barrierCenter);

                const dirToSelf = center.sub(barrierCenter);

                let penetration = 0;

                if (xPen < zPen) {
                    // Push along X
                    pushDir.set(Math.sign(dirToSelf.x), 0, 0);
                    penetration = xPen;
                } else {
                    // Push along Z
                    pushDir.set(0, 0, Math.sign(dirToSelf.z));
                    penetration = zPen;
                }

                return {
                    collided: true,
                    normal: pushDir,
                    penetration: penetration + 0.1 // Push out slightly more to be safe
                };
            }
        }

        return { collided: false };
    }

    /**
     * Check boost pad collision
     */
    checkBoostPad(position) {
        for (const pad of this.boostPads) {
            if (pad.bounds.containsPoint(position)) {
                return {
                    hit: true,
                    direction: pad.direction.clone()
                };
            }
        }
        return { hit: false };
    }

    /**
     * Check checkpoint collision
     */
    checkCheckpoint(position) {
        for (const cp of this.checkpoints) {
            if (cp.bounds.containsPoint(position)) {
                return {
                    hit: true,
                    index: cp.index,
                    isFinish: cp.isFinish
                };
            }
        }
        return { hit: false };
    }
}
