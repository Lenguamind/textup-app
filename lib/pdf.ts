import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface PdfContentItem {
  type: 'title' | 'subtitle' | 'author' | 'text' | 'list' | 'score' | 'grid' | 'image' | 'comic_grid';
  text?: string;
  items?: string[];
  scores?: Record<string, number>;
  grid?: { label: string; value: string | number }[];
  src?: string;
  panels?: { image: string; dialogue: string }[];
}

export interface PdfOptions {
  title: string;
  author?: string;
  content: PdfContentItem[] | string;
  filename?: string;
  labels?: {
    authorPrefix?: string;
    scoresTitle?: string;
    imageError?: string;
    generatedOn?: string;
    pageLabel?: string;
    ofLabel?: string;
    shareTextPrefix?: string;
    shareDialogTitle?: string;
  };
}

export interface ModernCorrectionPdfOptions {
  correctedText: string;
  improvedText: string;
  scores?: Record<string, number>;
  scoreExplanations?: Record<string, string>;
  globalScore?: number | string;
  filename?: string;
  author?: string;
  feedback?: string;
  maxScore?: number;
  scoreComment?: string;
  labels?: {
    title?: string;
    authorPrefix?: string;
    globalScorePrefix?: string;
    originalText?: string;
    improvedText?: string;
    improvedBadge?: string;
    teacherFeedback?: string;
    generatedOn?: string;
    shareTitle?: string;
    shareText?: string;
    shareDialogTitle?: string;
  };
}

