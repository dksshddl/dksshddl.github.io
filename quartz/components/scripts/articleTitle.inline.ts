document.addEventListener("nav", () => {
  const title = document.querySelector(".article-title")
  if (!title) return

  const handleScroll = () => {
    if (window.scrollY > 10) {
      title.classList.add("scrolled")
    } else {
      title.classList.remove("scrolled")
    }
  }

  window.addEventListener("scroll", handleScroll)
  window.addCleanup(() => window.removeEventListener("scroll", handleScroll))
})
