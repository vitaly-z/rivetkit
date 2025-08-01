import { config } from "dotenv";
import { registry } from "./registry";

// Load environment variables from .env file
config();

registry.runServer({
	cors: {
		origin: "http://localhost:5173",
	},
});
