import type { Currency } from '../types/dashboard';

export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'card' | 'cheque' | 'other';

export type PaymentSource = 'booking' | 'safari' | 'invoice' | 'cr';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export const MOBILE_MONEY_PROVIDERS = ['MTN', 'Airtel'] as const;

export interface PaymentDetails {
  // mobile_money
  provider?: string;
  phone_number?: string;
  // bank_transfer
  bank_name?: string;
  // card — last 4 digits + approval code ONLY, never full card number / CVV
  last_four?: string;
  approval_code?: string;
  // cheque
  cheque_number?: string;
  cheque_bank?: string;
  // cash
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

/** Validates method-specific required fields before calling the RPC — mirrors web PaymentMethodFields validation. */
export function validatePaymentDetails(method: PaymentMethod, details: PaymentDetails, reference: string | null): string | null {
  switch (method) {
    case 'mobile_money':
      if (!details.provider) return 'Select the Mobile Money provider.';
      if (!details.phone_number?.trim()) return 'Enter the Mobile Money phone number.';
      if (!reference?.trim()) return 'Enter the Mobile Money transaction reference.';
      return null;
    case 'bank_transfer':
      if (!details.bank_name?.trim()) return 'Enter the bank name.';
      if (!reference?.trim()) return 'Enter the bank transfer reference.';
      return null;
    case 'card':
      if (!details.last_four?.trim() || details.last_four.trim().length !== 4) return 'Enter the last 4 digits of the card.';
      if (!details.approval_code?.trim()) return 'Enter the card approval/auth code.';
      return null;
    case 'cheque':
      if (!details.cheque_number?.trim()) return 'Enter the cheque number.';
      if (!details.cheque_bank?.trim()) return 'Enter the issuing bank.';
      return null;
    case 'cash':
    case 'other':
    default:
      return null;
  }
}
