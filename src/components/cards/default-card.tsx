import * as React from "react"
import { CardProps, bindEventsToProps } from "./card"
import CardInfo from "./info"
import Highlights from "./highlights"
import { SourceTextDirection } from "../../scripts/models/source"

const className = (props: CardProps, thumbVisible: boolean) => {
    const cn = ["card", "default-card"]
    // Only apply the slide-up transform layout when a thumbnail is actually
    // rendering. If the cover failed to load we fall back to the no-thumb
    // layout so the card does not reserve a blank 144px header.
    if (props.item.snippet && props.item.thumb && thumbVisible) cn.push("transform")
    if (props.item.hidden) cn.push("hidden")
    if (props.source.textDir === SourceTextDirection.RTL) cn.push("rtl")
    return cn.join(" ")
}

const DefaultCard: React.FunctionComponent<CardProps> = props => {
    // Tracks whether the cover image actually loaded. A dead/transparent
    // thumbnail URL would otherwise leave a blank header on the card.
    // No reset-on-item-change effect is needed: cards are rendered with
    // key={item._id} in the feed, so a different item remounts this component
    // and the state starts fresh.
    const [thumbVisible, setThumbVisible] = React.useState(true)
    const onThumbError = React.useCallback(() => setThumbVisible(false), [])
    const hasThumb = Boolean(props.item.thumb) && thumbVisible

    return (
        <div
            className={className(props, thumbVisible)}
            {...bindEventsToProps(props)}
            data-iid={props.item._id}
            data-is-focusable
        >
            {hasThumb ? (
                <img className="bg" src={props.item.thumb} onError={onThumbError} />
            ) : null}
            <div className="bg"></div>
            {hasThumb ? (
                <img className="head" src={props.item.thumb} onError={onThumbError} />
            ) : null}
            <CardInfo source={props.source} item={props.item} />
            <h3 className="title">
                <Highlights text={props.item.title} filter={props.filter} title />
            </h3>
            <p className={"snippet" + (hasThumb ? "" : " show")}>
                <Highlights text={props.item.snippet} filter={props.filter} />
            </p>
        </div>
    )
}

export default React.memo(DefaultCard)
