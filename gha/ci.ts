import { job, workflow } from "@dedalus-labs/hollywood";
import { checkoutAction, pnpmAction, setupNodeAction } from "./actions";

const setup = [
	{ uses: checkoutAction, with: { "persist-credentials": false } },
	{ uses: pnpmAction, with: { version: "10" } },
	{ uses: setupNodeAction, with: { "node-version": "22", cache: "pnpm" } },
	{ name: "Install", run: "pnpm install --frozen-lockfile" },
] as const;

export const ci = workflow({
	name: "CI",
	on: {
		push: { branches: ["main"] },
		pull_request: { branches: ["main"] },
	},
	permissions: { contents: "read" },
	jobs: {
		check: job({
			name: "Check",
			"runs-on": "ubuntu-latest",
			defaults: { run: { "working-directory": "apps/pizza" } },
			steps: [...setup, { name: "Check", run: "pnpm check" }],
		}),
	},
});
