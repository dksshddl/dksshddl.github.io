document.addEventListener("nav", () => {
  const toggleButton = document.getElementById("sidebar-toggle")
  if (!toggleButton) return

  const quartzBody = document.querySelector(".page > #quartz-body") as HTMLElement

  // Store original parent
  const originalParent = toggleButton.parentElement
  const originalNextSibling = toggleButton.nextSibling

  const applyCollapsedState = (collapsed: boolean) => {
    if (collapsed) {
      document.body.classList.add("sidebar-collapsed")
      // Move button to body so it doesn't get hidden with sidebar
      document.body.appendChild(toggleButton)
      if (quartzBody) {
        const isDesktop = window.innerWidth >= 1200
        const isTablet = window.innerWidth >= 800 && window.innerWidth < 1200

        if (isDesktop) {
          quartzBody.style.gridTemplateColumns = "0 1fr 320px"
          quartzBody.style.columnGap = "5px"
        } else if (isTablet) {
          quartzBody.style.gridTemplateColumns = "0 1fr"
          quartzBody.style.columnGap = "5px"
        }
      }
    } else {
      document.body.classList.remove("sidebar-collapsed")
      // Move button back to its original location
      if (originalParent) {
        if (originalNextSibling) {
          originalParent.insertBefore(toggleButton, originalNextSibling)
        } else {
          originalParent.appendChild(toggleButton)
        }
      }
      if (quartzBody) {
        quartzBody.style.gridTemplateColumns = ""
        quartzBody.style.columnGap = ""
      }
    }
  }

  // Restore saved state
  const savedState = localStorage.getItem("sidebarCollapsed")
  if (savedState === "true") {
    applyCollapsedState(true)
  }

  // Remove old listener if exists
  const oldListener = (toggleButton as any)._sidebarToggleListener
  if (oldListener) {
    toggleButton.removeEventListener("click", oldListener)
  }

  // Add new listener
  const listener = () => {
    const isCollapsed = !document.body.classList.contains("sidebar-collapsed")
    applyCollapsedState(isCollapsed)
    localStorage.setItem("sidebarCollapsed", isCollapsed.toString())
  }

  ;(toggleButton as any)._sidebarToggleListener = listener
  toggleButton.addEventListener("click", listener)
  window.addCleanup(() => toggleButton.removeEventListener("click", listener))
})
