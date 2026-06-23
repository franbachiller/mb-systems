export type PublicPaymentOptions = {
  alias: string;
  cbu: string;
  holder: string;
  paymentLink: string;
};

export function getPublicPaymentOptions(): PublicPaymentOptions {
  return {
    alias: process.env.NEXT_PUBLIC_PAYMENT_ALIAS?.trim() ?? "",
    cbu: process.env.NEXT_PUBLIC_PAYMENT_CBU?.trim() ?? "",
    holder: process.env.NEXT_PUBLIC_PAYMENT_HOLDER?.trim() ?? "",
    paymentLink: process.env.NEXT_PUBLIC_PAYMENT_LINK?.trim() ?? "",
  };
}

export function hasPublicPaymentOptions(options: PublicPaymentOptions) {
  return Boolean(
    options.alias || options.cbu || options.holder || options.paymentLink,
  );
}
