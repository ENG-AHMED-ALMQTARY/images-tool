// Logo Overlay / Placement Tool
// Handles image and logo uploads, navigation, live canvas preview, and logo positioning
// All logic is in-browser, no frameworks

// --- DOM Elements ---
const logoImageUpload = document.getElementById('logo-image-upload');
const logoImageFiles = document.getElementById('logo-image-files');
const logoImageThumbs = document.getElementById('logo-image-thumbs');
const logoLogoUpload = document.getElementById('logo-logo-upload');
const logoLogoFiles = document.getElementById('logo-logo-files');
const logoLogoThumbs = document.getElementById('logo-logo-thumbs');
const logoNum = document.getElementById('logo-num');
const logoStart = document.getElementById('logo-start');
const logoPrev = document.getElementById('logo-prev');
const logoNext = document.getElementById('logo-next');
const logoPageInfo = document.getElementById('logo-page-info');
const logoOverlayCanvasContainer = document.getElementById('logo-overlay-canvas-container');
const logoOverlayCanvas = document.getElementById('logo-overlay-canvas');
const logoOverlayControls = document.getElementById('logo-overlay-controls');
const logoOverlayLogoControls = document.getElementById('logo-overlay-logo-controls');
const logoOverlayActions = document.getElementById('logo-overlay-actions');
const logoReset = document.getElementById('logo-reset');
const logoExport = document.getElementById('logo-export');

// --- State ---
let logoImages = [];
let logoLogos = [];
let logoPositions = {}; // { imageIdx: [ {x, y, scale, opacity}, ... ] }
let logoCurrentImage = 0;
let logoCurrentLogo = 0;
let logoNumPerImage = 1;
let logoExportedBlobs = [];
let logoStepPx = 10; // Default step in pixels

// --- Upload Handlers ---
logoImageUpload.addEventListener('dragover', e => { e.preventDefault(); logoImageUpload.classList.add('dragover'); });
logoImageUpload.addEventListener('dragleave', e => { e.preventDefault(); logoImageUpload.classList.remove('dragover'); });
logoImageUpload.addEventListener('drop', e => { e.preventDefault(); logoImageUpload.classList.remove('dragover'); handleLogoImageFiles(e.dataTransfer.files); });
logoImageFiles.addEventListener('change', e => { handleLogoImageFiles(e.target.files); });
logoImageUpload.addEventListener('click', () => { logoImageFiles.click(); });

logoLogoUpload.addEventListener('dragover', e => { e.preventDefault(); logoLogoUpload.classList.add('dragover'); });
logoLogoUpload.addEventListener('dragleave', e => { e.preventDefault(); logoLogoUpload.classList.remove('dragover'); });
logoLogoUpload.addEventListener('drop', e => { e.preventDefault(); logoLogoUpload.classList.remove('dragover'); handleLogoLogoFiles(e.dataTransfer.files); });
logoLogoFiles.addEventListener('change', e => { handleLogoLogoFiles(e.target.files); });
logoLogoUpload.addEventListener('click', () => { logoLogoFiles.click(); });

async function handleLogoImageFiles(files) {
  logoImages = [];
  logoImageThumbs.innerHTML = '';
  const arr = Array.from(files);
  const zipFile = arr.find(f => f.name && f.name.toLowerCase().endsWith('.zip'));
  if (zipFile) {
    if (!window.JSZip || !window.extractImagesFromZip) {
      showMessage('Loading ZIP library, please try again in a second.', 'error');
      return;
    }
    showMessage('Extracting images from ZIP...', 'success', 3500);
    const imgs = await window.extractImagesFromZip(zipFile);
    if (!imgs.length) { showMessage('No images found in ZIP', 'error'); return; }
    logoImages = imgs.map(img => { img._filename = img._filename || ''; return img; });
    imgs.forEach(img => {
      const thumb = document.createElement('img');
      thumb.src = img.src;
      thumb.style.width = '60px';
      thumb.style.height = '60px';
      thumb.style.objectFit = 'cover';
      thumb.style.margin = '0 0.3em 0.3em 0';
      logoImageThumbs.appendChild(thumb);
    });
    showMessage('Images ready.', 'success', 2000);
    return;
  }
  // Only handle images for now
  const imageArr = arr.filter(f => f.type.startsWith('image/'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
  if (!imageArr.length) { showMessage('No images found.', 'error'); return; }
  let loaded = 0;
  imageArr.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new window.Image();
      img.onload = () => {
        img._filename = file.name;
        logoImages.push(img);
        const thumb = document.createElement('img');
        thumb.src = img.src;
        thumb.style.width = '60px';
        thumb.style.height = '60px';
        thumb.style.objectFit = 'cover';
        thumb.style.margin = '0 0.3em 0.3em 0';
        logoImageThumbs.appendChild(thumb);
        loaded++;
        if (loaded === imageArr.length) {
          logoImages.sort((a, b) => (a._filename || '').localeCompare(b._filename || '', undefined, {numeric: true, sensitivity: 'base'}));
          showMessage('Images ready.', 'success', 2000);
        }
      };
      img.onerror = () => showMessage('Failed to load image: ' + file.name, 'error');
      img.src = e.target.result;
    };
    reader.onerror = () => showMessage('Failed to read file: ' + file.name, 'error');
    reader.readAsDataURL(file);
  });
}

