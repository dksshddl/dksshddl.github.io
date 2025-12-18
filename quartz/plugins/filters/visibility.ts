import { QuartzFilterPlugin } from "../types"

export const RemoveHidden: QuartzFilterPlugin = () => ({
  name: "RemoveHidden",
  shouldPublish(_ctx, [_tree, vfile]) {
    const visibility = vfile.data?.frontmatter?.visibility
    return visibility !== "hidden" && visibility !== "off"
  },
})
