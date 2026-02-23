# IDS Makefile
# Purpose: centralize repeatable project commands.
# Fit: one canonical entrypoint for validation in local dev and CI.

.PHONY: help validate

help:
	@echo "Targets:"
	@echo "  validate  - validate JSON configs (shared/contract)"

validate:
	node shared/contract/scripts/validate-config.js
