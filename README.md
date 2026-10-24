# Blue-Green Deployment in DevOps

A zero-downtime application deployment and rollback project, built with Docker, Nginx, Git and Jenkins.
This repository has two parts.

> An educational project inspired by how large online retailers release new versions safely.
> It is not Amazon's real system and does not use Amazon's name or logo.

## Part 1: ShopSphere (main project) - `Shopsphere/`

An e-commerce application released with the Blue-Green strategy, plus a **Deployment Console** that runs the release steps, watches real traffic and rolls back automatically.

| | **Blue: Version 1.0 (old)** | **Green: Version 2.0 (new)** |
|---|---|---|
| Attributes | 5 | 9 |
| Options | 2 | 9 |
| Layout | Classic table list | Modern card grid with filter sidebar and cart |

What it demonstrates:
- **A good release:** health check, smoke tests, traffic switch, live monitoring, success.
- **A bad release:** a hidden bug in Green is caught by live monitoring (25% errors, limit 5%), and traffic rolls back to Blue with a clear reason.
- **A blocked release:** an unhealthy Green never receives users.

Run it (Windows 11, Docker Desktop, PowerShell):
```powershell
cd Shopsphere
.\scripts\start.ps1
```
Then open http://localhost:9000 (Deployment Console).

Full instructions, demo steps, report and viva answers: see [`Shopsphere/README.md`](Shopsphere/README.md), [`Shopsphere/REPORT.md`](Shopsphere/REPORT.md) and [`Shopsphere/VIVA.md`](Shopsphere/VIVA.md).

## Part 2: Jenkins CI/CD pipeline - root folder

The first version of the project: a small Flask app deployed Blue to Green by a Jenkins pipeline.

```
Git push -> Jenkins -> Test -> Docker build -> Deploy to idle environment
         -> Health check -> Switch Nginx -> Verify (automatic rollback on failure)
```

| Folder / file | Purpose |
|---|---|
| `app/` | Flask app with `/health`, plus its Dockerfile and tests |
| `docker-compose.yml` | Blue, Green and Nginx router |
| `nginx/` | Routing files for Blue and Green |
| `scripts/` | PowerShell scripts: setup, deploy, health check, switch, rollback |
| `Jenkinsfile` | The pipeline stages (checkout, test, deploy, health check, switch, verify) |

Run the pipeline from Jenkins with **Build with Parameters**. Tick `SIMULATE_BUG` to show a broken release being blocked at the health check.

> Both parts use port 8080 for users, so run only one at a time (run `.\scripts\stop.ps1` in `Shopsphere`, or `docker rm -f app-blue app-green app-router` for Part 2, before starting the other).

## Tools used
Git and GitHub, Docker and Docker Compose, Nginx, Jenkins, Node.js and Express, Python and Flask, PowerShell.

## Benefits and limitations
**Benefits:** near-zero downtime, safe checks before and after the switch, instant rollback.
**Limitations:** two environments need double the resources, and database changes must work with both versions.
