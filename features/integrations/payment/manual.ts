// Records an offline payment (cheque, wire, cash at the office). Nothing is moved
// here: the local Payment stays pending until staff mark it received (capture).
export async function createPaymentFunction({ payment, amount, currency }: { payment?: any; amount: number; currency: string }) {
  return {
    id: `manual_${payment?.id || "payment"}`,
    status: "pending",
    url: null,
    amount,
    currency: currency.toUpperCase(),
  };
}

export async function capturePaymentFunction({ paymentId, amount }: { paymentId: string; amount?: number }) {
  return { id: paymentId, status: "succeeded", amount, currency: undefined as string | undefined };
}

export async function refundPaymentFunction({ paymentId, amount }: { paymentId: string; amount: number }) {
  return { id: `refund_${paymentId}`, status: "succeeded", amount };
}

export async function getPaymentStatusFunction({ paymentId }: { paymentId: string }) {
  // Offline payments have no external source of truth to reconcile against.
  return { id: paymentId, status: "pending", amount: undefined as number | undefined, currency: undefined as string | undefined };
}

export async function generatePaymentLinkFunction() {
  return null;
}

export async function handleWebhookFunction(): Promise<never> {
  throw new Error("Manual payments do not receive webhooks");
}

export async function cancelPaymentFunction() {
  return { status: "canceled" };
}
