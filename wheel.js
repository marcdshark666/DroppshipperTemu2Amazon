/* ==========================================================================
   MEDICINSKT SNURRHJUL - CANVAS ENGINE (WHEEL.JS)
   ========================================================================== */

class MedicalWheel {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.items = [];
    this.currentAngle = 0;
    this.isSpinning = false;
    this.showTitles = false; // Default: FALSE (visar ENDAST siffror)
    
    // Audio synthesizer context using Web Audio API
    this.audioCtx = null;
    
    // Color palette for slices
    this.sliceColors = [
      '#6366f1', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', 
      '#06b6d4', '#f59e0b', '#f43f5e', '#14b8a6', '#a855f7'
    ];
    
    this.initCanvas();
    window.addEventListener('resize', () => this.initCanvas());
    window.addEventListener('orientationchange', () => setTimeout(() => this.initCanvas(), 200));
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playTickSound() {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.04);
      
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.04);
      
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {
      // Audio fallback silent
    }
  }

  playFanfareSound() {
    if (!this.audioCtx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + i * 0.08);
        
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + i * 0.08 + 0.3);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(this.audioCtx.currentTime + i * 0.08);
        osc.stop(this.audioCtx.currentTime + i * 0.08 + 0.35);
      });
    } catch (e) {}
  }

  initCanvas() {
    const parent = this.canvas.parentElement;
    const parentWidth = parent ? (parent.clientWidth || parent.getBoundingClientRect().width) : 320;
    // Calculate canvas size relative to parent bounds, capped between 220px and 460px
    const size = Math.max(Math.min(parentWidth - 12, 460), 220);
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    
    this.ctx.scale(dpr, dpr);
    this.size = size;
    this.radius = size / 2;
    
    this.draw();
  }

  setItems(items) {
    this.items = items;
    this.draw();
  }

  setShowTitles(show) {
    this.showTitles = show;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const size = this.size;
    const center = size / 2;
    const radius = this.radius;
    const numItems = this.items.length;

    ctx.clearRect(0, 0, size, size);

    if (numItems === 0) {
      // Empty state wheel
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(center, center, radius - 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Inga fall valda', center, center);
      ctx.restore();
      return;
    }

    const sliceAngle = (Math.PI * 2) / numItems;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.currentAngle);

    for (let i = 0; i < numItems; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const item = this.items[i];
      const color = this.sliceColors[i % this.sliceColors.length];

      // Draw Slice
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 6, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Outer Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text Label (ONLY NUMBER by default unless showTitles = true)
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      
      const label = this.showTitles 
        ? (item.title.length > 16 ? item.title.substring(0, 14) + '..' : item.title)
        : (item.number ? `#${item.number}` : `#${item.rowIndex}`);

      ctx.font = this.showTitles ? 'bold 12px Inter' : 'bold 16px Inter';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(label, radius - 24, 5);
      ctx.restore();
    }

    ctx.restore();
  }

  spin(onComplete) {
    if (this.isSpinning || this.items.length === 0) return;
    this.initAudio();
    this.isSpinning = true;

    // Pick random winning slice index
    const winningIndex = Math.floor(Math.random() * this.items.length);
    const sliceAngle = (Math.PI * 2) / this.items.length;

    // Calculate total rotation
    // Pointer is at TOP (angle -PI/2)
    const extraTurns = 5 + Math.floor(Math.random() * 3);
    const targetSliceAngle = (this.items.length - winningIndex - 0.5) * sliceAngle - Math.PI / 2;
    
    // Normalize current angle
    const startAngle = this.currentAngle;
    const finalAngle = startAngle + (extraTurns * Math.PI * 2) + (targetSliceAngle - (startAngle % (Math.PI * 2)));

    const duration = 4000; // 4 seconds spin
    const startTime = performance.now();
    let lastSliceIdx = -1;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Quartic Ease-Out
      const easeOut = 1 - Math.pow(1 - progress, 4);
      this.currentAngle = startAngle + (finalAngle - startAngle) * easeOut;

      // Play tick audio on slice change
      const currentSliceIdx = Math.floor((((this.currentAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / sliceAngle);
      if (currentSliceIdx !== lastSliceIdx) {
        this.playTickSound();
        lastSliceIdx = currentSliceIdx;
      }

      this.draw();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isSpinning = false;
        this.playFanfareSound();
        const winner = this.items[winningIndex];
        if (onComplete) onComplete(winner);
      }
    };

    requestAnimationFrame(animate);
  }
}
