import {
    listModels,
    chatCompletion,
    summarizeArticle,
    translateText,
    translateTextByParagraph,
    AiConfig,
} from "../aiClient"

// Mock global fetch
global.fetch = jest.fn()

const mockConfig: AiConfig = {
    baseUrl: "https://api.example.com/v1",
    apiKey: "test-key",
    defaultModel: "gpt-test",
}

describe("aiClient", () => {
    beforeEach(() => {
        ;(global.fetch as jest.Mock).mockClear()
    })

    describe("listModels", () => {
        it("should return a list of model IDs from OpenAI format", async () => {
            const mockResponse = {
                data: [{ id: "model-1" }, { id: "model-2" }],
            }
            ;(global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            })

            const models = await listModels(mockConfig)
            expect(models).toEqual(["model-1", "model-2"])
            expect(fetch).toHaveBeenCalledWith(
                "https://api.example.com/v1/models",
                expect.objectContaining({
                    method: "GET",
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-key",
                    }),
                })
            )
        })

        it("should handle errors gracefully", async () => {
            ;(global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            })

            await expect(listModels(mockConfig)).rejects.toThrow(
                "Failed to list models: 500 Internal Server Error"
            )
        })
    })

    describe("chatCompletion", () => {
        it("should return the generated text", async () => {
            const mockResponse = {
                choices: [{ message: { content: "Hello world" } }],
            }
            ;(global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            })

            const response = await chatCompletion(mockConfig, {
                messages: [{ role: "user", content: "Hi" }],
            })

            expect(response).toBe("Hello world")
            expect(fetch).toHaveBeenCalledWith(
                "https://api.example.com/v1/chat/completions",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        model: "gpt-test",
                        messages: [{ role: "user", content: "Hi" }],
                        temperature: 0.7,
                        max_tokens: 2000,
                        stream: false,
                    }),
                })
            )
        })
    })

    describe("summarizeArticle", () => {
        it("should call chatCompletion with correct prompt", async () => {
            const mockResponse = {
                choices: [{ message: { content: "Summary of the article." } }],
            }
            ;(global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            })

            const summary = await summarizeArticle(mockConfig, "Article content")
            expect(summary).toBe("Summary of the article.")

            // Verify the prompt structure
            const lastCall = (global.fetch as jest.Mock).mock.calls[0]
            const body = JSON.parse(lastCall[1].body)
            expect(body.messages[0].role).toBe("system")
            expect(body.messages[0].content).toContain("摘要助手")
            expect(body.messages[1].content).toContain("Article content")
        })
    })

    describe("translateText", () => {
        it("should call chatCompletion with correct prompt for translation", async () => {
            const mockResponse = {
                choices: [{ message: { content: "Translated text" } }],
            }
            ;(global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            })

            const translation = await translateText(mockConfig, "Original text", "en")
            expect(translation).toBe("Translated text")

            const lastCall = (global.fetch as jest.Mock).mock.calls[0]
            const body = JSON.parse(lastCall[1].body)
            expect(body.messages[0].role).toBe("system")
            expect(body.messages[0].content).toContain("翻译助手")
            expect(body.messages[1].content).toBe("Original text")
        })
    })

    describe("translateTextByParagraph", () => {
        it("should throw error when translation contains failure message (case insensitive)", async () => {
            const mockResponse = {
                choices: [{ message: { content: "Translation Failed: server error" } }],
            }
            ;(global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            })

            // We use the imported translateTextByParagraph

            // It retries, so we need to mock multiple failures or just expect it to eventually fail/retry
            // Since we can't easily control the retry loop without more complex mocking,
            // we'll check if it detects the failure.
            // However, the function catches the error and retries.
            // To verify the regex, we can check if it *rejects* the result and tries again.
            // We can spy on console.warn to see if it logs a retry.

            const consoleSpy = jest.spyOn(console, "warn").mockImplementation()

            // Mock fetch to return failure once then success
            ;(global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: "Translation Failed" } }],
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: "Success" } }] }),
                })

            const results = await translateTextByParagraph(mockConfig, ["Hello"])

            expect(results[0].translated).toBe("Success")
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("Translation failed for paragraph 0")
            )

            consoleSpy.mockRestore()
        })
    })
})
