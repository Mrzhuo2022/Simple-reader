import * as React from "react"
import intl from "react-intl-universal"
import { AIConfigs } from "../../schema-types"
import {
    Stack,
    Label,
    Toggle,
    TextField,
    PrimaryButton,
    DefaultButton,
    Dropdown,
    IDropdownOption,
    MessageBar,
    MessageBarType,
    Spinner,
    SpinnerSize,
} from "@fluentui/react"
import { listModels } from "../../scripts/models/services/aiClient"

type AITabProps = Record<string, never>

type AITabState = {
    configs: AIConfigs
    testing: boolean
    loadingModels: boolean
    message: {
        type: MessageBarType
        text: string
    } | null
}

class AITab extends React.Component<AITabProps, AITabState> {
    constructor(props: AITabProps) {
        super(props)
        this.state = {
            configs: window.settings.getAIConfigs(),
            testing: false,
            loadingModels: false,
            message: null,
        }
    }

    handleToggle = (checked: boolean) => {
        this.setState(
            prevState => ({
                configs: { ...prevState.configs, enabled: checked },
            }),
            this.saveConfigs
        )
    }

    handleAutoSummaryToggle = (checked: boolean) => {
        this.setState(
            prevState => ({
                configs: { ...prevState.configs, autoSummary: checked },
            }),
            this.saveConfigs
        )
    }

    handleAutoImmersiveToggle = (checked: boolean) => {
        this.setState(
            prevState => ({
                configs: { ...prevState.configs, autoTranslateImmersive: checked },
            }),
            this.saveConfigs
        )
    }

    handleBaseUrlChange = (
        _: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        this.setState(prevState => ({
            configs: { ...prevState.configs, baseUrl: newValue || "" },
        }))
    }

    handleApiKeyChange = (
        _: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        this.setState(prevState => ({
            configs: { ...prevState.configs, apiKey: newValue || "" },
        }))
    }

