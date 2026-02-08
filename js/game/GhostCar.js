/**
 * Ghost Car System
 * Records and replays player's best run
 */

import * as THREE from 'three';

export class GhostCar {
    constructor(renderer) {
        this.renderer = renderer;

        // Recording state
        this.isRecording = false;
        this.isPlaying = false;
        this.recordedData = [];
        this.playbackIndex = 0;
        this.recordInterval = 50; // ms between samples
        this.lastRecordTime = 0;

        // Ghost car visual
        this.ghostMesh = null;
        this.visible = true;

        this.createGhostCar();
    }

    createGhostCar() {
        // Create semi-transparent ghost car
        const group = new THREE.Group();

        // Simplified car body
        const bodyGeo = new THREE.BoxGeometry(1.4, 0.6, 3);
        const bodyMat = new THREE.MeshLambertMaterial({
            color: 0x00ffaa,
            transparent: true,
            opacity: 0.3,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        group.add(body);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2);
        const cabin = new THREE.Mesh(cabinGeo, bodyMat);
        cabin.position.set(0, 0.9, 0);
        group.add(cabin);

        this.ghostMesh = group;
        this.ghostMesh.visible = false;
    }

    /**
     * Start recording
     */
    startRecording() {
        this.recordedData = [];
        this.isRecording = true;
        this.lastRecordTime = 0;
    }

    /**
     * Stop recording
     */
    stopRecording() {
        this.isRecording = false;
        return this.recordedData;
    }

    /**
     * Record a frame
     */
    recordFrame(position, quaternion, time) {
        if (!this.isRecording) return;

        // Sample at interval
        if (time - this.lastRecordTime < this.recordInterval) return;

        this.recordedData.push({
            time: time,
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            quaternion: {
                x: quaternion.x,
                y: quaternion.y,
                z: quaternion.z,
                w: quaternion.w
            }
        });

        this.lastRecordTime = time;
    }

    /**
     * Start playback
     */
    startPlayback(data) {
        if (data) {
            this.recordedData = data;
        }

        if (this.recordedData.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        this.playbackIndex = 0;
        this.ghostMesh.visible = this.visible;
    }

    /**
     * Stop playback
     */
    stopPlayback() {
        this.isPlaying = false;
        this.ghostMesh.visible = false;
    }

    /**
     * Update ghost playback
     */
    update(currentTime) {
        if (!this.isPlaying || this.recordedData.length === 0) return;

        // Find current frame
        while (this.playbackIndex < this.recordedData.length - 1 &&
            this.recordedData[this.playbackIndex + 1].time <= currentTime) {
            this.playbackIndex++;
        }

        // Check if finished
        if (this.playbackIndex >= this.recordedData.length - 1) {
            this.stopPlayback();
            return;
        }

        // Interpolate between frames
        const frame1 = this.recordedData[this.playbackIndex];
        const frame2 = this.recordedData[this.playbackIndex + 1];

        const t = (currentTime - frame1.time) / (frame2.time - frame1.time);
        const clampedT = Math.max(0, Math.min(1, t));

        // Interpolate position
        this.ghostMesh.position.set(
            frame1.position.x + (frame2.position.x - frame1.position.x) * clampedT,
            frame1.position.y + (frame2.position.y - frame1.position.y) * clampedT,
            frame1.position.z + (frame2.position.z - frame1.position.z) * clampedT
        );

        // Interpolate rotation (slerp)
        const q1 = new THREE.Quaternion(
            frame1.quaternion.x,
            frame1.quaternion.y,
            frame1.quaternion.z,
            frame1.quaternion.w
        );
        const q2 = new THREE.Quaternion(
            frame2.quaternion.x,
            frame2.quaternion.y,
            frame2.quaternion.z,
            frame2.quaternion.w
        );

        this.ghostMesh.quaternion.copy(q1).slerp(q2, clampedT);
    }

    /**
     * Save ghost data to localStorage
     */
    saveGhost(trackId, data) {
        const key = `polyracer_ghost_${trackId}`;
        localStorage.setItem(key, JSON.stringify(data));
    }

    /**
     * Load ghost data from localStorage
     */
    loadGhost(trackId) {
        const key = `polyracer_ghost_${trackId}`;
        const saved = localStorage.getItem(key);

        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }

        return null;
    }

    /**
     * Add to scene
     */
    addToScene(scene) {
        scene.add(this.ghostMesh);
    }

    /**
     * Remove from scene
     */
    removeFromScene(scene) {
        scene.remove(this.ghostMesh);
    }

    /**
     * Toggle visibility
     */
    setVisible(visible) {
        this.visible = visible;
        if (this.isPlaying) {
            this.ghostMesh.visible = visible;
        }
    }
}
