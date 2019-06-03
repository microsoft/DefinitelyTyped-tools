workflow "build, test and publish on release" {
  on = "push"
  resolves = "publish production"
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

action "filter branch master" {
  needs = ["build", "test"]
  uses = "actions/bin/filter@master"
  args = "branch master"
}

action "publish beta" {
  needs = "filter branch master"
  uses = "actions/npm@master"
  args = "run push-beta"
}

action "check for new tag" {
  needs = "publish beta"
  uses = "actions/bin/filter@master"
  args = "tag"
}

action "publish production" {
  needs = "check for new tag"
  uses = "actions/npm@master"
  args = "run push-production"
  secrets = ["GITHUB_TOKEN"]
}