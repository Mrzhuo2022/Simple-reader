import * as React from "react"
import intl from "react-intl-universal"

interface TimeProps {
    date: Date
}

// One shared 60s tick instead of one interval per card: a long list used to
// hold hundreds of live timers, each firing a setState every minute.
const listeners = new Set<() => void>()
let sharedTimer: NodeJS.Timeout | null = null

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    if (!sharedTimer) {
        sharedTimer = setInterval(() => {
            for (const fn of listeners) fn()
        }, 60000)
    }
    return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && sharedTimer) {
            clearInterval(sharedTimer)
            sharedTimer = null
        }
    }
}

class Time extends React.Component<TimeProps> {
    unsubscribe: () => void
    state = { now: new Date() }

    componentDidMount() {
        this.unsubscribe = subscribe(() => this.setState({ now: new Date() }))
    }

    componentWillUnmount() {
        this.unsubscribe()
    }

    displayTime(past: Date, now: Date): string {
        // difference in seconds
        const diff = (now.getTime() - past.getTime()) / 60000
        if (diff < 1) return intl.get("time.now")
        else if (diff < 60) return Math.floor(diff) + intl.get("time.m")
        else if (diff < 1440) return Math.floor(diff / 60) + intl.get("time.h")
        else return Math.floor(diff / 1440) + intl.get("time.d")
    }

    render() {
        return <span className="time">{this.displayTime(this.props.date, this.state.now)}</span>
    }
}

export default Time
