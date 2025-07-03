import {asyncWorkloadFn, AsyncWorkloadEvent, AsyncWorkloadConfig} from '@netlify/async-workloads';
import { ShopifyOdoo } from '../shared/shopify-odoo';
import { setOdooData } from '../../../shared/qflib/odoo/dataManager';
import { RetryOnNonProdAsyncMiddleware } from '../shared/async';

export default asyncWorkloadFn(RetryOnNonProdAsyncMiddleware(async (event: AsyncWorkloadEvent) => {
    setOdooData(event.eventData.odooData);
    const s = new ShopifyOdoo();
    await s.confirmOdooOrder(event.eventData.odooId);
    console.log(`Order (confirm) gId=${event.eventData.order.id} oId=${event.eventData.odooId}`);
}));

export const asyncWorkloadConfig: AsyncWorkloadConfig = {
    events: ['orders-confirm'],
};
