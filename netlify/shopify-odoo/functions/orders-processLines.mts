import {asyncWorkloadFn, AsyncWorkloadEvent, AsyncWorkloadConfig} from '@netlify/async-workloads';
import { ShopifyOdoo } from '../shared/shopify-odoo';
import { setOdooData } from '../../../shared/qflib/odoo/dataManager';
import { RetryOnNonProdAsyncMiddleware } from '../shared/async';

export default asyncWorkloadFn(RetryOnNonProdAsyncMiddleware(async (event: AsyncWorkloadEvent) => {
    setOdooData(event.eventData.odooData);
    const s = new ShopifyOdoo();
    await s.shopifyOrderLinesToOdoo(event.eventData.order, event.eventData.odooId);
    console.log(`Order (processLines) gId=${event.eventData.order.id} oId=${event.eventData.odooId}`);
    const send = await event.sendEvent('orders-confirm', {data: {...event.eventData}});
    if (send.sendStatus !== 'succeeded') {
        throw new Error(`error scheduling next step`);
    }
}));

export const asyncWorkloadConfig: AsyncWorkloadConfig = {
    events: ['orders-processLines'],
};
