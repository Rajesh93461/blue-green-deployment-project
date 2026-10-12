# Blue-Green Deployment Platform (Git + Docker + Jenkins + Nginx)

Zero-downtime releases with instant rollback. Two identical environments run side by side:
**Blue** (live) and **Green** (new version). Nginx decides which one users see.

```
Git push -> Jenkins -> Test -> Docker build -> Deploy to idle env
         -> Health check -> Switch Nginx -> Verify (auto rollback on failure)
```

## Project structure
| File | Purpose |
|---|---|
| `app/app.py` | Sample Flask app with `/` (shows env + version) and `/health` |
| `app/Dockerfile` | Builds the app image |
| `docker-compose.yml` | Runs Blue, Green and the Nginx router |
| `nginx/blue.conf`, `green.conf` | Routing rules; `active.conf` = the live one |
| `scripts/deploy.sh` | Build image and deploy to the **idle** environment |
| `scripts/health.sh` | Health check (retries 10 times) |
| `scripts/switch.sh` | Switch traffic Blue <-> Green |
| `scripts/rollback.sh` | Send traffic back to the previous environment |
| `Jenkinsfile` | The full CI/CD pipeline |

## Requirements
Docker Desktop (with Compose), Git, Jenkins. On Windows use **WSL2 or Git Bash** to run the scripts.

## Part 1: Run without Jenkins (quick demo)
```bash
./scripts/setup.sh                 # Blue v1 live at http://localhost:8080
./scripts/deploy.sh v2             # v2 goes to Green (idle). Users still see Blue
./scripts/health.sh green          # health check on Green (http://localhost:5002)
./scripts/switch.sh green          # users now see Green v2, no downtime
./scripts/rollback.sh              # instantly back to Blue v1
```
**Failed release demo:**
```bash
BROKEN=1 ./scripts/deploy.sh v3    # faulty build goes to idle env
./scripts/health.sh <idle-env>     # FAILS -> do not switch; users unaffected
```

## Part 2: Run with Jenkins
1. Push this folder to a GitHub repo.
2. Jenkins: **New Item -> Pipeline -> Pipeline script from SCM** -> your repo URL -> script path `Jenkinsfile`.
3. The Jenkins agent must have Docker and Docker Compose, and permission to use Docker
   (Jenkins on your own machine: `sudo usermod -aG docker jenkins`, then restart Jenkins).
4. Click **Build with Parameters**:
   - `SIMULATE_BUG` unticked -> release goes live.
   - `SIMULATE_BUG` ticked -> health check fails, traffic is **not** switched.
5. Open http://localhost:8080 after each build and watch the version change.

## Screenshots to put in your report
1. Jenkins pipeline stage view (green run).
2. Jenkins run with `SIMULATE_BUG` showing the Health Check stage failed.
3. `docker ps` showing app-blue, app-green, app-router.
4. Browser at localhost:8080 showing Blue v1, then Green v2.
5. Browser after rollback.

## How it maps to the abstract
- **Git**: version control and pipeline trigger
- **Docker**: identical containers for Blue and Green
- **Jenkins**: build, test, deploy automation (`Jenkinsfile`)
- **Health checks**: `/health` endpoint + `health.sh`
- **Traffic routing**: Nginx config swap + reload
- **Rollback**: `rollback.sh` / automatic in the Verify stage
- **Deployment history**: Jenkins build history (and the website dashboard demo)

## Limitations (mention in viva)
Running two environments doubles resources, and database changes must stay backward compatible.

