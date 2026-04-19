// lib/whatsapp.js
// ─────────────────────────────────────────────────────────────
//  Generates a wa.me deep-link that pre-fills a WhatsApp message
//  with full booking details. Opens in a new tab.
// ─────────────────────────────────────────────────────────────

/**
 * Generates a WhatsApp booking notification link.
 * @param {string} artistPhone  - artist's phone number with country code, e.g. "919876543210"
 * @param {Object} booking      - booking details
 */
export function generateWhatsAppLink({ artistPhone, booking }) {
  const {
    clientName,
    clientPhone,
    serviceName,
    bookingDate,
    timeSlot,
    totalPrice,
    note,
  } = booking;

  const formattedDate = new Date(bookingDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });

  const price = `₹${Number(totalPrice).toLocaleString('en-IN')}`;

  const message = [
    `🌸 *New Booking Request*`,
    ``,
    `👤 *Client:* ${clientName}`,
    `📞 *Phone:* ${clientPhone}`,
    ``,
    `✨ *Service:* ${serviceName}`,
    `📅 *Date:* ${formattedDate}`,
    timeSlot ? `⏰ *Time:* ${timeSlot}` : '',
    `💰 *Amount:* ${price}`,
    note ? `📝 *Note:* ${note}` : '',
    ``,
    `_Please confirm or contact the client to finalise._`,
  ]
    .filter(line => line !== null && line !== undefined)
    .join('\n');

  const encoded = encodeURIComponent(message);
  const phone = artistPhone.replace(/\D/g, '');  // strip non-digits
  return `https://wa.me/${phone}?text=${encoded}`;
}

/** Opens the WhatsApp link in a new tab */
export function openWhatsApp(artistPhone, booking) {
  const link = generateWhatsAppLink({ artistPhone, booking });
  window.open(link, '_blank', 'noopener,noreferrer');
}
