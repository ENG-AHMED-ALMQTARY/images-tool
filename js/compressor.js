// Placeholder for image compressor logic
const compressUpload = document.getElementById('compress-upload');
const compressFilesInput = document.getElementById('compress-files');
const compressThumbs = document.getElementById('compress-preview-thumbs');
const compressPreviewList = document.getElementById('compress-preview-list');
const compressDownload = document.getElementById('compress-download');
const compressQuality = document.getElementById('compress-quality');
const compressQualityValue = document.getElementById('compress-quality-value');
const compressFormat = document.getElementById('compress-format');
const compressConvert = document.getElementById('compress-convert');
const compressFolderInput = document.getElementById('compress-folder');
const compressFormatLabel = document.getElementById('compress-format-label');
const compressRun = document.getElementById('compress-run');

let compressImages = [];
let compressResults = [];

compressUpload.addEventListener('dragover', e => {
  e.preventDefault();
  compressUpload.classList.add('dragover');
});
compressUpload.addEventListener('dragleave', e => {
  e.preventDefault();
  compressUpload.classList.remove('dragover');
});
compressUpload.addEventListener('drop', e => {
  e.preventDefault();
  compressUpload.classList.remove('dragover');
  handleCompressFiles(e.dataTransfer.files);
});
compressFilesInput.addEventListener('change', e => {
  handleCompressFiles(e.target.files);
});
compressUpload.addEventListener('click', () => {
  compressFilesInput.click();
});

compressQuality.addEventListener('input', () => {
  compressQualityValue.textContent = (+compressQuality.value).toFixed(2);
});
compressConvert.addEventListener('change', () => {
  compressFormat.disabled = !compressConvert.checked;
  compressFormat.style.display = compressConvert.checked ? '' : 'none';
  compressFormatLabel.innerHTML = compressConvert.checked
    ? 'Output Format: ' + compressFormat.options[compressFormat.selectedIndex].text
    : 'Output Format: <b>Same as input</b>';
});
compressFormat.addEventListener('change', () => {
  compressFormatLabel.innerHTML = 'Output Format: ' + compressFormat.options[compressFormat.selectedIndex].text;
});

compressRun.addEventListener('click', () => {
  if (!compressImages.length) {
    showMessage('Please upload images first.', 'error');
    return;
  }
  compressRun.disabled = true;
  compressRun.style.display = 'none';
  compressDownload.style.display = 'none';
  compressAll().then(() => {
    compressRun.disabled = false;
    compressDownload.style.display = '';
    // Keep compressRun hidden until settings change or new upload
  });
});

