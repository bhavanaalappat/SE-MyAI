# Verified E-commerce Software SDLC Corpus

Publicly documented SDLC evidence from official project sources. Accessed 2026-10-05. Undocumented practices are not inferred.

## WooCommerce

Official repository: https://github.com/woocommerce/woocommerce

- documented_planning_requirements: Feature requests use a dedicated request page or GitHub enhancement issue; contributors are directed to existing issues/PRs.
- documented_design_implementation: Fork repository, commit changes, create a pull request; coding standards, issue references, commit messages, and change files are specified.
- documented_testing_qa: Public contribution guide names unit, API, and end-to-end tests; contributors can test beta versions and release candidates.
- documented_review_approval: Changes are submitted through GitHub pull requests and applicable PR templates; maintainers handle changelog updates.
- documented_release_deployment: Public guide documents Git Flow and requires a change file; reviewed source does not describe the full production deployment pipeline.
- documented_maintenance_security: Security issues are reported through HackerOne; the project maintains developer and contribution documentation.
- Documented phases: planning;implementation;testing;review;release;maintenance/security
- Coverage note: Six phases have public evidence, although production deployment mechanics are not described in the reviewed source.
- Source IDs: S01;S02

## Magento Open Source

Official repository: https://github.com/magento/magento2

- documented_planning_requirements: Adobe recommends selecting work from the prioritized issue backlog; large features should be discussed in an issue first; priority and severity are defined.
- documented_design_implementation: Fork-and-pull model; contributors fork, branch, implement, add tests, and open a PR; coding standards and meaningful descriptions are required.
- documented_testing_qa: New logic/features require unit/integration test coverage and all automated PR tests must pass; bug fixes require reproduction steps.
- documented_review_approval: Community Engineering reviews issues and contributions; PR descriptions and review clarifications are required.
- documented_release_deployment: The reviewed Adobe guide documents supported release lines and accepted-PR rules, but not the full deployment pipeline.
- documented_maintenance_security: The reviewed source documents support/release-line handling but does not provide a complete public security response workflow.
- Documented phases: planning;implementation;testing;review;release
- Coverage note: Five phases have public evidence in the reviewed source; maintenance/security is incomplete.
- Source IDs: S03;S04

## PrestaShop

Official repository: https://github.com/PrestaShop/PrestaShop

- documented_planning_requirements: The project uses a documented Git Flow variant: bug fixes go to supported branches and new compatible/incompatible features go to develop.
- documented_design_implementation: Contributions are made through GitHub; code and module licensing requirements are specified.
- documented_testing_qa: Testing requirements are not stated in the reviewed CONTRIBUTING.md; do not infer them from repository contents.
- documented_review_approval: Pull-request contribution is documented, but detailed review gates are not stated in the reviewed source.
- documented_release_deployment: Branch strategy provides release-line guidance; the reviewed source does not describe deployment automation.
- documented_maintenance_security: A security policy exists in the official repository, but its detailed contents were not used as evidence in this row.
- Documented phases: planning;implementation;release;maintenance/security
- Coverage note: Four phases have direct or referenced public evidence; testing and detailed review gates are not stated in the reviewed source.
- Source IDs: S05;S06;S07

## Saleor

Official repository: https://github.com/saleor/saleor

- documented_planning_requirements: Feature requests follow Discord discussion, then a feature-request issue; maintainers approve and label the issue before a PR is eligible.
- documented_design_implementation: Code changes require prior discussion and a GitHub issue; after approval, contributors open a PR referencing the feature issue.
- documented_testing_qa: The general contribution page does not specify a universal test matrix; repository-specific CONTRIBUTING.md files apply.
- documented_review_approval: Saleor maintainers review the proposed implementation and approve the issue before PR eligibility.
- documented_release_deployment: The reviewed contribution page does not describe release or deployment steps.
- documented_maintenance_security: The reviewed contribution page does not describe a security response workflow.
- Documented phases: planning;implementation;review
- Coverage note: Three phases have direct public evidence; testing, release, and security are not stated in the reviewed source.
- Source IDs: S08;S09

