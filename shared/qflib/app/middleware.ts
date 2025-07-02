import { Context } from '@netlify/functions';
import { NetlifyResponse } from './app';

export interface AppContext extends Context {
    cache: Map<string, any>;
}

export type NetlifyFunction = (request: Request, context: AppContext) => Promise<Response>;

export async function AuthMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: AppContext): Promise<Response> => {
        const authKey = process.env.AUTH_KEY;
        const headerKey = request.headers.get('authorization');
        if (!authKey || !headerKey || `Bearer ${authKey}` !== headerKey) {
            return NetlifyResponse(500, {error: 'unathorized'});
        }
        return await (await handler)(request, context);
    }
}

export async function ErrorHandlerMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: AppContext): Promise<Response> => {
        try {
            return await (await handler)(request, context);
        } catch (error) {
            console.error('❌ function error', error);
            return NetlifyResponse(500, {error: 'function error'});
        }
    }
}

export async function EnvCheckMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: AppContext): Promise<Response> => {
        if (process.env.ENV && (process.env.ENV_DISABLE || '').includes(process.env.ENV!)) {
            return NetlifyResponse(500, {error: 'environment is disabled'});
        }
        return await (await handler)(request, context);
    }
}

export async function CacheMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: AppContext): Promise<Response> => {
        context.cache = new Map<string, any>();

        return await (await handler)(request, context);
    }
}
