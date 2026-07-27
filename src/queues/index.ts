import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const QUEUE_NAMES = {
  CAPTURA_BRUTA: "captura.bruta",
  PRODUTOS_NORMALIZADOS: "produtos.normalizados",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: redisConnection });
    queues.set(name, queue);
  }
  return queue;
}