function handleLogoLogoFiles(files) {
  logoLogos = [];
  logoLogoThumbs.innerHTML = '';
  const arr = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 10);
  if (!arr.length) { showMessage('No logo images found.', 'error'); return; }
  let loaded = 0;
  arr.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new window.Image();
      img.onload = () => {
        logoLogos.push(img);
        const thumb = document.createElement('img');
        thumb.src = img.src;
        thumb.style.width = '40px';
        thumb.style.height = '40px';
        thumb.style.objectFit = 'contain';
        thumb.style.margin = '0 0.2em 0.2em 0';
        logoLogoThumbs.appendChild(thumb);
        loaded++;
        if (loaded === arr.length) {
          showMessage('Logos ready.', 'success', 2000);
        }
      };
      img.onerror = () => showMessage('Failed to load logo: ' + file.name, 'error');
      img.src = e.target.result;
    };
    reader.onerror = () => showMessage('Failed to read logo: ' + file.name, 'error');
    reader.readAsDataURL(file);
  });
}

// --- Start Placement ---
logoStart.addEventListener('click', () => {
  if (!logoImages.length || !logoLogos.length) {
    showMessage('Please upload both images and logos.', 'error');
    return;
  }
  logoNumPerImage = parseInt(logoNum.value);
  logoCurrentImage = 0;
  logoCurrentLogo = 0;
  logoPositions = {};
  for (let i = 0; i < logoImages.length; i++) {
    logoPositions[i] = [];
    // Calculate initial Y positions as per enhancement
    const n = logoNumPerImage;
    for (let j = 0; j < n; j++) {
      // Divide height by (n+1), place at (j+1)*(1/(n+1))
      const yFrac = ((j + 1) / (n + 1));
      logoPositions[i][j] = { x: 0.85, y: yFrac, scale: 0.15, opacity: 1 };
    }
  }
  showLogoOverlayUI();
  showLogoOverlayImage(logoCurrentImage);
});

// --- Navigation ---
logoPrev.addEventListener('click', () => {
  if (logoCurrentImage > 0) {
    logoCurrentImage--;
    showLogoOverlayImage(logoCurrentImage);
  }
});
logoNext.addEventListener('click', () => {
  if (logoCurrentImage < logoImages.length - 1) {
    logoCurrentImage++;
    showLogoOverlayImage(logoCurrentImage);
  } else {
    showLogoDownloadAll();
  }
});

function showLogoOverlayUI() {
  logoOverlayCanvasContainer.style.display = '';
  logoOverlayControls.style.display = '';
  logoOverlayLogoControls.style.display = '';
  logoOverlayActions.style.display = '';
}

function showLogoOverlayImage(idx) {
  logoPageInfo.textContent = `Image ${idx+1} of ${logoImages.length}`;
  logoPrev.disabled = idx === 0;
  logoNext.disabled = idx === logoImages.length - 1;
  drawLogoOverlayCanvas(idx);
  showLogoLogoControls(idx);
  updateLogoDownloadAllUI();
}

