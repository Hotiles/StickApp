/*
 * Delningskort: ett färdigt projekt som snygg bild (1080×1350) att
 * skicka till syrran — foto, garn, stickor, svårighetsgrad och en
 * liten Stickan-signatur. Allt renderas lokalt på canvas.
 */
const W = 1080;
const H = 1350;
const M = 64; // marginal

export async function generateShareCard(project, photoBlob, colorValue) {
  // Se till att Fraunces är inläst innan canvasen mäter text
  try {
    await document.fonts.load('600 72px Fraunces');
  } catch {
    /* systemserif duger */
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Varm bakgrund + färgband i projektets ton
  ctx.fillStyle = '#faf6f2';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = colorValue;
  ctx.fillRect(0, 0, W, 18);

  const photoH = 780;
  if (photoBlob) {
    const img = await blobToImage(photoBlob);
    drawCover(ctx, img, M, M, W - 2 * M, photoH, 36);
  } else {
    // Utan foto: mjuk platta i projektfärgen med ett garnnystan
    roundRect(ctx, M, M, W - 2 * M, photoH, 36);
    ctx.fillStyle = mixWithWhite(colorValue, 0.82);
    ctx.fill();
    drawYarnBall(ctx, W / 2, M + photoH / 2, 190, colorValue);
  }

  // Projektnamn — krymp tills det ryms
  ctx.fillStyle = '#3d3436';
  ctx.textBaseline = 'alphabetic';
  let size = 76;
  do {
    ctx.font = `600 ${size}px Fraunces, Georgia, serif`;
    size -= 4;
  } while (ctx.measureText(project.name).width > W - 2 * M && size > 32);
  ctx.fillText(project.name, M, M + photoH + 118);

  // Detaljrader
  const rows = [
    ['Garn', project.yarn],
    ['Stickor', project.needleSize],
    ['Storlek', project.madeSize],
    ['Garnåtgång', project.yarnAmount],
  ].filter(([, v]) => v);

  let y = M + photoH + 196;
  for (const [label, value] of rows.slice(0, 4)) {
    ctx.font = '650 30px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#8a7f82';
    ctx.fillText(label.toUpperCase(), M, y);
    ctx.font = '400 36px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#3d3436';
    ctx.fillText(truncate(ctx, String(value), W - 2 * M - 260), M + 260, y);
    y += 62;
  }

  // Svårighetsgrad som prickar
  if (project.difficulty) {
    ctx.font = '650 30px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#8a7f82';
    ctx.fillText('SVÅRIGHET', M, y);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(M + 260 + 24 + i * 56, y - 12, 16, 0, Math.PI * 2);
      ctx.fillStyle = i < project.difficulty ? colorValue : '#eadfd6';
      ctx.fill();
    }
    y += 62;
  }

  // Signatur
  ctx.font = '600 32px Fraunces, Georgia, serif';
  ctx.fillStyle = colorValue;
  const sig = 'Stickad med kärlek · Stickan 🧶';
  ctx.fillText(sig, M, H - 56);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Kunde inte skapa delningskortet.');
  return blob;
}

/** Delar kortet via delningsarket, annars laddas det ner. */
export async function shareOrDownload(blob, fileName) {
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      /* faller vidare till nedladdning */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

// ---------- Ritverktyg ----------

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Kunde inte läsa fotot.'));
    };
    img.src = url;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function drawYarnBall(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = '#faf6f2';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 7;
  for (const t of [-0.45, 0, 0.45]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.92, r * (0.35 + Math.abs(t) * 0.5), t, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function mixWithWhite(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}
