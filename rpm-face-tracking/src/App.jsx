import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Vector3, Quaternion, Euler, Matrix4, SkinnedMesh, Color } from "three";
import {
  FilesetResolver,
  FaceLandmarker,
  PoseLandmarker,
  Category,
} from "@mediapipe/tasks-vision";
import { Camera } from "@mediapipe/camera_utils";
import "./App.css";

let faceLandmarker;
let poseLandmarker;
let lastVideoTime = 1;
let lastTimestamp = 1;
let headMesh = null;
let rotation = null;
let blendshapes = [];

function App() {
  const videoRef = useRef(null);
  const [url, setUrl] = useState(
    "https://models.readyplayer.me/668e86cff174a747795eef0f.glb"
  );
  const [poseData, setPoseData] = useState(null);
  const [faceData, setFaceData] = useState(null);

  const handleOnChange = (e) => {
    setUrl(e.target.value);
  };

  const setup = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`,
        delegate: "GPU",
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
    });

    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });

    const video = document.getElementById("video");
    navigator.mediaDevices
      .getUserMedia({
        video: { width: 280, height: 200 },
      })
      .then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predict);
      });
  };

  const predict = async () => {
    const video = document.getElementById("video");
    const nowInMs = Date.now();

    // 비디오의 현재 시간이 이전과 다를 때만 데이터를 처리
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;

      // 타임스탬프를 엄격히 증가시키기 위해 현재 타임스탬프를 증가
      const currentTimestamp = lastTimestamp + 1;
      lastTimestamp = currentTimestamp;

      // 얼굴과 포즈 데이터 감지
      const faceResult = await faceLandmarker.detectForVideo(
        video,
        currentTimestamp
      );
      const poseResult = await poseLandmarker.detectForVideo(
        video,
        currentTimestamp
      );

      // 얼굴 데이터 처리
      if (
        faceResult.facialTransformationMatrixes &&
        faceResult.facialTransformationMatrixes.length > 0 &&
        faceResult.faceBlendshapes &&
        faceResult.faceBlendshapes.length > 0
      ) {
        const matrix = new Matrix4().fromArray(
          faceResult.facialTransformationMatrixes[0].data
        );
        rotation = new Euler().setFromRotationMatrix(matrix);
        blendshapes = faceResult.faceBlendshapes[0].categories;
      }

      // 포즈 데이터 처리
      if (poseResult.landmarks && poseResult.landmarks.length > 0) {
        const landmarks = poseResult.landmarks; // 첫 번째 사람의 포즈 랜드마크 데이터를 가져옴

        // 포즈 랜드마크 데이터 처리 예시: 첫 번째 랜드마크의 x, y, z 좌표 및 visibility 값을 가져오는 방법
        const x = landmarks[0].x;
        const y = landmarks[0].y;
        const z = landmarks[0].z;
        const visibility = landmarks[0].visibility;

        // 필요한 경우 포즈 데이터를 상태에 설정
        setPoseData(poseResult.landmarks[0]);
      }

      // console.log(poseData);

      // 얼굴 데이터가 존재하면 설정
      if (faceResult.faceLandmarks) {
        setFaceData(faceResult.faceLandmarks);
      }
    }

    // 다음 프레임을 예약하여 계속해서 데이터를 감지하고 처리
    requestAnimationFrame(predict);
  };

  useEffect(() => {
    setup();
  }, []);

  return (
    <div className="App">
      <input
        type="text"
        placeholder="Enter your RPM avatar URL"
        onChange={handleOnChange}
      />
      <video autoPlay id="video" ref={videoRef}></video>
      <Canvas
        style={{ backgroundColor: "pink", height: 400 }}
        camera={{
          fov: 40,
        }}
      >
        <ambientLight intensity={0.5} />
        <pointLight
          position={[1, 1, 1]}
          color={new Color(1, 0, 0)}
          intensity={0.5}
        />
        <pointLight
          position={[-1, 0, 1]}
          color={new Color(0, 1, 0)}
          intensity={0.5}
        />
        <Avatar url={url} poseData={poseData} faceData={faceData} />
      </Canvas>
    </div>
  );
}

function Avatar({ url, poseData, faceData }) {
  const { scene, nodes } = useGLTF(
    `${url}?morphTargets=ARKit&textureAtlas=1024`
  );

  useEffect(() => {
    headMesh = nodes.Wolf3D_Avatar;
  }, [nodes]);

  useFrame(() => {
    if (nodes && poseData) {
      const leftShoulder =
        poseData[11] &&
        new Vector3(poseData[11].x, poseData[11].y, poseData[11].z);
      const rightShoulder =
        poseData[12] &&
        new Vector3(poseData[12].x, poseData[12].y, poseData[12].z);
      const leftElbow =
        poseData[13] &&
        new Vector3(poseData[13].x, poseData[13].y, poseData[13].z);
      const rightElbow =
        poseData[14] &&
        new Vector3(poseData[14].x, poseData[14].y, poseData[14].z);
      const leftWrist =
        poseData[15] &&
        new Vector3(poseData[15].x, poseData[15].y, poseData[15].z);
      const rightWrist =
        poseData[16] &&
        new Vector3(poseData[16].x, poseData[16].y, poseData[16].z);
      const leftPinky =
        poseData[17] &&
        new Vector3(poseData[17].x, poseData[17].y, poseData[17].z);
      const rightPinky =
        poseData[18] &&
        new Vector3(poseData[18].x, poseData[18].y, poseData[18].z);
      const leftIndex =
        poseData[19] &&
        new Vector3(poseData[19].x, poseData[19].y, poseData[19].z);
      const rightIndex =
        poseData[20] &&
        new Vector3(poseData[20].x, poseData[20].y, poseData[20].z);
      const leftThumb =
        poseData[21] &&
        new Vector3(poseData[21].x, poseData[21].y, poseData[21].z);
      const rightThumb =
        poseData[22] &&
        new Vector3(poseData[22].x, poseData[22].y, poseData[22].z);
      const nose =
        poseData[0] && new Vector3(poseData[0].x, poseData[0].y, poseData[0].z);

      // 스케일 조정
      const scaleFactor = 0.09;

      // 각 부분에 해당하는 노드가 존재하면 위치를 설정
      if (leftShoulder && nodes.LeftArm)
        nodes.LeftArm.position.copy(leftShoulder.multiplyScalar(scaleFactor));
      if (rightShoulder && nodes.RightArm)
        nodes.RightArm.position.copy(rightShoulder.multiplyScalar(scaleFactor));
      if (leftElbow && nodes.LeftForeArm)
        nodes.LeftForeArm.position.copy(leftElbow.multiplyScalar(scaleFactor));
      if (rightElbow && nodes.RightForeArm)
        nodes.RightForeArm.position.copy(
          rightElbow.multiplyScalar(scaleFactor)
        );
      if (leftWrist && nodes.LeftHand)
        nodes.LeftHand.position.copy(leftWrist.multiplyScalar(scaleFactor));
      if (rightWrist && nodes.RightHand)
        nodes.RightHand.position.copy(rightWrist.multiplyScalar(scaleFactor));
      if (leftPinky && nodes.LeftPinky)
        nodes.LeftPinky.position.copy(leftPinky.multiplyScalar(scaleFactor));
      if (rightPinky && nodes.RightPinky)
        nodes.RightPinky.position.copy(rightPinky.multiplyScalar(scaleFactor));
      if (leftIndex && nodes.LeftIndex)
        nodes.LeftIndex.position.copy(leftIndex.multiplyScalar(scaleFactor));
      if (rightIndex && nodes.RightIndex)
        nodes.RightIndex.position.copy(rightIndex.multiplyScalar(scaleFactor));
      if (leftThumb && nodes.LeftThumb)
        nodes.LeftThumb.position.copy(leftThumb.multiplyScalar(scaleFactor));
      if (rightThumb && nodes.RightThumb)
        nodes.RightThumb.position.copy(rightThumb.multiplyScalar(scaleFactor));
      // if (nose && nodes.Head) nodes.Head.position.copy(nose.multiplyScalar(scaleFactor));
    }
  });

  return (
    <primitive object={scene} scale={[1, 1, 1]} position={[0, -1.65, 0]} />
  );
}

export default App;
