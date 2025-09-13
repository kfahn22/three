/* Created for #WCCChallenge "Earth"

For this challenge I decided to try learning a little bit about THREE.js.
I have to say I am really impressed at the ability to texture all of the nodes on the icosahedron.
The sketch is, in large part, from Robot Bobby's earth and vertex-earth youtube tutorials. 
I have substituted free images from the NASA visible earth website and added a modified starfield.
You can adjust hight of the terrrain by adjusting the multiplier on line 157. I have it set to create
a subtle effect, but you can crank it up by changing from 0.05 to a higher value.

Set useLights = true to see earth with lights;

References:  
Robot Bobby youtube channel: https://www.youtube.com/@robotbobby9/videos
https://github.com/bobbyroe/threejs-earth
https://github.com/bobbyroe/vertex-earth
Project Someday's "Earth" sketch https://openprocessing.org/sketch/2634514
https://threejs.org/manual/#en/primitives

Images from 
https://visibleearth.nasa.gov
Earth: https://visibleearth.nasa.gov/images/74218/december-blue-marble-next-generation
Topo: https://visibleearth.nasa.gov/images/73934/topography
Earth lights: https://visibleearth.nasa.gov/images/55167/earths-city-lights
Bathymetry: https://visibleearth.nasa.gov/images/73963/bathymetry/73964l
https://sketchfab.com/3d-models/dolphin-c24dc835a6aa4d3c827450513525cdb8#download
*/

let renderer, scene, camera, texture, orbitControls;
let useLights = false;
let colorMap, elevMap, oceanMap, canvas;
let dolphin1;
let pointerPos, earthUV;
let uniforms;
const initialDepth = -0.1;
const earthRadius = 1.0;
let earthMesh;
let raycaster = new THREE.Raycaster();
let mouseNDC = new THREE.Vector2();

let elevSampler = null; // lazy-created canvas samplers
let oceanSampler = null;

let phase = "idle"; // "idle" | "emerge" | "orbit"
let emergeStart = 0;
const emergeDuration = 10000; // ms
const orbitRadius = earthRadius + 0.3;
const orbitSpeed = 0.00055; // rad per ms

// where to emerge
const spawn = { normal: new THREE.Vector3(1, 0, 0), angle: 0 };

