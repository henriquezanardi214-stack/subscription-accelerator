import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Normalize environment to avoid issues like "Production" or "production "
const ASAAS_ENVIRONMENT = (Deno.env.get('ASAAS_ENVIRONMENT') ?? '').trim().toLowerCase();

// Use sandbox URL for testing, change to 'https://api.asaas.com/v3' for production
const ASAAS_BASE_URL = ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

console.log('[create-subscription] ASAAS_ENVIRONMENT =', ASAAS_ENVIRONMENT || '(not set)', '| ASAAS_BASE_URL =', ASAAS_BASE_URL);

type BillingType = 'CREDIT_CARD' | 'BOLETO' | 'PIX';

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
}

interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

interface SubscriptionRequest {
  customer: CustomerData;
  billingType: BillingType;
  creditCard?: CreditCardData;
  creditCardHolderInfo?: CreditCardHolderInfo;
  planId: string;
  planValue: number;
  remoteIp: string;
}

// ==================== VALIDATION HELPERS ====================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  // After removing non-digits, should be 10-11 digits
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

function isValidCpfCnpj(cpfCnpj: string): boolean {
  const digits = cpfCnpj.replace(/\D/g, '');
  
  // CPF has 11 digits, CNPJ has 14 digits
  if (digits.length === 11) {
    return isValidCpf(digits);
  } else if (digits.length === 14) {
    return isValidCnpj(digits);
  }
  return false;
}

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  
  // Check if all digits are the same
  if (/^(\d)\1+$/.test(cpf)) return false;
  
  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;
  
  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10))) return false;
  
  return true;
}

function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false;
  
  // Check if all digits are the same
  if (/^(\d)\1+$/.test(cnpj)) return false;
  
  // Validate first check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj.charAt(i)) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cnpj.charAt(12))) return false;
  
  // Validate second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj.charAt(i)) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cnpj.charAt(13))) return false;
  
  return true;
}

function isValidCep(cep: string): boolean {
  const digits = cep.replace(/\D/g, '');
  return digits.length === 8;
}

function isValidCardNumber(number: string): boolean {
  const digits = number.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  
  // Luhn algorithm
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i));
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

function isValidCardExpiry(month: string, year: string): boolean {
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  
  if (isNaN(monthNum) || isNaN(yearNum)) return false;
  if (monthNum < 1 || monthNum > 12) return false;
  
  const now = new Date();
  const expiry = new Date(yearNum, monthNum - 1, 1);
  const endOfExpiryMonth = new Date(yearNum, monthNum, 0); // Last day of expiry month
  
  return endOfExpiryMonth >= now;
}

function isValidCvv(cvv: string): boolean {
  const digits = cvv.replace(/\D/g, '');
  return digits.length >= 3 && digits.length <= 4;
}

function isValidPlanValue(value: number): boolean {
  // Reasonable limits: min R$50, max R$10,000
  return value >= 50 && value <= 10000;
}

function isValidPlanId(planId: string): boolean {
  const validPlans = ['essencial', 'intermediario', 'premium'];
  return validPlans.includes(planId);
}

// ==================== VALIDATION FUNCTION ====================

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateRequest(data: SubscriptionRequest): ValidationResult {
  // Check required fields
  if (!data.customer) {
    return { valid: false, error: 'Dados do cliente são obrigatórios' };
  }
  if (!data.planValue || !data.billingType) {
    return { valid: false, error: 'Dados do plano são obrigatórios' };
  }
  
  // Validate customer data
  if (!data.customer.name || data.customer.name.trim().length < 3) {
    return { valid: false, error: 'Nome deve ter pelo menos 3 caracteres' };
  }
  if (!isValidEmail(data.customer.email)) {
    return { valid: false, error: 'Email inválido' };
  }
  if (!isValidPhone(data.customer.phone)) {
    return { valid: false, error: 'Telefone inválido' };
  }
  if (!isValidCpfCnpj(data.customer.cpfCnpj)) {
    return { valid: false, error: 'CPF/CNPJ inválido' };
  }
  
  // Validate plan
  if (!isValidPlanId(data.planId)) {
    return { valid: false, error: 'Plano inválido' };
  }
  if (!isValidPlanValue(data.planValue)) {
    return { valid: false, error: 'Valor do plano fora dos limites permitidos' };
  }
  
  // Validate billing type
  if (!['CREDIT_CARD', 'BOLETO', 'PIX'].includes(data.billingType)) {
    return { valid: false, error: 'Tipo de pagamento inválido' };
  }
  
  // Validate credit card data if applicable
  if (data.billingType === 'CREDIT_CARD') {
    if (!data.creditCard || !data.creditCardHolderInfo) {
      return { valid: false, error: 'Dados do cartão de crédito são obrigatórios' };
    }
    
    if (!data.creditCard.holderName || data.creditCard.holderName.trim().length < 3) {
      return { valid: false, error: 'Nome do titular deve ter pelo menos 3 caracteres' };
    }
    if (!isValidCardNumber(data.creditCard.number)) {
      return { valid: false, error: 'Número do cartão inválido' };
    }
    if (!isValidCardExpiry(data.creditCard.expiryMonth, data.creditCard.expiryYear)) {
      return { valid: false, error: 'Cartão expirado ou data inválida' };
    }
    if (!isValidCvv(data.creditCard.ccv)) {
      return { valid: false, error: 'CVV inválido' };
    }
    
    // Validate holder info
    if (!data.creditCardHolderInfo.name || data.creditCardHolderInfo.name.trim().length < 3) {
      return { valid: false, error: 'Nome do titular deve ter pelo menos 3 caracteres' };
    }
    if (!isValidEmail(data.creditCardHolderInfo.email)) {
      return { valid: false, error: 'Email do titular inválido' };
    }
    if (!isValidCpfCnpj(data.creditCardHolderInfo.cpfCnpj)) {
      return { valid: false, error: 'CPF/CNPJ do titular inválido' };
    }
    if (!isValidCep(data.creditCardHolderInfo.postalCode)) {
      return { valid: false, error: 'CEP inválido' };
    }
    if (!data.creditCardHolderInfo.addressNumber) {
      return { valid: false, error: 'Número do endereço é obrigatório' };
    }
    if (!isValidPhone(data.creditCardHolderInfo.phone)) {
      return { valid: false, error: 'Telefone do titular inválido' };
    }
  }
  
  return { valid: true };
}

