// Helper to extract images from a ZIP file using JSZip
window.extractImagesFromZip = async function(file) {
  if (!window.JSZip) throw new Error('JSZip not loaded');
  const zip = await JSZip.loadAsync(file);
  const imageFiles = Object.values(zip.files).filter(f => /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name) && !f.dir);
  if (!imageFiles.length) throw new Error('No images found in ZIP');
  // Sort by filename
  imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
  const images = [];
  for (const f of imageFiles) {
    const blob = await f.async('blob');
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img._filename = f.name;
    img._originalBlob = blob; // Store blob for size
    await new Promise((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Failed to load image: ' + f.name));
      img.src = url;
    });
    images.push(img);
  }
  return images;
};
