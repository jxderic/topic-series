/**
 * @Author jinxiaodong
 * @Date 2022-03-07 10:09:11
 * @LastEditors jinxiaodong
 * @LastEditTime 2022-03-08 19:52:00
 * @Desc 
 */
const input = document.getElementById('file')
input.addEventListener('change', (e) => {
  const files = e.target.files;
  console.log('files:', files);
  const url = window.URL.createObjectURL(files[0])
  console.log('url', url)
  // file 转 base64
  const reader = new FileReader();
  reader.onload = (e) => {
    console.log('base64', e.target.result);
    const dataUrl = e.target.result
    const file = dataURLtoFile(dataUrl, 'test.png')
    console.log('file', file)
  }
  reader.readAsDataURL(files[0])

  // 切片
  const BYTES_PER_CHUNK = 1024 * 1024
  const blob = files[0]
  const slices = Math.ceil(blob.size / BYTES_PER_CHUNK)
  const blobs = [];
  for (let index = 0; index < slices; index++) {
    blobs.push(blob.slice(BYTES_PER_CHUNK * index, BYTES_PER_CHUNK * (index + 1), blob.type))
  }
  console.log('blobs', blobs)
})

/**
 * base64 转 Blob
 *
 * @param {*} dataUrl
 * @return {*} 
 */
function dataURLtoBlob(dataUrl) {
  const arr = dataUrl.split(','), 
  mime = arr[0].match(/:(.*?);/)[1],
  bstr = window.atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], {type: mime})
}
 /**
  * base64 转 file
  *
  * @param {*} dataUrl
  * @param {*} fileName
  * @return {*} 
  */
 function dataURLtoFile(dataUrl, fileName) {
  const arr = dataUrl.split(','), 
  mime = arr[0].match(/:(.*?);/)[1],
  bstr = window.atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], fileName, {type: mime})
}

/**
 * 下载文件
 *
 * @param {*} fileName
 * @param {*} content
 */
function createDownload(fileName, content) {
  const blob = new Blob([content])
  const link = document.createElement('a')
  link.innerHTML = fileName
  link.download = fileName
  link.href = URL.createObjectURL(blob)
  document.body.appendChild(link)
}

createDownload('download.txt', 'download file')