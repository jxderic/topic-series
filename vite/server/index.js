/**
 * @Author jinxiaodong
 * @Date 2021-10-26 09:35:02
 * @LastEditors jinxiaodong
 * @LastEditTime 2021-10-28 09:32:37
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
    const content = fs.readFileSync('./index.html', 'utf-8')
    ctx.body = content
  }
})

app.listen(3000, () => {
  console.log('server ready')
})