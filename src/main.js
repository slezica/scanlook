import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.mjs"
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs"


const state = {
  file: null,
  rawPages: [],
  rotationAngle: 0.3,
  noise: 0.03,
  sharpen: 1.0
}

const ui = {
  previewArea: document.getElementById('preview-area'),
  previewContainer: document.getElementById('preview-container'),
  fileInput: document.getElementById('file-input'),
  openBtn: document.getElementById('open-btn'),
  downloadBtn: document.getElementById('download-btn'),
  rotationSlider: document.getElementById('rotation-slider'),
  rotationValue: document.getElementById('rotation-value'),
  noiseSlider: document.getElementById('noise-slider'),
  noiseValue: document.getElementById('noise-value'),
  sharpenSlider: document.getElementById('sharpen-slider'),
  sharpenValue: document.getElementById('sharpen-value')
}


function debounce(func, delay) {
  let timeoutId
  return function(...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

const debouncedUpdatePreviews = debounce(() => {
  if (state.rawPages.length > 0) {
    updatePreviews()
  }
}, 300)


// Rotation slider
ui.rotationSlider.addEventListener('input', ev => {
  state.rotationAngle = parseFloat(ev.target.value)
  ui.rotationValue.textContent = state.rotationAngle.toFixed(1)
  debouncedUpdatePreviews()
})

// Noise slider
ui.noiseSlider.addEventListener('input', ev => {
  const value = parseFloat(ev.target.value)
  ui.noiseValue.textContent = value.toFixed(1)
  
  state.noise = 0.2 * value

  debouncedUpdatePreviews()
})

// Sharpen slider
ui.sharpenSlider.addEventListener('input', ev => {
  const sharpen = parseFloat(ev.target.value)
  ui.sharpenValue.textContent = sharpen.toFixed(1)

  state.sharpen = 2 * sharpen

  debouncedUpdatePreviews()
})

// Open button
ui.openBtn.addEventListener('click', () => {
  ui.fileInput.click()
})

// Click drop zone to select file (only when no file loaded)
ui.previewArea.addEventListener('click', () => {
  if (state.file === null) {
    ui.fileInput.click()
  }
})

// Drag and drop
ui.previewArea.addEventListener('dragover', ev => {
  ev.preventDefault()
  ui.previewArea.classList.add('drag-over')
})

ui.previewArea.addEventListener('dragleave', ev => {
  ui.previewArea.classList.remove('drag-over')
})

ui.previewArea.addEventListener('drop', ev => {
  ev.preventDefault()
  ui.previewArea.classList.remove('drag-over')

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
  if (state.rawPages.length === 0) return
  const outputPdf = await generateDownloadPdf()
  outputPdf.save('processed.pdf')
})


async function handleFileSelected(file) {
  state.file = null
  ui.downloadBtn.disabled = true
  ui.previewArea.classList.remove('has-content')

  if (file) {
    await loadFile(file)
    ui.downloadBtn.disabled = false
    ui.previewArea.classList.add('has-content')
    initializePreviews()
    updatePreviews()
  }
}


async function loadFile(file) {
  const fileBuffer = await file.arrayBuffer()
  const fileBytes = new Uint8Array(fileBuffer)
  const inputPdf = await pdfjs.getDocument({ data: fileBytes }).promise

  if (inputPdf.numPages == 0) {
    throw new Error("Zero pages in PDF")
  }

  state.rawPages = []

  for (let i = 0; i < inputPdf.numPages; i++) {
    const page = await inputPdf.getPage(i + 1)
    const viewport = page.getViewport({ scale: 4.0 })

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({ canvasContext: context, viewport }).promise

    state.rawPages.push({
      canvas: canvas,
      baseWidth: page.getViewport({ scale: 1.0 }).width,
      baseHeight: page.getViewport({ scale: 1.0 }).height
    })
  }
}


function initializePreviews() {
  ui.previewContainer.innerHTML = ''

  for (let i = 0; i < state.rawPages.length; i++) {
    const pageEl = document.createElement('div')
    pageEl.className = 'page-preview'
    pageEl.innerHTML = `
      <h3>Page ${i + 1}</h3>
      <img class="preview-img" alt="Page ${i + 1}">
    `

    ui.previewContainer.appendChild(pageEl)
  }
}


function updatePreviews() {
  const pageElements = ui.previewContainer.querySelectorAll('.page-preview')

  for (let i = 0; i < state.rawPages.length; i++) {
    const rawPage = state.rawPages[i]
    const pageEl = pageElements[i]

    // Update transformed image (downscaled for preview)
    const canvas = createPreviewCanvas(rawPage.canvas)
    applyEffects(canvas)
    const img = pageEl.querySelector('.preview-img')
    img.src = canvas.toDataURL('image/png')
  }
}


function createPreviewCanvas(sourceCanvas) {
  // Create a lower-res copy for preview (2x scale instead of 4x)
  const scale = 0.5
  const canvas = document.createElement('canvas')
  canvas.width = sourceCanvas.width * scale
  canvas.height = sourceCanvas.height * scale
  const ctx = canvas.getContext('2d')
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height)
  return canvas
}


async function generateDownloadPdf() {
  let outputPdf

  for (let i = 0; i < state.rawPages.length; i++) {
    const rawPage = state.rawPages[i]

    // Clone the full-resolution canvas
    const processedCanvas = cloneCanvas(rawPage.canvas)
    applyEffects(processedCanvas)

    const { baseWidth, baseHeight } = rawPage

    if (i == 0) {
      outputPdf = new jsPDF({
        orientation: baseWidth > baseHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [baseWidth, baseHeight]
      })
    } else {
      outputPdf.addPage([baseWidth, baseHeight])
    }

    outputPdf.addImage(processedCanvas.toDataURL('image/png'), 'PNG', 0, 0, baseWidth, baseHeight)
  }

  return outputPdf
}


function cloneCanvas(sourceCanvas) {
  const canvas = document.createElement('canvas')
  canvas.width = sourceCanvas.width
  canvas.height = sourceCanvas.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(sourceCanvas, 0, 0)
  return canvas
}


function applyEffects(canvas) {
  const rotatedCanvas = createRotatedCanvas(canvas)

  // Copy rotated result back to original canvas
  canvas.width = rotatedCanvas.width
  canvas.height = rotatedCanvas.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(rotatedCanvas, 0, 0)

  // Apply filters to canvas
  applyMultiplicativeNoise(canvas, state.noise)
  applySharpen(canvas, state.sharpen)
  applyGrayscale(canvas)
}


function createRotatedCanvas(canvas) {
  const degrees = state.rotationAngle
  const radians = degrees * Math.PI / 180

  // Create new canvas with minimal padding to avoid clipping (2% for small rotations)
  const padding = Math.max(canvas.width, canvas.height) * 0.02
  const newCanvas = document.createElement('canvas')
  newCanvas.width = canvas.width + padding * 2
  newCanvas.height = canvas.height + padding * 2
  const ctx = newCanvas.getContext('2d')

  // Fill background (white paper)
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
  if (amount === 0) return

  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const w = canvas.width
  const h = canvas.height

  // Scale kernel by amount
  const kernel = [
     0,          -1 * amount,  0,
    -1 * amount,  1 + 4 * amount, -1 * amount,
     0,          -1 * amount,  0
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

