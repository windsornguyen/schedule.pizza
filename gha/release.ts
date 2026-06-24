import { job, workflow } from "@dedalus-labs/hollywood";
import { checkoutAction, releasePleaseAction } from "./actions";

export const release = workflow({
	name: "Release",
	on: {
		push: { branches: ["main"] },
		workflow_dispatch: {},
	},
	permissions: { contents: "read" },
	jobs: {
		"release-please": job({
			name: "Release Please",
			"runs-on": "ubuntu-24.04",
			permissions: {
				contents: "write",
				issues: "write",
				"pull-requests": "write",
			},
			outputs: {
				release_created: "${{ steps.release.outputs.release_created }}",
				releases_created: "${{ steps.release.outputs.releases_created }}",
				tag_name: "${{ steps.release.outputs.tag_name }}",
				version: "${{ steps.release.outputs.version }}",
			},
			steps: [
				{ uses: checkoutAction, with: { "persist-credentials": false } },
				{
					id: "release",
					name: "Run release-please",
					uses: releasePleaseAction,
					with: {
						token: "${{ secrets.GITHUB_TOKEN }}",
						"config-file": "release-please-config.json",
						"manifest-file": ".release-please-manifest.json",
					},
				},
				{
					name: "Release summary",
					if: "steps.release.outputs.release_created == 'true'",
					env: {
						TAG_NAME: "${{ steps.release.outputs.tag_name }}",
						VERSION: "${{ steps.release.outputs.version }}",
					},
					run: [
						"{",
						'  echo "## schedule.pizza Release Created"',
						'  echo ""',
						'  echo "| Item | Value |"',
						'  echo "|------|-------|"',
						'  echo "| Tag | $TAG_NAME |"',
						'  echo "| Version | $VERSION |"',
						'} >> "$GITHUB_STEP_SUMMARY"',
					].join("\n"),
				},
			],
		}),
	},
});
