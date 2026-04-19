// lib/generatePDF.js
// -------------------------------------------------
//  Install:  npm install jspdf
//  This generates a mobile-friendly A4 pamphlet
//  with the artist's portfolio and services.
// -------------------------------------------------

import { jsPDF } from 'jspdf';

/** Loads an external image URL as a base64 data URL (browser-side) */
async function loadImageAsBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(null); // skip broken images gracefully
    img.src = url;
  });
}

/** Format INR price */
function formatPrice(price) {
  return `₹${Number(price).toLocaleString('en-IN')}`;
}

/**
 * generateArtistPDF
 * @param {Object} profile   - Profile row from Supabase
 * @param {Array}  services  - Services array from Supabase
 */
export async function generateArtistPDF(profile, services) {
  // ── 1. Setup ───────────────────────────────────────────────
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210;   // A4 width  in mm
  const H = 297;   // A4 height in mm
  const margin = 14;
  const contentW = W - margin * 2;

  // ── Palette ────────────────────────────────────────────────
  const CHAMPAGNE   = [212, 185, 150];   // #D4B996
  const CHARCOAL    = [38,  38,  38];    // #262626
  const CREAM       = [252, 249, 244];   // #FCF9F4
  const GOLD_DARK   = [150, 120,  70];   // #967846
  const LIGHT_GRAY  = [230, 225, 218];   // #E6E1DA

  // ── 2. Background ──────────────────────────────────────────
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, H, 'F');

  // ── 3. Header band ─────────────────────────────────────────
  doc.setFillColor(...CHARCOAL);
  doc.rect(0, 0, W, 52, 'F');

  // Gold accent bar at top
  doc.setFillColor(...CHAMPAGNE);
  doc.rect(0, 0, W, 3, 'F');

  // ── 4. Avatar ──────────────────────────────────────────────
  let avatarY = 10;
  if (profile.avatar_url) {
    const base64 = await loadImageAsBase64(profile.avatar_url);
    if (base64) {
      // circular clip via ellipse fill trick – draw circle background
      doc.setFillColor(...CHAMPAGNE);
      doc.circle(margin + 16, avatarY + 16, 17, 'F');
      doc.addImage(base64, 'JPEG', margin, avatarY, 32, 32);
    }
  }

  // ── 5. Artist name & tagline ────────────────────────────────
  const textX = margin + 38;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(profile.full_name || 'Artist Name', textX, avatarY + 10);

  doc.setTextColor(...CHAMPAGNE);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(profile.tagline || '', textX, avatarY + 17);

  doc.setTextColor(180, 170, 160);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (profile.city) doc.text(`📍 ${profile.city}`, textX, avatarY + 24);
  if (profile.phone) doc.text(`📞 ${profile.phone}`, textX + 40, avatarY + 24);

  // ── 6. Divider ─────────────────────────────────────────────
  let curY = 58;
  doc.setDrawColor(...CHAMPAGNE);
  doc.setLineWidth(0.4);
  doc.line(margin, curY, W - margin, curY);
  curY += 6;

  // ── 7. About section ───────────────────────────────────────
  if (profile.bio) {
    doc.setTextColor(...GOLD_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ABOUT', margin, curY);
    curY += 5;

    doc.setTextColor(...CHARCOAL);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const bioLines = doc.splitTextToSize(profile.bio, contentW);
    doc.text(bioLines, margin, curY);
    curY += bioLines.length * 5 + 4;
  }

  // ── 8. Services table ──────────────────────────────────────
  if (services.length > 0) {
    // Section header
    doc.setTextColor(...GOLD_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('SERVICES & PRICING', margin, curY);
    curY += 5;

    const rowH = 9;
    // Table header
    doc.setFillColor(...CHARCOAL);
    doc.roundedRect(margin, curY, contentW, rowH, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Service', margin + 3, curY + 6);
    doc.text('Duration', margin + contentW * 0.55, curY + 6);
    doc.text('Price', margin + contentW * 0.78, curY + 6);
    curY += rowH;

    // Table rows
    services.forEach((svc, i) => {
      const bgColor = i % 2 === 0 ? [248, 245, 240] : [255, 255, 255];
      doc.setFillColor(...bgColor);
      doc.rect(margin, curY, contentW, rowH, 'F');

      doc.setTextColor(...CHARCOAL);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(svc.name, margin + 3, curY + 6);

      doc.setTextColor(120, 110, 100);
      doc.text(svc.duration || '—', margin + contentW * 0.55, curY + 6);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GOLD_DARK);
      doc.text(formatPrice(svc.price), margin + contentW * 0.78, curY + 6);

      curY += rowH;
    });

    // Bottom border of table
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.3);
    doc.line(margin, curY, W - margin, curY);
    curY += 8;
  }

  // ── 9. Portfolio grid ──────────────────────────────────────
  const portfolioImages = Array.isArray(profile.portfolio_images) ? profile.portfolio_images : [];
  const gridImages = portfolioImages.slice(0, 6).filter(Boolean);

  if (gridImages.length > 0) {
    doc.setTextColor(...GOLD_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PORTFOLIO', margin, curY);
    curY += 5;

    const cols = 3;
    const imgW = (contentW - (cols - 1) * 3) / cols;
    const imgH = imgW * 1.1;

    for (let i = 0; i < gridImages.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (imgW + 3);
      const y = curY + row * (imgH + 3);

      if (y + imgH > H - 20) break; // page overflow guard

      const base64 = await loadImageAsBase64(gridImages[i]);
      if (base64) {
        // Subtle shadow
        doc.setFillColor(200, 195, 185);
        doc.rect(x + 1.5, y + 1.5, imgW, imgH, 'F');
        doc.addImage(base64, 'JPEG', x, y, imgW, imgH);
      } else {
        // Placeholder if image fails
        doc.setFillColor(...LIGHT_GRAY);
        doc.rect(x, y, imgW, imgH, 'F');
        doc.setTextColor(160, 150, 140);
        doc.setFontSize(6);
        doc.text('Image', x + imgW / 2 - 3, y + imgH / 2);
      }
    }

    const gridRows = Math.ceil(gridImages.length / cols);
    curY += gridRows * (imgH + 3) + 6;
  }

  // ── 10. Social links footer ────────────────────────────────
  const footerY = Math.max(curY + 4, H - 28);

  doc.setFillColor(...CHARCOAL);
  doc.rect(0, footerY, W, H - footerY, 'F');

  // Gold accent
  doc.setFillColor(...CHAMPAGNE);
  doc.rect(0, footerY, W, 1, 'F');

  doc.setTextColor(...CHAMPAGNE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  const socials = [
    profile.instagram_url && `Instagram: ${profile.instagram_url}`,
    profile.youtube_url   && `YouTube: ${profile.youtube_url}`,
    profile.snapchat_url  && `Snapchat: ${profile.snapchat_url}`,
  ].filter(Boolean);

  doc.text(socials.join('   ·   '), margin, footerY + 8);

  doc.setTextColor(120, 110, 100);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('Powered by ArtistHub', W - margin - 26, footerY + 8);

  // ── 11. UPI QR (second page) ───────────────────────────────
  if (profile.upi_qr_url) {
    doc.addPage();
    doc.setFillColor(...CREAM);
    doc.rect(0, 0, W, H, 'F');

    doc.setFillColor(...CHARCOAL);
    doc.rect(0, 0, W, 3, 'F');

    doc.setTextColor(...GOLD_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Pay via UPI', W / 2, 25, { align: 'center' });

    doc.setTextColor(...CHARCOAL);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Scan the QR code below to make payment', W / 2, 33, { align: 'center' });

    const qrBase64 = await loadImageAsBase64(profile.upi_qr_url);
    if (qrBase64) {
      const qrSize = 80;
      doc.addImage(qrBase64, 'PNG', (W - qrSize) / 2, 42, qrSize, qrSize);
    }

    doc.setTextColor(100, 90, 80);
    doc.setFontSize(8.5);
    doc.text(profile.full_name || '', W / 2, 130, { align: 'center' });
    if (profile.phone) doc.text(profile.phone, W / 2, 138, { align: 'center' });
  }

  // ── 12. Save ───────────────────────────────────────────────
  const fileName = `${(profile.username || 'artist').replace(/\s+/g, '_')}_portfolio.pdf`;
  doc.save(fileName);
}
