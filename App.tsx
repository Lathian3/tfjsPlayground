import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import { Camera, CameraType } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Platform, Dimensions } from 'react-native';
import * as cocoSSD from '@tensorflow-models/coco-ssd'
import * as tf from '@tensorflow/tfjs'
import { ExpoWebGLRenderingContext } from 'expo-gl';
import * as ScreenOrientation from 'expo-screen-orientation';
import Svg, { Rect } from 'react-native-svg';


const TensorCamera = cameraWithTensors(Camera);

const { width, height } = Dimensions.get('window');

const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';

// Camera preview size.
//
// From experiments, to render camera feed without distortion, 16:9 ratio
// should be used fo iOS devices and 4:3 ratio should be used for android
// devices.
//
// This might not cover all cases.
const CAM_PREVIEW_WIDTH = Dimensions.get('window').width;
const CAM_PREVIEW_HEIGHT = CAM_PREVIEW_WIDTH / (IS_IOS ? 9 / 16 : 3 / 4);

// The score threshold for pose detection results.
const MIN_KEYPOINT_SCORE = 0.3;

// The size of the resized output from TensorCamera.
//
// For movenet, the size here doesn't matter too much because the model will
// preprocess the input (crop, resize, etc). For best result, use the size that
// doesn't distort the image.
const OUTPUT_TENSOR_WIDTH = 180;
const OUTPUT_TENSOR_HEIGHT = OUTPUT_TENSOR_WIDTH / (IS_IOS ? 9 / 16 : 3 / 4);

// Whether to auto-render TensorCamera preview.
const AUTO_RENDER = false;

// Whether to load model from app bundle (true) or through network (false).
const LOAD_MODEL_FROM_BUNDLE = false;

export default function App() {

  const [model, setModel] = useState<cocoSSD.ObjectDetection>();
  const [predictions, setPredictions] = useState<cocoSSD.DetectedObject[]>();
  let context = useRef<CanvasRenderingContext2D>();
  let canvas = useRef<Canvas>();

  let textureDims = 
  Platform.OS === 'ios' 
  ? {height: 1920, width: 1080} 
  : {height: 1200, width: 1600}

  const cameraRef = useRef(null);
  const [tfReady, setTfReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [orientation, setOrientation] =
    useState<ScreenOrientation.Orientation>();
  const [cameraType, setCameraType] = useState<CameraType>(
    CameraType.front
  );
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    async function prepare() {
      rafId.current = null;

      // Set initial orientation.
      const curOrientation = await ScreenOrientation.getOrientationAsync();
      setOrientation(curOrientation);

      // Listens to orientation change.
      ScreenOrientation.addOrientationChangeListener((event) => {
        setOrientation(event.orientationInfo.orientation);
      });

  // Camera permission.
  await Camera.requestCameraPermissionsAsync();

  // Wait for tfjs to initialize the backend.
  await tf.ready();

  setModel(await cocoSSD.load());
  setTfReady(true);
}

prepare();
}, []);

