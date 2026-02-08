/**
 * Track Builder
 * Generates track geometry from piece definitions
 */

import * as THREE from 'three';

export class TrackBuilder {
    constructor(renderer, collision) {
        this.renderer = renderer;
        this.collision = collision;

        // Track group
        this.trackGroup = new THREE.Group();

        // Materials
        this.roadMaterial = this.createRoadMaterial();
        this.barrierMaterial = renderer.createMaterial(0x111122); // Darker barrier
        this.curbMaterial = renderer.createMaterial(0xcc0000); // Red curb
        this.curbMaterial2 = renderer.createMaterial(0xffffff); // White curb
        this.boostMaterial = renderer.createEmissiveMaterial(0x00ffff, 0.8); // Cyan boost
        this.checkpointMaterial = renderer.createEmissiveMaterial(0xffff00, 0.3);
        this.finishMaterial = renderer.createEmissiveMaterial(0xffffff, 0.5);

        // Track data
        this.spawnPosition = new THREE.Vector3(0, 0, 0);
        this.spawnRotation = 0;
        this.checkpointCount = 0;
    }

    createRoadMaterial() {
        return new THREE.MeshLambertMaterial({
            color: 0x333344, // Darker road (like Poly Track)
            flatShading: true
        });
    }

    /**
     * Build track from definition
     */
    build(trackData) {
        this.clear();

        // Track state
        let position = new THREE.Vector3(0, 0, 0);
        let direction = 0; // radians
        let height = 0;

        // Set spawn
        this.spawnPosition.set(0, 0.5, 5);
        this.spawnRotation = 0;

        // Process each piece
        trackData.pieces.forEach((piece, index) => {
            const result = this.buildPiece(piece, position.clone(), direction, height, index);
            position = result.endPosition;
            direction = result.endDirection;
            height = result.endHeight;
        });

        // Add decorations
        this.addDecorations(trackData);

        // Add to scene
        this.renderer.add(this.trackGroup);

        return {
            spawnPosition: this.spawnPosition,
            spawnRotation: Math.PI, // Face forward (away from camera default)
            checkpointCount: this.checkpointCount
        };
    }

    buildPiece(piece, startPos, startDir, startHeight, index) {
        const type = piece.type;
        const length = piece.length || 20;
        const width = piece.width || 14; // Wider default
        const angle = piece.angle || 0;
        const heightChange = piece.heightChange || 0;

        let endPos = startPos.clone();
        let endDir = startDir;
        let endHeight = startHeight;

        switch (type) {
            case 'straight':
                endPos = this.buildStraight(startPos, startDir, length, width, startHeight);
                endHeight = startHeight + heightChange;
                break;

            case 'curve':
                const curveResult = this.buildCurve(startPos, startDir, piece.radius || 30, angle, width, startHeight);
                endPos = curveResult.position;
                endDir = startDir + angle;
                break;

            case 'ramp':
                endPos = this.buildRamp(startPos, startDir, length, width, heightChange, startHeight);
                endHeight = startHeight + heightChange;
                break;

            case 'jump':
                endPos = this.buildJump(startPos, startDir, length, width, piece.jumpHeight || 3, startHeight);
                break;

            case 'loop':
                endPos = this.buildLoop(startPos, startDir, piece.radius || 10, width, startHeight);
                break;

            case 'boost':
                endPos = this.buildBoostPad(startPos, startDir, length, width, startHeight);
                break;

            case 'checkpoint':
                this.buildCheckpoint(startPos, startDir, width, startHeight, this.checkpointCount++, piece.isFinish || false);
                endPos = startPos.clone();
                break;

            case 'finish':
                this.buildCheckpoint(startPos, startDir, width, startHeight, this.checkpointCount++, true);
                endPos = startPos.clone();
                break;
        }

        return {
            endPosition: endPos,
            endDirection: endDir,
            endHeight: endHeight
        };
    }

    buildStraight(pos, dir, length, width, height) {
        // Road surface
        const roadGeo = new THREE.PlaneGeometry(width, length, 1, 4);
        const road = new THREE.Mesh(roadGeo, this.roadMaterial);

        road.rotation.x = -Math.PI / 2;
        road.rotation.z = -dir;
        road.position.set(
            pos.x + Math.sin(dir) * length / 2,
            height + 0.01,
            pos.z + Math.cos(dir) * length / 2
        );
        road.receiveShadow = true;

        this.trackGroup.add(road);
        this.collision.addTrackMesh(road);

        // Curbs
        this.addCurbs(pos, dir, length, width, height);

        // Barriers
        this.addBarriers(pos, dir, length, width, height);

        // Calculate end position
        return new THREE.Vector3(
            pos.x + Math.sin(dir) * length,
            height,
            pos.z + Math.cos(dir) * length
        );
    }

