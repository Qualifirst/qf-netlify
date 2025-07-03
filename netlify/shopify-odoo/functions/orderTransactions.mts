import { Config } from '@netlify/functions'
import { NetlifyResponse } from '../../../shared/qflib/app/app';
import { Context, AuthMiddleware, EnvCheckMiddleware, ErrorHandlerMiddleware } from '../../../shared/qflib/app/middleware';
import { getOdooData, OdooDataManagerMiddleware } from '../../../shared/qflib/odoo/dataManager';
import { AsyncWorkloadsClient } from '@netlify/async-workloads';

async function handler(request: Request, context: Context): Promise<Response> {
  const data = await request.json();
  if (!data.id) {
    throw new Error('order transaction ID not found in request body');
  }
  if (!data.order_id) {
    throw new Error('order ID not found in request body');
  }
  const orderShopifyId = `gid://shopify/Order/${data.order_id}`;
  const txShopifyId = `gid://shopify/OrderTransaction/${data.id}`;
  const client = new AsyncWorkloadsClient();
  const send = await client.send('orderTransactions-process', {data: {orderShopifyId, txShopifyId, odooData: getOdooData()}});
  if (send.sendStatus === 'succeeded') {
    console.log(`Order ${orderShopifyId} Transaction ${txShopifyId} scheduled`);
    return NetlifyResponse(200, 'OK');
  }
  return NetlifyResponse(500, 'KO');
}

export default async (request: Request, context: Context): Promise<Response> => {
  return (await ErrorHandlerMiddleware(EnvCheckMiddleware(AuthMiddleware(OdooDataManagerMiddleware(Promise.resolve(handler))))))(request, context);
}

export const config: Config = {
  path: '/order_transactions',
  method: 'POST',
};
