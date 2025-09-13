/* Metacube



References:  
Robot Bobby youtube channel: https://www.youtube.com/@robotbobby9/videos
https://github.com/bobbyroe/meta-cube
https://threejs.org/manual/#en/primitives


*/

let renderer, scene, camera, texture, orbitControls;
let canvas;


// let params = {
//   noiseZoom: 2,
//   noiseAmp: 0.5,
// };

function setup() {
  canvas = document.getElementById("threeCanvas");

  // Set up Three.js renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x141414);

  const noise = new SimplexNoise();

  // Set up Three.js scene
  scene = new THREE.Scene();

  // Set up camera
  const fov = 75;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 1000;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  const amount = 30;
  const count = pow(amount, 3);
  camera.position.z = amount * 1.25;

  const textureLoader = new THREE.TextureLoader();

  orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.1;

  // let mouse = new THREE.Vector2();

  // // convert p5 mouseX/mouseY to NDC
  // mouse.x = (mouseX / width) * 2 - 1;
  // mouse.y = -(mouseY / height) * 2 + 1;

  const size = 0.5;
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshBasicMaterial({});
  //const material = new THREE.MeshStandardMaterial({});

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  scene.add(mesh);

  const nAmp = 0.1;
  const nScale = 2;
  let nz;
  const offset = (amount - 1) * 0.5;
  const dummy = new THREE.Object3D();
  const clr = new THREE.Color(0x0000000)
  let i = 0;
  for (let x = 0; x < amount; x += 1) {
    for (let y = 0; y < amount; y += 1) {
      for (let z = 0; z < amount; z += 1) {
        nz = noise.noise3D(x * nAmp, y * nAmp, z * nAmp) * nScale;
        dummy.position.set(offset - x + nz, offset - y + nz, offset - z + nz);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        i += 1;
      }
    }
  }

  const metacube = new THREE.Group();
  metacube.add(mesh);
  scene.add(metacube)
  metacube.userData = {
    update: (t) => {
    let i = 0;
    for (let x = 0; x < amount; x += 1) {
      for (let y = 0; y < amount; y += 1) {
        for (let z = 0; z < amount; z += 1) {
          nz = noise.noise3D(t + x * nAmp,t +  y * nAmp, t + z * nAmp) * nScale;
          dummy.position.set(offset - x + nz, offset - y + nz, offset - z + nz);
          dummy.scale.setScalar(nz)
          clr.setHSL(0.95 +nz *0.1, 1.0, 0.2 +nz *0.1)
          mesh.setColorAt(i, clr);
          mesh.instanceColor.needsUpdate = true;

          dummy.rotation.y =
            sin(x * 0.25 + t) + sin(y * 0.25 + t) + +sin(z * 0.25 + t);
            dummy.rotation.z = dummy.rotation.y *2;
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          i += 1;
        }
      }
    }
      mesh.instanceMatrix.needsUpdate = true;
    }
   
  };

  // Add hemi lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(hemiLight);

  const sphereGeometry = new THREE.SphereGeometry(0.1, 24, 10);
  const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0xfffffff });

  //window.addEventListener("mousemove", onMouseMove, false);

  function animate(t = 0) {
    t *= 0.00025;
    requestAnimationFrame(animate);
    metacube.userData.update(t);
    orbitControls.update();
    renderer.render(scene, camera);
  }
  animate();
}
