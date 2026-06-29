/**
 * Dev-only fidelity gate: pins a reference still beside the live game so each
 * iteration is measured against the source, not memory.
 *
 * Mounted only when DEV and the URL has `?compare=<stillName>` (see main.ts).
 * The still is loaded from the gitignored, dev-served `reference/stills/` folder
 * and is NEVER bundled or shipped.
 */
export function mountCompareView(stillName: string): void {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;left:8px;top:8px;z-index:9998;background:rgba(13,13,13,0.85);' +
    'padding:6px;border:1px solid #2a3a3a;border-radius:5px;font:11px monospace;color:#9bb;';

  const cap = document.createElement('div');
  cap.textContent = `◆ reference (study-only): ${stillName}`;
  cap.style.cssText = 'margin-bottom:4px;';

  const img = document.createElement('img');
  img.src = `/reference/stills/${stillName}`;
  img.style.cssText = 'display:block;width:440px;max-width:42vw;border:1px solid #000;';
  img.onerror = () => {
    cap.textContent = `reference not found: /reference/stills/${stillName}`;
  };

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;';
  const label = document.createElement('span');
  label.textContent = 'opacity';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '15';
  slider.max = '100';
  slider.value = '100';
  slider.oninput = () => {
    img.style.opacity = String(Number(slider.value) / 100);
  };
  row.append(label, slider);

  box.append(cap, img, row);
  document.body.append(box);
}
