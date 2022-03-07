/**
 * @Author jinxiaodong
 * @Date 2022-03-07 10:09:11
 * @LastEditors jinxiaodong
 * @LastEditTime 2022-03-07 11:41:27
 * @Desc 
 */
const input = document.getElementById('file')
input.addEventListener('change', (e) => {
  const files = e.target.files;
  console.log('files:', files);
  const url = window.URL.createObjectURL(files[0])
  console.log('url', url)
  const reader = new FileReader();
  reader.onload = (e) => {
    console.log('base64', e.target.result);
  }
  reader.readAsDataURL(files[0])
})