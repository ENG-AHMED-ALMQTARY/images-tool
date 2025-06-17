// OCR logic for manga/manhwa/manhua and general images
// Uses Tesseract.js in a Web Worker, supports language selection, navigation, editing, and export
// Requires Tesseract.js from CDN

// Dynamically load Tesseract.js if not present
(function(){
  if (!window.Tesseract) {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.1/dist/tesseract.min.js';
    s.onload = function() { window._tesseractReady = true; };
    document.head.appendChild(s);
  } else {
    window._tesseractReady = true;
  }
})();

const ocrUpload = document.getElementById('ocr-upload');
const ocrFilesInput = document.getElementById('ocr-files');
const ocrThumbs = document.getElementById('ocr-preview-thumbs');
const ocrLang = document.getElementById('ocr-lang');
const ocrStart = document.getElementById('ocr-start');
const ocrProgress = document.getElementById('ocr-progress');
const ocrViewer = document.getElementById('ocr-viewer');
const ocrNav = document.getElementById('ocr-nav');
const ocrPrev = document.getElementById('ocr-prev');
const ocrNext = document.getElementById('ocr-next');
const ocrPageInfo = document.getElementById('ocr-page-info');
const ocrSummary = document.getElementById('ocr-summary');
const ocrExport = document.getElementById('ocr-export');
const ocrCopy = document.getElementById('ocr-copy');
const ocrSaveTxt = document.getElementById('ocr-save-txt');
const ocrSaveDocx = document.getElementById('ocr-save-docx');

let ocrImages = [];
let ocrResults = [];
let ocrCurrent = 0;
let ocrEdits = [];

// Drag & drop logic
ocrUpload.addEventListener('dragover', e => {
  e.preventDefault();
  ocrUpload.classList.add('dragover');
});
ocrUpload.addEventListener('dragleave', e => {
  e.preventDefault();
  ocrUpload.classList.remove('dragover');
});
ocrUpload.addEventListener('drop', e => {
  e.preventDefault();
  ocrUpload.classList.remove('dragover');
  handleOcrFiles(e.dataTransfer.files);
});
ocrFilesInput.addEventListener('change', e => {
  handleOcrFiles(e.target.files);
});
ocrUpload.addEventListener('click', () => {
  ocrFilesInput.click();
});

