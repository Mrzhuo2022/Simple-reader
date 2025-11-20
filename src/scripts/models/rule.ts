import { FeedFilter, FilterType } from "./feed"
import { RSSItem } from "./item"

export const enum ItemAction {
    Read = "r",
    Star = "s",
    Hide = "h",
    Notify = "n",
    Translate = "t",
    Summarize = "z",
    FetchFull = "f",
}

export type RuleActions = {
    [type in ItemAction]: boolean
}

export function ruleActionsToKeys(actions: RuleActions): string[] {
    return Object.entries(actions).map(([t, f]) => `${t}-${f}`)
}

export function ruleActionsFromKeys(strs: string[]): RuleActions {
    const fromKey = (str: string): [ItemAction, boolean] => {
        const [t, f] = str.split("-") as [ItemAction, string]
        if (f) return [t, f === "true"]
        else return [t, true]
    }
    return Object.fromEntries(strs.map(fromKey)) as RuleActions
}

type ActionTransformType = {
    [type in ItemAction]: (i: RSSItem, f: boolean) => void
}
const actionTransform: ActionTransformType = {
    [ItemAction.Read]: (i, f) => {
        i.hasRead = f
    },
    [ItemAction.Star]: (i, f) => {
        i.starred = f
    },
    [ItemAction.Hide]: (i, f) => {
        i.hidden = f
    },
    [ItemAction.Notify]: (i, f) => {
        i.notify = f
    },
    [ItemAction.Translate]: (i, f) => {
        i.autoTranslate = f
    },
    [ItemAction.Summarize]: (i, f) => {
        i.autoSummarize = f
    },
    [ItemAction.FetchFull]: (i, f) => {
        i.autoFullText = f
    },
}

export class SourceRule {
    filter: FeedFilter
    match: boolean
    actions: RuleActions

    constructor(regex: string, actions: string[], filter: FilterType, match: boolean) {
        this.filter = new FeedFilter(filter, regex)
        this.match = match
        this.actions = ruleActionsFromKeys(actions)
    }

    static apply(rule: SourceRule, item: RSSItem) {
        const result = FeedFilter.testItem(rule.filter, item)
        if (result === rule.match) {
            for (const [action, flag] of Object.entries(rule.actions)) {
                actionTransform[action](item, flag)
            }
        }
    }

    static applyAll(rules: SourceRule[], item: RSSItem) {
        for (const rule of rules) {
            this.apply(rule, item)
        }
    }
}
