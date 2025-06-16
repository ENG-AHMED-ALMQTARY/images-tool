const convertUpload = document.getElementById('convert-upload');
const convertFilesInput = document.getElementById('convert-files');
const convertThumbs = document.getElementById('convert-preview-thumbs');
const convertPreviewList = document.getElementById('convert-preview-list');
const convertDownload = document.getElementById('convert-download');
const convertRun = document.getElementById('convert-run');
const convertFormat = document.getElementById('convert-format');
const convertFolderInput = document.getElementById('convert-folder');

let convertImages = [];
let convertResults = [];

convertUpload.addEventListener('dragover', e => {
  e.preventDefault();
  convertUpload.classList.add('dragover');
});
convertUpload.addEventListener('dragleave', e => {
  e.preventDefault();
  convertUpload.classList.remove('dragover');
});
convertUpload.addEventListener('drop', e => {
  e.preventDefault();
  convertUpload.classList.remove('dragover');
  handleConvertFiles(e.dataTransfer.files);
});
convertFilesInput.addEventListener('change', e => {
  handleConvertFiles(e.target.files);
});
convertUpload.addEventListener('click', () => {
  convertFilesInput.click();
});

async function handleConvertFiles(files) {
  convertImages = [];
  convertResults = [];
  convertThumbs.innerHTML = '';
  convertPreviewList.innerHTML = '';
  convertDownload.style.display = 'none';
  convertRun.style.display = '';
  convertRun.disabled = false;
  try {
    const arr = Array.from(files);
    const rarFile = arr.find(f => f.name && f.name.toLowerCase().endsWith('.rar'));
    if (rarFile) {
      showMessage('RAR extraction is not supported yet. Please upload images or ZIP.', 'error', 6000);
      return;
    }
    const zipFile = arr.find(f => f.name && f.name.toLowerCase().endsWith('.zip'));
    if (zipFile) {
      if (!window.JSZip || !window.extractImagesFromZip) {
        showMessage('Loading ZIP library, please try again in a second.', 'error');
        return;
      }
      showMessage('Extracting images from ZIP...', 'success', 3500);
      const imgs = await window.extractImagesFromZip(zipFile);
      if (!imgs.length) throw new Error('No images found in ZIP');
      convertImages = imgs.map(img => {
        img._filename = img._filename || '';
        img._originalFile = null;
        return img;
      });
      imgs.forEach(img => {
        const thumb = document.createElement('img');
        thumb.src = img.src;
        convertThumbs.appendChild(thumb);
      });
      // Do NOT auto-convert
      return;
    }
    // Only handle images for now
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
          convertImages.push(img);
          const thumb = document.createElement('img');
          thumb.src = img.src;
          convertThumbs.appendChild(thumb);
          loaded++;
          if (loaded === imageArr.length) {
            convertImages.sort((a, b) => (a._filename || '').localeCompare(b._filename || '', undefined, {numeric: true, sensitivity: 'base'}));
            // Do NOT auto-convert
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

function clearConverterOutput() {
  convertResults = [];
  convertPreviewList.innerHTML = '';
  convertDownload.style.display = 'none';
  convertRun.style.display = '';
}

convertFormat.addEventListener('change', clearConverterOutput);

convertRun.addEventListener('click', () => {
  if (!convertImages.length) {
    showMessage('Please upload images first.', 'error');
    return;
  }
  // Check if all images are already in the selected format
  const format = convertFormat.value;
  const extMap = {jpeg: ['.jpg', '.jpeg'], png: ['.png'], webp: ['.webp']};
  const allowedExts = extMap[format] || [];
  const allSame = convertImages.length > 0 && convertImages.every(img => {
    const name = (img._filename || '').toLowerCase();
    return allowedExts.some(ext => name.endsWith(ext));
  });
  if (allSame) {
    showMessage('The Converted Format are The Same of The Orginal Images Format, no need for convertion', 'error', 5000);
    return;
  }
  convertRun.disabled = true;
  convertRun.style.display = 'none';
  convertDownload.style.display = 'none';
  convertAll().then(() => {
    convertRun.disabled = false;
    convertDownload.style.display = '';
  });
});

async function convertAll() {
  convertResults = [];
  convertPreviewList.innerHTML = '';
  if (!convertImages.length) return;
  const format = convertFormat.value;
  let outType = 'image/jpeg', ext = 'jpg';
  if (format === 'webp') { outType = 'image/webp'; ext = 'webp'; }
  if (format === 'png') { outType = 'image/png'; ext = 'png'; }
  for (let i = 0; i < convertImages.length; i++) {
    const img = convertImages[i];
    const originalDataUrl = img.src;
    let originalSize = 0;
    if (img._originalFile && typeof img._originalFile.size === 'number') {
      originalSize = img._originalFile.size;
    } else if (img._originalBlob && typeof img._originalBlob.size === 'number') {
      originalSize = img._originalBlob.size;
    } else {
      originalSize = await getDataUrlSize(originalDataUrl);
    }
    // Convert
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const convertedBlob = await new Promise(res => canvas.toBlob(res, outType, 0.92));
    const convertedUrl = URL.createObjectURL(convertedBlob);
    const convertedSize = convertedBlob.size;
    convertResults.push({
      originalUrl: originalDataUrl,
      convertedUrl,
      originalSize,
      convertedSize,
      ext,
      name: img._filename ? img._filename.replace(/\.[^.]+$/, '') : `image_${i+1}`
    });
    // Preview
    const pair = document.createElement('div');
    pair.className = 'convert-preview-pair';
    pair.innerHTML = `
      <div style="text-align:center;">
        <img src="${originalDataUrl}" alt="original"><br>
        <div class="convert-info">Original<br>${formatBytes(originalSize)}</div>
      </div>
      <div style="text-align:center;">
        <img src="${convertedUrl}" alt="converted"><br>
        <div class="convert-info">Converted<br>${formatBytes(convertedSize)}</div>
      </div>
    `;
    convertPreviewList.appendChild(pair);
  }
  showMessage('Images converted!', 'success', 3500);
}

convertDownload.addEventListener('click', async () => {
  if (!convertResults.length) return;
  convertDownload.style.display = 'none';
  if (convertResults.length === 1) {
    // Download single file
    const {convertedUrl, name, ext} = convertResults[0];
    const a = document.createElement('a');
    a.href = convertedUrl;
    a.download = name + '.' + ext;
    a.click();
    showMessage('Download complete!', 'success', 3500);
    setTimeout(clearConverterUI, 1200);
    return;
  }
  if (!window.JSZip) {
    showMessage('Loading ZIP library, please try again in a second.', 'error');
    return;
  }
  showMessage('File downloading...', 'success', 3500);
  const zip = new JSZip();
  const folderName = (convertFolderInput.value || 'converted_images').replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = zip.folder(folderName);
  for (let i = 0; i < convertResults.length; i++) {
    const {convertedUrl, name, ext} = convertResults[i];
    const resp = await fetch(convertedUrl);
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
    clearConverterUI();
  }, 1200);
});

function clearConverterUI() {
  convertImages = [];
  convertResults = [];
  convertThumbs.innerHTML = '';
  convertPreviewList.innerHTML = '';
  convertFilesInput.value = '';
  convertFolderInput.value = '';
  convertDownload.style.display = 'none';
  convertRun.style.display = '';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(2) + ' MB';
}
async function getDataUrlSize(dataUrl) {
  if (dataUrl.startsWith('data:')) {
    const base64 = dataUrl.split(',')[1];
    return Math.ceil((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  }
  return 0;
}
