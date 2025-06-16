// Placeholder for image splitter logic
const splitUpload = document.getElementById('split-upload');
const splitFilesInput = document.getElementById('split-files');
const splitThumbs = document.getElementById('split-preview-thumbs');
const splitPreviewList = document.getElementById('split-preview-list');
const splitDownload = document.getElementById('split-download');
const splitRun = document.getElementById('split-run');
const splitPartsInput = document.getElementById('split-parts');
const splitPartsHint = document.getElementById('split-parts-hint');
const splitConvert = document.getElementById('split-convert');
const splitFormat = document.getElementById('split-format');
const splitFolderInput = document.getElementById('split-folder');

let splitImages = [];
let splitResults = [];
const MIN_PART_HEIGHT = 100;

splitUpload.addEventListener('dragover', e => {
  e.preventDefault();
  splitUpload.classList.add('dragover');
});
splitUpload.addEventListener('dragleave', e => {
  e.preventDefault();
  splitUpload.classList.remove('dragover');
});
splitUpload.addEventListener('drop', e => {
  e.preventDefault();
  splitUpload.classList.remove('dragover');
  handleSplitFiles(e.dataTransfer.files);
});
splitFilesInput.addEventListener('change', e => {
  handleSplitFiles(e.target.files);
});
splitUpload.addEventListener('click', () => {
  splitFilesInput.click();
});

splitConvert.addEventListener('change', () => {
  splitFormat.disabled = !splitConvert.checked;
  splitFormat.style.display = splitConvert.checked ? '' : 'none';
});
splitFormat.addEventListener('change', clearSplitterOutput);
splitPartsInput.addEventListener('input', clearSplitterOutput);

async function handleSplitFiles(files) {
  splitImages = [];
  splitResults = [];
  splitThumbs.innerHTML = '';
  splitPreviewList.innerHTML = '';
  splitDownload.style.display = 'none';
  splitRun.style.display = '';
  splitRun.disabled = false;
  splitPartsHint.textContent = '';
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
      splitImages = imgs.map(img => {
        img._filename = img._filename || '';
        img._originalFile = null;
        return img;
      });
      imgs.forEach(img => {
        const thumb = document.createElement('img');
        thumb.src = img.src;
        splitThumbs.appendChild(thumb);
      });
      // Do NOT auto-split
      updatePartsHint();
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
          splitImages.push(img);
          const thumb = document.createElement('img');
          thumb.src = img.src;
          splitThumbs.appendChild(thumb);
          loaded++;
          if (loaded === imageArr.length) {
            splitImages.sort((a, b) => (a._filename || '').localeCompare(b._filename || '', undefined, {numeric: true, sensitivity: 'base'}));
            // Do NOT auto-split
            updatePartsHint();
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

function updatePartsHint() {
  // Calculate min number of parts for all images
  if (!splitImages.length) {
    splitPartsHint.textContent = '';
    return;
  }
  let minParts = Math.min(...splitImages.map(img => Math.floor(img.height / MIN_PART_HEIGHT)));
  if (minParts < 1) minParts = 1;
  splitPartsInput.min = 1;
  splitPartsHint.textContent = ` (Min parts for 100px: ${minParts})`;
}

function clearSplitterOutput() {
  splitResults = [];
  splitPreviewList.innerHTML = '';
  splitDownload.style.display = 'none';
  splitRun.style.display = '';
}

splitRun.addEventListener('click', () => {
  if (!splitImages.length) {
    showMessage('Please upload images first.', 'error');
    return;
  }
  const numParts = parseInt(splitPartsInput.value);
  if (!numParts || numParts < 1) {
    showMessage('Please enter a valid number of parts.', 'error');
    return;
  }
  // Check min part height for all images
  let minAllowedParts = Math.min(...splitImages.map(img => Math.floor(img.height / MIN_PART_HEIGHT)));
  if (minAllowedParts < 1) minAllowedParts = 1;
  if (splitImages.some(img => Math.floor(img.height / numParts) < MIN_PART_HEIGHT)) {
    showMessage(`The entered parts number will cause some parts to be less than 100px high. Min parts allowed: ${minAllowedParts}`, 'error', 7000);
    return;
  }
  splitRun.disabled = true;
  splitRun.style.display = 'none';
  splitDownload.style.display = 'none';
  splitAll(numParts).then(() => {
    splitRun.disabled = false;
    splitDownload.style.display = '';
  });
});

async function splitAll(numParts) {
  splitResults = [];
  splitPreviewList.innerHTML = '';
  if (!splitImages.length) return;
  const doConvert = splitConvert.checked;
  const format = doConvert ? splitFormat.value : undefined;
  let outType = 'image/png', ext = 'png';
  if (doConvert && format === 'jpeg') { outType = 'image/jpeg'; ext = 'jpg'; }
  if (doConvert && format === 'webp') { outType = 'image/webp'; ext = 'webp'; }
  let partCounter = 1;
  for (let i = 0; i < splitImages.length; i++) {
    const img = splitImages[i];
    const partHeight = Math.floor(img.height / numParts);
    let remainder = img.height % numParts;
    let y = 0;
    for (let p = 0; p < numParts; p++) {
      let thisPartHeight = partHeight + (p < remainder ? 1 : 0); // Distribute remainder
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = thisPartHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, y, img.width, thisPartHeight, 0, 0, img.width, thisPartHeight);
      const blob = await new Promise(res => canvas.toBlob(res, doConvert ? outType : undefined));
      const url = URL.createObjectURL(blob);
      splitResults.push({
        url,
        ext: doConvert ? ext : (img._filename ? img._filename.split('.').pop().toLowerCase() : 'png'),
        name: String(partCounter).padStart(3, '0')
      });
      // Preview
      const pair = document.createElement('div');
      pair.className = 'split-preview-pair';
      pair.innerHTML = `
        <div style="text-align:center;">
          <img src="${url}" alt="split"><br>
          <div class="split-info">${splitResults[splitResults.length-1].name}.${splitResults[splitResults.length-1].ext}</div>
        </div>
      `;
      splitPreviewList.appendChild(pair);
      y += thisPartHeight;
      partCounter++;
    }
  }
  showMessage('Images split!', 'success', 3500);
}

splitDownload.addEventListener('click', async () => {
  if (!splitResults.length) return;
  splitDownload.style.display = 'none';
  if (splitResults.length === 1) {
    // Download single file
    const {url, name, ext} = splitResults[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.' + ext;
    a.click();
    showMessage('Download complete!', 'success', 3500);
    setTimeout(clearSplitterUI, 1200);
    return;
  }
  if (!window.JSZip) {
    showMessage('Loading ZIP library, please try again in a second.', 'error');
    return;
  }
  showMessage('File downloading...', 'success', 3500);
  const zip = new JSZip();
  const folderName = (splitFolderInput.value || 'split_images').replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = zip.folder(folderName);
  for (let i = 0; i < splitResults.length; i++) {
    const {url, name, ext} = splitResults[i];
    const resp = await fetch(url);
    const blob = await resp.blob();
    folder.file(`${name}.${ext}`, blob);
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
    clearSplitterUI();
  }, 1200);
});

function clearSplitterUI() {
  splitImages = [];
  splitResults = [];
  splitThumbs.innerHTML = '';
  splitPreviewList.innerHTML = '';
  splitFilesInput.value = '';
  splitFolderInput.value = '';
  splitDownload.style.display = 'none';
  splitRun.style.display = '';
  splitPartsHint.textContent = '';
}
