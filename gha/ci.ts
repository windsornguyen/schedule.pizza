import { job, workflow } from "@dedalus-labs/hollywood";
import { checkoutAction, pnpmAction, setupNodeAction } from "./actions";

const setup = [
	{ uses: checkoutAction, with: { "persist-credentials": false, "fetch-depth": 0 } },
	{ uses: pnpmAction },
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
			services: {
				postgres: {
					image: "postgres:18.3-bookworm@sha256:80630f83606d8db77d30b3851b16a9f78be2d0d4dda6f7b82a1fdca5ebe3acba",
					env: { POSTGRES_USER: "pizza", POSTGRES_PASSWORD: "pizza", POSTGRES_DB: "pizza" },
					ports: ["5432:5432"],
					options: '--health-cmd "pg_isready -U pizza" --health-interval 5s --health-timeout 5s --health-retries 10',
				},
			},
			env: {
				TEST_DATABASE_URL: "postgres://pizza:pizza@127.0.0.1:5432/pizza",
				MIGRATION_BASE_REF: "${{ github.event.pull_request.base.sha || github.event.before }}",
			},
			steps: [...setup, { name: "Check", run: "pnpm --workspace-root check" }],
		}),
	},
});
