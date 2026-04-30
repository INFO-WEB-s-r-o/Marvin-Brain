import { beforeEach, describe, expect, mock, test } from "bun:test"
import { createOpenAIClient, type Embedder } from "~/lib/openai"

describe("Embedder", () => {
  let mockCreate: ReturnType<typeof mock>
  let cacheGet: ReturnType<typeof mock>
  let cachePut: ReturnType<typeof mock>
  let embedder: Embedder

  beforeEach(() => {
    mockCreate = mock(async () => ({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    }))
    cacheGet = mock(async () => null)
    cachePut = mock(async () => undefined)

    embedder = createOpenAIClient({
      apiKey: "sk-test",
      embeddingModel: "text-embedding-3-small",
      cache: { get: cacheGet, put: cachePut },
      // inject the mock
      _embeddingsCreate: mockCreate as never,
    })
  })

  test("returns cached embedding when present", async () => {
    cacheGet.mockImplementation(async () => [0.9, 0.9, 0.9])
    const v = await embedder.embed("hello")
    expect(v).toEqual([0.9, 0.9, 0.9])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test("calls OpenAI and caches result on miss", async () => {
    const v = await embedder.embed("hello")
    expect(v).toEqual([0.1, 0.2, 0.3])
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(cachePut).toHaveBeenCalledTimes(1)
  })
})
