require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');
const { notifyGuest } = require('./notifications');

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
}));

// ── Razorpay instance — key_secret never leaves this file ──
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Optional: server-side Supabase client using the SERVICE ROLE key.
// This lets the backend write the final "paid" booking itself instead
// of trusting the browser to do it after payment.
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

/**
 * STEP 1: Create a Razorpay order.
 * Frontend calls this with the amount it calculated (room price x nights).
 * We trust nothing else from the frontend about the amount here in a real
 * production app — ideally you'd recompute the price server-side from
 * room_type + dates instead of accepting `amount` directly. Shown simply
 * below for clarity.
 */
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', booking } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay needs amount in paise
      currency,
      receipt: 'LH-' + Date.now(),
      notes: {
        guest_name: booking?.guest_name || '',
        room_type: booking?.room_type || '',
        check_in: booking?.check_in || '',
        check_out: booking?.check_out || '',
      },
    });

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID, // public key, safe to send to frontend
    });
  } catch (err) {
    console.error('create-order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

/**
 * STEP 2: Verify the payment signature Razorpay returns to the frontend
 * after checkout. This is the step that actually proves the payment is
 * genuine — never trust a "success" callback from the browser alone.
 */
app.post('/api/verify-payment', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      booking, // optional: booking details to persist on successful payment
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ verified: false, error: 'Missing payment fields' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({ verified: false, error: 'Signature mismatch' });
    }

    // Signature is valid — payment is genuine.
    let savedBooking = null;
    if (supabase && booking) {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          ...booking,
          payment_status: 'paid',
          razorpay_order_id,
          razorpay_payment_id,
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        // Payment is still valid even if the DB write failed — surface both.
        return res.json({ verified: true, db_saved: false, error: error.message });
      }
      savedBooking = data;
       // ── Send email + WhatsApp confirmation to guest ──
      await notifyGuest({
        guestName:   savedBooking.guest_name,
        guestEmail:  savedBooking.email,
        guestPhone:  savedBooking.mobile,
        bookingRef:  'LH-' + savedBooking.id,
        roomType:    savedBooking.room_type,
        checkIn:     savedBooking.check_in,
        checkOut:    savedBooking.check_out,
        rooms:       1,
        totalAmount: savedBooking.amount,
        paymentId:   razorpay_payment_id,
      });
    }

    res.json({ verified: true, db_saved: !!savedBooking, booking: savedBooking });
  } catch (err) {
    console.error('verify-payment error:', err);
    res.status(500).json({ verified: false, error: 'Verification failed' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Razorpay backend running on port ${PORT}`));