useEffect(() => {
  // Called when the app is unmounted.
  return () => {
    if (rafId.current != null && rafId.current !== 0) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
  };
}, []);

  const handleCameraStream = async (
    images: any,
    updatePreview: () => void,
    gl: ExpoWebGLRenderingContext
  ) => {
    const loop = async () => {
      const nextImageTensor = images.next().value;

      const startTs = Date.now();
      const detections = await model!.detect(nextImageTensor);
      const latency = Date.now() - startTs;
      setFps(Math.floor(1000 / latency));
      setPredictions(detections);

      if(rafId.current === 0){
        return;
      }

      if (!AUTO_RENDER) {
        updatePreview();
        gl.endFrameEXP();
      }

      rafId.current = requestAnimationFrame(loop);

      /*
      if(!model || !nextImageTensor) 
        throw new Error('No model or image tensor');
      model
        .detect(nextImageTensor)
        .then((prediction) => {
        //Draw Rectangles
        drawRectangle(prediction, nextImageTensor);
      })
        .catch((error) => {
         console.log(error);
      });

    requestAnimationFrame(loop);
      */
    };
    loop();
  };

  const renderPrediciton = () => {
    if (predictions != null && predictions.length > 0){
      const Bboxes = predictions.map((b) =>{
        const flipX = IS_ANDROID || cameraType === CameraType.back;
          const x = flipX ? getOutputTensorWidth() - b.bbox[0] : b.bbox[0];
          const y = b.bbox[1];
          const cx =
            (x / getOutputTensorWidth()) *
            (isPortrait() ? CAM_PREVIEW_WIDTH : CAM_PREVIEW_HEIGHT);
          const cy =
            (y / getOutputTensorHeight()) *
            (isPortrait() ? CAM_PREVIEW_HEIGHT : CAM_PREVIEW_WIDTH);
          return (
            
            
            <Rect
            
              key={`skeletonkp_${b.class}`}
              x={cx}
              y={cy}
              width={b.bbox[2]}
              height={b.bbox[3]}
              strokeWidth='2'
              fill='none'
              stroke='black'
            />
            
          );
      });

      return <Svg style={styles.svg}>{Bboxes}</Svg>
    } else {
      return <View></View>
    }
  };

  /*
  function drawRectangle(
    predicitons: cocoSSD.DetectedObject[], 
    nextImageTensor : any 
  ) {
    if(!context.current || !canvas.current) 
      return;
    const scaleWidth = width / nextImageTensor.shape[1];
    const scaleHeight = height / nextImageTensor.shape[0];

    const flipHorizontal = Platform.OS === 'ios' ? false : true;

    //Clear previous
    context.current.clearRect(0, 0, width, height)

    //Draw Current
    for (const prediction of predicitons){
      const[ x, y, width, height ] = prediction.bbox;

      const boundingBoxX = flipHorizontal
      ? canvas.current.width - x * scaleHeight - width * scaleWidth
      : x * scaleWidth;
      const boundingBoxY = y * scaleHeight;

      context.current.strokeRect(boundingBoxX, boundingBoxY, width * scaleWidth, height * scaleHeight);
      context.current.strokeText( prediction.class, boundingBoxX - 5, boundingBoxY - 5);

    }
  }
  */

  /*
  async function handleCanvas(can : Canvas) {
    if(can) {
      can.width = width;
      can.height = height;
      let ctx: CanvasRenderingContext2D = can.getContext('2d');
      ctx.strokeStyle = 'red';
      ctx.fillStyle = 'red';
      ctx.lineWidth = 3;

      context.current = ctx;
      canvas.current = can;
    }
  }
  */
  
  const renderFps = () => {
    return (
      <View style={styles.fpsContainer}>
        <Text>FPS: {fps}</Text>
      </View>
    );
  };

  const renderCameraTypeSwitcher = () => {
    return (
      <View
        style={styles.cameraTypeSwitcher}
        onTouchEnd={handleSwitchCameraType}
      >
        <Text>
          Switch to{' '}
          {cameraType === CameraType.front ? 'back' : 'front'} camera
        </Text>
      </View>
    );
  };

  const handleSwitchCameraType = () => {
    if (cameraType === CameraType.front) {
      setCameraType(CameraType.back);
    } else {
      setCameraType(CameraType.front);
    }
  };

  const isPortrait = () => {
    return (
      orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
      orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
    );
  };

  const getOutputTensorWidth = () => {
    // On iOS landscape mode, switch width and height of the output tensor to
    // get better result. Without this, the image stored in the output tensor
    // would be stretched too much.
    //
    // Same for getOutputTensorHeight below.
    return isPortrait() || IS_ANDROID
      ? OUTPUT_TENSOR_WIDTH
      : OUTPUT_TENSOR_HEIGHT;
  };

  const getOutputTensorHeight = () => {
    return isPortrait() || IS_ANDROID
      ? OUTPUT_TENSOR_HEIGHT
      : OUTPUT_TENSOR_WIDTH;
  };

  const getTextureRotationAngleInDegrees = () => {
    // On Android, the camera texture will rotate behind the scene as the phone
    // changes orientation, so we don't need to rotate it in TensorCamera.
    if (IS_ANDROID) {
      return 0;
    }
  
   // For iOS, the camera texture won't rotate automatically. Calculate the
    // rotation angles here which will be passed to TensorCamera to rotate it
    // internally.
    switch (orientation) {
      // Not supported on iOS as of 11/2021, but add it here just in case.
      case ScreenOrientation.Orientation.PORTRAIT_DOWN:
        return 180;
      case ScreenOrientation.Orientation.LANDSCAPE_LEFT:
        return cameraType === CameraType.front ? 270 : 90;
      case ScreenOrientation.Orientation.LANDSCAPE_RIGHT:
        return cameraType === CameraType.front ? 90 : 270;
      default:
        return 0;
    }
  };

  /*
  useEffect(() => {
    async () => {
      const { status } = await Camera.requestMicrophonePermissionsAsync();
      await tf.ready();
      
    };
  }, [])
  */

  if (!tfReady) {
    return (
      <View style={styles.loadingMsg}>
        <Text>Loading...</Text>
      </View>
    );
  } else {
    return (
    <View style={
      isPortrait() ? styles.containerPortrait : styles.containerLandscape
      }
    >
      <TensorCamera
        ref={cameraRef} 
        style={styles.camera}
        autorender={AUTO_RENDER}
        type={cameraType}

        cameraTextureHeight={textureDims.height}
        cameraTextureWidth={textureDims.width}
        resizeHeight={getOutputTensorWidth()}
        resizeWidth={getOutputTensorHeight()}
        resizeDepth={3}
        rotation={getTextureRotationAngleInDegrees()}
        onReady={handleCameraStream}
        
        useCustomShadersToResize={false}
      />
      {renderFps()}
      {renderPrediciton()}
      {renderCameraTypeSwitcher()}      
    </View>
  );
}
}

const styles = StyleSheet.create({
  containerPortrait: {
    position: 'relative',
    width: CAM_PREVIEW_WIDTH,
    height: CAM_PREVIEW_HEIGHT,
    marginTop: Dimensions.get('window').height / 2 - CAM_PREVIEW_HEIGHT / 2,
  },
  containerLandscape: {
    position: 'relative',
    width: CAM_PREVIEW_HEIGHT,
    height: CAM_PREVIEW_WIDTH,
    marginLeft: Dimensions.get('window').height / 2 - CAM_PREVIEW_HEIGHT / 2,
  },
  loadingMsg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  svg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    zIndex: 30,
  },
  fpsContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 80,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, .7)',
    borderRadius: 2,
    padding: 8,
    zIndex: 20,
  },
  cameraTypeSwitcher: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 180,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, .7)',
    borderRadius: 2,
    padding: 8,
    zIndex: 20,
  },
});