# ShopSphere: Blue-Green Deployment Demo (E-Commerce)

An educational project inspired by how large online retailers release new versions safely.
It is **not** Amazon's real system and does not use Amazon's name or logo.

## What is different between Blue and Green?
| | **BLUE: Version 1.0 (old)** | **GREEN: Version 2.0 (new)** |
|---|---|---|
| **Attributes** | **5**: ID, Name, Price, Category, Stock | **9**: the 5 above + Brand, Rating, Discount %, Description |
| **Options** | 2: search by name, category filter | 9: search, category, brand filter, sort, in-stock filter, discount pricing, star ratings, quick view, add to cart |
| **Layout** | Classic table list, plain blue header | Modern card grid, hero banner, filter sidebar, cart |
| **Add-product form** | 4 inputs (ID is automatic) | 8 inputs |

## Architecture
```
Users -> http://localhost:8080 -> [ Nginx router ] -> BLUE  v1.0 (port 3001)
                                        ^            -> GREEN v2.0 (port 3002)
                                        |
                    [ Deployment Console :9000 ] runs the release steps,
                    switches the route, watches errors, and rolls back
```
| URL | What it is |
|---|---|
| http://localhost:9000 | **Deployment Console** (use this for the demo) |
| http://localhost:8080 | What real users see (through Nginx) |
| http://localhost:3001 / 3002 | Blue / Green directly (for testing) |

## Setup (Windows 11)
1. Start **Docker Desktop** and wait for **Engine running**.
2. If you ran the older ShopSphere, remove its containers first (PowerShell):
```powershell
docker rm -f shop-blue shop-green shop-router
```
3. In PowerShell (prompt starts with `PS`):
```powershell
cd C:\project\bluegreen-project\shopsphere
Get-ChildItem -Recurse | Unblock-File
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\scripts\start.ps1
```
First run takes a few minutes. Expected: `READY` and the four URLs above.

## Demo 1: A good release (what a correct deployment looks like)
1. Open http://localhost:9000. **Tick nothing** (both boxes: bug off, auto-rollback on).
2. Click **▶ Deploy Green v2.0**.
3. Watch the 5 steps turn green one by one: **Health check → Smoke tests → Switch traffic → Monitor live traffic → Decision**.
4. Result: error rate **0%**, history shows **SUCCESS**, the pill says **Users are on: GREEN v2.0**.
5. Open http://localhost:8080: the new modern **Green** shop. Click the **Live Preview** tab to see Blue, Green and what users see side by side.

## Demo 2: A bad release and why rollback happens
1. Click **⟲ Reset demo** (back to Blue).
2. **Tick "Release contains a hidden bug"** and keep **Auto-rollback** ticked.
3. Click **▶ Deploy Green v2.0**.
4. Steps 1 to 3 pass: the basic health check and smoke test do not find the bug. Users are moved to Green.
5. Step 4 (monitoring) sends 36 test requests. The error rate rises to **25%**, above the **5%** limit, so step 4 turns red.
6. The console **rolls back automatically**. The red box **"Why did the rollback happen?"** explains: 9 of 36 requests failed with HTTP 500, on product pages 4, 6 and 12, caused by a discount-calculation bug in v2.0 (products with 20%+ discount).
7. Optional proof: while on Green, open http://localhost:3002 and click **Quick view** on a heavily discounted product (for example the headphones with 20% off). You will see the error that users would have seen.

## Demo 3: Alarm, then manual rollback
Reset, tick the bug, **untick Auto-rollback**, deploy. The console shows a red **ALARM**, users stay on the faulty Green, and you click **↩ Rollback to Blue** yourself.

## Demo 4: A release that is blocked before users see it
In PowerShell: `docker stop shop-green`, then click **Deploy**. Step 1 fails (Green not healthy), the other steps are skipped, and users stay on Blue. Then `docker start shop-green`.

## How old data is handled in Green
Green is an additive upgrade: it keeps all 5 Blue attributes and adds 4. Records without the new attributes get safe defaults (`Unbranded`, rating `0`, discount `0`, `No description available yet.`). After a rollback Blue simply ignores the extra fields. Each container keeps its own in-memory data in this demo; in a real company both would share one database.

## How the router switches (for your viva)
The console writes `route.conf` (which says "send users to blue" or "to green") into a shared volume. The router container checks that file every second and reloads Nginx when it changes. No restart, no downtime.

## Commands
```powershell
.\scripts\start.ps1    # build and start everything
.\scripts\status.ps1   # live environment and last result
.\scripts\stop.ps1     # stop and remove everything
docker ps              # shop-blue, shop-green, shop-router, shop-controller
```

## Troubleshooting
- `docker_engine ... cannot find the file`: start Docker Desktop and wait for Engine running.
- `port is already allocated`: run `.\scripts\stop.ps1`, or remove old containers (step 2 of Setup).
- Script "not digitally signed": run `Get-ChildItem -Recurse | Unblock-File`.
- Page did not change: press **Ctrl + F5**.
