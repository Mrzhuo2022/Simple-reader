jest.mock("../../db", () => ({}))

import {
    groupReducer,
    CREATE_SOURCE_GROUP,
    ADD_SOURCE_TO_GROUP,
    REMOVE_SOURCE_FROM_GROUP,
    UPDATE_SOURCE_GROUP,
    REORDER_SOURCE_GROUPS,
    DELETE_SOURCE_GROUP,
    TOGGLE_GROUP_EXPANSION,
} from "../group"
import { ADD_SOURCE, DELETE_SOURCE, RSSSource } from "../source"
import { SourceGroup } from "../../../schema-types"
import { ActionStatus } from "../../utils"

function makeSource(sid: number): RSSSource {
    const s = new RSSSource(`https://example.com/${sid}`)
    s.sid = sid
    return s
}

describe("groupReducer", () => {
    it("uses window.settings.loadGroups() as the initial state", () => {
        expect(groupReducer(undefined, { type: "UNKNOWN" } as never)).toEqual([])
        expect(window.settings.loadGroups).toHaveBeenCalled()
    })

    it("appends a single-source group on ADD_SOURCE success", () => {
        const next = groupReducer([], {
            type: ADD_SOURCE,
            status: ActionStatus.Success,
            batch: false,
            source: makeSource(1),
        } as never)
        expect(next).toHaveLength(1)
        expect(next[0].sids).toEqual([1])
        expect(next[0].isMultiple).toBe(false)
    })

    it("removes the sid and drops empty single groups on DELETE_SOURCE", () => {
        const state = [new SourceGroup([1]), new SourceGroup([2, 3], "Multi")]
        const next = groupReducer(state, {
            type: DELETE_SOURCE,
            source: makeSource(1),
        } as never)
        expect(next).toHaveLength(1)
        expect(next[0].sids).toEqual([2, 3])
    })

    it("keeps multi groups even when emptied on DELETE_SOURCE", () => {
        const state = [new SourceGroup([2, 3], "Multi")]
        let next = groupReducer(state, {
            type: DELETE_SOURCE,
            source: makeSource(2),
        } as never)
        next = groupReducer(next, {
            type: DELETE_SOURCE,
            source: makeSource(3),
        } as never)
        expect(next).toHaveLength(1)
        expect(next[0].sids).toEqual([])
    })

    it("appends a group on CREATE_SOURCE_GROUP", () => {
        const group = new SourceGroup([], "New")
        const next = groupReducer([], {
            type: CREATE_SOURCE_GROUP,
            group: group,
        } as never)
        expect(next).toEqual([group])
    })

    it("moves the sid into the target group on ADD_SOURCE_TO_GROUP", () => {
        const state = [new SourceGroup([1, 2], "A"), new SourceGroup([3], "B"), new SourceGroup([4])]
        // state[2] is a single group holding sid 4; move sid 4 into group 0
        const next = groupReducer(state, {
            type: ADD_SOURCE_TO_GROUP,
            groupIndex: 0,
            sid: 4,
        } as never)
        expect(next[0].sids).toEqual([1, 2, 4])
        // the now-empty single group is dropped
        expect(next).toHaveLength(2)
    })

    it("splits sids out as single groups on REMOVE_SOURCE_FROM_GROUP", () => {
        const state = [new SourceGroup([1, 2, 3], "A")]
        const next = groupReducer(state, {
            type: REMOVE_SOURCE_FROM_GROUP,
            groupIndex: 0,
            sids: [2, 3],
        } as never)
        expect(next[0].sids).toEqual([1])
        expect(next).toHaveLength(3)
        expect(next[1].sids).toEqual([2])
        expect(next[2].sids).toEqual([3])
    })

    it("replaces the group on UPDATE_SOURCE_GROUP", () => {
        const state = [new SourceGroup([1], "Old"), new SourceGroup([2, 3], "Keep")]
        const updated = new SourceGroup([1, 9], "New")
        const next = groupReducer(state, {
            type: UPDATE_SOURCE_GROUP,
            groupIndex: 0,
            group: updated,
        } as never)
        expect(next[0]).toBe(updated)
        expect(next[1]).toBe(state[1])
    })

    it("replaces all groups on REORDER_SOURCE_GROUPS", () => {
        const groups = [new SourceGroup([2]), new SourceGroup([1])]
        const next = groupReducer([new SourceGroup([1])], {
            type: REORDER_SOURCE_GROUPS,
            groups: groups,
        } as never)
        expect(next).toBe(groups)
    })

    it("explodes a group into single-source groups on DELETE_SOURCE_GROUP", () => {
        const state = [new SourceGroup([1, 2], "A"), new SourceGroup([3])]
        const next = groupReducer(state, {
            type: DELETE_SOURCE_GROUP,
            groupIndex: 0,
        } as never)
        expect(next).toHaveLength(3)
        expect(next[0].sids).toEqual([1])
        expect(next[1].sids).toEqual([2])
        expect(next[2].sids).toEqual([3])
    })

    it("toggles expansion on TOGGLE_GROUP_EXPANSION", () => {
        const state = [new SourceGroup([1, 2], "A")]
        expect(state[0].expanded).toBe(true)
        const next = groupReducer(state, {
            type: TOGGLE_GROUP_EXPANSION,
            groupIndex: 0,
        } as never)
        expect(next[0].expanded).toBe(false)
    })
})
