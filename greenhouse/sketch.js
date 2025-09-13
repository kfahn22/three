/* Created for #WCCChallenge "Greenhouse"

This is still a WIP.  Trying to figure out the best HDRi image for the scene.

https://github.com/dimforge/rapier
https://github.com/bobbyroe/physics-with-rapier-and-three
https://sbcode.net/threejs/physics-rapier/
https://threejs.org/examples/?q=trans#webgl_materials_physical_transmission
https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_physical_transmission.html
https://threejs.org/docs/#api/en/math/Box3 
https://polyhaven.com/a/pine_picnic
https://docs.polyhaven.com/en/faq
Authors: Dimitrios Savva and Jarod Guest: https://polyhaven.com/a/symmetrical_garden_02
*/

let renderer, scene, cma, orbitControls;
let textureLoader;

const glassParams = {
  color: 0xffffff,
  emissive: 0x88ccff,
  emissiveIntensity: 0.5,
  transmission: 1,
  roughness: 0,
  transparent: true, // false for debug
  opacity: 0.6,
};
const ironParams = {
  color: 0x000000,
  metalness: 1,
  roughness: 0.1,
};

async function setup() {
  canvas = document.getElementById("threeCanvas");

  // Set up Three.js renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x141414);

  // Set up camera
  const fov = 75;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 1000;
  // renamed camera so there it doesn't conflict with p5.js camera
  cma = new THREE.PerspectiveCamera(fov, aspect, near, far);
  const amount = 5;
  //const count = pow(amount, 3);
  cma.position.z = amount * 1.25;

  cma.position.z = 2;
  let cameraDirection = new THREE.Vector3();

  // Set up Three.js scene and add the greenhouse to the scene
  scene = new THREE.Scene();

  orbitControls = new THREE.OrbitControls(cma, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.1;

  //const link = "symmetrical_garden_02_4k.hdr";
  const link = "autumn_park_4k.hdr";

  addHDREnvironment(link);
  // 	const loader = new THREE.TextureLoader();
  //   loader.load('mountain_top.jpg', (texture) => {
  //   texture.mapping = THREE.EquirectangularReflectionMapping;
  //   scene.background = texture;
  //   scene.environment = texture; // makes glass reflective/refractive
  // });

  const numPanes = 6;
  const size = 0.2;
  const offset = size * 0.01;
  // total width of the wall
  const wallWidth = numPanes * (size + offset);
  const halfWidth = wallWidth / 2;

  const wallDepth = wallWidth; // assuming square base

  // Back wall
  scene.add(
    buildWall(
      numPanes,
      size,
      wallWidth,
      offset,
      0,
      0,
      0,
      new THREE.Vector3(0, 0, -wallDepth / 2)
    )
  );

  // TODO: Add door to front wall
  scene.add(
    buildWall(
      numPanes,
      size,
      wallWidth,
      offset,
      0,
      PI,
      0,
      new THREE.Vector3(0, 0, wallDepth / 2)
    )
  );

  // Left wall
  scene.add(
    buildWall(
      numPanes,
      size,
      wallWidth,
      offset,
      0,
      PI / 2,
      0,
      new THREE.Vector3(-wallWidth / 2, 0, 0)
    )
  );

  // Right wall
  scene.add(
    buildWall(
      numPanes,
      size,
      wallWidth,
      offset,
      0,
      -PI / 2,
      0,
      new THREE.Vector3(wallWidth / 2, 0, 0)
    )
  );

  // TODO: try bounding box	for roof placement
  const roofHeight = 3.5 * size;
  const roofAngle = PI / 4; // 45° slope

  // Left slope
  scene.add(
    buildWall(
      numPanes,
      size,
      wallWidth,
      offset,
      0,
      0,
      roofAngle,
      new THREE.Vector3(0, roofHeight, -halfWidth / 2)
    )
  );

  // Right slope
  scene.add(
    buildWall(
      numPanes,
      size,
      wallWidth,
      offset,
      0,
      0,
      -roofAngle,
      //new THREE.Vector3(0, wallHeight, halfWidth/2)
      new THREE.Vector3(0, roofHeight, halfWidth / 2)
    )
  );

  addGable(numPanes, size, roofHeight, roofAngle);

  // Sorry this is a hack to get the beam in the correct place.
  // Initially tried to use trig. I tried 1/2 wallHeight (4*size) + wallWidth*sin(roofAngle)
  scene.add(centerBeam(wallWidth, 5 * size, roofAngle));

  const sunLight = new THREE.DirectionalLight(0xffffff);
  sunLight.position.set(-2, 0.5, 1.5);
  scene.add(sunLight);

  // const hemiLight = new THREE.HemisphereLight(0x00bbff, 0xaa00ff);
  // hemiLight.intensity = 0.2;
  // scene.add(hemiLight);

  function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, cma);
  }

  animate();
}

