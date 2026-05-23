import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const colorCache = new Map<string, string>();
let tempCanvasCtx: CanvasRenderingContext2D | null = null;

/**
 * Converts any CSS color string (including OKLCH/OKLAB) to standard RGB/RGBA using native browser canvas parsing
 */
function convertCssColorToRgb(colorStr: string): string {
  if (!colorStr) return colorStr;
  
  if (colorCache.has(colorStr)) {
    return colorCache.get(colorStr)!;
  }
  
  if (!colorStr.includes('oklch') && !colorStr.includes('oklab')) {
    return colorStr;
  }
  
  try {
    if (!tempCanvasCtx) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      tempCanvasCtx = canvas.getContext('2d', { willReadFrequently: true });
    }
    
    if (tempCanvasCtx) {
      tempCanvasCtx.clearRect(0, 0, 1, 1);
      tempCanvasCtx.fillStyle = colorStr;
      tempCanvasCtx.fillRect(0, 0, 1, 1);
      const data = tempCanvasCtx.getImageData(0, 0, 1, 1).data;
      const r = data[0];
      const g = data[1];
      const b = data[2];
      const a = Number((data[3] / 255).toFixed(3));
      
      const converted = a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
      colorCache.set(colorStr, converted);
      return converted;
    }
  } catch (e) {
    console.error("Failed to convert color using canvas:", colorStr, e);
  }
  
  return 'rgba(0,0,0,0)';
}

/**
 * Replaces all oklch and oklab references in a CSS string with compatible RGB/RGBA equivalents
 */
function replaceOklchAndOklab(cssValue: string): string {
  if (typeof cssValue !== 'string') return cssValue;
  if (!cssValue.includes('oklch') && !cssValue.includes('oklab')) return cssValue;

  return cssValue.replace(/(oklch|oklab)\([^)]+\)/gi, (match) => {
    return convertCssColorToRgb(match);
  });
}

/**
 * Recursively sanitizes all rules inside a stylesheet grouping limitlessly
 */
function sanitizeRules(rules: CSSRuleList) {
  for (let r = 0; r < rules.length; r++) {
    const rule = rules[r];
    if (rule instanceof CSSStyleRule) {
      const cssText = rule.style.cssText;
      if (cssText.includes('oklch') || cssText.includes('oklab')) {
        for (let p = 0; p < rule.style.length; p++) {
          const propName = rule.style[p];
          const propValue = rule.style.getPropertyValue(propName);
          if (propValue.includes('oklch') || propValue.includes('oklab')) {
            rule.style.setProperty(propName, replaceOklchAndOklab(propValue));
          }
        }
      }
    } else if (rule && 'cssRules' in rule) {
      try {
        sanitizeRules((rule as any).cssRules);
      } catch (innerE) {
        // Safe check
      }
    }
  }
}

/**
 * Sanitizes a cloned document's stylesheets, inline styles, and computed overrides to replace oklch/oklab formulas with rgb/rgba.
 */
const sanitizeHtml2CanvasClone = (clonedDoc: Document) => {
  // 1. Sanitize stylesheets to safely parse v4 colors
  for (let s = 0; s < clonedDoc.styleSheets.length; s++) {
    const sheet = clonedDoc.styleSheets[s];
    try {
      if (sheet.cssRules) {
        sanitizeRules(sheet.cssRules);
      }
    } catch (e) {
      // Ignore cross-origin stylesheet reading exceptions
    }
  }

  // 2. Sanitize elements with inline styling and color attributes (fill/stroke)
  const elements = clonedDoc.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i] as HTMLElement;
    if (element.style) {
      const inlineStyle = element.getAttribute('style');
      if (inlineStyle && (inlineStyle.includes('oklch') || inlineStyle.includes('oklab'))) {
        element.setAttribute('style', replaceOklchAndOklab(inlineStyle));
      }
    }

    // Handle standard/vector properties
    const fillValue = element.getAttribute('fill');
    if (fillValue && (fillValue.includes('oklch') || fillValue.includes('oklab'))) {
      element.setAttribute('fill', replaceOklchAndOklab(fillValue));
    }

    const strokeValue = element.getAttribute('stroke');
    if (strokeValue && (strokeValue.includes('oklch') || strokeValue.includes('oklab'))) {
      element.setAttribute('stroke', replaceOklchAndOklab(strokeValue));
    }
  }

  // 3. Intercept getComputedStyle during html2canvas crawling
  const clonedWindow = clonedDoc.defaultView;
  if (clonedWindow) {
    clonedWindow.getComputedStyle = wrapGetComputedStyle(clonedWindow.getComputedStyle);
  }
};

