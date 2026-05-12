/**
 * Inline script injected into <head> to apply the dark class before first
 * paint. Runs synchronously so the user never sees a light flash when their
 * preference is dark. Keep this tiny -- it ships as a raw string in the HTML.
 */
export const themeInitScript = `
(function(){
  try {
    var m = localStorage.getItem("atlas-theme");
    var d = m === "dark" || (m !== "light" && matchMedia("(prefers-color-scheme:dark)").matches);
    if (d) document.documentElement.classList.add("dark");
  } catch(e) {}
})();
`.trim();