async function handleOcrFiles(files) {
  ocrImages = [];
  ocrResults = [];
  ocrEdits = [];
  ocrThumbs.innerHTML = '';
  ocrViewer.style.display = 'none';
  ocrNav.style.display = 'none';
  ocrSummary.style.display = 'none';
  ocrExport.style.display = 'none';
  ocrProgress.style.display = 'none';
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
      ocrImages = imgs.map(img => {
        img._filename = img._filename || '';
        img._originalFile = null;
        return img;
      });
      imgs.forEach(img => {
        const thumb = document.createElement('img');
        thumb.src = img.src;
        thumb.style.width = '50%';
        thumb.style.height = 'auto';
        thumb.style.display = 'inline-block';
        thumb.style.margin = '0 0.5em 0.5em 0';
        ocrThumbs.appendChild(thumb);
      });
      showMessage('Images ready for OCR.', 'success', 2500);
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
          ocrImages.push(img);
          const thumb = document.createElement('img');
          thumb.src = img.src;
          thumb.style.width = '50%';
          thumb.style.height = 'auto';
          thumb.style.display = 'inline-block';
          thumb.style.margin = '0 0.5em 0.5em 0';
          ocrThumbs.appendChild(thumb);
          loaded++;
          if (loaded === imageArr.length) {
            ocrImages.sort((a, b) => (a._filename || '').localeCompare(b._filename || '', undefined, {numeric: true, sensitivity: 'base'}));
            showMessage('Images ready for OCR.', 'success', 2500);
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

ocrStart.addEventListener('click', async () => {
  if (!ocrImages.length) {
    showMessage('Please upload images first.', 'error');
    return;
  }
  if (!window.Tesseract) {
    showMessage('Loading OCR engine, please wait...', 'error');
    return;
  }
  ocrResults = [];
  ocrEdits = [];
  ocrCurrent = 0;
  ocrProgress.style.display = '';
  ocrProgress.textContent = 'Starting OCR...';
  ocrViewer.style.display = 'none';
  ocrNav.style.display = 'none';
  ocrSummary.style.display = 'none';
  ocrExport.style.display = 'none';
  for (let i = 0; i < ocrImages.length; i++) {
    ocrProgress.textContent = `Processing image ${i+1} of ${ocrImages.length}...`;
    let img = ocrImages[i];
    // Convert to JPG if not already
    let src = img.src;
    if (!src.startsWith('data:image/jpeg')) {
      src = await convertToJpg(img);
    }
    const lang = ocrLang.value;
    try {
      const { data } = await Tesseract.recognize(src, lang, {
        logger: m => {
          if (m.status === 'recognizing text') {
            ocrProgress.textContent = `Image ${i+1}: ${Math.round(m.progress*100)}%`;
          }
        }
      });
      // Split text by lines, add empty line between bubbles
      let lines = (data.text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let formatted = lines.join('\n\n');
      ocrResults.push(formatted);
      ocrEdits.push(formatted);
    } catch (err) {
      ocrResults.push('');
      ocrEdits.push('');
      showMessage('OCR failed for one image.', 'error');
    }
  }
  ocrProgress.style.display = 'none';
  showMessage('OCR complete! You can now review and edit.', 'success', 3500);
  showOcrPage(0);
});

function showOcrPage(idx) {
  if (!ocrImages.length) return;
  ocrCurrent = idx;
  ocrViewer.style.display = '';
  ocrNav.style.display = '';
  ocrSummary.style.display = 'none';
  ocrExport.style.display = 'none';
  ocrViewer.innerHTML = '';
  // Layout: image left, editable text right
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '2em';
  container.style.alignItems = 'flex-start';
  // Image
  const imgBox = document.createElement('div');
  imgBox.style.flex = '1 1 320px';
  imgBox.style.textAlign = 'center';
  const img = document.createElement('img');
  img.src = ocrImages[idx].src;
  img.style.maxWidth = '100%';
  img.style.maxHeight = '60vh';
  img.style.borderRadius = '8px';
  imgBox.appendChild(img);
  // Editable text
  const textBox = document.createElement('div');
  textBox.style.flex = '1 1 320px';
  const textarea = document.createElement('textarea');
  textarea.value = ocrEdits[idx] || '';
  textarea.style.width = '100%';
  textarea.style.height = '60vh';
  textarea.style.fontSize = '1.1em';
  textarea.style.padding = '1em';
  textarea.style.borderRadius = '8px';
  textarea.style.boxSizing = 'border-box';
  textarea.addEventListener('input', e => {
    ocrEdits[idx] = textarea.value;
  });
  textBox.appendChild(textarea);
  container.appendChild(imgBox);
  container.appendChild(textBox);
  ocrViewer.appendChild(container);
  ocrPageInfo.textContent = `Page ${idx+1} of ${ocrImages.length}`;
  ocrPrev.disabled = idx === 0;
  ocrNext.disabled = idx === ocrImages.length-1;
}

ocrPrev.addEventListener('click', () => {
  if (ocrCurrent > 0) showOcrPage(ocrCurrent-1);
});
ocrNext.addEventListener('click', () => {
  if (ocrCurrent < ocrImages.length-1) showOcrPage(ocrCurrent+1);
  else showOcrSummary();
});

function showOcrSummary() {
  ocrViewer.style.display = 'none';
  ocrNav.style.display = 'none';
  ocrSummary.style.display = '';
  ocrExport.style.display = '';
  ocrSummary.innerHTML = '';
  // Show all images left, all text right
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '2em';
  // Images column
  const imgCol = document.createElement('div');
  imgCol.style.flex = '1 1 320px';
  ocrImages.forEach(imgObj => {
    const img = document.createElement('img');
    img.src = imgObj.src;
    img.style.maxWidth = '100%';
    img.style.marginBottom = '1em';
    img.style.borderRadius = '8px';
    imgCol.appendChild(img);
  });
  // Text column
  const textCol = document.createElement('div');
  textCol.style.flex = '1 1 320px';
  const textarea = document.createElement('textarea');
  textarea.value = ocrEdits.join('\n\n---\n\n');
  textarea.style.width = '100%';
  textarea.style.height = '70vh';
  textarea.style.fontSize = '1.1em';
  textarea.style.padding = '1em';
  textarea.style.borderRadius = '8px';
  textarea.style.boxSizing = 'border-box';
  textarea.addEventListener('input', e => {
    // If user edits summary, update all
    ocrEdits = textarea.value.split(/\n\n---\n\n/);
  });
  textCol.appendChild(textarea);
  container.appendChild(imgCol);
  container.appendChild(textCol);
  ocrSummary.appendChild(container);
}

ocrCopy.addEventListener('click', () => {
  const text = ocrEdits.join('\n\n---\n\n');
  navigator.clipboard.writeText(text).then(() => {
    showMessage('Copied to clipboard!', 'success', 2000);
  });
});
ocrSaveTxt.addEventListener('click', () => {
  const text = ocrEdits.join('\n\n---\n\n');
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ocr_result.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
ocrSaveDocx.addEventListener('click', () => {
  // Minimal docx export (plain text)
  const text = ocrEdits.join('\n\n---\n\n');
  const content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'</w:t></w:r></w:p><w:p><w:r><w:t>')}</w:t></w:r></w:p></w:body></w:document>`;
  const blob = new Blob([content], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ocr_result.docx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

async function convertToJpg(img) {
  return new Promise(res => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(blob => {
      res(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.92);
  });
}

// Responsive styles for OCR
(function(){
  const style = document.createElement('style');
  style.textContent = `
    .ocr-options { display: flex; gap: 1.2rem; align-items: center; margin-bottom: 1.2rem; flex-wrap: wrap; }
    .ocr-viewer-container, #ocr-summary { min-width: 320px; padding: 1rem; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; gap: 2em; }
    @media (max-width: 700px) {
      .ocr-viewer-container > div, #ocr-summary > div { flex-direction: column !important; }
      .ocr-viewer-container textarea, #ocr-summary textarea { height: 30vh !important; }
    }
    .ocr-viewer-container textarea, #ocr-summary textarea { width: 100%; min-height: 200px; font-size: 1.1em; padding: 1em; border-radius: 8px; box-sizing: border-box; margin-top: 1em; }
    .ocr-viewer-container img, #ocr-summary img { max-width: 100%; border-radius: 8px; margin-bottom: 1em; }
  `;
  document.head.appendChild(style);
})();
