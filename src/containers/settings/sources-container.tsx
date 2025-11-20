import intl from "react-intl-universal"
import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../../scripts/reducer"
import SourcesTab from "../../components/settings/sources"
import {
    addSource,
    RSSSource,
    updateSource,
    deleteSource,
    SourceOpenTarget,
    deleteSources,
    toggleSourceHidden,
    AddSourceOptions,
} from "../../scripts/models/source"
import {
    importOPML,
    exportOPML,
    addSourceToGroup,
    removeSourceFromGroup,
} from "../../scripts/models/group"
import { AppDispatch, validateFavicon } from "../../scripts/utils"
import { saveSettings, toggleSettings } from "../../scripts/models/app"
import { SyncService } from "../../schema-types"

const getSources = (state: RootState) => state.sources
const getServiceOn = (state: RootState) => state.service.type !== SyncService.None
const getSIDs = (state: RootState) => state.app.settings.sids
const getGroups = (state: RootState) => state.groups

const mapStateToProps = createSelector(
    [getSources, getServiceOn, getSIDs, getGroups],
    (sources, serviceOn, sids, groups) => ({
        sources: sources,
        serviceOn: serviceOn,
        sids: sids,
        groups: groups.map((g, i) => ({ ...g, index: i })),
    })
)

const mapDispatchToProps = (dispatch: AppDispatch) => {
    return {
        acknowledgeSIDs: () => dispatch(toggleSettings(true)),
        addSource: (url: string, name?: string, options?: AddSourceOptions) =>
            dispatch(addSource(url, name ?? null, false, options)),
        updateSourceName: (source: RSSSource, name: string) => {
            dispatch(updateSource({ ...source, name: name } as RSSSource))
        },
        updateSourceIcon: async (source: RSSSource, iconUrl: string) => {
            dispatch(saveSettings())
            if (await validateFavicon(iconUrl)) {
                dispatch(updateSource({ ...source, iconurl: iconUrl }))
            } else {
                window.utils.showErrorBox(intl.get("sources.badIcon"), "")
            }
            dispatch(saveSettings())
        },
        updateSourceOpenTarget: (source: RSSSource, target: SourceOpenTarget) => {
            dispatch(updateSource({ ...source, openTarget: target } as RSSSource))
        },
        updateFetchFrequency: (source: RSSSource, frequency: number) => {
            dispatch(
                updateSource({
                    ...source,
                    fetchFrequency: frequency,
                } as RSSSource)
            )
        },
        deleteSource: (source: RSSSource) => dispatch(deleteSource(source)),
        deleteSources: (sources: RSSSource[]) => dispatch(deleteSources(sources)),
        importOPML: () => dispatch(importOPML()),
        exportOPML: () => dispatch(exportOPML()),
        toggleSourceHidden: (source: RSSSource) => dispatch(toggleSourceHidden(source)),
        addToGroup: (groupIndex: number, sid: number) =>
            dispatch(addSourceToGroup(groupIndex, sid)),
        removeFromGroup: (groupIndex: number, sids: number[]) =>
            dispatch(removeSourceFromGroup(groupIndex, sids)),
    }
}

const SourcesTabContainer = connect(mapStateToProps, mapDispatchToProps)(SourcesTab)
export default SourcesTabContainer
