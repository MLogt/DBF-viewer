// main.js


window.addEventListener("load", () => {
  console.log("boat-viewer: init");

  const container = document.getElementById("boat-3d");
  const infoTitle = document.getElementById("boat-part-title");
  const infoDescription = document.getElementById("boat-part-description");

  if (!container) {
    console.error("No #boat-3d element found");
    return;
  }

  // --- Basic Three.js setup ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f4f6);

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(6, 3, 8);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let boatRoot = null;
  let highlightedPart = null;

  // --- Part configuration ---
  // Change keys to match object names in your GLB file (as seen in Blender outliner)
  const PART_CONFIG = {
    Transom: {
      cameraPos: new THREE.Vector3(0, 1.5, -6),
      lookAt: new THREE.Vector3(0, 1, -2),
      title: "Transom",
      description:
        "Transom engineered for high outboard loads with internal 3D-printed ribbing for stiffness and durability.",
    },
    Hull: {
      cameraPos: new THREE.Vector3(8, 3, 0),
      lookAt: new THREE.Vector3(0, 0.5, 0),
      title: "Hull",
      description:
        "Deep-V hull printed in HDPE with a structural infill pattern tuned for strength, stiffness, and reduced weight.",
    },
    Console: {
      cameraPos: new THREE.Vector3(2.5, 2, 2),
      lookAt: new THREE.Vector3(0, 1.5, 0),
      title: "Console",
      description:
        "Central console integrating steering, controls, and electronics in a clean, walk-around layout.",
    },
  };

  // --- Helpers ---

  function fitCameraToObject(object, offset = 1.3) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera.fov * Math.PI) / 180;
    let cameraZ = (maxDim / 2) / Math.tan(fov / 2);
    cameraZ *= offset;

    camera.position.set(
      center.x + cameraZ,
      center.y + cameraZ * 0.3,
      center.z + cameraZ
    );
    camera.lookAt(center);

    controls.target.copy(center);
    controls.update();

    console.log("fitCameraToObject:", { size, center, cameraZ });
  }

  function setHighlightedPart(mesh) {
    if (
      highlightedPart &&
      highlightedPart.material &&
      highlightedPart.material.originalEmissive
    ) {
      highlightedPart.material.emissive.copy(
        highlightedPart.material.originalEmissive
      );
    }

    highlightedPart = mesh;

    if (highlightedPart && highlightedPart.material) {
      if (!highlightedPart.material.originalEmissive) {
        highlightedPart.material.originalEmissive =
          highlightedPart.material.emissive.clone();
      }
      highlightedPart.material.emissive.setHex(0xffa500); // orange highlight
    }
  }

  function animateCameraTo(cfg) {
    if (!cfg) return;

    const from = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      lx: controls.target.x,
      ly: controls.target.y,
      lz: controls.target.z,
    };

    gsap.to(from, {
      duration: 1.2,
      x: cfg.cameraPos.x,
      y: cfg.cameraPos.y,
      z: cfg.cameraPos.z,
      lx: cfg.lookAt.x,
      ly: cfg.lookAt.y,
      lz: cfg.lookAt.z,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.position.set(from.x, from.y, from.z);
        controls.target.set(from.lx, from.ly, from.lz);
        controls.update();
      },
    });
  }

  function updateInfoPanel(partName) {
    const cfg = PART_CONFIG[partName];
    if (!cfg) {
      infoTitle.textContent = "Boat overview";
      infoDescription.textContent =
        "Click on different areas of the boat to focus and learn more about them.";
      return;
    }
    infoTitle.textContent = cfg.title;
    infoDescription.textContent = cfg.description;
  }

  // --- Load the GLB model from local file ---
  const loader = new THREE.GLTFLoader();
  loader.load(
    "./models/boat.glb",
    (gltf) => {
      console.log("GLB loaded");
      boatRoot = gltf.scene;
      boatRoot.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(boatRoot);
      fitCameraToObject(boatRoot);
    },
    (xhr) => {
      if (xhr.total) {
        console.log(`Loading model: ${(xhr.loaded / xhr.total) * 100}%`);
      }
    },
    (error) => {
      console.error("Error loading GLB:", error);
    }
  );

  // --- Handle clicks ---

  function onClick(event) {
    if (!boatRoot) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(boatRoot.children, true);
    if (intersects.length === 0) return;

    let mesh = intersects[0].object;
    console.log("Clicked mesh:", mesh.name);

    while (mesh && !PART_CONFIG[mesh.name] && mesh.parent) {
      mesh = mesh.parent;
    }

    if (mesh && PART_CONFIG[mesh.name]) {
      const partName = mesh.name;
      console.log("Resolved part:", partName);
      setHighlightedPart(mesh);
      updateInfoPanel(partName);
      animateCameraTo(PART_CONFIG[partName]);
    } else {
      console.log("Clicked part has no config entry");
    }
  }

  renderer.domElement.addEventListener("click", onClick);

  // --- Resize handling ---

  window.addEventListener("resize", () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

  // --- Render loop ---
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
});