    handleModelChange = (_: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option) {
            this.setState(
                prevState => ({
                    configs: {
                        ...prevState.configs,
                        defaultModel: option.key as string,
                    },
                }),
                this.saveConfigs
            )
        }
    }

    handleTranslateTargetChange = (
        _: React.FormEvent<HTMLDivElement>,
        option?: IDropdownOption
    ) => {
        if (option) {
            this.setState(
                prevState => ({
                    configs: {
                        ...prevState.configs,
                        translateTarget: option.key as "zh" | "en",
                    },
                }),
                this.saveConfigs
            )
        }
    }

    handleTranslateWhenChange = (_: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        if (option) {
            this.setState(
                prevState => ({
                    configs: {
                        ...prevState.configs,
                        translateWhen: option.key as
                            | "auto"
                            | "nonTargetOnly"
                            | "always"
                            | "zhOnly"
                            | "nonZhOnly",
                    },
                }),
                this.saveConfigs
            )
        }
    }

    handleConcurrencyChange = (
        _: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        const val = parseInt(newValue || "5", 10)
        this.setState(
            prevState => ({
                configs: { ...prevState.configs, concurrency: isNaN(val) ? 5 : val },
            }),
            this.saveConfigs
        )
    }

    handleMaxTextLengthChange = (
        _: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        const val = parseInt(newValue || "1500", 10)
        this.setState(
            prevState => ({
                configs: { ...prevState.configs, maxTextLengthPerRequest: isNaN(val) ? 1500 : val },
            }),
            this.saveConfigs
        )
    }

    handleMaxParagraphsChange = (
        _: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        const val = parseInt(newValue || "1", 10)
        this.setState(
            prevState => ({
                configs: { ...prevState.configs, maxParagraphsPerRequest: isNaN(val) ? 1 : val },
            }),
            this.saveConfigs
        )
    }

    saveConfigs = () => {
        window.settings.setAIConfigs(this.state.configs)
    }

    testConnection = async () => {
        const { configs } = this.state

        if (!configs.baseUrl || !configs.apiKey) {
            this.setState({
                message: {
                    type: MessageBarType.error,
                    text: intl.get("ai.errorMissingConfig"),
                },
            })
            return
        }

        this.setState({ testing: true, message: null })

        try {
            const models = await listModels({
                baseUrl: configs.baseUrl,
                apiKey: configs.apiKey,
                defaultModel: configs.defaultModel,
            })

            if (models.length > 0) {
                this.setState({
                    testing: false,
                    message: {
                        type: MessageBarType.success,
                        text: intl.get("ai.testSuccess"),
                    },
                })
            } else {
                this.setState({
                    testing: false,
                    message: {
                        type: MessageBarType.warning,
                        text: intl.get("ai.noModelsFound"),
                    },
                })
            }
        } catch (error) {
            this.setState({
                testing: false,
                message: {
                    type: MessageBarType.error,
                    text: `${intl.get("ai.testFailed")}: ${error.message}`,
                },
            })
        }
    }

    refreshModels = async () => {
        const { configs } = this.state

        if (!configs.baseUrl || !configs.apiKey) {
            this.setState({
                message: {
                    type: MessageBarType.error,
                    text: intl.get("ai.errorMissingConfig"),
                },
            })
            return
        }

        this.setState({ loadingModels: true, message: null })

        try {
            const models = await listModels({
                baseUrl: configs.baseUrl,
                apiKey: configs.apiKey,
                defaultModel: configs.defaultModel,
            })

            if (models.length > 0) {
                const newConfigs = {
                    ...configs,
                    availableModels: models,
                    defaultModel: configs.defaultModel || models[0],
                }
                this.setState(
                    {
                        configs: newConfigs,
                        loadingModels: false,
                        message: {
                            type: MessageBarType.success,
                            text: intl.get("ai.modelsRefreshed", {
                                count: models.length,
                            }),
                        },
                    },
                    this.saveConfigs
                )
            } else {
                this.setState({
                    loadingModels: false,
                    message: {
                        type: MessageBarType.warning,
                        text: intl.get("ai.noModelsFound"),
                    },
                })
            }
        } catch (error) {
            this.setState({
                loadingModels: false,
                message: {
                    type: MessageBarType.error,
                    text: `${intl.get("ai.refreshFailed")}: ${error.message}`,
                },
            })
        }
    }

    clearAICache = async () => {
        const confirmed = await window.utils.showMessageBox(
            intl.get("ai.title"),
            intl.get("ai.clearCacheConfirm"),
            intl.get("confirm"),
            intl.get("cancel"),
            true,
            "warning"
        )
        if (!confirmed) return

        try {
            await window.settings.clearOldAICache(0)
            this.setState({
                message: {
                    type: MessageBarType.success,
                    text: intl.get("ai.clearCacheSuccess"),
                },
            })
        } catch (error) {
            this.setState({
                message: {
                    type: MessageBarType.error,
                    text: `${intl.get("ai.clearCacheFailed")}: ${error.message}`,
                },
            })
        }
    }

    modelOptions = (): IDropdownOption[] => {
        const { configs } = this.state
        if (configs.availableModels.length === 0) {
            return [
                {
                    key: configs.defaultModel,
                    text: configs.defaultModel || intl.get("ai.noModel"),
                },
            ]
        }
        return configs.availableModels.map(model => ({
            key: model,
            text: model,
        }))
    }

    translateTargetOptions = (): IDropdownOption[] => [
        { key: "zh", text: intl.get("ai.lang.zh") },
        { key: "en", text: intl.get("ai.lang.en") },
    ]

    translateWhenOptions = (): IDropdownOption[] => [
        { key: "auto", text: intl.get("ai.when.auto") },
        { key: "nonTargetOnly", text: intl.get("ai.when.nonTargetOnly") },
        { key: "always", text: intl.get("ai.when.always") },
        { key: "zhOnly", text: intl.get("ai.when.zhOnly") },
        { key: "nonZhOnly", text: intl.get("ai.when.nonZhOnly") },
    ]

    render() {
        const { configs, testing, loadingModels, message } = this.state

        return (
            <Stack className="settings-tab" tokens={{ childrenGap: 12 }}>
                <Label>{intl.get("ai.title")}</Label>

                {message && (
                    <MessageBar
                        messageBarType={message.type}
                        isMultiline={false}
                        onDismiss={() => this.setState({ message: null })}
                    >
                        {message.text}
                    </MessageBar>
                )}

                <Toggle
                    label={intl.get("ai.enable")}
                    checked={configs.enabled}
                    onChange={(_, checked) => this.handleToggle(checked)}
                />

                <Toggle
                    label={intl.get("ai.autoSummary")}
                    checked={!!configs.autoSummary}
                    onChange={(_, checked) => this.handleAutoSummaryToggle(checked)}
                    disabled={!configs.enabled}
                    onText={intl.get("ai.autoSummary")}
                    offText={intl.get("ai.autoSummary")}
                />

                <Toggle
                    label={intl.get("ai.autoTranslateImmersive")}
                    checked={!!configs.autoTranslateImmersive}
                    onChange={(_, checked) => this.handleAutoImmersiveToggle(checked)}
                    disabled={!configs.enabled}
                    onText={intl.get("ai.autoTranslateImmersive")}
                    offText={intl.get("ai.autoTranslateImmersive")}
                />

                <TextField
                    label={intl.get("ai.baseUrl")}
                    value={configs.baseUrl}
                    onChange={this.handleBaseUrlChange}
                    onBlur={this.saveConfigs}
                    placeholder="https://api.openai.com/v1"
                    description={intl.get("ai.baseUrlDesc")}
                    disabled={!configs.enabled}
                />

                <TextField
                    label={intl.get("ai.apiKey")}
                    value={configs.apiKey}
                    onChange={this.handleApiKeyChange}
                    onBlur={this.saveConfigs}
                    type="password"
                    placeholder="sk-..."
                    description={intl.get("ai.apiKeyDesc")}
                    disabled={!configs.enabled}
                />

                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <PrimaryButton
                        text={intl.get("ai.testConnection")}
                        onClick={this.testConnection}
                        disabled={
                            !configs.enabled || testing || !configs.baseUrl || !configs.apiKey
                        }
                    />
                    {testing && <Spinner size={SpinnerSize.medium} />}
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="end">
                    <Dropdown
                        label={intl.get("ai.model")}
                        selectedKey={configs.defaultModel}
                        options={this.modelOptions()}
                        onChange={this.handleModelChange}
                        disabled={!configs.enabled || configs.availableModels.length === 0}
                        styles={{ root: { width: 300 } }}
                    />
                    <DefaultButton
                        text={intl.get("ai.refreshModels")}
                        onClick={this.refreshModels}
                        disabled={
                            !configs.enabled || loadingModels || !configs.baseUrl || !configs.apiKey
                        }
                    />
                    {loadingModels && <Spinner size={SpinnerSize.medium} />}
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <Dropdown
                        label={intl.get("ai.translateWhen")}
                        selectedKey={this.state.configs.translateWhen || "auto"}
                        options={this.translateWhenOptions()}
                        onChange={this.handleTranslateWhenChange}
                        disabled={!configs.enabled}
                        styles={{ root: { width: 300 } }}
                    />
                    <Dropdown
                        label={intl.get("ai.translateTarget")}
                        selectedKey={this.state.configs.translateTarget || "zh"}
                        options={this.translateTargetOptions()}
                        onChange={this.handleTranslateTargetChange}
                        disabled={!configs.enabled}
                        styles={{ root: { width: 300 } }}
                    />
                </Stack>

                <Label>高级设置</Label>
                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label="并发请求数"
                        type="number"
                        value={String(configs.concurrency || 5)}
                        onChange={this.handleConcurrencyChange}
                        disabled={!configs.enabled}
                        min={1}
                        max={20}
                        description="同时进行的翻译请求数量 (推荐 3-5)"
                    />
                    <TextField
                        label="单次请求最大段落数"
                        type="number"
                        value={String(configs.maxParagraphsPerRequest || 1)}
                        onChange={this.handleMaxParagraphsChange}
                        disabled={!configs.enabled}
                        min={1}
                        max={20}
                        description="合并多个段落以减少请求次数 (推荐 1-5)"
                    />
                    <TextField
                        label="单次请求最大字符数"
                        type="number"
                        value={String(configs.maxTextLengthPerRequest || 1500)}
                        onChange={this.handleMaxTextLengthChange}
                        disabled={!configs.enabled}
                        min={100}
                        max={10000}
                        description="超过限制将强制截断批次"
                    />
                </Stack>

                <TextField
                    label="自定义摘要提示词 (留空使用默认)"
                    multiline
                    rows={3}
                    value={configs.prompts?.summary || ""}
                    onChange={(_, newValue) => {
                        this.setState(
                            prevState => ({
                                configs: {
                                    ...prevState.configs,
                                    prompts: { ...prevState.configs.prompts, summary: newValue },
                                },
                            }),
                            this.saveConfigs
                        )
                    }}
                    disabled={!configs.enabled}
                />
                <TextField
                    label="自定义翻译提示词 (留空使用默认)"
                    multiline
                    rows={3}
                    value={configs.prompts?.translation || ""}
                    onChange={(_, newValue) => {
                        this.setState(
                            prevState => ({
                                configs: {
                                    ...prevState.configs,
                                    prompts: {
                                        ...prevState.configs.prompts,
                                        translation: newValue,
                                    },
                                },
                            }),
                            this.saveConfigs
                        )
                    }}
                    disabled={!configs.enabled}
                />

                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <DefaultButton text={intl.get("ai.clearCache")} onClick={this.clearAICache} />
                </Stack>

                <MessageBar messageBarType={MessageBarType.info}>
                    {intl.get("ai.description")}
                </MessageBar>
            </Stack>
        )
    }
}

export default AITab
