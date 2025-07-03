import {asyncWorkloadFn, AsyncWorkloadEvent, AsyncWorkloadConfig} from '@netlify/async-workloads';
import { ShopifyOdoo } from '../shared/shopify-odoo';
import { setOdooData } from '../../../shared/qflib/odoo/dataManager';
import { RetryOnNonProdAsyncMiddleware } from '../shared/async';

export default asyncWorkloadFn(RetryOnNonProdAsyncMiddleware(async (event: AsyncWorkloadEvent) => {
    setOdooData(event.eventData.odooData);
    const gId = event.eventData.gId;
    const s = new ShopifyOdoo();
    const res = await s.shopifyOrderToOdoo(gId);
    console.log(`Order (process) gId=${gId} oId=${res.odooId} isNew=${res.isNew}`);
    const send = await event.sendEvent('orders-processLines', {data: {...event.eventData, ...res}});
    if (send.sendStatus !== 'succeeded') {
        throw new Error(`error scheduling next step`);
    }
}));

export const asyncWorkloadConfig: AsyncWorkloadConfig = {
    events: ['orders-process'],
};
