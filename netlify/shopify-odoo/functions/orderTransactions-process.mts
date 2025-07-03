import {asyncWorkloadFn, AsyncWorkloadEvent, AsyncWorkloadConfig, ErrorRetryAfterDelay, ErrorDoNotRetry} from '@netlify/async-workloads';
import { ShopifyOdoo } from '../shared/shopify-odoo';
import { setOdooData } from '../../../shared/qflib/odoo/dataManager';
import { RetryOnNonProdAsyncMiddleware } from '../shared/async';

export default asyncWorkloadFn(RetryOnNonProdAsyncMiddleware(async (event: AsyncWorkloadEvent) => {
    setOdooData(event.eventData.odooData);
    const s = new ShopifyOdoo();
    const res = await s.shopifyOrderTransactionToOdoo(event.eventData.orderShopifyId, event.eventData.txShopifyId);
    console.log(`Order Transaction (process) gId=${event.eventData.txShopifyId} oId=${res.odooId} isNew=${res.isNew}`);
}));

export const asyncWorkloadConfig: AsyncWorkloadConfig = {
    events: ['orderTransactions-process'],
};
