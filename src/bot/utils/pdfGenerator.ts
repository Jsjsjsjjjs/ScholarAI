import { jsPDF } from 'jspdf';

export async function generateTextPdf(title: string, rawText: string): Promise<Buffer> {
  // Uses jspdf exactly like the frontend uses jspdf, but for raw text since we're Server-Side Node
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 295;
  const margin = 15;
  const maxLineWidth = pageWidth - margin * 2;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const splitTitle = doc.splitTextToSize(title, maxLineWidth);
  doc.text(splitTitle, margin, margin + 5);
  
  let cursorY = margin + 5 + (splitTitle.length * 7) + 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const textLines = doc.splitTextToSize(rawText, maxLineWidth);
  
  for (let i = 0; i < textLines.length; i++) {
    if (cursorY > pageHeight - margin) {
      doc.addPage();
      cursorY = margin + 5;
    }
    doc.text(textLines[i], margin, cursorY);
    cursorY += 5; // line height
  }
  
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
