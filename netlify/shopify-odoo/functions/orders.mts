import { Config } from '@netlify/functions'
import { NetlifyResponse } from '../../../shared/qflib/app/app';
import { Context, AuthMiddleware, EnvCheckMiddleware, ErrorHandlerMiddleware } from '../../../shared/qflib/app/middleware';
import { getOdooData, OdooDataManagerMiddleware } from '../../../shared/qflib/odoo/dataManager';
import { AsyncWorkloadsClient } from '@netlify/async-workloads';

async function handler(request: Request, context: Context): Promise<Response> {
  const data = await request.json();
  const gId = data.admin_graphql_api_id;
  if (!gId) {
    throw new Error('order Admin API ID not in request body');
  }
  const client = new AsyncWorkloadsClient();
  const send = await client.send('orders-process', {data: {gId: gId, odooData: getOdooData()}});
  if (send.sendStatus === 'succeeded') {
    console.log(`Order ${gId} scheduled`);
    return NetlifyResponse(200, 'OK');
  }
  return NetlifyResponse(500, 'KO');
}

export default async (request: Request, context: Context): Promise<Response> => {
  return (await ErrorHandlerMiddleware(EnvCheckMiddleware(AuthMiddleware(OdooDataManagerMiddleware(Promise.resolve(handler))))))(request, context);
}

export const config: Config = {
  path: '/orders',
  method: 'POST',
};
