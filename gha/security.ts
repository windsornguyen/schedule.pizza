import { job, workflow } from "@dedalus-labs/hollywood";
import {
	checkoutAction,
	gitleaksAction,
	pnpmAction,
	setupNodeAction,
} from "./actions";

const dependencySetup = [
	{ uses: checkoutAction, with: { "persist-credentials": false } },
	{ uses: pnpmAction, with: { version: "10" } },
	{ uses: setupNodeAction, with: { "node-version": "22", cache: "pnpm" } },
] as const;

export const security = workflow({
	name: "Security",
	on: {
		push: { branches: ["main"] },
		pull_request: { branches: ["main"] },
	},
	permissions: { contents: "read" },
	jobs: {
		gitleaks: job({
			name: "Gitleaks",
			"runs-on": "ubuntu-latest",
			permissions: {
				contents: "read",
				"pull-requests": "read",
			},
			steps: [
				{
					uses: checkoutAction,
					with: {
						"fetch-depth": 0,
						"persist-credentials": false,
					},
				},
				{
					name: "Run Gitleaks",
					uses: gitleaksAction,
					env: {
						GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
						GITLEAKS_ENABLE_COMMENTS: "false",
						GITLEAKS_ENABLE_UPLOAD_ARTIFACT: "false",
					},
				},
			],
		}),
		"dependency-audit": job({
			name: "Dependency Audit",
			"runs-on": "ubuntu-latest",
			permissions: { contents: "read" },
			steps: [
				...dependencySetup,
				{ name: "Audit dependencies", run: "pnpm audit --audit-level high" },
			],
		}),
	},
});
