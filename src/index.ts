import "dotenv/config";
import { parseCliArgs } from "./cli/parseCliArgs";
import { runCompanyScan } from "./application/runCompanyScan";

async function main() {
  try {
    const options = parseCliArgs();
    await runCompanyScan(options);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
