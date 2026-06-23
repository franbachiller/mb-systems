import "server-only";

import { getMercadoPagoPublicStatus } from "@/lib/mercado-pago";
import { getPublicPaymentOptions } from "@/lib/payment-options";
import type { AdminSystemStatus } from "@/lib/system-status-data";

export function getAdminSystemStatus(): AdminSystemStatus {
  const appUrl = getConfiguredAppUrl();
  const mercadoPagoStatus = getMercadoPagoPublicStatus();
  const manualPaymentOptions = getPublicPaymentOptions();

  return {
    appUrl: {
      configured: appUrl.length > 0,
      value: appUrl,
    },
    mercadoPago: {
      enabled: mercadoPagoStatus.enabled,
      sandbox: mercadoPagoStatus.sandbox,
      webhookSecretConfigured:
        Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()),
      webhookUrl: appUrl ? `${appUrl}/api/mercadopago/webhook` : "",
    },
    manualPayment: {
      configured:
        Boolean(manualPaymentOptions.alias) ||
        Boolean(manualPaymentOptions.cbu) ||
        Boolean(manualPaymentOptions.paymentLink),
      aliasConfigured: Boolean(manualPaymentOptions.alias),
      cbuConfigured: Boolean(manualPaymentOptions.cbu),
      holderConfigured: Boolean(manualPaymentOptions.holder),
      paymentLinkConfigured: Boolean(manualPaymentOptions.paymentLink),
    },
    contact: {
      businessWhatsAppConfigured: Boolean(
        process.env.NEXT_PUBLIC_BUSINESS_WHATSAPP?.trim(),
      ),
    },
    security: {
      customAdminPin:
        Boolean(process.env.ADMIN_PIN?.trim()) &&
        process.env.ADMIN_PIN?.trim() !== "1234",
      sessionSecretConfigured: Boolean(process.env.ADMIN_SESSION_SECRET?.trim()),
    },
  };
}

function getConfiguredAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    ""
  ).replace(/\/+$/g, "");
}
