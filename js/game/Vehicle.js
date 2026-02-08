/**
 * Vehicle - 3D car model and visuals
 */

import * as THREE from 'three';

export class Vehicle {
    constructor(renderer) {
        this.renderer = renderer;

        // Main group
        this.group = new THREE.Group();

        // Car color
        this.color = 0xff3366;

        // Components
        this.body = null;
        this.wheels = [];
        this.lights = [];

        // Effects
        this.driftParticles = null;
        this.boostFlame = null;

        this.build();
    }

    build() {
        // Create low-poly car body
        this.createBody();
        this.createWheels();
        this.createLights();
        this.createExhaust();

        this.group.castShadow = true;
    }

    createBody() {
        // Main body - elongated box with some shaping
        const bodyGroup = new THREE.Group();

        // Base chassis
        const chassisGeo = new THREE.BoxGeometry(1.4, 0.4, 3);
        const chassisMat = this.renderer.createMaterial(this.color);
        const chassis = new THREE.Mesh(chassisGeo, chassisMat);
        chassis.position.y = 0.3;
        chassis.castShadow = true;
        bodyGroup.add(chassis);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(1.2, 0.5, 1.5);
        const cabinMat = this.renderer.createMaterial(this.color);
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 0.7, -0.2); // Z flipped
        cabin.castShadow = true;
        bodyGroup.add(cabin);

        // Front hood (angled)
        const hoodGeo = new THREE.BoxGeometry(1.3, 0.3, 0.8);
        const hood = new THREE.Mesh(hoodGeo, chassisMat);
        hood.position.set(0, 0.45, -1.1); // Z flipped
        hood.rotation.x = 0.15;
        hood.castShadow = true;
        bodyGroup.add(hood);

        // Rear spoiler
        const spoilerGeo = new THREE.BoxGeometry(1.4, 0.08, 0.3);
        const spoilerMat = this.renderer.createMaterial(0x333333);
        const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
        spoiler.position.set(0, 0.95, 1.2); // Z flipped
        bodyGroup.add(spoiler);

        // Spoiler stands
        const standGeo = new THREE.BoxGeometry(0.08, 0.2, 0.08);
        const standL = new THREE.Mesh(standGeo, spoilerMat);
        standL.position.set(-0.5, 0.85, 1.2); // Z flipped
        bodyGroup.add(standL);

        const standR = new THREE.Mesh(standGeo, spoilerMat);
        standR.position.set(0.5, 0.85, 1.2); // Z flipped
        bodyGroup.add(standR);

        // Windows (dark glass)
        const windowMat = this.renderer.createMaterial(0x111122);

        const frontWindowGeo = new THREE.BoxGeometry(1.1, 0.35, 0.05);
        const frontWindow = new THREE.Mesh(frontWindowGeo, windowMat);
        frontWindow.position.set(0, 0.75, -0.9); // Z flipped
        frontWindow.rotation.x = 0.3;
        bodyGroup.add(frontWindow);

        const rearWindowGeo = new THREE.BoxGeometry(1.1, 0.3, 0.05);
        const rearWindow = new THREE.Mesh(rearWindowGeo, windowMat);
        rearWindow.position.set(0, 0.75, 0.5); // Z flipped
        rearWindow.rotation.x = -0.3;
        bodyGroup.add(rearWindow);