function setup() {
  canvas = document.getElementById("threeCanvas");
  background(0);

  // Load the dolphin model
  const loader = new THREE.GLTFLoader();
  loader.load(
    "dolphin1.glb",
    function (gltf) {
      dolphin1 = gltf.scene;
      dolphin1.scale.set(0.2, 0.2, 0.2); // scale dolphin down
      scene.add(dolphin1);
    },
    undefined,
    function (err) {
      console.error("Error loading GLTF:", err);
    }
  );

  // Set up Three.js renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x141414);

  // Set up Three.js scene
  scene = new THREE.Scene();

  // Set up camera
  const fov = 75;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 1000;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 3;

  orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.1;

  let mouse = new THREE.Vector2();

  // convert p5 mouseX/mouseY to NDC
  mouse.x = (mouseX / width) * 2 - 1;
  mouse.y = -(mouseY / height) * 2 + 1;

  const textureLoader = new THREE.TextureLoader();
  if (useLights) {
    colorMap = textureLoader.load("earth_lights_lrg.jpg");
  } else {
    colorMap = textureLoader.load("world.200412.3x5400x2700.jpg");
  }
  elevMap = textureLoader.load("srtm_ramp2.worldx294x196.jpg");
  oceanMap = textureLoader.load("gebco_08_rev_bath_3600x1800_color.jpg");

  // Add Earth geometry
  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = (-23.4 * Math.PI) / 180;
  scene.add(earthGroup);

  const geometry = new THREE.IcosahedronGeometry(1, 15);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x202020,
    wireframe: false,
  });

  earthMesh = new THREE.Mesh(geometry, mat);
  earthGroup.add(earthMesh);

  const detail = 130;
  const pointsGeo = new THREE.IcosahedronGeometry(1, detail);
  const pointsMat = getPointsMat(elevMap);
  const points = new THREE.Points(pointsGeo, pointsMat);
  earthGroup.add(points);

  // Add glow to earth
  const fresnelMaterial = getFresnelMat();

  // Slightly bigger sphere for atmosphere
  const glowMesh = new THREE.Mesh(geometry, fresnelMaterial);
  glowMesh.scale.setScalar(1.007), earthGroup.add(glowMesh);

  // Add lighting
  const sunLight = new THREE.DirectionalLight(0xffffff);
  sunLight.position.set(-2, 0.5, 1.5);
  scene.add(sunLight);

  const sphereGeometry = new THREE.SphereGeometry(0.1, 24, 10);
  const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0xfffffff });

  for (let i = 0; i < 1000; i++) {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    const radius = Math.random() * 25 + 25;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);
    sphere.position.set(x, y, z);
    scene.add(sphere);
  }

  const raycaster = new THREE.Raycaster();

  let mouseUV = new THREE.Vector2(0.5, 0.5);
  function onMouseMove(event) {
    // keep your shader mouse UV (nice ripple)
    mouseUV.x = event.clientX / window.innerWidth;
    mouseUV.y = 1.0 - event.clientY / window.innerHeight;
    uniforms.mouseUV.value.copy(mouseUV);

    // raycast to Earth
    mouseNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const hit = raycaster.intersectObject(earthMesh, false)[0];
    if (!hit) return;

    // only trigger from idle, and only if over ocean
    if (phase === "idle" && hit.uv && isOceanUV(hit.uv)) {
      // emergence normal = from center through hit point
      spawn.normal.copy(hit.point).normalize();
      spawn.angle = Math.atan2(hit.point.z, hit.point.x); // for equatorial orbit phase
      phase = "emerge";
      emergeStart = performance.now();
    }
  }
  window.addEventListener("mousemove", onMouseMove, false);

  // function onMouseMove(event) {
  //   // map from screen coords → normalized UV (0..1)
  //   mouseUV.x = event.clientX / window.innerWidth;
  //   mouseUV.y = 1.0 - event.clientY / window.innerHeight; // flip Y so 0 is bottom
  //   uniforms.mouseUV.value.copy(mouseUV);
  // }

  //window.addEventListener('mousemove', onMouseMove, false);

  function animate(t = 0) {
    requestAnimationFrame(animate);
    animateDolphin(t);
    orbitControls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function makeSampler(texture) {
  // build on first use (after image has loaded)
  const img = texture.image;
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return (u, v) => {
    // u,v in [0,1], v is OpenGL-style (0 bottom)
    const x = Math.min(img.width - 1, Math.max(0, Math.floor(u * img.width)));
    const y = Math.min(
      img.height - 1,
      Math.max(0, Math.floor((1 - v) * img.height))
    );
    const data = ctx.getImageData(x, y, 1, 1).data;
    return data; // [r,g,b,a]
  };
}

function isOceanUV(uv) {
  // prefer elevation (oceans ~ dark); fallback to bathymetry (oceans ~ blue)
  if (!elevSampler && elevMap.image) elevSampler = makeSampler(elevMap);
  if (elevSampler) {
    const [r, g, b] = elevSampler(uv.x, uv.y);
    if (r + g + b < 90) return true; // dark → ocean
  }
  if (!oceanSampler && oceanMap.image) oceanSampler = makeSampler(oceanMap);
  if (oceanSampler) {
    const [r, g, b] = oceanSampler(uv.x, uv.y);
    if (b > r && b > g) return true; // bluish → ocean
  }
  return false;
}

function getPointsMat(elevMap) {
  uniforms = {
    size: { type: "f", value: 4.0 },
    colorTexture: { type: "t", value: colorMap },
    elevTexture: { type: "t", value: elevMap },
    oceanTexture: { type: "t", value: oceanMap },
    mouseUV: { type: "v2", value: new THREE.Vector2(0.0, 0.0) },
    dolphinPos: { type: "v3", value: new THREE.Vector3(0, 0, 0) },
  };
  const vs = `
	uniform float size;
  uniform sampler2D elevTexture;
	uniform sampler2D oceanTexture;
	uniform vec2 mouseUV;
	uniform vec3 dolphinPos;

  varying vec2 vUv;
  varying float vVisible;
  varying float vElevation;

  void main() {
  vUv = uv;

  // sample elevation map
  float elv = texture2D(elevTexture, vUv).r;
  vElevation = elv;
	
	// ocean depth (bathymetry)
  float ocean = texture2D(oceanTexture, vUv).r;

	float dist = distance(mouseUV, vUv);
float zDist = 0.0;
if (dist < 0.05) {
  zDist = (0.05 - dist) * 3.0;
}

// displace along normal by both elevation and mouse effect
vec3 displaced = position + normal * (0.05 * elv + zDist);

// Displace ocean when dolphin emerges
float d = distance(position, dolphinPos);
  if (d < 0.2) {
    // push vertices outwards if dolphin is near
    displaced += normal * (0.1 * (0.2 - d));
  }
vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);


 // backface check
vec3 vNormal = normalMatrix * normal;
vVisible = step(0.0, dot(-normalize(mvPosition.xyz), normalize(vNormal)));

gl_PointSize = size;
gl_Position = projectionMatrix * mvPosition;
}
`;
  const fs = `
uniform sampler2D colorTexture;

	varying vec2 vUv;
	varying float vVisible;
	varying float vElevation;

	void main() {
		vec4 baseColor = texture2D(colorTexture, vUv);

		// simple elevation-based brightness tweak suggested by chatGPT
		float shade = mix(0.7, 1.3, vElevation); // valleys darker, mountains lighter
		shade = clamp(shade, 0.6, 1.4);

		vec3 finalColor = baseColor.rgb * shade;

		// discard invisible backfaces
		if (vVisible < 0.5) discard;

		gl_FragColor = vec4(finalColor, baseColor.a);
}
`;
  const pointsMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vs,
    fragmentShader: fs,
    transparent: true,
  });

  return pointsMat;
}

