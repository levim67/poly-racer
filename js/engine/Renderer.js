/**
 * Renderer System
 * Three.js based renderer with low-poly aesthetic
 */

import * as THREE from 'three';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;

        // Three.js components
        this.renderer = null;
        this.scene = null;

        // Render settings
        this.pixelRatio = Math.min(window.devicePixelRatio, 2);
        this.shadowsEnabled = true;

        this.init();
    }

    init() {
        // Create WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });

        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x0a0a2a); // Deep Neon Blue
        this.renderer.shadowMap.enabled = this.shadowsEnabled;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Tone mapping for better colors
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Create scene
        this.scene = new THREE.Scene();

        // Add fog for depth
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 800);

        // Setup lighting
        this.setupLighting();

        // Setup skybox/environment
        this.setupEnvironment();

        // Create mountains
        this.createMountains();
    }

    createMountains() {
        const mountainCount = 40;
        const mountainGroup = new THREE.Group();

        const colors = [0x4a6741, 0x3d5c5c, 0x5c4033]; // Greenish, Blueish, Brownish

        for (let i = 0; i < mountainCount; i++) {
            const height = 40 + Math.random() * 60;
            const radius = 30 + Math.random() * 20;
            const segments = 3 + Math.floor(Math.random() * 3); // 3-5 segments for low poly look

            const geo = new THREE.ConeGeometry(radius, height, segments);
            const mat = this.createMaterial(colors[Math.floor(Math.random() * colors.length)]);
            const mesh = new THREE.Mesh(geo, mat);

            // Random position in a ring
            const angle = (i / mountainCount) * Math.PI * 2 + (Math.random() * 0.5);
            const dist = 300 + Math.random() * 100;

            mesh.position.x = Math.sin(angle) * dist;
            mesh.position.z = Math.cos(angle) * dist;
            mesh.position.y = height / 2 - 10; // Buried slightly

            // Random rotation
            mesh.rotation.y = Math.random() * Math.PI;

            mountainGroup.add(mesh);
        }

        this.scene.add(mountainGroup);
    }

    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.6); // Adjusted ambient intensity
        this.scene.add(ambient);

        // Main directional light (sun)
        const sun = new THREE.DirectionalLight(0xffffff, 1.3); // Brighter sun
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 300;
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        sun.shadow.bias = -0.0005;
        this.scene.add(sun);
        this.sun = sun;

        // Fill light
        const fill = new THREE.DirectionalLight(0x6080ff, 0.4);
        fill.position.set(-50, 30, -50);
        this.scene.add(fill);

        // Hemisphere light for natural feel
        const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d5c5c, 0.5);
        this.scene.add(hemi);
    }

    setupEnvironment() {
        // Create gradient sky using a large sphere
        const skyGeometry = new THREE.SphereGeometry(400, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0x87CEEB) }, // Match fog
                offset: { value: 20 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });

        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
        this.sky = sky;

        // Create ground plane
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000); // Larger ground
        const groundMaterial = new THREE.MeshLambertMaterial({
            color: 0x1a1a2e // Dark background for Poly Track style
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.ground = ground;

        // Add Grid Helper (Poly Track style)
        const grid = new THREE.GridHelper(2000, 50, 0xffffff, 0xffffff);
        grid.position.y = -0.48; // Slightly above ground
        grid.material.opacity = 0.1;
        grid.material.transparent = true;
        this.scene.add(grid);
    }

    /**
     * Handle window resize
     */
    handleResize(width, height) {
        this.renderer.setSize(width, height);
    }

    /**
     * Render the scene
     */
    render(camera) {
        if (!camera) return;
        this.renderer.render(this.scene, camera.camera);
    }

    /**
     * Add object to scene
     */
    add(object) {
        this.scene.add(object);
    }

    /**
     * Remove object from scene
     */
    remove(object) {
        this.scene.remove(object);
    }

    /**
     * Get the scene
     */
    getScene() {
        return this.scene;
    }

    /**
     * Update sun position for dynamic shadows
     */
    updateSunPosition(target) {
        if (this.sun && target) {
            this.sun.position.set(
                target.x + 50,
                100,
                target.z + 50
            );
            this.sun.target.position.copy(target);
            this.sun.target.updateMatrixWorld();
        }
    }

    /**
     * Create low-poly material
     */
    createMaterial(color, options = {}) {
        return new THREE.MeshLambertMaterial({
            color: color,
            flatShading: true,
            ...options
        });
    }

    /**
     * Create emissive material for glowing objects
     */
    createEmissiveMaterial(color, emissiveIntensity = 0.5) {
        return new THREE.MeshLambertMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: emissiveIntensity,
            flatShading: true
        });
    }
}
