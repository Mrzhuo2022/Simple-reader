import * as React from "react"

type SourceIconProps = {
    url?: string
    size?: number
    className?: string
    style?: React.CSSProperties
}

const SourceIcon: React.FC<SourceIconProps> = ({
    url,
    size = 16,
    className = "favicon",
    style = {},
}) => {
    if (!url) return null

    const mergedStyle: React.CSSProperties = {
        width: size,
        height: size,
        ...style,
    }

    return (
        <img
            src={url}
            className={className}
            style={mergedStyle}
            loading="lazy"
            onError={e => {
                ;(e.currentTarget as HTMLImageElement).style.display = "none"
            }}
        />
    )
}

export default SourceIcon
