import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    DefaultButton,
    TextField,
    Stack,
    PrimaryButton,
    DetailsList,
    IColumn,
    SelectionMode,
    Selection,
    IChoiceGroupOption,
    ChoiceGroup,
    IDropdownOption,
    Dropdown,
    MessageBar,
    MessageBarType,
    Toggle,
} from "@fluentui/react"
import {
    SourceState,
    RSSSource,
    SourceOpenTarget,
    AddSourceOptions,
} from "../../scripts/models/source"
import { SourceGroup } from "../../schema-types"
import { urlTest } from "../../scripts/utils"
import DangerButton from "../utils/danger-button"
import SourceIcon from "../utils/source-icon"

type SourcesTabProps = {
    sources: SourceState
    serviceOn: boolean
    sids: number[]
    groups: SourceGroup[]
    acknowledgeSIDs: () => void
    addSource: (url: string, name?: string, options?: AddSourceOptions) => void
    updateSourceName: (source: RSSSource, name: string) => void
    updateSourceIcon: (source: RSSSource, iconUrl: string) => Promise<void>
    updateSourceOpenTarget: (source: RSSSource, target: SourceOpenTarget) => void
    updateFetchFrequency: (source: RSSSource, frequency: number) => void
    deleteSource: (source: RSSSource) => void
    deleteSources: (sources: RSSSource[]) => void
    importOPML: () => void
    exportOPML: () => void
    toggleSourceHidden: (source: RSSSource) => void
    addToGroup: (groupIndex: number, sid: number) => void
    removeFromGroup: (groupIndex: number, sids: number[]) => void
}

interface SourcesTabState {
    newUrl: string
    newSourceAddName: string
    newSourceName: string
    newSourceGroupKey: string
    newSourceFetchFrequency: string
    newSourceOpenTarget: string
    newSourceIcon: string
    sourceEditOption: string
    showNewSourceOptions: boolean
    selectedSource: RSSSource
    selectedSources: RSSSource[]
}

const enum EditDropdownKeys {
    Name = "n",
    Icon = "i",
    Url = "u",
}

class SourcesTab extends React.Component<SourcesTabProps, SourcesTabState> {
    selection: Selection

    constructor(props) {
        super(props)
        this.state = {
            newUrl: "",
            newSourceAddName: "",
            newSourceName: "",
            newSourceGroupKey: "none",
            newSourceFetchFrequency: "0",
            newSourceOpenTarget: String(SourceOpenTarget.Local),
            newSourceIcon: "",
            sourceEditOption: EditDropdownKeys.Name,
            showNewSourceOptions: false,
            selectedSource: null,
            selectedSources: null,
        }
        this.selection = new Selection({
            getKey: s => (s as RSSSource).sid,
            onSelectionChanged: () => {
                const count = this.selection.getSelectedCount()
                const sources = count ? (this.selection.getSelection() as RSSSource[]) : null
                this.setState({
                    selectedSource: count === 1 ? sources[0] : null,
                    selectedSources: count > 1 ? sources : null,
                    newSourceName: count === 1 ? sources[0].name : "",
                    newSourceIcon: count === 1 ? sources[0].iconurl || "" : "",
                    sourceEditOption: EditDropdownKeys.Name,
                })
            },
        })
    }

    componentDidMount = () => {
        if (this.props.sids.length > 0) {
            for (const sid of this.props.sids) {
                this.selection.setKeySelected(String(sid), true, false)
            }
            this.props.acknowledgeSIDs()
        }
    }

    columns = (): IColumn[] => [
        {
            key: "favicon",
            name: intl.get("icon"),
            fieldName: "name",
            isIconOnly: true,
            iconName: "ImagePixel",
            minWidth: 16,
            maxWidth: 16,
            onRender: (s: RSSSource) => <SourceIcon url={s.iconurl} />,
        },
        {
            key: "name",
            name: intl.get("name"),
            fieldName: "name",
            minWidth: 200,
            data: "string",
            isRowHeader: true,
        },
        {
            key: "url",
            name: "URL",
            fieldName: "url",
            minWidth: 280,
            data: "string",
        },
    ]

