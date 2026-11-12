import * as React from "react"
import { validateRegex } from "../../scripts/utils"
import { FeedFilter, FilterType } from "../../scripts/models/feed"

type HighlightsProps = {
    text: string
    filter: FeedFilter
    title?: boolean
}

const Highlights: React.FunctionComponent<HighlightsProps> = props => {
    const spans: [string, boolean][] = []
    const flags = props.filter.type & FilterType.CaseInsensitive ? "ig" : "g"
    let regex: RegExp
    if (props.filter.search === "" || !(regex = validateRegex(props.filter.search, flags))) {
        if (props.title) spans.push([props.text, false])
        else spans.push([props.text.substr(0, 325), false])
    } else if (props.title) {
        // A regex that can match the empty string (e.g. "a*") yields
        // zero-length matches that never advance lastIndex, so exec would
        // return the same match forever. Track the consumed position
        // manually and skip empty matches to keep the loop terminating.
        let cursor = 0
        let match: RegExpExecArray | null
        while ((match = regex.exec(props.text))) {
            if (match[0].length === 0) {
                regex.lastIndex++
                continue
            }
            if (cursor < match.index) {
                spans.push([props.text.substring(cursor, match.index), false])
            }
            spans.push([match[0], true])
            cursor = regex.lastIndex
            if (regex.lastIndex >= props.text.length) break
        }
        if (cursor < props.text.length) {
            spans.push([props.text.substring(cursor), false])
        }
    } else {
        const match = regex.exec(props.text)
        if (match) {
            if (match.index != 0) {
                const startIndex = Math.max(
                    match.index - 25,
                    props.text.lastIndexOf(" ", Math.max(match.index - 10, 0))
                )
                spans.push([props.text.substring(Math.max(0, startIndex), match.index), false])
            }
            spans.push([match[0], true])
            if (regex.lastIndex < props.text.length) {
                spans.push([props.text.substr(regex.lastIndex, 300), false])
            }
        } else {
            spans.push([props.text.substr(0, 325), false])
        }
    }

    return (
        <>
            {spans.map(([text, flag], index) =>
                flag ? (
                    <span key={index} className="h">
                        {text}
                    </span>
                ) : (
                    text
                )
            )}
        </>
    )
}

export default Highlights
