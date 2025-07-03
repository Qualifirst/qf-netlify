import { WithCache } from "../app/app";
import { getOdooData } from "./dataManager";

class OdooModel {
    id: number

    static fromValues<T extends OdooModel>(model: { new (...args: any[]): T }, values: {[key: string]: any}): T {
        const o = new model();
        for (const key of Object.keys(o)) {
            o[key] = values[key];
        }
        return o;
    }
}

class IrModelData extends OdooModel {
    model: string
    module: string
    name: string
    res_id: number

    static build(model: string, xid: string, res_id?: number) {
        const [xidModule, xidName] = xid.split('.');
        return OdooModel.fromValues(IrModelData, {
            model: model,
            module: xidModule,
            name: xidName,
            res_id: res_id,
        });
    }

    xid() {
        return `${this.module}.${this.name}`;
    }

    asObject() {
        return {
            model: this.model,
            module: this.module,
            name: this.name,
            res_id: this.res_id,
            xid: this.xid(),
        };
    }
}

export class OdooJsonRPC extends WithCache {
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
        kwargs['context'] = Object.assign(kwargs['context'] || {}, this.cache.get('OdooContext') || {});
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

    async prefetchIrModelData(xids: IrModelData[]): Promise<{[key: string]: IrModelData}> {
        const cacheKey = (xid: string) => `IrModelData.FromOdoo.${xid}`;
        const searchXids = xids.filter((xid) => !this.cache.has(cacheKey(xid.xid()))).map((xid) => xid.asObject());
        const res = await this.jsonRpcExecuteKw('ir.actions.server', 'run', [getOdooData()!.actions.get_xids], {context: {xids: searchXids}});
        if (!res.response) {
            throw new Error(`empty response fetching Odoo XIDs`);
        }
        for (const imdData of res.response) {
            if (imdData.error) {
                throw new Error(`xid error for ${imdData.module}.${imdData.name}: ${imdData.error}`);
            }
            const imd = OdooModel.fromValues(IrModelData, imdData);
            this.cache.set(cacheKey(imd.xid()), imd);
        }
        const imds = {};
        for (const xid of xids) {
            imds[xid.xid()] = this.cache.get(cacheKey(xid.xid()));
        }
        return imds;
    }

    async searchIrModelData(model: string, xid: string): Promise<IrModelData | undefined> {
        const cacheKey = `IrModelData.${model}.${xid}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        const imd = (await this.prefetchIrModelData([IrModelData.build(model, xid)]))[xid];
        if (imd) {
            this.cache.set(cacheKey, imd);
        }
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
        const imd = OdooModel.fromValues(IrModelData, {
            id: imdId,
            ...imdData,
        });
        const cacheKey = `IrModelData.${model}.${xid}`;
        this.cache.set(cacheKey, imd);
    }

    async write(model: string, ids: number[], data: {[key: string]: any}, odooContext?: {[key: string]: any}) {
        await this.jsonRpcExecuteKw(model, 'write', [ids, data], {context: odooContext})
    }
}
