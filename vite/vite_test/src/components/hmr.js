/**
 * @Author jinxiaodong
 * @Date 2021-11-24 09:30:45
 * @LastEditors jinxiaodong
 * @LastEditTime 2021-12-07 09:24:28
 * @Desc 
 */
 if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    console.log('updated: count is now ', newModule.count)
  })
}
export const count=3
