/* ==========================================================================
   ADA ZDROWA — 3D KNEE ANATOMICAL VISUALIZER (three-charts.js)
   Using Three.js WebGL rendering for 3D Knee Joint, ACL & Meniscus highlight
   ========================================================================== */

let kneeScene, kneeCamera, kneeRenderer;
let femurMesh, tibiaMesh, aclMesh, meniscusMesh, effusionMesh;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let kneeGroup;

document.addEventListener("DOMContentLoaded", () => {
    init3DKneeVisualizer();
});

function init3DKneeVisualizer() {
    const container = document.getElementById("canvas3dKnee");
    if (!container) return;

    // 1. Scene Setup
    kneeScene = new THREE.Scene();
    kneeScene.background = new THREE.Color(0x0e131f);

    // 2. Camera Setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    kneeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    kneeCamera.position.set(0, 0, 18);

    // 3. Renderer Setup
    kneeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    kneeRenderer.setSize(width, height);
    kneeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    kneeRenderer.shadowMap.enabled = true;
    container.appendChild(kneeRenderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    kneeScene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f2fe, 1.2);
    dirLight1.position.set(10, 15, 10);
    kneeScene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xbd93f9, 0.8);
    dirLight2.position.set(-10, -10, -10);
    kneeScene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xff5555, 1.5, 15);
    pointLight.position.set(0, 0, 2);
    kneeScene.add(pointLight);

    // 5. Construct 3D Knee Anatomical Group
    kneeGroup = new THREE.Group();

    // Femur (Thigh bone) - Top bone cylinder with condyles
    const femurGeo = new THREE.CylinderGeometry(1.6, 2.2, 7, 32);
    const boneMaterial = new THREE.MeshPhongMaterial({
        color: 0xe2e8f0,
        shininess: 40,
        flatShading: false
    });
    femurMesh = new THREE.Mesh(femurGeo, boneMaterial);
    femurMesh.position.set(0, 4.2, 0);
    kneeGroup.add(femurMesh);

    // Femur Condyles (Bottom of Femur)
    const condyleGeo1 = new THREE.SphereGeometry(1.4, 32, 16);
    const condyle1 = new THREE.Mesh(condyleGeo1, boneMaterial);
    condyle1.position.set(-1.1, 1.2, 0);
    kneeGroup.add(condyle1);

    const condyle2 = new THREE.Mesh(condyleGeo1, boneMaterial);
    condyle2.position.set(1.1, 1.2, 0);
    kneeGroup.add(condyle2);

    // Tibia (Shin bone) - Bottom bone
    const tibiaGeo = new THREE.CylinderGeometry(2.0, 1.4, 7, 32);
    tibiaMesh = new THREE.Mesh(tibiaGeo, boneMaterial);
    tibiaMesh.position.set(0, -4.2, 0);
    kneeGroup.add(tibiaMesh);

    // Meniscus Disc (Interarticular cartilage) - Amber glowing ring
    const meniscusGeo = new THREE.TorusGeometry(1.8, 0.45, 16, 32);
    const meniscusMat = new THREE.MeshStandardMaterial({
        color: 0xffb86c,
        emissive: 0xffb86c,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.3
    });
    meniscusMesh = new THREE.Mesh(meniscusGeo, meniscusMat);
    meniscusMesh.rotation.x = Math.PI / 2;
    meniscusMesh.position.set(0, 0.2, 0);
    kneeGroup.add(meniscusMesh);

    // ACL (Anterior Cruciate Ligament) - Red glowing diagonal cylinder
    const aclGeo = new THREE.CylinderGeometry(0.35, 0.35, 3.2, 16);
    const aclMat = new THREE.MeshStandardMaterial({
        color: 0xff5555,
        emissive: 0xff5555,
        emissiveIntensity: 0.7,
        roughness: 0.1
    });
    aclMesh = new THREE.Mesh(aclGeo, aclMat);
    aclMesh.rotation.z = -Math.PI / 6;
    aclMesh.rotation.x = Math.PI / 8;
    aclMesh.position.set(0.2, 0.8, 0.4);
    kneeGroup.add(aclMesh);

    // Effusion / Fluid Bubble (Cyan transparent sphere around joint)
    const effusionGeo = new THREE.SphereGeometry(2.6, 32, 16);
    const effusionMat = new THREE.MeshPhysicalMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0.25,
        roughness: 0.1,
        transmission: 0.8
    });
    effusionMesh = new THREE.Mesh(effusionGeo, effusionMat);
    effusionMesh.position.set(0, 0.4, 0);
    kneeGroup.add(effusionMesh);

    kneeScene.add(kneeGroup);

    // 6. Interactive Mouse Drag Controls
    container.addEventListener("mousedown", (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    container.addEventListener("mousemove", (e) => {
        if (!isDragging || !kneeGroup) return;

        const deltaMove = {
            x: e.clientX - previousMousePosition.x,
            y: e.clientY - previousMousePosition.y
        };

        kneeGroup.rotation.y += deltaMove.x * 0.01;
        kneeGroup.rotation.x += deltaMove.y * 0.01;

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    // Touch support for mobile
    container.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    });

    container.addEventListener("touchmove", (e) => {
        if (!isDragging || !kneeGroup || e.touches.length !== 1) return;

        const deltaMove = {
            x: e.touches[0].clientX - previousMousePosition.x,
            y: e.touches[0].clientY - previousMousePosition.y
        };

        kneeGroup.rotation.y += deltaMove.x * 0.01;
        kneeGroup.rotation.x += deltaMove.y * 0.01;

        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    container.addEventListener("touchend", () => {
        isDragging = false;
    });

    // Animation Loop
    animate3DKnee();
}

function animate3DKnee() {
    requestAnimationFrame(animate3DKnee);

    if (kneeGroup && !isDragging) {
        kneeGroup.rotation.y += 0.003;
    }

    if (kneeRenderer && kneeScene && kneeCamera) {
        kneeRenderer.render(kneeScene, kneeCamera);
    }
}

window.resize3DCanvas = function() {
    const container = document.getElementById("canvas3dKnee");
    if (!container || !kneeRenderer || !kneeCamera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    kneeCamera.aspect = width / height;
    kneeCamera.updateProjectionMatrix();
    kneeRenderer.setSize(width, height);
};

window.reset3DCamera = function() {
    if (kneeGroup) {
        kneeGroup.rotation.set(0, 0, 0);
    }
    if (kneeCamera) {
        kneeCamera.position.set(0, 0, 18);
    }
};

window.highlightACL = function() {
    if (aclMesh) {
        aclMesh.scale.set(1.5, 1.5, 1.5);
        setTimeout(() => aclMesh.scale.set(1, 1, 1), 2000);
    }
};

window.highlightMeniscus = function() {
    if (meniscusMesh) {
        meniscusMesh.scale.set(1.4, 1.4, 1.4);
        setTimeout(() => meniscusMesh.scale.set(1, 1, 1), 2000);
    }
};
