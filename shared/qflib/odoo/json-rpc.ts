import { AppContext } from "../app/middleware";

class OdooModel {
    id: number

    constructor(data: {[key: string]: any}) {
        Object.assign(this, data);
    }
}

class IrModelData extends OdooModel {
    model: string
    module: string
    name: string
    res_id: number

    constructor(data: {[key: string]: any}) {
        super(data);
        Object.assign(this, data);
    }

    xid() {
        return `${this.module}.${this.name}`;
    }
}

export class OdooJsonRPC {
    private ctx: AppContext;

    constructor(ctx: AppContext) {
        this.ctx = ctx;
    }

    private async jsonRpc(service: string, method: string, args: any[]) {
        const db = process.env.ODOO_DB;
        const uid = process.env.ODOO_USER_ID;
        const pwd = process.env.ODOO_PASSWORD;
        const domain = process.env.ODOO_DOMAIN;
        const cfKey = process.env.CLOUDFLARE_BYPASS_WAF;
        if (!db || !uid || !pwd || !domain || !cfKey) {
            throw new Error("invalid Odoo environment variables for JSON RPC call");
        }
        const res = await fetch(`https://${domain}/jsonrpc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cloudflare-Bypass-WAF': cfKey,
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                id: uid,
                params: {
                    service,
                    method,
                    args: [
                        db,
                        uid,
                        pwd,
                        ...args,
                    ],
                }
            })
        });
        if (res.status != 200) {
            throw new Error(`non-200 response from Odoo JSON RPC call: (${res.statusText}) ${await res.text()}`);
        }
        const data = await res.json();
        if (data.error) {
            throw new Error(`error in response from Odoo JSON RPC call: ${JSON.stringify(data.error)}`);
        }
        if (!data.result) {
            throw new Error('result not found in response from Odoo JSON RPC call');
        }
        return data.result;
    }

    async jsonRpcExecuteKw(model: string, method: string, args?: any[], kwargs?: {[key: string]: any}) {
        kwargs = kwargs || {};
        kwargs['context'] = Object.assign(kwargs['context'] || {}, this.ctx.cache.get('OdooContext') || {});
        kwargs['context']['netlify'] = true;
        return this.jsonRpc('object', 'execute_kw', [model, method, args, kwargs]);
    }

    async searchRead(model: string, domain: any[], fields: string[], limit?: number, odooContext?: {[key: string]: any}): Promise<{[key: string]: any}[]> {
        return this.jsonRpcExecuteKw(model, 'search_read', [], {
            domain,
            fields,
            limit,
            context: odooContext,
        });
    }

    async searchIrModelData(model: string, xid: string): Promise<IrModelData | undefined> {
        const cacheKey = `IrModelData.${model}.${xid}`;
        if (this.ctx.cache.has(cacheKey)) {
            return this.ctx.cache.get(cacheKey);
        }
        const [xidModule, xidName] = xid.split('.');
        const domain = [
            ['module', '=', xidModule],
            ['name', '=', xidName],
        ];
        const res = await this.searchRead('ir.model.data', domain, ['id', 'module', 'name', 'model', 'res_id']);
        if (res.length > 1) {
            throw new Error(`ir.model.data search expected at most 1 match for xid ${xid}, got ${res.length}`);
        }
        if (!res.length) {
            return undefined;
        }
        const imd = new IrModelData(res[0]);
        if (imd.model !== model) {
            throw new Error(`model mismatch for xid ${xid}, expected ${model}, got ${imd.model}`);
        }
        this.ctx.cache.set(cacheKey, imd);
        return imd;
    }

    async getIdByXid(model: string, xid: string): Promise<number | undefined> {
        const imd = await this.searchIrModelData(model, xid);
        return imd?.res_id;
    }

    async create(model: string, data: {[key: string]: any}, odooContext?: {[key: string]: any}): Promise<number> {
        odooContext = odooContext || {};
        const xid: string = odooContext['xid']
        delete odooContext['xid']
        const odooId: number = await this.jsonRpcExecuteKw(model, 'create', [data], {
            context: odooContext,
        });
        if (xid) {
            await this.assignXid(model, odooId, xid);
        }
        return odooId;
    }

    async assignXid(model: string, resId: number, xid: string) {
        const [xidModule, xidName] = xid.split('.');
        const imdData = {
            model,
            res_id: resId,
            module: xidModule,
            name: xidName,
        };
        const imdId = await this.jsonRpcExecuteKw('ir.model.data', 'create', [imdData]);
        const imd = new IrModelData({
            id: imdId,
            ...imdData,
        });
        const cacheKey = `IrModelData.${model}.${xid}`;
        this.ctx.cache.set(cacheKey, imd);
    }

    async write(model: string, ids: number[], data: {[key: string]: any}, odooContext?: {[key: string]: any}) {
        await this.jsonRpcExecuteKw(model, 'write', [ids, data], {context: odooContext})
    }
}
