import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.mjs";

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs";


const dropZone = document.getElementById('drop-zone')
const fileInput = document.getElementById('file-input')


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
  e.preventDefault()
  dropZone.classList.remove('drag-over')

  const files = e.dataTransfer.files
  if (files.length > 0) {
    handleFile(files[0])
  }
})

fileInput.addEventListener('change', ev => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0])
  }
})

function handleFile(file) {
  console.log('File selected:', file.name)
  // TODO: Process PDF
}
