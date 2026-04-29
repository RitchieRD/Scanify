import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import vue from "@vitejs/plugin-vue";
import path from "path";
export default defineConfig({
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        cors: true,
        hmr: {
            host: "192.168.1.200",
        },
    },
    build: {
        outDir: "public/build",
    },
    plugins: [
        vue(),
        laravel({
            input: ["resources/css/app.css", "resources/js/app.js"],
            refresh: true,
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./resources/js"),
        },
    },
});
