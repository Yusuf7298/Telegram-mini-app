import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  correlationId: string;
  requestPath?: string;
  requestMethod?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return requestContextStorage.run(context, callback);
}

export function getRequestContext(): RequestContext | null {
  return requestContextStorage.getStore() ?? null;
}

export function getCorrelationId(): string | null {
  return getRequestContext()?.correlationId ?? null;
}
