import type { Currency } from '../types/dashboard';

// These values are sent verbatim as `p_method` to the shared `record_payment`
// Postgres function, which validates with
// `p_method NOT IN ('Bank Transfer','Mobile Money','Cash','Card','Cheque','Check','Other')`.
// They must match that list exactly (case + spacing) — a lowercase/snake_case
// value here passes TypeScript but fails every payment with "Choose a valid
// payment method" server-side, since SQL text comparison is case-sensitive.
export type PaymentMethod = 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Card' | 'Cheque' | 'Other';

export type PaymentSource = 'booking' | 'safari' | 'invoice' | 'cr';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Mobile Money', label: 'Mobile Money' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Card', label: 'Card' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Other', label: 'Other' },
];

export const MOBILE_MONEY_PROVIDERS = ['MTN', 'Airtel'] as const;

export interface PaymentDetails {
  // Mobile Money — both required by record_payment
  provider?: string;
  phone_number?: string;
  // Bank Transfer — both required by record_payment
  bank_name?: string;
  account_number?: string;
  // Card — processor required by record_payment; last 4 digits + approval
  // code are additional audit fields, never the full card number / CVV
  processor?: string;
  last_four?: string;
  approval_code?: string;
  // Cheque — reuses bank_name above; cheque_date required by record_payment,
  // cheque_number is a convenience reference only (not server-validated)
  cheque_number?: string;
  cheque_date?: string;
  // Other — required by record_payment
  details?: string;
  // Cash
  receipt_note?: string;
}

export interface RecordPaymentParams {
  source: PaymentSource;
  sourceId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paymentDetails: PaymentDetails;
  transactionDate: string; // YYYY-MM-DD
  description: string | null;
  requestId: string;
}

export interface RecordPaymentResult {
  ok: boolean;
  replayed?: boolean;
  system_transaction_id?: string;
  amount_paid?: number;
  balance_due?: number;
  currency?: Currency;
  error?: string;
}

/** Validates method-specific required fields before calling the RPC — mirrors the server's own record_payment checks (plus a couple of stricter, business-level requirements like always requiring a reference). */
export function validatePaymentDetails(method: PaymentMethod, details: PaymentDetails, reference: string | null): string | null {
  switch (method) {
    case 'Mobile Money':
      if (!details.provider) return 'Select the Mobile Money provider.';
      if (!details.phone_number?.trim()) return 'Enter the Mobile Money phone number.';
      if (!reference?.trim()) return 'Enter the Mobile Money transaction reference.';
      return null;
    case 'Bank Transfer':
      if (!details.bank_name?.trim()) return 'Enter the bank name.';
      if (!details.account_number?.trim()) return 'Enter the account number.';
      if (!reference?.trim()) return 'Enter the bank transfer reference.';
      return null;
    case 'Card':
      if (!details.processor?.trim()) return 'Enter the card payment processor.';
      if (!details.last_four?.trim() || details.last_four.trim().length !== 4) return 'Enter the last 4 digits of the card.';
      if (!details.approval_code?.trim()) return 'Enter the card approval/auth code.';
      return null;
    case 'Cheque':
      if (!details.bank_name?.trim()) return 'Enter the issuing bank.';
      if (!details.cheque_date?.trim()) return 'Enter the cheque date.';
      return null;
    case 'Other':
      if (!details.details?.trim()) return 'Enter the payment details.';
      return null;
    case 'Cash':
    default:
      return null;
  }
}
