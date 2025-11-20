import { RSSItem } from "../../scripts/models/item"
import { RSSSource } from "../../scripts/models/source"
import { SourceRule } from "../../scripts/models/rule"
import type { MyParserItem } from "../../scripts/utils"

export function getEffectiveItem(item: RSSItem, source: RSSSource): RSSItem {
    const effective = Object.assign(new RSSItem({} as MyParserItem, source), item)
    if (source.rules) {
        SourceRule.applyAll(source.rules, effective)
    }
    return effective
}
