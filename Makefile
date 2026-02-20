SHELL := /bin/bash

.PHONY: start
start:
	deno task start

.PHONY: format
format:
	deno fmt

.PHONY: test
test:
	deno task check
	deno task test

.PHONY: build
build:
	make download-frontend-imports
	make build-babel
	make build-tailwind

.PHONY: download-frontend-imports
download-frontend-imports:
	deno task download-frontend-imports

.PHONY: build-babel
build-babel:
	deno run --allow-env --allow-ffi --allow-sys --allow-read --allow-write=public/components npm:@babel/cli@7.28.6/babel ./components --out-dir ./public/components --extensions ".ts,.tsx"

.PHONY: watch-babel
watch-babel:
	deno run --allow-env --allow-ffi --allow-sys --allow-read --allow-write=public/components npm:@babel/cli@7.28.6/babel ./components --out-dir ./public/components --extensions ".ts,.tsx" --watch

.PHONY: migrate-db
migrate-db:
	deno task migrate-db

.PHONY: exec-db
exec-db:
	docker exec -it -u postgres $(shell basename $(CURDIR))-postgresql-1 psql

.PHONY: build-tailwind
build-tailwind:
	deno install --allow-scripts npm:tailwindcss@4.2.0 npm:@tailwindcss/cli@4.2.0
	deno run --allow-env --allow-read --allow-sys --allow-ffi --vendor --unstable-detect-cjs --allow-write=public/css,/var/folders --allow-scripts npm:@tailwindcss/cli@4.2.0 -i ./public/css/tailwind-input.css -o ./public/css/tailwind.css

.PHONY: watch-tailwind
watch-tailwind:
	deno install --allow-scripts npm:tailwindcss@4.2.0 npm:@tailwindcss/cli@4.2.0
	deno run --allow-env --allow-read --allow-sys --allow-ffi --vendor --unstable-detect-cjs --allow-write=public/css,/var/folders --allow-scripts npm:@tailwindcss/cli@4.2.0 -w -i ./public/css/tailwind-input.css -o ./public/css/tailwind.css

.PHONY: preview
preview:
	deno task preview
