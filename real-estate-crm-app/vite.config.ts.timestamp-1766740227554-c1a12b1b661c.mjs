// vite.config.ts
import { defineConfig } from "file:///C:/Users/qures/Downloads/nabi-app-git/happy-properties-bolt/real-estate-crm-app/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/qures/Downloads/nabi-app-git/happy-properties-bolt/real-estate-crm-app/node_modules/@vitejs/plugin-react/dist/index.js";
import { loadEnv } from "file:///C:/Users/qures/Downloads/nabi-app-git/happy-properties-bolt/real-estate-crm-app/node_modules/vite/dist/node/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT) || 8085;
  return {
    plugins: [react()],
    server: {
      port,
      host: true
    },
    build: {
      outDir: "dist",
      sourcemap: false
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxxdXJlc1xcXFxEb3dubG9hZHNcXFxcbmFiaS1hcHAtZ2l0XFxcXGhhcHB5LXByb3BlcnRpZXMtYm9sdFxcXFxyZWFsLWVzdGF0ZS1jcm0tYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxxdXJlc1xcXFxEb3dubG9hZHNcXFxcbmFiaS1hcHAtZ2l0XFxcXGhhcHB5LXByb3BlcnRpZXMtYm9sdFxcXFxyZWFsLWVzdGF0ZS1jcm0tYXBwXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9xdXJlcy9Eb3dubG9hZHMvbmFiaS1hcHAtZ2l0L2hhcHB5LXByb3BlcnRpZXMtYm9sdC9yZWFsLWVzdGF0ZS1jcm0tYXBwL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB7IGxvYWRFbnYgfSBmcm9tICd2aXRlJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKTtcclxuICBjb25zdCBwb3J0ID0gTnVtYmVyKGVudi5WSVRFX1BPUlQpIHx8IDgwODU7XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgcG9ydCxcclxuICAgICAgaG9zdDogdHJ1ZVxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgIG91dERpcjogJ2Rpc3QnLFxyXG4gICAgICBzb3VyY2VtYXA6IGZhbHNlXHJcbiAgICB9XHJcbiAgfTtcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNmEsU0FBUyxvQkFBb0I7QUFDMWMsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUV4QixJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsUUFBTSxPQUFPLE9BQU8sSUFBSSxTQUFTLEtBQUs7QUFFdEMsU0FBTztBQUFBLElBQ0wsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLElBQ2pCLFFBQVE7QUFBQSxNQUNOO0FBQUEsTUFDQSxNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsV0FBVztBQUFBLElBQ2I7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