    sourceEditOptions = (): IDropdownOption[] => [
        { key: EditDropdownKeys.Name, text: intl.get("name") },
        { key: EditDropdownKeys.Icon, text: intl.get("icon") },
        { key: EditDropdownKeys.Url, text: "URL" },
    ]

    onSourceEditOptionChange = (_, option: IDropdownOption) => {
        this.setState({ sourceEditOption: option.key as string })
    }

    fetchFrequencyOptions = (): IDropdownOption[] => [
        { key: "0", text: intl.get("sources.unlimited") },
        { key: "15", text: intl.get("time.minute", { m: 15 }) },
        { key: "30", text: intl.get("time.minute", { m: 30 }) },
        { key: "60", text: intl.get("time.hour", { h: 1 }) },
        { key: "120", text: intl.get("time.hour", { h: 2 }) },
        { key: "180", text: intl.get("time.hour", { h: 3 }) },
        { key: "360", text: intl.get("time.hour", { h: 6 }) },
        { key: "720", text: intl.get("time.hour", { h: 12 }) },
        { key: "1440", text: intl.get("time.day", { d: 1 }) },
    ]

    onFetchFrequencyChange = (_, option: IDropdownOption) => {
        const frequency = parseInt(option.key as string)
        this.props.updateFetchFrequency(this.state.selectedSource, frequency)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                fetchFrequency: frequency,
            } as RSSSource,
        })
    }

    onNewSourceFetchFrequencyChange = (_, option: IDropdownOption) => {
        this.setState({ newSourceFetchFrequency: option.key as string })
    }

    sourceOpenTargetChoices = (): IChoiceGroupOption[] => [
        {
            key: String(SourceOpenTarget.Local),
            text: intl.get("sources.rssText"),
        },
        {
            key: String(SourceOpenTarget.FullContent),
            text: intl.get("nav.loadFull"),
        },
        {
            key: String(SourceOpenTarget.Webpage),
            text: intl.get("sources.loadWebpage"),
        },
        {
            key: String(SourceOpenTarget.External),
            text: intl.get("openExternal"),
        },
    ]

    updateSourceName = () => {
        const newName = this.state.newSourceName.trim()
        this.props.updateSourceName(this.state.selectedSource, newName)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                name: newName,
            } as RSSSource,
        })
    }

    updateSourceIcon = () => {
        const newIcon = this.state.newSourceIcon.trim()
        this.props.updateSourceIcon(this.state.selectedSource, newIcon)
        this.setState({
            selectedSource: { ...this.state.selectedSource, iconurl: newIcon },
        })
    }

    handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target
        switch (name) {
            case "newUrl":
                this.setState({ newUrl: value })
                break
            case "newSourceAddName":
                this.setState({ newSourceAddName: value })
                break
            case "newSourceName":
                this.setState({ newSourceName: value })
                break
            case "newSourceIcon":
                this.setState({ newSourceIcon: value })
                break
        }
    }

    addSource = (event: React.FormEvent) => {
        event.preventDefault()
        const trimmed = this.state.newUrl.trim()
        if (!urlTest(trimmed)) return

        if (!this.state.showNewSourceOptions) {
            this.setState({ showNewSourceOptions: true })
            if (!this.state.newSourceAddName || this.state.newSourceAddName.trim().length === 0) {
                const tempSource = new RSSSource(trimmed)
                RSSSource.fetchMetaData(tempSource)
                    .then(() => {
                        if (
                            this.state.showNewSourceOptions &&
                            (!this.state.newSourceAddName ||
                                this.state.newSourceAddName.trim().length === 0)
                        ) {
                            this.setState({
                                newSourceAddName: tempSource.name,
                            })
                        }
                    })
                    .catch(() => {})
            }
            return
        }
        const options: AddSourceOptions = {}
        if (this.state.newSourceGroupKey && this.state.newSourceGroupKey !== "none") {
            const groupIndex = Number(this.state.newSourceGroupKey)
            if (!Number.isNaN(groupIndex) && groupIndex >= 0) {
                options.groupIndex = groupIndex
            }
        }
        if (this.state.newSourceFetchFrequency) {
            const frequency = parseInt(this.state.newSourceFetchFrequency, 10)
            if (!Number.isNaN(frequency)) {
                options.fetchFrequency = frequency
            }
        }
        if (this.state.newSourceOpenTarget) {
            const openTarget = parseInt(this.state.newSourceOpenTarget, 10)
            if (!Number.isNaN(openTarget)) {
                options.openTarget = openTarget as SourceOpenTarget
            }
        }
        const name = this.state.newSourceAddName.trim()
        this.props.addSource(
            trimmed,
            name.length > 0 ? name : undefined,
            Object.keys(options).length > 0 ? options : undefined
        )
        this.setState({
            newUrl: "",
            newSourceAddName: "",
            newSourceGroupKey: "none",
            newSourceFetchFrequency: "0",
            newSourceOpenTarget: String(SourceOpenTarget.Local),
            showNewSourceOptions: false,
        })
    }

    onOpenTargetChange = (_, option: IChoiceGroupOption) => {
        const newTarget = parseInt(option.key) as SourceOpenTarget
        this.props.updateSourceOpenTarget(this.state.selectedSource, newTarget)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                openTarget: newTarget,
            } as RSSSource,
        })
    }

    onNewSourceOpenTargetChange = (_, option: IChoiceGroupOption) => {
        this.setState({ newSourceOpenTarget: option.key })
    }

    private getSourceGroupIndex = (source: RSSSource): number => {
        if (!source || !this.props.groups) return null
        const group = this.props.groups.find(
            g => g.isMultiple && g.sids && g.sids.includes(source.sid)
        )
        return group ? group.index : null
    }

    private groupDropdownOptions = (): IDropdownOption[] => {
        const options: IDropdownOption[] = [
            {
                key: "none",
                text: intl.get("sources.groupNone"),
            },
        ]
        this.props.groups
            .filter(g => g.isMultiple)
            .forEach(g => {
                options.push({
                    key: g.index,
                    text: g.name,
                })
            })
        return options
    }

    onNewSourceGroupChange = (_, option: IDropdownOption) => {
        this.setState({ newSourceGroupKey: option.key as string })
    }

    onGroupChange = (_, option: IDropdownOption) => {
        const source = this.state.selectedSource
        if (!source) return
        const currentIndex = this.getSourceGroupIndex(source)
        if (option.key === "none") {
            if (currentIndex !== null) {
                this.props.removeFromGroup(currentIndex, [source.sid])
            }
            return
        }
        const targetIndex = Number(option.key)
        if (currentIndex !== null && targetIndex === currentIndex) return
        this.props.addToGroup(targetIndex, source.sid)
    }

    onToggleHidden = () => {
        this.props.toggleSourceHidden(this.state.selectedSource)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                hidden: !this.state.selectedSource.hidden,
            } as RSSSource,
        })
    }

    render = () => (
        <div className="tab-body">
            {this.props.serviceOn && (
                <MessageBar messageBarType={MessageBarType.info}>
                    {intl.get("sources.serviceWarning")}
                </MessageBar>
            )}
            <Label>{intl.get("sources.opmlFile")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <PrimaryButton
                        onClick={this.props.importOPML}
                        text={intl.get("sources.import")}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DefaultButton
                        onClick={this.props.exportOPML}
                        text={intl.get("sources.export")}
                    />
                </Stack.Item>
            </Stack>

            <form onSubmit={this.addSource}>
                <Label htmlFor="newUrl">
                    {this.state.showNewSourceOptions
                        ? intl.get("sources.addStep2")
                        : intl.get("sources.add")}
                </Label>
                <Stack horizontal>
                    <Stack.Item grow>
                        <TextField
                            onGetErrorMessage={v =>
                                urlTest(v.trim()) ? "" : intl.get("sources.badUrl")
                            }
                            validateOnLoad={false}
                            placeholder={intl.get("sources.inputUrl")}
                            value={this.state.newUrl}
                            id="newUrl"
                            name="newUrl"
                            onChange={this.handleInputChange}
                        />
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            disabled={!urlTest(this.state.newUrl.trim())}
                            type="submit"
                            text={
                                this.state.showNewSourceOptions
                                    ? intl.get("confirm")
                                    : intl.get("add")
                            }
                        />
                    </Stack.Item>
                </Stack>
                {this.state.showNewSourceOptions && (
                    <>
                        <Stack styles={{ root: { marginTop: 8 } }}>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("sources.name")}
                                    value={this.state.newSourceAddName}
                                    name="newSourceAddName"
                                    onChange={this.handleInputChange}
                                />
                            </Stack.Item>
                        </Stack>
                        <Stack
                            horizontal
                            tokens={{ childrenGap: 16 }}
                            styles={{ root: { marginTop: 8 } }}
                        >
                            <Stack.Item grow>
                                <Dropdown
                                    label={intl.get("sources.group")}
                                    options={this.groupDropdownOptions()}
                                    selectedKey={this.state.newSourceGroupKey ?? "none"}
                                    onChange={this.onNewSourceGroupChange}
                                />
                            </Stack.Item>
                            <Stack.Item grow>
                                <Dropdown
                                    label={intl.get("sources.fetchFrequency")}
                                    options={this.fetchFrequencyOptions()}
                                    selectedKey={this.state.newSourceFetchFrequency ?? "0"}
                                    onChange={this.onNewSourceFetchFrequencyChange}
                                />
                            </Stack.Item>
                        </Stack>
                        <ChoiceGroup
                            label={intl.get("sources.openTarget")}
                            options={this.sourceOpenTargetChoices()}
                            selectedKey={
                                this.state.newSourceOpenTarget ?? String(SourceOpenTarget.Local)
                            }
                            onChange={this.onNewSourceOpenTargetChange}
                        />
                    </>
                )}
            </form>

            <DetailsList
                compact={Object.keys(this.props.sources).length >= 10}
                items={Object.values(this.props.sources)}
                columns={this.columns()}
                getKey={s => s.sid}
                setKey="selected"
                selection={this.selection}
                selectionMode={SelectionMode.multiple}
            />

            {this.state.selectedSource && (
                <>
                    {this.state.selectedSource.serviceRef && (
                        <MessageBar messageBarType={MessageBarType.info}>
                            {intl.get("sources.serviceManaged")}
                        </MessageBar>
                    )}
                    <Label>{intl.get("sources.selected")}</Label>
                    <Stack horizontal>
                        <Stack.Item>
                            <Dropdown
                                options={this.sourceEditOptions()}
                                selectedKey={this.state.sourceEditOption}
                                onChange={this.onSourceEditOptionChange}
                                style={{ width: 120 }}
                            />
                        </Stack.Item>
                        {this.state.sourceEditOption === EditDropdownKeys.Name && (
                            <>
                                <Stack.Item grow>
                                    <TextField
                                        onGetErrorMessage={v =>
                                            v.trim().length == 0 ? intl.get("emptyName") : ""
                                        }
                                        validateOnLoad={false}
                                        placeholder={intl.get("sources.name")}
                                        value={this.state.newSourceName}
                                        name="newSourceName"
                                        onChange={this.handleInputChange}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        disabled={this.state.newSourceName.trim().length == 0}
                                        onClick={this.updateSourceName}
                                        text={intl.get("sources.editName")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                        {this.state.sourceEditOption === EditDropdownKeys.Icon && (
                            <>
                                <Stack.Item grow>
                                    <TextField
                                        onGetErrorMessage={v =>
                                            urlTest(v.trim()) ? "" : intl.get("sources.badUrl")
                                        }
                                        validateOnLoad={false}
                                        placeholder={intl.get("sources.inputUrl")}
                                        value={this.state.newSourceIcon}
                                        name="newSourceIcon"
                                        onChange={this.handleInputChange}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        disabled={!urlTest(this.state.newSourceIcon.trim())}
                                        onClick={this.updateSourceIcon}
                                        text={intl.get("edit")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                        {this.state.sourceEditOption === EditDropdownKeys.Url && (
                            <>
                                <Stack.Item grow>
                                    <TextField disabled value={this.state.selectedSource.url} />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        onClick={() =>
                                            window.utils.writeClipboard(
                                                this.state.selectedSource.url
                                            )
                                        }
                                        text={intl.get("context.copy")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                    </Stack>
                    {!this.state.selectedSource.serviceRef && (
                        <>
                            <Label>{intl.get("sources.fetchFrequency")}</Label>
                            <Stack>
                                <Stack.Item>
                                    <Dropdown
                                        options={this.fetchFrequencyOptions()}
                                        selectedKey={
                                            this.state.selectedSource.fetchFrequency
                                                ? String(this.state.selectedSource.fetchFrequency)
                                                : "0"
                                        }
                                        onChange={this.onFetchFrequencyChange}
                                        style={{ width: 200 }}
                                    />
                                </Stack.Item>
                            </Stack>
                        </>
                    )}
                    <ChoiceGroup
                        label={intl.get("sources.openTarget")}
                        options={this.sourceOpenTargetChoices()}
                        selectedKey={String(this.state.selectedSource.openTarget)}
                        onChange={this.onOpenTargetChange}
                    />
                    <Stack horizontal verticalAlign="baseline">
                        <Stack.Item grow>
                            <Label>{intl.get("sources.hidden")}</Label>
                        </Stack.Item>
                        <Stack.Item>
                            <Toggle
                                checked={this.state.selectedSource.hidden}
                                onChange={this.onToggleHidden}
                            />
                        </Stack.Item>
                    </Stack>
                    <Label>{intl.get("sources.group")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <Dropdown
                                options={this.groupDropdownOptions()}
                                selectedKey={
                                    this.getSourceGroupIndex(this.state.selectedSource) ?? "none"
                                }
                                onChange={this.onGroupChange}
                            />
                        </Stack.Item>
                    </Stack>
                    {!this.state.selectedSource.serviceRef && (
                        <Stack horizontal>
                            <Stack.Item>
                                <DangerButton
                                    onClick={() =>
                                        this.props.deleteSource(this.state.selectedSource)
                                    }
                                    key={this.state.selectedSource.sid}
                                    text={intl.get("sources.delete")}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <span className="settings-hint">
                                    {intl.get("sources.deleteWarning")}
                                </span>
                            </Stack.Item>
                        </Stack>
                    )}
                </>
            )}
            {this.state.selectedSources &&
                (this.state.selectedSources.filter(s => s.serviceRef).length === 0 ? (
                    <>
                        <Label>{intl.get("sources.selectedMulti")}</Label>
                        <Stack horizontal>
                            <Stack.Item>
                                <DangerButton
                                    onClick={() =>
                                        this.props.deleteSources(this.state.selectedSources)
                                    }
                                    text={intl.get("sources.delete")}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <span className="settings-hint">
                                    {intl.get("sources.deleteWarning")}
                                </span>
                            </Stack.Item>
                        </Stack>
                    </>
                ) : (
                    <MessageBar messageBarType={MessageBarType.info}>
                        {intl.get("sources.serviceManaged")}
                    </MessageBar>
                ))}
        </div>
    )
}

export default SourcesTab
