import { job, workflow } from "@dedalus-labs/hollywood";
import {
	checkoutAction,
	pnpmAction,
	setupNodeAction,
} from "./actions";

const setup = [
	{ uses: checkoutAction, with: { "persist-credentials": false } },
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
			steps: [
				...setup,
				{ name: "Build", run: "pnpm build" },
				{
					name: "Apply Postgres migrations",
					env: { DATABASE_URL: "${{ secrets.DATABASE_URL }}" },
					run: "pnpm db migrate",
				},
				{
					name: "Upload Worker version",
					env: {
						CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
						CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
					},
					run: 'pnpm exec wrangler versions upload --tag "${GITHUB_SHA}" --message "${GITHUB_SHA}"',
				},
				{
					name: "Deploy Worker version",
					env: {
						CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
						CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
					},
					run: 'pnpm exec wrangler versions deploy --version-tag "${GITHUB_SHA}" --message "${GITHUB_SHA}" --yes',
				},
				{
					name: "Smoke live deployment",
					run: "SCHEDULE_PIZZA_URL=https://schedule.pizza pnpm --workspace-root smoke",
				},
			],
		}),
	},
});
