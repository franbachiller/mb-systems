export type AdminSystemStatus = {
  appUrl: {
    configured: boolean;
    value: string;
  };
  mercadoPago: {
    enabled: boolean;
    sandbox: boolean;
    webhookSecretConfigured: boolean;
    webhookUrl: string;
  };
  manualPayment: {
    configured: boolean;
    aliasConfigured: boolean;
    cbuConfigured: boolean;
    holderConfigured: boolean;
    paymentLinkConfigured: boolean;
  };
  contact: {
    businessWhatsAppConfigured: boolean;
  };
  security: {
    customAdminPin: boolean;
    sessionSecretConfigured: boolean;
  };
};
