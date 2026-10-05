import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// Provider abstraction: the rest of the app asks for "structured output for this
// prompt" and never imports a vendor SDK. Swapping providers means adding a class here.

export type StructuredRequest<T extends z.ZodType> = {
  system: string;
  /** stable context first (cacheable), then the task */
  context: string;
  task: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
};

export type StructuredResult<T> = { output: T; model: string; latencyMs: number; inputTokens: number; outputTokens: number };

export class ProviderRefusal extends Error {}

export interface TextProvider {
  readonly id: string;
  readonly model: string;
  generate<T extends z.ZodType>(request: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>>;
}

class AnthropicTextProvider implements TextProvider {
  readonly id = "anthropic";
  private client: Anthropic;
  constructor(apiKey: string, readonly model: string) {
    // explicit key and base URL: never pick up credentials meant for other tools on the machine
    this.client = new Anthropic({ apiKey, baseURL: "https://api.anthropic.com", maxRetries: 2, timeout: 120_000 });
  }

  async generate<T extends z.ZodType>(request: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> {
    const started = Date.now();
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: request.maxTokens ?? 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: request.system },
        // Brand Brain context changes rarely: cache it
        { type: "text", text: request.context, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: request.task }],
      output_config: { effort: request.effort ?? "medium", format: betaZodOutputFormat(request.schema) },
    });
    if (response.stop_reason === "refusal") throw new ProviderRefusal("המודל סירב לבקשה הזו. אפשר לנסח אחרת.");
    if (!response.parsed_output) throw new Error("התשובה לא הגיעה במבנה הצפוי. אפשר לנסות שוב.");
    return {
      output: response.parsed_output as z.infer<T>,
      model: response.model,
      latencyMs: Date.now() - started,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

/** null when no provider is configured; the studio keeps working without one. */
export function getTextProvider(): TextProvider | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return new AnthropicTextProvider(key, process.env.AI_TEXT_MODEL?.trim() || "claude-opus-5-5");
}

// ---------------------------------------------------------------------------
// Image generation: interface only. Real Gallery photos always come first; a
// generated image may only fill backgrounds/textures, never people or the product.

export type ImageRequest = { prompt: string; width: number; height: number; purpose: "background" | "texture" };
export interface ImageProvider {
  readonly id: string;
  generate(request: ImageRequest): Promise<{ data: Uint8Array; mimeType: string }>;
}

export function getImageProvider(): ImageProvider | null {
  // No image model is configured in this build. Add an adapter here (and an env key)
  // when needed; callers already handle null by recommending Gallery photos instead.
  return null;
}
