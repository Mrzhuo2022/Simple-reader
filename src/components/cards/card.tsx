import * as React from "react"
import { RSSSource, SourceOpenTarget } from "../../scripts/models/source"
import { RSSItem } from "../../scripts/models/item"
import { platformCtrl } from "../../scripts/utils"
import { FeedFilter } from "../../scripts/models/feed"
import { ViewConfigs } from "../../schema-types"

export type CardProps = {
    feedId: string
    item: RSSItem
    source: RSSSource
    filter: FeedFilter
    selected?: boolean
    viewConfigs?: ViewConfigs
    shortcuts: (item: RSSItem, e: KeyboardEvent) => void
    markRead: (item: RSSItem) => void
    contextMenu: (feedId: string, item: RSSItem, e) => void
    showItem: (fid: string, item: RSSItem) => void
}

const openInBrowser = (props: CardProps, e: React.MouseEvent) => {
    props.markRead(props.item)
    window.utils.openExternal(props.item.link, platformCtrl(e))
}

export const bindEventsToProps = (props: CardProps) => ({
    onClick: (e: React.MouseEvent) => onClick(props, e),
    onMouseUp: (e: React.MouseEvent) => onMouseUp(props, e),
    onKeyDown: (e: React.KeyboardEvent) => onKeyDown(props, e),
})

const onClick = (props: CardProps, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    switch (props.source.openTarget) {
        case SourceOpenTarget.External: {
            openInBrowser(props, e)
            break
        }
        default: {
            props.markRead(props.item)
            props.showItem(props.feedId, props.item)
            break
        }
    }
}

const onMouseUp = (props: CardProps, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    switch (e.button) {
        case 1:
            openInBrowser(props, e)
            break
        case 2:
            props.contextMenu(props.feedId, props.item, e)
    }
}

const onKeyDown = (props: CardProps, e: React.KeyboardEvent) => {
    props.shortcuts(props.item, e.nativeEvent)
}
