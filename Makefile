SHELL := /bin/bash

.PHONY: start
start:
	deno run watch-app

.PHONY: format
format:
	deno fmt

.PHONY: test
test:
	deno fmt --check
	deno lint
	deno check .
	IS_TESTING=true deno test --allow-net --allow-read --allow-env --allow-ffi --check

.PHONY: migrate-db
migrate-db:
	deno run --allow-net --allow-read --allow-env migrate-db.ts

.PHONY: crons/cleanup
crons/cleanup:
	deno run --allow-net --allow-read --allow-env crons/cleanup.ts

.PHONY: exec-db
exec-db:
	docker exec -it -u postgres $(shell basename $(CURDIR))-postgresql-1 psql

.PHONY: build-tailwind
build-tailwind:
	deno install --allow-scripts npm:tailwindcss@4.1.7 npm:@tailwindcss/cli@4.1.7
	deno run --allow-env --allow-read --allow-sys --allow-ffi --vendor --unstable-detect-cjs --allow-write=public/css,/var/folders --allow-scripts npm:@tailwindcss/cli@4.1.7 -i ./public/css/tailwind-input.css -o ./public/css/tailwind.css

.PHONY: watch-tailwind
watch-tailwind:
	deno install --allow-scripts npm:tailwindcss@4.1.7 npm:@tailwindcss/cli@4.1.7
	deno run --allow-env --allow-read --allow-sys --allow-ffi --vendor --unstable-detect-cjs --allow-write=public/css,/var/folders --allow-scripts npm:@tailwindcss/cli@4.1.7 -w -i ./public/css/tailwind-input.css -o ./public/css/tailwind.css

.PHONY: build
build:
	make build-tailwind
