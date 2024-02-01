# tfjsPlayground
Results of my experiments with tfjs and React Native

Getting started

with node installed run the following

npx create-expo-app --template
(choose blank with typescript enabled)

once the project is built navigate to the new project's directory and run this line

npm install @react-native-async-storage/async-storage @tensorflow-models/coco-ssd @tensorflow/tfjs @tensorflow/tfjs-react-native expo-camera expo-gl expo-gl-cpp expo-screen-orientation react-native-fs react-native-webview react-native-svg --legacy-peer-deps

replace the generated app.tsx file with the one from this repository
then run npm start to view using expo go on an iPhone

Notes: The bounding box is not rendered in the correct place but objects are being identified, if you would like to see what objects it is identifying
you wrap the rect component in a view, add a text component and have it display the object's class

this uses the cocoSSD model
