# Viva Questions and Simple Answers

**1. What is Blue-Green deployment?** Two identical environments run together. Blue is live (old version); Green has the new version. After checks, users move to Green. If it fails, they go back to Blue.

**2. How do Blue and Green differ in your project?** Attributes: 5 vs 9. Options: 2 (search, category) vs 9 (adds brand filter, sorting, in-stock filter, discount pricing, ratings, quick view, cart). Layout: classic table vs modern card grid with sidebar.

**3. How does your deployment work, step by step?** Health check on Green, smoke test, switch traffic with Nginx, monitor live requests, then decide: keep Green or roll back.

**4. Why did the rollback happen?** Green v2.0 had a hidden bug in the discount calculation. Product pages with 20%+ discount returned HTTP 500. Monitoring saw 25% errors, above the 5% limit, so the Console rolled back to Blue.

**5. Why did the health check not catch the bug?** `/health` only says the server is running, and the smoke test opened a low-discount product. Only real traffic touched the faulty pages. That is why monitoring after the switch matters.

**6. How does rollback work?** Blue never stopped. The Console writes the Blue route and Nginx reloads. It takes about a second.

**7. What is downtime?** The time users cannot use the app. Blue-Green keeps it near zero because the new version is ready before users move.

**8. What is Docker, a container, and an image?** Docker packages an app with what it needs. A container is a running package; an image is the template it is created from. I built `shopsphere-blue:1.0` and `shopsphere-green:2.0`.

**9. What is Docker Compose?** A file that starts several containers together. Mine starts Blue, Green, Nginx and the Deployment Console.

**10. What is Nginx and why use it?** A web server that can act as a reverse proxy. It receives user requests and forwards them to the live environment, so I can change the target without users noticing.

**11. How does Nginx switch without restarting?** The Console edits a shared route file. The router reloads Nginx when the file changes. Reload keeps existing connections alive.

**12. How is old Blue data handled in Green?** Green keeps all 5 old attributes and fills safe defaults for the 4 new ones. After rollback Blue ignores the extra fields.

**13. What are the ports for?** 8080 is for users via Nginx, 3001 and 3002 test Blue and Green directly, 9000 is the Deployment Console.

**14. What are the disadvantages of Blue-Green?** It needs double the resources, and database changes must work with both versions.

**15. Is this Amazon's system?** No. It is an educational simulation inspired by how big companies release safely.

**16. What would you improve?** A shared database, Jenkins to start deployments from GitHub, and gradual traffic shifting (canary releases).
