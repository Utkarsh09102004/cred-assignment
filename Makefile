# Simple automation for cred-assignment
# Usage:
#   make install         # install deps
#   make dev             # run Next.js dev server
#   make build           # production build
#   make start           # start prod server (after build)
#   make lint            # run eslint
#   make prisma-generate # generate Prisma client
#   make prisma-migrate  # run Prisma migrate (adjust command if needed)
#   make seed            # seed DB (placeholder)
#   make validate-tree   # call validator via update_tree tool (placeholder)
#   make sync-now        # trigger sync via local API (server must be running)
#   make sync-direct     # run syncSegments directly (no server needed)
#   make setup-dev       # install, generate, migrate, sync, then run dev server
#   make setup-build     # install, generate, migrate, sync, then build+start prod
#   make clean           # remove node_modules/.next

NODE_BIN := npm
NEXT := npx next
ESLINT := npx eslint
PRISMA := npx prisma

install:
	$(NODE_BIN) install

dev:
	$(NEXT) dev

build:
	$(NEXT) build

start:
	$(NEXT) start

lint:
	$(ESLINT) .

prisma-generate:
	$(PRISMA) generate

prisma-migrate:
	$(PRISMA) migrate dev --name init

seed:
	@echo "Implement your seed script in package.json and update this target."

validate-tree:
	@echo "Trigger validation via API (implement when flow is ready)."

sync-now:
	@echo "Calling /api/sync-segments on localhost:3000 ..."
	@curl -fsS -X POST http://localhost:3000/api/sync-segments

setup-dev:
	$(NODE_BIN) install
	$(PRISMA) generate
	$(PRISMA) migrate dev --name init
	$(NEXT) dev

setup-build:
	$(NODE_BIN) install
	$(PRISMA) generate
	$(PRISMA) migrate dev --name init
	$(NEXT) build
	$(NEXT) start

clean:
	rm -rf node_modules .next

.PHONY: install dev build start lint prisma-generate prisma-migrate seed validate-tree sync-now sync-direct setup-dev setup-build clean
