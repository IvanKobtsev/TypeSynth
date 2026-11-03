import { defineJobs } from "typesynth";
export default defineJobs({
  clients: {
    sources: "./input",
    output: "./generated",
    overrides: { client: "./custom-client.hbs" },
  },
});