function drawLogoOverlayCanvas(idx) {
  const img = logoImages[idx];
  const canvas = logoOverlayCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (let j = 0; j < logoNumPerImage; j++) {
    // Cycle through uploaded logos as needed
    const logo = logoLogos[j % logoLogos.length];
    const pos = logoPositions[idx][j];
    if (!logo || !pos) continue;
    const w = logo.width * pos.scale;
    const h = logo.height * pos.scale;
    const x = pos.x * canvas.width;
    const y = pos.y * canvas.height;
    ctx.globalAlpha = pos.opacity;
    ctx.drawImage(logo, x, y, w, h);
    ctx.globalAlpha = 1;
    if (j === logoCurrentLogo) {
      ctx.strokeStyle = '#ffb900';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
    }
  }
}

// Always show download all UI, but enable only on last image
function updateLogoDownloadAllUI() {
  let container = document.getElementById('logo-download-all-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'logo-download-all-container';
    container.style.textAlign = 'center';
    container.style.margin = '2em 0';
    const label = document.createElement('label');
    label.textContent = 'Output ZIP Name: ';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'logo-zip-name';
    input.value = 'images_with_logos';
    input.style.width = '220px';
    input.style.marginRight = '1em';
    const btn = document.createElement('button');
    btn.textContent = 'Download All';
    btn.className = 'primary-btn';
    btn.id = 'logo-download-all-btn';
    btn.disabled = true;
    btn.addEventListener('click', downloadAllLogoImages);
    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'primary-btn';
    clearBtn.style.marginLeft = '1em';
    clearBtn.addEventListener('click', clearLogoOverlayAll);
    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(btn);
    container.appendChild(clearBtn);
    document.querySelector('#logo-overlay').appendChild(container);
  } else {
    container.style.display = '';
  }
  // Enable/disable button based on current image
  const btn = document.getElementById('logo-download-all-btn');
  if (btn) btn.disabled = (logoCurrentImage !== logoImages.length - 1);
  // Add convert checkbox and format selector next to Download All
  let convertContainer = document.getElementById('logo-convert-container');
  if (!convertContainer) {
    convertContainer = document.createElement('span');
    convertContainer.id = 'logo-convert-container';
    convertContainer.style.marginLeft = '2em';
    // Convert checkbox
    const convertCheckbox = document.createElement('input');
    convertCheckbox.type = 'checkbox';
    convertCheckbox.id = 'logo-convert';
    convertCheckbox.style.marginLeft = '1em';
    const convertLabel = document.createElement('label');
    convertLabel.textContent = 'Convert format';
    convertLabel.style.marginLeft = '0.3em';
    convertLabel.htmlFor = 'logo-convert';
    // Format selector
    const formatSelect = document.createElement('select');
    formatSelect.id = 'logo-format';
    formatSelect.style.display = 'none';
    formatSelect.style.marginLeft = '0.5em';
    const optJpg = document.createElement('option');
    optJpg.value = 'jpeg';
    optJpg.textContent = 'JPEG (.jpg)';
    const optWebp = document.createElement('option');
    optWebp.value = 'webp';
    optWebp.textContent = 'WebP (.webp)';
    formatSelect.appendChild(optJpg);
    formatSelect.appendChild(optWebp);
    convertCheckbox.addEventListener('change', () => {
      formatSelect.style.display = convertCheckbox.checked ? '' : 'none';
    });
    convertContainer.appendChild(convertCheckbox);
    convertContainer.appendChild(convertLabel);
    convertContainer.appendChild(formatSelect);
    container.appendChild(convertContainer);
  }
}

// Hide download all UI on clear
function clearLogoOverlayAll() {
  // Reset all state and UI for logo overlay
  logoImages = [];
  logoLogos = [];
  logoPositions = {};
  logoCurrentImage = 0;
  logoCurrentLogo = 0;
  logoNumPerImage = 1;
  logoImageThumbs.innerHTML = '';
  logoLogoThumbs.innerHTML = '';
  let container = document.getElementById('logo-download-all-container');
  if (container) container.style.display = 'none';
  logoOverlayCanvasContainer.style.display = 'none';
  logoOverlayControls.style.display = 'none';
  logoOverlayLogoControls.style.display = 'none';
  logoOverlayActions.style.display = 'none';
  removeLogoArrowsSticky();
}

// Link the sticky container styles via external CSS file
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/sticky-container.css';
document.head.appendChild(link);

