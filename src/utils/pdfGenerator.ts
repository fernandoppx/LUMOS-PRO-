import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/** Exporta as seções .pdf-page em A4, respeitando a altura real de cada seção. */
export async function exportElementToPdf(elementId: string, filename: string): Promise<void> {
  const container = document.getElementById(elementId);
  if (!container) throw new Error('Elemento de relatório não encontrado.');

  const pages = Array.from(container.querySelectorAll<HTMLElement>('.pdf-page'));
  const sections = pages.length ? pages : [container];
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const marginMm = 8;
  const usableWidthMm = pageWidthMm - marginMm * 2;
  const usableHeightMm = pageHeightMm - marginMm * 2;
  let firstPage = true;

  // O relatório originalmente fica a -9999px. A captura pode falhar
  // quando seu ancestral está fora do viewport; reposicionamos temporariamente.
  const original = {
    left: container.style.left,
    top: container.style.top,
    zIndex: container.style.zIndex,
    position: container.style.position,
  };

  try {
    container.style.position = 'absolute';
    container.style.left = '0px';
    container.style.top = '0px';
    container.style.zIndex = '-1';

    if (document.fonts?.ready) await document.fonts.ready;
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map(async (img) => {
      if (img.complete) return;
      await new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }));

    for (const section of sections) {
      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: Math.max(document.documentElement.clientWidth, 1000),
        width: Math.ceil(section.scrollWidth),
        height: Math.ceil(section.scrollHeight),
        scrollX: 0,
        scrollY: -window.scrollY,
      });
      if (!canvas.width || !canvas.height) throw new Error('Uma página do relatório ficou vazia.');

      // Altura da fatia em pixels, mantendo escala/razão A4 sem distorcer.
      const sliceHeightPx = Math.max(1, Math.floor(canvas.width * usableHeightMm / usableWidthMm));
      for (let y = 0; y < canvas.height; y += sliceHeightPx) {
        const heightPx = Math.min(sliceHeightPx, canvas.height - y);
        const part = document.createElement('canvas');
        part.width = canvas.width;
        part.height = heightPx;
        const ctx = part.getContext('2d');
        if (!ctx) throw new Error('Não foi possível preparar uma página do PDF.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, part.width, part.height);
        ctx.drawImage(canvas, 0, y, canvas.width, heightPx, 0, 0, canvas.width, heightPx);

        if (!firstPage) pdf.addPage();
        firstPage = false;
        const imageHeightMm = (heightPx / canvas.width) * usableWidthMm;
        pdf.addImage(part.toDataURL('image/jpeg', 0.94), 'JPEG', marginMm, marginMm, usableWidthMm, imageHeightMm);
        // Frees memory earlier on large reports.
        part.width = 0;
        part.height = 0;
      }
      canvas.width = 0;
      canvas.height = 0;
    }
    pdf.save(filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`);
  } finally {
    container.style.left = original.left;
    container.style.top = original.top;
    container.style.zIndex = original.zIndex;
    container.style.position = original.position;
  }
}
