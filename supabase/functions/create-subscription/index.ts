import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

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
  creditCard: CreditCardData;
  creditCardHolderInfo: CreditCardHolderInfo;
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
  creditCard: CreditCardData,
  creditCardHolderInfo: CreditCardHolderInfo,
  remoteIp: string
) {
  console.log('Creating subscription for customer:', customerId);
  
  // Calculate next due date (today or tomorrow)
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);
  const formattedDate = nextDueDate.toISOString().split('T')[0];

  const subscriptionData = {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    nextDueDate: formattedDate,
    value: planValue,
    cycle: 'MONTHLY',
    description: 'Plano de Contabilidade',
    creditCard: {
      holderName: creditCard.holderName,
      number: creditCard.number.replace(/\s/g, ''),
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      ccv: creditCard.ccv,
    },
    creditCardHolderInfo: {
      name: creditCardHolderInfo.name,
      email: creditCardHolderInfo.email,
      cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
      postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
      addressNumber: creditCardHolderInfo.addressNumber,
      phone: creditCardHolderInfo.phone.replace(/\D/g, ''),
    },
    remoteIp: remoteIp,
  };

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
    console.log('Processing subscription request for:', requestData.customer.email);

    // Validate required fields
    if (!requestData.customer || !requestData.creditCard || !requestData.planValue) {
      throw new Error('Dados incompletos para criar a assinatura');
    }

    // Create customer in Asaas
    const customer = await createCustomer(requestData.customer);

    // Create subscription with credit card
    const subscription = await createSubscription(
      customer.id,
      requestData.planValue,
      requestData.creditCard,
      requestData.creditCardHolderInfo,
      requestData.remoteIp || '0.0.0.0'
    );

    return new Response(
      JSON.stringify({
        success: true,
        customerId: customer.id,
        subscriptionId: subscription.id,
        status: subscription.status,
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
