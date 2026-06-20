import * as React from "react"
import intl from "react-intl-universal"
import { Stack, Link, MessageBar, MessageBarType, Spinner, SpinnerSize } from "@fluentui/react"
import type { UpdateStatus } from "../../bridges/utils"

type UpdateState =
    | { status: "checking" }
    | { status: "done"; info: UpdateStatus }
    | { status: "error" }

const RELEASES_URL = "https://github.com/Mrzhuo2022/Simple-reader/releases"

class AboutTab extends React.Component<unknown, { update: UpdateState | null }> {
    constructor(props: unknown) {
        super(props)
        this.state = { update: null }
    }

    componentDidMount = () => {
        this.runCheck()
    }

    runCheck = async () => {
        this.setState({ update: { status: "checking" } })
        try {
            const info = await window.utils.checkUpdate()
            this.setState({ update: { status: "done", info } })
        } catch {
            this.setState({ update: { status: "error" } })
        }
    }

    renderUpdateBar = () => {
        const { update } = this.state
        if (!update) return null

        let inner: React.ReactNode
        if (update.status === "checking") {
            inner = (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Spinner size={SpinnerSize.xSmall} />
                    <small className="settings-hint">
                        {intl.get("settings.update.checking")}
                    </small>
                </div>
            )
        } else if (update.status === "done" && update.info.hasUpdate) {
            inner = (
                <MessageBar
                    messageBarType={MessageBarType.success}
                    isMultiline={false}
                    actions={
                        <div>
                            <Link
                                onClick={() =>
                                    window.utils.openExternal(
                                        update.info.releaseUrl || RELEASES_URL
                                    )
                                }
                            >
                                {intl.get("settings.update.download")}
                            </Link>
                        </div>
                    }
                >
                    {intl.get("settings.update.available", {
                        version: update.info.latestVersion,
                    })}
                </MessageBar>
            )
        } else {
            // Either no update, or a fetch error. Stay quiet — only offer a
            // manual re-check link so curious users aren't confused by silence.
            inner = (
                <small className="settings-hint">
                    {update.status === "error"
                        ? intl.get("settings.update.checkFailed")
                        : intl.get("settings.update.upToDate")}{" "}
                    <Link onClick={this.runCheck}>
                        {intl.get("settings.update.recheck")}
                    </Link>
                </small>
            )
        }

        // Constrain the bar's width and center it under the logo/version block.
        return (
            <Stack
                horizontalAlign="center"
                style={{ width: "100%", maxWidth: 360, marginTop: 8 }}
            >
                {inner}
            </Stack>
        )
    }

    render = () => (
        <div className="tab-body">
            <Stack className="settings-about" horizontalAlign="center">
                <img src="icons/logo.svg" style={{ width: 120, height: 120 }} />
                <h3 style={{ fontWeight: 600 }}>
                    {intl.get("settings.appName") || "Simple Reader"}
                </h3>
                <small>
                    {intl.get("settings.version")} {window.utils.getVersion()}
                </small>
                {this.renderUpdateBar()}
                <p className="settings-hint">
                    Copyright © {new Date().getFullYear()} Evarle Zhuo. All rights
                    reserved.
                </p>
                <p className="settings-hint" style={{ marginTop: -12 }}>
                    Based on{" "}
                    <Link
                        onClick={() =>
                            window.utils.openExternal("https://github.com/yang991178/fluent-reader")
                        }
                    >
                        Fluent Reader
                    </Link>{" "}
                    by Haoyuan Liu
                </p>
                <Stack horizontal horizontalAlign="center" tokens={{ childrenGap: 12 }}>
                    <small>
                        <Link
                            onClick={() =>
                                window.utils.openExternal(
                                    "https://github.com/Mrzhuo2022/Simple-reader"
                                )
                            }
                        >
                            {intl.get("settings.openSource")}
                        </Link>
                    </small>
                </Stack>
            </Stack>
        </div>
    )
}

export default AboutTab
