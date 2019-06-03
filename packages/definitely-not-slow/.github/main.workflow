workflow "build, test and publish on release" {
  on = "push"
  resolves = ["publish production", "publish beta"]
}

action "install" {
  uses = "actions/npm@master"
  args = "install"
}

action "build" {
  needs = "install"
  uses = "actions/npm@master"
  args = "run build"
}

action "test" {
  needs = "install"
  uses = "actions/npm@master"
  args = "test"
}

action "publish beta" {
  needs = ["build", "test"]
  uses = "actions/npm@master"
  args = "run push-beta"
}

action "check for new tag" {
  needs = ["build", "test"]
  uses = "actions/bin/filter@master"
  args = "tag"
}

action "publish production" {
  needs = "check for new tag"
  uses = "actions/npm@master"
  args = "run push-production"
  secrets = ["GITHUB_TOKEN"]
}