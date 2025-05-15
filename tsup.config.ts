import { defineConfig } from 'tsup';

const year = new Date().getFullYear();

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "RTCSignalingBundle", // Use a different name to avoid conflicts
    dts: true,
    minify: false, // Disable minification for debugging
    platform: 'browser',
    loader: {
        '.json': 'json'  // Handle JSON files
    },
    sourcemap: true,
    clean: true,
    banner: {
        js: `/**
 * WebRTC Signaling Package
 * (c) ${year} Amin Yazdanpanah<https://www.aminyazdanpanah.com> (Quasar Stream LLC)
 * Released under the MIT License.
 */`,
    },
});