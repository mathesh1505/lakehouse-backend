// ════════════════════════════════════════════════════════
//  notifications.js  —  Email + WhatsApp notifications
//  Stack: Nodemailer (Gmail SMTP) + Meta WhatsApp API
// ════════════════════════════════════════════════════════

const nodemailer = require('nodemailer');

// ── Gmail SMTP Transporter ───────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASSWORD,
  },
});

// ════════════════════════════════════════════════════════
//  EMAIL NOTIFICATION
// ════════════════════════════════════════════════════════
async function sendBookingEmail(booking) {
  const {
    guestName, guestEmail, bookingRef,
    roomType, checkIn, checkOut,
    rooms, totalAmount, paymentId,
  } = booking;

  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Georgia', serif; background: #FAF8F2; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e0cc; }
    .header { background: #1A2A3A; padding: 32px 40px; text-align: center; }
    .header h1 { color: #C9A84C; font-size: 24px; margin: 0 0 4px; letter-spacing: 1px; }
    .header p { color: rgba(255,255,255,0.6); font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 18px; color: #1A1A18; margin-bottom: 8px; }
    .subtext { color: #7A7A72; font-size: 14px; line-height: 1.7; margin-bottom: 28px; }
    .ref-box { background: #FAF8F2; border: 1px solid #C9A84C; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px; text-align: center; }
    .ref-label { font-size: 11px; color: #7A7A72; letter-spacing: 2px; text-transform: uppercase; }
    .ref-number { font-size: 22px; color: #1A2A3A; font-weight: bold; letter-spacing: 3px; margin-top: 4px; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    .details-table tr { border-bottom: 1px solid #F0EDE3; }
    .details-table td { padding: 12px 0; font-size: 14px; }
    .details-table td:first-child { color: #7A7A72; width: 45%; }
    .details-table td:last-child { color: #1A1A18; font-weight: 600; text-align: right; }
    .total-row td { font-size: 16px !important; color: #1A2A3A !important; border-bottom: none !important; padding-top: 16px !important; }
    .divider { border: none; border-top: 1px solid #F0EDE3; margin: 24px 0; }
    .info-box { background: #F0EDE3; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; font-size: 13px; color: #4A4A44; line-height: 1.7; }
    .info-box strong { color: #1A2A3A; }
    .footer { background: #1A2A3A; padding: 24px 40px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.5); font-size: 12px; margin: 4px 0; }
    .footer a { color: #C9A84C; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>The Lake House</h1>
      <p>Kodaikanal · Luxury Lake View Stay</p>
    </div>
    <div class="body">
      <p class="greeting">Dear ${guestName},</p>
      <p class="subtext">Your booking is confirmed! We look forward to welcoming you to The Lake House, Kodaikanal. Please find your booking details below.</p>

      <div class="ref-box">
        <div class="ref-label">Booking Reference</div>
        <div class="ref-number">${bookingRef}</div>
      </div>

      <table class="details-table">
        <tr><td>Room Type</td><td>${roomType}</td></tr>
        <tr><td>Check-in</td><td>${formatDate(checkIn)} · 12:00 PM</td></tr>
        <tr><td>Check-out</td><td>${formatDate(checkOut)} · 11:00 AM</td></tr>
        <tr><td>Duration</td><td>${nights} Night${nights > 1 ? 's' : ''}</td></tr>
        <tr><td>Rooms</td><td>${rooms}</td></tr>
        <tr><td>Payment ID</td><td>${paymentId}</td></tr>
        <tr class="total-row"><td>Total Paid</td><td>₹${Number(totalAmount).toLocaleString('en-IN')}</td></tr>
      </table>

      <div class="info-box">
        <strong>📍 Address</strong><br>
        5/82 A2 Rifle Range Road, Naidupuram, Kodaikanal — 624101<br><br>
        <strong>🍳 Complimentary Breakfast</strong> is included with your stay.<br><br>
        <strong>📞 Contact Us</strong><br>
        Phone: ${process.env.HOTEL_PHONE}<br>
        Email: ${process.env.HOTEL_EMAIL}
      </div>

      <hr class="divider">
      <p style="font-size:13px;color:#7A7A72;line-height:1.7;">
        For any changes or queries, please contact us with your booking reference number.
        We are available 24/7 to assist you.
      </p>
    </div>
    <div class="footer">
      <p>The Lake House Kodaikanal</p>
      <p><a href="mailto:${process.env.HOTEL_EMAIL}">${process.env.HOTEL_EMAIL}</a> · ${process.env.HOTEL_PHONE}</p>
      <p style="margin-top:12px;font-size:11px;">This is an automated confirmation. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    `"The Lake House Kodaikanal" <${process.env.GMAIL_USER}>`,
    to:      guestEmail,
    subject: `Booking Confirmed — ${bookingRef} | The Lake House Kodaikanal`,
    html:    htmlContent,
  });

  console.log(`[email] Confirmation sent to ${guestEmail}`);
}

// ════════════════════════════════════════════════════════
//  WHATSAPP NOTIFICATION (Meta Cloud API)
// ════════════════════════════════════════════════════════
async function sendBookingWhatsApp(booking) {
  const {
    guestName, guestPhone, bookingRef,
    roomType, checkIn, checkOut, totalAmount,
  } = booking;

  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

  // Format phone: remove leading 0, add country code
  // e.g. 9876543210 → 919876543210
  const phone = guestPhone.replace(/\D/g, '').replace(/^0/, '');
  const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;

  // Using a WhatsApp template message (required for business-initiated messages)
  // You must create this template in Meta Business Manager first
  // Template name: booking_confirmation
  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: 'booking_confirmation',   // your approved template name
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: guestName },           // {{1}}
            { type: 'text', text: bookingRef },           // {{2}}
            { type: 'text', text: roomType },             // {{3}}
            { type: 'text', text: formatDate(checkIn) },  // {{4}}
            { type: 'text', text: formatDate(checkOut) }, // {{5}}
            { type: 'text', text: `${nights}` },          // {{6}}
            { type: 'text', text: `₹${Number(totalAmount).toLocaleString('en-IN')}` }, // {{7}}
          ],
        },
      ],
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();
  if (data.error) throw new Error(`WhatsApp error: ${data.error.message}`);

  console.log(`[whatsapp] Message sent to ${formattedPhone}`);
  return data;
}

// ════════════════════════════════════════════════════════
//  SEND BOTH — call this after every confirmed booking
// ════════════════════════════════════════════════════════
async function notifyGuest(booking) {
  await Promise.allSettled([
    sendBookingEmail(booking).catch(e => console.error('[email] failed:', e.message)),
    sendBookingWhatsApp(booking).catch(e => console.error('[whatsapp] failed:', e.message)),
  ]);
}

// ── Utility ─────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
}

module.exports = { notifyGuest, sendBookingEmail, sendBookingWhatsApp };
