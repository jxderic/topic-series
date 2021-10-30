/**
 * @Author jinxiaodong
 * @Date 2021-10-26 09:34:09
 * @LastEditors jinxiaodong
 * @LastEditTime 2021-10-30 07:43:42
 * @Desc 入口文件
 */
import { createApp, h } from 'vue'

const App = {
  render() {
    return h('div', null, h('div'), null, String('hello vite'))
  }
}

createApp(App).mount('#app')