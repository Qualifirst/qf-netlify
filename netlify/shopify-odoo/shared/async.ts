import { AsyncWorkloadEvent } from "@netlify/async-workloads";
import { sleep } from "../../../shared/qflib/app/helpers";

type AsyncHandler = (event: AsyncWorkloadEvent) => any;

export function RetryOnNonProdAsyncMiddleware(asyncHandler: AsyncHandler): AsyncHandler {
    if (['PROD', 'LOCAL'].includes(process.env.ENV || 'PROD')) {
        return asyncHandler;
    }
    return async (event: AsyncWorkloadEvent) => {
        try {
            await asyncHandler(event);
        } catch (error) {
            if (event.attempt <= 6) {
                console.error('retrying in 3s', error);
                await sleep(3000);
                await event.sendEvent(event.eventName, {data: event.eventData});
            } else {
                console.error('max retries reached, stopping', error);
            }
        }
    };
}
