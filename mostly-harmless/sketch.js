/* Created for #WCCChallenge "Earth"

For this challenge I decided to try learning a little bit about THREE.js.
I have to say I am really impressed at the ability to texture all of the nodes on the icosahedron 
with high detail level. 

The sketch is, in large part, from Robot Bobby's earth and vertex-earth youtube tutorials. 
I have substituted free images from the NASA visible earth website and added a modified starfield.
You can adjust the height of the terrain by adjusting the multiplier on line 157. I have it set to create
a subtle effect, but you can crank it up by changing from 0.05 to a higher value.

I haved aded the lights on top of the earth image. To see the earth with just lights use lines 61-68 and 
comment out 70-76, 152, 185, 193 and set useLights = true

References: 
Hitchhiker's Guide to the Galaxy by Douglas Adams
Robot Bobby youtube channel: https://www.youtube.com/@robotbobby9/videos
ttps://github.com/bobbyroe/threejs-earth
https://github.com/bobbyroe/vertex-earth
Project Someday's "Earth" sketch https://openprocessing.org/sketch/2634514
https://threejs.org/manual/#en/primitives

Images from https://visibleearth.nasa.gov
Earth: https://visibleearth.nasa.gov/images/74218/december-blue-marble-next-generation
Topo: https://visibleearth.nasa.gov/images/73934/topography
Earth lights: https://visibleearth.nasa.gov/images/55167/earths-city-lights

*/

let renderer, scene, camera, texture, orbitControls;
let useLights = false;
let colorMap, lightsMap, elevMap, canvas;
const detail = 180; //130
let uniforms;
let elevMult; // parameter that controls height of terrain
let exploding = false;

function setup() {
  canvas = document.getElementById("threeCanvas");
  //threeCanvas = createCanvas(windowWidth, windowHeight, WEBGL); // don't want to do this!
  let button = document.getElementById("end");
  button.textContent = "Add Hyperpass Bypass";
  document.getElementById("end").addEventListener("click", () => {
    exploding = true;
  });

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
  camera.position.z = 2;

  orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.1;

  const textureLoader = new THREE.TextureLoader();

  // if (useLights) {
  // colorMap = textureLoader.load(
  // "earth_lights_lrg.jpg");
  // } else {colorMap = textureLoader.load(
  // "world.200412.3x5400x2700.jpg");}
  // const elevMap = textureLoader.load(
  //   "srtm_ramp2.worldx294x196.jpg"
  // );

  colorMap = textureLoader.load("images/world.200412.3x5400x2700.jpg");
  lightsMap = textureLoader.load("images/earth_lights_lrg.jpg");
  elevMap = textureLoader.load(
    "images/gebco_08_rev_elev_21600x10800.png"
  );

  // Add Earth geometry
  const earthGroup = new THREE.Group();
  // earthGroup.rotation.z = -23.4 * Math.PI / 180;
  scene.add(earthGroup);

  const geometry = new THREE.IcosahedronGeometry(1, 15);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x202020,
    wireframe: false,
  });

  const earthMesh = new THREE.Mesh(geometry, mat);
  earthGroup.add(earthMesh);

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
  // const hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 3);
  // scene.add(hemiLight)
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

  function animate(t = 0) {
    //earthGroup.rotation.y += 0.001; // animation gets a little pixalated with rotation
    requestAnimationFrame(animate);
    if (exploding) {
      // Displace the terrain
      uniforms.elevMult.value *= 1.1;
      let h5 = createElement("h5", "So long and thanks for all the fish");
      h5.position(10, 0);
      // Dolphins replace the earth!
      if (uniforms.elevMult.value > 50.0) {
        exploding = false;
        uniforms.elevMult.value = 0.05;
      }
    }
    renderer.render(scene, camera);
    orbitControls.update();
  }
  animate();
}

function getPointsMat(elevMap) {
  uniforms = {
    size: { type: "f", value: 4.0 },
    elevMult: { type: "f", value: 0.05 },
    colorTexture: { type: "t", value: colorMap },
    lightsTexture: { type: "t", value: lightsMap },
    elevTexture: { type: "t", value: elevMap },
  };
  const vs = `
	uniform float size;
	uniform float elevMult;
  uniform sampler2D elevTexture;

  varying vec2 vUv;
  varying float vVisible;
  varying float vElevation;

  void main() {
		vUv = uv;

		// sample elevation map
		float elv = texture2D(elevTexture, vUv).r;
		vElevation = elv; // pass to fragment shader

		// displace along the sphere's normal
		//vec3 displaced = position + normal * (0.05 * elv);
		vec3 displaced = position + normal * (elevMult * elv);
    // chatGPT suggested this improvement to the elevation calculation
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
	uniform sampler2D lightsTexture;

	varying vec2 vUv;
	varying float vVisible;
	varying float vElevation;

	void main() {
		vec4 baseColor = texture2D(colorTexture, vUv);
    vec4 lights = texture2D(lightsTexture, vUv);
		baseColor += lights;
		
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
