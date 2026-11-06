/**
 * @fileoverview NanoCharts 피그마 플러그인 단일 파일 번들러 (Zero-Extra-Dependency)
 * 
 * 1. `dist/index.js` (NanoCharts 라이브러리 빌드 산출물)를 `figma-plugin/src/ui.template.html` 내부에 인라인 삽입하여
 *    피그마 iframe 샌드박스에서 외부 네트워크 없이 동작하는 `figma-plugin/dist/ui.html`을 생성합니다.
 * 2. `figma-plugin/src/code.ts`를 TypeScript 컴파일러 API로 트랜스파일하여 `figma-plugin/dist/code.js`를 생성합니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const libBundlePath = path.join(rootDir, 'dist', 'index.js');
const uiTemplatePath = path.join(rootDir, 'figma-plugin', 'src', 'ui.template.html');
const codeTsPath = path.join(rootDir, 'figma-plugin', 'src', 'code.ts');
const outDir = path.join(rootDir, 'figma-plugin', 'dist');

if (!fs.existsSync(libBundlePath)) {
  console.error('❌ dist/index.js가 없습니다. 먼저 npm run build를 실행하세요.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

// 1. dist/index.js의 export { a as B, c as D } 구문을 const B = a; const D = c; 바인딩으로 변환
let libCode = fs.readFileSync(libBundlePath, 'utf8');
libCode = libCode.replace(/export\s*\{([^}]*)\}\s*;?\s*$/m, (_match, inner) => {
  const bindings = inner
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const asMatch = part.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
      if (asMatch) {
        const [, localName, exportedName] = asMatch;
        return localName === exportedName ? '' : `const ${exportedName} = ${localName};`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
  return `\n${bindings}\n`;
});

const uiTemplate = fs.readFileSync(uiTemplatePath, 'utf8');
const finalUiHtml = uiTemplate.replace('/* __NANOCHARTS_INLINE_BUNDLE__ */', libCode);
fs.writeFileSync(path.join(outDir, 'ui.html'), finalUiHtml, 'utf8');

// 2. figma-plugin/src/code.ts -> figma-plugin/dist/code.js 트랜스파일
const codeTsSource = fs.readFileSync(codeTsPath, 'utf8');
const transpiled = ts.transpileModule(codeTsSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.None,
    removeComments: false,
  },
});

fs.writeFileSync(path.join(outDir, 'code.js'), transpiled.outputText, 'utf8');

console.log('✅ Figma Plugin 빌드 완료!');
console.log('   - figma-plugin/manifest.json');
console.log('   - figma-plugin/dist/code.js');
console.log('   - figma-plugin/dist/ui.html');
