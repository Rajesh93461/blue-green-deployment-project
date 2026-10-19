# Real-Time E-Commerce Application Using Blue-Green Deployment (Amazon-Inspired Case Study)

*An educational simulation inspired by large-scale deployment practice. It is not Amazon's internal system.*

## 1. Abstract
Online shopping platforms release new versions often, but a traditional release can cause downtime or show bugs to customers. This project builds ShopSphere, a working e-commerce application, and releases it with the Blue-Green strategy using Docker and Nginx. Blue (Version 1.0) and Green (Version 2.0) run at the same time and differ in **attributes (5 vs 9), options (2 vs 9) and layout (classic table vs modern card grid)**. A Deployment Console runs the release steps, switches Nginx traffic, monitors real requests, and rolls back automatically when the new version fails. This demonstrates near-zero downtime and a safe, explainable rollback.

## 2. Problem Statement
Replacing a running application stops it, can expose users to bugs, and makes going back slow. For a shop, downtime means lost sales and lost trust.

## 3. Objectives
1. Build a working e-commerce application (products, search, filters, details, add product, cart).
2. Run two versions together that clearly differ in attributes, options and layout.
3. Route users with Nginx and switch traffic without stopping either version.
4. Verify a release in steps: health check, smoke test, switch, live monitoring, decision.
5. Roll back automatically, and explain the reason.

## 4. Existing System
One server runs one version. An update stops it, replaces files and restarts it. Users see errors meanwhile, and a faulty version must be reinstalled by hand.

## 5. Proposed System
Two identical environments in Docker containers. **Blue** is stable and serves users. **Green** holds the new version and is checked first. The Deployment Console moves users to Green only after checks pass, keeps watching real traffic, and returns users to Blue if the error rate is too high. Blue never stops, so rollback takes about a second.

## 6. Architecture
```
Users -> Nginx router (8080) -> BLUE v1.0 (3001)  |  GREEN v2.0 (3002)
              ^
   Deployment Console (9000): deploy steps, route switch, monitoring, rollback
```
Frontend: HTML, CSS, JavaScript (two different layouts). Backend: Node.js and Express. Containers: Docker and Docker Compose. Router: Nginx. Version control: Git and GitHub.

## 7. Implementation
- **Versions:** one codebase, with Docker build argument `APP_VERSION` choosing the schema (5 or 9 attributes), the features, and the web layout that is served.
- **Router:** Nginx includes a shared `route.conf`. A small watcher reloads Nginx whenever the Console changes that file.
- **Deployment steps:** (1) health check on Green; (2) smoke test (version, attribute count, product list, a product page); (3) switch traffic and confirm through the router; (4) monitor 36 test requests across 12 product pages; (5) decision.
- **Rollback logic:** if the error rate is above 5%, the Console writes the Blue route (automatic rollback), or raises an alarm when auto-rollback is off. Every deployment is saved in a history table with its reason.
- **Why rollback happens in the demo:** Green v2.0 has a hidden bug in its new discount calculation. Product pages with a discount of 20% or more fail with HTTP 500. The basic health check and smoke test pass because they do not open those products. Only live-traffic monitoring detects it: 9 of 36 requests fail (25%).
- **API:** consistent JSON (`success`, `data` or `error`), input validation, 404 and bad-JSON handling.

## 8. Results
| Test | Result |
|---|---|
| Blue returns exactly 5 attributes, Green exactly 9 | Passed |
| Blue has 2 options, Green has 9; layouts differ | Passed |
| Healthy release: all 5 steps pass, error rate 0%, result SUCCESS | Passed |
| Release with hidden bug: error rate 25%, automatic rollback to Blue | Passed |
| Auto-rollback off: alarm raised, manual rollback works | Passed |
| Green stopped: release blocked at health check, users stay on Blue | Passed |
| Invalid product input returns a clear error | Passed |

The logic was verified by automated tests of the application and Console (using a stand-in router). Take screenshots of each stage while running the demo in README.md.

## 9. Amazon-Inspired Case Study
Large retailers serve millions of customers, so downtime is costly. Amazon has publicly described deploying code very frequently with automated systems, and AWS offers blue-green deployment in services such as CodeDeploy and Elastic Beanstalk (verify details in the official AWS documentation before quoting). ShopSphere copies the idea at small scale: prepare the new version beside the old one, test it, move users, watch real traffic, and roll back automatically when it misbehaves.

**Benefits:** near-zero downtime, safe checks before users see the release, instant rollback, lower risk.
**Limitations:** two environments cost more, and database changes must work with both versions.

## 10. Conclusion
The project shows a new shop version released without stopping the old one, checked in clear steps, monitored on real traffic, and reversed automatically with a visible reason. Future work: a shared database, Jenkins to start deployments from Git pushes, and gradual (canary) traffic shifting.
