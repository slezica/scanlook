import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.mjs"
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs"


const state = {
  file: null
}

const ui = {
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  downloadBtn: document.getElementById('download-btn')
}


ui.dropZone.addEventListener('click', () => {
  ui.fileInput.click()
})

ui.dropZone.addEventListener('dragover', ev => {
  ev.preventDefault()
  ui.dropZone.classList.add('drag-over')
})

ui.dropZone.addEventListener('dragleave', ev => {
  ui.dropZone.classList.remove('drag-over')
})

ui.dropZone.addEventListener('drop', ev => {
  ev.preventDefault()
  ui.dropZone.classList.remove('drag-over')

  if (ev.dataTransfer.files.length > 0) {
    handleFileSelected(ev.dataTransfer.files[0])
  }
})

ui.fileInput.addEventListener('change', ev => {
  if (ev.target.files.length > 0) {
    handleFileSelected(ev.target.files[0])
  }
})

ui.downloadBtn.addEventListener('click', async () => {
  if (!state.file) return
  const outputPdf = await processFile(state.file)
  outputPdf.save('processed.pdf')
})


function handleFileSelected(file) {
  state.file = file
  ui.downloadBtn.disabled = (file == null)
}


async function processFile(file) {
  const fileBuffer = await file.arrayBuffer()
  const fileBytes = new Uint8Array(fileBuffer)

  const inputPdf = await pdfjs.getDocument({ data: fileBytes }).promise

  if (inputPdf.numPages == 0) {
    throw new Error("Zero pages in PDF")
  }

  let outputPdf

  for (let i = 0; i < inputPdf.numPages; i++) {
    const inputPage = await inputPdf.getPage(i + 1) // pdf pages are 1-indexed
    const outputPage = await processPage(inputPage)

    const { width, height } = outputPage

    if (i == 0) {
      outputPdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height]
      })
    } else {
      outputPdf.addPage([width, height])
    }

    outputPdf.addImage(outputPage.image, 'PNG', 0, 0, width, height)
  }

  return outputPdf
}


async function processPage(page) {
  const baseViewport = page.getViewport({ scale: 1.0 })
  const renderViewport = page.getViewport({ scale: 4.0 }) // picked visually, blurry otherwise

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = renderViewport.width
  canvas.height = renderViewport.height

  await page.render({ canvasContext: context, viewport: renderViewport }).promise

  return {
    image: canvas.toDataURL('image/png'),
    width: baseViewport.width,
    height: baseViewport.height
  }
}

