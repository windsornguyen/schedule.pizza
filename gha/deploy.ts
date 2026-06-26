import { job, uses, workflow } from "@dedalus-labs/hollywood";
import {
	checkoutAction,
	pnpmAction,
	setupNodeAction,
	wranglerAction,
} from "./actions";

const setup = [
	{ uses: checkoutAction },
	{ uses: pnpmAction, with: { version: "10" } },
	{ uses: setupNodeAction, with: { "node-version": "22", cache: "pnpm" } },
	{ name: "Install", run: "pnpm install --frozen-lockfile" },
] as const;

export const deploy = workflow({
	name: "Deploy",
	on: {
		push: {
			branches: ["main"],
			paths: ["apps/pizza/**", "packages/**", "pnpm-lock.yaml"],
		},
	},
	permissions: { contents: "read" },
	jobs: {
		deploy: job({
			name: "Deploy to Cloudflare",
			"runs-on": "ubuntu-latest",
			defaults: { run: { "working-directory": "apps/pizza" } },
			env: {
				CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
				CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
			},
			steps: [
				...setup,
				{ name: "Build", run: "pnpm build" },
				{
					uses: wranglerAction,
					with: {
						apiToken: "${{ env.CLOUDFLARE_API_TOKEN }}",
						accountId: "${{ env.CLOUDFLARE_ACCOUNT_ID }}",
						workingDirectory: "apps/pizza",
					},
				},
			],
		}),
	},
});
