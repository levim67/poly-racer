/**
 * Spline Track Builder
 * Generates smooth track geometry from control points
 */

import * as THREE from 'three';

export class SplineTrackBuilder {
    constructor(renderer, collision) {
        this.renderer = renderer;
        this.collision = collision;
        this.trackGroup = new THREE.Group();

        // Materials
        this.roadMaterial = new THREE.MeshLambertMaterial({
            color: 0x222222,
            flatShading: true
        });

        this.spawnPosition = new THREE.Vector3();
        this.spawnRotation = 0;
    }

    build(trackData) {
        this.clear();

        // Convert points array to Vector3
        const points = [];
        if (trackData.points) {
            trackData.points.forEach(p => {
                points.push(new THREE.Vector3(p.x, p.y, p.z));
            });
        }

        if (points.length < 2) return;

        // Create Curve
        const curve = new THREE.CatmullRomCurve3(points);
        curve.closed = true;
        curve.tension = 0.5;

        // 2. Generate Road Geometry
        const shape = new THREE.Shape();
        const width = 15;
        const thickness = 1;

        // Define simple road profile (flat rectangle)
        shape.moveTo(-width / 2, -thickness / 2);
        shape.lineTo(width / 2, -thickness / 2);
        shape.lineTo(width / 2, thickness / 2);
        shape.lineTo(-width / 2, thickness / 2);

        const extrudeSettings = {
            steps: 400,
            bevelEnabled: false,
            extrudePath: curve
        };

        const roadGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Poly Track style: Bright grey road
        const road = new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({
            color: 0xdddddd,   // Light grey (Poly Track style)
            flatShading: true,
            side: THREE.DoubleSide  // Visible from both sides
        }));

        // CRITICAL: Update matrix for raycasting to work
        road.updateMatrixWorld(true);

        // Add to scene group
        this.trackGroup.add(road);

        // Road Edges (White stripes like Poly Track)
        const edges = new THREE.EdgesGeometry(roadGeo, 30);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2
        }));
        this.trackGroup.add(line);

        // 3. Extract Spawn Point
        // Get point at very start of curve
        const startPoint = curve.getPointAt(0);
        const startTangent = curve.getTangentAt(0).normalize();

        this.spawnPosition.copy(startPoint);
        this.spawnPosition.y += 2;

        // Calculate interaction with Up vector to find rotation
        this.spawnRotation = Math.atan2(startTangent.x, startTangent.z);

        // Add Physics Mesh (AFTER matrix update)
        this.collision.addTrackMesh(road);

        // 4. Add Checkpoints
        this.checkpointCount = 0;
        const totalPoints = points.length;
        // Place checkpoint every 3 control points
        for (let i = 0; i < totalPoints; i += 3) {
            const t = i / totalPoints;
            const pos = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t).normalize();

            // Lift checkpoint up
            pos.y += 0.1;

            const isFinish = (i === 0);
            this.createCheckpoint(pos, tangent, this.checkpointCount++, isFinish);
        }

        this.renderer.add(this.trackGroup);

        return {
            spawnPosition: this.spawnPosition,
            spawnRotation: this.spawnRotation,
            checkpointCount: this.checkpointCount
        };
    }

    createCheckpoint(pos, dir, index, isFinish) {
        const width = 20;
        const height = 8;
        const material = new THREE.MeshBasicMaterial({
            color: isFinish ? 0xffffff : 0x00ffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        // Visual Gate (Simple Arch)
        const gateGeo = new THREE.TorusGeometry(width / 2, 0.5, 8, 16, Math.PI);
        const gate = new THREE.Mesh(gateGeo, material);

        // Orient gate
        const angle = Math.atan2(dir.x, dir.z);
        gate.rotation.y = angle;
        gate.position.copy(pos);
        gate.position.y += 0; // Torus draws from center, but it's an arch (half torus)

        this.trackGroup.add(gate);

        // Collision Zone
        const cpSize = new THREE.Vector3(width, height, 2);
        const cpPos = pos.clone();
        cpPos.y += height / 2;

        this.collision.addCheckpoint(cpPos, cpSize, index, isFinish);
    }

    clear() {
        this.renderer.remove(this.trackGroup);
        this.trackGroup = new THREE.Group();
        this.collision.clear();
    }
}
