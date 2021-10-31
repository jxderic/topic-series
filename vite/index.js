/**
 * @Author jinxiaodong
 * @Date 2021-10-26 09:35:02
 * @LastEditors jinxiaodong
 * @LastEditTime 2021-10-31 16:56:31
 * @Desc web server
 */
const Koa = require('koa')
const fs = require('fs')
const path = require('path')
const app = new Koa()
const compilerSfc = require('@vue/compiler-sfc')
const compilerDom = require('@vue/compiler-dom')

app.use(async (ctx) => {
  const { url, query } = ctx.request
  console.log('url:', url)
  if (url === '/') {
    ctx.type = 'text/html'
    let content = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8')
    content = content.replace('<script', `
      <script>
        window.process = {env: { NODE_ENV: 'development'}}
      </script>
      <script`)
    ctx.body = content
  } else if (url.endsWith('js')) {
    const jsPath = path.resolve(__dirname, url.slice(1))
    ctx.type = 'application/javascript'
    const content = fs.readFileSync(jsPath, 'utf-8')
    ctx.body = rewriteImport(content)
  } else if (url.startsWith('/@modules')) {
    // '/@modules' 替换成 ‘node_modules/vue/'
    const prefix = path.resolve(__dirname, 'node_modules', url.replace('/@modules/', ''))
    console.log('prefix:', prefix)
    const module = require(prefix + '/package.json').module
    const jsPath = path.resolve(prefix, module)
    ctx.type = 'application/javascript'
    const content = fs.readFileSync(jsPath, 'utf-8')
    ctx.body = rewriteImport(content)
  } else if (url.indexOf('.vue') > -1) {
    // .xxx.vue?type=template
    // 1、sfc文件转成template、js、css @vue/compiler-sfc
    const vuePath = path.resolve(__dirname, url.split('?')[0].slice(1))
    const content = fs.readFileSync(vuePath, 'utf-8')
    const { descriptor } = compilerSfc.parse(content)
    if (!query.type) {
      ctx.type = 'application/javascript'
      const script = descriptor.script ? descriptor.script.content : ''
      ctx.body = `${rewriteImport(
        script.replace('export default ', 'const _script = ')
        )}
        import { render as _render } from '${url}?type=template'
        _script.render = _render
        export default _script
        `
      } else {
        // 2、template编译成render函数 @vue/compiler-dom
        const { template } = descriptor
      console.log(compilerDom.compile(template.content, { mode: 'module' }))
      const render = compilerDom.compile(template.content, { mode: 'module' }).code
      ctx.type = 'application/javascript'
      ctx.body = rewriteImport(render)
    }
  } else if (url.endsWith('css')) {
    // 利用js添加一个style标签
    const filePath = path.resolve(__dirname, url.slice(1))
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    ctx.type = 'application/javascript'
    ctx.body = `
     const style = document.createElement('style')
     style.setAttribute('type', 'text/css')
     document.head.appendChild(style)
     style.innerHTML = ${JSON.stringify(fileContent.replace(/\n/g, ''))}
     export default style
    `
  }
})
// from 'vue' 改写成 from '/@modules/vue'
function rewriteImport(content) {
  const reg = / from ['|"]([^'"]+)['|"]/g
  return content.replace(reg, (match, p1) => {
    if (p1[0] !== '.' && p1[0] !== '..') {
      return ` from '/@modules/${p1}'`
    } else {
      return match
    }
  })
}

app.listen(3000, () => {
  console.log('server ready: http://localhost:3000')
})