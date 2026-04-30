import OpenAI from "openai"
import { contentHash } from "~/lib/content"

export interface EmbeddingCache {
  get: (contentHashHex: string) => Promise<number[] | null>
  put: (contentHashHex: string, embedding: number[], model: string) => Promise<void>
}

export interface Embedder {
  embed: (content: string) => Promise<number[]>
}

export interface ChatClient {
  complete: (args: ChatArgs) => Promise<string>
}

export interface ChatArgs {
  model?: string
  system: string
  user: string
  responseFormat?: "json_object" | "text"
  temperature?: number
}

export interface OpenAIClientOptions {
  apiKey: string
  embeddingModel: string
  consolidationModel?: string
  cache: EmbeddingCache
  _embeddingsCreate?: OpenAI["embeddings"]["create"]
  _chatCreate?: OpenAI["chat"]["completions"]["create"]
}

export interface OpenAIClient extends Embedder, ChatClient {}

export function createOpenAIClient(opts: OpenAIClientOptions): OpenAIClient {
  const sdk = new OpenAI({ apiKey: opts.apiKey })
  const embeddingsCreate = opts._embeddingsCreate ?? sdk.embeddings.create.bind(sdk.embeddings)
  const chatCreate =
    opts._chatCreate ?? sdk.chat.completions.create.bind(sdk.chat.completions)

  return {
    async embed(content: string): Promise<number[]> {
      const hash = contentHash(content)
      const cached = await opts.cache.get(hash)
      if (cached) return cached

      const res = await embeddingsCreate({ model: opts.embeddingModel, input: content })
      const vec = res.data[0]!.embedding
      await opts.cache.put(hash, vec, opts.embeddingModel)
      return vec
    },
    async complete(args: ChatArgs): Promise<string> {
      const res = await chatCreate({
        model: args.model ?? opts.consolidationModel ?? "gpt-4o-mini",
        temperature: args.temperature ?? 0.2,
        response_format:
          args.responseFormat === "json_object" ? { type: "json_object" } : { type: "text" },
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      })
      return res.choices[0]!.message.content ?? ""
    },
  }
}
