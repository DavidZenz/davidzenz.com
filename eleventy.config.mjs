export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/leaflet/dist/leaflet.css": "assets/vendor/leaflet/leaflet.css",
    "node_modules/leaflet/dist/leaflet.js": "assets/vendor/leaflet/leaflet.js",
    "node_modules/topojson-client/dist/topojson-client.min.js": "assets/vendor/topojson-client.min.js",
    "node_modules/world-atlas/countries-50m.json": "assets/vendor/countries-50m.json",
  });

  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  eleventyConfig.addFilter("gigDate", (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  );

  eleventyConfig.addFilter("commas", (n) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n)
  );

  eleventyConfig.addFilter("mergePbs", (staticPbs, livePbs) =>
    staticPbs.map((pb) => livePbs.find((live) => live.distance === pb.distance) ?? pb)
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