export const generateModernCorrectionPdf = async ({ 
  correctedText, 
  improvedText, 
  scores, 
  scoreExplanations,
  globalScore, 
  filename, 
  author, 
  feedback, 
  maxScore = 10,
  scoreComment,
  labels = {} 
}: ModernCorrectionPdfOptions) => {
  try {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxLineWidth = pageWidth - (margin * 2) - 10; // Extra padding inside cards
    let y = 10;

    // Background color (very light gray)
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Header Logo Textup!
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('TEXTUP!', pageWidth / 2, y, { align: 'center' });

    // Date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(new Date().toLocaleDateString(), pageWidth - margin, y, { align: 'right' });
    
    y += 6;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(labels.title || 'CORRECCIÓ AMB IA', pageWidth / 2, y, { align: 'center' });
    y += 6;

    if (author) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`${labels.authorPrefix || 'Autor/a:'} ${author}`, pageWidth / 2, y, { align: 'center' });
      y += 6;
    } else {
      y += 2;
    }

    // Calculate scores height
    let scoresHeight = 0;
    const scoreEntries = scores ? Object.entries(scores) : [];
    const scoreExplanationLines: { key: string; val: number; text: string[]; height: number }[] = [];

    if (globalScore !== undefined || scoreEntries.length > 0) {
      scoresHeight = 10; // Top padding
      if (globalScore !== undefined) scoresHeight += 8;
      
      if (scoreEntries.length > 0) {
        if (scoreExplanations && Object.keys(scoreExplanations).length > 0) {
          doc.setFontSize(8);
          scoreEntries.forEach(([key, val]) => {
             const expKey = Object.keys(scoreExplanations || {}).find(k => key.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(key.toLowerCase()));
             const explanation = (scoreExplanations && expKey) ? scoreExplanations[expKey] : '';
             const textStr = `${key} (${val}/${maxScore}): ${explanation}`;
             const split = doc.splitTextToSize(textStr, maxLineWidth);
             scoreExplanationLines.push({ key, val, text: split, height: split.length * 4 });
             scoresHeight += split.length * 4 + 2;
          });
        } else {
          const rows = Math.ceil(scoreEntries.length / 3);
          scoresHeight += rows * 6;
        }
      }
      if (scoreComment) {
        scoresHeight += 6;
      }
      scoresHeight += 5; // Bottom padding
    }

    // Calculate font size to fit on one page
    let fontSize = 10;
    let lineHeight = 5;
    
    // Test fit
    doc.setFontSize(fontSize);
    let splitText1 = doc.splitTextToSize(correctedText, maxLineWidth);
    let splitText2 = doc.splitTextToSize(improvedText, maxLineWidth);
    let splitFeedback = feedback ? doc.splitTextToSize(feedback, maxLineWidth) : [];
    
    let totalNeededHeight = y + (scoresHeight > 0 ? scoresHeight + 10 : 0) + (splitText1.length * lineHeight + 25 + 10) + (splitText2.length * lineHeight + 25 + 10) + (feedback ? splitFeedback.length * lineHeight + 25 + 10 : 0) + 20;
    
    while (totalNeededHeight > pageHeight && fontSize > 6) {
      fontSize -= 0.5;
      lineHeight = fontSize * 0.5;
      doc.setFontSize(fontSize);
      splitText1 = doc.splitTextToSize(correctedText, maxLineWidth);
      splitText2 = doc.splitTextToSize(improvedText, maxLineWidth);
      splitFeedback = feedback ? doc.splitTextToSize(feedback, maxLineWidth) : [];
      totalNeededHeight = y + (scoresHeight > 0 ? scoresHeight + 10 : 0) + (splitText1.length * lineHeight + 25 + 10) + (splitText2.length * lineHeight + 25 + 10) + (feedback ? splitFeedback.length * lineHeight + 25 + 10 : 0) + 20;
    }

    // Draw Scores Card
    if (scoresHeight > 0) {
      // Shadow
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin + 1, y + 1, pageWidth - margin * 2, scoresHeight, 4, 4, 'F');
      
      // Background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, pageWidth - margin * 2, scoresHeight, 4, 4, 'FD');

      let currentY = y + 8;
      if (globalScore !== undefined) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${labels.globalScorePrefix || 'NOTA GLOBAL'}: ${globalScore}/10`, margin + 5, currentY);
        currentY += 8;
      }

      if (scoreEntries.length > 0) {
        if (scoreExplanations && scoreExplanationLines.length > 0) {
           doc.setFontSize(8);
           doc.setTextColor(71, 85, 105);
           scoreExplanationLines.forEach(item => {
              doc.setFont('helvetica', 'normal');
              doc.text(item.text, margin + 5, currentY);
              currentY += item.height + 2;
           });
           
           if (scoreComment) {
              doc.setFontSize(7);
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(148, 163, 184);
              doc.text(scoreComment, margin + 5, currentY);
           }
        } else {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          const colWidth = (pageWidth - margin * 2 - 10) / 3;
          scoreEntries.forEach(([key, val], index) => {
            const col = index % 3;
            const row = Math.floor(index / 3);
            const xPos = margin + 5 + (col * colWidth);
            const yPos = currentY + (row * 6);
            doc.text(`${key}: ${val}/${maxScore}`, xPos, yPos);
          });
          
          if (scoreComment) {
            const finalRow = Math.ceil(scoreEntries.length / 3);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(148, 163, 184);
            doc.text(scoreComment, margin + 5, currentY + (finalRow * 6));
          }
        }
      }
      y += scoresHeight + 10;
    }

    // Helper to draw a card
    const drawCard = (title: string, text: string[], badge?: string) => {
      const textHeight = text.length * lineHeight;
      const cardHeight = textHeight + 25;

      // Card shadow
      doc.setFillColor(226, 232, 240); // slate-200
      doc.roundedRect(margin + 1, y + 1, pageWidth - margin * 2, cardHeight, 4, 4, 'F');

      // Card background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, pageWidth - margin * 2, cardHeight, 4, 4, 'FD');

      // Card Header
      const currentX = margin + 5;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105); // slate-500
      doc.text(title, currentX, y + 8);

      if (badge) {
        const badgeWidth = 22;
        const badgeX = pageWidth - margin - 5 - badgeWidth;
        doc.setFillColor(220, 252, 231); // green-100
        doc.roundedRect(badgeX, y + 4, badgeWidth, 6, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74); // green-600
        doc.text(badge, badgeX + badgeWidth / 2, y + 8, { align: 'center' });
      }

      // Divider
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.line(margin + 5, y + 12, pageWidth - margin - 5, y + 12);

      // Text content
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(text, margin + 5, y + 18, { lineHeightFactor: 1.3 });

      y += cardHeight + 10;
    };

    // Section 1
    drawCard(labels.originalText || 'TEXT ORIGINAL CORREGIT', splitText1);

    // Section 2
    drawCard(labels.improvedText || 'PROPOSTA TEXTUP', splitText2, labels.improvedBadge || 'MILLORAT');

    // Section 3 (Feedback)
    if (feedback && splitFeedback.length > 0) {
      drawCard(labels.teacherFeedback || 'COMENTARI DEL PROFESSOR/A', splitFeedback);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`${labels.generatedOn || 'TEXTUP! - Generat el'} ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    const finalFilename = filename || `textup_correccio_${Date.now()}.pdf`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = doc.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: finalFilename,
          data: base64,
          directory: Directory.Cache
        });

        await Share.share({
          title: labels.shareTitle || 'Correcció amb IA',
          text: labels.shareText || 'Informe de correcció',
          url: savedFile.uri,
          dialogTitle: labels.shareDialogTitle || 'Comparteix el PDF'
        });
        return;
      } catch (err) {
        console.error('Error sharing PDF natively:', err);
        // Fallback to doc.save if native share fails
      }
    } else {
      // Try Web Share API on mobile web
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile && navigator.share && navigator.canShare) {
        try {
          const blob = doc.output('blob');
          const file = new File([blob], finalFilename, { type: 'application/pdf' });
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: labels.shareTitle || 'Correcció amb IA',
              text: labels.shareText || 'Informe de correcció',
            });
            return;
          }
        } catch (err: any) {
          console.error('Error sharing PDF on web', err);
          if (err.name === 'AbortError') {
            return;
          }
        }
      }
    }

    doc.save(finalFilename);
  } catch (error) {
    console.error("CRITICAL ERROR in generateModernCorrectionPdf:", error);
    throw error;
  }
};

