<!--
 * @Author: jinxiaodong
 * @Date: 2021-10-30 11:02:42
 * @LastEditors: jinxiaodong
 * @LastEditTime: 2021-10-31 16:02:41
 * @Desc: vue sfc组件
-->
<template>
  <div>
    <div>{{count}}</div>
    <button @click="handleAddCount">增加</button>
  </div>
</template>

<script>
  import { ref } from 'vue'
  export default {
    setup() {
      const count = ref(0)
      const handleAddCount = () => {
        count.value++
      }
      return {
        count,
        handleAddCount
      }
    }
  }
</script>

<style lang="scss" scoped>

</style>