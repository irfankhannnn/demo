declare global {
  interface Window {
    Razorpay: any;
  }
}

export async function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay load failed'));
    document.head.appendChild(script);
  });
}

interface CheckoutOptions {
  planId?: string;
  orderId?: string;
  amount?: number;
  name: string;
  email: string;
  phone?: string;
  onSuccess: (response: any) => void;
  onFailure: (error: any) => void;
  onDismiss?: () => void;
}

export async function openCheckout(opts: CheckoutOptions): Promise<void> {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!key) {
    throw new Error('Razorpay key is not configured');
  }

  if (!opts.onSuccess || !opts.onFailure) {
    throw new Error('onSuccess and onFailure callbacks are required');
  }

  try {
    await loadRazorpay();
  } catch (err) {
    throw new Error('Failed to load Razorpay. Please check your internet connection.');
  }

  if (!window.Razorpay) {
    throw new Error('Razorpay failed to initialize');
  }

  const baseOptions: Record<string, unknown> = {
    key,
    name: 'RealEstateFlow',
    prefill: { name: opts.name, email: opts.email, contact: opts.phone },
    handler: opts.onSuccess,
    modal: { ondismiss: opts.onDismiss },
  };

  if (opts.orderId) {
    baseOptions.order_id = opts.orderId;
    baseOptions.description = 'Credit Pack Purchase';
    if (opts.amount) baseOptions.amount = opts.amount;
  } else if (opts.planId) {
    baseOptions.subscription_id = opts.planId;
    baseOptions.description = 'Subscription';
  } else {
    throw new Error('Either planId or orderId is required');
  }

  const rzp = new window.Razorpay(baseOptions);
  rzp.on('payment.failed', opts.onFailure);
  rzp.open();
}
