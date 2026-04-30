import { beforeEach, describe, expect, mock, test } from "bun:test"
import { createLightRAGClient } from "~/lib/lightrag"

describe("LightRAGClient", () => {
  let mockFetch: ReturnType<typeof mock>

  beforeEach(() => {
    mockFetch = mock(async () => new Response(JSON.stringify({ entities: [], relations: [] })))
  })

  test("query() POSTs to /query with hybrid mode", async () => {
    const client = createLightRAGClient({
      baseUrl: "http://lightrag:8000",
      _fetch: mockFetch as never,
    })
    await client.query("plants", { topK: 5 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toBe("http://lightrag:8000/query")
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.query).toBe("plants")
    expect(body.mode).toBe("hybrid")
    expect(body.top_k).toBe(5)
  })

  test("index() never throws on network error", async () => {
    mockFetch.mockImplementation(async () => {
      throw new Error("network down")
    })
    const client = createLightRAGClient({
      baseUrl: "http://lightrag:8000",
      _fetch: mockFetch as never,
    })
    await expect(client.index("t1", "hello")).resolves.toBeUndefined()
  })
})
