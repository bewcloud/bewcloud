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

.PHONY: migrate-db
migrate-db:
	deno run --allow-net --allow-read --allow-env migrate-db.ts

.PHONY: exec-db
exec-db:
	docker exec -it -u postgres $(shell basename $(CURDIR))-postgresql-1 psql
