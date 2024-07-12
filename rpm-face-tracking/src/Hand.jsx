import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const Hand = ({ videoRef }) => {
  const containerRef = useRef(null);
  const [handLandmarker, setHandLandmarker] = useState(null);

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

      // Load the hand model (replace with your hand model URL)
      const hand = await loadHand();
      scene.add(hand.gltf.scene);

      // Setup MediaPipe Hand Landmarker
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const handLandmarker = await HandLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        }
      );
      setHandLandmarker(handLandmarker);

      // Render loop
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Detect hand landmarks
      videoRef.current.addEventListener("loadeddata", () => {
        const detect = async () => {
          if (videoRef.current.readyState >= 2) {
            const results = await handLandmarker.detectForVideo(
              videoRef.current,
              performance.now()
            );
            if (results.handLandmarks && results.handLandmarks.length > 0) {
              const landmarks = results.handLandmarks[0];
              const positions = landmarks.map((landmark) => {
                return new THREE.Vector3(
                  landmark.x * 2 - 1,
                  -(landmark.y * 2 - 1),
                  landmark.z * 2 - 1
                );
              });

              hand.gltf.scene.position.set(
                positions[0].x,
                positions[0].y,
                positions[0].z
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
  }, [videoRef]);

  const loadHand = async () => {
    const url = "https://assets.codepen.io/9177687/raccoon_hand.glb"; // Replace with your hand model URL
    const gltf = await new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        resolve(gltf);
      });
    });

    return { gltf };
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    ></div>
  );
};

export default Hand;
