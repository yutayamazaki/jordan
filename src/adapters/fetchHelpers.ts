import { z } from 'zod';
import { Result, ok, err } from 'neverthrow';

type FetchError = 
  | { type: 'network'; message: string }
  | { type: 'http'; status: number; statusText: string }
  | { type: 'parse'; message: string }
  | { type: 'validation'; errors: z.ZodError };

export async function fetchJson<T>(
  url: string,
  schema: z.ZodSchema<T>,
  options?: RequestInit
): Promise<Result<T, FetchError>> {
  try {
    // HTTPリクエストを送信
    const response = await fetch(url, options);

    // HTTPステータスチェック
    if (!response.ok) {
      return err({
        type: 'http',
        status: response.status,
        statusText: response.statusText,
      });
    }

    // JSONパース
    let jsonData: unknown;
    try {
      jsonData = await response.json();
    } catch (e) {
      return err({
        type: 'parse',
        message: e instanceof Error ? e.message : 'Failed to parse JSON',
      });
    }

    // Zodバリデーション
    const parseResult = schema.safeParse(jsonData);
    if (!parseResult.success) {
      return err({
        type: 'validation',
        errors: parseResult.error,
      });
    }

    return ok(parseResult.data);
  } catch (e) {
    // ネットワークエラーなど
    return err({
      type: 'network',
      message: e instanceof Error ? e.message : 'Unknown network error',
    });
  }
}
