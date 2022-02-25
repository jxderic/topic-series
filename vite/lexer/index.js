/**
 * @Author jinxiaodong
 * @Date 2021-11-24 09:14:49
 * @LastEditors jinxiaodong
 * @LastEditTime 2021-11-24 09:20:16
 * @Desc es-module-lexer 使用
 */
 const { init, parse } = require('es-module-lexer');

 (async () => {
   await init;
 
   const source = `
     import { name } from 'mod';
     import json from './json.json' assert { type: 'json' }
     export var p = 5;
     export function q () {
 
     };
 
     // Comments provided to demonstrate edge cases
     import /*comment!*/ ('asdf', { assert: { type: 'json' }});
     import /*comment!*/.meta.asdf;
   `;
 
   const [imports, exports] = parse(source, 'optional-sourcename');

   console.log(imports); 
   // Returns "mod"
   imports[0].n
   source.substring(imports[0].s, imports[0].e);
   console.log(source.substring(imports[0].s, imports[0].e));
   // "s" = start
   // "e" = end
 
   // Returns "import { name } from 'mod'"
   source.substring(imports[0].ss, imports[0].se);
   // "ss" = statement start
   // "se" = statement end
 
   // Returns "{ type: 'json' }"
   source.substring(imports[1].a, imports[1].se);
   // "a" = assert
 
   // Returns "p,q"
   exports.toString();
 
   // Dynamic imports are indicated by imports[2].d > -1
   // In this case the "d" index is the start of the dynamic import
   // Returns true
   imports[2].d > -1;
 
   // Returns "asdf"
   imports[2].n
   // Returns "'asdf'"
   source.substring(imports[2].s, imports[2].e);
   // Returns "import /*comment!*/ ("
   source.substring(imports[2].d, imports[2].s);
   // Returns "import /*comment!*/ ('asdf', { assert: { type: 'json' } })"
   source.substring(imports[2].d, imports[2].se + 1);
   // Returns "{ assert: { type: 'json' } }"
   source.substring(imports[2].a, imports[2].e);
   // ss is the same as d
   // as, ae not used for dynamic imports
 
   // import.meta is indicated by imports[2].d === -2
   // Returns true
   imports[2].d === -2;
   // Returns "import /*comment!*/.meta"
   source.substring(imports[2].s, imports[2].e);
 })();
 