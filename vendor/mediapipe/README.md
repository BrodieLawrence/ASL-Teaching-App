# MediaPipe (vendored copy)

These files are hosted with the site instead of being loaded from a CDN, so the
page only runs code we have checked and keeps working if a CDN is down.

- `vision_bundle.mjs`, `wasm/*`: npm package `@mediapipe/tasks-vision` version 0.10.14
  (https://www.npmjs.com/package/@mediapipe/tasks-vision), Apache License 2.0.
- `models/hand_landmarker.task`: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- `models/pose_landmarker_lite.task`: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

The models are published by Google under the Apache License 2.0 (see the
MediaPipe model cards). Full licence text: https://www.apache.org/licenses/LICENSE-2.0

To update, replace the files with a newer version from the same sources and
update the checksums below.

## SHA-256 checksums

```
e77f281f9619150d937023c355bae170e9120e3b9e43f1e23a2a7bee07197669  vision_bundle.mjs
9440cf0cc0cea21800e31581ec32aeedcc5fbf9df4509796bbc7d3f99e52ab9c  wasm/vision_wasm_internal.js
f82a8e6c05e08a44cc9f9e7ec5f845935bcbb1b1500ebe8c2f4812fb4e2917dc  wasm/vision_wasm_internal.wasm
abe9b6fbeaf86fcb53a5edce3926c82ccb0619e18fed4d9d9ce561ee7f55e054  wasm/vision_wasm_nosimd_internal.js
38b61feab2fd7934e05cbe9f68baa308978a5e3b7f85c1913bb8ae89b8ef8b97  wasm/vision_wasm_nosimd_internal.wasm
fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1  models/hand_landmarker.task
59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a  models/pose_landmarker_lite.task
```
