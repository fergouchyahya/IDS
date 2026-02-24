.PHONY: validate run-admin run-player

validate:
	node shared/contract/scripts/validate-config.js

run-admin:
	node admin/src/index.js

run-player:
	node player/src/index.js --config shared/contract/examples/config.welcome.json
