import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const App = () => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [avatar, setAvatar] = useState(null);
  const [faceLandmarker, setFaceLandmarker] = useState(null);

  useEffect(() => {
    const setup = async () => {
      // Initialize the Three.js scene
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      const renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      containerRef.current.appendChild(renderer.domElement);

      const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
      scene.add(light);

      // Load the raccoon avatar
      const avatar = await loadAvatar();
      scene.add(avatar.gltf.scene);
      setAvatar(avatar);

      // Setup MediaPipe Face Landmarker
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        }
      );
      setFaceLandmarker(faceLandmarker);

      // Start video feed
      const constraints = { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      videoRef.current.onloadeddata = () => {
        videoRef.current.play();
      };

      // Render loop
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Detect face landmarks
      videoRef.current.addEventListener("loadeddata", () => {
        const detect = async () => {
          if (videoRef.current.readyState >= 2) {
            const results = await faceLandmarker.detectForVideo(
              videoRef.current,
              performance.now()
            );
            if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
              avatar.updateBlendshapes(results.faceBlendshapes[0]);
            }
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              const landmarks = results.faceLandmarks[0];
              const positions = landmarks.map((landmark) => {
                return new THREE.Vector3(
                  landmark.x * 2 - 1,
                  -(landmark.y * 2 - 1),
                  landmark.z * 2 - 1
                );
              });

              const boundingBox = new THREE.Box3().setFromObject(
                avatar.gltf.scene
              );
              const size = new THREE.Vector3();
              boundingBox.getSize(size);

              avatar.gltf.scene.position.set(
                positions[0].x * size.x,
                positions[0].y * size.y,
                positions[0].z * size.z
              );
            }
          }
          requestAnimationFrame(detect);
        };
        detect();
      });

      // Set camera position
      camera.position.z = 5;
    };

    setup();
  }, []);

  const loadAvatar = async () => {
    const url = "https://assets.codepen.io/9177687/raccoon_head.glb";
    const gltf = await new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        resolve(gltf);
      });
    });

    const morphTargetMeshes = [];
    gltf.scene.traverse((object) => {
      if (object.isMesh) {
        const mesh = object;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          morphTargetMeshes.push(mesh);
        }
      }
    });

    return {
      gltf,
      morphTargetMeshes,
      updateBlendshapes: (blendshapes) => {
        const categories = blendshapes.categories;
        let coefsMap = new Map();
        for (let i = 0; i < categories.length; ++i) {
          coefsMap.set(categories[i].categoryName, categories[i].score);
        }
        for (const mesh of morphTargetMeshes) {
          if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
            for (const [name, value] of coefsMap) {
              if (name in mesh.morphTargetDictionary) {
                const idx = mesh.morphTargetDictionary[name];
                mesh.morphTargetInfluences[idx] = value;
              }
            }
          }
        }
      },
    };
  };

  return (
    <div>
      <h1>Raccoon Avatar with Face Landmarker</h1>
      <div
        ref={containerRef}
        style={{
          width: "100vw",
          height: "100vh",
          position: "relative",
          overflow: "hidden",
        }}
      ></div>
      <video
        ref={videoRef}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "20vw",
          transform: "scaleX(-1)",
          zIndex: 9999999,
        }}
        autoPlay
        playsInline
      ></video>
    </div>
  );
};

export default App;
