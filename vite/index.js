/**
 * @Author jinxiaodong
 * @Date 2021-10-26 09:35:02
 * @LastEditors jinxiaodong
 * @LastEditTime 2021-10-30 10:54:14
 * @Desc web server
 */
const Koa = require('koa')
const fs = require('fs')
const path = require('path')
const app = new Koa()

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