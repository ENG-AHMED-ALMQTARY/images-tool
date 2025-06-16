// Placeholder for image combiner/stretch logic

const combineUpload = document.getElementById('combine-upload');
const combineFilesInput = document.getElementById('combine-files');
const combineThumbs = document.getElementById('combine-preview-thumbs');
const combineCanvas = document.getElementById('combine-canvas');
const combineDownload = document.getElementById('combine-download');
const combineHeightSelect = document.getElementById('combine-height');
const combineFolderInput = document.getElementById('combine-folder');

let combineImages = [];
let outputCanvases = [];

// Drag & drop logic
combineUpload.addEventListener('dragover', e => {
  e.preventDefault();
  combineUpload.classList.add('dragover');
});
combineUpload.addEventListener('dragleave', e => {
  e.preventDefault();
  combineUpload.classList.remove('dragover');
});
combineUpload.addEventListener('drop', e => {
  e.preventDefault();
  combineUpload.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
combineFilesInput.addEventListener('change', e => {
  handleFiles(e.target.files);
});
combineUpload.addEventListener('click', () => {
  combineFilesInput.click();
});

function showMessage(msg, type = 'success', duration = 5000) {
  const el = document.getElementById('float-message');
  el.textContent = msg;
  el.className = '';
  void el.offsetWidth; // force reflow
  el.classList.add(type);
  el.style.display = 'block';
  clearTimeout(window._floatMsgTimeout);
  window._floatMsgTimeout = setTimeout(() => {
    el.style.display = 'none';
  }, duration);
}
window.showMessage = showMessage;

async function handleFiles(files) {
  combineImages = [];
  combineThumbs.innerHTML = '';
  outputCanvases = [];
  document.querySelector('.combine-preview-scroll').innerHTML = '';
  try {
    // Check for ZIP file
    const arr = Array.from(files);
    const zipFile = arr.find(f => f.name && f.name.toLowerCase().endsWith('.zip'));
    if (zipFile) {
      if (!window.JSZip || !window.extractImagesFromZip) {
        showMessage('Loading ZIP library, please try again in a second.', 'error');
        return;
      }
      showMessage('Extracting images from ZIP...', 'success', 3500);
      const imgs = await window.extractImagesFromZip(zipFile);
      if (!imgs.length) throw new Error('No images found in ZIP');
      combineImages = imgs;
      imgs.forEach(img => {
        const thumb = document.createElement('img');
        thumb.src = img.src;
        combineThumbs.appendChild(thumb);
      });
      renderCombined();
      return;
    }
    // Only handle images for now (RAR support can be added with Unrar.js in future)
    const imageArr = arr.filter(f => f.type.startsWith('image/'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
    if (!imageArr.length) throw new Error('No images found.');
    let loaded = 0;
    imageArr.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new window.Image();
        img.onload = () => {
          img._filename = file.name;
          combineImages.push(img);
          const thumb = document.createElement('img');
          thumb.src = img.src;
          combineThumbs.appendChild(thumb);
          loaded++;
          if (loaded === imageArr.length) {
            combineImages.sort((a, b) => (a._filename || '').localeCompare(b._filename || '', undefined, {numeric: true, sensitivity: 'base'}));
            renderCombined();
          }
        };
        img.onerror = () => showMessage('Failed to load image: ' + file.name, 'error');
        img.src = e.target.result;
      };
      reader.onerror = () => showMessage('Failed to read file: ' + file.name, 'error');
      reader.readAsDataURL(file);
    });
  } catch (err) {
    showMessage(err.message || 'Error processing files', 'error');
  }
}

combineHeightSelect.addEventListener('change', renderCombined);

function renderCombined() {
  if (!combineImages.length) {
    combineCanvas.width = 1;
    combineCanvas.height = 1;
    combineDownload.disabled = true;
    document.querySelector('.combine-preview-scroll').innerHTML = '';
    return;
  }
  const maxHeight = parseInt(combineHeightSelect.value) || 7000;
  // Only vertical combine
  let totalWidth = Math.max(...combineImages.map(img => img.width));
  let outputCanvases = [];
  let partImages = [];
  let partHeights = [];
  let idx = 0;
  while (idx < combineImages.length) {
    let part = [];
    let partHeight = 0;
    while (idx < combineImages.length) {
      let img = combineImages[idx];
      let remain = maxHeight - partHeight;
      // If this is the last image, always add it
      if (idx === combineImages.length - 1) {
        part.push(img);
        partHeight += img.height;
        idx++;
        break;
      }
      // If adding this image would exceed maxHeight
      if (partHeight + img.height > maxHeight) {
        let halfImg = img.height / 2;
        if (halfImg <= remain) {
          // Add it anyway (ok to slightly exceed)
          part.push(img);
          partHeight += img.height;
          idx++;
        }
        // else: leave it for next part
        break;
      } else {
        part.push(img);
        partHeight += img.height;
        idx++;
      }
    }
    partImages.push(part);
    partHeights.push(partHeight);
  }
  // Render each part to a canvas
  outputCanvases = partImages.map((imgs, i) => {
    let canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = partHeights[i];
    let ctx = canvas.getContext('2d');
    let y = 0;
    imgs.forEach(img => {
      ctx.drawImage(img, 0, y, img.width, img.height);
      y += img.height;
    });
    return canvas;
  });
  // Show all parts vertically in preview (scrollable)
  const previewScroll = document.querySelector('.combine-preview-scroll');
  previewScroll.innerHTML = '';
  outputCanvases.forEach((c, i) => {
    let label = document.createElement('div');
    label.style.textAlign = 'center';
    label.style.margin = '0.5em 0 0.2em 0';
    label.textContent = `Part ${String(i+1).padStart(3,'0')}`;
    previewScroll.appendChild(label);
    let block = document.createElement('div');
    block.style.display = 'block';
    block.style.marginBottom = '1.5em';
    // Set preview size to 65% of original
    c.style.width = '65%';
    c.style.height = 'auto';
    block.appendChild(c);
    previewScroll.appendChild(block);
  });
  combineDownload.disabled = false;
  // Store for download
  window._combineOutputCanvases = outputCanvases;
  showMessage('Images combined!', 'success', 3500);
}

combineDownload.addEventListener('click', async () => {
  const outputCanvases = window._combineOutputCanvases || [];
  if (!outputCanvases.length) return;
  if (!window.JSZip) {
    showMessage('Loading ZIP library, please try again in a second.', 'error');
    return;
  }
  showMessage('File downloading...', 'success', 3500);
  const zip = new JSZip();
  const folderName = (combineFolderInput.value || 'combined_images').replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = zip.folder(folderName);
  const blobs = await Promise.all(outputCanvases.map(canvas => new Promise(res => canvas.toBlob(res, 'image/png'))));
  blobs.forEach((blob, i) => {
    folder.file(`${String(i+1).padStart(3,'0')}.png`, blob);
  });
  const content = await zip.generateAsync({type: 'blob'});
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setTimeout(() => {
    showMessage('Download complete! Ready for new task.', 'success', 4000);
    // Clear UI for next use
    combineImages = [];
    outputCanvases.length = 0;
    combineThumbs.innerHTML = '';
    document.querySelector('.combine-preview-scroll').innerHTML = '';
    combineFilesInput.value = '';
    combineFolderInput.value = '';
    combineDownload.disabled = true;
  }, 1000);
});
