import { ResultAsync } from "neverthrow";

export type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
};

export function fetchJson<T = unknown>(
  url: string,
  options?: FetchJsonOptions,
): ResultAsync<T, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const { timeoutMs = 1000, method = "GET", ...init } = options ?? {};
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...init,
          method,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status code ${response.status}`);
        }

        return (await response.json()) as T;
      } finally {
        clearTimeout(timer);
      }
    })(),
    (error) => (error instanceof Error ? error : new Error("Unknown fetch error")),
  );
}
