import { compressImage } from '../utils/helpers.js';

export class ImageHandler {
  constructor() {
    this.cropper = document.getElementById('cropper');
    this.cropImg = document.getElementById('cropImg');
    this.cropStage = document.getElementById('cropStage');
    this.cropZoom = document.getElementById('cropZoom');
    this.cropCancel = document.getElementById('cropCancel');
    this.cropUse = document.getElementById('cropUse');
    this.lightbox = document.getElementById('lightbox');
    this.lightboxImg = document.getElementById('lightboxImg');
    this.lightboxCap = document.getElementById('lightboxCap');
    this.lightboxClose = document.getElementById('lightboxClose');
    this.lightboxBackdrop = document.getElementById('lightboxBackdrop');

    this.currentFile = null;
    this.onImageCropped = null;
    this.dragState = { isDragging: false, startX: 0, startY: 0, translateX: 0, translateY: 0 };
    this.scale = 1;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Cropper
    this.cropCancel.addEventListener('click', () => this.closeCropper());
    this.cropUse.addEventListener('click', () => this.applyCrop());
    this.cropZoom.addEventListener('input', (e) => this.handleZoom(e.target.value));

    // Drag en cropper
    this.cropStage.addEventListener('mousedown', (e) => this.startDrag(e));
    this.cropStage.addEventListener('mousemove', (e) => this.drag(e));
    this.cropStage.addEventListener('mouseup', () => this.endDrag());
    this.cropStage.addEventListener('mouseleave', () => this.endDrag());

    // Touch support
    this.cropStage.addEventListener('touchstart', (e) => this.startDrag(e.touches[0]));
    this.cropStage.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.drag(e.touches[0]);
    });
    this.cropStage.addEventListener('touchend', () => this.endDrag());

    // Lightbox
    this.lightboxClose.addEventListener('click', () => this.closeLightbox());
    this.lightboxBackdrop.addEventListener('click', () => this.closeLightbox());
    
    // ESC para cerrar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.cropper.classList.contains('hidden')) {
          this.closeCropper();
        }
        if (!this.lightbox.classList.contains('hidden')) {
          this.closeLightbox();
        }
      }
    });
  }

  async openCropper(file) {
    if (!file || file.size > 5 * 1024 * 1024) {
      alert('La imagen debe pesar menos de 5 MB');
      return;
    }

    this.currentFile = file;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      this.cropImg.src = e.target.result;
      this.cropper.classList.remove('hidden');
      this.cropper.setAttribute('aria-hidden', 'false');
      this.resetCropState();
    };

    reader.readAsDataURL(file);
  }

  closeCropper() {
    this.cropper.classList.add('hidden');
    this.cropper.setAttribute('aria-hidden', 'true');
    this.currentFile = null;
  }

  resetCropState() {
    this.scale = 1;
    this.dragState = { isDragging: false, startX: 0, startY: 0, translateX: 0, translateY: 0 };
    this.cropZoom.value = 1;
    this.updateImageTransform();
  }

  handleZoom(value) {
    this.scale = parseFloat(value);
    this.updateImageTransform();
  }

  startDrag(e) {
    this.dragState.isDragging = true;
    this.dragState.startX = e.clientX - this.dragState.translateX;
    this.dragState.startY = e.clientY - this.dragState.translateY;
    this.cropStage.style.cursor = 'grabbing';
  }

  drag(e) {
    if (!this.dragState.isDragging) return;
    
    this.dragState.translateX = e.clientX - this.dragState.startX;
    this.dragState.translateY = e.clientY - this.dragState.startY;
    this.updateImageTransform();
  }

  endDrag() {
    this.dragState.isDragging = false;
    this.cropStage.style.cursor = 'grab';
  }

  updateImageTransform() {
    const { translateX, translateY } = this.dragState;
    this.cropImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${this.scale})`;
  }

  async applyCrop() {
    const canvas = document.createElement('canvas');
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const img = this.cropImg;
    const containerRect = this.cropStage.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Calcular posición relativa
    const offsetX = (containerRect.left + containerRect.width / 2 - imgRect.left - imgRect.width / 2);
    const offsetY = (containerRect.top + containerRect.height / 2 - imgRect.top - imgRect.height / 2);

    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;
    const displayWidth = imgRect.width;
    const displayHeight = imgRect.height;

    const scaleX = imgNaturalWidth / displayWidth;
    const scaleY = imgNaturalHeight / displayHeight;

    const sourceX = (containerRect.width / 2 - offsetX) * scaleX - (size / 2) * scaleX;
    const sourceY = (containerRect.height / 2 - offsetY) * scaleY - (size / 2) * scaleY;
    const sourceSize = size * scaleX;

    ctx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, size, size
    );

    canvas.toBlob(async (blob) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (this.onImageCropped) {
          this.onImageCropped(reader.result);
        }
        this.closeCropper();
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.9);
  }

  openLightbox(imageSrc, caption = '') {
    this.lightboxImg.src = imageSrc;
    this.lightboxCap.textContent = caption;
    this.lightbox.classList.remove('hidden');
    this.lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    this.lightbox.classList.add('hidden');
    this.lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}