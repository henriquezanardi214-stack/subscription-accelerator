import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: SubscriptionRequest = await req.json();
    console.log('Processing subscription request for:', requestData.customer.email, 'billing type:', requestData.billingType);

    // Validate required fields
    if (!requestData.customer || !requestData.planValue || !requestData.billingType) {
      throw new Error('Dados incompletos para criar a assinatura');
    }

    // Validate credit card data for credit card billing
    if (requestData.billingType === 'CREDIT_CARD' && (!requestData.creditCard || !requestData.creditCardHolderInfo)) {
      throw new Error('Dados do cartão de crédito são obrigatórios');
    }

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