        this.body = bodyGroup;
        this.group.add(bodyGroup);
    }

    createWheels() {
        const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
        const wheelMat = this.renderer.createMaterial(0x222222);
        const rimMat = this.renderer.createMaterial(0x888888);

        const wheelPositions = [
            { x: -0.7, y: 0.3, z: -1.0 },   // Front left (Z flipped)
            { x: 0.7, y: 0.3, z: -1.0 },    // Front right (Z flipped)
            { x: -0.7, y: 0.3, z: 1.0 },  // Rear left (Z flipped)
            { x: 0.7, y: 0.3, z: 1.0 }    // Rear right (Z flipped)
        ];

        wheelPositions.forEach((pos, i) => {
            const wheelGroup = new THREE.Group();

            // Tire
            const tire = new THREE.Mesh(wheelGeo, wheelMat);
            tire.rotation.z = Math.PI / 2;
            tire.castShadow = true;
            wheelGroup.add(tire);

            // Rim
            const rimGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.22, 6);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.z = Math.PI / 2;
            wheelGroup.add(rim);

            wheelGroup.position.set(pos.x, pos.y, pos.z);

            this.wheels.push({
                group: wheelGroup,
                isFront: i < 2,
                rotation: 0
            });

            this.group.add(wheelGroup);
        });
    }

    createLights() {
        // Headlights
        const headlightGeo = new THREE.BoxGeometry(0.2, 0.1, 0.05);
        const headlightMat = this.renderer.createEmissiveMaterial(0xffffcc, 1);

        const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
        headlightL.position.set(-0.5, 0.4, -1.5); // Z flipped
        this.group.add(headlightL);

        const headlightR = new THREE.Mesh(headlightGeo, headlightMat);
        headlightR.position.set(0.5, 0.4, -1.5); // Z flipped
        this.group.add(headlightR);

        // Taillights
        const taillightGeo = new THREE.BoxGeometry(0.3, 0.1, 0.05);
        const taillightMat = this.renderer.createEmissiveMaterial(0xff0000, 0.8);

        const taillightL = new THREE.Mesh(taillightGeo, taillightMat);
        taillightL.position.set(-0.5, 0.4, 1.5); // Z flipped
        this.group.add(taillightL);

        const taillightR = new THREE.Mesh(taillightGeo, taillightMat);
        taillightR.position.set(0.5, 0.4, 1.5); // Z flipped
        this.group.add(taillightR);
    }

    createExhaust() {
        // Exhaust pipes
        const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.2, 6);
        const exhaustMat = this.renderer.createMaterial(0x444444);

        const exhaustL = new THREE.Mesh(exhaustGeo, exhaustMat);
        exhaustL.rotation.x = Math.PI / 2;
        exhaustL.position.set(-0.3, 0.15, 1.55); // Z flipped
        this.group.add(exhaustL);

        const exhaustR = new THREE.Mesh(exhaustGeo, exhaustMat);
        exhaustR.rotation.x = Math.PI / 2;
        exhaustR.position.set(0.3, 0.15, 1.55); // Z flipped
        this.group.add(exhaustR);
    }

    /**
     * Update vehicle visuals
     */
    update(physics, deltaTime) {
        // Update position and rotation
        this.group.position.copy(physics.position);
        this.group.quaternion.copy(physics.quaternion);

        // Spin wheels based on speed
        const wheelSpeed = physics.speed * 3 * deltaTime;
        this.wheels.forEach(wheel => {
            wheel.rotation += wheelSpeed;
            wheel.group.children[0].rotation.x = wheel.rotation;
            wheel.group.children[1].rotation.x = wheel.rotation;

            // Turn front wheels
            if (wheel.isFront) {
                wheel.group.rotation.y = physics.steerAngle * 0.5;
            }
        });
    }

    /**
     * Set car color
     */
    setColor(color) {
        this.color = color;

        // Update body materials
        if (this.body) {
            this.body.traverse(child => {
                if (child.isMesh && child.material.color) {
                    // Only update main body parts (not windows/spoiler)
                    const hex = child.material.color.getHex();
                    if (hex !== 0x333333 && hex !== 0x111122) {
                        child.material.color.setHex(color);
                    }
                }
            });
        }
    }

    /**
     * Add to scene
     */
    addToScene(scene) {
        scene.add(this.group);
    }

    /**
     * Remove from scene
     */
    removeFromScene(scene) {
        scene.remove(this.group);
    }

    /**
     * Get position
     */
    get position() {
        return this.group.position;
    }

    /**
     * Get quaternion
     */
    get quaternion() {
        return this.group.quaternion;
    }
}