function getFresnelMat({ rimHex = 0x0088ff, facingHex = 0x000000 } = {}) {
  const uniforms = {
    color1: { value: new THREE.Color(rimHex) },
    color2: { value: new THREE.Color(facingHex) },
    fresnelBias: { value: 0.05 },
    fresnelScale: { value: 1.0 },
    fresnelPower: { value: 4.0 },
  };
  const vs = `
  uniform float fresnelBias;
  uniform float fresnelScale;
  uniform float fresnelPower;
  
  varying float vReflectionFactor;
  
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  
    vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
  
    vec3 I = worldPosition.xyz - cameraPosition;
  
    vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
  
    gl_Position = projectionMatrix * mvPosition;
  }
  `;
  const fs = `
  uniform vec3 color1;
  uniform vec3 color2;
  
  varying float vReflectionFactor;
  
  void main() {
    float f = clamp( vReflectionFactor, 0.0, 1.0 );
    gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
  }
  `;
  const fresnelMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vs,
    fragmentShader: fs,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
  return fresnelMat;
}

function animateDolphin(t) {
  if (!dolphin1) return;

  const now = performance.now();

  if (phase === "idle") {
    // keep dolphin just inside Earth, invisible
    dolphin1.position.copy(spawn.normal).multiplyScalar(initialDepth);
    dolphin1.visible = false;
    return;
  }

  dolphin1.visible = true;

  if (phase === "emerge") {
    const k = Math.min(1, (now - emergeStart) / emergeDuration); // 0→1
    const radius = THREE.MathUtils.lerp(initialDepth, earthRadius + 0.02, k);

    // move straight out along the local normal (head first)
    const pos = spawn.normal.clone().multiplyScalar(radius);
    dolphin1.position.copy(pos);

    // orientation during emergence:
    // forward = outward normal, up ≈ worldUp but orthonormalized
    const forward = spawn.normal.clone().normalize(); // nose points out
    const upHint = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, upHint).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const m = new THREE.Matrix4().makeBasis(right, up, forward);
    dolphin1.quaternion.setFromRotationMatrix(m);

    if (k >= 1) {
      // lock an initial orbit phase so we start where we emerged (projected to equator)
      phase = "orbit";
      dolphin1.userData.orbitStart = now;
      dolphin1.userData.orbitAngle0 = spawn.angle;
    }
  } else if (phase === "orbit") {
    // equatorial circular orbit around +Y axis
    const dt = now - dolphin1.userData.orbitStart;
    const angle = dolphin1.userData.orbitAngle0 + orbitSpeed * dt;

    const x = orbitRadius * Math.cos(angle);
    const z = orbitRadius * Math.sin(angle);
    const y = 0; // equator
    dolphin1.position.set(x, y, z);

    // keep body parallel to surface and nose-leading:
    // radial out = normal, tangent = direction of motion
    const normal = new THREE.Vector3(x, y, z).normalize();
    const tangent = new THREE.Vector3(
      -Math.sin(angle),
      0,
      Math.cos(angle)
    ).normalize();

    // IMPORTANT: many glTFs have "forward = -Z" under lookAt.
    // Use FORWARD_SIGN to force nose-first. -1 flips from tail-first to nose-first.
    const FORWARD_SIGN = -1;

    const forward = tangent.clone().multiplyScalar(FORWARD_SIGN); // nose along orbit path
    const right = new THREE.Vector3().crossVectors(forward, normal).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const m = new THREE.Matrix4().makeBasis(right, up, forward);
    dolphin1.quaternion.setFromRotationMatrix(m);
  }

  // feed dolphin position to your earth shader
  dolphin1.getWorldPosition(uniforms.dolphinPos.value);
}

