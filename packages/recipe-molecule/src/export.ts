/**
 * Export Utilities
 *
 * Functions for exporting molecule visualizations as PNG or SVG
 * Browser-side implementation using canvas
 */

import { ExportError } from './core/validation';

// ═══════════════════════════════════════════════════════════════
// EXPORT OPTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Options for PNG export
 */
export interface PNGExportOptions {
  /** Scale factor for output (default: 2 for retina) */
  scale?: number;
  /** Background color (default: '#fafafa', use 'transparent' for none) */
  backgroundColor?: string | 'transparent';
  /** Override output width in pixels */
  width?: number;
  /** Override output height in pixels */
  height?: number;
  /** PNG quality 0-1 (default: 1.0) */
  quality?: number;
}

/**
 * Options for SVG export
 */
export interface SVGExportOptions {
  /** Whether to inline CSS styles (default: true for standalone SVG) */
  inlineStyles?: boolean;
  /** Override width attribute */
  width?: number | string;
  /** Override height attribute */
  height?: number | string;
}

const DEFAULT_PNG_OPTIONS: Required<Omit<PNGExportOptions, 'width' | 'height'>> = {
  scale: 2,
  backgroundColor: '#fafafa',
  quality: 1.0,
};

const DEFAULT_SVG_OPTIONS: Required<Omit<SVGExportOptions, 'width' | 'height'>> = {
  inlineStyles: true,
};

// ═══════════════════════════════════════════════════════════════
// SVG EXPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Export molecule as SVG file
 *
 * @param svgElement - The SVG element to export
 * @param filename - Output filename (default: 'recipe-molecule.svg')
 * @param options - Export options for customization
 *
 * @example
 * ```typescript
 * exportSVG(svgRef.current, 'daiquiri.svg', {
 *   inlineStyles: true,
 *   width: 800,
 *   height: 600,
 * });
 * ```
 */
export function exportSVG(
  svgElement: SVGSVGElement,
  filename: string = 'recipe-molecule.svg',
  options: SVGExportOptions = {}
): void {
  const opts = { ...DEFAULT_SVG_OPTIONS, ...options };

  // Clone the SVG to avoid modifying the original
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Add necessary namespaces
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Apply dimension overrides
  if (opts.width !== undefined) {
    clone.setAttribute('width', String(opts.width));
  }
  if (opts.height !== undefined) {
    clone.setAttribute('height', String(opts.height));
  }

  // Inline styles for standalone SVG
  if (opts.inlineStyles) {
    inlineStyles(clone);
  }

  // Serialize to string
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  // Create blob and download
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Get SVG as string (for server-side processing)
 *
 * @param svgElement - The SVG element to serialize
 * @param options - Export options for customization
 * @returns SVG string with inlined styles
 */
export function getSVGString(
  svgElement: SVGSVGElement,
  options: SVGExportOptions = {}
): string {
  const opts = { ...DEFAULT_SVG_OPTIONS, ...options };

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  if (opts.width !== undefined) {
    clone.setAttribute('width', String(opts.width));
  }
  if (opts.height !== undefined) {
    clone.setAttribute('height', String(opts.height));
  }

  if (opts.inlineStyles) {
    inlineStyles(clone);
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

// ═══════════════════════════════════════════════════════════════
// PNG EXPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Export molecule as PNG file
 *
 * @param svgElement - The SVG element to export
 * @param filename - Output filename (default: 'recipe-molecule.png')
 * @param options - Export options for customization
 *
 * @example
 * ```typescript
 * // High-res export with transparent background
 * await exportPNG(svgRef.current, 'daiquiri.png', {
 *   scale: 4,
 *   backgroundColor: 'transparent',
 * });
 *
 * // Custom dimensions
 * await exportPNG(svgRef.current, 'daiquiri.png', {
 *   width: 1200,
 *   height: 900,
 * });
 * ```
 */
export async function exportPNG(
  svgElement: SVGSVGElement,
  filename: string = 'recipe-molecule.png',
  options: PNGExportOptions = {}
): Promise<void> {
  const pngBlob = await svgToPNG(svgElement, options);
  downloadBlob(pngBlob, filename);
}

/**
 * Convert SVG to PNG blob
 *
 * @param svgElement - The SVG element to convert
 * @param options - Export options for customization
 * @returns PNG blob
 * @throws ExportError if canvas context fails or blob creation fails
 */
export async function svgToPNG(
  svgElement: SVGSVGElement,
  options: PNGExportOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_PNG_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // Get SVG dimensions from viewBox or element
    const viewBoxWidth = svgElement.viewBox.baseVal.width || svgElement.clientWidth || 520;
    const viewBoxHeight = svgElement.viewBox.baseVal.height || svgElement.clientHeight || 420;

    // Use custom dimensions or viewBox dimensions
    const width = opts.width ?? viewBoxWidth;
    const height = opts.height ?? viewBoxHeight;

    // Clone and prepare SVG
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Update viewBox if dimensions changed
    if (opts.width || opts.height) {
      clone.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
    }

    inlineStyles(clone);

    // Serialize SVG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Create image
    const img = new Image();
    img.onload = () => {
      // Create canvas with scale
      const canvas = document.createElement('canvas');
      canvas.width = width * opts.scale;
      canvas.height = height * opts.scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new ExportError('Failed to get canvas context', { width, height, scale: opts.scale }));
        return;
      }

      // Fill background (skip if transparent)
      if (opts.backgroundColor !== 'transparent') {
        ctx.fillStyle = opts.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Scale and draw
      ctx.scale(opts.scale, opts.scale);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new ExportError('Failed to create PNG blob', { width, height }));
          }
        },
        'image/png',
        opts.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ExportError('Failed to load SVG image for PNG conversion'));
    };

    img.src = url;
  });
}

/**
 * Get PNG as data URL (base64 encoded)
 *
 * @param svgElement - The SVG element to convert
 * @param options - Export options for customization
 * @returns Data URL string (data:image/png;base64,...)
 *
 * @example
 * ```typescript
 * const dataUrl = await getPNGDataURL(svgRef.current, { scale: 3 });
 * // Use in <img src={dataUrl} /> or for clipboard
 * ```
 */
export async function getPNGDataURL(
  svgElement: SVGSVGElement,
  options: PNGExportOptions = {}
): Promise<string> {
  const blob = await svgToPNG(svgElement, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ExportError('Failed to read PNG blob as data URL'));
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
