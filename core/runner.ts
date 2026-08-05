import dotenv from "dotenv";
import { CoreEngine } from "./engine";

dotenv.config();

// Get bot name from arguments
const botName = process.argv[2];

if (!botName) {
  console.error("Error: Bot name is required to run. Usage: tsx core/runner.ts <botName>");
  process.exit(1);
}

const engine = new CoreEngine(botName);

// Clean exit on termination signals
const handleShutdown = async () => {
  console.log(`\nRunner received shutdown signal for bot: ${botName}`);
  await engine.stop();
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

// Run the engine
engine.start().catch((err) => {
  console.error(`Runner critical error for ${botName}:`, err);
  process.exit(1);
});
