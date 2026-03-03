.PHONY: install validate test test-all verify-all run-admin run-player run-player-static

install:
	npm --prefix admin install
	npm --prefix player install
	npm --prefix shared/contract install

validate:
	node shared/contract/scripts/validate-config.js

test:
	npm --prefix admin test
	npm --prefix player test

test-all:
	./scripts/verify-all.sh

verify-all: test-all

run-admin:
	node admin/src/index.js

run-player:
	node player/src/index.js --config shared/contract/examples/config.welcome.json --admin-url http://127.0.0.1:8081 --port 7070

run-player-static:
	node player/src/index.js --config shared/contract/examples/config.welcome.json --port 7070