    buildCurve(pos, dir, radius, angle, width, height) {
        const segments = Math.ceil(Math.abs(angle) / 0.2);
        const segmentAngle = angle / segments;

        // Determine curve center
        const turnDir = angle > 0 ? 1 : -1;
        const centerOffset = new THREE.Vector3(
            Math.cos(dir) * radius * turnDir,
            0,
            -Math.sin(dir) * radius * turnDir
        );
        const center = pos.clone().add(centerOffset);

        let currentPos = pos.clone();
        let currentDir = dir;

        for (let i = 0; i < segments; i++) {
            const arcLength = radius * Math.abs(segmentAngle);
            const endPos = this.buildStraight(currentPos, currentDir, arcLength, width, height);
            currentDir += segmentAngle;
            currentPos = endPos;
        }

        return {
            position: currentPos,
            direction: dir + angle
        };
    }

    buildRamp(pos, dir, length, width, heightChange, startHeight) {
        // Create angled road
        const hypotenuse = Math.sqrt(length * length + heightChange * heightChange);
        const rampAngle = Math.atan2(heightChange, length);

        const roadGeo = new THREE.PlaneGeometry(width, hypotenuse, 1, 4);
        const road = new THREE.Mesh(roadGeo, this.roadMaterial);

        road.rotation.x = -Math.PI / 2 + rampAngle;
        road.rotation.z = -dir;

        const midHeight = startHeight + heightChange / 2;
        road.position.set(
            pos.x + Math.sin(dir) * length / 2,
            midHeight + 0.01,
            pos.z + Math.cos(dir) * length / 2
        );
        road.receiveShadow = true;

        this.trackGroup.add(road);
        this.collision.addTrackMesh(road);

        return new THREE.Vector3(
            pos.x + Math.sin(dir) * length,
            startHeight + heightChange,
            pos.z + Math.cos(dir) * length
        );
    }

    buildJump(pos, dir, length, width, jumpHeight, height) {
        // Build up ramp
        const rampLength = length * 0.4;
        const rampEnd = this.buildRamp(pos, dir, rampLength, width, jumpHeight, height);

        // Flat top
        const topLength = length * 0.2;
        const topEnd = this.buildStraight(rampEnd, dir, topLength, width, height + jumpHeight);

        // Down ramp
        this.buildRamp(topEnd, dir, rampLength, width, -jumpHeight, height + jumpHeight);

        return new THREE.Vector3(
            pos.x + Math.sin(dir) * length,
            height,
            pos.z + Math.cos(dir) * length
        );
    }

    buildLoop(pos, dir, radius, width, height) {
        // Create loop using multiple curved segments
        const segments = 16;
        const segmentAngle = (Math.PI * 2) / segments;

        for (let i = 0; i < segments; i++) {
            const angle = i * segmentAngle;
            const nextAngle = (i + 1) * segmentAngle;

            // Calculate positions on circle (in vertical plane)
            const y1 = height + radius + Math.cos(angle) * radius;
            const z1 = pos.z + Math.sin(angle) * radius;
            const y2 = height + radius + Math.cos(nextAngle) * radius;
            const z2 = pos.z + Math.sin(nextAngle) * radius;

            const segmentLength = Math.sqrt(Math.pow(z2 - z1, 2) + Math.pow(y2 - y1, 2));

            // Create road segment
            const roadGeo = new THREE.PlaneGeometry(width, segmentLength);
            const road = new THREE.Mesh(roadGeo, this.roadMaterial);

            road.position.set(
                pos.x + Math.sin(dir) * (radius),
                (y1 + y2) / 2,
                (z1 + z2) / 2
            );

            // Orient segment
            road.rotation.x = -angle - segmentAngle / 2;
            road.rotation.z = -dir;

            road.receiveShadow = true;
            this.trackGroup.add(road);
            this.collision.addTrackMesh(road);
        }

        // Return exit position
        return new THREE.Vector3(
            pos.x + Math.sin(dir) * (radius * 2),
            height,
            pos.z + radius * 2
        );
    }

    buildBoostPad(pos, dir, length, width, height) {
        // Boost surface
        const boostGeo = new THREE.PlaneGeometry(width * 0.6, length);
        const boost = new THREE.Mesh(boostGeo, this.boostMaterial);

        boost.rotation.x = -Math.PI / 2;
        boost.rotation.z = -dir;
        boost.position.set(
            pos.x + Math.sin(dir) * length / 2,
            height + 0.02,
            pos.z + Math.cos(dir) * length / 2
        );

        this.trackGroup.add(boost);

        // Decorations (Chevrons)
        const arrowGeo = new THREE.PlaneGeometry(width * 0.4, length * 0.15);
        // Create 3 arrows
        for (let i = 0; i < 3; i++) {
            const arrow = new THREE.Mesh(arrowGeo, this.finishMaterial); // Bright white
            const offset = (i - 1) * (length * 0.25);

            arrow.rotation.x = -Math.PI / 2;
            arrow.rotation.z = -dir;
            arrow.position.set(
                pos.x + Math.sin(dir) * (length / 2 + offset),
                height + 0.03,
                pos.z + Math.cos(dir) * (length / 2 + offset)
            );
            this.trackGroup.add(arrow);
        }

        // Add boost zone to collision
        const boostPos = new THREE.Vector3(
            pos.x + Math.sin(dir) * length / 2,
            height + 1,
            pos.z + Math.cos(dir) * length / 2
        );
        const boostSize = new THREE.Vector3(width * 0.6, 2, length);
        const boostDir = new THREE.Vector3(Math.sin(dir), 0, Math.cos(dir));

        this.collision.addBoostPad(boostPos, boostSize, boostDir);

        // Also build regular road underneath
        return this.buildStraight(pos, dir, length, width, height);
    }

