document.addEventListener("nav", () => {
  const header = document.querySelector(".sticky-header")
  if (!header) return

  const handleScroll = () => {
    if (window.scrollY > 10) {
      header.classList.add("scrolled")
    } else {
      header.classList.remove("scrolled")
    }
  }

  window.addEventListener("scroll", handleScroll)
  window.addCleanup(() => window.removeEventListener("scroll", handleScroll))
})
