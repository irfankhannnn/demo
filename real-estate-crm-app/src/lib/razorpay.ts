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
  planId: string;
  name: string;
  email: string;
  phone?: string;
  onSuccess: (response: any) => void;
  onFailure: (error: any) => void;
  onDismiss?: () => void;
}

export async function openCheckout(opts: CheckoutOptions): Promise<void> {
  await loadRazorpay();
  const rzp = new window.Razorpay({
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    subscription_id: opts.planId,
    name: 'RealEstateFlow',
    description: 'Subscription',
    prefill: { name: opts.name, email: opts.email, contact: opts.phone },
    handler: opts.onSuccess,
    modal: { ondismiss: opts.onDismiss },
  });
  rzp.on('payment.failed', opts.onFailure);
  rzp.open();
}