async function handleCompressFiles(files) {
  compressImages = [];
  compressResults = [];
  compressThumbs.innerHTML = '';
  compressPreviewList.innerHTML = '';
  compressDownload.style.display = 'none';
  compressRun.style.display = '';
  compressRun.disabled = false;
  compressFormatLabel.innerHTML = 'Output Format: <b>Same as input</b>';
  compressFormat.style.display = 'none';
  compressFormat.disabled = true;
  try {
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
      compressImages = imgs.map(img => {
        img._filename = img._filename || '';
        img._originalFile = null;
        return img;
      });
      imgs.forEach(img => {
        const thumb = document.createElement('img');
        thumb.src = img.src;
        compressThumbs.appendChild(thumb);
      });
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
          img._originalFile = file;
          compressImages.push(img);
          const thumb = document.createElement('img');
          thumb.src = img.src;
          compressThumbs.appendChild(thumb);
          loaded++;
          if (loaded === imageArr.length) {
            compressImages.sort((a, b) => (a._filename || '').localeCompare(b._filename || '', undefined, {numeric: true, sensitivity: 'base'}));
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

// Hide download and clear output if settings change after compression
[compressQuality, compressFormat, compressConvert].forEach(el => {
  el.addEventListener('input', () => {
    clearCompressorOutput();
  });
  el.addEventListener('change', () => {
    clearCompressorOutput();
  });
});

function clearCompressorOutput() {
  compressResults = [];
  compressPreviewList.innerHTML = '';
  compressDownload.style.display = 'none';
  compressRun.style.display = '';
}

async function compressAll() {
  compressResults = [];
  compressPreviewList.innerHTML = '';
  if (!compressImages.length) return;
  const quality = parseFloat(compressQuality.value);
  const doConvert = compressConvert.checked;
  const format = doConvert ? compressFormat.value : undefined;
  for (let i = 0; i < compressImages.length; i++) {
    const img = compressImages[i];
    const originalDataUrl = img.src;
    let originalSize = 0;
    if (img._originalFile && typeof img._originalFile.size === 'number') {
      originalSize = img._originalFile.size;
    } else if (img._originalBlob && typeof img._originalBlob.size === 'number') {
      originalSize = img._originalBlob.size;
    } else {
      originalSize = await getDataUrlSize(originalDataUrl);
    }
    let outType = 'image/jpeg';
    let ext = 'jpg';
    if (doConvert && format === 'webp') {
      outType = 'image/webp';
      ext = 'webp';
    }
    // Compress/convert
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const compressedBlob = await new Promise(res => canvas.toBlob(res, outType, quality));
    const compressedUrl = URL.createObjectURL(compressedBlob);
    const compressedSize = compressedBlob.size;
    compressResults.push({
      originalUrl: originalDataUrl,
      compressedUrl,
      originalSize,
      compressedSize,
      ext,
      name: img._filename || `image_${i+1}.${ext}`
    });
    // Preview
    const pair = document.createElement('div');
    pair.className = 'compress-preview-pair';
    pair.innerHTML = `
      <div style="text-align:center;">
        <img src="${originalDataUrl}" alt="original"><br>
        <div class="compress-info">Original<br>${formatBytes(originalSize)}</div>
      </div>
      <div style="text-align:center;">
        <img src="${compressedUrl}" alt="compressed"><br>
        <div class="compress-info">Compressed<br>${formatBytes(compressedSize)}</div>
      </div>
    `;
    compressPreviewList.appendChild(pair);
  }
  showMessage('Images compressed!', 'success', 3500);
}

compressDownload.addEventListener('click', async () => {
  if (!compressResults.length) return;
  compressDownload.style.display = 'none';
  if (compressResults.length === 1) {
    // Download single file
    const {compressedUrl, name, ext} = compressResults[0];
    const a = document.createElement('a');
    a.href = compressedUrl;
    a.download = name.replace(/\.[^.]+$/, '') + '.' + ext;
    a.click();
    showMessage('Download complete!', 'success', 3500);
    setTimeout(clearCompressorUI, 1200);
    return;
  }
  if (!window.JSZip) {
    showMessage('Loading ZIP library, please try again in a second.', 'error');
    return;
  }
  showMessage('File downloading...', 'success', 3500);
  const zip = new JSZip();
  const folderName = (compressFolderInput.value || 'compressed_images').replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = zip.folder(folderName);
  for (let i = 0; i < compressResults.length; i++) {
    const {compressedUrl, name, ext} = compressResults[i];
    const resp = await fetch(compressedUrl);
    const blob = await resp.blob();
    folder.file(`${String(i+1).padStart(3,'0')}.${ext}`, blob);
  }
  const content = await zip.generateAsync({type: 'blob'});
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setTimeout(() => {
    showMessage('Download complete! Ready for new task.', 'success', 4000);
    clearCompressorUI();
  }, 1200);
});

function clearCompressorUI() {
  compressImages = [];
  compressResults = [];
  compressThumbs.innerHTML = '';
  compressPreviewList.innerHTML = '';
  compressFilesInput.value = '';
  compressFolderInput.value = '';
  compressDownload.disabled = true;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(2) + ' MB';
}
async function getDataUrlSize(dataUrl) {
  // Convert base64 to byte length
  if (dataUrl.startsWith('data:')) {
    const base64 = dataUrl.split(',')[1];
    return Math.ceil((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  }
  return 0;
}