// --- ENHANCEMENT: Control all positions ---
function showLogoLogoControls(idx) {
  logoOverlayLogoControls.innerHTML = '';
  // Remove old sticky if exists
  let arrows = document.getElementById('logo-arrows-sticky');
  if (arrows) arrows.remove();
  // Create sticky container
  arrows = document.createElement('div');
  arrows.id = 'logo-arrows-sticky';
  arrows.style.position = 'fixed';
  arrows.style.top = '50%';
  arrows.style.right = '24px';
  arrows.style.transform = 'translateY(-50%)';
  arrows.style.zIndex = '9999';
  arrows.style.display = 'flex';
  arrows.style.flexDirection = 'column';
  arrows.style.gap = '1em';
  arrows.style.background = 'rgba(30, 78, 140, 0.97)';
  arrows.style.borderRadius = '16px';
  arrows.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
  arrows.style.padding = '1.2em 1.2em 1.2em 1.2em';
  arrows.style.minWidth = '180px';
  arrows.style.alignItems = 'center';
  // Logo select
  const selectLabel = document.createElement('label');
  selectLabel.textContent = 'Logo:';
  selectLabel.style.color = '#fff';
  selectLabel.style.fontWeight = 'bold';
  selectLabel.style.marginBottom = '0.2em';
  const select = document.createElement('select');
  for (let j = 0; j < logoNumPerImage; j++) {
    const opt = document.createElement('option');
    opt.value = j;
    opt.textContent = `Logo ${j+1}`;
    if (j === logoCurrentLogo) opt.selected = true;
    select.appendChild(opt);
  }
  select.style.marginBottom = '0.7em';
  select.addEventListener('change', e => {
    logoCurrentLogo = parseInt(select.value);
    drawLogoOverlayCanvas(idx);
    showLogoLogoControls(idx);
  });
  // Scale slider
  const scaleLabel = document.createElement('label');
  scaleLabel.textContent = ' Scale:';
  scaleLabel.style.color = '#fff';
  scaleLabel.style.marginLeft = '0.5em';
  const scaleSlider = document.createElement('input');
  scaleSlider.type = 'range';
  scaleSlider.min = '0.05';
  scaleSlider.max = '0.5';
  scaleSlider.step = '0.01';
  scaleSlider.value = logoPositions[idx][logoCurrentLogo].scale;
  scaleSlider.style.width = '90px';
  scaleSlider.style.marginLeft = '0.5em';
  scaleSlider.addEventListener('input', () => {
    if (scaleAllCheckbox.checked) {
      for (let j = 0; j < logoNumPerImage; j++) {
        logoPositions[idx][j].scale = parseFloat(scaleSlider.value);
      }
    } else {
      logoPositions[idx][logoCurrentLogo].scale = parseFloat(scaleSlider.value);
    }
    drawLogoOverlayCanvas(idx);
  });
  // Step size selector
  const stepLabel = document.createElement('label');
  stepLabel.textContent = ' Step(px):';
  stepLabel.style.color = '#fff';
  stepLabel.style.marginLeft = '0.5em';
  const stepSelect = document.createElement('select');
  [1, 2, 5, 10, 20, 30].forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    if (val === logoStepPx) opt.selected = true;
    stepSelect.appendChild(opt);
  });
  stepSelect.style.marginLeft = '0.5em';
  stepSelect.addEventListener('change', () => {
    logoStepPx = parseInt(stepSelect.value);
  });
  // Scale all checkbox
  const scaleAllCheckbox = document.createElement('input');
  scaleAllCheckbox.type = 'checkbox';
  scaleAllCheckbox.id = 'logo-scale-all';
  scaleAllCheckbox.style.marginLeft = '0.7em';
  const scaleAllLabel = document.createElement('label');
  scaleAllLabel.textContent = 'Scale all';
  scaleAllLabel.style.color = '#fff';
  scaleAllLabel.style.marginLeft = '0.3em';
  scaleAllLabel.htmlFor = 'logo-scale-all';
  // Control all checkbox
  const controlAllCheckbox = document.createElement('input');
  controlAllCheckbox.type = 'checkbox';
  controlAllCheckbox.id = 'logo-control-all';
  controlAllCheckbox.style.marginLeft = '0.7em';
  const controlAllLabel = document.createElement('label');
  controlAllLabel.textContent = 'Control all';
  controlAllLabel.style.color = '#fff';
  controlAllLabel.style.marginLeft = '0.3em';
  controlAllLabel.htmlFor = 'logo-control-all';
  // Opacity (transparency) slider and 'Transparent all' checkbox
  const opacityLabel = document.createElement('label');
  opacityLabel.textContent = ' Opacity:';
  opacityLabel.style.color = '#fff';
  opacityLabel.style.marginLeft = '0.5em';
  const opacitySlider = document.createElement('input');
  opacitySlider.type = 'range';
  opacitySlider.min = '0.1';
  opacitySlider.max = '1';
  opacitySlider.step = '0.01';
  opacitySlider.value = logoPositions[idx][logoCurrentLogo].opacity;
  opacitySlider.style.width = '90px';
  opacitySlider.style.marginLeft = '0.5em';
  // Transparent all checkbox
  const opacityAllCheckbox = document.createElement('input');
  opacityAllCheckbox.type = 'checkbox';
  opacityAllCheckbox.id = 'logo-opacity-all';
  opacityAllCheckbox.style.marginLeft = '0.7em';
  const opacityAllLabel = document.createElement('label');
  opacityAllLabel.textContent = 'Transparent all';
  opacityAllLabel.style.color = '#fff';
  opacityAllLabel.style.marginLeft = '0.3em';
  opacityAllLabel.htmlFor = 'logo-opacity-all';
  opacitySlider.addEventListener('input', () => {
    if (opacityAllCheckbox.checked) {
      for (let j = 0; j < logoNumPerImage; j++) {
        logoPositions[idx][j].opacity = parseFloat(opacitySlider.value);
      }
    } else {
      logoPositions[idx][logoCurrentLogo].opacity = parseFloat(opacitySlider.value);
    }
    drawLogoOverlayCanvas(idx);
  });
  // Arrow controls
  const arrowsRow = document.createElement('div');
  arrowsRow.style.display = 'flex';
  arrowsRow.style.flexDirection = 'row';
  arrowsRow.style.gap = '0.3em';
  ['↑','↓','←','→'].forEach(dir => {
    const abtn = document.createElement('button');
    abtn.textContent = dir;
    abtn.className = 'primary-btn';
    abtn.style.margin = '0.1em 0';
    abtn.style.width = '48px';
    abtn.style.height = '48px';
    abtn.style.fontSize = '1.5em';
    abtn.addEventListener('click', () => moveLogo(dir));
    arrowsRow.appendChild(abtn);
  });
  // Compose sticky
  arrows.appendChild(selectLabel);
  arrows.appendChild(select);
  arrows.appendChild(scaleLabel);
  arrows.appendChild(scaleSlider);
  arrows.appendChild(scaleAllCheckbox);
  arrows.appendChild(scaleAllLabel);
  arrows.appendChild(stepLabel);
  arrows.appendChild(stepSelect);
  arrows.appendChild(controlAllCheckbox);
  arrows.appendChild(controlAllLabel);
  arrows.appendChild(opacityLabel);
  arrows.appendChild(opacitySlider);
  arrows.appendChild(opacityAllCheckbox);
  arrows.appendChild(opacityAllLabel);
  arrows.appendChild(arrowsRow);
  document.body.appendChild(arrows);
}

