import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const AboutLink: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <div class={`about-link ${displayClass ?? ""}`}>
      <a href="/about">About Me</a>
    </div>
  )
}

AboutLink.css = `
.about-link {
  margin-bottom: 1rem;
}

.about-link a {
  font-family: var(--headerFont);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.5rem;
  text-decoration: none;
  color: var(--secondary);
  transition: color 0.2s ease;
  display: inline-block;
}

.about-link a:hover {
  color: var(--tertiary);
}
`

export default (() => AboutLink) satisfies QuartzComponentConstructor
