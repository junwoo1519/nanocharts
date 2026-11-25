import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      rollupTypes: true,
      afterBuild: () => {
        const dtsPath = resolve(__dirname, 'dist/index.d.ts');
        const dctsPath = resolve(__dirname, 'dist/index.d.cts');
        if (existsSync(dtsPath)) {
          copyFileSync(dtsPath, dctsPath);
        }
      },
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NanoCharts',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [],
    },
  },
});
