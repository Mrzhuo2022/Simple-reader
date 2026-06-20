import * as React from "react"
import { CardProps, bindEventsToProps } from "./card"
import CardInfo from "./info"
import Highlights from "./highlights"
import { ViewConfigs } from "../../schema-types"
import { SourceTextDirection } from "../../scripts/models/source"

const className = (props: CardProps) => {
    const cn = ["card", "list-card"]
    if (props.item.hidden) cn.push("hidden")
    if (props.selected) cn.push("selected")
    if (props.viewConfigs & ViewConfigs.FadeRead && props.item.hasRead) cn.push("read")
    if (props.source.textDir === SourceTextDirection.RTL) cn.push("rtl")
    return cn.join(" ")
}

const ListCard: React.FunctionComponent<CardProps> = props => {
    // Hide the cover entirely if it fails to load so the row doesn't keep an
    // empty 80px box on the side. Cards are keyed by item._id in the feed, so
    // a different item remounts this component and resets the state.
    const [thumbVisible, setThumbVisible] = React.useState(true)
    const onThumbError = React.useCallback(() => setThumbVisible(false), [])
    const showCover =
        Boolean(props.item.thumb) &&
        thumbVisible &&
        Boolean(props.viewConfigs & ViewConfigs.ShowCover)

    return (
        <div
            className={className(props)}
            {...bindEventsToProps(props)}
            data-iid={props.item._id}
            data-is-focusable
        >
            {showCover ? (
                <div className="head">
                    <img src={props.item.thumb} onError={onThumbError} />
                </div>
            ) : null}
            <div className="data">
                <CardInfo source={props.source} item={props.item} />
                <h3 className="title">
                    <Highlights text={props.item.title} filter={props.filter} title />
                </h3>
                {Boolean(props.viewConfigs & ViewConfigs.ShowSnippet) && (
                    <p className="snippet">
                        <Highlights text={props.item.snippet} filter={props.filter} />
                    </p>
                )}
            </div>
        </div>
    )
}

export default React.memo(ListCard)