/**
 * Creates a wrapping proxy around window.getComputedStyle to intercept element color evaluations
 */
function wrapGetComputedStyle(originalGetComputedStyle: (elt: Element, pseudoElt?: string | null) => CSSStyleDeclaration) {
  return function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function(propertyName: string) {
            const originalValue = target.getPropertyValue(propertyName);
            if (typeof originalValue === 'string') {
              return replaceOklchAndOklab(originalValue);
            }
            return originalValue;
          };
        }
        
        const val = target[prop as keyof CSSStyleDeclaration];
        if (typeof val === 'string') {
          if (val.includes('oklch') || val.includes('oklab')) {
            return replaceOklchAndOklab(val);
          }
        }
        if (typeof val === 'function') {
          return (val as Function).bind(target);
        }
        return val;
      }
    }) as any;
  };
}

/**
 * Capture an HTML Element and render it to a high-fidelity PDF Blob
 */
export async function elementToPdfBlob(element: HTMLElement): Promise<Blob | null> {
  const originalGetComputedStyle = window.getComputedStyle;
  try {
    // Intercept main frame global computed style reads during capture
    window.getComputedStyle = wrapGetComputedStyle(originalGetComputedStyle);

    // Keep temporary alterations or styling clean
    const canvas = await html2canvas(element, {
      scale: 2, // high res density
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: sanitizeHtml2CanvasClone,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210; // A4 standard width in mm
    const pageHeight = 295; // A4 standard height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Draw first page
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;

    // Handle multi-page documents seamlessly
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;
    }

    return pdf.output("blob");
  } catch (error) {
    console.error("PDF Blob compilation failed:", error);
    return null;
  } finally {
    // Safely restore global context
    window.getComputedStyle = originalGetComputedStyle;
  }
}

/**
 * Capture an HTML Element and render it to a PNG Image Blob
 */
export async function elementToImageBlob(element: HTMLElement): Promise<Blob | null> {
  const originalGetComputedStyle = window.getComputedStyle;
  try {
    // Intercept main frame global computed style reads during capture
    window.getComputedStyle = wrapGetComputedStyle(originalGetComputedStyle);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#171717", // Matches dark theme container
      logging: false,
      onclone: sanitizeHtml2CanvasClone,
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    });
  } catch (error) {
    console.error("Image capture compilation failed:", error);
    return null;
  } finally {
    // Safely restore global context
    window.getComputedStyle = originalGetComputedStyle;
  }
}

/**
 * Send a payload and file to a Discord Webhook
 */
export async function sendToDiscordWebhook({
  webhookUrl,
  payload,
  fileBlob,
  filename = "attachment.pdf",
  fileBlob2,
  filename2,
}: {
  webhookUrl: string;
  payload: {
    content?: string;
    embeds?: Array<any>;
  };
  fileBlob?: Blob | null;
  filename?: string;
  fileBlob2?: Blob | null;
  filename2?: string;
}): Promise<boolean> {
  if (!webhookUrl || !webhookUrl.startsWith("https://discord")) {
    console.warn("Invalid or missing Discord Webhook URL. Action aborted silently.");
    return false;
  }

  try {
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify(payload));

    if (fileBlob) {
      formData.append("files[0]", fileBlob, filename);
    }
    if (fileBlob2) {
      formData.append("files[1]", fileBlob2, filename2);
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const respText = await response.text();
      console.error(`Discord API returned status error ${response.status}:`, respText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Transmission error sending data to Discord Hook:", error);
    return false;
  }
}
