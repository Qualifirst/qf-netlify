import { Context as NContext } from '@netlify/functions';
import { NetlifyResponse } from './app';

export interface Context extends NContext {}

export type NetlifyFunction = (request: Request, context: Context) => Promise<Response>;

export async function AuthMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: Context): Promise<Response> => {
        const authKey = process.env.AUTH_KEY;
        const headerKey = request.headers.get('authorization');
        if (!authKey || !headerKey || `Bearer ${authKey}` !== headerKey) {
            return NetlifyResponse(500, {error: 'unathorized'});
        }
        return await (await handler)(request, context);
    }
}

export async function ErrorHandlerMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: Context): Promise<Response> => {
        try {
            return await (await handler)(request, context);
        } catch (error) {
            console.error('❌ function error', error);
            return NetlifyResponse(500, {error: 'function error'});
        }
    }
}

export async function EnvCheckMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: Context): Promise<Response> => {
        if (process.env.ENV && (process.env.ENV_DISABLE || '').includes(process.env.ENV!)) {
            return NetlifyResponse(500, {error: 'environment is disabled'});
        }
        return await (await handler)(request, context);
    }
}

export async function CORSMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: Context): Promise<Response> => {
        if (request.method === "OPTIONS") {
            return NetlifyResponse(200, '', {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            });
        }
        const response = await (await handler)(request, context);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
    }
}
