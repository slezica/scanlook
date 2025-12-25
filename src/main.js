import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.mjs";

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs";

let pdfBytes = null

const dropZone = document.getElementById('drop-zone')
const fileInput = document.getElementById('file-input')
const downloadBtn = document.getElementById('download-btn')


dropZone.addEventListener('click', () => {
  fileInput.click()
})

dropZone.addEventListener('dragover', ev => {
  ev.preventDefault()
  dropZone.classList.add('drag-over')
})

dropZone.addEventListener('dragleave', ev => {
  dropZone.classList.remove('drag-over')
})

dropZone.addEventListener('drop', ev => {
  ev.preventDefault()
  dropZone.classList.remove('drag-over')

  const files = ev.dataTransfer.files
  if (files.length > 0) {
    handleFile(files[0])
  }
})

fileInput.addEventListener('change', ev => {
  if (ev.target.files.length > 0) {
    handleFile(ev.target.files[0])
  }
})

async function handleFile(file) {
  console.log('File selected:', file.name)

  const arrayBuffer = await file.arrayBuffer()
  pdfBytes = new Uint8Array(arrayBuffer)

  downloadBtn.style.display = 'block'
  console.log('PDF bytes stored:', pdfBytes.length)
}

downloadBtn.addEventListener('click', () => {
  if (!pdfBytes) return

  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'processed.pdf'
  a.click()
  URL.revokeObjectURL(url)
})