function centerBeam(wallWidth, ridgeHeight) {
  const halfWidth = wallWidth / 2;
  const beamGeom = new THREE.BoxGeometry(wallWidth, 0.025, 0.025);
  const beamMat = new THREE.MeshPhysicalMaterial({
    color: ironParams.color,
    metalness: ironParams.metalness,
    roughness: ironParams.roughness,
  });

  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.position.set(0, ridgeHeight, 0);
  return beam;
}

function buildWall(
  numPanes,
  size,
  wallWidth,
  offset,
  y,
  rotationY = 0,
  rotationX = 0,
  position = new THREE.Vector3()
) {
  //const count = amount;
  const h = 4;
  //const plane = new THREE.PlaneGeometry(size, 4 * size);
  const thickness = 0.02;
  const pane = new THREE.BoxGeometry(size, h * size, size * thickness);
  const rod = new THREE.BoxGeometry(size * 0.1, h * size, size * 0.1);

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: glassParams.color,
    emissive: glassParams.emissive,
    emissiveIntensity: glassParams.emissiveIntensity,
    transmission: glassParams.transmission,
    roughness: glassParams.roughness,
    transparent: glassParams.transparent,
    opacity: glassParams.opacity,
  });

  const ironMaterial = new THREE.MeshPhysicalMaterial({
    color: ironParams.color,
    metalness: ironParams.metalness,
    roughness: ironParams.roughness,
  });

  const glassPane = new THREE.InstancedMesh(pane, glassMaterial, numPanes);
  const verticalStrud = new THREE.InstancedMesh(
    rod,
    ironMaterial,
    numPanes + 1
  );

  const wallGroup = new THREE.Group();
  wallGroup.add(glassPane);
  wallGroup.add(verticalStrud);

  const dummy = new THREE.Object3D();
  const halfWidth = wallWidth / 2;

  const horizontalRod = new THREE.BoxGeometry(
    wallWidth,
    size * 0.14,
    size * 0.105
  );
  const horizontalStrud = new THREE.InstancedMesh(
    horizontalRod,
    ironMaterial,
    8
  );
  wallGroup.add(horizontalStrud);

  // Add glass panes
  for (let i = 0; i < numPanes; i++) {
    const x = i * (size + offset) - halfWidth + size / 2;
    dummy.position.set(x, y, 0);
    dummy.updateMatrix();
    glassPane.setMatrixAt(i, dummy.matrix);
  }

  const wallHeight = h * size;

  dummy.position.set(0, -wallHeight / 2, 0);
  dummy.updateMatrix();
  horizontalStrud.setMatrixAt(0, dummy.matrix);
  dummy.position.set(0, wallHeight / 2, 0);
  dummy.updateMatrix();
  horizontalStrud.setMatrixAt(1, dummy.matrix);

  // Vertical supports
  for (let j = 0; j < numPanes + 1; j++) {
    const x = j * size - halfWidth;
    dummy.position.set(x, 0, 0);
    dummy.updateMatrix();
    verticalStrud.setMatrixAt(j, dummy.matrix);
  }

  // Rotate + position the wall group as a whole
  wallGroup.rotation.y = rotationY;
  wallGroup.rotation.x = rotationX;
  wallGroup.position.copy(position);

  return wallGroup;
}