## Medusa

Official repository: https://github.com/medusajs/medusa

- documented_planning_requirements: Contributors must find or open an issue before starting; larger features should be discussed with CODEOWNERS to evaluate roadmap fit.
- documented_design_implementation: Fork the repository, branch from develop, make changes, and open a PR to develop; local package linking and a test application are documented.
- documented_testing_qa: Prerequisites include a local Medusa application for testing; the guide describes replacing dependencies with local packages to test changes, but does not define a complete automated test matrix.
- documented_review_approval: A Medusa team member reviews, comments, and eventually approves PRs; external PR triage cadence is explicitly described as variable.
- documented_release_deployment: The reviewed guide documents the develop branch workflow but not the full release/deployment pipeline.
- documented_maintenance_security: The reviewed guide does not state a complete public security response workflow.
- Documented phases: planning;implementation;testing;review
- Coverage note: Four phases have direct public evidence; release and security are not stated in the reviewed source.
- Source IDs: S10;S11

## Shopware

Official repository: https://github.com/shopware/shopware

- documented_planning_requirements: For new features or behavior changes, Shopware recommends creating an issue or discussion before implementation; duplicate work should be checked.
- documented_design_implementation: PRs target the main repository and trunk; contributors must provide implementation details, compatibility/deprecation considerations, changelog, and conventional-commit title.
- documented_testing_qa: Tests are required; contributors must keep PRs complete/tested and ensure all pipeline checks succeed.
- documented_review_approval: Domain teams review PRs on weekdays and may accept, decline, or request changes; authors must respond to review comments and update PRs.
- documented_release_deployment: Changelog files and backport guidance document release-facing change handling; the reviewed source does not describe production deployment.
- documented_maintenance_security: Stale PRs may be closed after two weeks of inactivity; the reviewed source does not provide a security response workflow.
- Documented phases: planning;implementation;testing;review;release;maintenance
- Coverage note: Six phases have public evidence, with deployment and security details limited in the reviewed source.
- Source IDs: S12;S13

## OpenCart

Official repository: https://github.com/opencart/opencart

- documented_planning_requirements: Contributors should search issues, discussions, and the forum first; significant changes should be discussed before coding.
- documented_design_implementation: Fork, branch from master, keep diffs focused, rebase, and submit a PR with motivation, testing notes, regressions, and screenshots/clips for UI changes.
- documented_testing_qa: The guide specifies PHP syntax lint, PHPStan static analysis, php-cs-fixer style checks, CI parity, and regression tests when practical.
- documented_review_approval: PR templates, issue references, testing notes, and maintainer review expectations are documented.
- documented_release_deployment: Major.minor.feature.patch versioning, CHANGELOG updates, install/upgrade docs, and feature-release notice practices are documented; deployment automation is not.
- documented_maintenance_security: Vulnerabilities must be reported privately; the guide also documents supported installation/upgrade resources.
- Documented phases: planning;implementation;testing;review;release;maintenance/security
- Coverage note: Six phases have public evidence, though production deployment is not described.
- Source IDs: S14;S15

## Spree Commerce

Official repository: https://github.com/spree/spree

- documented_planning_requirements: The reviewed security policy does not specify general feature-planning workflow.
- documented_design_implementation: Security patches are submitted privately as a commit/patch rather than a public PR; general implementation workflow is not stated in the reviewed source.
- documented_testing_qa: A security fix is developed and tested against all supported versions; bundler-audit and Brakeman are recommended security checks.
- documented_review_approval: Security reports are triaged, confirmed, and assigned a severity level; general code-review workflow is not stated in the reviewed source.
- documented_release_deployment: A new release is published with a security fix and GitHub Security Advisory.
- documented_maintenance_security: Supported versions receive security patches; vulnerabilities are reported privately and advisories are published.
- Documented phases: testing;review;release;maintenance/security
- Coverage note: Four phases have direct public evidence, specifically for security lifecycle handling rather than the complete product SDLC.
- Source IDs: S16;S17

