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
let currentView = 'home';

// === [STEP 2.3: VIEW_CONFIG & DEBUG HELPER] ===

const VIEW_CONFIG = {
    home: {
        widePos: new THREE.Vector3(0, 6.5, 4.5),
        wideTarget: new THREE.Vector3(0, 0.5, 0),
        zoomPos: new THREE.Vector3(0, 5.2, 2.8),
        zoomTarget: new THREE.Vector3(0, 0.6, 0),
        title: "Platinum Studio Overview",
        body: "Precision mobile automotive detailing engineered to restore showroom gloss at your doorstep."
    },
    item1: {
        widePos: new THREE.Vector3(-4.5, 1.8, 1.5),
        wideTarget: new THREE.Vector3(0, 0.7, 0),
        zoomPos: new THREE.Vector3(-2.6, 1.1, 0.4),
        zoomTarget: new THREE.Vector3(-0.8, 0.75, 0.2),
        title: "The Basti's Story",
        body: "Founded by Sebastian, a young local entrepreneur with a drive for perfection. Basti's Platinum Wash brings a meticulous, high-quality mobile car wash directly to your driveway in Durban. Support the local hustle and experience premium care."
    },
    item2: {
        widePos: new THREE.Vector3(4.5, 1.8, 1.5),
        wideTarget: new THREE.Vector3(0, 0.7, 0),
        zoomPos: new THREE.Vector3(2.6, 1.1, 0.4),
        zoomTarget: new THREE.Vector3(0.8, 0.75, 0.2),
        title: "The Platinum Wash",
        body: "We bring the professional car wash experience right to your home. Our comprehensive mobile service includes a thorough exterior hand wash, wheel and tyre cleaning, full interior vacuuming, and a complete wipe-down of all dash and trim surfaces."
    },
    item3: {
        widePos: new THREE.Vector3(0, 1.8, 5.2),
        wideTarget: new THREE.Vector3(0, 0.6, 1.0),
        zoomPos: new THREE.Vector3(0.8, 1.05, 3.2),
        zoomTarget: new THREE.Vector3(0.3, 0.65, 1.6),
        title: "We Come To You",
        body: "1. Select your vehicle size and choose a time slot online.<br><br>2. Our fully-equipped team deploys to your home or office.<br><br>3. We restore your vehicle's shine while you relax, without ever waiting in line."
    },
    item4: {
        widePos: new THREE.Vector3(0, 2.0, -5.2),
        wideTarget: new THREE.Vector3(0, 0.7, -1.0),
        zoomPos: new THREE.Vector3(-0.9, 1.15, -3.4),
        zoomTarget: new THREE.Vector3(-0.2, 0.7, -1.7),
        title: "Contact & Hours",
        body: "Servicing the greater Durban area.<br><br>Operating Hours:<br>Monday – Saturday<br>08:00 to 17:00.<br><br>Please use the Book Now button below to schedule all appointments online."
    }
};

try {
    const urlParams = new URLSearchParams(window.location.search);
    if (
        urlParams.get('debug') === 'true' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
        window.addEventListener('click', () => {
            try {
                if (camera && cameraTarget) {
                    console.log('--- [DEBUG CAMERA TELEMETRY] ---');
                    console.log(
                        `camera.position: new THREE.Vector3(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`
                    );
                    console.log(
                        `cameraTarget: new THREE.Vector3(${cameraTarget.x.toFixed(2)}, ${cameraTarget.y.toFixed(2)}, ${cameraTarget.z.toFixed(2)})`
                    );
                }
            } catch (clickError) {
                console.error("Error in debug telemetry click listener:", clickError);
                if (window.Sentry) {
                    Sentry.captureException(clickError);
                }
            }
        });
    }
} catch (error) {
    console.error("Error initializing debug helper:", error);
    if (window.Sentry) {
        Sentry.captureException(error);
    }
}

