// === [STEP 1.3: SENTRY, IMPORTS & CORE SCENE] ===

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

try {
    if (window.Sentry) {
        Sentry.init({
            dsn: "https://c9c73abcccb7521e6d5c9f4b62c204a6@o4511825776279552.ingest.de.sentry.io/4511825788993616"
        });
    }
} catch (error) {
    console.error("Sentry initialization failed:", error);
}

window.addEventListener('unhandledrejection', (event) => {
    try {
        if (window.Sentry) {
            Sentry.captureException(event.reason);
        }
    } catch (error) {
        console.error("Failed to capture unhandledrejection:", error);
    }
});

let scene, camera, renderer, cameraTarget, carModel, loadingManager;
let isTransitioning = false;
let isIntroComplete = false;

try {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.5, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
        canvasContainer.appendChild(renderer.domElement);
    }

    renderer.domElement.addEventListener('webglcontextlost', (event) => {
        try {
            event.preventDefault();
            if (window.Sentry) {
                Sentry.captureException(new Error("WebGL Context Lost"));
            }
        } catch (error) {
            console.error("Error handling WebGL context loss:", error);
        }
    });

    cameraTarget = new THREE.Vector3(0, 0, 0);

    function animate() {
        requestAnimationFrame(animate);
        try {
            if (camera && cameraTarget && renderer && scene) {
                camera.lookAt(cameraTarget);
                renderer.render(scene, camera);
            }
        } catch (renderError) {
            if (window.Sentry) {
                Sentry.captureException(renderError);
            }
        }
    }

    animate();
} catch (error) {
    console.error("Error initializing core 3D scene:", error);
    if (window.Sentry) {
        Sentry.captureException(error);
    }
}

// === [STEP 1.4: STUDIO LIGHTING & FLOOR] ===

try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const floorGeometry = new THREE.CircleGeometry(20, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.1
    });
    const studioFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    studioFloor.rotation.x = -Math.PI / 2;
    studioFloor.position.y = 0;
    studioFloor.receiveShadow = true;
    scene.add(studioFloor);
} catch (error) {
    console.error("Error configuring studio lighting and floor:", error);
    if (window.Sentry) {
        Sentry.captureException(error);
    }
}

// === [STEP 1.5: RESIZE HANDLER & RESPONSIVE FOV] ===

function onWindowResize() {
    try {
        if (!camera || !renderer) return;

        camera.aspect = window.innerWidth / window.innerHeight;

        if (window.innerWidth < window.innerHeight) {
            camera.fov = 65;
        } else {
            camera.fov = 45;
        }

        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    } catch (error) {
        console.error("Error in onWindowResize:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }
}

window.addEventListener('resize', onWindowResize);
onWindowResize();

// === [STEP 1.6: ASSET LOADING & NORMALIZATION] ===

try {
    loadingManager = new THREE.LoadingManager();
    const gltfLoader = new GLTFLoader(loadingManager);

    gltfLoader.load(
        'models/bastis-audi-r8.glb',
        (gltf) => {
            try {
                carModel = gltf.scene;

                // 1. Mesh Cleanup: Remove stray Blender Cube before calculating Box3
                const cubesToRemove = [];
                carModel.traverse((child) => {
                    if (child.name === 'Cube') {
                        cubesToRemove.push(child);
                    }
                });
                cubesToRemove.forEach((cube) => {
                    if (cube.parent) {
                        cube.parent.remove(cube);
                    }
                });

                // 2. Normalization Math
                const box = new THREE.Box3().setFromObject(carModel);
                const size = new THREE.Vector3();
                box.getSize(size);

                const scaleFactor = 4.2 / Math.max(size.x, size.z);
                carModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

                box.setFromObject(carModel);
                const center = new THREE.Vector3();
                box.getCenter(center);

                carModel.position.x = -center.x;
                carModel.position.z = -center.z;
                carModel.position.y = -box.min.y;

                // 3. PBR Calibration & Shadows
                carModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];

                            materials.forEach((mat) => {
                                if (!mat) return;
                                const matName = (mat.name || '').toLowerCase();

                                if (
                                    matName.includes('body_color') ||
                                    matName.includes('aluminium') ||
                                    matName.includes('aluminum')
                                ) {
                                    mat.metalness = 0.85;
                                    mat.roughness = 0.18;
                                    mat.envMapIntensity = 1.6;
                                } else if (
                                    matName.includes('chrome') ||
                                    matName.includes('rims')
                                ) {
                                    mat.metalness = 0.95;
                                    mat.roughness = 0.12;
                                    mat.envMapIntensity = 1.8;
                                } else if (
                                    matName.includes('black_gloss') ||
                                    matName.includes('trim') ||
                                    matName.includes('grille')
                                ) {
                                    mat.metalness = 0.3;
                                    mat.roughness = 0.15;
                                } else if (matName.includes('interior_2')) {
                                    if (mat.color) {
                                        mat.color.setHex(0x1c1c1f);
                                    }
                                    mat.roughness = 0.6;
                                } else if (matName.includes('glass')) {
                                    mat.roughness = 0.05;
                                    mat.metalness = 0.1;
                                    mat.transparent = true;
                                    mat.opacity = 0.38;
                                    mat.envMapIntensity = 2.0;
                                }

                                mat.needsUpdate = true;
                            });
                        }
                    }
                });

                scene.add(carModel);
            } catch (error) {
                console.error("Error processing loaded GLB car model:", error);
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
            }
        },
        undefined,
        (error) => {
            console.error("Error loading models/bastis-audi-r8.glb:", error);
            if (window.Sentry) {
                Sentry.captureException(error);
            }
        }
    );
} catch (error) {
    console.error("Error initializing GLTFLoader:", error);
    if (window.Sentry) {
        Sentry.captureException(error);
    }
}

