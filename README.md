![Logo of git2semver project](https://raw.githubusercontent.com/mitchdenny/git2semver/master/images/logo.png)

# git2semver
> Generate a SemVer compliant version from the Git commit log.

[![Build Status](https://dev.azure.com/mitchdenny/git2semver/_apis/build/status/mitchdenny.git2semver)](https://dev.azure.com/mitchdenny/git2semver/_build/latest?definitionId=39)

Use git2semver to generate a SemVer 2.0 compliant version string from the Git
commit log. This tool is a low depenency module that shells out to Git and
processes its output to do its job so you don't have to worry about having
anything other than Node.js and Git installed. Read the [introductory blog post](https://mitchdenny.com/git2semver/) for an overview.

## Command-line usage

You can use git2semver as a CLI or as an API from your own code. To use it as
a CLI just install it from NPM:

```shell
$ npm install -g git2semver
```

Once it is installed invoke it from within your Git working directory
and it will analyze the commit log and output a string to STDOUT.

```shell
$ git2semver
0.3.0
```

## API usage

To use the ```git2semver``` API install the package into your Node.js codebase and use the following code:

```js
const git2semver = require('git2semver');
const version = await git2semver.getVersion(repositoryPath); // Returns a string
```

## How does it work?

By default ```git2semver``` will look back at the commit history for the latest
tag which matches a semantic version pattern. It then walks back to the HEAD of
the branch analyzing each commit looking for specific patterns in the commit
message.

The patterns are configurable (see below) but by default looks for the
following prefix on each commit message.

| When ```git2semver``` sees ... | ... it does the following. |
| - | - |
| major: | increment the major segment |
| minor: | increment the minor segment |
| patch: | increment the patch segment |

These transformations are applied commit-by-commit on top of the version
detected by looking for the latest tag with a semantic version tag. If no
such tag exists then ```0.0.0``` is assumed.

## Configuration

Configuration is achieved by placing a ```git2semver.config.js``` file in the root of the repository. This file contains what amounts to a Node.js module which describes what triggers major, minor and patch version increments. Here is the default behaviour specified as a configuration file.

```js
module.exports = (policy) => {
    policy.useMainline('major:', 'minor:', 'patch:');
};
```

The ```useMainline``` method is just a helper method to configure some sensible defaults. Under the covers it is the same as doing this.

```js
module.exports = (policy) => {
    this.incrementMajorWhen((commit) => commit.message.toLowerCase().startsWith('major'));
    this.incrementMinorWhen((commit) => commit.message.toLowerCase().startsWith('minor'));
    this.incrementPatchWhen((commit) => commit.message.toLowerCase().startsWith('patch'));
}
```

When ```git2semver``` evaluates the policy defined by the configuration it executes each predicate specified above in order and if the predicate returns true skips the subsequent predicates. You can make your logic inside these predicates as elaborate as you like but just remember that it is executed once per commit since the latest tag that matches a semantic version.

Finally - the API usage also accepts taking configuration as an argument. The argument can either be a simple string or a function. Currently the only string
that is accepted is ```mainline``` so no better than the default behaviour, however
when a function is specified you can pass in any function that takes a ```policy```
object similar to the above configuration files. Here is an example.

```js
const git2semver = require('git2semver');
const version = await git2semver.getVersion(
    repositoryPath,
    (policy) => { policy.useMainline('major:', 'minor:', 'patch:'); }
    );
```

## Contributing

Contributions are welcome in the form of pull requests with new features, issues and integrations. Getting started is pretty straight forward, just clone down the repository and execute ```npm test```. We've got mocha tests wired up that execute all of the existing functionality. When you submit a pull request be sure that include unit tests that cover your new code.

Once your PR is approved and merged the code will automatically be packaged, tested (again) and published to NPM.

## Resources

- Repository: https://github.com/mitchdenny/git2semver/
- Issue tracker: https://github.com/mitchdenny/git2semver/issues
  - In case of sensitive bugs like security vulnerabilities, please contact
    mitch@mitchdenny.com directly instead of using issue tracker. We value your effort to improve the security and privacy of this project!

## Licensing

The code in this project is licensed under [MIT license](LICENSE.md).