try {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.5, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
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

    scene.fog = new THREE.FogExp2(0x070d16, 0.045);

    const keyLight = new THREE.DirectionalLight(0xf8fafc, 2.8);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const hemisphereLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.25);
    scene.add(hemisphereLight);

    const blueRimLightLeft = new THREE.DirectionalLight(0x38bdf8, 2.2);
    blueRimLightLeft.position.set(-6, 4, -5);
    scene.add(blueRimLightLeft);

    const blueRimLightRight = new THREE.DirectionalLight(0x00a8ff, 1.8);
    blueRimLightRight.position.set(6, 3.5, 4);
    scene.add(blueRimLightRight);

    const floorGeometry = new THREE.CircleGeometry(20, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x162433,
        roughness: 0.24,
        metalness: 0.55
    });
    const studioFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    studioFloor.rotation.x = -Math.PI / 2;
    studioFloor.position.y = 0;
    studioFloor.receiveShadow = true;
    scene.add(studioFloor);

    const dummy = new THREE.Object3D();
    const bubbleGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.95,
        ior: 1.1,
        transparent: true,
        opacity: 1,
        attenuationColor: 0x38bdf8,
        attenuationDistance: 2.0,
        envMap: scene.environment
    });
    const bubbleMesh = new THREE.InstancedMesh(bubbleGeo, bubbleMat, 150);

    const sizes = [0.5, 0.8, 1.2, 1.6];

    for (let i = 0; i < 150; i++) {
        let x = 0;
        let z = 0;
        while (Math.sqrt(x * x + z * z) <= 2.5) {
            x = (Math.random() - 0.5) * 11;
            z = (Math.random() - 0.5) * 11;
        }
        const y = Math.random() * 5.5 + 0.5;
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];

        dummy.position.set(x, y, z);
        dummy.scale.set(randomSize, randomSize, randomSize);
        dummy.updateMatrix();
        bubbleMesh.setMatrixAt(i, dummy.matrix);
    }

    bubbleMesh.instanceMatrix.needsUpdate = true;
    scene.add(bubbleMesh);
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

    // === [STEP 2.4: PRELOADER & TIMEOUT FAILSAFE] ===

    try {
        let isAssetLoaded = false;
        let isLogoFadeComplete = false;
        let hasTriggeredIntro = false;
        let progressState = { value: 0 };

        const brandHeader = document.getElementById('brand-header');
        const brandLogo = document.getElementById('brand-logo');
        const loadingProgress = document.getElementById('loading-progress');
        const introCurtain = document.getElementById('intro-curtain');

        function triggerIntroSequence() {
            try {
                if (hasTriggeredIntro) return;
                hasTriggeredIntro = true;

                // Stage C: Reveal (fade out counter and dark curtain)
                if (loadingProgress && window.gsap) {
                    gsap.to(loadingProgress, {
                        opacity: 0,
                        duration: 0.4,
                        ease: "power2.out",
                        overwrite: 'auto'
                    });
                } else if (loadingProgress) {
                    loadingProgress.style.opacity = '0';
                }

                if (introCurtain && window.gsap) {
                    gsap.to(introCurtain, {
                        opacity: 0,
                        duration: 1.4,
                        delay: 0.2,
                        ease: "power2.inOut",
                        overwrite: 'auto',
                        onComplete: () => {
                            try {
                                introCurtain.style.pointerEvents = 'none';
                            } catch (curtainErr) {
                                if (window.Sentry) {
                                    Sentry.captureException(curtainErr);
                                }
                            }
                        }
                    });
                } else if (introCurtain) {
                    introCurtain.style.opacity = '0';
                    introCurtain.style.pointerEvents = 'none';
                }

                // Stage D: Glide & Fly
                if (brandHeader && window.gsap) {
                    gsap.to(brandHeader, {
                        delay: 1.7,
                        duration: 1.2,
                        top: '1.25rem',
                        left: '1.25rem',
                        x: 0,
                        y: 0,
                        xPercent: 0,
                        yPercent: 0,
                        scale: 0.42,
                        transformOrigin: 'top left',
                        ease: "power3.inOut",
                        overwrite: 'auto'
                    });

                    gsap.to('.slogan-line', {
                        opacity: 1,
                        y: 0,
                        duration: 0.8,
                        stagger: 0.4,
                        delay: 2.6,
                        ease: "power2.out",
                        overwrite: 'auto'
                    });
                }

                // === [STEP 2.5: INTRO CAMERA FLIGHT] ===

                try {
                    if (window.gsap && camera && cameraTarget && VIEW_CONFIG && VIEW_CONFIG.home) {
                        gsap.to(camera.position, {
                            x: VIEW_CONFIG.home.zoomPos.x,
                            y: VIEW_CONFIG.home.zoomPos.y,
                            z: VIEW_CONFIG.home.zoomPos.z,
                            duration: 2.5,
                            delay: 2.6,
                            ease: "power3.inOut",
                            overwrite: 'auto'
                        });

                        gsap.to(cameraTarget, {
                            x: VIEW_CONFIG.home.zoomTarget.x,
                            y: VIEW_CONFIG.home.zoomTarget.y,
                            z: VIEW_CONFIG.home.zoomTarget.z,
                            duration: 2.5,
                            delay: 2.6,
                            ease: "power3.inOut",
                            overwrite: 'auto',
                            onUpdate: () => {
                                camera.lookAt(cameraTarget);
                            },
                            onComplete: () => {
                                isIntroComplete = true;
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error in intro camera flight:", error);
                    if (window.Sentry) {
                        Sentry.captureException(error);
                    }
                }

                // === [STEP 2.6: INTRO MENU & CTA REVEAL] ===

                try {
                    if (window.gsap) {
                        gsap.to('.main-menu-btn', {
                            x: 0,
                            opacity: 1,
                            duration: 0.8,
                            stagger: 0.15,
                            delay: 3.2,
                            ease: "power3.out",
                            overwrite: 'auto',
                            onStart: function() {
                                try {
                                    document.querySelectorAll('.main-menu-btn').forEach(btn => {
                                        btn.style.pointerEvents = 'auto';
                                    });
                                } catch (btnErr) {
                                    if (window.Sentry) {
                                        Sentry.captureException(btnErr);
                                    }
                                }
                            }
                        });

                        gsap.to('#book-now-bubble', {
                            opacity: 1,
                            duration: 0.8,
                            delay: 3.2,
                            ease: "power2.out",
                            overwrite: 'auto',
                            onStart: () => {
                                try {
                                    const bookNowBubble = document.getElementById('book-now-bubble');
                                    if (bookNowBubble) {
                                        bookNowBubble.style.pointerEvents = 'auto';
                                    }
                                } catch (ctaErr) {
                                    if (window.Sentry) {
                                        Sentry.captureException(ctaErr);
                                    }
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error in intro menu and CTA reveal:", error);
                    if (window.Sentry) {
                        Sentry.captureException(error);
                    }
                }
            } catch (introError) {
                console.error("Error in triggerIntroSequence:", introError);
                if (window.Sentry) {
                    Sentry.captureException(introError);
                }
            }
        }

        // Stage A: Logo Fade-In -> Stage B: Loading Counter
        if (brandLogo && window.gsap) {
            gsap.fromTo(
                brandLogo,
                { opacity: 0 },
                {
                    opacity: 1,
                    duration: 1.8,
                    ease: "power2.inOut",
                    onComplete: () => {
                        try {
                            isLogoFadeComplete = true;

                            if (loadingProgress) {
                                gsap.to(loadingProgress, {
                                    opacity: 1,
                                    duration: 0.3,
                                    ease: "power2.out"
                                });
                            }

                            if (isAssetLoaded) {
                                gsap.to(progressState, {
                                    value: 100,
                                    duration: 1.6,
                                    ease: "power1.inOut",
                                    onUpdate: () => {
                                        if (loadingProgress) {
                                            loadingProgress.textContent = Math.round(progressState.value) + '%';
                                        }
                                    },
                                    onComplete: () => {
                                        triggerIntroSequence();
                                    }
                                });
                            } else {
                                gsap.to(progressState, {
                                    value: 85,
                                    duration: 5.0,
                                    ease: "power1.out",
                                    onUpdate: () => {
                                        if (loadingProgress) {
                                            loadingProgress.textContent = Math.round(progressState.value) + '%';
                                        }
                                    }
                                });
                            }
                        } catch (stageBErr) {
                            console.error("Error in Stage B loading counter:", stageBErr);
                            if (window.Sentry) {
                                Sentry.captureException(stageBErr);
                            }
                        }
                    }
                }
            );
        }

        const fallbackTimeout = setTimeout(() => {
            try {
                isAssetLoaded = true;
                if (window.gsap) {
                    gsap.killTweensOf(progressState);
                    gsap.to(progressState, {
                        value: 100,
                        duration: 0.6,
                        ease: "power1.inOut",
                        onUpdate: () => {
                            if (loadingProgress) {
                                loadingProgress.textContent = Math.round(progressState.value) + '%';
                            }
                        },
                        onComplete: () => {
                            triggerIntroSequence();
                        }
                    });
                } else {
                    if (loadingProgress) {
                        loadingProgress.textContent = '100%';
                    }
                    triggerIntroSequence();
                }

                if (window.Sentry) {
                    Sentry.captureException(new Error("3D Model Load Timeout Failsafe Triggered"));
                }
            } catch (timeoutError) {
                console.error("Error in preloader timeout failsafe:", timeoutError);
                if (window.Sentry) {
                    Sentry.captureException(timeoutError);
                }
            }
        }, 15000);

        loadingManager.onLoad = () => {
            try {
                isAssetLoaded = true;
                clearTimeout(fallbackTimeout);

                if (isLogoFadeComplete && window.gsap) {
                    gsap.killTweensOf(progressState);
                    gsap.to(progressState, {
                        value: 100,
                        duration: 0.6,
                        ease: "power1.inOut",
                        onUpdate: () => {
                            if (loadingProgress) {
                                loadingProgress.textContent = Math.round(progressState.value) + '%';
                            }
                        },
                        onComplete: () => {
                            triggerIntroSequence();
                        }
                    });
                }
            } catch (loadError) {
                console.error("Error in loadingManager.onLoad:", loadError);
                if (window.Sentry) {
                    Sentry.captureException(loadError);
                }
            }
        };

        loadingManager.onError = (url) => {
            try {
                console.error(`Error loading asset from URL: ${url}`);
                if (window.Sentry) {
                    Sentry.captureException(new Error(`Failed to load 3D asset: ${url}`));
                }
            } catch (errHandlerError) {
                console.error("Error in loadingManager.onError:", errHandlerError);
                if (window.Sentry) {
                    Sentry.captureException(errHandlerError);
                }
            }
        };
    } catch (error) {
        console.error("Error configuring preloader and timeout failsafe:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }

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

// === [STEP 3.3: OUTBOUND MENU SEQUENCE] ===

function hideMainMenu(onCompleteCallback) {
    try {
        if (!window.gsap) return;

        gsap.to('.main-menu-btn', {
            x: '150%',
            opacity: 0,
            duration: 0.6,
            ease: "power3.in",
            stagger: {
                each: 0.12,
                from: 'end'
            },
            overwrite: 'auto',
            onStart: () => {
                try {
                    document.querySelectorAll('.main-menu-btn').forEach(btn => {
                        btn.style.pointerEvents = 'none';
                    });
                } catch (startErr) {
                    if (window.Sentry) {
                        Sentry.captureException(startErr);
                    }
                }
            },
            onComplete: () => {
                try {
                    if (typeof onCompleteCallback === 'function') {
                        onCompleteCallback();
                    }
                } catch (callbackErr) {
                    console.error("Error in hideMainMenu onCompleteCallback:", callbackErr);
                    if (window.Sentry) {
                        Sentry.captureException(callbackErr);
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error in hideMainMenu:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }
}

try {
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) {
        mainMenu.addEventListener('click', (e) => {
            try {
                const btn = e.target.closest('.main-menu-btn');
                if (!btn) return;
                if (isTransitioning) return;

                isTransitioning = true;
                const targetKey = btn.getAttribute('data-target');
                currentView = targetKey;

                hideMainMenu(() => {
                    transitionCameraToSection(targetKey, () => {
                        showSubMenu(targetKey);
                        updateAndShowContent(targetKey);
                    });
                });
            } catch (error) {
                console.error("Error handling main menu click:", error);
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
            }
        });
    }
} catch (error) {
    console.error("Error attaching main menu click listener:", error);
    if (window.Sentry) {
        Sentry.captureException(error);
    }
}

// === [STEP 4.1: 2-STAGE CAMERA ROUTING] ===

function transitionCameraToSection(targetKey, onCompleteCallback) {
    try {
        if (!window.gsap || !camera || !cameraTarget || !VIEW_CONFIG || !VIEW_CONFIG[targetKey]) {
            isTransitioning = false;
            return;
        }

        const targetView = VIEW_CONFIG[targetKey];

        gsap.killTweensOf([camera.position, cameraTarget]);

        const tl = gsap.timeline({
            onComplete: () => {
                try {
                    if (typeof onCompleteCallback === 'function') {
                        onCompleteCallback();
                    }
                } catch (callbackErr) {
                    console.error("Error in transitionCameraToSection onCompleteCallback:", callbackErr);
                    if (window.Sentry) {
                        Sentry.captureException(callbackErr);
                    }
                }
            }
        });

        // Stage 1: Wide Out
        tl.to(camera.position, {
            x: targetView.widePos.x,
            y: targetView.widePos.y,
            z: targetView.widePos.z,
            duration: 1.2,
            ease: "power2.inOut"
        }, 0);

        tl.to(cameraTarget, {
            x: targetView.wideTarget.x,
            y: targetView.wideTarget.y,
            z: targetView.wideTarget.z,
            duration: 1.2,
            ease: "power2.inOut",
            onUpdate: () => {
                camera.lookAt(cameraTarget);
            }
        }, 0);

        // Stage 2: Zoom In (after brief pause)
        tl.to(camera.position, {
            x: targetView.zoomPos.x,
            y: targetView.zoomPos.y,
            z: targetView.zoomPos.z,
            duration: 1.5,
            ease: "power3.inOut"
        }, "+=0.35");

        tl.to(cameraTarget, {
            x: targetView.zoomTarget.x,
            y: targetView.zoomTarget.y,
            z: targetView.zoomTarget.z,
            duration: 1.5,
            ease: "power3.inOut",
            onUpdate: () => {
                camera.lookAt(cameraTarget);
            }
        }, "<");
    } catch (error) {
        isTransitioning = false;
        console.error("Error in transitionCameraToSection:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }
}

// === [STEP 4.2: INBOUND SUB-MENU SEQUENCE] ===

function showSubMenu(activeKey) {
    try {
        if (!window.gsap) return;

        const allSubButtons = document.querySelectorAll('.sub-menu-btn');
        const visibleSubButtons = [];

        allSubButtons.forEach((btn) => {
            if (btn.getAttribute('data-target') === activeKey) {
                btn.style.display = 'none';
                btn.style.pointerEvents = 'none';
            } else {
                btn.style.display = 'inline-flex';
                btn.style.pointerEvents = 'auto';
                visibleSubButtons.push(btn);
            }
        });

        if (visibleSubButtons.length > 0) {
            gsap.to(visibleSubButtons, {
                y: 0,
                opacity: 1,
                duration: 0.6,
                ease: "power3.out",
                stagger: {
                    each: 0.12,
                    from: 'start'
                },
                overwrite: 'auto'
            });
        }
    } catch (error) {
        console.error("Error in showSubMenu:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }
}

// === [STEP 4.3: XSS-SAFE CONTENT POPULATION] ===

function updateAndShowContent(targetKey) {
    try {
        if (!VIEW_CONFIG || !VIEW_CONFIG[targetKey]) {
            isTransitioning = false;
            return;
        }

        const targetView = VIEW_CONFIG[targetKey];
        const contentDisplay = document.getElementById('content-display');
        const contentTitle = document.getElementById('content-title');
        const contentBody = document.getElementById('content-body');

        if (contentTitle) {
            contentTitle.textContent = targetView.title || '';
        }

        if (contentBody) {
            contentBody.innerHTML = targetView.body || '';
        }

        if (contentDisplay && window.gsap) {
            gsap.to(contentDisplay, {
                opacity: 1,
                duration: 0.6,
                ease: "power2.out",
                overwrite: 'auto'
            });
        } else if (contentDisplay) {
            contentDisplay.style.opacity = '1';
        }

        isTransitioning = false;
    } catch (error) {
        isTransitioning = false;
        console.error("Error in updateAndShowContent:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }
}

// === [STEP 5.1 & 5.2: INTER-MENU NAVIGATION] ===

try {
    const subMenu = document.getElementById('sub-menu');
    if (subMenu) {
        subMenu.addEventListener('click', (e) => {
            try {
                const btn = e.target.closest('.sub-menu-btn');
                if (!btn) return;
                if (isTransitioning) return;

                const newTargetKey = btn.getAttribute('data-target');
                if (newTargetKey === 'home') {
                    returnToHomeView();
                    return;
                }

                isTransitioning = true;
                currentView = newTargetKey;

                if (!window.gsap) {
                    isTransitioning = false;
                    return;
                }

                document.querySelectorAll('.sub-menu-btn').forEach(subBtn => {
                    subBtn.style.pointerEvents = 'none';
                });

                gsap.to('#content-display', {
                    opacity: 0,
                    duration: 0.4,
                    ease: "power2.in",
                    overwrite: 'auto'
                });

                gsap.to('.sub-menu-btn', {
                    y: '150%',
                    opacity: 0,
                    duration: 0.5,
                    ease: "power3.in",
                    stagger: {
                        each: 0.1,
                        from: 'end'
                    },
                    overwrite: 'auto',
                    onComplete: () => {
                        transitionCameraToSection(newTargetKey, () => {
                            showSubMenu(newTargetKey);
                            updateAndShowContent(newTargetKey);
                        });
                    }
                });
            } catch (error) {
                isTransitioning = false;
                console.error("Error handling sub-menu click:", error);
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
            }
        });
    }
} catch (error) {
    console.error("Error attaching sub-menu click listener:", error);
    if (window.Sentry) {
        Sentry.captureException(error);
    }
}

// === [STEP 5.3: DUAL-TRIGGER HOME RESET] ===

function returnToHomeView() {
    try {
        if (isTransitioning) return;
        isTransitioning = true;
        currentView = 'home';

        if (!window.gsap || !camera || !cameraTarget || !VIEW_CONFIG || !VIEW_CONFIG.home) {
            isTransitioning = false;
            return;
        }

        gsap.killTweensOf([camera.position, cameraTarget]);

        const allSubButtons = document.querySelectorAll('.sub-menu-btn');
        const visibleSubButtons = [];
        allSubButtons.forEach((btn) => {
            btn.style.pointerEvents = 'none';
            if (btn.style.display !== 'none') {
                visibleSubButtons.push(btn);
            }
        });

        const tl = gsap.timeline({
            onComplete: () => {
                isTransitioning = false;
            }
        });

        // 1. Fade out content display & drop visible sub-menu buttons off-screen
        tl.to('#content-display', {
            opacity: 0,
            duration: 0.4,
            ease: "power2.in",
            overwrite: 'auto'
        }, 0);

        if (visibleSubButtons.length > 0) {
            tl.to(visibleSubButtons, {
                y: '150%',
                opacity: 0,
                duration: 0.5,
                ease: "power3.in",
                stagger: {
                    each: 0.1,
                    from: 'end'
                },
                overwrite: 'auto'
            }, 0);
        }

        // 2. Fly camera back to home top-down roof view
        tl.to(camera.position, {
            x: VIEW_CONFIG.home.zoomPos.x,
            y: VIEW_CONFIG.home.zoomPos.y,
            z: VIEW_CONFIG.home.zoomPos.z,
            duration: 2.0,
            ease: "power3.inOut",
            overwrite: 'auto'
        }, 0.25);

        tl.to(cameraTarget, {
            x: VIEW_CONFIG.home.zoomTarget.x,
            y: VIEW_CONFIG.home.zoomTarget.y,
            z: VIEW_CONFIG.home.zoomTarget.z,
            duration: 2.0,
            ease: "power3.inOut",
            overwrite: 'auto',
            onUpdate: () => {
                camera.lookAt(cameraTarget);
            }
        }, 0.25);

        // 3. Glide main menu options back in from the right
        tl.to('.main-menu-btn', {
            x: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            stagger: {
                each: 0.15,
                from: 'start'
            },
            overwrite: 'auto',
            onStart: () => {
                try {
                    document.querySelectorAll('.main-menu-btn').forEach(btn => {
                        btn.style.pointerEvents = 'auto';
                    });
                } catch (btnErr) {
                    if (window.Sentry) {
                        Sentry.captureException(btnErr);
                    }
                }
            }
        }, "-=0.6");
    } catch (error) {
        isTransitioning = false;
        console.error("Error in returnToHomeView:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }
}

try {
    const brandHeader = document.getElementById('brand-header');
    if (brandHeader) {
        brandHeader.addEventListener('click', () => {
            try {
                if (!isIntroComplete || currentView === 'home') return;
                returnToHomeView();
            } catch (error) {
                console.error("Error handling brand header click:", error);
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
            }
        });
    }
} catch (error) {
    console.error("Error attaching brand header click listener:", error);
    if (window.Sentry) {
        Sentry.captureException(error);
    }
}

// === [STEP 2.7: BUBBLE POP CTA & SPLASH LOGIC] ===

let isBubblePopping = false;

function createSplash(x, y) {
    try {
        const drop = document.createElement('div');
        drop.classList.add('droplet');

        const size = Math.random() * 5 + 3;
        drop.style.width = size + 'px';
        drop.style.height = size + 'px';

        drop.style.left = x + 'px';
        drop.style.top = y + 'px';

        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 60 + 40;

        drop.style.setProperty('--end-x', 'calc(-50% + ' + (Math.cos(angle) * distance) + 'px)');
        drop.style.setProperty('--end-y', 'calc(-50% + ' + ((Math.sin(angle) * distance) + 30) + 'px)');

        drop.style.animationDuration = (Math.random() * 0.3 + 0.3) + 's';

        document.body.appendChild(drop);

        drop.addEventListener('animationend', () => {
            try {
                drop.remove();
            } catch (removeErr) {
                if (window.Sentry) {
                    Sentry.captureException(removeErr);
                }
            }
        });
    } catch (error) {
        console.error("Error creating splash droplet:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }
}

try {
    const bookNowBubble = document.getElementById('book-now-bubble');
    if (bookNowBubble) {
        bookNowBubble.addEventListener('click', (e) => {
            try {
                e.preventDefault();
                if (isBubblePopping) return;
                isBubblePopping = true;

                const rect = bookNowBubble.getBoundingClientRect();
                const centerX = rect.left + (rect.width / 2);
                const centerY = rect.top + (rect.height / 2);

                if (window.gsap) {
                    gsap.killTweensOf(bookNowBubble);
                }

                bookNowBubble.classList.add('pop');

                for (let i = 0; i < 14; i++) {
                    createSplash(centerX, centerY);
                }

                setTimeout(() => {
                    try {
                        window.location.href = bookNowBubble.getAttribute('href') || 'index.html';
                    } catch (navErr) {
                        if (window.Sentry) {
                            Sentry.captureException(navErr);
                        }
                    }
                }, 380);
            } catch (error) {
                isBubblePopping = false;
                console.error("Error in book-now-bubble click handler:", error);
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
            }
        });
    }
} catch (error) {
    console.error("Error attaching book-now-bubble click listener:", error);
    if (window.Sentry) {
        Sentry.captureException(error);
    }
}

window.addEventListener('pageshow', (event) => {
    try {
        if (event.persisted || isBubblePopping) {
            isBubblePopping = false;
            const bookNowBubble = document.getElementById('book-now-bubble');
            if (bookNowBubble) {
                bookNowBubble.classList.remove('pop');
                bookNowBubble.style.opacity = '1';
                bookNowBubble.style.pointerEvents = 'auto';
            }
        }
    } catch (error) {
        console.error("Error in pageshow bfcache handler:", error);
        if (window.Sentry) {
            Sentry.captureException(error);
        }
    }
});

