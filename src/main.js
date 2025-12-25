import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.mjs";
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs";

let pdfBytes = null
let renderedPages = []

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

  // Load PDF with pdfjs
  const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise
  console.log('PDF loaded:', pdf.numPages, 'pages')

  // Render each page to canvas
  renderedPages = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const baseViewport = page.getViewport({ scale: 1.0 })
    const renderViewport = page.getViewport({ scale: 4.0 })

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height

    await page.render({
      canvasContext: context,
      viewport: renderViewport
    }).promise

    const imageData = canvas.toDataURL('image/png')
    renderedPages.push({
      imageData,
      width: baseViewport.width,
      height: baseViewport.height
    })

    console.log(`Rendered page ${pageNum}`)
  }

  downloadBtn.style.display = 'block'
  console.log('All pages rendered')
}

downloadBtn.addEventListener('click', () => {
  if (renderedPages.length === 0) return

  // Create new PDF from rendered images
  const firstPage = renderedPages[0]
  const pdf = new jsPDF({
    orientation: firstPage.width > firstPage.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [firstPage.width, firstPage.height]
  })

  renderedPages.forEach((page, index) => {
    if (index > 0) {
      pdf.addPage([page.width, page.height])
    }
    pdf.addImage(page.imageData, 'PNG', 0, 0, page.width, page.height)
  })

  pdf.save('processed.pdf')
  console.log('PDF downloaded')
})