// Gable suggested and implemented by chatGPT
function buildGable(baseWidth, wallHeight, roofAngle, material) {
  const halfWidth = baseWidth / 2;
  const ridgeHeight = wallHeight + Math.tan(roofAngle) * halfWidth;

  // Geometry for triangle (XY-plane)
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(0, ridgeHeight - wallHeight); // peak relative to top of wall
  shape.closePath();

  const geom = new THREE.ShapeGeometry(shape);

  const gable = new THREE.Mesh(geom, material);
  gable.position.y = wallHeight; // sit on top of wall
  return gable;
}

function addGable(numPanes, size, wallHeight, roofAngle) {
  // Reuse the same glass material as walls
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: glassParams.color,
    emissive: glassParams.emissive,
    emissiveIntensity: glassParams.emissiveIntensity,
    transmission: glassParams.transmission,
    roughness: glassParams.roughness,
    transparent: glassParams.transparent,
    opacity: glassParams.opacity,
  });

  // Dimensions
  //const wallHeight = 4 * size;
  const baseWidth = numPanes * size;
  //const roofAngle = Math.PI / 4;

  // Back gable
  const backGable = buildGable(baseWidth, wallHeight, roofAngle, glassMaterial);
  backGable.position.x = -baseWidth / 2;
  backGable.position.y = wallHeight - baseWidth / 4;
  backGable.rotation.y = -PI / 2; // face backward
  backGable.position.z = 0;
  scene.add(backGable);

  // Front gable
  const frontGable = buildGable(
    baseWidth,
    wallHeight,
    roofAngle,
    glassMaterial
  );
  let a = pow(baseWidth / 2, 0.5);
  frontGable.position.x = baseWidth / 2;
  frontGable.position.y = wallHeight - baseWidth / 4;
  frontGable.position.z = 0;
  frontGable.rotation.y = PI / 2;

  //	frontGable.position.z = baseWidth / 2;
  scene.add(frontGable);
}

function handleRaycast() {
  // orient the mouse plane to the camera
  cma.getWorldDirection(cameraDirection);
  cameraDirection.multiplyScalar(-1);
  mousePlane.lookAt(cameraDirection);

  raycaster.setFromCamera(pointerPos, cma);
  const intersects = raycaster.intersectObjects([mousePlane], false);
  if (intersects.length > 0) {
    mousePos.copy(intersects[0].point);
  }
}

// function handleWindowResize() {
//   camera.aspect = window.innerWidth / window.innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(window.innerWidth, window.innerHeight);
// }
//window.addEventListener("resize", handleWindowResize, false);

async function addRapierObjects() {
  // Import physics engine Rapier
  const RAPIER = await import(
    "https://cdn.skypack.dev/@dimforge/rapier3d-compat"
  );

  await RAPIER.init();
  const gravity = { x: 0.0, y: 0, z: 0.0 };
  const world = new RAPIER.World(gravity);

  const numBodies = 50;
  const bodies = [];
  for (let i = 0; i < numBodies; i++) {
    const body = getBody(RAPIER, world);
    bodies.push(body);
    scene.add(body.mesh);
  }

  const mouseBall = getMouseBall(RAPIER, world);
  scene.add(mouseBall.mesh);
}

//const link = "https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr";
function addHDREnvironment(link) {
  const hdrEquirect = new THREE.RGBELoader()
    .setDataType(THREE.UnsignedByteType)
    .load(link, (texture) => {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;

      scene.environment = envMap;
      scene.background = envMap;

      texture.dispose();
      pmremGenerator.dispose();
    });
  return hdrEquirect;
}
