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
	deno task build

.PHONY: download-frontend-imports
download-frontend-imports:
	deno task download-frontend-imports

.PHONY: build-babel
build-babel:
	deno task build-babel

.PHONY: watch-babel
watch-babel:
	deno task watch-babel

.PHONY: migrate-db
migrate-db:
	deno task migrate-db

.PHONY: exec-db
exec-db:
	docker exec -it -u postgres $(shell basename $(CURDIR))-postgresql-1 psql

.PHONY: build-tailwind
build-tailwind:
	deno task build-tailwind

.PHONY: watch-tailwind
watch-tailwind:
	deno task watch-tailwind

.PHONY: preview
preview:
	deno task preview
