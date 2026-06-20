import axios from 'axios';
import { logger } from './logger.js';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

/**
 * Create a Razorpay Order for one-time credit pack purchase.
 */
export async function createOrder({ amount, receipt, notes }) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }

  const amountPaise = Math.round(amount * 100);

  const response = await axios.post(
    'https://api.razorpay.com/v1/orders',
    {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes,
    },
    {
      auth: { username: RAZORPAY_KEY_ID, password: RAZORPAY_KEY_SECRET },
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );

  logger.info('razorpay.order.created', { orderId: response.data.id, amount: amountPaise });
  return response.data;
}
