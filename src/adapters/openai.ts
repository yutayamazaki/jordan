import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { Result, ok, err } from "neverthrow";
import { z, ZodType } from "zod";

function getOpenAIApiKey(): Result<string, Error> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return err(
      new Error(
        "OPENAI_API_KEY is not set. Please set it in your environment before running this application.",
      ),
    );
  }
  return ok(apiKey);
}

export type StructuredOutputOptions = {
  model: "gpt-5-mini-2025-08-07" | "gpt-5-nano-2025-08-07";
  useWebSearch: boolean;
  reasoningEffort: "minimal" | "low" | "medium" | "high";
};

const DEFAULT_MODEL = "gpt-5-nano-2025-08-07";
const DEFAULT_REASONING_EFFORT: StructuredOutputOptions["reasoningEffort"] = "minimal";

export async function createStructuredOutputs<T extends ZodType>(
  prompt: string,
  schema: T,
  options: StructuredOutputOptions = {
    model: DEFAULT_MODEL,
    useWebSearch: false,
    reasoningEffort: DEFAULT_REASONING_EFFORT,
  },
): Promise<Result<z.infer<T>, Error>> {
  const apiKeyResult = getOpenAIApiKey();
  if (apiKeyResult.isErr()) {
    return err(apiKeyResult.error);
  }

  const openai = new OpenAI({ apiKey: apiKeyResult.value });

  try {
    const response = await openai.responses.parse({
      model: options.model,
      input: prompt,
      tools: options.useWebSearch ? ([{ type: "web_search" }] as any) : undefined,
      text: { format: zodTextFormat(schema, "structured") },
      reasoning: { effort: options.reasoningEffort },
    });
    const parsed = response.output_parsed as z.infer<T> | null;
    if (!parsed) {
      return err(new Error("Failed to parse the response."));
    }
    return ok(parsed);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