function moveLogo(dir) {
  const img = logoImages[logoCurrentImage];
  const step = logoStepPx / img.width;
  const controlAll = document.getElementById('logo-control-all') && document.getElementById('logo-control-all').checked;
  if (controlAll) {
    for (let j = 0; j < logoNumPerImage; j++) {
      const pos = logoPositions[logoCurrentImage][j];
      if (dir === '↑') pos.y = Math.max(0, pos.y - logoStepPx / img.height);
      if (dir === '↓') pos.y = Math.min(1, pos.y + logoStepPx / img.height);
      if (dir === '←') pos.x = Math.max(0, pos.x - step);
      if (dir === '→') pos.x = Math.min(1, pos.x + step);
    }
  } else {
    const pos = logoPositions[logoCurrentImage][logoCurrentLogo];
    if (dir === '↑') pos.y = Math.max(0, pos.y - logoStepPx / img.height);
    if (dir === '↓') pos.y = Math.min(1, pos.y + logoStepPx / img.height);
    if (dir === '←') pos.x = Math.max(0, pos.x - step);
    if (dir === '→') pos.x = Math.min(1, pos.x + step);
  }
  drawLogoOverlayCanvas(logoCurrentImage);
}

document.addEventListener('keydown', e => {
  if (!logoOverlayCanvasContainer || logoOverlayCanvasContainer.style.display === 'none') return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
    if (e.key === 'ArrowUp') moveLogo('↑');
    if (e.key === 'ArrowDown') moveLogo('↓');
    if (e.key === 'ArrowLeft') moveLogo('←');
    if (e.key === 'ArrowRight') moveLogo('→');
  }
});

