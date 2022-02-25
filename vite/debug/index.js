/**
 * @Author jinxiaodong
 * @Date 2021-11-14 18:29:44
 * @LastEditors jinxiaodong
 * @LastEditTime 2021-11-14 19:03:01
 * @Desc debug库使用
 */
const debug = require('debug')

const a = debug('work:a')
const b = debug('work:b')

function workA() {
  a('I am working')
  setTimeout(workA, Math.random() * 1000)
}

workA()

function workB() {
  b('I am doing some good thing')
  setTimeout(workB, Math.random() * 2000)
}

workB()
