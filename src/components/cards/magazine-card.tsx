import * as React from "react"
import { CardProps, bindEventsToProps } from "./card"
import CardInfo from "./info"
import Highlights from "./highlights"
import { SourceTextDirection } from "../../scripts/models/source"

const className = (props: CardProps) => {
    const cn = ["card", "magazine-card"]
    if (props.item.hasRead) cn.push("read")
    if (props.item.hidden) cn.push("hidden")
    if (props.source.textDir === SourceTextDirection.RTL) cn.push("rtl")
    return cn.join(" ")
}

const MagazineCard: React.FunctionComponent<CardProps> = props => {
    // Drop the cover block when the image fails so the magazine layout does
    // not keep a blank 200x160 column. Cards are keyed by item._id in the
    // feed, so a different item remounts this component and resets the state.
    const [thumbVisible, setThumbVisible] = React.useState(true)
    const onThumbError = React.useCallback(() => setThumbVisible(false), [])
    const showCover = Boolean(props.item.thumb) && thumbVisible

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
                <div>
                    <h3 className="title">
                        <Highlights text={props.item.title} filter={props.filter} title />
                    </h3>
                    <p className="snippet">
                        <Highlights text={props.item.snippet} filter={props.filter} />
                    </p>
                </div>
                <CardInfo source={props.source} item={props.item} showCreator />
            </div>
        </div>
    )
}

export default React.memo(MagazineCard)