logoReset.addEventListener('click', () => {
  for (let j = 0; j < logoNumPerImage; j++) {
    logoPositions[logoCurrentImage][j] = { x: 0.85, y: 0.1 + 0.15 * j, scale: 0.15, opacity: 1 };
  }
  drawLogoOverlayCanvas(logoCurrentImage);
});

logoExport.addEventListener('click', () => {
  const canvas = logoOverlayCanvas;
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `image_with_logo_${logoCurrentImage+1}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});

async function downloadAllLogoImages() {
  if (!window.JSZip) {
    showMessage('Loading ZIP library, please try again in a second.', 'error');
    return;
  }
  showMessage('Rendering and zipping images...', 'success', 3000);
  const zip = new JSZip();
  // Get convert options
  const convertCheckbox = document.getElementById('logo-convert');
  const formatSelect = document.getElementById('logo-format');
  const doConvert = convertCheckbox && convertCheckbox.checked;
  const format = doConvert && formatSelect ? formatSelect.value : 'png';
  const ext = format === 'jpeg' ? 'jpg' : (format === 'webp' ? 'webp' : 'png');
  for (let i = 0; i < logoImages.length; i++) {
    drawLogoOverlayCanvas(i);
    await new Promise(res => setTimeout(res, 10)); // let canvas update
    await new Promise(resolve => {
      logoOverlayCanvas.toBlob(blob => {
        zip.file(`${String(i+1).padStart(3,'0')}.${ext}`, blob);
        resolve();
      }, doConvert ? `image/${format}` : 'image/png');
    });
  }
  const zipName = document.getElementById('logo-zip-name').value || 'images_with_logos';
  const content = await zip.generateAsync({type: 'blob'});
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${zipName}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showMessage('Download complete!', 'success', 3500);
}

// Responsive styles for logo overlay
(function(){
  const style = document.createElement('style');
  style.textContent = `
    .logo-overlay-options { display: flex; gap: 1.2rem; align-items: center; margin-bottom: 1.2rem; flex-wrap: wrap; }
    #logo-image-thumbs, #logo-logo-thumbs { display: flex; gap: 0.3em; flex-wrap: wrap; margin-top: 0.5em; }
    #logo-image-thumbs img, #logo-logo-thumbs img { border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 2px solid #eee; }
    @media (max-width: 700px) {
      #logo-overlay-canvas { max-width: 100vw !important; }
      .logo-overlay-options { flex-direction: column; align-items: flex-start; }
    }
  `;
  document.head.appendChild(style);
})();

// Remove sticky arrows when not in logo overlay mode
function removeLogoArrowsSticky() {
  const arrows = document.getElementById('logo-arrows-sticky');
  if (arrows) arrows.remove();
}
// Hide sticky arrows on download all
function showLogoDownloadAll() {
  logoOverlayCanvasContainer.style.display = 'none';
  logoOverlayControls.style.display = 'none';
  logoOverlayLogoControls.style.display = 'none';
  logoOverlayActions.style.display = 'none';
  removeLogoArrowsSticky();
  // Show download all UI
  let container = document.getElementById('logo-download-all-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'logo-download-all-container';
    container.style.textAlign = 'center';
    container.style.margin = '2em 0';
    const label = document.createElement('label');
    label.textContent = 'Output ZIP Name: ';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'logo-zip-name';
    input.value = 'images_with_logos';
    input.style.width = '220px';
    input.style.marginRight = '1em';
    const btn = document.createElement('button');
    btn.textContent = 'Download All';
    btn.className = 'primary-btn';
    btn.id = 'logo-download-all-btn';
    btn.disabled = true;
    btn.addEventListener('click', downloadAllLogoImages);
    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'primary-btn';
    clearBtn.style.marginLeft = '1em';
    clearBtn.addEventListener('click', clearLogoOverlayAll);
    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(btn);
    container.appendChild(clearBtn);
    document.querySelector('#logo-overlay').appendChild(container);
  } else {
    container.style.display = '';
  }
}
