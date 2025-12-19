SHELL := /bin/bash

.PHONY: preview
preview:
	deno task preview

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
	deno task migrate-db

.PHONY: exec-db
exec-db:
	docker exec -it -u postgres $(shell basename $(CURDIR))-postgresql-1 psql
