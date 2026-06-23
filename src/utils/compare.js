// ---------------------------------------------------------------------------
// compare.js — Split-Screen-Vergleich zweier Render-Modi.
//
// Der Bildschirm wird über einen verschiebbaren Trenner (Wischer) in zwei
// Hälften geteilt. Links und rechts wird jeweils ein Modus gerendert; per
// Scissor-Test begrenzen wir die Ausgabe auf die jeweilige Hälfte. So lässt
// sich z. B. Raytracing (keine indirekte Beleuchtung) direkt neben Radiosity
// (Color Bleeding) stellen.
// ---------------------------------------------------------------------------

export function createCompare(renderer) {
  let split = 0.5; // Bruchteil [0,1] der Trennlinie

  // verschiebbarer Trenn-Handle (DOM)
  const handle = document.createElement('div');
  Object.assign(handle.style, {
    position: 'fixed',
    top: '0',
    left: '50%',
    width: '3px',
    height: '100%',
    background: 'rgba(255,255,255,0.8)',
    cursor: 'ew-resize',
    transform: 'translateX(-1.5px)',
    zIndex: '20',
    display: 'none',
    boxShadow: '0 0 6px rgba(0,0,0,0.6)',
  });
  // breitere, unsichtbare Greiffläche
  const grip = document.createElement('div');
  Object.assign(grip.style, {
    position: 'absolute',
    top: '0',
    left: '-9px',
    width: '21px',
    height: '100%',
  });
  handle.appendChild(grip);
  document.body.appendChild(handle);

  let dragging = false;
  const onMove = (clientX) => {
    split = Math.min(0.98, Math.max(0.02, clientX / window.innerWidth));
    handle.style.left = split * 100 + '%';
  };
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });
  handle.addEventListener('pointermove', (e) => {
    if (dragging) onMove(e.clientX);
  });
  handle.addEventListener('pointerup', (e) => {
    dragging = false;
    handle.releasePointerCapture(e.pointerId);
  });

  return {
    setVisible(v) {
      handle.style.display = v ? 'block' : 'none';
    },
    /**
     * Rendert renderLeft() in die linke, renderRight() in die rechte Hälfte.
     * w/h sind die CSS-Pixel-Maße des Canvas.
     */
    renderSplit(w, h, renderLeft, renderRight) {
      const sx = Math.floor(w * split);
      renderer.setViewport(0, 0, w, h);
      renderer.setScissorTest(true);

      renderer.setScissor(0, 0, sx, h); // linke Hälfte
      renderLeft();

      renderer.setScissor(sx, 0, w - sx, h); // rechte Hälfte
      renderRight();

      renderer.setScissorTest(false);
      handle.style.left = split * 100 + '%';
    },
  };
}
