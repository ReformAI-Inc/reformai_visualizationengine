# Environments

The visualization engine runs as two independent Cloud Run services, one per
branch. Reform-AI's API points at one of them through
`VISUALIZATION_SERVICE_URL`, so which engine a Reform-AI environment talks to is
a configuration choice on that side, not a code change on this one.

| Environment | Branch | Cloud Run service | Region | Gemini key (Secret Manager) |
|---|---|---|---|---|
| Production | `main` | `reform-ai-vis-prod` | us-central1 | `vis-gemini-api-key-prod` |
| QA | `qa` | `reform-ai-vis-qa` | us-central1 | `vis-gemini-api-key-qa` |
| Legacy sandbox | — (manual) | `reform-ai-vis` | us-central1 | plaintext env var |

All in GCP project `reformai-core`.

## Why two keys

QA is where model comparisons are exercised — the Gemini 3.1 migration will hammer
it. A shared key would mean those runs consume production's quota and rate
limits, and land in the same billing line. Separate keys keep the blast radius of
a QA experiment inside QA.

## Deploying

Push to the branch. `qa` deploys the QA service, `main` deploys production; both
workflows are identical apart from branch, service name and key, so a change
proven in QA reaches production by merging rather than by editing a deploy step.

Neither workflow touches `reform-ai-vis`. That legacy sandbox service is now
deploy-on-demand only (`deploy-vis-sandbox.yml`, `workflow_dispatch`).

## Which model each environment runs

| Environment | Image model | Set by |
|---|---|---|
| QA | `gemini-3.1-flash-image` | `IMAGE_MODEL` env var in deploy-vis-qa.yml |
| Production | `gemini-2.5-flash-image` | in-code default (`IMAGE_MODEL` unset) |
| Local / sandbox | `gemini-2.5-flash-image` | in-code default |

`DEFAULT_IMAGE_MODEL` reads `IMAGE_MODEL` and falls back to 2.5, so a model
migration is an environment change rather than a code change, and production
cannot be moved by accident. Any `gemini-*` id routes through the Gemini
provider, so no new code path is needed to switch.

To try a different id in QA, edit `IMAGE_MODEL` in deploy-vis-qa.yml and push
`qa`; to promote it, set the same value in deploy-vis-prod.yml (or change the
in-code default once the migration is finished).

Available image models can be listed with the environment's own key:

```
K=$(gcloud secrets versions access latest --secret=vis-gemini-api-key-qa --project=reformai-core)
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$K&pageSize=200" \
  | python3 -c "import json,sys; [print(m['name']) for m in json.load(sys.stdin)['models'] if 'image' in m['name']]"
```

Note the separate `balanced_v7_nb2` pipeline mode (`?mode=balanced_v7_nb2`),
which runs `NB2_IMAGE_MODEL` on identical V7 prompts. That is for A/B comparing
two models against the *same* request; `IMAGE_MODEL` is for moving a whole
environment.

## What the services expect

`API_KEY` is mounted from Secret Manager (never a plaintext env var — the legacy
service still has its key inline, readable by anyone with `run.services.get`).
`VIS_ENV` is `qa` or `prod`, for telemetry and log filtering.

Rotating a key is one command, no deploy needed on the next cold start:

```
printf '%s' "<new key>" | gcloud secrets versions add vis-gemini-api-key-qa \
  --project=reformai-core --data-file=-
```

## Pointing Reform-AI at an engine

Reform-AI's API reads `VISUALIZATION_SERVICE_URL` from its own per-environment
secret (`reform-ai-api-qa` / `reform-ai-api-prod`), so the cutover is a secret
edit plus a redeploy of that API — no code change, because these services are
public exactly like the legacy one.

```
# in the Reform-AI project
gcloud secrets versions access latest --secret=reform-ai-api-qa \
  --project=reformai-core > /tmp/api-qa.env
# edit VISUALIZATION_SERVICE_URL to the QA engine URL, then:
gcloud secrets versions add reform-ai-api-qa --project=reformai-core \
  --data-file=/tmp/api-qa.env
```

> **Careful:** `apps/api/src/config/visualization.config.ts` falls back to the
> *legacy production* URL when `VISUALIZATION_SERVICE_URL` is absent. Removing
> the key rather than changing it makes QA silently call production's engine.

## Known gaps

- **The legacy Gemini key is compromised.** It is a plaintext env var on
  `reform-ai-vis` and `reform-ai-image-visualization-service`, readable by anyone
  with `run.services.get`, and it was echoed into a terminal session. Both new
  secrets were seeded with that same value so the environments come up working —
  **rotate both before real use.**
- **The services are public** (`--allow-unauthenticated`), matching the legacy
  posture: anyone with the URL can spend your Gemini quota. Closing this means
  making them private, granting the Reform-AI API's runtime service account
  `roles/run.invoker`, and minting an ID token in its `HttpClient`.
