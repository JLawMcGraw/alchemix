/**
 * Export Utilities
 *
 * Functions for exporting molecule visualizations as PNG or SVG
 * Browser-side implementation using canvas
 */

import type { MoleculeRecipe } from './core/types';

// ═══════════════════════════════════════════════════════════════
// SVG EXPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Export molecule as SVG file
 */
export function exportSVG(
  svgElement: SVGSVGElement,
  filename: string = 'recipe-molecule.svg'
): void {
  // Clone the SVG to avoid modifying the original
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Add necessary namespaces
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Inline styles for standalone SVG
  inlineStyles(clone);

  // Serialize to string
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  // Create blob and download
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Get SVG as string (for server-side processing)
 */
export function getSVGString(svgElement: SVGSVGElement): string {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  inlineStyles(clone);

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

// ═══════════════════════════════════════════════════════════════
// PNG EXPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Export molecule as PNG file
 */
export async function exportPNG(
  svgElement: SVGSVGElement,
  filename: string = 'recipe-molecule.png',
  scale: number = 2 // 2x for retina
): Promise<void> {
  const pngBlob = await svgToPNG(svgElement, scale);
  downloadBlob(pngBlob, filename);
}

/**
 * Convert SVG to PNG blob
 */
export async function svgToPNG(
  svgElement: SVGSVGElement,
  scale: number = 2
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Get SVG dimensions
    const width = svgElement.viewBox.baseVal.width || svgElement.clientWidth || 520;
    const height = svgElement.viewBox.baseVal.height || svgElement.clientHeight || 420;

    // Clone and prepare SVG
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    inlineStyles(clone);

    // Serialize SVG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Create image
    const img = new Image();
    img.onload = () => {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Fill background (optional: white background)
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scale and draw
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        },
        'image/png',
        1.0
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };

    img.src = url;
  });
}

/**
 * Get PNG as data URL
 */
export async function getPNGDataURL(
  svgElement: SVGSVGElement,
  scale: number = 2
): Promise<string> {
  const blob = await svgToPNG(svgElement, scale);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Inline CSS styles into SVG elements
 * Required for standalone SVG/PNG export
 */
function inlineStyles(svg: SVGSVGElement): void {
  const styleMap: Record<string, Record<string, string>> = {
    // Backbone
    'polygon': {
      'fill': 'none',
      'stroke': '#333',
      'stroke-width': '1.5',
      'opacity': '0.25',
    },
    // Bonds
    'line': {
      'stroke': '#333',
      'stroke-width': '2',
      'fill': 'none',
    },
    // Node circles - don't override fill (set per-element)
    'circle': {
      'opacity': '0.85',
    },
    // Labels
    'text': {
      'font-family': "'Segoe UI', system-ui, -apple-system, sans-serif",
      'fill': '#333',
      'text-anchor': 'middle',
    },
  };

  // Apply styles
  Object.entries(styleMap).forEach(([selector, styles]) => {
    const elements = svg.querySelectorAll(selector);
    elements.forEach((el) => {
      Object.entries(styles).forEach(([prop, value]) => {
        // Don't override existing fill on circles
        if (prop === 'fill' && el.getAttribute('fill')) return;
        (el as SVGElement).style.setProperty(prop, value);
      });
    });
  });

  // Handle label vs sublabel text sizing
  const texts = svg.querySelectorAll('text');
  texts.forEach((text, index) => {
    const y = parseFloat(text.getAttribute('y') || '0');
    const parentG = text.closest('g');

    if (parentG) {
      const circle = parentG.querySelector('circle');
      if (circle) {
        const cy = parseFloat(circle.getAttribute('cy') || '0');
        // Sublabel is below center, main label is above/at center
        if (y > cy + 5) {
          text.style.fontSize = '9px';
          text.style.fontWeight = '400';
          text.style.fill = '#666';
        } else {
          text.style.fontSize = '12px';
          text.style.fontWeight = '600';
        }
      }
    }
  });

  // Handle dashed bonds
  const lines = svg.querySelectorAll('line');
  lines.forEach((line) => {
    const dashArray = line.getAttribute('stroke-dasharray') ||
      window.getComputedStyle(line).strokeDasharray;
    if (dashArray && dashArray !== 'none') {
      line.style.strokeDasharray = '6, 4';
    }
  });
}

/**
 * Trigger file download from blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