// function animateDolphin(t) {
//   if (!dolphin1) return;

//   const emergenceStart = 1000;
//   const emergenceDuration = 2000;

//   if (t < emergenceStart) {
//     // hidden inside Earth
//     dolphin1.position.set(0, 0, 0);
//     return;
//   }

//   // time since start
//   const elapsed = t - emergenceStart;

//   // --- 1. Emergence phase (push dolphin outward along normal) ---
//   if (elapsed < emergenceDuration) {
//     const k = elapsed / emergenceDuration; // 0 → 1
//     const radius = THREE.MathUtils.lerp(initialDepth, earthRadius + 0.02, k);

//     // pick emergence longitude/latitude (here: equator, x-axis)
//     const angle = 0;
//     const x = radius * Math.cos(angle);
//     const y = 0;
//     const z = radius * Math.sin(angle);

//     dolphin1.position.set(x, y, z);

//     // headfirst = nose points outward from Earth center
//     dolphin1.lookAt(0, 0, 0);

//   } else {
//     // --- 2. Orbit phase ---
//     const orbitRadius = earthRadius + 0.35;
//     const orbitSpeed = 0.0005; // radians per ms
//     const angle = orbitSpeed * elapsed;

//     const x = orbitRadius * Math.cos(angle);
//     const y = 0;
//     const z = orbitRadius * Math.sin(angle);
//     dolphin1.position.set(x, y, z);

//     // compute tangent direction for orbit
//     const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
//     const up = new THREE.Vector3(0, 1, 0); // keep dorsal fin "up"
//     const m = new THREE.Matrix4();
//     m.lookAt(new THREE.Vector3(0,0,0), tangent, up);
//     dolphin1.quaternion.setFromRotationMatrix(m);
//   }

//   // update shader uniform with dolphin position
//   dolphin1.getWorldPosition(uniforms.dolphinPos.value);
// }

// function animateDolphin(t) {
// 	  if (dolphin1) {
//     if (t < 1000) {
//       // keep dolphin hidden below surface
//       dolphin1.position.set(0, 0, 0);
//     } else {
//       // compute time since emergence
//       const elapsed = (t - 1000) / 2000.0; // 2 sec transition
//       const k = Math.min(1.0, elapsed);   // clamp 0 → 1

//       // smoothly interpolate from underwater to orbit altitude
//       const radius = THREE.MathUtils.lerp(initialDepth, earthRadius + 0.02, k);

//       // pick an orbit path starting on the "black" side (negative x)
//       const angle = ( 0.001 * t + Math.PI); // start on backside
// 			if (k >= 1.0 && k < elapsed) {
//       dolphin1.position.set(
//         radius * Math.cos(angle),
//         radius,
//         radius * Math.sin(angle)
//       );
// 			} else {
// 				 dolphin1.position.set(
//         (earthRadius + 0.3) * Math.cos(angle),
//         earthRadius + 0.3,
//         (earthRadius + 0.3) * Math.sin(angle)
//       );
// 			}

// 			// update shader uniform
//       //dolphin1.getWorldPosition(uniforms.dolphinPos.value);
//       dolphin1.lookAt(0.5, 0.5, 0); // face Earth
//     }
//  }
// }