    buildCheckpoint(pos, dir, width, height, index, isFinish) {
        // Checkpoint gate
        const material = isFinish ? this.finishMaterial : this.checkpointMaterial;

        // Gate posts
        const postGeo = new THREE.BoxGeometry(0.5, 4, 0.5);
        const postL = new THREE.Mesh(postGeo, material);
        const postR = new THREE.Mesh(postGeo, material);

        const offset = width / 2 + 0.5;
        postL.position.set(
            pos.x + Math.cos(dir) * offset,
            height + 2,
            pos.z - Math.sin(dir) * offset
        );
        postR.position.set(
            pos.x - Math.cos(dir) * offset,
            height + 2,
            pos.z + Math.sin(dir) * offset
        );

        this.trackGroup.add(postL);
        this.trackGroup.add(postR);

        // Top bar
        const barGeo = new THREE.BoxGeometry(width + 1, 0.5, 0.5);
        const bar = new THREE.Mesh(barGeo, material);
        bar.position.set(pos.x, height + 4, pos.z);
        bar.rotation.y = dir;
        this.trackGroup.add(bar);

        // Add checkpoint collision zone
        const cpPos = new THREE.Vector3(pos.x, height + 2, pos.z);
        const cpSize = new THREE.Vector3(width + 2, 4, 2);

        this.collision.addCheckpoint(cpPos, cpSize, index, isFinish);
    }

    addCurbs(pos, dir, length, width, height) {
        const curbGeo = new THREE.BoxGeometry(0.5, 0.1, length);

        // Left Curb
        const leftCurb = new THREE.Mesh(curbGeo, this.curbMaterial);
        leftCurb.position.set(
            pos.x + Math.sin(dir) * length / 2 + Math.cos(dir) * (width / 2 + 0.25),
            height + 0.05,
            pos.z + Math.cos(dir) * length / 2 - Math.sin(dir) * (width / 2 + 0.25)
        );
        leftCurb.rotation.y = -dir;
        this.trackGroup.add(leftCurb);

        // Right Curb
        const rightCurb = new THREE.Mesh(curbGeo, this.curbMaterial2);
        rightCurb.position.set(
            pos.x + Math.sin(dir) * length / 2 - Math.cos(dir) * (width / 2 + 0.25),
            height + 0.05,
            pos.z + Math.cos(dir) * length / 2 + Math.sin(dir) * (width / 2 + 0.25)
        );
        rightCurb.rotation.y = -dir;
        this.trackGroup.add(rightCurb);
    }

    addBarriers(pos, dir, length, width, height) {
        const barrierGeo = new THREE.BoxGeometry(0.3, 0.8, length);

        // Left barrier
        const leftBarrier = new THREE.Mesh(barrierGeo, this.barrierMaterial);
        leftBarrier.position.set(
            pos.x + Math.sin(dir) * length / 2 + Math.cos(dir) * (width / 2 + 0.8), // Moved out by 0.65
            height + 0.4,
            pos.z + Math.cos(dir) * length / 2 - Math.sin(dir) * (width / 2 + 0.8)
        );
        leftBarrier.rotation.y = -dir;
        leftBarrier.castShadow = true;
        this.trackGroup.add(leftBarrier);
        this.collision.addBarrierMesh(leftBarrier);

        // Right barrier
        const rightBarrier = new THREE.Mesh(barrierGeo, this.barrierMaterial);
        rightBarrier.position.set(
            pos.x + Math.sin(dir) * length / 2 - Math.cos(dir) * (width / 2 + 0.8), // Moved out
            height + 0.4,
            pos.z + Math.cos(dir) * length / 2 + Math.sin(dir) * (width / 2 + 0.8)
        );
        rightBarrier.rotation.y = -dir;
        rightBarrier.castShadow = true;
        this.trackGroup.add(rightBarrier);
        this.collision.addBarrierMesh(rightBarrier);
    }

    addDecorations(trackData) {
        if (!trackData.decorations) return;

        trackData.decorations.forEach(deco => {
            this.addTree(deco.x, deco.z);
        });
    }

    addTree(x, z) {
        const treeGroup = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);
        const trunkMat = this.renderer.createMaterial(0x8B4513);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // Foliage (low-poly cone)
        const foliageGeo = new THREE.ConeGeometry(1.5, 3, 6);
        const foliageMat = this.renderer.createMaterial(0x2d5a27);
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 3.5;
        foliage.castShadow = true;
        treeGroup.add(foliage);

        treeGroup.position.set(x, 0, z);
        this.trackGroup.add(treeGroup);
    }

    /**
     * Clear track
     */
    clear() {
        this.renderer.remove(this.trackGroup);
        this.trackGroup = new THREE.Group();
        this.collision.clear();
        this.checkpointCount = 0;
    }
}
