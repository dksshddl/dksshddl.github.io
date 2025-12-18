import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/stickyHeader.inline"

const StickyHeader: QuartzComponent = ({ children }: QuartzComponentProps) => {
  return <div class="sticky-header">{children}</div>
}

StickyHeader.css = `
.sticky-header {
  position: sticky;
  top: 0;
  background: var(--light);
  z-index: 100;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sticky-header.scrolled {
  border-bottom-color: var(--lightgray);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

@media (max-width: 800px) {
  .sticky-header {
    position: relative;
    border-bottom: none;
    box-shadow: none;
  }
}
`

StickyHeader.afterDOMLoaded = script

export default (() => StickyHeader) satisfies QuartzComponentConstructor
