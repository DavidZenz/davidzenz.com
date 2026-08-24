export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/leaflet/dist/leaflet.css": "assets/vendor/leaflet/leaflet.css",
    "node_modules/leaflet/dist/leaflet.js": "assets/vendor/leaflet/leaflet.js",
    "node_modules/leaflet/dist/images/marker-icon.png": "assets/vendor/leaflet/images/marker-icon.png",
    "node_modules/leaflet/dist/images/marker-icon-2x.png": "assets/vendor/leaflet/images/marker-icon-2x.png",
    "node_modules/leaflet/dist/images/marker-shadow.png": "assets/vendor/leaflet/images/marker-shadow.png",
  });

  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  eleventyConfig.addFilter("gigDate", (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  );

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
