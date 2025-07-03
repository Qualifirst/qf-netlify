import {asyncWorkloadFn, AsyncWorkloadEvent, AsyncWorkloadConfig} from '@netlify/async-workloads';

export default asyncWorkloadFn((event: AsyncWorkloadEvent) => {
    console.log('EVENT', event);
});

export const asyncWorkloadConfig: AsyncWorkloadConfig = {
    events: ['orders-process'],
};
