export interface PublicPaymentProviderConfig {
  provider: 'stripe' | 'paypal';
  publishableKey: string;
}

type ProviderLike = { code: string; credentials?: Record<string, any> | null };

export function isPaymentProviderConfigured(provider: string | ProviderLike): boolean {
  const code = typeof provider === 'string' ? provider : provider.code;
  const credentials = typeof provider === 'string' ? {} : provider.credentials || {};
  if (code.startsWith('pp_stripe')) {
    return Boolean(credentials.secretKey || process.env.STRIPE_SECRET_KEY);
  }
  if (code.startsWith('pp_paypal')) {
    return Boolean(
      (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID) &&
      process.env.PAYPAL_CLIENT_SECRET
    );
  }
  return code === 'pp_system_default' || code.startsWith('pp_manual');
}

export function getPublicPaymentProviderConfig(
  code: string
): PublicPaymentProviderConfig | null {
  if (!isPaymentProviderConfigured(code)) return null;

  if (code.startsWith('pp_stripe')) {
    return {
      provider: 'stripe',
      publishableKey:
        process.env.NEXT_PUBLIC_STRIPE_KEY ||
        process.env.STRIPE_PUBLISHABLE_KEY ||
        '',
    };
  }
  if (code.startsWith('pp_paypal')) {
    return {
      provider: 'paypal',
      publishableKey: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
    };
  }
  return null;
}
