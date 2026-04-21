import Bull from "bull";
import config from "../config/env.js";
import logger from "../utils/logger.js";
import { webhookService } from "./webhook.service.js";

let webhookQueue = null;

const createQueue = () => {
  if (!config.redis.url) return null;

  return new Bull("pointsmate-webhooks", config.redis.url, {
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
};

const startWebhookQueueWorker = () => {
  webhookQueue = createQueue();

  if (!webhookQueue) {
    logger.warn("REDIS_URL missing; webhook queue disabled, processing inline");
    return;
  }

  webhookQueue.process(async (job) => {
    await webhookService.processWebhookJob(job.data);
  });

  webhookQueue.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err?.message }, "Webhook queue job failed");
  });
};

const enqueueWebhook = async (jobData) => {
  if (!webhookQueue) {
    await webhookService.processWebhookJob(jobData);
    return;
  }

  await webhookQueue.add(jobData);
};

export { enqueueWebhook, startWebhookQueueWorker };
