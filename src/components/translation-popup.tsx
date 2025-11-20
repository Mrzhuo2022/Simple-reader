import * as React from "react"
import intl from "react-intl-universal"
import {
    Callout,
    Spinner,
    SpinnerSize,
    Text,
    Stack,
    IconButton,
    DirectionalHint,
} from "@fluentui/react"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"
import { closeTranslationPopup } from "../scripts/models/app"
import { translateText } from "../scripts/models/services/aiClient"

export const TranslationPopup = () => {
    const dispatch = useAppDispatch()
    const { display, text, position } = useAppSelector(state => state.app.textTranslation)
    const [translation, setTranslation] = React.useState<string>("")
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!display || !text) return

        setLoading(true)
        setError(null)
        setTranslation("")

        const aiConfigs = window.settings.getAIConfigs()
        if (
            !aiConfigs.enabled ||
            !aiConfigs.apiKey ||
            !aiConfigs.defaultModel ||
            !aiConfigs.baseUrl
        ) {
            setError(intl.get("ai.notEnabled"))
            setLoading(false)
            return
        }

        // 与文章翻译保持一致的策略，尊重设置中的翻译方向
        const translateWhen = aiConfigs.translateWhen || "auto"
        const translateTarget = aiConfigs.translateTarget || "zh"

        const sample = (text || "").replace(/<[^>]*>/g, "")
        const isZh = /[\u4e00-\u9fa5]/.test(sample || "")

        let shouldTranslate = true
        switch (translateWhen) {
            case "nonTargetOnly":
                shouldTranslate = translateTarget === "zh" ? !isZh : isZh
                break
            case "zhOnly":
                shouldTranslate = isZh
                break
            case "nonZhOnly":
                shouldTranslate = !isZh
                break
            case "always":
            case "auto":
            default:
                shouldTranslate = true
                break
        }

        if (!shouldTranslate) {
            setLoading(false)
            setTranslation("")
            return
        }

        const targetLang =
            translateWhen === "auto" ? (isZh ? "en" : "zh") : (translateTarget as "zh" | "en")

        const controller = new AbortController()

        translateText(
            {
                baseUrl: aiConfigs.baseUrl,
                apiKey: aiConfigs.apiKey,
                defaultModel: aiConfigs.defaultModel,
                prompts: aiConfigs.prompts,
            },
            text,
            targetLang,
            controller.signal
        )
            .then(result => {
                setTranslation(result)
            })
            .catch(err => {
                if (
                    (err instanceof Error || err instanceof DOMException) &&
                    err.name !== "AbortError"
                ) {
                    console.error("Translation error:", err)
                    setError(intl.get("ai.failed"))
                }
            })
            .finally(() => {
                setLoading(false)
            })

        return () => controller.abort()
    }, [display, text])

    if (!display || !position) return null

    return (
        <Callout
            target={{ x: position[0], y: position[1] }}
            onDismiss={() => dispatch(closeTranslationPopup())}
            directionalHint={DirectionalHint.bottomLeftEdge}
            gapSpace={0}
            styles={{
                calloutMain: {
                    maxWidth: 400,
                    minWidth: 200,
                    padding: 16,
                },
            }}
            setInitialFocus
        >
            <Stack tokens={{ childrenGap: 12 }}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <Text
                        variant="smallPlus"
                        styles={{
                            root: { fontWeight: 600, color: "#666" },
                        }}
                    >
                        {intl.get("ai.translate")}
                    </Text>
                    <IconButton
                        iconProps={{ iconName: "Cancel" }}
                        title={intl.get("close")}
                        onClick={() => dispatch(closeTranslationPopup())}
                        styles={{
                            root: { height: 24, width: 24, margin: -4 },
                        }}
                    />
                </Stack>

                {loading && (
                    <Spinner size={SpinnerSize.medium} label={intl.get("ai.translating")} />
                )}

                {error && <Text styles={{ root: { color: "#d13438" } }}>{error}</Text>}

                {translation && (
                    <Text styles={{ root: { whiteSpace: "pre-wrap" } }}>{translation}</Text>
                )}
            </Stack>
        </Callout>
    )
}
