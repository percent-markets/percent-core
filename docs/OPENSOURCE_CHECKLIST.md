# Open Source Preparation Checklist - AGPL-3.0

This checklist documents all tasks that need to be completed before open sourcing the Percent Protocol under AGPL-3.0 License.

## 🔒 Security & Credentials

- [ ] **Review and audit all code for hardcoded secrets, API keys, or sensitive data**
  - Check all .ts, .tsx, .js files for hardcoded values
  - Look for patterns like API_KEY, SECRET, PASSWORD, TOKEN
  - Verify all secrets are loaded from environment variables

- [ ] **Check git history for accidentally committed secrets or credentials**
  - Run: `git log -p | grep -i 'password\|api_key\|secret'`
  - Consider using tools like `git-secrets` or `truffleHog`
  - Rewrite history if secrets found (use BFG Repo-Cleaner)

- [ ] **Review and anonymize any internal URLs, endpoints, or company-specific references**
  - Check for company domain names
  - Replace internal service URLs with example.com
  - Remove team member names from comments

- [ ] **Audit code for SQL injection vulnerabilities**
  - Review all database queries
  - Ensure parameterized queries are used
  - Check PersistenceService for proper escaping

- [ ] **Ensure all user inputs are properly validated and sanitized**
  - Review all API endpoints for input validation
  - Check request body parsing
  - Verify all PublicKey conversions have try-catch

## ⚖️ Legal & Licensing

- [ ] **Add AGPL-3.0 LICENSE file to repository root**
  - Download from: https://www.gnu.org/licenses/agpl-3.0.txt
  - Add to root directory as `LICENSE`

- [ ] **Review all dependencies for AGPL-3.0 license compatibility**
  - List all dependencies: `pnpm list --json`
  - Check each for license (MIT, Apache-2.0, BSD are compatible)
  - Document any GPL/AGPL dependencies
  - Remove or replace incompatible licenses

- [ ] **Add copyright headers to all source files**
  ```typescript
  /**
   * Copyright (C) 2025 Percent Protocol Contributors
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Affero General Public License as published
   * by the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
   * GNU Affero General Public License for more details.
   */
  ```

- [ ] **Add proper attribution for third-party code and borrowed implementations**
  - Check for copied code snippets
  - Add attribution comments with source URLs
  - Verify license compatibility for borrowed code

## 📚 Documentation

- [ ] **Create .env.example file with all required environment variables documented**
  - List all environment variables from the codebase
  - Add descriptions and example values (non-sensitive)
  - Include mainnet and devnet configurations

- [ ] **Create comprehensive README.md with project overview, setup, and usage instructions**
  - Project description and goals
  - Key features
  - Prerequisites (Node.js, PostgreSQL, Solana CLI)
  - Installation steps
  - Quick start guide
  - Configuration instructions
  - Testing instructions
  - Troubleshooting section

- [ ] **Add CONTRIBUTING.md with guidelines for contributors**
  - Code style guidelines
  - Branch naming conventions
  - Commit message format
  - Pull request process
  - Testing requirements
  - How to report bugs
  - Development setup

- [ ] **Add CODE_OF_CONDUCT.md for community standards**
  - Use Contributor Covenant or similar
  - Define expected behavior
  - Enforcement policies
  - Contact information

- [ ] **Create SECURITY.md with vulnerability reporting instructions**
  - Security policy
  - Supported versions
  - How to report vulnerabilities
  - Response timeline expectations
  - PGP key if applicable

- [ ] **Document all API endpoints with request/response examples**
  - Create API.md or OpenAPI spec
  - Document all routes with:
    - Method and path
    - Request parameters
    - Request body schema
    - Response schema
    - Example curl commands
    - Error codes

- [ ] **Add deployment guide for both devnet and mainnet**
  - Server requirements
  - Database setup
  - Environment configuration
  - Building and deploying
  - Monitoring and logging
  - Backup procedures

- [ ] **Add architecture diagrams or flowcharts for key systems**
  - System architecture overview
  - Proposal lifecycle diagram
  - AMM trading flow
  - Vault split/merge/redeem flow
  - Database schema diagram

- [ ] **Review CLAUDE.md for any sensitive information before making it public**
  - Check for internal references
  - Verify all examples are generic
  - Consider renaming to ARCHITECTURE.md or DEVELOPMENT.md

## 🧹 Code Quality

- [ ] **Remove or document all TODO/FIXME comments**
  - Search: `grep -r "TODO\|FIXME" src/`
  - Convert to GitHub issues or complete tasks
  - Document known limitations in README

- [ ] **Remove test/debug code and commented-out code blocks**
  - Search for console.log statements (keep structured logging)
  - Remove commented code blocks
  - Clean up debug endpoints

- [ ] **Remove unused dependencies from package.json**
  - Run: `pnpm exec depcheck`
  - Remove unused packages
  - Verify all imports are used

- [ ] **Test complete setup process from scratch on clean environment**
  - Use Docker container or fresh VM
  - Follow README instructions exactly
  - Document any missing steps
  - Verify both devnet and mainnet setups

## 🛡️ Security Review

- [ ] **Review authentication and authorization mechanisms for security issues**
  - API key validation logic
  - Protected endpoint list
  - Rate limiting implementation
  - CORS configuration

- [ ] **Run dependency audit (npm audit / pnpm audit) and fix critical vulnerabilities**
  ```bash
  pnpm audit
  pnpm audit --fix
  ```
  - Review critical and high severity issues
  - Update vulnerable packages
  - Document unfixable vulnerabilities

- [ ] **Add disclaimer about audit status and use at own risk**
  - Add to README:
    ```
    ⚠️ **Security Notice**: This software has not been formally audited.
    Use at your own risk. We recommend thorough testing before production use.
    ```

## 🤝 Community Preparation

- [ ] **Add GitHub issue templates (.github/ISSUE_TEMPLATE/)**
  - Bug report template
  - Feature request template
  - Question template
  - Config file for issue template chooser

- [ ] **Add GitHub pull request template (.github/PULL_REQUEST_TEMPLATE.md)**
  - Description checklist
  - Testing checklist
  - Documentation updates
  - Breaking changes section

- [ ] **Set up CI/CD pipeline (GitHub Actions) for automated testing and linting**
  - TypeScript compilation check
  - Linting (ESLint)
  - Unit tests
  - Integration tests (if applicable)
  - Dependency audit

- [ ] **Add badges to README (license, build status, etc.)**
  ```markdown
  ![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
  ![Build Status](https://github.com/[owner]/[repo]/workflows/CI/badge.svg)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
  ```

- [ ] **Verify database migration scripts are included and documented**
  - Create `migrations/` folder if not exists
  - Add numbered migration files
  - Document migration process in README
  - Include initial schema setup

---

## Progress Tracking

Total Tasks: 30
- ✅ Completed: 0
- ⏳ In Progress: 0
- ❌ Blocked: 0
- ⭕ Not Started: 30

Last Updated: 2025-10-31

---

## Notes

- Consider creating a `ROADMAP.md` for future features
- May want to add `CHANGELOG.md` for version tracking
- Consider adding example configuration files beyond .env.example
- Think about creating a `docs/` folder with more detailed documentation