export const generatePdf = async ({ title, author, content, filename, labels = {} }: PdfOptions) => {
  try {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxLineWidth = pageWidth - (margin * 2);
  let y = 10;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 10) {
      doc.addPage();
      y = 10;
      return true;
    }
    return false;
  };

  // Header Logo Textup!
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('TEXTUP!', pageWidth / 2, y, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(new Date().toLocaleDateString(), pageWidth - margin, y, { align: 'right' });
  
  y += 4;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Title & Author
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  const splitTitle = doc.splitTextToSize(title, maxLineWidth);
  doc.text(splitTitle, margin, y);
  y += (splitTitle.length * 8) + 4;

  if (author) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`${labels.authorPrefix || 'Autor/a:'} ${author}`, margin, y);
    y += 10;
  }

  // Content
  if (typeof content === 'string') {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const splitText = doc.splitTextToSize(content, maxLineWidth);
    checkPageBreak(splitText.length * 7);
    doc.text(splitText, margin, y);
  } else {
    content.forEach((item) => {
      switch (item.type) {
        case 'title': {
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          const sTitle = doc.splitTextToSize(item.text || '', maxLineWidth);
          checkPageBreak(sTitle.length * 10 + 5);
          doc.text(sTitle, margin, y);
          y += (sTitle.length * 10) + 5;
          break;
        }

        case 'subtitle': {
          y += 5;
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(60, 60, 60);
          const sSubtitle = doc.splitTextToSize(item.text || '', maxLineWidth);
          checkPageBreak(sSubtitle.length * 8 + 5);
          doc.text(sSubtitle, margin, y);
          y += (sSubtitle.length * 8) + 5;
          break;
        }

        case 'text': {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40, 40, 40);
          const sText = doc.splitTextToSize(item.text || '', maxLineWidth);
          checkPageBreak(sText.length * 6 + 5);
          doc.text(sText, margin, y);
          y += (sText.length * 6) + 8;
          break;
        }

        case 'list':
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40, 40, 40);
          (item.items || []).forEach((li) => {
            const sLi = doc.splitTextToSize(`• ${li}`, maxLineWidth - 5);
            checkPageBreak(sLi.length * 6);
            doc.text(sLi, margin + 5, y);
            y += (sLi.length * 6);
          });
          y += 5;
          break;

        case 'score':
          if (item.scores) {
            y += 5;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(labels.scoresTitle || 'Puntuacions:', margin, y);
            y += 8;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            Object.entries(item.scores).forEach(([label, score]) => {
              checkPageBreak(6);
              doc.text(`${label}:`, margin + 5, y);
              doc.text(`${score}/10`, pageWidth - margin, y, { align: 'right' });
              y += 6;
            });
            y += 5;
          }
          break;

        case 'grid':
          if (item.grid) {
            y += 5;
            doc.setFontSize(10);
            item.grid.forEach((cell) => {
              checkPageBreak(8);
              doc.setFont('helvetica', 'bold');
              doc.text(String(cell.label), margin, y);
              doc.setFont('helvetica', 'normal');
              doc.text(String(cell.value), margin + 40, y);
              y += 8;
            });
            y += 5;
          }
          break;
        
        case 'image':
          if (item.src) {
            const imgWidth = maxLineWidth;
            const imgHeight = (imgWidth * 1) / 1; // Assuming 1:1 aspect ratio for now
            checkPageBreak(imgHeight + 10);
            try {
              const format = item.src.includes('image/png') ? 'PNG' : 'JPEG';
              doc.addImage(item.src, format, margin, y, imgWidth, imgHeight);
              y += imgHeight + 10;
            } catch (e) {
              console.error("Error adding image to PDF", e);
              doc.setFontSize(8);
              doc.setTextColor(200, 0, 0);
              doc.text(`[${labels.imageError || "Error: No s'ha pogut carregar la imatge"}]`, margin, y + 5);
              y += 10;
            }
          }
          break;

        case 'comic_grid':
          if (item.panels) {
            const panelWidth = (maxLineWidth - 5) / 2;
            const panelHeight = panelWidth; // Square panels
            
            for (let i = 0; i < item.panels.length; i += 2) {
              checkPageBreak(panelHeight + 20);
              
              // Left panel
              const leftPanel = item.panels[i];
              if (leftPanel.image) {
                try {
                  const format = leftPanel.image.includes('image/png') ? 'PNG' : 'JPEG';
                  doc.addImage(leftPanel.image, format, margin, y, panelWidth, panelHeight);
                  if (leftPanel.dialogue) {
                    doc.setFontSize(8);
                    const sDialogue = doc.splitTextToSize(leftPanel.dialogue, panelWidth);
                    doc.text(sDialogue, margin, y + panelHeight + 4);
                  }
                } catch (e) {
                  console.error("Error adding left panel image", e);
                }
              }

              // Right panel
              if (i + 1 < item.panels.length) {
                const rightPanel = item.panels[i + 1];
                if (rightPanel.image) {
                  try {
                    const format = rightPanel.image.includes('image/png') ? 'PNG' : 'JPEG';
                    doc.addImage(rightPanel.image, format, margin + panelWidth + 5, y, panelWidth, panelHeight);
                    if (rightPanel.dialogue) {
                      doc.setFontSize(8);
                      const sDialogue = doc.splitTextToSize(rightPanel.dialogue, panelWidth);
                      doc.text(sDialogue, margin + panelWidth + 5, y + panelHeight + 4);
                    }
                  } catch (e) {
                    console.error("Error adding right panel image", e);
                  }
                }
              }
              
              y += panelHeight + 20;
            }
          }
          break;
      }
    });
  }

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`${labels.generatedOn || 'TEXTUP! - Generat el'} ${new Date().toLocaleDateString()} - ${labels.pageLabel || 'Pàgina'} ${i} ${labels.ofLabel || 'de'} ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  const finalFilename = filename || `textup_${title.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: finalFilename,
        data: base64,
        directory: Directory.Cache
      });

      await Share.share({
        title: title,
        text: `${labels.shareTextPrefix || 'Informe de'} ${title}`,
        url: savedFile.uri,
        dialogTitle: labels.shareDialogTitle || 'Comparteix el PDF'
      });
      return;
    } catch (err) {
      console.error('Error sharing PDF natively:', err);
      // Fallback to doc.save if native share fails
    }
  } else {
    // Try Web Share API on mobile web
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile && navigator.share && navigator.canShare) {
      try {
        const blob = doc.output('blob');
        const file = new File([blob], finalFilename, { type: 'application/pdf' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: title,
            text: `${labels.shareTextPrefix || 'Informe de'} ${title}`,
          });
          return;
        }
      } catch (err: any) {
        console.error('Error sharing PDF on web', err);
        if (err.name === 'AbortError') {
          return;
        }
        // Fallback to save if share fails
      }
    }
  }

  doc.save(finalFilename);
  } catch (error) {
    console.error("CRITICAL ERROR in generatePdf:", error);
    throw error;
  }
};
