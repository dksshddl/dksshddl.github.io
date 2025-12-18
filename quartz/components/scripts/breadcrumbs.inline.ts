document.addEventListener("nav", () => {
  const breadcrumbs = document.querySelector(".breadcrumb-container")
  if (!breadcrumbs) return

  const center = breadcrumbs.closest(".center")
  if (!center) return

  const breadcrumbsClone = breadcrumbs.cloneNode(true) as HTMLElement
  breadcrumbsClone.classList.add("breadcrumbs-fixed")
  breadcrumbsClone.style.display = "none"
  document.body.appendChild(breadcrumbsClone)

  const updateBreadcrumbs = () => {
    const rect = breadcrumbs.getBoundingClientRect()
    const centerRect = center.getBoundingClientRect()

    if (rect.top < 0) {
      breadcrumbsClone.style.display = "flex"
      breadcrumbsClone.style.left = centerRect.left + "px"
      breadcrumbsClone.style.width = centerRect.width + "px"
    } else {
      breadcrumbsClone.style.display = "none"
    }
  }

  window.addEventListener("scroll", updateBreadcrumbs)
  window.addEventListener("resize", updateBreadcrumbs)
  window.addCleanup(() => {
    window.removeEventListener("scroll", updateBreadcrumbs)
    window.removeEventListener("resize", updateBreadcrumbs)
    breadcrumbsClone.remove()
  })
})