// ==================== API FUNCTIONS ====================

async function createCustomer(customerData: CustomerData) {
  console.log('Creating customer in Asaas:', customerData.email);
  
  const response = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY!,
    },
    body: JSON.stringify({
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone.replace(/\D/g, ''),
      cpfCnpj: customerData.cpfCnpj.replace(/\D/g, ''),
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Error creating customer:', data);
    throw new Error(data.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
  }

  console.log('Customer created successfully:', data.id);
  return data;
}

async function createSubscription(
  customerId: string,
  planValue: number,
  billingType: BillingType,
  creditCard?: CreditCardData,
  creditCardHolderInfo?: CreditCardHolderInfo,
  remoteIp?: string
) {
  console.log('Creating subscription for customer:', customerId, 'with billing type:', billingType);
  
  // Calculate next due date (today or tomorrow)
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);
  const formattedDate = nextDueDate.toISOString().split('T')[0];

  const subscriptionData: Record<string, unknown> = {
    customer: customerId,
    billingType: billingType,
    nextDueDate: formattedDate,
    value: planValue,
    cycle: 'MONTHLY',
    description: 'Plano de Contabilidade',
  };

  // Add credit card data only for credit card payments
  if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
    subscriptionData.creditCard = {
      holderName: creditCard.holderName,
      number: creditCard.number.replace(/\s/g, ''),
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      ccv: creditCard.ccv,
    };
    subscriptionData.creditCardHolderInfo = {
      name: creditCardHolderInfo.name,
      email: creditCardHolderInfo.email,
      cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
      postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
      addressNumber: creditCardHolderInfo.addressNumber,
      phone: creditCardHolderInfo.phone.replace(/\D/g, ''),
    };
    subscriptionData.remoteIp = remoteIp || '0.0.0.0';
  }

  const response = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY!,
    },
    body: JSON.stringify(subscriptionData),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Error creating subscription:', data);
    throw new Error(data.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas');
  }

  console.log('Subscription created successfully:', data.id);
  return data;
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ==================== AUTHENTICATION ====================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated Supabase client
    const supabaseClient = createClient(
      SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Token validation failed:', claimsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user:', userId);

    // ==================== INPUT VALIDATION ====================
    const requestData: SubscriptionRequest = await req.json();
    console.log('Processing subscription request for:', requestData.customer?.email, 'billing type:', requestData.billingType);

    const validation = validateRequest(requestData);
    if (!validation.valid) {
      console.error('Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== BUSINESS LOGIC ====================
    // Create customer in Asaas
    const customer = await createCustomer(requestData.customer);

    // Create subscription with appropriate billing type
    const subscription = await createSubscription(
      customer.id,
      requestData.planValue,
      requestData.billingType,
      requestData.creditCard,
      requestData.creditCardHolderInfo,
      requestData.remoteIp
    );

    return new Response(
      JSON.stringify({
        success: true,
        customerId: customer.id,
        subscriptionId: subscription.id,
        status: subscription.status,
        billingType: requestData.billingType,
        userId: userId, // Return user ID for client to use
        // Include payment info for boleto/pix
        ...(requestData.billingType === 'BOLETO' && subscription.bankSlipUrl && { bankSlipUrl: subscription.bankSlipUrl }),
        ...(requestData.billingType === 'PIX' && subscription.pixQrCodeUrl && { pixQrCodeUrl: subscription.pixQrCodeUrl }),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error in create-subscription function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
