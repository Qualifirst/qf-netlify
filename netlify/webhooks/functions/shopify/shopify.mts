import { Config } from '@netlify/functions'
import { PublishMessage } from '../../../../shared/qflib/rabbitmq/rabbitmq'
import { ValidateWebhook } from '../../../../shared/qflib/shopify/shopify'
import { Context, EnvCheckMiddleware, ErrorHandlerMiddleware } from '../../../../shared/qflib/app/middleware'
import { NetlifyResponse } from '../../../../shared/qflib/app/app';

async function handler(request: Request, context: Context): Promise<Response> {
  await ValidateWebhook(request.clone());
  const topic = request.headers.get('x-shopify-topic')!.replaceAll('/', '.');
  await PublishMessage(
    'shopify.webhook',
    topic,
    await request.text(),
    {
      'X-Shopify-Topic': topic,
      'Content-Type': 'application/json',
    },
  );
  return NetlifyResponse(200, "OK");
}

export default async (request: Request, context: Context): Promise<Response> => {
  return (await ErrorHandlerMiddleware(EnvCheckMiddleware(Promise.resolve(handler))))(request, context);
}

export const config: Config = {
  path: ['/shopify'],
  method: 'POST',
};
