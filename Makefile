.PHONY: help validate

help:
	@echo "Targets:"
	@echo "  validate  - validate JSON configs (shared/contract)"

validate:
	node shared/contract/scripts/validate-config.js
