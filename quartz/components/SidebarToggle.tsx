import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/sidebarToggle.inline"
import styles from "./styles/sidebarToggle.scss"

const SidebarToggle: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <button
      class={`sidebar-toggle ${displayClass ?? ""}`}
      id="sidebar-toggle"
      aria-label="Toggle Sidebar"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M3 5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5ZM9 5H5V19H9V5Z" />
      </svg>
    </button>
  )
}

SidebarToggle.css = styles
SidebarToggle.afterDOMLoaded = script

export default (() => SidebarToggle) satisfies QuartzComponentConstructor
