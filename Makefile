.PHONY: release

# Get the recommended bump type from conventional-recommended-bump
BUMP_TYPE := $(shell npx conventional-recommended-bump -p conventionalcommits)

release:
	@echo "Recommended bump type: $(BUMP_TYPE)"
	@if [ -z "$(BUMP_TYPE)" ]; then \
		echo "No version bump needed. Skipping release."; \
		exit 0; \
	fi

	# 1. Bump version in package.json with conventional-recommended-bump
	npm version $(BUMP_TYPE) --no-git-tag-version

	# 2. Create CHANGELOG.md with conventional-changelog
	npx conventional-changelog -p conventionalcommits -i CHANGELOG.md -o CHANGELOG.md

	# 3. Commit package.json and CHANGELOG.md files (and package-lock.json)
	git add package.json package-lock.json CHANGELOG.md
	git commit -m "chore(release): $$(node -p "require('./package.json').version") :tada: [skip ci]"

	# 4. Tag
	git tag -a v$$(node -p "require('./package.json').version") -m "chore(release): $$(node -p "require('./package.json').version") :tada: [skip ci]"
