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

  // Create canvas and render page:
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = renderViewport.width
  canvas.height = renderViewport.height

  await page.render({ canvasContext: context, viewport: renderViewport }).promise

  // Create new canvas with padding and rotation:
  const processedCanvas = createRotatedCanvas(canvas)

  // Apply filters:
  applyMultiplicativeNoise(processedCanvas, 0.4)
  applyMultiplicativeNoise(processedCanvas, 0.03)
  applySharpen(processedCanvas, 1.0)
  applyGrayscale(processedCanvas)

  return {
    image: processedCanvas.toDataURL('image/png'),
    width: baseViewport.width,
    height: baseViewport.height
  }
}


function createRotatedCanvas(canvas) {
  // Random rotation, +/- 0.5 to 0.9 deg:
  const sign = Math.random() < 0.5 ? -1 : 1
  const degrees = sign * (0.5 + Math.random() * 0.4)
  const radians = degrees * Math.PI / 180

  // Create new canvas with padding to avoid clipping:
  const padding = Math.max(canvas.width, canvas.height) * 0.1
  const newCanvas = document.createElement('canvas')
  newCanvas.width = canvas.width + padding * 2
  newCanvas.height = canvas.height + padding * 2
  const ctx = newCanvas.getContext('2d')

  // Fill background:
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, newCanvas.width, newCanvas.height)

  // Rotate around center and draw:
  ctx.translate(newCanvas.width / 2, newCanvas.height / 2)
  ctx.rotate(radians)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)

  return newCanvas
}


function applyMultiplicativeNoise(canvas, attenuate) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Multiplicative noise, (1 + noise * att) with normalized uniformly random noise
    const noise = (Math.random() * 2 - 1) * attenuate
    const factor = 1 + noise

    data[i + 0] = Math.max(0, Math.min(255, data[i + 0] * factor)) // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor)) // G
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor)) // B
  }

  ctx.putImageData(imageData, 0, 0)
}


function applySharpen(canvas, amount) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const w = canvas.width
  const h = canvas.height

  const kernel = [
     0, -1,  0,
    -1,  5, -1,
     0, -1,  0
  ]

  const output = new Uint8ClampedArray(data.length)

  // NOTE:
  // If the code below has problems, blame Claude.

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4

      for (let c = 0; c < 3; c++) {
        let sum = 0

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const py = Math.max(0, Math.min(h - 1, y + ky))
            const px = Math.max(0, Math.min(w - 1, x + kx))
            const pidx = (py * w + px) * 4
            const weight = kernel[(ky + 1) * 3 + (kx + 1)]

            sum += data[pidx + c] * weight
          }
        }

        output[idx + c] = Math.max(0, Math.min(255, sum))
      }

      output[idx + 3] = data[idx + 3] // TODO: preserve alpha? hmmm
    }
  }

  imageData.data.set(output)
  ctx.putImageData(imageData, 0, 0)
}


function applyGrayscale(canvas) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Seen:
    // https://en.wikipedia.org/wiki/Grayscale#Luma_coding_in_video_systems
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = data[i + 1] = data[i + 2] = gray
  }

  ctx.putImageData(imageData, 0, 0)
}

